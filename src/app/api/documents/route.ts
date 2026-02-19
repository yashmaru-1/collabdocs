import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_websockets'

function getUserIdFromRequest(req: NextRequest): string | null {
    const auth = req.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return null
    try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string }
        return payload.userId
    } catch {
        return null
    }
}

// GET /api/documents?limit=20&cursor=<updatedAt ISO>
// Returns documents owned by the authenticated user, ordered by updatedAt DESC.
// Cursor = updatedAt of the last item (ISO string) for cursor-based pagination.
export async function GET(req: NextRequest) {
    const limited = rateLimit(req); if (limited) return limited
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const cursor = searchParams.get('cursor') // ISO updatedAt of last seen item

    const docs = await prisma.document.findMany({
        where: {
            ownerId: userId,
            // Cursor: only return documents older than cursor
            ...(cursor ? { updatedAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1, // fetch one extra to determine if there's a next page
        select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
    })

    const hasMore = docs.length > limit
    const items = hasMore ? docs.slice(0, limit) : docs
    const nextCursor = hasMore ? items[items.length - 1].updatedAt.toISOString() : null

    return NextResponse.json({
        documents: items.map(d => ({
            ...d,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
        })),
        nextCursor,
    })
}

// POST /api/documents — Create new document
export async function POST(req: NextRequest) {
    const limited = rateLimit(req); if (limited) return limited
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title = 'Untitled' } = await req.json().catch(() => ({}))

    const doc = await prisma.document.create({
        data: { title, ownerId: userId },
        select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    }, { status: 201 })
}
