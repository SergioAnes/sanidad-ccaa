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
import resultadosJson from "@/data/resultados.json";
import accesoReingresosJson from "@/data/acceso-reingresos.json";
import ingesaJson from "@/data/ingesa.json";
import vidaSaludableJson from "@/data/vida-saludable.json";
import hospitalizacionesEvitablesJson from "@/data/hospitalizaciones-evitables.json";
import prevencionJson from "@/data/prevencion.json";
import retribucionesJson from "@/data/retribuciones.json";
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
  { id: "c_tasa", tipo: "consultas", medida: "tasa", corto: "Lista del especialista por 1.000 hab.", nombre: "Pacientes esperando una primera consulta con el especialista por 1.000 habitantes",
    desc: "Pacientes en espera para una primera consulta con el especialista, por cada 1.000 habitantes." },
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
  valoracion_especialista: {
    corto: "Valoran bien al especialista", nombre: "Personas que valoran como buena o muy buena la atención del especialista de la sanidad pública", mejorAlto: true,
    desc: "Porcentaje que valora como buena o muy buena la atención recibida, entre quienes fueron a la consulta de un médico especialista de la sanidad pública en el último año (el total incluye a quien no sabe o no contesta, como hace el Ministerio).",
  },
  valoracion_urgencias: {
    corto: "Valoran bien las urgencias", nombre: "Personas que valoran como buena o muy buena la atención en urgencias de la sanidad pública", mejorAlto: true,
    desc: "Porcentaje que valora como buena o muy buena la atención recibida la última vez que fue a un servicio de urgencias de la sanidad pública en el último año (el total incluye a quien no sabe o no contesta, como hace el Ministerio). Desde 2024 la pregunta habla del «servicio de urgencias (atención primaria/hospitalaria)»; antes, del «servicio de urgencias». El Ministerio da la serie como continua.",
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
  ap_consultas_medico: {
    unidad: "consultas_dia", que: "consultas al día por médico de familia", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Consultas al día por médico de familia", nombre: "Consultas al día por médico de familia de atención primaria",
    desc: "Media de consultas que atiende cada día cada médico de familia de los equipos de atención primaria de la sanidad pública, en horario ordinario (sin urgencias). Mide la carga de trabajo, no la calidad: muchas consultas al día dejan menos tiempo para cada paciente. Dato publicado por el Ministerio de Sanidad (SIAP), desde 2009: Cataluña no tiene datos de actividad de 2007 y 2008.",
  },
  ap_consultas_pediatra: {
    unidad: "consultas_dia", que: "consultas al día por pediatra", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Consultas al día por pediatra", nombre: "Consultas al día por pediatra de atención primaria",
    desc: "Media de consultas que atiende cada día cada pediatra de los equipos de atención primaria de la sanidad pública, en horario ordinario (sin urgencias). Mide la carga de trabajo, no la calidad: muchas consultas al día dejan menos tiempo para cada paciente. Dato publicado por el Ministerio de Sanidad (SIAP), desde 2009: Cataluña no tiene datos de actividad de 2007 y 2008.",
  },
  ap_consultas_enfermera: {
    unidad: "consultas_dia", que: "consultas al día por profesional de enfermería", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Consultas al día por profesional de enfermería", nombre: "Consultas al día por profesional de enfermería de atención primaria",
    desc: "Media de consultas que atiende cada día cada profesional de enfermería de los equipos de atención primaria de la sanidad pública, en horario ordinario (sin urgencias). Mide la carga de trabajo, no la calidad: muchas consultas al día dejan menos tiempo para cada paciente. Dato publicado por el Ministerio de Sanidad (SIAP), desde 2009: Cataluña no tiene datos de actividad de 2007 y 2008.",
  },
  hosp_camas_sns: {
    ...CAMAS, corto: "Camas de hospital públicas", nombre: "Camas de hospital de la red pública en funcionamiento por 1.000 habitantes",
    desc: "Camas que han funcionado de media durante el año en los hospitales de la red pública (SNS) de la comunidad, por cada 1.000 habitantes. La red pública incluye los hospitales públicos y los privados con concierto sustitutorio o que forman parte de una Red de Utilización Pública (financiados con fondos públicos). Cuenta todos los hospitales: agudos, media y larga estancia y salud mental. Tasa publicada por el Ministerio de Sanidad (SIAE).",
  },
  hosp_camas_total: {
    ...CAMAS, corto: "Camas de hospital, públicas y privadas", nombre: "Camas de hospital en funcionamiento por 1.000 habitantes, públicas y privadas",
    desc: "Camas que han funcionado de media durante el año en todos los hospitales de la comunidad, públicos y privados, por cada 1.000 habitantes. Tasa publicada por el Ministerio de Sanidad (SIAE).",
  },
  hosp_medicos_sns: {
    unidad: "prof_mil", que: "médicos por 1.000 habitantes", espanaTxt: "en el conjunto de los hospitales de la red pública, con Ceuta y Melilla",
    corto: "Médicos de hospitales públicos", nombre: "Médicos de los hospitales de la red pública por 1.000 habitantes",
    desc: "Médicos especialistas que trabajan en los hospitales de la red pública de la comunidad, por cada 1.000 habitantes. Personal con contrato con el hospital (personal «vinculado»): no cuenta los médicos internos residentes (MIR) ni los «colaboradores», que trabajan en el hospital sin contrato con él. Se cuenta en la comunidad del hospital, aunque atienda a pacientes de otras. No está ajustado por edad. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. Cálculo propio con datos del Ministerio de Sanidad (SIAE): número de profesionales × porcentaje de la red pública, entre la población de esa misma estadística. Desde 2016: antes, las tablas no separan la red pública por comunidad.",
  },
  hosp_enfermeria_sns: {
    unidad: "prof_mil", que: "profesionales de enfermería por 1.000 habitantes", espanaTxt: "en el conjunto de los hospitales de la red pública, con Ceuta y Melilla",
    corto: "Enfermería de hospitales públicos", nombre: "Profesionales de enfermería de los hospitales de la red pública por 1.000 habitantes",
    desc: "Enfermeras y enfermeros (incluidas matronas y otras especialidades de enfermería) que trabajan en los hospitales de la red pública de la comunidad, por cada 1.000 habitantes. No incluye técnicos en cuidados auxiliares de enfermería (TCAE). Personal con contrato con el hospital (personal «vinculado»): no cuenta los médicos internos residentes (MIR) ni los «colaboradores», que trabajan en el hospital sin contrato con él. Se cuenta en la comunidad del hospital, aunque atienda a pacientes de otras. No está ajustado por edad. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. Cálculo propio con datos del Ministerio de Sanidad (SIAE): número de profesionales × porcentaje de la red pública, entre la población de esa misma estadística. Desde 2016: antes, las tablas no separan la red pública por comunidad.",
  },
  hosp_ocupacion: {
    unidad: "pct", que: "de ocupación", espanaTxt: "en el conjunto de los hospitales de agudos de la red pública, con Ceuta y Melilla (dato del Ministerio)",
    corto: "Ocupación de los hospitales públicos", nombre: "Ocupación de las camas de los hospitales de agudos de la red pública",
    desc: "Porcentaje de las camas de los hospitales de agudos de la red pública que estuvieron ocupadas de media durante el año (estancias ÷ (camas × 365)). Solo hospitales de agudos: los de larga estancia y salud mental van casi siempre llenos y harían la media poco comparable. Una ocupación alta indica que se usan casi todas las camas (por encima del 85-90 % se suele hablar de saturación); una baja, margen libre, o estancias más cortas. Índice publicado por el Ministerio de Sanidad (SIAE).",
  },
  hosp_estancia: {
    unidad: "dias_media", que: "de estancia media", espanaTxt: "en el conjunto de los hospitales de agudos de la red pública, con Ceuta y Melilla (dato del Ministerio)",
    corto: "Estancia media en el hospital", nombre: "Estancia media en los hospitales de agudos de la red pública (días)",
    desc: "Días que pasa de media cada paciente ingresado en un hospital de agudos de la red pública (estancias ÷ altas). Depende de la gravedad y la edad de los pacientes y de cómo se organiza la atención (cirugía sin ingreso, hospitalización a domicilio), así que no mide por sí sola la calidad. Dato publicado por el Ministerio de Sanidad (SIAE).",
  },
  hosp_cma: {
    unidad: "pct", que: "de las operaciones sin ingreso", espanaTxt: "en el conjunto de los hospitales de la red pública, con Ceuta y Melilla (dato del Ministerio)",
    corto: "Operaciones sin ingreso", nombre: "Cirugía mayor ambulatoria: operaciones de cirugía mayor que se hacen sin ingreso en la red pública (%)",
    desc: "Porcentaje de las operaciones de cirugía mayor de los hospitales de la red pública que se hacen sin ingresar al paciente (cirugía mayor ambulatoria: se va a casa el mismo día), sobre el total de cirugía mayor (con ingreso o sin él). Ayuda a entender las camas y la estancia media: lo que se opera sin ingreso no ocupa cama. Depende también del tipo de operaciones que se hacen en cada comunidad. «Porcentaje de ambulatorización» publicado por el Ministerio de Sanidad (SIAE).",
  },
  hosp_quir_sns: {
    unidad: "quir_100k", que: "quirófanos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla",
    corto: "Quirófanos públicos", nombre: "Quirófanos de la red pública por 100.000 habitantes",
    desc: "Quirófanos en funcionamiento en los hospitales de la red pública de la comunidad, por cada 100.000 habitantes. Más quirófanos no significa por sí solo más operaciones: depende también de cuántas horas se usan. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. No está ajustado por edad. Cálculo propio: el número de quirófanos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística (coincide con la tasa que publica). 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_quir_total: {
    unidad: "quir_100k", que: "quirófanos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla",
    corto: "Quirófanos, públicos y privados", nombre: "Quirófanos por 100.000 habitantes, públicos y privados",
    desc: "Quirófanos en funcionamiento en todos los hospitales de la comunidad, públicos y privados, por cada 100.000 habitantes. Más quirófanos no significa por sí solo más operaciones: depende también de cuántas horas se usan. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. No está ajustado por edad. Cálculo propio: el número de quirófanos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística (coincide con la tasa que publica). 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_ingresos: {
    unidad: "por_mil_hab", que: "ingresos por 1.000 habitantes", espanaTxt: "en el conjunto de los hospitales de la red pública, con Ceuta y Melilla",
    corto: "Ingresos en hospitales públicos", nombre: "Ingresos en hospitales de la red pública por 1.000 habitantes",
    desc: "Pacientes ingresados en los hospitales de la red pública de la comunidad durante el año, por cada 1.000 habitantes. Cuenta cada ingreso (una persona puede ingresar varias veces) en la comunidad del hospital, aunque el paciente viva en otra. Depende de la edad y la salud de la población y de cuánto se atiende sin ingreso (cirugía ambulatoria, hospital de día). Cálculo propio: ingresos por 1.000 habitantes × porcentaje de la red pública, ambos publicados por el Ministerio de Sanidad (SIAE).",
  },
  hosp_dia: {
    unidad: "sesiones_mil", que: "sesiones de hospital de día por 1.000 habitantes", espanaTxt: "en el conjunto de los hospitales, con Ceuta y Melilla",
    corto: "Hospital de día", nombre: "Sesiones de hospital de día por 1.000 habitantes (todos los hospitales)",
    desc: "Sesiones de hospital de día (tratamientos de unas horas sin pasar la noche, como quimioterapia, transfusiones o curas) por cada 1.000 habitantes, en todos los hospitales de la comunidad, públicos y privados (la tabla no las separa). Parte de lo que antes requería ingreso se hace así. De 2014 en adelante, tasa publicada por el Ministerio de Sanidad (SIAE); de 2010 a 2013 la tabla solo trae el número de sesiones y la tasa la calculamos con la población que usa esa misma tabla.",
  },
  hosp_tac_sns: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "TAC públicos", nombre: "Equipos de TAC de la red pública por 100.000 habitantes",
    desc: "Equipos de tomografía axial computarizada (TAC, el «escáner») en funcionamiento en los hospitales de la red pública de la comunidad, por cada 100.000 habitantes. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_tac_total: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "TAC, públicos y privados", nombre: "Equipos de TAC por 100.000 habitantes, públicos y privados",
    desc: "Equipos de tomografía axial computarizada (TAC, el «escáner») en funcionamiento en todos los hospitales de la comunidad, públicos y privados, por cada 100.000 habitantes. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_rm_sns: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Resonancias públicas", nombre: "Equipos de resonancia magnética de la red pública por 100.000 habitantes",
    desc: "Equipos de resonancia magnética en funcionamiento en los hospitales de la red pública de la comunidad, por cada 100.000 habitantes. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_rm_total: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Resonancias, públicas y privadas", nombre: "Equipos de resonancia magnética por 100.000 habitantes, públicos y privados",
    desc: "Equipos de resonancia magnética en funcionamiento en todos los hospitales de la comunidad, públicos y privados, por cada 100.000 habitantes. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_mam_sns: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Mamógrafos públicos", nombre: "Mamógrafos de los hospitales de la red pública por 100.000 habitantes",
    desc: "Mamógrafos en funcionamiento en los hospitales de la red pública de la comunidad, por cada 100.000 habitantes. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública. Solo cuenta los de los hospitales: muchos mamógrafos del cribado de cáncer de mama están en centros sin ingreso, que esta estadística no incluye. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
  hosp_mam_total: {
    unidad: "equipos_100k", que: "equipos por 100.000 habitantes", espanaTxt: "con todas las comunidades, Ceuta y Melilla (dato del Ministerio)",
    corto: "Mamógrafos, públicos y privados", nombre: "Mamógrafos de los hospitales por 100.000 habitantes, públicos y privados",
    desc: "Mamógrafos en funcionamiento en todos los hospitales de la comunidad, públicos y privados, por cada 100.000 habitantes. Solo cuenta los de los hospitales: muchos mamógrafos del cribado de cáncer de mama están en centros sin ingreso, que esta estadística no incluye. No está ajustado por edad. Cálculo propio: el número de equipos que publica el Ministerio de Sanidad (SIAE) entre la población de esa misma estadística. 2022 sin dato por comunidad: la tabla de ese año trae las columnas desplazadas.",
  },
};

