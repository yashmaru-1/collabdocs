import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_for_websockets";

export async function POST(req: NextRequest) {
    // In a real app, check session/cookie here (e.g. NextAuth getServerSession)
    // For demo, we mock a user or accept one from body

    const body = await req.json().catch(() => ({}));
    const userId = body.userId || "anon-" + Math.random().toString(36).substring(7);
    const name = body.name || "Anonymous";

    // Ensure user exists in DB so foreign keys work
    await prisma.user.upsert({
        where: { id: userId },
        update: { name },
        create: { id: userId, name },
    });

    // Create short-lived token (e.g., 10m)
    const token = jwt.sign({ userId, name }, JWT_SECRET, { expiresIn: "10m" });

    return NextResponse.json({ token });
}
