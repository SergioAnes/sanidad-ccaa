import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanidad por comunidades",
  description: "Comparador abierto de datos sanitarios públicos entre comunidades autónomas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
