import Link from "next/link";
import { ConnexionForm } from "@/components/auth/connexion-form";
import { BackLink } from "@/components/back-link";
import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function ConnexionPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackError = params.error === "auth";
  const next = params.next;

  return (
    <PageShell center>
      <div className="mx-auto w-full max-w-md">
        <BackLink />
        <h1 className="mt-8 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
          CONNEXION
        </h1>
        <p className="mt-4 text-zinc-400">
          Connexion avec le même compte que sur la page d&apos;inscription
          (Supabase Auth). Si tu as déjà créé un compte, ne refais pas une
          inscription : connecte-toi ici.
        </p>
        <ContentCard className="mt-8">
          <ConnexionForm callbackError={callbackError} redirectTo={next} />
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="mt-6 text-center text-xs text-zinc-600">
            Pas encore de compte ?{" "}
            <Link
              href="/inscription"
              className="font-medium text-amber-500/90 hover:text-amber-400"
            >
              S&apos;inscrire
            </Link>
          </p>
        </ContentCard>
      </div>
    </PageShell>
  );
}
