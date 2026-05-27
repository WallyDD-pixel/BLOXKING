"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DisputeChatMessageRow } from "@/app/play/actions";
import { formatDateTimeFr } from "@/lib/format-datetime";

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.618m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.008M12 12h.008v.008H12V12zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.008M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.818-1.145 4.97 4.97 0 00-1.127-2.412 8.25 8.25 0 1115.536-5.473z"
      />
    </svg>
  );
}

export function MatchOpponentChatWidget({
  userId,
  inDispute,
  messages,
  draft,
  onDraftChange,
  pending,
  onSend,
}: {
  userId: string;
  inDispute: boolean;
  messages: DisputeChatMessageRow[];
  draft: string;
  onDraftChange: (value: string) => void;
  pending: boolean;
  onSend: (text: string) => Promise<{ error?: string } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const [flashIncoming, setFlashIncoming] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevUnreadRef = useRef(0);

  const unreadCount = useMemo(() => {
    if (open) return 0;
    return messages.slice(lastReadCount).filter((m) => m.author_id !== userId)
      .length;
  }, [open, messages, lastReadCount, userId]);

  const lastOpponentMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].author_id !== userId) return messages[i];
    }
    return null;
  }, [messages, userId]);

  useEffect(() => {
    if (open) {
      setLastReadCount(messages.length);
      setFlashIncoming(false);
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (open) return;
    if (unreadCount > prevUnreadRef.current) {
      setFlashIncoming(true);
      const t = setTimeout(() => setFlashIncoming(false), 8000);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function handleSend() {
    const text = draft.trim();
    if (text.length < 1 || pending) return;
    const res = await onSend(text);
    if (res && "error" in res && res.error) return;
    onDraftChange("");
  }

  const hasUnread = unreadCount > 0;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[200]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-chat-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Fermer la conversation"
            onClick={close}
          />
          <div
            className="absolute bottom-[6.5rem] right-3 flex w-[min(calc(100vw-1.5rem),22rem)] flex-col overflow-hidden rounded-2xl border border-emerald-500/35 bg-zinc-950 shadow-[0_12px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(16,185,129,0.15)] sm:right-6 sm:w-[24rem]"
            style={{ maxHeight: "min(70vh, 28rem)" }}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-emerald-950/50 to-zinc-950 px-4 py-3">
              <div className="min-w-0">
                <p
                  id="match-chat-dialog-title"
                  className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-200/95"
                >
                  Messages
                </p>
                <p className="mt-0.5 truncate text-[0.7rem] leading-snug text-zinc-500">
                  {inDispute
                    ? "Échange avec l’adversaire · preuves via modération"
                    : "Salon, horaires, ready… · visible par vous deux"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
                aria-label="Fermer"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </header>

            <ul
              ref={listRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
              aria-label="Messages avec l'adversaire"
            >
              {messages.length === 0 ? (
                <li className="py-6 text-center text-sm leading-relaxed text-zinc-500">
                  Aucun message — propose un salon Roblox ou dis bonjour.
                </li>
              ) : (
                messages.map((msg) => {
                  const mine = msg.author_id === userId;
                  const when = formatDateTimeFr(msg.created_at, {
                    dateStyle: "short",
                    timeStyle: "short",
                  });
                  return (
                    <li
                      key={msg.id}
                      className={`max-w-[92%] rounded-xl border px-3 py-2 text-sm ${
                        mine
                          ? "ml-auto border-emerald-500/30 bg-emerald-950/40 text-zinc-100"
                          : "mr-auto border-amber-500/35 bg-amber-500/15 text-zinc-100 ring-1 ring-amber-400/20"
                      }`}
                    >
                      <p className="font-mono text-[0.5rem] text-zinc-500">
                        {mine ? "Toi" : "Adversaire"} · {when}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </p>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="shrink-0 border-t border-white/10 bg-zinc-950/95 p-3">
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="Écris un message…"
                  className="min-h-[3.25rem] w-full resize-none rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/35 focus:outline-none focus:ring-1 focus:ring-emerald-500/25"
                  aria-label="Message pour l'adversaire"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[0.5rem] text-zinc-600">
                    {draft.trim().length}/2000 · Entrée pour envoyer
                  </p>
                  <button
                    type="button"
                    disabled={pending || draft.trim().length < 1}
                    onClick={() => void handleSend()}
                    className="game-btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!open && hasUnread && lastOpponentMessage ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[5.5rem] right-3 z-[195] max-w-[min(calc(100vw-5.5rem),18rem)] rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-amber-600/15 px-4 py-3 text-left shadow-[0_8px_32px_rgba(245,158,11,0.35)] ring-2 ring-amber-400/40 sm:right-6"
        >
          <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-wider text-amber-200">
            Nouveau message
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-100">
            {lastOpponentMessage.body}
          </p>
          <p className="mt-2 text-xs font-medium text-amber-300/95">
            Appuyer pour ouvrir →
          </p>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-4 z-[190] flex items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 ${
          hasUnread
            ? "h-[4.25rem] w-[4.25rem] border-2 border-amber-300/80 bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-[0_0_0_4px_rgba(245,158,11,0.45),0_8px_40px_rgba(16,185,129,0.55)]"
            : "h-14 w-14 border border-emerald-400/45 bg-gradient-to-br from-emerald-500/90 to-emerald-700/95 shadow-[0_4px_24px_rgba(16,185,129,0.35)]"
        } ${flashIncoming ? "animate-pulse" : ""}`}
        aria-label={
          hasUnread
            ? `Ouvrir la conversation (${unreadCount} nouveau${unreadCount > 1 ? "x" : ""})`
            : "Ouvrir la conversation avec l'adversaire"
        }
      >
        {hasUnread ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/30 animate-ping"
            aria-hidden
          />
        ) : null}
        <ChatIcon className={hasUnread ? "relative h-8 w-8" : "relative h-7 w-7"} />
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border-[3px] border-zinc-950 bg-amber-400 px-1.5 font-mono text-xs font-bold text-zinc-950 shadow-lg shadow-amber-900/50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          <span className="absolute -bottom-1 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-zinc-950/95 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-emerald-200/90 sm:block">
            Messages
          </span>
        )}
      </button>
    </>
  );
}
