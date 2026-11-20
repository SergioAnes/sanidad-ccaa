/**
 * Prepara, en tiempo de compilación, el paquete de datos compacto que usa la interfaz (src/lib/app/ui.ts).
 * Todo sale de los JSON oficiales de src/data; aquí solo se reordena y se añaden textos cortos.
 */
import ipcJson from "@/data/ipc.json";
import mapaJson from "@/data/mapa-ccaa.json";
import notasJson from "@/data/notas-egsp.json";
import { CCAA, INDICADORES, VALORES } from "@/lib/datos";
import { LISTAS, nombreCorte, type MedidaLista, type TipoLista } from "@/lib/listas";
import type { Unidad, Valor } from "@/types/datos";

/** Abreviaturas de tres letras para el mapa y los gráficos. */
export const ABREVIATURAS: Record<string, string> = {
  AN: "AND", AR: "ARA", AS: "AST", IB: "BAL", CN: "CAN", CB: "CNT", CL: "CYL", CM: "CLM", CT: "CAT",
  VC: "VAL", EX: "EXT", GA: "GAL", MD: "MAD", MC: "MUR", NC: "NAV", PV: "PVA", RI: "RIO",
};

/** Nombre corto de cada indicador de gasto para las tarjetas. */
const CORTOS_GASTO: Record<string, string> = {
  gasto_hab: "Gasto por habitante",
  pct_pib: "Gasto sobre el PIB",
  pct_conciertos: "Peso de los conciertos",
  pct_primaria: "Peso de atención primaria",
  pct_hospital: "Peso de hospitales",
  farmacia_hab: "Farmacia por habitante",
};

type DefEspera = { id: string; tipo: TipoLista; medida: MedidaLista; corto: string; nombre: string; desc: string };

/** Indicadores de listas de espera que se muestran (todos con el campo "total" del SISLE). */
export const ESPERA: DefEspera[] = [
  { id: "q_dias", tipo: "quirurgica", medida: "dias", corto: "Espera para operarse", nombre: "Días de espera para operarse",
    desc: "Tiempo medio que llevan esperando los pacientes en lista de espera quirúrgica (todas las especialidades)." },
  { id: "q_pct", tipo: "quirurgica", medida: "pct_largo", corto: "Más de 6 meses para operarse", nombre: "Pacientes que llevan más de 6 meses esperando una operación",
    desc: "Porcentaje de la lista de espera quirúrgica que supera los seis meses." },
  { id: "q_tasa", tipo: "quirurgica", medida: "tasa", corto: "Lista quirúrgica por 1.000 hab.", nombre: "Pacientes esperando una operación por 1.000 habitantes",
    desc: "Pacientes en espera estructural para una operación, por cada 1.000 habitantes." },
  { id: "c_dias", tipo: "consultas", medida: "dias", corto: "Espera para el especialista", nombre: "Días de espera para ver al especialista",
    desc: "Tiempo medio que llevan esperando los pacientes de la lista de primeras consultas con el especialista." },
  { id: "c_pct", tipo: "consultas", medida: "pct_largo", corto: "Más de 60 días para el especialista", nombre: "Pacientes que llevan más de 60 días esperando al especialista",
    desc: "Porcentaje de la lista de consultas que supera los 60 días (incluye pacientes sin cita asignada)." },
];

const UNIDAD_MEDIDA: Record<MedidaLista, Unidad> = { pacientes: "num", tasa: "por_mil", dias: "dias", pct_largo: "pct" };

export type IndApp =
  | { id: string; grupo: "gasto"; corto: string; nombre: string; unidad: Unidad; desc: string; serie: Record<string, (number | null)[]> }
  | { id: string; grupo: "espera"; corto: string; nombre: string; unidad: Unidad; desc: string; valor: Record<string, number>; tipo: TipoLista; medida: MedidaLista };

/** Detalle por especialidad o proceso: tipo -> campos y valores[campo][medida][territorio] (incluye Ceuta y Melilla). */
export type DetalleListas = Record<string, { nombre: string; campos: { id: string; nombre: string }[]; v: Record<string, Record<string, Record<string, number>>> }>;

