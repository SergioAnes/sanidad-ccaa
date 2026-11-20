import { describe, expect, it } from "vitest";
import { construirDatos } from "../src/lib/app/datos-app";

describe("datos de la interfaz", () => {
  const d = construirDatos();

  it("tiene las 17 comunidades con abreviatura y los 11 indicadores", () => {
    expect(d.ccaa).toHaveLength(17);
    expect(d.ccaa.every((c) => /^[A-Z]{3}$/.test(c.abr))).toBe(true);
    expect(d.inds.filter((i) => i.grupo === "gasto")).toHaveLength(6);
    expect(d.inds.filter((i) => i.grupo === "espera")).toHaveLength(5);
  });

  it("las series de gasto cubren todos los años sin huecos", () => {
    for (const i of d.inds) {
      if (i.grupo !== "gasto") continue;
      for (const s of Object.values(i.serie)) {
        expect(s).toHaveLength(d.anios.length);
        expect(s.every((v) => typeof v === "number")).toBe(true);
      }
    }
  });

  it("el IPC cubre todos los años de gasto (para descontar la inflación)", () => {
    for (const a of d.anios) expect(d.ipc[String(a)]).toBeGreaterThan(0);
    expect(d.ipc["2021"]).toBeCloseTo(100, 1);
  });

  it("Ceuta y Melilla van aparte, no dentro de las 17", () => {
    const q = d.inds.find((i) => i.id === "q_dias");
    expect(q && q.grupo === "espera" && Object.keys(q.valor)).not.toContain("CE");
    expect(Object.keys(d.ciudades.q_dias).sort()).toEqual(["CE", "ML"]);
  });

  it("el detalle por especialidad coincide con el total del indicador", () => {
    const q = d.inds.find((i) => i.id === "q_dias");
    if (!q || q.grupo !== "espera") throw new Error("falta q_dias");
    expect(d.detalle.quirurgica.v.total.dias).toMatchObject(q.valor);
    expect(d.detalle.procesos.campos.some((c) => c.id === "catarata")).toBe(true);
    expect(Object.keys(d.detalle.consultas.v.traumatologia.dias).length).toBeGreaterThanOrEqual(17);
  });

  it("el mapa tiene un trazado para cada comunidad", () => {
    const enMapa = new Set(d.geo.regiones.map((r) => r.id));
    for (const c of d.ccaa) expect(enMapa.has(c.id)).toBe(true);
  });
});
