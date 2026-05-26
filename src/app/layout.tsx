import type { Metadata } from "next";
import { Bebas_Neue, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "BloXKING — Ladder 1v1 & finale 10 000 Robux",
  description:
    "Duels PvP 1v1 classés : top 10 du site qualifié pour la finale. Le vainqueur remporte 10 000 Robux. Projet communautaire Blox Fruits.",
  other: {
    "google-adsense-account": "ca-pub-5565187112201930",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${bebas.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
