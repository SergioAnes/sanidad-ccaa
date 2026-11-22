/**
 * Prepara, en tiempo de compilación, el paquete de datos compacto que usa la interfaz (src/lib/app/ui.ts).
 * Todo sale de los JSON oficiales de src/data; aquí solo se reordena y se añaden textos cortos.
 */
import ipcJson from "@/data/ipc.json";
import mapaJson from "@/data/mapa-ccaa.json";
import notasJson from "@/data/notas-egsp.json";
import perimetroJson from "@/data/perimetro-egsp.json";
import ppeJson from "@/data/poblacion-equivalente.json";
import contextoJson from "@/data/contexto-ccaa.json";
import barometroJson from "@/data/barometro.json";
import recursosJson from "@/data/recursos.json";
import { CCAA, INDICADORES, VALORES } from "@/lib/datos";
import { detectarAvisos, type Aviso } from "@/lib/avisos";
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
  conciertos_hab: "Conciertos por habitante",
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
    desc: "Porcentaje de pacientes con más de 60 días de espera para una primera consulta. La definición depende del corte." },
];

const UNIDAD_MEDIDA: Record<MedidaLista, Unidad> = { pacientes: "num", tasa: "por_mil", dias: "dias", pct_largo: "pct" };

/**
 * Cambios en la lista de entidades («agentes de gasto») que la EGSP cuenta en cada comunidad. Se muestran los que,
 * sumando las entidades que entran (o las que salen) ese año, pesan al menos este % del gasto de la comunidad.
 * Es un umbral nuestro: por debajo casi todo son fundaciones de investigación pequeñas.
 */
export const UMBRAL_ENTIDADES = 1;

export type CambioEntidades = {
  ccaa: string;
  anio: number;
  cambio: "entra" | "sale";
  /** Peso conjunto en el gasto de la comunidad (% del año en que entran, o del último en que contaron) */
  peso: number;
  /** Importe conjunto, en millones de euros */
  millones: number;
  entidades: { nombre: string; millones: number; peso: number }[];
};

type FilaPerimetro = { ccaa: string; anio: number; cambio: string; entidad: string; miles_eur: number; peso_pct: number };

/** Agrupa las entradas y salidas por comunidad, año y sentido, y se queda con las que superan el umbral. */
export function cambiosEntidades(filas: FilaPerimetro[] = perimetroJson as FilaPerimetro[], umbral = UMBRAL_ENTIDADES): CambioEntidades[] {
  const grupos = new Map<string, CambioEntidades>();
  for (const f of filas) {
    const k = `${f.ccaa}|${f.anio}|${f.cambio}`;
    if (!grupos.has(k)) grupos.set(k, { ccaa: f.ccaa, anio: f.anio, cambio: f.cambio as "entra" | "sale", peso: 0, millones: 0, entidades: [] });
    const g = grupos.get(k)!;
    g.peso += f.peso_pct; g.millones += f.miles_eur / 1000;
    g.entidades.push({ nombre: f.entidad, millones: f.miles_eur / 1000, peso: f.peso_pct });
  }
  return [...grupos.values()]
    .filter((g) => g.peso >= umbral)
    .map((g) => ({ ...g, entidades: g.entidades.sort((a, b) => b.peso - a.peso) }))
    .sort((a, b) => a.ccaa.localeCompare(b.ccaa) || a.anio - b.anio || a.cambio.localeCompare(b.cambio));
}

/** Variante del gasto por habitante ajustado por edad: mismas propiedades que un indicador de gasto, con sus años. */
export type AjusteEdad = {
  id: string; grupo: "gasto"; corto: string; nombre: string; unidad: Unidad; desc: string;
  anios: number[]; serie: Record<string, (number | null)[]>;
  /** Coeficientes de la Ley 22/2009 por tramo de edad y años de los certificados disponibles */
  coeficientes: Record<string, number>; primerAnio: number; aniosPPE: number[];
};

