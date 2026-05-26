"use client";

import { useEffect } from "react";

/** Si l’URL contient #rencontres-en-cours, fait défiler vers la liste. */
export function RechercheHashScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#rencontres-en-cours") return;
    const el = document.getElementById("rencontres-en-cours");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return null;
}
