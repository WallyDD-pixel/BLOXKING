/** Fenêtre pendant laquelle un utilisateur compte comme « en ligne ». */
export const PRESENCE_ONLINE_MINUTES = Math.min(
  Math.max(
    Number(process.env.PRESENCE_ONLINE_MINUTES ?? "5") || 5,
    1,
  ),
  60,
);

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
