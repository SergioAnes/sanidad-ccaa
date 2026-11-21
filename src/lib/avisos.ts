/**
 * Detección automática de variaciones inusuales en las series de gasto.
 *
 * Criterio (fijo y documentado en «Cómo leer los datos»):
 *  - Para cada indicador y año se calcula el cambio de cada comunidad respecto al año anterior:
 *    en % para los datos en euros, en puntos para los porcentajes.
 *  - Se compara con lo que hicieron las demás ese mismo año: mediana y desviación absoluta mediana (MAD).
 *  - Es «inusual» si se aleja más de 4 veces la dispersión típica (z robusta > 4) y, además, más de
 *    10 puntos de % (euros) o 3 puntos (porcentajes) de la mediana. Así no salen oscilaciones pequeñas.
 *  - Si el Ministerio tiene una nota para esa comunidad en ese año o el anterior, se marca como explicada.
 *
 * Las cifras se comprueban al extraerlas (scripts/extraer_egsp.py): no son errores de lectura, son los datos
 * oficiales. El aviso solo dice que el cambio es raro y que la fuente no lo explica.
 */
import type { Valor } from "@/types/datos";

export type Aviso = {
  indicador: string;
  ccaa: string;
  anio: number;
  /** Cambio respecto al año anterior (% en euros, puntos en porcentajes) */
  cambio: number;
  /** Mediana del cambio de las comunidades ese año */
  mediana: number;
  unidad: "%" | "puntos";
  /** true si hay una nota del Ministerio para esa comunidad en ese año o el anterior */
  explicado: boolean;
};

export const CRITERIO = { z: 4, minEuros: 10, minPuntos: 3 } as const;

const EN_EUROS = new Set(["gasto_hab", "farmacia_hab", "conciertos_hab"]);

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b), n = o.length;
  return n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
}

export function detectarAvisos(valores: Valor[], notas: { ccaa: string; anio: number }[]): Aviso[] {
  const serie = new Map<string, Map<number, number>>();
  for (const v of valores) {
    const k = `${v.indicador}|${v.ccaa}`;
    if (!serie.has(k)) serie.set(k, new Map());
    serie.get(k)!.set(v.anio, v.valor);
  }
  const indicadores = [...new Set(valores.map((v) => v.indicador))];
  const ccaa = [...new Set(valores.map((v) => v.ccaa))];
  const anios = [...new Set(valores.map((v) => v.anio))].sort((a, b) => a - b);
  const conNota = new Set(notas.map((n) => `${n.ccaa}|${n.anio}`));
  const out: Aviso[] = [];
  for (const ind of indicadores) {
    const euros = EN_EUROS.has(ind);
    for (const anio of anios.slice(1)) {
      const cambios = new Map<string, number>();
      for (const c of ccaa) {
        const s = serie.get(`${ind}|${c}`);
        const a = s?.get(anio), b = s?.get(anio - 1);
        if (a == null || b == null) continue;
        cambios.set(c, euros ? (a / b - 1) * 100 : a - b);
      }
      if (cambios.size < 5) continue;
      const med = mediana([...cambios.values()]);
      const mad = mediana([...cambios.values()].map((x) => Math.abs(x - med))) || 1e-9;
      for (const [c, x] of cambios) {
        const z = (x - med) / (1.4826 * mad);
        if (Math.abs(z) > CRITERIO.z && Math.abs(x - med) > (euros ? CRITERIO.minEuros : CRITERIO.minPuntos)) {
          out.push({
            indicador: ind, ccaa: c, anio, cambio: x, mediana: med, unidad: euros ? "%" : "puntos",
            explicado: conNota.has(`${c}|${anio}`) || conNota.has(`${c}|${anio - 1}`),
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.ccaa.localeCompare(b.ccaa) || a.anio - b.anio || a.indicador.localeCompare(b.indicador));
}
