"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCollaborativeEditor } from "@/hooks/use-collaborative-editor";
import { getUser } from "@/lib/user";
import { getToken } from "@/lib/auth";
import { updateDocumentTitle, getDocument } from "@/lib/api";
import { Header } from "@/components/Header";
import { TiptapEditor } from "@/components/TiptapEditor";

export default function DocumentPage() {
    const params = useParams();
    const router = useRouter();
    const docId = params.id as string;

    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState({ userId: "", name: "", color: "#3b82f6" });
    const [title, setTitle] = useState("Loading...");
    const [titleError, setTitleError] = useState(false);
    const [deletedRedirect, setDeletedRedirect] = useState(false);

    // Initialize user identity and token
    useEffect(() => {
        const u = getUser();
        setUser({ userId: u.userId, name: u.username, color: u.color });

        getToken()
            .then(setToken)
            .catch(() => router.push("/"));
    }, []);

    // Fetch document metadata
    useEffect(() => {
        if (!token || !docId) return;
        getDocument(docId).then(doc => {
            if (!doc) {
                // Document doesn't exist — go home
                router.push("/");
                return;
            }
            setTitle(doc.title);
        });
    }, [token, docId]);

    const handleError = useCallback((reason: string) => {
        if (reason === "auth_failed" || reason === "doc_not_found") {
            setDeletedRedirect(true);
            setTimeout(() => router.push("/"), 2500);
        }
    }, [router]);

    const { editor, synced, status, connectedUsers } = useCollaborativeEditor(
        docId,
        token || "",
        user,
        handleError
    );

    // Inline title save — optimistic, last-write-wins
    const saveTitle = useCallback(async (newTitle: string) => {
        const trimmed = newTitle.trim() || "Untitled";
        setTitle(trimmed); // Optimistic
        try {
            await updateDocumentTitle(docId, trimmed);
        } catch {
            setTitleError(true);
            setTimeout(() => setTitleError(false), 3000);
        }
    }, [docId]);

    if (deletedRedirect) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-red-100">
                    <p className="text-red-600 font-semibold text-lg mb-1">Document unavailable</p>
                    <p className="text-gray-500 text-sm">This document was deleted or you lost access. Redirecting...</p>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!synced) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="spinner mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Connecting to document...</p>
                    <p className="text-gray-400 text-xs mt-1">Waiting for real-time server</p>
                </div>
            </div>
        );
    }

    return (
        <div className="editor-layout">
            <Header
                title={title}
                titleError={titleError}
                status={status}
                connectedUsers={connectedUsers}
                onTitleChange={saveTitle}
                onBack={() => router.push("/")}
            />
            <div className="editor-canvas">
                <TiptapEditor editor={editor} status={status} />
            </div>
        </div>
    );
}
