/** Lecture et validation des variables SMTP (serveur uniquement). */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export type SmtpConfigDiagnostics = {
  issues: string[];
  warnings: string[];
  effectiveFrom: string;
  user: string;
  disputeFrom: string;
  smtpFrom: string;
};

function env(key: string): string {
  const raw = process.env[key];
  if (!raw) return "";
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Extrait l’adresse e-mail d’un champ From (`nom <a@b.c>` ou `a@b.c`). */
export function parseEmailAddress(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const angle = s.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : s).trim();
  return addr.toLowerCase();
}

function isGmailHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes("gmail") || h.includes("googlemail");
}

/** Google affiche les mots de passe d’app par groupes de 4 — SMTP exige 16 caractères sans espaces. */
function normalizeSmtpPass(pass: string, host: string): string {
  if (!pass) return pass;
  if (isGmailHost(host)) return pass.replace(/\s+/g, "");
  return pass;
}

/**
 * Adresse expéditeur réellement utilisée.
 * Gmail impose que From = compte authentifié (SMTP_USER).
 */
export function smtpFromAddress(): string {
  const user = env("SMTP_USER");
  const host = env("SMTP_HOST");
  const displayName = env("SMTP_FROM_NAME");

  if (user && isGmailHost(host)) {
    return displayName ? `${displayName} <${user}>` : user;
  }

  return env("DISPUTE_EMAIL_FROM") || env("SMTP_FROM") || user;
}

export function getSmtpConfigDiagnostics(): SmtpConfigDiagnostics {
  const issues: string[] = [];
  const warnings: string[] = [];
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = normalizeSmtpPass(env("SMTP_PASS"), host);
  const smtpFrom = env("SMTP_FROM");
  const disputeFrom = env("DISPUTE_EMAIL_FROM");
  const effectiveFrom = smtpFromAddress();
  const fromEmail = parseEmailAddress(effectiveFrom);
  const userEmail = parseEmailAddress(user);

  if (!host) issues.push("SMTP_HOST manquant.");
  else if (!host.includes(".") && host.toLowerCase() !== "localhost") {
    issues.push(
      `SMTP_HOST="${host}" ne ressemble pas à un serveur (ex. smtp.gmail.com).`,
    );
  }

  if (!portRaw) issues.push("SMTP_PORT manquant (ex. 587 pour Gmail).");
  else {
    const port = Number(portRaw);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      issues.push(`SMTP_PORT invalide : "${portRaw}".`);
    }
  }

  if (!user) issues.push("SMTP_USER manquant.");
  if (!pass) issues.push("SMTP_PASS manquant (mot de passe d'application Gmail).");

  if (!fromEmail) {
    issues.push("SMTP_FROM ou SMTP_USER manquant (adresse expéditeur).");
  }

  if (user && isGmailHost(host)) {
    if (disputeFrom && parseEmailAddress(disputeFrom) !== userEmail) {
      warnings.push(
        `DISPUTE_EMAIL_FROM="${disputeFrom}" ne peut pas être utilisé avec Gmail : l'expéditeur sera SMTP_USER (${user}). Supprime DISPUTE_EMAIL_FROM ou mets la même adresse.`,
      );
    }
    if (smtpFrom && parseEmailAddress(smtpFrom) !== userEmail) {
      warnings.push(
        `SMTP_FROM="${smtpFrom}" est ignoré pour Gmail : l'expéditeur sera SMTP_USER (${user}).`,
      );
    }
  } else if (user && fromEmail && fromEmail !== userEmail) {
    issues.push(
      `L'expéditeur (${effectiveFrom}) doit correspondre à SMTP_USER (${user}) pour ce fournisseur.`,
    );
  }

  return {
    issues,
    warnings,
    effectiveFrom,
    user,
    disputeFrom,
    smtpFrom,
  };
}

export function getSmtpConfigIssues(): string[] {
  return getSmtpConfigDiagnostics().issues;
}

export function getSmtpConfig(): SmtpConfig | null {
  if (getSmtpConfigIssues().length > 0) return null;

  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT"));
  const user = env("SMTP_USER");
  const pass = normalizeSmtpPass(env("SMTP_PASS"), host);
  const from = smtpFromAddress();
  const secureFlag = env("SMTP_SECURE").toLowerCase();

  const secure = secureFlag === "true" || port === 465;
  const requireTls =
    env("SMTP_REQUIRE_TLS").toLowerCase() === "true" ||
    (!secure && port === 587);

  return {
    host,
    port,
    secure,
    requireTls,
    user: user || undefined,
    pass: pass || undefined,
    from,
  };
}
