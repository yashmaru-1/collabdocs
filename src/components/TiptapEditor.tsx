"use client";

import { EditorContent, Editor } from "@tiptap/react";
import {
    Bold, Italic, Strikethrough, Code, List, ListOrdered,
    Heading1, Heading2, Quote, Undo2, Redo2, WifiOff,
} from "lucide-react";

const Separator = () => <div className="toolbar-sep" />;

const ToolbarBtn = ({
    onClick, active, disabled, title, children
}: {
    onClick: () => void; active?: boolean; disabled?: boolean;
    title: string; children: React.ReactNode
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`toolbar-btn ${active ? "active" : ""}`}
    >
        {children}
    </button>
);

export const TiptapEditor = ({
    editor,
    status,
}: {
    editor: Editor | null;
    status?: "connecting" | "connected" | "disconnected";
}) => {
    if (!editor) return null;

    const isReadOnly = !editor.isEditable;

    return (
        <div className="editor-wrapper">
            {/* Reconnecting overlay */}
            {status === "disconnected" && (
                <div className="reconnecting-overlay">
                    <div className="reconnecting-badge">
                        <WifiOff size={15} />
                        Reconnecting… Your changes are saved locally.
                    </div>
                </div>
            )}

            {/* Read-only banner */}
            {isReadOnly && (
                <div className="readonly-banner">
                    👁 You have read-only access to this document.
                </div>
            )}

            {/* Toolbar */}
            {!isReadOnly && (
                <div className="toolbar">
                    <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                        <Undo2 size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                        <Redo2 size={16} />
                    </ToolbarBtn>

                    <Separator />

                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
                        <Bold size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
                        <Italic size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
                        <Strikethrough size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
                        <Code size={16} />
                    </ToolbarBtn>

                    <Separator />

                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
                        <Heading1 size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
                        <Heading2 size={16} />
                    </ToolbarBtn>

                    <Separator />

                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
                        <List size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
                        <ListOrdered size={16} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
                        <Quote size={16} />
                    </ToolbarBtn>
                </div>
            )}

            {/* Editor content — paper canvas */}
            <div className="paper-canvas">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};