/** Textos de los resultados en salud (INE). No dependen solo de la sanidad. */
const RESULTADOS: Record<string, { corto: string; nombre: string; desc: string; unidad: Unidad; que: string; espanaTxt: string }> = {
  res_esperanza: {
    unidad: "anios_vida", que: "de esperanza de vida al nacer", espanaTxt: "dato del INE para el conjunto de España",
    corto: "Esperanza de vida al nacer", nombre: "Esperanza de vida al nacer (años)",
    desc: "Años que viviría de media una persona nacida ese año si se mantuvieran las tasas de mortalidad por edad de ese año en su comunidad. Depende de la sanidad, pero también de la renta, los hábitos, el entorno y otros factores. Dato publicado por el INE (Indicadores Demográficos Básicos), ambos sexos.",
  },
  res_esperanza65: {
    unidad: "anios_vida", que: "de esperanza de vida a los 65 años", espanaTxt: "dato del INE para el conjunto de España",
    corto: "Esperanza de vida a los 65 años", nombre: "Esperanza de vida a los 65 años (años que quedan por vivir)",
    desc: "Años que le quedarían de media por vivir a una persona de 65 años si se mantuvieran las tasas de mortalidad por edad de ese año en su comunidad. Depende de la sanidad, pero también de la renta, los hábitos y otros factores. Dato publicado por el INE (Indicadores Demográficos Básicos), ambos sexos.",
  },
  res_mort_infantil: {
    unidad: "por_mil_nac", que: "muertes de menores de un año por 1.000 nacidos vivos", espanaTxt: "media de tres años, residentes en España",
    corto: "Mortalidad infantil (media de 3 años)", nombre: "Mortalidad infantil: muertes de menores de un año por 1.000 nacidos vivos, media de tres años",
    desc: "Bebés que mueren antes de cumplir un año por cada 1.000 nacidos vivos, en la media de los tres años que terminan en el año indicado. Usamos la media porque en las comunidades pequeñas mueren muy pocos bebés y la cifra de un solo año salta mucho por azar. Cálculo propio con las defunciones y los nacimientos del INE (por comunidad de residencia).",
  },
};

