import ccaaJson from "@/data/ccaa.json";
import indicadoresJson from "@/data/indicadores.json";
import valoresJson from "@/data/valores.json";
import type { Ccaa, Indicador, Unidad, Valor } from "@/types/datos";
import { euros, numero, porcentaje } from "@/lib/formatos";

export const CCAA = ccaaJson as Ccaa[];
export const INDICADORES = indicadoresJson as Indicador[];
export const VALORES = valoresJson as Valor[];

export function nombreCcaa(id: string): string {
  return CCAA.find((c) => c.id === id)?.nombre ?? id;
}

export function aniosDisponibles(indicador: string, valores: Valor[] = VALORES): number[] {
  return [...new Set(valores.filter((v) => v.indicador === indicador).map((v) => v.anio))].sort((a, b) => a - b);
}

/** true si algún valor del indicador en ese año está marcado como provisional por la fuente. */
export function esProvisional(indicador: string, anio: number, valores: Valor[] = VALORES): boolean {
  return valores.some((v) => v.indicador === indicador && v.anio === anio && v.provisional);
}

export type FilaRanking = { ccaa: string; nombre: string; valor: number; posicion: number };

/** Ranking de CCAA para un indicador y año, de mayor a menor. */
export function ranking(indicador: string, anio: number, valores: Valor[] = VALORES): FilaRanking[] {
  return valores
    .filter((v) => v.indicador === indicador && v.anio === anio)
    .sort((a, b) => b.valor - a.valor)
    .map((v, i) => ({ ccaa: v.ccaa, nombre: nombreCcaa(v.ccaa), valor: v.valor, posicion: i + 1 }));
}

/** Media simple entre CCAA (no ponderada por población). */
export function mediaSimple(filas: { valor: number }[]): number {
  if (filas.length === 0) return NaN;
  return filas.reduce((s, f) => s + f.valor, 0) / filas.length;
}

/** Serie temporal de una CCAA para un indicador. */
export function serie(indicador: string, ccaa: string, valores: Valor[] = VALORES): { anio: number; valor: number }[] {
  return valores
    .filter((v) => v.indicador === indicador && v.ccaa === ccaa)
    .sort((a, b) => a.anio - b.anio)
    .map(({ anio, valor }) => ({ anio, valor }));
}

export function variacionPct(desde: number, hasta: number): number {
  return ((hasta - desde) / desde) * 100;
}

export function formatear(valor: number | undefined, unidad: Unidad): string {
  if (valor === undefined || !Number.isFinite(valor)) return "—";
  switch (unidad) {
    case "eur_hab":
      return euros(valor);
    case "pct":
      return porcentaje(valor);
    case "eur_mill":
      return `${numero(valor, 1)} M€`;
    case "num":
      return numero(valor, 0);
    case "por_mil":
      return `${numero(valor, 2)} ‰`;
    case "dias":
      return `${numero(valor, 0)} días`;
    case "nota10":
      return numero(valor, 2);
    case "dias_media":
      return `${numero(valor, 1)} días`;
    case "personas":
      return numero(valor, 0);
  }
}
