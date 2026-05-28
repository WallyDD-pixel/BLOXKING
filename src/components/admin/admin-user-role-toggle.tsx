"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminSetDisputeModerator } from "@/app/admin/actions";

type Props = {
  userId: string;
  userLabel: string;
  isDisputeModerator: boolean;
};

export function AdminUserRoleToggle({
  userId,
  userLabel,
  isDisputeModerator,
}: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(isDisputeModerator);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await adminSetDisputeModerator(userId, next);
      if (res.error) {
        setError(res.error);
        return;
      }
      setChecked(next);
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/40"
          aria-label={`Modérateur litiges pour ${userLabel}`}
        />
        <span>Mod. litiges</span>
      </label>
      {error ? (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
