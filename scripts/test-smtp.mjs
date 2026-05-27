/**
 * Test SMTP local : node --env-file=.env.local scripts/test-smtp.mjs
 */
import nodemailer from "nodemailer";

function env(key) {
  let s = (process.env[key] ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const host = env("SMTP_HOST");
const port = Number(env("SMTP_PORT"));
const user = env("SMTP_USER");
let pass = env("SMTP_PASS");
if (/gmail|googlemail/i.test(host)) pass = pass.replace(/\s+/g, "");
const from = env("DISPUTE_EMAIL_FROM") || env("SMTP_FROM") || user;
const to = process.argv[2] || user;

if (!host || !port || !user || !pass || !from) {
  console.error("Variables SMTP manquantes dans .env.local");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: env("SMTP_SECURE").toLowerCase() === "true" || port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("Connexion SMTP OK");
  const info = await transport.sendMail({
    from,
    to,
    subject: "BloXKING test SMTP",
    text: "Test réussi.",
  });
  console.log("Envoyé:", info.messageId, "→", to);
} catch (e) {
  console.error("Échec:", e.message || e);
  process.exit(1);
} finally {
  transport.close();
}
