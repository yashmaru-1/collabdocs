"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

export default function EditorError({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    const router = useRouter();

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-sm border border-red-100">
                <FileText size={40} className="text-red-400 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
                <p className="text-gray-500 text-sm mb-6">{error?.message || "Failed to load this document."}</p>
                <div className="flex gap-3 justify-center">
                    <button onClick={reset} className="btn-primary">Try again</button>
                    <button onClick={() => router.push("/")} className="btn-secondary">Go to dashboard</button>
                </div>
            </div>
        </div>
    );
}
