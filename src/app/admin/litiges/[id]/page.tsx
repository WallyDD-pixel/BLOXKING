import Link from "next/link";
import { notFound } from "next/navigation";
import { expireStaleMatchesIfNeeded } from "@/lib/match/expire-stale-matches";
import { AdminDisputeActions } from "@/components/admin/admin-dispute-actions";
import { AdminDisputeDecisionHistory } from "@/components/admin/admin-dispute-decision-history";
import { AdminDisputeModeration } from "@/components/admin/admin-dispute-moderation";
import {
  getAdminMatchDetail,
  listAdminChat,
  listAdminCancellationRequests,
  listAdminDisputeDecisions,
  listAdminTickets,
} from "@/lib/admin/queries";
import { labelFromAdminUser } from "@/lib/admin/user-label";
import {
  formatScore,
  matchStatusClass,
  matchStatusLabel,
} from "@/lib/admin/display";
import { deriveAdminMatchProgress } from "@/lib/admin/match-progress";
import { AdminMatchProgressPanel } from "@/components/admin/admin-match-progress";
import { disputeEvidencePublicUrl } from "@/lib/storage/dispute-evidence-url";
import { DisputeEvidencePreview } from "@/components/match/dispute-evidence-preview";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminDisputeChatComposer } from "@/components/admin/admin-dispute-chat-composer";
import {
  AdminMatchModerationChat,
  AdminMatchPlayerChat,
} from "@/components/admin/admin-match-chat-transcript";
import { formatDateTimeFr } from "@/lib/format-datetime";
import { getPlayerModerationStatus } from "@/lib/moderation/player-status";

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await expireStaleMatchesIfNeeded();
  const match = await getAdminMatchDetail(id);
  if (!match) notFound();

  const [tickets, chat, cancellationRequests, decisions, modA, modB] =
    await Promise.all([
      listAdminTickets(id),
      listAdminChat(id),
      listAdminCancellationRequests(id),
      listAdminDisputeDecisions(id),
      getPlayerModerationStatus(match.player_a),
      getPlayerModerationStatus(match.player_b),
    ]);

  const openCancellationRequests = cancellationRequests.filter(
    (r) => r.status === "open",
  );

  const playerAName = labelFromAdminUser(
    {
      email: match.player_a_email,
      roblox_username: match.player_a_roblox_username,
      display_name: match.player_a_display_name,
    },
    match.player_a_label,
  );
  const playerBName = labelFromAdminUser(
    {
      email: match.player_b_email,
      roblox_username: match.player_b_roblox_username,
      display_name: match.player_b_display_name,
    },
    match.player_b_label,
  );
  const isClosed =
    match.status === "confirmed" || match.status === "cancelled";
  const viewer = await getCurrentUser();
  const viewerIsParticipant =
    viewer?.id === match.player_a || viewer?.id === match.player_b;
  const progress = deriveAdminMatchProgress(match);

  return (
    <div className="space-y-6">
      <Link href="/admin/litiges" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Litiges
      </Link>

      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-zinc-100">
              {playerAName}{" "}
              <span className="text-zinc-500">vs</span> {playerBName}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {match.player_a_email} · {match.player_b_email}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${matchStatusClass(match.status, match.dispute)}`}
          >
            {matchStatusLabel(match.status, match.dispute)}
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Score déclaré</dt>
            <dd className="font-mono text-zinc-200">
              {formatScore(
                match.claim_from_a_maps_a,
                match.claim_from_a_maps_b,
                match.claim_from_b_maps_a,
                match.claim_from_b_maps_b,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Source</dt>
            <dd className="text-zinc-200">
              {match.source === "queue" ? "Matchmaking" : "Défi"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Créé le</dt>
            <dd className="text-zinc-200">
              {formatDateTimeFr(match.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">ID match</dt>
            <dd className="font-mono text-xs text-zinc-400">{match.id}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <AdminMatchProgressPanel progress={progress} />
        </div>
        <div className="mt-3">
          {viewerIsParticipant ? (
            <Link
              href={`/play/match/${match.id}`}
              className="text-sm text-amber-400 hover:text-amber-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir la salle joueur ↗
            </Link>
          ) : (
            <p className="text-sm text-zinc-500">
              La salle joueur <span className="text-zinc-400">/play/match</span>{" "}
              est accessible uniquement aux 2 participants (anti-bypass). Utilise
              ce panneau admin pour modérer le litige.
            </p>
          )}
        </div>
      </div>

      <AdminDisputeActions
        matchId={match.id}
        status={match.status}
        playerALabel={playerAName}
        playerBLabel={playerBName}
        openCancellationCount={openCancellationRequests.length}
        isClosed={isClosed}
        initialMapsA={
          match.claim_from_a_maps_a != null
            ? String(match.claim_from_a_maps_a)
            : "2"
        }
        initialMapsB={
          match.claim_from_a_maps_b != null
            ? String(match.claim_from_a_maps_b)
            : "0"
        }
      />

      <AdminDisputeDecisionHistory decisions={decisions} />

      {modA && modB ? (
        <AdminDisputeModeration
          matchId={match.id}
          playerA={modA}
          playerB={modB}
        />
      ) : null}

      {openCancellationRequests.length > 0 ? (
        <section className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-5">
          <h2 className="text-lg font-semibold text-amber-100">
            Demandes d&apos;annulation ({openCancellationRequests.length})
          </h2>
          <p className="mt-1 text-sm text-amber-200/70">
            Les joueurs demandent l&apos;annulation de ce match. Utilise « Annuler
            le match » ci-dessus pour valider (raison enregistrée : demande joueur).
          </p>
          <ul className="mt-4 space-y-4">
            {openCancellationRequests.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-black/25 p-4"
              >
                <p className="text-xs text-zinc-500">
                  {r.requester_label ?? r.requester_email} ·{" "}
                  {formatDateTimeFr(r.created_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                  {r.reason}
                </p>
                {r.attachment_paths.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {r.attachment_paths.map((p) => {
                      const url = disputeEvidencePublicUrl(p);
                      return (
                        <a
                          key={p}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          aria-label="Ouvrir la preuve"
                        >
                          <DisputeEvidencePreview url={url} objectPath={p} />
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : cancellationRequests.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-100">
            Demandes d&apos;annulation (traitées)
          </h2>
          <ul className="mt-3 space-y-3">
            {cancellationRequests.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4 opacity-70"
              >
                <p className="text-xs text-zinc-500">
                  {r.requester_label ?? r.requester_email} ·{" "}
                  {formatDateTimeFr(r.created_at)} · {r.status}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
                  {r.reason}
                </p>
                {r.attachment_paths.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {r.attachment_paths.map((p) => {
                      const url = disputeEvidencePublicUrl(p);
                      return (
                        <a
                          key={p}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          aria-label="Ouvrir la preuve"
                        >
                          <DisputeEvidencePreview url={url} objectPath={p} />
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AdminMatchPlayerChat messages={chat} match={match} />

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Tickets litige</h2>
        {tickets.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Aucun ticket.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs text-zinc-500">
                  {labelFromAdminUser({
                    email: t.opener_email,
                    roblox_username: t.opener_roblox_username,
                    display_name: t.opener_display_name,
                  })}{" "}
                  · {formatDateTimeFr(t.created_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                  {t.body}
                </p>
                {t.attachment_paths.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {t.attachment_paths.map((p) => {
                      const url = disputeEvidencePublicUrl(p);
                      return (
                        <a
                          key={p}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          aria-label="Ouvrir la preuve"
                        >
                          <DisputeEvidencePreview url={url} objectPath={p} />
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminMatchModerationChat messages={chat} match={match}>
        <div className="mt-3">
          <AdminDisputeChatComposer matchId={match.id} />
        </div>
      </AdminMatchModerationChat>
    </div>
  );
}
