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

  it("solo publica retribuciones con fuente oficial", () => {
    const i = d.inds.find((ind) => ind.id === "hosp_retribuciones");
    if (!i || i.grupo !== "sueldos") throw new Error("falta el indicador de retribuciones");
    expect(d.retribuciones.fecha).toBe("2026-07-31");
    expect(i.anios).toEqual([2026]);
    expect(i.espana).toEqual([]);
    expect(i.serie.CB).toEqual([null]);
    expect(d.retribuciones.territorios.CB).toBeNull();
    expect(d.retribuciones.territorios.CT).toBeNull();
    expect(i.serie.CT).toEqual([null]);
    expect(d.retribuciones.provisionales).toEqual({});
    expect(d.ccaa.filter(({ id }) => Number.isFinite(i.serie[id][0]))).toHaveLength(15);
    expect(d.retribuciones.territorios.INGESA).toMatchObject({ fijoBruto: 68655.38, residencia: 14030.88 });
    expect(i.serie.INGESA).toEqual([68655.38]);
    expect(i.serie.AR).toEqual([56806.60]);
    expect(d.retribuciones.territorios.AR).toMatchObject({ diferenciaDedicacion: 2989.8, antiguedad: 706.6 });
    expect(d.retribuciones.territorios.NC.antiguedad).toBe(338.1);
    expect(d.retribuciones.territorios.MC.diferenciaDedicacion).toBe(0);
  });

  it("solo publica tarifas de guardia con fuente oficial", () => {
    const i = d.inds.find((ind) => ind.id === "hosp_guardias");
    if (!i || i.grupo !== "sueldos") throw new Error("falta el indicador de guardias");
    const { fecha, territorios, provisionales } = d.guardias;
    expect(fecha).toBe("2026-07-31");
    expect(Object.keys(territorios).sort()).toEqual([...d.ccaa.map(({ id }) => id).filter((id) => id !== "CT"), "INGESA"].sort());
    expect(territorios.CB).toMatchObject({ laborable: null, domingo: null });
    expect(territorios.NC).toMatchObject({ laborable: null, domingo: null });
    expect(territorios.RI).toMatchObject({ laborable: 28.57, domingo: 29.94 });
    expect(provisionales).toEqual({});
    expect(d.guardias).not.toHaveProperty("ics");
    expect(i.serie.CB).toEqual([null]);
    expect(i.serie.NC).toEqual([null]);
    expect(i.serie.RI).toEqual([28.57]);
    expect(territorios.VC).toMatchObject({ laborable: 30.26, domingo: 32.26 });
    expect(territorios.INGESA).toMatchObject({ laborable: 24.91, domingo: 25.52 });
    expect(Object.values(territorios).filter((fila) => fila.domingo != null)).toHaveLength(15);
    expect(i.serie.CT).toBeUndefined();
  });

  it("guarda cuatro niveles de carrera crecientes por servicio", () => {
    const { carrera, territorios } = d.retribuciones;
    for (const [id, { niveles, fuente }] of Object.entries(carrera)) {
      expect((territorios as Record<string, unknown>)[id], id).toBeTruthy();
      expect(niveles, id).toHaveLength(4);
      expect(fuente, id).toMatch(/^https:\/\//);
      const importes = niveles.filter((v): v is number => v != null);
      expect(importes, id).toEqual([...importes].sort((x, y) => Number(x) - Number(y)));
    }
    for (const [id, { anios, fuenteAnios }] of Object.entries(carrera)) {
      expect(anios, id).toHaveLength(4);
      expect(anios, id).toEqual([...anios].sort((x, y) => x - y));
      expect(fuenteAnios, id).toMatch(/^https:\/\//);
    }
    expect(carrera.EX.anios).toEqual([5, 12, 20, 25]);
    expect(carrera.GA.anios).toEqual([5, 12, 18, 23]);
    expect(carrera.CM.sinAcceso).toMatch(/suspendido en 2026/);
    expect(carrera.CM.niveles).toEqual([3738.84, 7476.96, 11214.84, 14953.08]);
    expect(carrera.PV.niveles).toEqual([3898.68, 7797.36, 10396.47, 14295.15]);
    expect(carrera.RI.niveles).toEqual([3272.67, 6545.31, 9817.96, 13090.61]);
  });

  it("no usa fuentes de sindicatos, blogs ni borradores en sueldos y guardias", () => {
    const texto = JSON.stringify([d.retribuciones, d.guardias, d.medicinaFamilia]);
    const urls = texto.match(/https?:\/\/[^"\s#]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    const noOficiales = /(wordpress|blogspot|ccoo|ugt|csif|satse|cesm|amyts|som-hi|metgesdecatalunya|simebal)\./i;
    expect(urls.filter((url) => noOficiales.test(new URL(url).hostname))).toEqual([]);
  });

  it("calcula la simulación de medicina de familia únicamente donde están completos los importes", () => {
    const i = d.inds.find((ind) => ind.id === "ap_retribuciones");
    if (!i || i.grupo !== "sueldos") throw new Error("falta la simulación de medicina de familia");
    const { cupo, fecha, navarra, territorios, escenarios } = d.medicinaFamilia;
    expect(fecha).toBe("2026-07-31");
    expect(cupo.edades.reduce((total, tramo) => total + tramo.personas, 0)).toBe(cupo.pacientes);
    expect(cupo.pacientes).toBe(1500);
    expect(i.espana).toEqual([]);
    expect(Object.keys(i.serie)).toEqual(Object.keys(territorios));
    expect(d.ccaa.filter(({ id }) => i.serie[id])).toHaveLength(14);
    expect(i.serie.NC).toBeUndefined();
    expect(navarra.fijo).toBe(54463.50);
    expect(i.serie.CM).toEqual([53717.88]);
    expect(i.serie.RI).toEqual([58537.80]);
    expect(i.serie.IB).toEqual([56736.50]);
    expect(i.serie.AS).toEqual([56356.48]);
    expect(i.serie.PV).toEqual([60026.72]);
    expect(i.serie.VC).toEqual([54941.28]);
    expect(i.serie.INGESA).toEqual([70398.04]);
    expect(escenarios.mayores.personasPorTramo.reduce((total, personas) => total + personas, 0)).toBe(cupo.pacientes);
    expect(Object.keys(escenarios.mayores.importes).sort()).toEqual(Object.keys(territorios).sort());
    expect(escenarios.mayores.importes.PV).toBeCloseTo((2200 - 1969) * 2.54 * 12, 2);
    expect(escenarios.mayores.importes.VC).toBeCloseTo((1000 * 0.202 + 300 * 0.460 + 200 * 0.911) * 14, 2);
    expect(Object.keys(escenarios.dispersion.importes)).toHaveLength(9);
    expect(escenarios.dispersion.importes.EX).toBeCloseTo(12 * 1105.96, 2);
  });

  it("muestra la serie ECV desde el cambio de cuestionario y conserva los porcentajes del INE", () => {
    const i = d.inds.find((ind) => ind.id === "acceso_no_cubierto");
    if (!i || i.grupo !== "opinion") throw new Error("falta el indicador ECV");
    expect(i.fuente).toBe("ecv");
    expect(i.fechas).toEqual(Array.from({ length: 11 }, (_, k) => 2015 + k));
    expect(i.espana.at(-1)).toBe(1.6);
    expect(i.serie.CM.at(-1)).toBe(3.1);
    expect(i.serie.MD.at(-1)).toBe(1.5);
    for (const { id } of d.ccaa) expect(i.serie[id]).toHaveLength(i.fechas.length);
    expect(i.margen).toEqual({});
    expect(i.margenEspana).toEqual([]);
  });

  it("alinea los reingresos de los informes y de INCLASNS con el total publicado para el SNS", () => {
    const i = d.inds.find((ind) => ind.id === "hosp_reingresos");
    if (!i || i.grupo !== "hospitales") throw new Error("falta el indicador RAE-CMBD");
    expect(i.fuente).toBe("rae");
    expect(i.anios).toEqual([2021, 2022, 2023, 2024]);
    expect(i.espana).toEqual([7.9, 8.4, 8.3, 8.4]);
    expect(i.serie.MD).toEqual([8, 8.4, 8.2, 8.4]);
    expect(i.serie.NC).toEqual([5.4, 6.4, 6.5, 6.4]);
    for (const { id } of d.ccaa) expect(i.serie[id]).toHaveLength(i.anios.length);
  });

  it("conserva cifras distintas para las ciudades sin incluirlas en la lista de comunidades", () => {
    expect(d.ingesa.ciudades.CE.hospitales.camas).toBe(171);
    expect(d.ingesa.ciudades.ML.hospitales.camas).toBe(231);
    expect(d.ingesa.ciudades.CE.consultas.familia.at(-1)).toBe(279519);
    expect(d.ingesa.ciudades.ML.consultas.familia.at(-1)).toBe(334920);
    const esperanza = d.inds.find((i) => i.id === "res_esperanza");
    expect(esperanza?.serie.CE.at(-1)).toBe(82.36);
    expect(esperanza?.serie.ML.at(-1)).toBe(81.5);
    expect(d.ccaa.map((c) => c.id)).not.toContain("CE");
    expect(d.ccaa.map((c) => c.id)).not.toContain("ML");
  });

  it("usa la tasa ajustada PQI 92 y conserva el total SNS y las ciudades", () => {
    const i = d.inds.find((ind) => ind.id === "hosp_evitables_cronicas");
    if (!i || i.grupo !== "hospitales") throw new Error("falta el indicador PQI 92");
    expect(i.fuente).toBe("icmbd");
    expect(i.anios).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    expect(i.espana.at(-1)).toBe(34.59);
    expect(i.serie.MD.at(-1)).toBe(39.08);
    expect(i.serie.CE.at(-1)).toBe(22.93);
    expect(i.serie.ML.at(-1)).toBe(21.63);
    for (const { id } of d.ccaa) expect(i.serie[id]).toHaveLength(i.anios.length);
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

  it("mantiene la referencia nacional de espera del corte y omite las consultas repetidas de junio de 2023", () => {
    expect(d.cortes.find((c) => c.id === "2021-12")?.espana).toEqual({
      quirurgica: { dias: 123, tasa: 15.39 }, consultas: { dias: 89, tasa: 77.23 },
    });
    expect(d.cortes.find((c) => c.id === "2023-06")?.espana).toEqual({
      quirurgica: { dias: 112, tasa: 17.55 }, consultas: null,
    });
    expect(d.cortes.at(-1)?.espana).toEqual({
      quirurgica: { dias: 122, tasa: 17.70 }, consultas: { dias: 102, tasa: 84.42 },
    });
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

  it("distingue la cobertura de triple vírica de la estimación de la encuesta de cribado", () => {
    const vacuna = d.inds.find((i) => i.id === "prev_triple_virica");
    const cribado = d.inds.find((i) => i.id === "prev_cribado_colorrectal");
    if (vacuna?.grupo !== "prevencion" || cribado?.grupo !== "prevencion") throw new Error("faltan indicadores de prevención");
    expect(vacuna.fuente).toBe("sivamin");
    expect(vacuna.espana.at(-1)).toBe(93.66);
    expect(vacuna.serie.MD.at(-1)).toBe(93.97);
    expect(vacuna.serie.AR[vacuna.anios.indexOf(2020)]).toBeNull();
    expect(vacuna.serie.CE.at(-1)).toBe(70.43);
    expect(d.prevencion.vacunacion.objetivo).toBe(95);
    expect(cribado.fuente).toBe("esde");
    expect(cribado.anios).toEqual([2023, 2025]);
    expect(cribado.espana).toEqual([38.7, 50.1]);
    expect(d.prevencion.cribado.tablas[1].url).toContain("81219");
    expect(Object.keys(cribado.serie)).toHaveLength(19);
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