export type IndApp =
  | { id: string; grupo: "gasto"; corto: string; nombre: string; unidad: Unidad; desc: string; serie: Record<string, (number | null)[]> }
  | {
      id: string; grupo: "opinion"; corto: string; nombre: string; unidad: Unidad; desc: string; mejorAlto: boolean;
      fuente?: "ecv";
      /** Años (los periodos son sus índices, como los cortes de las listas de espera) */
      fechas: number[]; serie: Record<string, (number | null)[]>; espana: (number | null)[];
      /** Semiamplitud del intervalo al 95 % de cada comunidad y de España, por año */
      margen: Record<string, (number | null)[]>; margenEspana: (number | null)[];
      /** Serie anterior al cambio de método de 2022 (entrevista en persona), solo para la evolución */
      historico?: { fechas: number[]; serie: Record<string, (number | null)[]>; espana: (number | null)[] };
    }
  | {
      id: string; grupo: "primaria" | "hospitales" | "resultados" | "prevencion"; corto: string; nombre: string; unidad: Unidad; desc: string;
      anios: number[]; serie: Record<string, (number | null)[]>;
      /** Fuente, unidad en palabras y qué representa «España» en este indicador */
      fuente: "siap" | "siae" | "ine" | "rae" | "sanidad" | "icmbd" | "sivamin" | "esde" | "retribuciones"; que: string; espanaTxt: string;
      /** Serie nacional, según el ámbito de la fuente */
      espana: (number | null)[];
    }
  | { id: string; grupo: "espera"; corto: string; nombre: string; unidad: Unidad; desc: string; serie: Serie; tipo: TipoLista; medida: MedidaLista };

