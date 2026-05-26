"use client";

import Script from "next/script";
import { adsenseClientId } from "@/lib/ads/config";

export function AdSenseScript() {
  const clientId = adsenseClientId();
  if (!clientId) return null;

  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
