"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

export interface ConnectedUser {
  userId: string;
  name: string;
  color: string;
}

// Stale awareness cleanup: remove users not seen in N ms
// 50s TTL: large enough for background tab throttling (browsers throttle to ~1 update/min)
const STALE_USER_MS = 50_000

export const useCollaborativeEditor = (
  docId: string,
  token: string,
  user: { userId: string; name: string; color: string },
  onError?: (reason: string) => void
) => {
  // Initialize Y.Doc synchronously. useMemo ensures stable reference per docId.
  // This prevents the "getXmlFragment" crash on first render.
  const doc = useMemo(() => new Y.Doc(), [docId]);

  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [synced, setSynced] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);

  // Track last-seen timestamps for stale awareness cleanup
  const userLastSeen = useRef(new Map<string, number>())

  // Cleanup doc on unmount or id change
  useEffect(() => {
    return () => {
      doc.destroy();
    };
  }, [doc]);

  useEffect(() => {
    if (!token || !docId) return;

    const newProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234",
      name: docId,
      document: doc,
      token,
      onSynced: () => setSynced(true),
      onConnect: () => setStatus("connected"),
      onDisconnect: () => {
        setStatus("disconnected");
        setSynced(false);
      },
      onAuthenticationFailed: (data) => {
        console.error("[Auth] WebSocket auth failed:", data);
        onError?.("auth_failed");
      },
      onStatus: ({ status: s }) => {
        if (s === "connected") setStatus("connected");
        else if (s === "disconnected") setStatus("disconnected");
        else setStatus("connecting");
      },
    });

    // ─── Monkey-patch for Tiptap Compatibility ──────────────────────────────
    // Tiptap CollaborationCursor v2 expects `provider.doc`.
    // HocuspocusProvider v3 uses `provider.document`.
    // We polyfill `.doc` safely to prevent crash.
    if (!(newProvider as any).doc) {
      (newProvider as any).doc = doc;
    }

    // ─── Awareness: deduplicated by userId, stale-cleaned by timestamp ──────
    const updateConnectedUsers = () => {
      const states = newProvider.awareness?.getStates();
      if (!states) return;

      const now = Date.now();
      const userMap = new Map<string, ConnectedUser>();

      states.forEach((state: any) => {
        if (state?.user?.userId) {
          const uid = state.user.userId;
          userLastSeen.current.set(uid, now);
          // Latest state wins for same userId (multiple tabs)
          userMap.set(uid, {
            userId: uid,
            name: state.user.name || "Anonymous",
            color: state.user.color || "#3b82f6",
          });
        }
      });

      // Remove stale users (haven't sent awareness update in STALE_USER_MS)
      for (const [uid, lastSeen] of userLastSeen.current.entries()) {
        if (now - lastSeen > STALE_USER_MS) {
          userMap.delete(uid);
          userLastSeen.current.delete(uid);
        }
      }

      setConnectedUsers(Array.from(userMap.values()));
    };

    newProvider.awareness?.on("change", updateConnectedUsers);

    // Set own presence
    newProvider.awareness?.setLocalStateField("user", {
      userId: user.userId,
      name: user.name,
      color: user.color,
    });

    // Periodic stale-user sweep (handles disconnect without awareness cleanup)
    const staleCleanupInterval = setInterval(updateConnectedUsers, 15_000)

    setProvider(newProvider);

    return () => {
      clearInterval(staleCleanupInterval)
      newProvider.awareness?.off("change", updateConnectedUsers);
      newProvider.destroy();
      setSynced(false);
      setStatus("connecting");
      setConnectedUsers([]);
      userLastSeen.current.clear()
    };
  }, [docId, token, doc, onError, user.userId, user.name, user.color]);

  const editor = useEditor(
    {
      immediatelyRender: false, // Required for Next.js SSR
      editable: !isReadOnly,
      extensions: [
        // @ts-ignore – Tiptap v3 types
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: doc }),
        // Only add cursor if provider exists to prevent crash
        ...(provider ? [CollaborationCursor.configure({
          provider: provider,
          user: { name: user.name, color: user.color },
        })] : []),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-slate max-w-none focus:outline-none min-h-[500px] p-8",
        },
      },
    },
    [doc, provider, isReadOnly, user.name, user.color]
  );

  return { editor, provider, synced, status, isReadOnly, connectedUsers };
};
