import {
  MATCH_START_DEADLINE_MS,
  formatCountdownMs,
  matchAbandonDeadlineMs,
  matchStartDeadlineMs,
} from "@/lib/match/match-start-deadline";

const START_DEADLINE_MINUTES = MATCH_START_DEADLINE_MS / 60_000;

export type AdminMatchProgressInput = {
  status: string;
  dispute?: boolean;
  match_started_a?: boolean;
  match_started_b?: boolean;
  claim_from_a_maps_a: number | null;
  claim_from_a_maps_b: number | null;
  claim_from_b_maps_a: number | null;
  claim_from_b_maps_b: number | null;
  cancel_reason?: string | null;
  created_at?: string;
  player_a_label?: string | null;
  player_b_label?: string | null;
};

export type AdminMatchProgressStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  detail: string;
};

export type AdminMatchProgress = {
  phaseLabel: string;
  phaseClass: string;
  summary: string;
  steps: AdminMatchProgressStep[];
  playerA: { label: string; started: boolean; claim: string | null };
  playerB: { label: string; started: boolean; claim: string | null };
  startDeadlineNote: string | null;
};

function claimLine(mapsA: number | null, mapsB: number | null): string | null {
  if (mapsA == null || mapsB == null) return null;
  return `${mapsA}-${mapsB}`;
}

function claimsConsensus(m: AdminMatchProgressInput): boolean {
  const { claim_from_a_maps_a: aa, claim_from_a_maps_b: ab, claim_from_b_maps_a: ba, claim_from_b_maps_b: bb } = m;
  if (aa == null || ab == null || ba == null || bb == null) return false;
  return aa === ba && ab === bb;
}

export function deriveAdminMatchProgress(
  m: AdminMatchProgressInput,
  nowMs = Date.now(),
): AdminMatchProgress {
  const litige = Boolean(m.dispute) || m.status === "disputed";
  const startedA = Boolean(m.match_started_a);
  const startedB = Boolean(m.match_started_b);
  const bothStarted = startedA && startedB;
  const labelA = m.player_a_label?.trim() || "Joueur A";
  const labelB = m.player_b_label?.trim() || "Joueur B";
  const claimA = claimLine(m.claim_from_a_maps_a, m.claim_from_a_maps_b);
  const claimB = claimLine(m.claim_from_b_maps_a, m.claim_from_b_maps_b);
  const aClaimed = claimA != null;
  const bClaimed = claimB != null;
  const consensus = claimsConsensus(m);

  let startDeadlineNote: string | null = null;
  if (m.status === "pending" && !litige && m.created_at) {
    const abandonLeft = matchAbandonDeadlineMs(m.created_at) - nowMs;
    const parts: string[] = [];
    if (!bothStarted) {
      const startLeft = matchStartDeadlineMs(m.created_at) - nowMs;
      if (startLeft > 0) {
        parts.push(`Début : ${formatCountdownMs(startLeft)}`);
      } else {
        parts.push("Début : délai dépassé");
      }
    }
    if (abandonLeft > 0) {
      parts.push(`Abandon auto : ${formatCountdownMs(abandonLeft)} (25 min)`);
    } else {
      parts.push("Abandon auto imminent");
    }
    if (parts.length > 0) startDeadlineNote = parts.join(" · ");
  }

  const stepStart: AdminMatchProgressStep = {
    key: "start",
    label: "Début confirmé en jeu",
    done: bothStarted,
    active: m.status === "pending" && !litige && !bothStarted,
    detail: bothStarted
      ? "Les deux joueurs ont confirmé"
      : `${labelA} : ${startedA ? "oui" : "non"} · ${labelB} : ${startedB ? "oui" : "non"}`,
  };

  const stepClaims: AdminMatchProgressStep = {
    key: "claims",
    label: "Déclarations BO3",
    done: aClaimed && bClaimed,
    active: m.status === "pending" && !litige && bothStarted && !(aClaimed && bClaimed),
    detail:
      !aClaimed && !bClaimed
        ? "Aucune déclaration"
        : !aClaimed || !bClaimed
          ? `En attente : ${!aClaimed ? labelA : labelB}`
          : consensus
            ? `Accord ${claimA}`
            : `${labelA} ${claimA} · ${labelB} ${claimB} (conflit)`,
  };

  const stepClose: AdminMatchProgressStep = {
    key: "close",
    label: "Clôture ranked",
    done: m.status === "confirmed",
    active: m.status === "pending" && !litige && consensus,
    detail:
      m.status === "confirmed"
        ? "Match terminé, ELO appliqué"
        : consensus
          ? "Scores identiques — un joueur peut clôturer"
          : "En attente d’un accord sur le score",
  };

  const steps = [stepStart, stepClaims, stepClose];

  if (m.status === "confirmed") {
    return {
      phaseLabel: "Terminé",
      phaseClass: "bg-emerald-500/15 text-emerald-300",
      summary: claimA ? `Score final ${claimA}` : "Match clôturé",
      steps: steps.map((s) => ({ ...s, done: true, active: false })),
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote: null,
    };
  }

  if (m.status === "cancelled") {
    const reason =
      m.cancel_reason === "start_timeout"
        ? `Annulé — délai de ${START_DEADLINE_MINUTES} min sans confirmation du début`
        : m.cancel_reason === "abandoned"
          ? "Annulé — match abandonné (plus de 25 min sans litige ni clôture)"
          : m.cancel_reason === "dispute_timeout"
            ? "Annulé — litige non résolu (30 min)"
            : "Match annulé";
    return {
      phaseLabel: "Annulé",
      phaseClass: "bg-zinc-500/15 text-zinc-400",
      summary: reason,
      steps: steps.map((s) => ({ ...s, active: false })),
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote: null,
    };
  }

  if (litige) {
    return {
      phaseLabel: "Litige",
      phaseClass: "bg-amber-500/15 text-amber-200",
      summary: consensus
        ? "Litige ouvert malgré scores concordants"
        : "Litige — scores divergents ou ticket modération",
      steps: steps.map((s) =>
        s.key === "close" ? { ...s, active: true, detail: "Bloqué par litige" } : s,
      ),
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote,
    };
  }

  if (!bothStarted) {
    return {
      phaseLabel: "En attente du début",
      phaseClass: "bg-amber-500/15 text-amber-200",
      summary: stepStart.detail,
      steps,
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote,
    };
  }

  if (!aClaimed || !bClaimed) {
    return {
      phaseLabel: "Scores à déclarer",
      phaseClass: "bg-sky-500/15 text-sky-200",
      summary: stepClaims.detail,
      steps,
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote: null,
    };
  }

  if (!consensus) {
    return {
      phaseLabel: "Scores en conflit",
      phaseClass: "bg-orange-500/15 text-orange-200",
      summary: stepClaims.detail,
      steps,
      playerA: { label: labelA, started: startedA, claim: claimA },
      playerB: { label: labelB, started: startedB, claim: claimB },
      startDeadlineNote: null,
    };
  }

  return {
    phaseLabel: "Prêt à clôturer",
    phaseClass: "bg-emerald-500/15 text-emerald-300",
    summary: `Accord ${claimA} — en attente de clôture joueur`,
    steps,
    playerA: { label: labelA, started: startedA, claim: claimA },
    playerB: { label: labelB, started: startedB, claim: claimB },
    startDeadlineNote: null,
  };
}

/** Durée max avant annulation auto si début non confirmé (pour affichage admin). */
export const ADMIN_START_DEADLINE_LABEL = `${MATCH_START_DEADLINE_MS / 60_000} min`;
