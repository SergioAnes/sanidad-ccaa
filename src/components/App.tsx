"use client";

import { useEffect } from "react";
import type { DatosApp } from "@/lib/app/datos-app";
import { ESQUELETO } from "@/lib/app/esqueleto";
import { iniciar } from "@/lib/app/ui";

/** Página única: Portada, Explorador y Tu comunidad, navegables por #hash. */
export function App({ datos }: { datos: DatosApp }) {
  useEffect(() => {
    iniciar(datos);
  }, [datos]);
  return <div dangerouslySetInnerHTML={{ __html: ESQUELETO }} />;
}
