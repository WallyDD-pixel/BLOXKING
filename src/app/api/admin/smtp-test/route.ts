import { NextResponse } from "next/server";
import { userIsAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getSmtpDiagnostics,
  sendSmtpTestEmail,
  verifySmtpConnection,
} from "@/lib/notifications/email-send";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await userIsAdmin(user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const diag = getSmtpDiagnostics();
  const verify = diag.configured ? await verifySmtpConnection() : null;

  return NextResponse.json({
    configured: diag.configured,
    issues: diag.issues,
    warnings: diag.warnings,
    effectiveFrom: diag.effectiveFrom,
    verify: verify
      ? verify.ok
        ? { ok: true }
        : { ok: false, error: verify.error }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !(await userIsAdmin(user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let to = user.email;
  try {
    const body = (await req.json()) as { to?: string };
    if (body.to?.trim()) to = body.to.trim();
  } catch {
    /* corps vide → email admin */
  }

  const result = await sendSmtpTestEmail(to);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, skipped: result.skipped ?? false },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, to });
}
