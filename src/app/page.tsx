"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/user";
import { getToken } from "@/lib/auth";
import { listDocuments, createDocument, deleteDocument, DocumentMeta } from "@/lib/api";
import { FileText, Plus, Trash2, Clock, RefreshCw } from "lucide-react";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString();
}

function SkeletonCard() {
  return (
    <div className="doc-card animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure token is ready before fetching
      await getToken();
      const { documents } = await listDocuments();
      setDocs(documents);
    } catch (e) {
      setError("Failed to load documents. Check that your server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    fetchDocs();
  }, [fetchDocs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const doc = await createDocument("Untitled Document");
      router.push(`/docs/${doc.id}`);
    } catch {
      setError("Failed to create document.");
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Optimistic update
    setDocs(prev => prev.filter(d => d.id !== id));
    setDeletingId(id);
    try {
      await deleteDocument(id);
    } catch {
      // Rollback on failure
      fetchDocs();
      setError("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <FileText size={22} className="text-blue-400" />
          <span>CollabDocs</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-item active">
            <FileText size={16} />
            All Documents
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar" style={{ background: "#3b82f6" }}>
            {user?.username?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="text-sm text-gray-300 truncate">{user?.username}</span>
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">My Documents</h1>
            <p className="dashboard-subtitle">
              {loading ? "Loading..." : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary"
          >
            {creating ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            New Document
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={fetchDocs} className="text-red-700 underline text-sm ml-2">Retry</button>
          </div>
        )}

        <div className="doc-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : docs.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} className="text-gray-300 mb-3" />
              <p className="text-gray-500 text-lg font-medium">No documents yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first document to get started</p>
              <button onClick={handleCreate} className="btn-primary mt-4">
                <Plus size={16} /> New Document
              </button>
            </div>
          ) : (
            docs.map(doc => (
              <div
                key={doc.id}
                className="doc-card group"
                onClick={() => router.push(`/docs/${doc.id}`)}
              >
                <div className="doc-card-icon">
                  <FileText size={20} className="text-blue-500" />
                </div>
                <h3 className="doc-card-title">{doc.title || "Untitled"}</h3>
                <div className="doc-card-meta">
                  <Clock size={12} />
                  <span>{formatDate(doc.updatedAt)}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="doc-card-delete group-hover:opacity-100"
                  title="Delete document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
