import type { OngoingMatchRow } from "@/app/play/actions";

export type OngoingMatchCardState = {
  /** Libellé court pour le badge */
  badge: string;
  badgeClass: string;
  /** Détail sous le titre vs adversaire */
  detail: string;
};

/**
 * État affiché sur la liste « rencontres en cours » (cohérent avec la salle BO3).
 */
export function deriveOngoingMatchCardState(
  m: OngoingMatchRow,
): OngoingMatchCardState {
  const litige = Boolean(m.dispute) || m.status === "disputed";
  if (litige) {
    return {
      badge: "Litige",
      badgeClass: "border-red-500/45 bg-red-950/45 text-red-100",
      detail: "Résolution ou nouvelle déclaration nécessaire",
    };
  }

  const sa = Boolean(m.match_started_a);
  const sb = Boolean(m.match_started_b);
  if (!sa || !sb) {
    return {
      badge: "Début en attente",
      badgeClass: "border-amber-500/45 bg-amber-500/12 text-amber-100",
      detail: "Les deux joueurs doivent confirmer le début en jeu (étape 1)",
    };
  }

  const aa = m.claim_from_a_maps_a;
  const ab = m.claim_from_a_maps_b;
  const ba = m.claim_from_b_maps_a;
  const bb = m.claim_from_b_maps_b;

  const aSent = aa != null && ab != null;
  const bSent = ba != null && bb != null;

  if (!aSent && !bSent) {
    return {
      badge: "Score à déclarer",
      badgeClass: "border-amber-500/45 bg-amber-500/12 text-amber-100",
      detail: "Aucune déclaration BO3 pour l’instant (étape 2)",
    };
  }

  if (aSent !== bSent) {
    return {
      badge: "En attente déclaration",
      badgeClass: "border-sky-500/40 bg-sky-950/30 text-sky-100",
      detail: "Un seul joueur a déclaré — l’autre doit envoyer le même résultat",
    };
  }

  if (aSent && bSent && (aa !== ba || ab !== bb)) {
    return {
      badge: "Scores en désaccord",
      badgeClass: "border-orange-500/45 bg-orange-950/35 text-orange-100",
      detail: "Les déclarations ne correspondent pas — alignez-vous ou litige",
    };
  }

  if (aSent && bSent && aa === ba && ab === bb) {
    return {
      badge: "Clôture en attente",
      badgeClass: "border-emerald-500/45 bg-emerald-950/40 text-emerald-100",
      detail: `Score validé ${aa} — ${ab} · un joueur doit terminer le match (étape 3)`,
    };
  }

  return {
    badge: "En cours",
    badgeClass: "border-zinc-600 bg-zinc-900 text-zinc-300",
    detail: "Match en cours",
  };
}
