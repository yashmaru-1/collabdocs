// Unified auth token helper.
// Same JWT is used for both HTTP API calls and WebSocket (Hocuspocus) auth.
// This ensures a single consistent identity across both channels.

let cachedToken: string | null = null
let tokenExpiry = 0

export async function getToken(): Promise<string> {
    const now = Date.now()

    // Return cached token if still valid (with 30s buffer)
    if (cachedToken && now < tokenExpiry - 30_000) {
        return cachedToken
    }

    // Import here to avoid SSR issues
    const { getUser } = await import('./user')
    const { userId, username } = getUser()

    const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: username }),
    })

    if (!res.ok) throw new Error('Failed to get auth token')
    const { token } = await res.json()

    // JWT expires in 1h — cache for 55 minutes
    cachedToken = token
    tokenExpiry = now + 55 * 60 * 1000
    return token
}

export function clearToken() {
    cachedToken = null
    tokenExpiry = 0
}