export type DatosApp = {
  anios: number[];
  prov: number[];
  corteListas: string;
  ccaa: { id: string; nombre: string; abr: string }[];
  inds: IndApp[];
  /** Días de espera quirúrgica por especialidad: nombre de especialidad -> ccaa -> días */
  especQuir: Record<string, Record<string, number>>;
  /** Media anual del IPC (base 2021), por año */
  ipc: Record<string, number>;
  /** Valores de Ceuta y Melilla (se muestran aparte) por indicador de espera */
  ciudades: Record<string, Record<string, number>>;
  /** Listas de espera por especialidad (quirúrgica y consultas) y por proceso, último corte */
  detalle: DetalleListas;
  /** Notas metodológicas del Ministerio por comunidad y año (saltos en las series de gasto) */
  notas: { ccaa: string; anio: number; texto: string }[];
  geo: typeof mapaJson;
};

export function construirDatos(valores: Valor[] = VALORES): DatosApp {
  const ids = CCAA.map((c) => c.id);
  const anios = [...new Set(valores.filter((v) => v.indicador === "gasto_hab").map((v) => v.anio))].sort((a, b) => a - b);
  const prov = [...new Set(valores.filter((v) => v.provisional).map((v) => v.anio))].sort((a, b) => a - b);
  const corte = LISTAS.cortes[LISTAS.cortes.length - 1];
  const filasCorte = LISTAS.valores.filter((v) => v.corte === corte);

  const gasto: IndApp[] = INDICADORES.filter((i) => CORTOS_GASTO[i.id]).map((i) => {
    // La web no tiene modo "datos de ejemplo": si un indicador no es oficial, la compilación se detiene.
    if (i.estado !== "oficial") throw new Error(`El indicador ${i.id} no es oficial (estado: ${i.estado})`);
    const serie: Record<string, (number | null)[]> = {};
    for (const id of ids) {
      serie[id] = anios.map((a) => valores.find((v) => v.indicador === i.id && v.ccaa === id && v.anio === a)?.valor ?? null);
    }
    return { id: i.id, grupo: "gasto", corto: CORTOS_GASTO[i.id], nombre: i.nombre, unidad: i.unidad, desc: i.descripcion, serie };
  });

  const ciudades: DatosApp["ciudades"] = {};
  const espera: IndApp[] = ESPERA.map((e) => {
    const de = (ccaa: string) => filasCorte.find((v) => v.tipo === e.tipo && v.campo === "total" && v.medida === e.medida && v.ccaa === ccaa)?.valor;
    const valor: Record<string, number> = {};
    for (const id of ids) {
      const x = de(id);
      if (x === undefined) throw new Error(`Falta ${e.id} para ${id} en el corte ${corte}`);
      valor[id] = x;
    }
    ciudades[e.id] = {};
    for (const c of ["CE", "ML"]) { const x = de(c); if (x !== undefined) ciudades[e.id][c] = x; }
    return { id: e.id, grupo: "espera", corto: e.corto, nombre: e.nombre, unidad: UNIDAD_MEDIDA[e.medida], desc: e.desc, valor, tipo: e.tipo, medida: e.medida };
  });

  const detalle: DetalleListas = {};
  const medidas = [...new Set(ESPERA.map((e) => e.medida))];
  for (const t of LISTAS.tipos) {
    const v: DetalleListas[string]["v"] = {};
    for (const c of t.campos) {
      v[c.id] = {};
      for (const m of medidas) v[c.id][m] = {};
    }
    for (const f of filasCorte) {
      if (f.tipo === t.id && v[f.campo] && v[f.campo][f.medida]) v[f.campo][f.medida][f.ccaa] = f.valor;
    }
    detalle[t.id] = { nombre: t.nombre, campos: t.campos, v };
  }

  const especQuir: DatosApp["especQuir"] = {};
  const quir = LISTAS.tipos.find((t) => t.id === "quirurgica")!;
  for (const campo of quir.campos.filter((c) => c.id !== "total")) {
    const fila: Record<string, number> = {};
    for (const id of ids) {
      const x = filasCorte.find((v) => v.tipo === "quirurgica" && v.campo === campo.id && v.medida === "dias" && v.ccaa === id)?.valor;
      if (x !== undefined) fila[id] = x;
    }
    especQuir[campo.nombre] = fila;
  }

  return {
    anios, prov,
    corteListas: nombreCorte(corte),
    ccaa: CCAA.map((c) => ({ id: c.id, nombre: c.nombre, abr: ABREVIATURAS[c.id] })),
    inds: [...gasto, ...espera],
    especQuir,
    ipc: ipcJson.medias,
    ciudades,
    detalle,
    notas: notasJson.map(({ ccaa, anio, texto }) => ({ ccaa, anio, texto })),
    geo: mapaJson,
  };
}
