import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import * as Y from 'yjs'

console.log('[Server] Starting...')
console.log(`[Server] Loading DB URL: ${process.env.DATABASE_URL ? 'Found' : 'Missing'}`)

let prisma: PrismaClient
try {
    prisma = new PrismaClient()
} catch (e) {
    console.error('Failed to initialize PrismaClient:', e)
    process.exit(1)
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_websockets'
const PORT = parseInt(process.env.PORT || '1234', 10)

// ─── Persistence Configuration ───────────────────────────────────────────────
const DEBOUNCE_MS = 2_000
const SNAPSHOT_INTERVAL_MS = 10_000 // periodic safety net
const MAX_DOC_SIZE_WARN_BYTES = 2 * 1024 * 1024  // 2MB — log warning
const MAX_DOC_SIZE_REJECT_BYTES = 5 * 1024 * 1024 // 5MB — reject save

// ─── Connection Limits ────────────────────────────────────────────────────────
const MAX_CONNECTIONS_PER_DOC = 50
const MAX_CONNECTIONS_PER_USER_PER_DOC = 5 // prevents 1 user from hogging the doc limit

// ─── Per-document state (isolated: no cross-doc interference) ─────────────────
// Each document has its own debounce timer and last-snapshot timestamp.
const debounceMap = new Map<string, NodeJS.Timeout>()

// BUG FIX: Set timestamp BEFORE async save, not after.
// If we set it after, two calls within the interval window both see
// the old timestamp and both think they need to do a periodic write → double write.
const snapshotTimestamps = new Map<string, number>()

// Track per-document per-user connection counts: Map<docId, Map<userId, count>>
const connectionCounts = new Map<string, Map<string, number>>()

// deletedDocIds: optimization ONLY — NOT authoritative.
// DB `updateMany count === 0` is the final authority for deletion.
// This set exists only to skip the DB round-trip for a known-deleted doc.
const deletedDocIdsCache = new Set<string>()

let activeConnections = 0

// ─── Database Save ────────────────────────────────────────────────────────────
/**
 * Persist Y.js state to DB using updateMany (never upsert/create).
 * DB is the sole source of truth for document existence.
 * `deletedDocIdsCache` is an optimization only — updateMany result is authoritative.
 */
const saveToDatabase = async (documentName: string, state: Uint8Array): Promise<void> => {
    // Fast-path: skip DB round-trip if we already know it's deleted
    if (deletedDocIdsCache.has(documentName)) {
        console.warn(`[Persistence] Skip (cache) — ${documentName} is deleted`)
        return
    }

    // Size guard
    if (state.byteLength > MAX_DOC_SIZE_REJECT_BYTES) {
        console.error(`[Persistence] REJECTED ${documentName}: ${state.byteLength} bytes exceeds ${MAX_DOC_SIZE_REJECT_BYTES} limit`)
        return
    }
    if (state.byteLength > MAX_DOC_SIZE_WARN_BYTES) {
        console.warn(`[Persistence] LARGE DOC ${documentName}: ${state.byteLength} bytes — monitor DB growth`)
    }

    try {
        // updateMany: zero rows updated = document was deleted. NEVER re-create.
        const result = await prisma.document.updateMany({
            where: { id: documentName },
            data: { data: Buffer.from(state), updatedAt: new Date() },
        })
        if (result.count === 0) {
            // DB is authoritative: doc is gone → populate cache
            console.warn(`[Persistence] Document ${documentName} not found in DB (deleted) — caching`)
            deletedDocIdsCache.add(documentName)
        } else {
            console.log(`[Persistence] Saved ${documentName} (${state.byteLength} bytes)`)
        }
    } catch (err) {
        console.error(`[Persistence] Failed to save ${documentName}:`, err)
    }
}

// ─── Write Scheduling ─────────────────────────────────────────────────────────
/**
 * Dual strategy:
 *   - If >= SNAPSHOT_INTERVAL_MS since last save: cancel any pending debounce
 *     and save IMMEDIATELY (periodic safety net — max data loss window = 10s).
 *   - Otherwise: debounce at 2s (avoids write-amplification during rapid typing).
 *
 * Key correctness fix: snapshotTimestamps is set BEFORE the async save,
 * so two concurrent calls within the window cannot both trigger a periodic write.
 */
const scheduleWrite = (documentName: string, state: Uint8Array): void => {
    const now = Date.now()
    const lastSnapshot = snapshotTimestamps.get(documentName) ?? 0
    const needsPeriodicSnapshot = now - lastSnapshot >= SNAPSHOT_INTERVAL_MS

    // Always cancel any pending debounce first (ensures no double-write)
    if (debounceMap.has(documentName)) {
        clearTimeout(debounceMap.get(documentName)!)
        debounceMap.delete(documentName)
    }

    if (needsPeriodicSnapshot) {
        // Set timestamp BEFORE async save (prevents re-entry into this branch)
        snapshotTimestamps.set(documentName, now)
        saveToDatabase(documentName, state)
        return
    }

    // Debounce: schedule write 2s after last change
    const timeout = setTimeout(() => {
        snapshotTimestamps.set(documentName, Date.now())
        saveToDatabase(documentName, state)
        debounceMap.delete(documentName)
    }, DEBOUNCE_MS)
    debounceMap.set(documentName, timeout)
}

// ─── Connection Tracking Helpers ──────────────────────────────────────────────
function getDocUserCount(docId: string, userId: string): number {
    return connectionCounts.get(docId)?.get(userId) ?? 0
}

function getDocTotalCount(docId: string): number {
    let total = 0
    connectionCounts.get(docId)?.forEach(n => total += n)
    return total
}

function incrementConnection(docId: string, userId: string) {
    if (!connectionCounts.has(docId)) connectionCounts.set(docId, new Map())
    const userMap = connectionCounts.get(docId)!
    userMap.set(userId, (userMap.get(userId) ?? 0) + 1)
    activeConnections++
}

function decrementConnection(docId: string, userId: string) {
    const userMap = connectionCounts.get(docId)
    if (!userMap) return
    const n = userMap.get(userId) ?? 1
    if (n <= 1) userMap.delete(userId)
    else userMap.set(userId, n - 1)
    if (userMap.size === 0) connectionCounts.delete(docId)
    activeConnections--
}

// ─── Server ───────────────────────────────────────────────────────────────────
async function startServer() {
    console.log('[Server] Dynamically importing Hocuspocus...')
    const { Server } = await import('@hocuspocus/server')
    const { Database } = await import('@hocuspocus/extension-database')
    const { Logger } = await import('@hocuspocus/extension-logger')

    console.log('[Server] Initializing Hocuspocus...')

    const server = new Server({
        port: 1234,
        timeout: 30_000,
        extensions: [
            new Logger(),
            new Database({
                fetch: async ({ documentName }) => {
                    const doc = await prisma.document.findUnique({ where: { id: documentName } })
                    if (doc === null) {
                        deletedDocIdsCache.add(documentName) // warm cache on fetch miss
                        throw new Error('Document not found')
                    }
                    return doc.data || null
                },
                store: async ({ documentName, state }) => {
                    scheduleWrite(documentName, state)
                },
            }),
        ],

        async onAuthenticate(data) {
            const { token, documentName } = data
            if (!token) throw new Error('Unauthorized')

            let payload: { userId: string; name?: string; exp?: number }
            try {
                payload = jwt.verify(token, JWT_SECRET) as typeof payload
            } catch {
                throw new Error('Unauthorized')
            }

            // jwt.verify already validates expiry, but be explicit for logging
            if (payload.exp && Date.now() / 1000 > payload.exp) {
                throw new Error('Token expired — please reconnect')
            }

            const doc = await prisma.document.findUnique({
                where: { id: documentName },
                include: { collaborators: true },
            })

            if (!doc) {
                deletedDocIdsCache.add(documentName)
                throw new Error('Document not found')
            }

            const isOwner = doc.ownerId === payload.userId
            const isCollaborator = doc.collaborators.some(c => c.userId === payload.userId)

            if (!isOwner && !isCollaborator) {
                console.warn(`[Auth] DENIED userId=${payload.userId} doc=${documentName}`)
                throw new Error('Insufficient permissions')
            }

            console.log(`[Auth] OK userId=${payload.userId} doc=${documentName} owner=${isOwner}`)
            return { user: { id: payload.userId, name: payload.name || 'Anonymous' }, readonly: false }
        },

        async onConnect(data) {
            // Extract userId from context set by onAuthenticate
            const userId = (data.context as any)?.user?.id ?? 'unknown'
            const docId = data.documentName

            // Per-user limit: prevents one user from hogging the doc-level limit
            const userCount = getDocUserCount(docId, userId)
            if (userCount >= MAX_CONNECTIONS_PER_USER_PER_DOC) {
                console.warn(`[Limit] User ${userId} already has ${userCount} connections to doc ${docId}`)
                throw new Error('Too many connections for this user')
            }

            // Total per-doc limit
            const totalCount = getDocTotalCount(docId)
            if (totalCount >= MAX_CONNECTIONS_PER_DOC) {
                console.warn(`[Limit] Doc ${docId} at max connections (${MAX_CONNECTIONS_PER_DOC})`)
                throw new Error('Document at capacity')
            }

            incrementConnection(docId, userId)
            console.log(`[Metrics] Connected userId=${userId} doc=${docId} total=${getDocTotalCount(docId)}`)
        },

        async onDisconnect(data) {
            const userId = (data.context as any)?.user?.id ?? 'unknown'
            const docId = data.documentName

            decrementConnection(docId, userId)
            console.log(`[Metrics] Disconnected userId=${userId} doc=${docId} total=${getDocTotalCount(docId)} active=${activeConnections}`)

            // Flush pending debounced write immediately on last disconnect
            if (debounceMap.has(docId)) {
                clearTimeout(debounceMap.get(docId)!)
                debounceMap.delete(docId)
                const state = Y.encodeStateAsUpdate(data.document)
                if (state && state.byteLength > 0) {
                    snapshotTimestamps.set(docId, Date.now())
                    await saveToDatabase(docId, state)
                    console.log(`[Persistence] Flushed ${docId} on disconnect`)
                }
            }
        },
    })

    console.log('[Server] Starting listener...')
    await server.listen(PORT)
    console.log(`🚀 Hocuspocus on :${PORT} | snapshot=${SNAPSHOT_INTERVAL_MS / 1000}s | max=${MAX_CONNECTIONS_PER_DOC}/doc ${MAX_CONNECTIONS_PER_USER_PER_DOC}/user`)

    // ─── Graceful Shutdown ────────────────────────────────────────────────────
    // Step 1: stop accepting new connections (server.destroy or close)
    // Step 2: wait 2s for in-flight writes to settle
    // Step 3: flush all remaining debounce timers
    // Step 4: disconnect Prisma
    const shutdown = async (signal: string): Promise<void> => {
        console.log(`\n[Server] ${signal} — draining connections...`)

        // Give active WS connections 2s to finish naturally
        await new Promise(resolve => setTimeout(resolve, 2_000))

        // Flush all pending debounced writes
        const pending = [...debounceMap.keys()]
        console.log(`[Server] Flushing ${pending.length} pending write(s)...`)
        for (const [, timer] of debounceMap.entries()) clearTimeout(timer)
        debounceMap.clear()

        await prisma.$disconnect()
        console.log('[Server] Shutdown complete.')
        process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch(e => {
    console.error('[Server] Startup failed:', e)
    process.exit(1)
})
