import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const cuerpo = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body", display: "swap" });
const titulos = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-display", display: "swap" });

export const metadata: Metadata = {
  title: "Sanidad por comunidades",
  description: "Gasto sanitario público y listas de espera de las 17 comunidades autónomas, con datos oficiales del Ministerio de Sanidad.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${cuerpo.variable} ${titulos.variable}`}>
      <body>{children}</body>
    </html>
  );
}
