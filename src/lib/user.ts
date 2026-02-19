// User identity persistence — MVP implementation (localStorage only)
// Production: replace with server-issued JWT from proper auth provider.

export interface UserIdentity {
    userId: string
    username: string
    color: string
}

const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

function generateId(): string {
    return Math.random().toString(36).slice(2, 10)
}

function randomColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export function getUser(): UserIdentity {
    if (typeof window === 'undefined') {
        return { userId: 'ssr-user', username: 'Anonymous', color: COLORS[0] }
    }
    try {
        const stored = localStorage.getItem('collab-identity')
        if (stored) return JSON.parse(stored) as UserIdentity
    } catch { }

    const identity: UserIdentity = {
        userId: generateId(),
        username: `User-${Math.floor(Math.random() * 9000 + 1000)}`,
        color: randomColor(),
    }
    localStorage.setItem('collab-identity', JSON.stringify(identity))
    return identity
}

export function updateUsername(name: string): UserIdentity {
    const user = getUser()
    const updated = { ...user, username: name }
    localStorage.setItem('collab-identity', JSON.stringify(updated))
    return updated
}