/** Textos de los indicadores del Barómetro Sanitario (encuesta del Ministerio de Sanidad y el CIS). */
const OPINION: Record<string, { corto: string; nombre: string; desc: string; mejorAlto: boolean }> = {
  satisfaccion: {
    corto: "Satisfacción con la sanidad pública", nombre: "Satisfacción con el funcionamiento de la sanidad pública en España (de 1 a 10)", mejorAlto: true,
    desc: "Media de la respuesta, de 1 (muy insatisfecho) a 10 (muy satisfecho), a la pregunta «En general, ¿está usted satisfecho o insatisfecho con el modo en que el sistema sanitario público funciona en España?». Pregunta por la sanidad pública de toda España, no por la de la comunidad: aquí se agrupan las respuestas según dónde vive quien contesta. Encuesta a la población de 18 y más años.",
  },
  valoracion_ap: {
    corto: "Valoran bien al médico de familia", nombre: "Personas que valoran como buena o muy buena la atención del médico de familia de la sanidad pública", mejorAlto: true,
    desc: "Porcentaje que valora como buena o muy buena la atención recibida, entre quienes fueron al médico de familia de la sanidad pública en el último año (el total incluye a quien no sabe o no contesta, como hace el Ministerio).",
  },
  ap_en_24h: {
    corto: "Atendidos en el día o al siguiente", nombre: "Personas atendidas por el médico de familia el mismo día o el día siguiente de pedir cita", mejorAlto: true,
    desc: "Porcentaje que fue atendido el mismo día o el día siguiente de pedir cita, según su última visita, entre quienes fueron al médico de familia de la sanidad pública en el último año. Como hace el Ministerio, el total incluye también a quienes solo tuvieron citas programadas, a quienes no necesitan pedir cita y a quien no contesta (en España, unas 3 de cada 100 respuestas en 2025). Cálculo propio con los microdatos del CIS.",
  },
  ap_dias: {
    corto: "Días para el médico de familia", nombre: "Días para que te atienda el médico de familia, cuando no había cita antes", mejorAlto: false,
    desc: "Media de días que pasaron hasta que les atendió el médico de familia, entre quienes no consiguieron cita para el mismo día o el siguiente porque no había cita antes. No es la espera de todos los pacientes: quien fue atendido en el día o al siguiente, o esperó más porque prefirió otra fecha, no entra en esta media (en España, en 2025, entran unas 7 de cada 10 personas que fueron). Cálculo propio con los microdatos del CIS.",
  },
};

/** Textos de los indicadores de recursos (profesionales de atención primaria, SIAP). */
type TextoRecurso = { corto: string; nombre: string; desc: string; unidad: Unidad; que: string; espanaTxt: string };
const AP = { unidad: "personas" as Unidad, espanaTxt: "contando toda la población asignada y todos los profesionales de las 17" };
const CAMAS = { unidad: "camas_mil" as Unidad, que: "camas por 1.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)" };
const RECURSOS: Record<string, TextoRecurso> = {
  ap_pob_medico: {
    ...AP, que: "personas por médico de familia",
    corto: "Personas por médico de familia", nombre: "Personas asignadas a cada médico de familia de la sanidad pública",
    desc: "Población adulta con tarjeta sanitaria asignada a medicina de familia, dividida entre los médicos de familia de atención primaria (equipos de atención primaria y modelo tradicional), a 31 de diciembre. Más personas por médico quiere decir menos médicos para la misma población; no mide por sí solo la calidad de la atención ni la espera. No incluye urgencias ni residentes. Cálculo propio con los datos del SIAP (Ministerio de Sanidad).",
  },
  ap_pob_pediatra: {
    ...AP, que: "niños por pediatra",
    corto: "Niños por pediatra", nombre: "Niños asignados a cada pediatra de atención primaria de la sanidad pública",
    desc: "Población infantil con tarjeta sanitaria asignada a pediatría, dividida entre los pediatras de atención primaria (equipos de atención primaria, modelo tradicional y pediatría de área), a 31 de diciembre. Cálculo propio con los datos del SIAP (Ministerio de Sanidad).",
  },
  ap_pob_enfermera: {
    ...AP, que: "personas por profesional de enfermería",
    corto: "Personas por profesional de enfermería", nombre: "Personas asignadas a cada profesional de enfermería de atención primaria de la sanidad pública",
    desc: "Toda la población con tarjeta sanitaria asignada (la de medicina de familia más la de pediatría), dividida entre los profesionales de enfermería de atención primaria (equipos de atención primaria y modelo tradicional), a 31 de diciembre. No incluye matronas ni urgencias. Cálculo propio con los datos del SIAP (Ministerio de Sanidad).",
  },
  hosp_camas_sns: {
    ...CAMAS, corto: "Camas de hospital públicas", nombre: "Camas de hospital de la red pública en funcionamiento por 1.000 habitantes",
    desc: "Camas que han funcionado de media durante el año en los hospitales de la red pública (SNS) de la comunidad, por cada 1.000 habitantes. La red pública incluye los hospitales públicos y los privados con concierto sustitutorio o que forman parte de una Red de Utilización Pública (financiados con fondos públicos). Cuenta todos los hospitales: agudos, media y larga estancia y salud mental. Tasa publicada por el Ministerio de Sanidad (SIAE).",
  },
  hosp_camas_total: {
    ...CAMAS, corto: "Camas de hospital, públicas y privadas", nombre: "Camas de hospital en funcionamiento por 1.000 habitantes, públicas y privadas",
    desc: "Camas que han funcionado de media durante el año en todos los hospitales de la comunidad, públicos y privados, por cada 1.000 habitantes. Tasa publicada por el Ministerio de Sanidad (SIAE).",
  },
};

