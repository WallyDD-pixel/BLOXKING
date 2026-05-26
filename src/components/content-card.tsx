import type { ReactNode } from "react";

type ContentCardProps = {
  children: ReactNode;
  className?: string;
};

export function ContentCard({ children, className = "" }: ContentCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-8 shadow-2xl shadow-black/40 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
