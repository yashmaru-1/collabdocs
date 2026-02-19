// Typed API helpers for document CRUD.
// All requests attach Authorization: Bearer <token> (same JWT as WebSocket).

import { getToken } from './auth'

export interface DocumentMeta {
    id: string
    title: string
    ownerId: string
    createdAt: string
    updatedAt: string
}

export interface ListDocumentsResponse {
    documents: DocumentMeta[]
    nextCursor: string | null // updatedAt ISO of last item
}

async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await getToken()
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    })
}

export async function listDocuments(cursor?: string, limit = 20): Promise<ListDocumentsResponse> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    const res = await authedFetch(`/api/documents?${params}`)
    if (!res.ok) throw new Error('Failed to list documents')
    return res.json()
}

export async function createDocument(title = 'Untitled'): Promise<DocumentMeta> {
    const res = await authedFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error('Failed to create document')
    return res.json()
}

export async function updateDocumentTitle(id: string, title: string): Promise<DocumentMeta> {
    const res = await authedFetch(`/api/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error('Failed to update document')
    return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
    const res = await authedFetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete document')
}

export async function getDocument(id: string): Promise<DocumentMeta | null> {
    const res = await authedFetch(`/api/documents/${id}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Failed to fetch document')
    return res.json()
}