export type IndApp =
  | { id: string; grupo: "gasto"; corto: string; nombre: string; unidad: Unidad; desc: string; serie: Record<string, (number | null)[]> }
  | {
      id: string; grupo: "opinion"; corto: string; nombre: string; unidad: Unidad; desc: string; mejorAlto: boolean;
      /** Años (los periodos son sus índices, como los cortes de las listas de espera) */
      fechas: number[]; serie: Record<string, (number | null)[]>; espana: (number | null)[];
      /** Semiamplitud del intervalo al 95 % de cada comunidad y de España, por año */
      margen: Record<string, (number | null)[]>; margenEspana: (number | null)[];
      /** Serie anterior al cambio de método de 2022 (entrevista en persona), solo para la evolución */
      historico?: { fechas: number[]; serie: Record<string, (number | null)[]>; espana: (number | null)[] };
    }
  | {
      id: string; grupo: "recursos"; corto: string; nombre: string; unidad: Unidad; desc: string;
      anios: number[]; serie: Record<string, (number | null)[]>;
      /** Fuente (siap / siae), unidad en palabras y qué es «España» en este indicador */
      fuente: "siap" | "siae"; que: string; espanaTxt: string;
      /** España: el conjunto de las 17 (toda la población asignada entre todos los profesionales), no la media */
      espana: (number | null)[];
    }
  | { id: string; grupo: "espera"; corto: string; nombre: string; unidad: Unidad; desc: string; serie: Serie; tipo: TipoLista; medida: MedidaLista };

type Serie = Record<string, (number | null)[]>;
/** Valores por campo, medida y territorio, en el orden de los cortes del SISLE. */
export type DetalleListas = Record<string, { nombre: string; campos: { id: string; nombre: string }[]; v: Record<string, Record<string, Serie>> }>;
type VersionLista = { fichero: string; rectificado: boolean; fecha_pdf: string | null; resumen?: string };

