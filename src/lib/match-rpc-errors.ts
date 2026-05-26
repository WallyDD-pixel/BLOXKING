/** Messages utilisateur pour les codes d’erreur renvoyés par les RPC match ranked. */
export function mapMatchRpcError(code: string): string {
  const map: Record<string, string> = {
    invalid_bo3_score: "Score BO3 invalide (ex. 2-0, 2-1, 1-2, 0-2).",
    match_already_finished: "Ce match est déjà clôturé.",
    opponent_claim_missing: "L’adversaire n’a pas encore déclaré de score.",
    dispute_open: "Litige ouvert — résous-le avant de continuer.",
    claims_incomplete: "Les deux joueurs doivent avoir déclaré un score.",
    claims_differ: "Les scores ne correspondent pas.",
    claims_consensus_locked:
      "Les deux déclarations concordent — le score ne peut plus être modifié ici.",
    acceptances_incomplete: "Chacun doit valider la déclaration de l’autre.",
    match_not_started_by_both: "Les deux joueurs doivent confirmer le début.",
    no_active_dispute_or_forbidden: "Aucun litige actif à réinitialiser.",
    not_found_or_forbidden: "Action impossible (match introuvable ou déjà clôturé).",
    active_match_in_progress:
      "Tu as déjà un match en cours. Termine-le ou résous le litige avant d’en lancer un autre.",
    challenger_has_active_match:
      "Le créateur du défi a déjà un match actif — défi indisponible pour l’instant.",
    ticket_body_too_short:
      "Décris la situation en au moins 10 caractères (pour le ticket modération).",
    ticket_body_too_long: "Message trop long (max. 2000 caractères).",
    invalid_attachment_paths:
      "Pièces jointes invalides ou chemins non autorisés — réessaie avec de nouvelles images.",
    chat_body_too_short: "Écris au moins un caractère pour envoyer un message.",
    chat_body_too_long: "Message trop long (max. 2000 caractères).",
    dispute_chat_forbidden:
      "Le chat n’est plus disponible (match clôturé ou annulé).",
    rate_limited:
      "Trop d’appels à la recherche matchmaking. Attends une minute et réessaie.",
    queue_cooldown:
      "Patiente quelques secondes après la fin de ton dernier match avant de relancer la recherche.",
  };
  return map[code] ?? code;
}
