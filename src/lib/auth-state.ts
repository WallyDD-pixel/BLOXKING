export type AuthActionState = {
  error: string | null;
  success: string | null;
  /** Inscription : e-mail déjà utilisé → proposer la connexion */
  hint?: "use_login";
};

export const authInitialState: AuthActionState = {
  error: null,
  success: null,
};
