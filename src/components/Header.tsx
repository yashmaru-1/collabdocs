"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Share2, CheckCircle, Wifi, WifiOff, Loader2 } from "lucide-react";
import { ConnectedUser } from "@/hooks/use-collaborative-editor";

interface HeaderProps {
    title: string;
    titleError?: boolean;
    status: "connecting" | "connected" | "disconnected";
    connectedUsers: ConnectedUser[];
    onTitleChange: (title: string) => void;
    onBack: () => void;
}

export const Header = ({ title, titleError, status, connectedUsers, onTitleChange, onBack }: HeaderProps) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => { setDraft(title); }, [title]);
    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    const commit = () => {
        setEditing(false);
        if (draft.trim() && draft.trim() !== title) {
            onTitleChange(draft.trim());
        } else {
            setDraft(title);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const StatusIndicator = () => {
        if (status === "connected") return (
            <span className="status-badge connected"><Wifi size={11} /> Saved</span>
        );
        if (status === "disconnected") return (
            <span className="status-badge disconnected"><WifiOff size={11} /> Offline</span>
        );
        return (
            <span className="status-badge connecting"><Loader2 size={11} className="animate-spin" /> Connecting</span>
        );
    };

    return (
        <header className="editor-header">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={onBack} className="header-back-btn" title="Back to dashboard">
                    <ArrowLeft size={18} />
                </button>

                <div className="header-divider" />

                {editing ? (
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={e => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") { setDraft(title); setEditing(false); }
                        }}
                        className="title-input"
                        maxLength={100}
                    />
                ) : (
                    <h1
                        className={`doc-title ${titleError ? "text-red-500" : ""}`}
                        onClick={() => setEditing(true)}
                        title="Click to rename"
                    >
                        {title}
                    </h1>
                )}

                <StatusIndicator />
            </div>

            <div className="flex items-center gap-3">
                {/* Connected user avatars */}
                {connectedUsers.length > 0 && (
                    <div className="avatar-stack">
                        {connectedUsers.slice(0, 5).map(u => (
                            <div
                                key={u.userId}
                                className="user-avatar"
                                style={{ background: u.color }}
                                title={u.name}
                            >
                                {u.name[0]?.toUpperCase() ?? "?"}
                            </div>
                        ))}
                        {connectedUsers.length > 5 && (
                            <div className="user-avatar" style={{ background: "#6b7280" }}>
                                +{connectedUsers.length - 5}
                            </div>
                        )}
                    </div>
                )}

                <button onClick={handleShare} className="btn-share">
                    {copied ? <><CheckCircle size={15} /> Copied!</> : <><Share2 size={15} /> Share</>}
                </button>
            </div>
        </header>
    );
};
