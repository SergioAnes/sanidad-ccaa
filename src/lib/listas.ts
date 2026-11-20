import listasJson from "@/data/listas-espera.json";
import { CCAA, mediaSimple } from "@/lib/datos";
import type { Ccaa, Unidad } from "@/types/datos";

export type TipoLista = "quirurgica" | "procesos" | "consultas";
export type MedidaLista = "pacientes" | "tasa" | "dias" | "pct_largo";

export type ValorLista = {
  corte: string; // "2025-12"
  tipo: TipoLista;
  campo: string;
  medida: MedidaLista;
  ccaa: string;
  valor: number;
};

export type DatosListas = {
  fuente: string;
  url: string;
  cortes: string[];
  tipos: { id: TipoLista; nombre: string; campos: { id: string; nombre: string }[]; largo: string }[];
  medidas: { id: MedidaLista; nombre: string; unidad: Unidad }[];
  valores: ValorLista[];
};

export const LISTAS = listasJson as DatosListas;

/** Ceuta y Melilla (gestión INGESA) aparecen en el SISLE pero no en las demás fuentes. */
export const CIUDADES: Ccaa[] = [
  { id: "CE", nombre: "Ceuta" },
  { id: "ML", nombre: "Melilla" },
];

export function territorios(conCiudades: boolean): Ccaa[] {
  return conCiudades ? [...CCAA, ...CIUDADES] : CCAA;
}

export function nombreTerritorio(id: string): string {
  return [...CCAA, ...CIUDADES].find((c) => c.id === id)?.nombre ?? id;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2025-12" -> "31 de diciembre de 2025" */
export function nombreCorte(corte: string): string {
  const [anio, mes] = corte.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${ultimoDia} de ${MESES[mes - 1]} de ${anio}`;
}

export function nombreMedida(medida: MedidaLista, tipo: TipoLista, datos: DatosListas = LISTAS): string {
  if (medida === "pct_largo") {
    return `% de pacientes que esperan ${datos.tipos.find((t) => t.id === tipo)?.largo ?? "más del plazo"}`;
  }
  return datos.medidas.find((m) => m.id === medida)?.nombre ?? medida;
}

export function unidadMedida(medida: MedidaLista, datos: DatosListas = LISTAS): Unidad {
  return datos.medidas.find((m) => m.id === medida)?.unidad ?? "num";
}

type Filtro = { corte: string; tipo: TipoLista; medida: MedidaLista; conCiudades: boolean };

/** Valor de cada territorio para un campo (especialidad o proceso), de mayor a menor. Sin dato = fuera. */
export function rankingLista(
  f: Filtro & { campo: string },
  datos: DatosListas = LISTAS,
): { ccaa: string; nombre: string; valor: number }[] {
  const ids = new Set(territorios(f.conCiudades).map((c) => c.id));
  return datos.valores
    .filter((v) => v.corte === f.corte && v.tipo === f.tipo && v.medida === f.medida && v.campo === f.campo && ids.has(v.ccaa))
    .sort((a, b) => b.valor - a.valor)
    .map((v) => ({ ccaa: v.ccaa, nombre: nombreTerritorio(v.ccaa), valor: v.valor }));
}

export type CeldaResumen = { valor?: number; intensidad?: number };

/**
 * Tabla territorio x campo para una medida. `intensidad` (0-1) se calcula por columna:
 * 0 = mínimo de esa especialidad, 1 = máximo. Así cada columna se compara consigo misma.
 */
export function tablaResumen(f: Filtro, datos: DatosListas = LISTAS) {
  const tipo = datos.tipos.find((t) => t.id === f.tipo)!;
  const filas = territorios(f.conCiudades);
  const idx = new Map<string, number>();
  for (const v of datos.valores) {
    if (v.corte === f.corte && v.tipo === f.tipo && v.medida === f.medida) idx.set(`${v.campo}|${v.ccaa}`, v.valor);
  }
  const rango = new Map<string, [number, number]>();
  for (const c of tipo.campos) {
    const vs = filas.map((t) => idx.get(`${c.id}|${t.id}`)).filter((x): x is number => x !== undefined);
    rango.set(c.id, [Math.min(...vs), Math.max(...vs)]);
  }
  const celdas = filas.map((t) => ({
    ccaa: t.id,
    nombre: t.nombre,
    celdas: tipo.campos.map((c): CeldaResumen => {
      const valor = idx.get(`${c.id}|${t.id}`);
      if (valor === undefined) return {};
      const [min, max] = rango.get(c.id)!;
      return { valor, intensidad: max > min ? (valor - min) / (max - min) : 0 };
    }),
  }));
  return { campos: tipo.campos, filas: celdas };
}

export { mediaSimple };