export type DatosApp = {
  anios: number[];
  prov: number[];
  corteListas: string;
  cortes: { id: string; fecha: string; version: VersionLista | null; notas: string[] }[];
  ccaa: { id: string; nombre: string; abr: string }[];
  inds: IndApp[];
  /** Media anual del IPC (base 2021), por año */
  ipc: Record<string, number>;
  /** Listas de espera por especialidad (quirúrgica y consultas) y por proceso */
  detalle: DetalleListas;
  /** Notas metodológicas del Ministerio por comunidad y año (saltos en las series de gasto) */
  notas: { ccaa: string; anio: number; texto: string }[];
  /** Variaciones inusuales detectadas automáticamente (src/lib/avisos.ts) */
  avisos: Aviso[];
  /** Entidades que empiezan o dejan de contarse en la estadística (≥ UMBRAL_ENTIDADES % del gasto) */
  entidades: CambioEntidades[];
  umbralEntidades: number;
  /** Gasto por habitante ajustado por edad (src/data/poblacion-equivalente.json) */
  edad: AjusteEdad | null;
  /** Datos de contexto de cada comunidad para la ficha (src/data/contexto-ccaa.json): no corrigen el gasto */
  contexto: typeof contextoJson;
  /** Fuentes del Barómetro Sanitario (para citar y contrastar) */
  barometro: { fuentes: typeof barometroJson.fuentes; primerAnioMetodo: number };
  /** Profesionales de atención primaria (SIAP): fuente, ruptura de serie y años con cifras repetidas */
  recursos: {
    fuentes: typeof recursosJson.fuentes; ruptura: typeof recursosJson.ruptura; repetidos: typeof recursosJson.repetidos;
    reclasificaciones: typeof recursosJson.reclasificaciones; etiquetasSiae: string[];
  };
  /** Versión del PDF de listas de espera del último corte y sus notas al pie */
  versionListas: VersionLista | null;
  notasListas: string[];
  geo: typeof mapaJson;
};

function ajusteEdad(valores: Valor[], ids: string[]): AjusteEdad | null {
  const def = INDICADORES.find((i) => i.id === "gasto_hab_edad");
  const filas = valores.filter((v) => v.indicador === "gasto_hab_edad");
  if (!def || !filas.length) return null;
  if (def.estado !== "oficial") throw new Error("gasto_hab_edad no es oficial");
  const anios = [...new Set(filas.map((v) => v.anio))].sort((a, b) => a - b);
  const serie: AjusteEdad["serie"] = {};
  for (const id of ids) serie[id] = anios.map((a) => filas.find((v) => v.ccaa === id && v.anio === a)?.valor ?? null);
  return {
    id: def.id, grupo: "gasto", corto: "Gasto por habitante, ajustado por edad", nombre: def.nombre, unidad: def.unidad, desc: def.descripcion,
    anios, serie, coeficientes: ppeJson.coeficientes.tramos, primerAnio: ppeJson.primer_anio_comparable,
    aniosPPE: [...new Set(ppeJson.valores.map((v) => v.anio))].sort((a, b) => a - b),
  };
}

/** Indicadores del Barómetro Sanitario (src/data/barometro.json, generado por scripts/extraer_barometro.py). */
function opinion(): IndApp[] {
  return barometroJson.indicadores.map((i) => {
    const t = OPINION[i.id];
    if (!t) throw new Error(`Barómetro: falta el texto de ${i.id}`);
    const h = (i as { historico?: { anios: number[]; valor: Record<string, (number | null)[]>; espana: (number | null)[] } }).historico;
    return {
      // La espera media del Barómetro lleva decimales (9,15 días); la de las listas de espera, no.
      id: i.id, grupo: "opinion" as const, unidad: (i.unidad === "dias" ? "dias_media" : i.unidad) as Unidad, ...t,
      fechas: i.anios, serie: i.valor, espana: i.espana, margen: i.margen, margenEspana: i.margen_espana,
      ...(h ? { historico: { fechas: h.anios, serie: h.valor, espana: h.espana } } : {}),
    };
  });
}

/** Profesionales de atención primaria (src/data/recursos.json, generado por scripts/extraer_recursos.py). */
function recursos(): IndApp[] {
  return recursosJson.indicadores.map((i) => {
    const t = RECURSOS[i.id];
    if (!t) throw new Error(`Recursos: falta el texto de ${i.id}`);
    return { id: i.id, grupo: "recursos" as const, ...t, fuente: i.fuente as "siap" | "siae", anios: i.anios, serie: i.valor as Record<string, number[]>, espana: i.espana };
  });
}

