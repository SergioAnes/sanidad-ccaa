/**
 * Estadística básica para el gráfico «gasto frente a espera».
 * Comparamos 16-17 comunidades: con tan pocos puntos hay que decir qué correlaciones podrían deberse al azar.
 */

/** Correlación de Pearson (relación lineal entre dos variables), de −1 a 1. */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Rangos (1 = el menor); los empates reciben el rango medio. */
export function rangos(xs: number[]): number[] {
  const orden = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < orden.length; ) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1][0] === orden[i][0]) j++;
    for (let k = i; k <= j; k++) r[orden[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Correlación de Spearman (por rangos): no la distorsiona un solo valor extremo. */
export function spearman(xs: number[], ys: number[]): number {
  return pearson(rangos(xs), rangos(ys));
}

/** t de Student bilateral al 95 % para 1-30 grados de libertad. */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

/**
 * Valor a partir del cual una correlación con n puntos es distinta de 0 al 95 % (contraste bilateral):
 * r = t / √(gl + t²), con gl = n − 2. Por debajo, la correlación podría deberse al azar.
 */
export function correlacionCritica(n: number): number {
  const gl = n - 2;
  if (gl < 1 || gl > T95.length) throw new Error(`correlacionCritica: n=${n} fuera de rango`);
  const t = T95[gl - 1];
  return t / Math.sqrt(gl + t * t);
}
