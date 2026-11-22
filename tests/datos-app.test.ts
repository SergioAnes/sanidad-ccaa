import { describe, expect, it } from "vitest";
import { cambiosEntidades, construirDatos } from "../src/lib/app/datos-app";

describe("datos de la interfaz", () => {
  const d = construirDatos();

  it("tiene las 17 comunidades con abreviatura y los 12 indicadores", () => {
    expect(d.ccaa).toHaveLength(17);
    expect(d.ccaa.every((c) => /^[A-Z]{3}$/.test(c.abr))).toBe(true);
    expect(d.inds.filter((i) => i.grupo === "gasto")).toHaveLength(7);
    expect(d.inds.filter((i) => i.grupo === "espera")).toHaveLength(6);
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

  it("los totales de espera cubren los nueve cortes semestrales para las 17 comunidades", () => {
    expect(d.cortes.map((c) => c.id)).toEqual([
      "2021-12", "2022-06", "2022-12", "2023-06", "2023-12", "2024-06", "2024-12", "2025-06", "2025-12",
    ]);
    for (const ind of d.inds.filter((i) => i.grupo === "espera")) {
      for (const { id } of d.ccaa) {
        expect(ind.serie[id]).toHaveLength(9);
        expect(ind.serie[id].every((v) => typeof v === "number")).toBe(true);
      }
    }
    expect(d.detalle.quirurgica.v.total.dias.AN[0]).toBe(128);
    expect(d.detalle.quirurgica.v.total.pacientes.AN[0]).toBe(122959);
    expect(d.detalle.quirurgica.v.dermatologia.dias.ML[0]).toBeNull();
  });

  it("el IPC cubre todos los años de gasto (para descontar la inflación)", () => {
    for (const a of d.anios) expect(d.ipc[String(a)]).toBeGreaterThan(0);
    expect(d.ipc["2021"]).toBeCloseTo(100, 1);
  });

  it("Ceuta y Melilla van aparte, no dentro de las 17", () => {
    const q = d.inds.find((i) => i.id === "q_dias");
    if (!q || q.grupo !== "espera") throw new Error("falta q_dias");
    const ids = d.ccaa.map((c) => c.id);
    expect(ids).not.toContain("CE");
    expect(ids).not.toContain("ML");
    expect(q.serie.CE).toHaveLength(d.cortes.length);
    expect(q.serie.ML).toHaveLength(d.cortes.length);
  });

  it("el detalle por especialidad coincide con el total del indicador", () => {
    const q = d.inds.find((i) => i.id === "q_dias");
    if (!q || q.grupo !== "espera") throw new Error("falta q_dias");
    expect(d.detalle.quirurgica.v.total.dias).toEqual(q.serie);
    expect(d.detalle.procesos.campos.some((c) => c.id === "catarata")).toBe(true);
    // pacientes en espera (tarjeta «Pacientes en espera» y columna de la tabla): Andalucía, quirúrgica, dic. 2025
    expect(d.detalle.quirurgica.v.total.pacientes.AN.at(-1)).toBe(199950);
    expect(Object.keys(d.detalle.quirurgica.v.total.pacientes)).toEqual(expect.arrayContaining(["CE", "ML"]));
    expect(Object.keys(d.detalle.consultas.v.traumatologia.dias).length).toBeGreaterThanOrEqual(17);
  });

  it("las notas del Ministerio son de comunidades y años con datos", () => {
    expect(d.notas.length).toBeGreaterThan(0);
    for (const n of d.notas) {
      expect(d.ccaa.some((c) => c.id === n.ccaa)).toBe(true);
      expect(d.anios).toContain(n.anio);
      expect(n.texto.length).toBeGreaterThan(20);
    }
    expect(d.notas.some((n) => n.ccaa === "CB" && n.anio === 2012 && n.texto.includes("256.767.398"))).toBe(true);
  });

  it("el mapa tiene un trazado para cada comunidad", () => {
    const enMapa = new Set(d.geo.regiones.map((r) => r.id));
    for (const c of d.ccaa) expect(enMapa.has(c.id)).toBe(true);
  });

  it("cambios en las entidades que cuenta la estadística: agrupados por año y con peso de al menos un 1 %", () => {
    expect(d.entidades.length).toBeGreaterThan(0);
    for (const e of d.entidades) {
      expect(e.peso).toBeGreaterThanOrEqual(1);
      expect(d.anios).toContain(e.anio);
      expect(e.entidades.reduce((s, x) => s + x.peso, 0)).toBeCloseTo(e.peso, 6);
    }
    // Comprobados en el Excel: entra el Hospital Clínic en Cataluña (2009); salen cuatro fundaciones en Baleares (2013)
    const ct = d.entidades.find((e) => e.ccaa === "CT" && e.anio === 2009 && e.cambio === "entra");
    expect(ct?.entidades[0].nombre).toMatch(/Hospital Cl.nico de Barcelona/);
    expect(ct?.entidades[0].millones).toBeCloseTo(515.4, 1);
    const ib = d.entidades.find((e) => e.ccaa === "IB" && e.anio === 2013 && e.cambio === "sale");
    expect(ib?.entidades).toHaveLength(4);
    expect(ib?.peso).toBeCloseTo(24.9, 1);
    // Cifras citadas en «Cómo leer los datos»
    expect(ib?.millones).toBeCloseTo(321, 0);
    expect(d.entidades.find((e) => e.ccaa === "CT" && e.anio === 2006 && e.cambio === "entra")?.entidades).toHaveLength(11);
    // El umbral es por año: Galicia 2009 (cuatro fundaciones de ~0,5 % cada una) cuenta; con umbral 3 %, no
    expect(d.entidades.some((e) => e.ccaa === "GA" && e.anio === 2009)).toBe(true);
    expect(cambiosEntidades(undefined, 3).some((e) => e.ccaa === "GA")).toBe(false);
  });

  it("el gasto ajustado por edad es una variante de gasto_hab, sin tarjeta propia y desde 2013", () => {
    expect(d.inds.some((i) => i.id === "gasto_hab_edad")).toBe(false);
    expect(d.edad?.anios[0]).toBe(2013);
    expect(d.edad?.anios.at(-1)).toBe(d.anios.at(-1));
    for (const s of Object.values(d.edad!.serie)) expect(s.every((v) => typeof v === "number")).toBe(true);
    expect(d.edad?.coeficientes["75+"]).toBe(2.759);
    expect(d.avisos.some((a) => a.indicador === "gasto_hab_edad")).toBe(false);
  });
});