type Serie = Record<string, (number | null)[]>;
/** Valores por campo, medida y territorio, en el orden de los cortes del SISLE. */
export type DetalleListas = Record<string, { nombre: string; campos: { id: string; nombre: string }[]; v: Record<string, Record<string, Serie>> }>;
type VersionLista = { fichero: string; rectificado: boolean; fecha_pdf: string | null; resumen?: string };
type ReferenciaEspera = { dias: number; tasa: number };
type TotalesEspera = { quirurgica: ReferenciaEspera; consultas: ReferenciaEspera | null };

export type DatosApp = {
  anios: number[];
  prov: number[];
  corteListas: string;
  cortes: { id: string; fecha: string; version: VersionLista | null; notas: string[]; espana: TotalesEspera | null }[];
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
  accesoReingresos: {
    acceso: Pick<typeof accesoReingresosJson.acceso, "tabla" | "metodologia">;
    reingresos: Pick<typeof accesoReingresosJson.reingresos, "perfil" | "informes">;
  };
  retribuciones: typeof retribucionesJson;
  /** Profesionales de atención primaria (SIAP): fuente, ruptura de serie y años con cifras repetidas */
  /** Resultados en salud (INE): fuentes y fecha de publicación */
  resultados: { fuentes: typeof resultadosJson.fuentes };
  vidaSaludable: Pick<typeof vidaSaludableJson, "fuente" | "cuadro" | "ceutaMelilla">;
  hospitalizacionesEvitables: Pick<typeof hospitalizacionesEvitablesJson, "fuente" | "ficha">;
  prevencion: {
    vacunacion: Pick<typeof prevencionJson.vacunacion, "fuente" | "plan" | "objetivo">;
    cribado: Pick<typeof prevencionJson.cribado, "tablas" | "metodologia">;
  };
  ingesa: typeof ingesaJson;
  recursos: {
    fuentes: typeof recursosJson.fuentes; ruptura: typeof recursosJson.ruptura; repetidos: typeof recursosJson.repetidos;
    reclasificaciones: typeof recursosJson.reclasificaciones; etiquetasSiae: string[]; picos: typeof recursosJson.picos; saltosPersonal: typeof recursosJson.saltos_personal; anioEquiposSinDato: number;
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

function acceso(): IndApp {
  const i = accesoReingresosJson.acceso;
  return {
    id: "acceso_no_cubierto", grupo: "opinion", fuente: "ecv", unidad: "pct", mejorAlto: false,
    corto: "Necesidad de atención médica no cubierta",
    nombre: "Personas con una necesidad de atención médica no cubierta",
    desc: "Porcentaje de personas de 16 años o más que declaran haber necesitado atención médica en los últimos 12 meses y no haberla recibido por coste, lista de espera o distancia. La base es toda la población de 16 años o más. Excluye la atención dental. Fuente: Encuesta de Condiciones de Vida, INE.",
    fechas: i.anios, serie: { ...i.valor, ...i.ciudades }, espana: i.espana, margen: {}, margenEspana: [],
  };
}

function reingresos(): IndApp {
  const i = accesoReingresosJson.reingresos;
  return {
    id: "hosp_reingresos", grupo: "hospitales", fuente: "rae", unidad: "pct",
    corto: "Reingresos urgentes a 30 días", nombre: "Reingresos urgentes a 30 días en hospitales de agudos del SNS",
    desc: "Porcentaje de altas elegibles seguidas de un ingreso urgente en el mismo hospital durante los 30 días posteriores. Incluye hospitales del SNS de agudos y aplica las exclusiones del Ministerio. La cifra es bruta y depende también del perfil de los pacientes atendidos.",
    que: "de reingresos en hospitales de agudos", espanaTxt: "dato del Ministerio para el conjunto del SNS",
    anios: i.anios, serie: { ...i.valor, ...i.ciudades }, espana: i.espana,
  };
}

/** Profesionales de atención primaria (src/data/recursos.json, generado por scripts/extraer_recursos.py). */
function recursos(): IndApp[] {
  return recursosJson.indicadores.map((i) => {
    const t = RECURSOS[i.id];
    if (!t) throw new Error(`Recursos: falta el texto de ${i.id}`);
    return { id: i.id, grupo: (i.fuente === "siap" ? "primaria" : "hospitales") as "primaria" | "hospitales", ...t, fuente: i.fuente as "siap" | "siae", anios: i.anios, serie: i.valor as Record<string, number[]>, espana: i.espana };
  });
}

/** Resultados en salud (src/data/resultados.json, generado por scripts/extraer_resultados.py). */
function resultados(): IndApp[] {
  return resultadosJson.indicadores.map((i) => {
    const t = RESULTADOS[i.id];
    if (!t) throw new Error(`Resultados: falta el texto de ${i.id}`);
    return { id: i.id, grupo: "resultados" as const, ...t, fuente: "ine" as const, anios: i.anios, serie: { ...i.valor, ...i.ciudades }, espana: i.espana };
  });
}

function vidaSaludable(): IndApp {
  const i = vidaSaludableJson;
  return {
    id: "res_vida_saludable", grupo: "resultados", fuente: "sanidad", unidad: "anios_vida",
    corto: "Años de vida saludable al nacer", nombre: "Años de vida saludable al nacer",
    desc: "Años que se espera vivir desde el nacimiento sin limitación grave de la actividad. El Ministerio combina las tablas de mortalidad con las estimaciones de limitación grave de las encuestas de salud.",
    que: "de vida sin limitación grave", espanaTxt: "dato del Ministerio para toda España",
    anios: i.anios, serie: i.valor, espana: i.espana,
  };
}

function hospitalizacionesEvitables(): IndApp {
  const i = hospitalizacionesEvitablesJson;
  return {
    id: "hosp_evitables_cronicas", grupo: "hospitales", fuente: "icmbd", unidad: "por_10k_hab",
    corto: "Hospitalizaciones evitables por enfermedades crónicas",
    nombre: "Hospitalizaciones potencialmente evitables por enfermedades crónicas por 10.000 habitantes",
    desc: "Tasa ajustada que publica el Ministerio para las altas de hospitales del SNS incluidas en el indicador PQI 92. Agrupa las altas por territorio del hospital y usa la población de 15 años o más.",
    que: "hospitalizaciones potencialmente evitables por 10.000 habitantes", espanaTxt: "tasa ajustada del Ministerio para España",
    anios: i.anios, serie: { ...i.valor, ...i.ciudades }, espana: i.espana,
  };
}

function prevencion(): IndApp[] {
  const { vacunacion: v, cribado: c } = prevencionJson;
  return [
    {
      id: "prev_triple_virica", grupo: "prevencion", fuente: "sivamin", unidad: "pct",
      corto: "Triple vírica, dos dosis", nombre: "Cobertura de la segunda dosis de triple vírica",
      desc: "Porcentaje de niños y niñas de la cohorte correspondiente con al menos dos dosis frente a sarampión, rubéola y parotiditis. El año es el de evaluación de la cobertura.",
      que: "con al menos dos dosis", espanaTxt: "cobertura publicada para España",
      anios: v.anios, serie: { ...v.valor, ...v.ciudades }, espana: v.espana,
    },
    {
      id: "prev_cribado_colorrectal", grupo: "prevencion", fuente: "esde", unidad: "pct",
      corto: "Prueba de detección colorrectal", nombre: "Personas con prueba de sangre oculta en heces en los últimos dos años",
      desc: "Estimación de la Encuesta de Salud de España para personas de 50 a 69 años. El porcentaje se calcula sobre quienes respondieron a la pregunta, con los recuentos ponderados que publica el INE.",
      que: "que declara haberse hecho la prueba", espanaTxt: "estimación de la encuesta para España",
      anios: c.anios, serie: { ...c.valor, ...c.ciudades }, espana: c.espana,
    },
  ];
}

export function construirDatos(valores: Valor[] = VALORES): DatosApp {
  const ids = CCAA.map((c) => c.id);
  const anios = [...new Set(valores.filter((v) => v.indicador === "gasto_hab").map((v) => v.anio))].sort((a, b) => a - b);
  const prov = [...new Set(valores.filter((v) => v.provisional).map((v) => v.anio))].sort((a, b) => a - b);
  const corte = LISTAS.cortes[LISTAS.cortes.length - 1];
  const meta = LISTAS as typeof LISTAS & { versiones?: Record<string, VersionLista>; notas_pdf?: { corte: string; texto: string }[]; totales_sns?: Record<string, TotalesEspera> };
  const cortes = LISTAS.cortes.map((id) => ({
    id, fecha: nombreCorte(id), version: meta.versiones?.[id] ?? null, espana: meta.totales_sns?.[id] ?? null,
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

  const retribuciones: IndApp = {
    id: "hosp_retribuciones", grupo: "hospitales", fuente: "retribuciones", unidad: "eur_anual",
    corto: "Retribución de especialistas",
    nombre: "Retribución fija anual de un especialista hospitalario sin guardias",
    desc: "Importe bruto anual según las tablas aplicables al 31 de julio de 2026. Se calcula para un médico especialista del servicio público con jornada completa, cinco años de servicio, sin jefatura ni carrera profesional reconocida y con dedicación exclusiva donde se distingue en las tablas.",
    que: "brutos al año", espanaTxt: "", espana: [],
    anios: [Number(retribucionesJson.fecha.slice(0, 4))],
    serie: Object.fromEntries(Object.entries(retribucionesJson.territorios).map(([id, fila]) => [id, [fila?.fijoBruto ?? null]])),
  };

  return {
    anios, prov, cortes,
    corteListas: nombreCorte(corte),
    ccaa: CCAA.map((c) => ({ id: c.id, nombre: c.nombre, abr: ABREVIATURAS[c.id] })),
    inds: [...gasto, ...espera, ...opinion(), acceso(), ...recursos(), reingresos(), hospitalizacionesEvitables(), retribuciones, ...resultados(), vidaSaludable(), ...prevencion()],
    ipc: ipcJson.medias,
    detalle,
    notas: notasJson.map(({ ccaa, anio, texto }) => ({ ccaa, anio, texto })),
    avisos: detectarAvisos(valores.filter((v) => v.indicador !== "gasto_hab_edad"), notasJson),
    entidades: cambiosEntidades(),
    umbralEntidades: UMBRAL_ENTIDADES,
    edad: ajusteEdad(valores, ids),
    contexto: contextoJson,
    barometro: { fuentes: barometroJson.fuentes, primerAnioMetodo: barometroJson.primer_anio_metodo },
    accesoReingresos: {
      acceso: { tabla: accesoReingresosJson.acceso.tabla, metodologia: accesoReingresosJson.acceso.metodologia },
      reingresos: { perfil: accesoReingresosJson.reingresos.perfil, informes: accesoReingresosJson.reingresos.informes },
    },
    retribuciones: retribucionesJson,
    resultados: { fuentes: resultadosJson.fuentes },
    vidaSaludable: { fuente: vidaSaludableJson.fuente, cuadro: vidaSaludableJson.cuadro, ceutaMelilla: vidaSaludableJson.ceutaMelilla },
    hospitalizacionesEvitables: { fuente: hospitalizacionesEvitablesJson.fuente, ficha: hospitalizacionesEvitablesJson.ficha },
    prevencion: {
      vacunacion: { fuente: prevencionJson.vacunacion.fuente, plan: prevencionJson.vacunacion.plan, objetivo: prevencionJson.vacunacion.objetivo },
      cribado: { tablas: prevencionJson.cribado.tablas, metodologia: prevencionJson.cribado.metodologia },
    },
    ingesa: ingesaJson,
    recursos: {
      fuentes: recursosJson.fuentes, ruptura: recursosJson.ruptura, repetidos: recursosJson.repetidos,
      reclasificaciones: recursosJson.reclasificaciones, etiquetasSiae: recursosJson.etiquetas_siae, picos: recursosJson.picos, saltosPersonal: recursosJson.saltos_personal, anioEquiposSinDato: recursosJson.anio_equipos_sin_dato,
    },
    versionListas: cortes.at(-1)?.version ?? null,
    notasListas: cortes.at(-1)?.notas ?? [],
    geo: mapaJson,
  };
}
