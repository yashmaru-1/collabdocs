import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiter (suitable for single-instance MVP)
// Production: use Redis + sliding window
const ipRequestMap = new Map<string, { count: number; windowStart: number }>()

const WINDOW_MS = 60_000      // 1-minute window
const MAX_REQUESTS = 60       // 60 req/min per IP

export function rateLimit(req: NextRequest): NextResponse | null {
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        'unknown'

    const now = Date.now()
    const entry = ipRequestMap.get(ip)

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        // New window
        ipRequestMap.set(ip, { count: 1, windowStart: now })
        return null // OK
    }

    entry.count++
    if (entry.count > MAX_REQUESTS) {
        console.warn(`[RateLimit] ${ip} exceeded ${MAX_REQUESTS} req/min`)
        return NextResponse.json(
            { error: 'Too many requests. Please slow down.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000)),
                    'X-RateLimit-Limit': String(MAX_REQUESTS),
                    'X-RateLimit-Remaining': '0',
                },
            }
        )
    }

    return null // OK
}

// Clean up expired entries every 5 minutes (memory leak prevention)
if (typeof globalThis !== 'undefined') {
    setInterval(() => {
        const now = Date.now()
        for (const [ip, entry] of ipRequestMap.entries()) {
            if (now - entry.windowStart > WINDOW_MS * 2) {
                ipRequestMap.delete(ip)
            }
        }
    }, 5 * 60_000)
}
