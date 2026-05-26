import Link from "next/link";
import { InscriptionForm } from "@/components/auth/inscription-form";
import { BackLink } from "@/components/back-link";
import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";

export default function InscriptionPage() {
  return (
    <PageShell center ads={false}>
      <div className="mx-auto w-full max-w-md">
        <BackLink />
        <h1 className="mt-8 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
          INSCRIPTION
        </h1>
        <p className="mt-4 text-zinc-400">
          Compte géré par{" "}
          <span className="text-zinc-300">Supabase</span> (e-mail + mot de passe).
          Ton pseudo Roblox sera affiché sur ton profil.
        </p>
        <p className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-sm leading-relaxed text-zinc-300">
          <span className="font-medium text-amber-400/95">Tu as déjà un compte ?</span>{" "}
          Utilise la page de connexion — pas besoin de t’inscrire à nouveau.
        </p>
        <ContentCard className="mt-8">
          <InscriptionForm />
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="mt-6 text-center text-sm text-zinc-400">
            <span className="text-zinc-500">Compte existant ?</span>{" "}
            <Link
              href="/connexion"
              className="font-semibold text-amber-500 hover:text-amber-400 underline-offset-2 hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </ContentCard>
      </div>
    </PageShell>
  );
}