export function construirDatos(valores: Valor[] = VALORES): DatosApp {
  const ids = CCAA.map((c) => c.id);
  const anios = [...new Set(valores.filter((v) => v.indicador === "gasto_hab").map((v) => v.anio))].sort((a, b) => a - b);
  const prov = [...new Set(valores.filter((v) => v.provisional).map((v) => v.anio))].sort((a, b) => a - b);
  const corte = LISTAS.cortes[LISTAS.cortes.length - 1];
  const meta = LISTAS as typeof LISTAS & { versiones?: Record<string, VersionLista>; notas_pdf?: { corte: string; texto: string }[] };
  const cortes = LISTAS.cortes.map((id) => ({
    id, fecha: nombreCorte(id), version: meta.versiones?.[id] ?? null,
    notas: (meta.notas_pdf ?? []).filter((n) => n.corte === id).map((n) => n.texto),
  }));

  const gasto: IndApp[] = INDICADORES.filter((i) => CORTOS_GASTO[i.id]).map((i) => {
    // La web no tiene modo "datos de ejemplo": si un indicador no es oficial, la compilación se detiene.
    if (i.estado !== "oficial") throw new Error(`El indicador ${i.id} no es oficial (estado: ${i.estado})`);
    const serie: Record<string, (number | null)[]> = {};
    for (const id of ids) {
      serie[id] = anios.map((a) => valores.find((v) => v.indicador === i.id && v.ccaa === id && v.anio === a)?.valor ?? null);
    }
    return { id: i.id, grupo: "gasto", corto: CORTOS_GASTO[i.id], nombre: i.nombre, unidad: i.unidad, desc: i.descripcion, serie };
  });

  const detalle: DetalleListas = {};
  // Además de las medidas de las tarjetas, el número de pacientes (para la tarjeta «Pacientes en espera» y la tabla).
  const medidas = [...new Set([...ESPERA.map((e) => e.medida), "pacientes" as MedidaLista])];
  for (const t of LISTAS.tipos) {
    const v: DetalleListas[string]["v"] = {};
    for (const c of t.campos) {
      v[c.id] = {};
      for (const m of medidas) v[c.id][m] = {};
    }
    for (const f of LISTAS.valores) {
      const series = v[f.campo]?.[f.medida];
      if (f.tipo !== t.id || !series) continue;
      const serie = series[f.ccaa] ??= Array(cortes.length).fill(null);
      serie[LISTAS.cortes.indexOf(f.corte)] = f.valor;
    }
    detalle[t.id] = { nombre: t.nombre, campos: t.campos, v };
  }

  const espera: IndApp[] = ESPERA.map((e) => ({
    ...e, grupo: "espera", unidad: UNIDAD_MEDIDA[e.medida],
    serie: detalle[e.tipo].v.total[e.medida],
  }));

  return {
    anios, prov, cortes,
    corteListas: nombreCorte(corte),
    ccaa: CCAA.map((c) => ({ id: c.id, nombre: c.nombre, abr: ABREVIATURAS[c.id] })),
    inds: [...gasto, ...espera, ...opinion(), ...recursos()],
    ipc: ipcJson.medias,
    detalle,
    notas: notasJson.map(({ ccaa, anio, texto }) => ({ ccaa, anio, texto })),
    avisos: detectarAvisos(valores.filter((v) => v.indicador !== "gasto_hab_edad"), notasJson),
    entidades: cambiosEntidades(),
    umbralEntidades: UMBRAL_ENTIDADES,
    edad: ajusteEdad(valores, ids),
    contexto: contextoJson,
    barometro: { fuentes: barometroJson.fuentes, primerAnioMetodo: barometroJson.primer_anio_metodo },
    recursos: {
      fuentes: recursosJson.fuentes, ruptura: recursosJson.ruptura, repetidos: recursosJson.repetidos,
      reclasificaciones: recursosJson.reclasificaciones, etiquetasSiae: recursosJson.etiquetas_siae,
    },
    versionListas: cortes.at(-1)?.version ?? null,
    notasListas: cortes.at(-1)?.notas ?? [],
    geo: mapaJson,
  };
}
