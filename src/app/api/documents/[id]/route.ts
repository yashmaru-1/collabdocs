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

// GET /api/documents/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const limited = rateLimit(req); if (limited) return limited
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const doc = await prisma.document.findUnique({
        where: { id },
        select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true, collaborators: { select: { userId: true } } },
    })

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = doc.ownerId === userId
    const isCollaborator = doc.collaborators.some(c => c.userId === userId)
    if (!isOwner && !isCollaborator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json({
        id: doc.id, title: doc.title, ownerId: doc.ownerId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    })
}

// PUT /api/documents/[id] — Update title (last-write-wins, acceptable for MVP)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const limited = rateLimit(req); if (limited) return limited
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { title } = await req.json()
    const updated = await prisma.document.update({
        where: { id },
        data: { title: title?.trim() || 'Untitled' },
        select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
    })
}

// DELETE /api/documents/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const limited = rateLimit(req); if (limited) return limited
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.ownerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.document.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
}
