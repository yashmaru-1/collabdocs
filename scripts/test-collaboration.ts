import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import WebSocket from 'ws'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_websockets'
const DOC_NAME = 'test-document-' + Date.now()

// @ts-ignore
global.WebSocket = WebSocket

async function runTest() {
    console.log('--- Starting Integration Test ---')

    const token = jwt.sign({ userId: 'test-user-1', name: 'Tester 1' }, JWT_SECRET, { expiresIn: '1h' })
    console.log('[1] Generated JWT Token ✅')

    const docA = new Y.Doc()
    const providerA = new HocuspocusProvider({
        url: 'ws://localhost:1234',
        name: DOC_NAME,
        document: docA,
        token,
        onAuthenticationFailed: (d) => { console.error('[Client A] Auth Failed:', d); process.exit(1) },
    })

    await new Promise<void>((resolve) => providerA.on('synced', () => resolve()))
    console.log('[2] Client A connected and synced ✅')

    docA.getText('content').insert(0, 'Hello from Client A')
    console.log('[3] Client A wrote content ✅')

    const tokenB = jwt.sign({ userId: 'test-user-2', name: 'Tester 2' }, JWT_SECRET, { expiresIn: '1h' })
    const docB = new Y.Doc()
    const providerB = new HocuspocusProvider({
        url: 'ws://localhost:1234',
        name: DOC_NAME,
        document: docB,
        token: tokenB,
    })

    await new Promise<void>((resolve) => providerB.on('synced', () => resolve()))
    console.log('[4] Client B connected and synced ✅')

    await new Promise((resolve) => setTimeout(resolve, 500))

    const content = docB.getText('content').toString()
    console.log(`[5] Client B reads: "${content}"`)

    if (content === 'Hello from Client A') {
        console.log('\n✅ ALL TESTS PASSED — Real-time sync confirmed!')
    } else {
        console.error(`\n❌ TEST FAILED — Expected "Hello from Client A", got "${content}"`)
        process.exit(1)
    }

    providerA.destroy()
    providerB.destroy()
    process.exit(0)
}

runTest().catch((err) => { console.error('Test error:', err); process.exit(1) })
