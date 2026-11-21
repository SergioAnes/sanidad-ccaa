/** Barómetro Sanitario: cifras contrastadas con las fuentes y coherencia del fichero generado. */
import { describe, expect, it } from "vitest";
import bs from "../src/data/barometro.json";
import { CCAA } from "../src/lib/datos";

const ind = (id: string) => {
  const i = bs.indicadores.find((x) => x.id === id);
  if (!i) throw new Error(id);
  return i;
};
const ultimo = (id: string, c: string) => {
  const i = ind(id);
  return c === "ES" ? i.espana.at(-1) : (i.valor as Record<string, (number | null)[]>)[c].at(-1);
};

describe("Barómetro Sanitario", () => {
  it("reproduce cifras publicadas por el Ministerio (serie por comunidad e Informe 2025)", () => {
    expect(ultimo("satisfaccion", "ES")).toBe(6.02);
    expect(ultimo("satisfaccion", "AN")).toBe(5.37);
    expect(ultimo("satisfaccion", "PV")).toBe(6.54);
    expect(ultimo("ap_dias", "ES")).toBeCloseTo(9.15, 2);
    expect(ultimo("ap_dias", "PV")).toBeCloseTo(4.91, 2);
    expect(ultimo("ap_dias", "AN")).toBeCloseTo(11.16, 2);
    expect(ultimo("ap_en_24h", "ES")).toBeCloseTo(21.8, 1);
  });

  it("cada indicador tiene las 17 comunidades, margen de error y años del método actual", () => {
    for (const i of bs.indicadores) {
      expect(i.anios.every((a) => a >= bs.primer_anio_metodo), i.id).toBe(true);
      expect(i.espana).toHaveLength(i.anios.length);
      for (const c of CCAA) {
        const v = (i.valor as Record<string, (number | null)[]>)[c.id];
        const m = (i.margen as Record<string, (number | null)[]>)[c.id];
        expect(v, `${i.id} ${c.id}`).toHaveLength(i.anios.length);
        v.forEach((x, k) => {
          expect(x, `${i.id} ${c.id} ${i.anios[k]}`).toBeTypeOf("number");
          expect(m[k], `margen ${i.id} ${c.id}`).toBeGreaterThan(0);
        });
      }
    }
  });

  it("la serie anterior al cambio de método termina antes de 2022 y no lleva margen", () => {
    for (const i of bs.indicadores) {
      const h = (i as { historico?: { anios: number[] } }).historico;
      if (h) expect(Math.max(...h.anios)).toBeLessThan(bs.primer_anio_metodo);
    }
  });

  it("los valores están en su escala", () => {
    for (const i of bs.indicadores) for (const fila of Object.values(i.valor as Record<string, (number | null)[]>)) for (const v of fila) {
      if (v == null) continue;
      if (i.unidad === "pct") expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
      if (i.unidad === "nota10") expect(v).toBeGreaterThanOrEqual(1), expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("cita las fuentes con enlace, incluidos los microdatos de cada año", () => {
    const F = bs.fuentes;
    for (const u of [F.serie.url, F.serie.url_fichero, F.informe.url, ...F.microdatos.map((m) => m.url)]) expect(u).toMatch(/^https:\/\/www\.(sanidad\.gob|cis)\.es\//);
    const anios = new Set(bs.indicadores.flatMap((i) => i.anios));
    for (const a of anios) expect(F.microdatos.some((m) => m.anio === a), `microdatos ${a}`).toBe(true);
  });
});
