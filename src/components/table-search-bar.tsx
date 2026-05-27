"use client";

import { useEffect, useState } from "react";
import { normalizeSearchQuery } from "@/lib/table-search";

type TableSearchBarProps = {
  /** Élément parent contenant des enfants `[data-search]`. */
  targetId: string;
  totalCount: number;
  placeholder?: string;
  className?: string;
};

export function TableSearchBar({
  targetId,
  totalCount,
  placeholder = "Rechercher…",
  className = "",
}: TableSearchBarProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(totalCount);

  useEffect(() => {
    setVisibleCount(totalCount);
  }, [totalCount]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;

    const needle = normalizeSearchQuery(query);
    const items = root.querySelectorAll<HTMLElement>("[data-search]");
    let visible = 0;

    items.forEach((el) => {
      const haystack = (el.getAttribute("data-search") ?? "").toLowerCase();
      const show = !needle || haystack.includes(needle);
      el.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });

    setVisibleCount(visible);
  }, [query, targetId, totalCount]);

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <label className="relative block min-w-0 flex-1 sm:max-w-md">
        <span className="sr-only">{placeholder}</span>
        <svg
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/12 bg-zinc-950/80 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label="Effacer la recherche"
          >
            ×
          </button>
        ) : null}
      </label>
      <p className="shrink-0 font-mono text-xs text-zinc-500">
        {query.trim() ? (
          <>
            <span className="text-zinc-300">{visibleCount}</span> / {totalCount}{" "}
            résultat{visibleCount !== 1 ? "s" : ""}
          </>
        ) : (
          <>{totalCount} entrée{totalCount !== 1 ? "s" : ""}</>
        )}
      </p>
    </div>
  );
}
