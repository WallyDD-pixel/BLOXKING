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

export function smtpFromAddress(): string {
  return env("DISPUTE_EMAIL_FROM") || env("SMTP_FROM");
}

export function getSmtpConfigIssues(): string[] {
  const issues: string[] = [];
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = smtpFromAddress();

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

  if (!from) {
    issues.push("SMTP_FROM ou DISPUTE_EMAIL_FROM manquant.");
  } else if (user && from.toLowerCase() !== user.toLowerCase()) {
    issues.push(
      "SMTP_FROM doit être identique à SMTP_USER pour Gmail (ex. ton adresse @gmail.com).",
    );
  }

  return issues;
}

export function getSmtpConfig(): SmtpConfig | null {
  if (getSmtpConfigIssues().length > 0) return null;

  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT"));
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
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
