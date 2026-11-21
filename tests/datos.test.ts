import { describe, expect, it } from "vitest";
import { mediaSimple, ranking, serie, variacionPct } from "../src/lib/datos";
import type { Valor } from "../src/types/datos";

const v: Valor[] = [
  { indicador: "x", ccaa: "MD", anio: 2022, valor: 10 },
  { indicador: "x", ccaa: "CT", anio: 2022, valor: 30 },
  { indicador: "x", ccaa: "AN", anio: 2022, valor: 20 },
  { indicador: "x", ccaa: "MD", anio: 2021, valor: 8 },
  { indicador: "y", ccaa: "MD", anio: 2022, valor: 99 },
];

describe("datos", () => {
  it("ordena el ranking de mayor a menor y filtra por indicador y año", () => {
    const r = ranking("x", 2022, v);
    expect(r.map((f) => f.ccaa)).toEqual(["CT", "AN", "MD"]);
    expect(r[0].posicion).toBe(1);
    expect(r[0].nombre).toBe("Cataluña");
  });

  it("calcula la media simple", () => {
    expect(mediaSimple(ranking("x", 2022, v))).toBe(20);
    expect(mediaSimple([])).toBeNaN();
  });

  it("devuelve la serie ordenada por año", () => {
    expect(serie("x", "MD", v)).toEqual([
      { anio: 2021, valor: 8 },
      { anio: 2022, valor: 10 },
    ]);
  });

  it("calcula variación porcentual", () => {
    expect(variacionPct(10, 30)).toBe(200);
  });
});

describe("datos oficiales", () => {
  it("cada fila usa un indicador y una CCAA existentes", async () => {
    const { CCAA, INDICADORES, VALORES } = await import("../src/lib/datos");
    const ccaa = new Set(CCAA.map((c) => c.id));
    const ind = new Set(INDICADORES.map((i) => i.id));
    for (const f of VALORES) {
      expect(ccaa.has(f.ccaa), f.ccaa).toBe(true);
      expect(ind.has(f.indicador), f.indicador).toBe(true);
      expect(Number.isFinite(f.valor)).toBe(true);
    }
  });

  it("todos los indicadores tienen las 17 CCAA en cada año y no hay duplicados", async () => {
    const { INDICADORES, VALORES, aniosDisponibles } = await import("../src/lib/datos");
    const claves = new Set(VALORES.map((f) => `${f.indicador}|${f.ccaa}|${f.anio}`));
    expect(claves.size).toBe(VALORES.length);
    for (const i of INDICADORES) {
      for (const a of aniosDisponibles(i.id)) {
        expect(VALORES.filter((f) => f.indicador === i.id && f.anio === a)).toHaveLength(17);
      }
    }
  });

  it("marca como provisionales 2023 y 2024 y no 2022", async () => {
    const { esProvisional } = await import("../src/lib/datos");
    expect(esProvisional("gasto_hab", 2024)).toBe(true);
    expect(esProvisional("gasto_hab", 2023)).toBe(true);
    expect(esProvisional("gasto_hab", 2022)).toBe(false);
  });

  it("coincide con valores comprobados a mano en el Excel (Andalucía 2024)", async () => {
    const { VALORES } = await import("../src/lib/datos");
    const v = (ind: string) => VALORES.find((f) => f.indicador === ind && f.ccaa === "AN" && f.anio === 2024)?.valor;
    expect(v("gasto_hab")).toBeCloseTo(1657.79, 2);
    expect(v("pct_conciertos")).toBeCloseTo(4.35, 2);
    // 625.011,77 miles de € de conciertos / 8.648.311 habitantes (aportación total / gasto por habitante)
    expect(v("conciertos_hab")).toBeCloseTo(72.27, 2);
    expect(v("pct_primaria")).toBeCloseTo(16.32, 2);
    expect(v("pct_pib")).toBeCloseTo(6.75, 2);
  });
});

describe("listas de espera", () => {
  it("cada valor usa tipo, campo, medida y territorio conocidos", async () => {
    const { LISTAS, territorios } = await import("../src/lib/listas");
    const ids = new Set(territorios(true).map((c) => c.id));
    for (const v of LISTAS.valores) {
      const tipo = LISTAS.tipos.find((t) => t.id === v.tipo);
      expect(tipo, v.tipo).toBeDefined();
      expect(tipo!.campos.some((c) => c.id === v.campo), v.campo).toBe(true);
      expect(LISTAS.medidas.some((m) => m.id === v.medida)).toBe(true);
      expect(ids.has(v.ccaa), v.ccaa).toBe(true);
      expect(LISTAS.cortes).toContain(v.corte);
    }
  });

  it("el total quirúrgico es la suma de especialidades (pacientes)", async () => {
    const { LISTAS } = await import("../src/lib/listas");
    const q = LISTAS.valores.filter((v) => v.tipo === "quirurgica" && v.medida === "pacientes" && v.ccaa === "MD");
    const total = q.find((v) => v.campo === "total")!.valor;
    expect(q.filter((v) => v.campo !== "total").reduce((s, v) => s + v.valor, 0)).toBe(total);
  });

  it("coincide con valores comprobados en el PDF (dic. 2025)", async () => {
    const { LISTAS } = await import("../src/lib/listas");
    const v = (tipo: string, campo: string, medida: string, ccaa: string) =>
      LISTAS.valores.find((x) => x.corte === "2025-12" && x.tipo === tipo && x.campo === campo && x.medida === medida && x.ccaa === ccaa)?.valor;
    expect(v("quirurgica", "total", "pacientes", "AN")).toBe(199950);
    expect(v("quirurgica", "cirugia_general", "tasa", "AN")).toBe(3.75);
    expect(v("procesos", "catarata", "pacientes", "AN")).toBe(24307);
    expect(v("consultas", "total", "pacientes", "AN")).toBe(852889);
    expect(v("consultas", "total", "pct_largo", "AN")).toBe(57.1);
  });

  it("la tabla resumen escala la intensidad por columna entre 0 y 1", async () => {
    const { tablaResumen } = await import("../src/lib/listas");
    const r = tablaResumen({ corte: "2025-12", tipo: "quirurgica", medida: "dias", conCiudades: false });
    expect(r.filas).toHaveLength(17);
    const col = r.filas.map((f) => f.celdas[0].intensidad).filter((x): x is number => x !== undefined);
    expect(Math.min(...col)).toBe(0);
    expect(Math.max(...col)).toBe(1);
  });

  it("nombra el corte con su último día", async () => {
    const { nombreCorte } = await import("../src/lib/listas");
    expect(nombreCorte("2025-12")).toBe("31 de diciembre de 2025");
    expect(nombreCorte("2025-06")).toBe("30 de junio de 2025");
  });
});
