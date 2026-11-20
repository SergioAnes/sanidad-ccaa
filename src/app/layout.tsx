import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const cuerpo = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body", display: "swap" });
const titulos = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-display", display: "swap" });

const descripcion = "Gasto sanitario público y listas de espera de las 17 comunidades autónomas, con datos oficiales del Ministerio de Sanidad.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sanidad-ccaa.vercel.app"),
  title: "Sanidad por comunidades",
  description: descripcion,
  // Vista previa al compartir el enlace (WhatsApp, redes sociales). Imagen: public/og.png (1200x630).
  openGraph: {
    title: "¿Cuánto gasta tu comunidad en sanidad y cuánto se espera?",
    description: descripcion,
    url: "/",
    siteName: "Sanidad por comunidades",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Mapa de España con el gasto sanitario público por habitante de cada comunidad" }],
  },
  twitter: { card: "summary_large_image", title: "¿Cuánto gasta tu comunidad en sanidad y cuánto se espera?", description: descripcion, images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${cuerpo.variable} ${titulos.variable}`}>
      <body>
        {children}
        {/* Recuento anónimo de visitas, sin cookies. Hay que activarlo en Vercel: proyecto > Analytics > Enable. */}
        <Analytics />
      </body>
    </html>
  );
}
