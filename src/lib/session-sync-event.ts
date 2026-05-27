export const SESSION_SYNC_EVENT = "bk:session-sync";

export type SessionSyncNotification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
};

export type SessionSyncDetail = {
  unreadCount: number;
  notifications: SessionSyncNotification[];
};

export function dispatchSessionSync(detail: SessionSyncDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_SYNC_EVENT, { detail }));
}
