"use client";

import { useState } from "react";

type Diag = {
  configured: boolean;
  issues: string[];
  verify: { ok: true } | { ok: false; error: string } | null;
};

export function AdminSmtpTest() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/smtp-test");
      const data = (await res.json()) as Diag & { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Diagnostic impossible");
        setDiag(null);
        return;
      }
      setDiag(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/smtp-test", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        to?: string;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Échec de l'envoi test");
        return;
      }
      setMsg(`E-mail test envoyé à ${data.to ?? "ton adresse admin"}. Vérifie les spams.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
      <h2 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        E-mails (SMTP)
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Litiges, résultats de match, etc. Nécessite les variables SMTP sur le serveur
        (Vercel → Environment Variables).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void runCheck()}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
        >
          Vérifier la config
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void sendTest()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Envoyer un e-mail test
        </button>
      </div>

      {diag ? (
        <div className="mt-4 space-y-2 text-sm">
          {diag.issues.length > 0 ? (
            <ul className="list-inside list-disc text-amber-200/95">
              {diag.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="text-emerald-400/95">Variables SMTP présentes.</p>
          )}
          {diag.verify ? (
            diag.verify.ok ? (
              <p className="text-emerald-400/95">Connexion SMTP OK.</p>
            ) : (
              <p className="text-red-300/95">Connexion : {diag.verify.error}</p>
            )
          ) : null}
        </div>
      ) : null}

      {msg ? (
        <p className="mt-3 text-sm text-emerald-300/95">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-3 text-sm text-red-300/95" role="alert">
          {err}
        </p>
      ) : null}

      <details className="mt-4 text-xs text-zinc-500">
        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">
          Gmail — valeurs recommandées
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[0.7rem] leading-relaxed text-zinc-400">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ton-compte@gmail.com
SMTP_PASS=mot_de_passe_application_16_caracteres
SMTP_FROM=ton-compte@gmail.com
NEXT_PUBLIC_SITE_URL=https://bloxking.vercel.app`}
        </pre>
      </details>
    </section>
  );
}
