"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { formatear } from "@/lib/datos";
import {
  LISTAS, mediaSimple, nombreCorte, nombreMedida, rankingLista, tablaResumen, unidadMedida,
  type MedidaLista, type TipoLista,
} from "@/lib/listas";

// Escala secuencial azul (un solo tono, claro -> oscuro) para la tabla resumen.
// Se omiten los dos tonos intermedios (#3987e5, #2a78d6) porque ni el texto oscuro ni el
// blanco alcanzan 4,5:1 sobre ellos. Así todas las celdas tienen contraste >= 5,4:1.
const RAMPA = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
const PRIMER_PASO_OSCURO = 6; // a partir de aquí el texto va en blanco
const NOMBRE_CORTO: Record<TipoLista, string> = {
  quirurgica: "Quirúrgica por especialidad",
  procesos: "Quirúrgica por procesos",
  consultas: "Consultas con el especialista",
};

function colorCelda(intensidad: number): { background: string; color: string } {
  const i = Math.round(intensidad * (RAMPA.length - 1));
  return { background: RAMPA[i], color: i >= PRIMER_PASO_OSCURO ? "#ffffff" : "#172033" };
}

export function ListasEspera() {
  const cortes = LISTAS.cortes;
  const [corte, setCorte] = useState(cortes[cortes.length - 1]);
  const [tipo, setTipo] = useState<TipoLista>("quirurgica");
  const [campo, setCampo] = useState("total");
  const [medida, setMedida] = useState<MedidaLista>("tasa");
  const [conCiudades, setConCiudades] = useState(false);

  const tipoInfo = LISTAS.tipos.find((t) => t.id === tipo)!;
  const campoSel = tipoInfo.campos.some((c) => c.id === campo) ? campo : "total";
  const nombreCampo = tipoInfo.campos.find((c) => c.id === campoSel)?.nombre ?? campoSel;
  const unidad = unidadMedida(medida);
  const fmt = (v: number | undefined) => formatear(v, unidad);
  const filtro = { corte, tipo, medida, conCiudades };

  const filas = useMemo(
    () => rankingLista({ corte, tipo, medida, conCiudades, campo: campoSel }),
    [corte, tipo, medida, conCiudades, campoSel],
  );
  const resumen = useMemo(() => tablaResumen({ corte, tipo, medida, conCiudades }), [corte, tipo, medida, conCiudades]);
  const media = mediaSimple(filas);
  const maximo = filas[0];
  const minimo = filas[filas.length - 1];
  const territorios = conCiudades ? "las 17 comunidades, Ceuta y Melilla" : "las 17 comunidades";

  return (
    <>
      <div className="controls grid-4">
        <label>
          Lista
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLista)}>
            {LISTAS.tipos.map((t) => (
              <option key={t.id} value={t.id}>{NOMBRE_CORTO[t.id]}</option>
            ))}
          </select>
        </label>
        <label>
          {tipo === "procesos" ? "Proceso" : "Especialidad"}
          <select value={campoSel} onChange={(e) => setCampo(e.target.value)}>
            {tipoInfo.campos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Medida
          <select value={medida} onChange={(e) => setMedida(e.target.value as MedidaLista)}>
            {LISTAS.medidas.map((m) => (
              <option key={m.id} value={m.id}>{nombreMedida(m.id, tipo)}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <select value={corte} onChange={(e) => setCorte(e.target.value)} disabled={cortes.length < 2}>
            {cortes.map((c) => (
              <option key={c} value={c}>{nombreCorte(c)}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={conCiudades} onChange={(e) => setConCiudades(e.target.checked)} />
        Incluir Ceuta y Melilla
      </label>

      <div className="section-title">
        <h2>{tipoInfo.nombre}: {nombreCampo}</h2>
        <p><Info size={14} /> {nombreMedida(medida, tipo)}, a {nombreCorte(corte)}.</p>
      </div>
      <div className="metrics">
        <MetricCard label="Media" value={fmt(media)} hint={`Media simple de ${territorios} con dato`} />
        <MetricCard label="Máximo" value={fmt(maximo?.valor)} hint={maximo?.nombre} />
        <MetricCard label="Mínimo" value={fmt(minimo?.valor)} hint={minimo?.nombre} />
        <MetricCard label="Con dato" value={String(filas.length)} hint="Territorios con valor en el informe" />
      </div>
      <div className="chart tall">
        <ResponsiveContainer width="100%" height={Math.max(260, filas.length * 26 + 40)}>
          <BarChart data={filas} layout="vertical" margin={{ left: 30, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => fmt(v)} />
            <YAxis type="category" dataKey="nombre" width={140} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <ReferenceLine x={media} stroke="#b42318" strokeDasharray="4 4" label={{ value: "media", position: "top" }} />
            <Bar dataKey="valor" name={nombreMedida(medida, tipo)} fill="#2a78d6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title">
        <h2>Resumen por {tipo === "procesos" ? "proceso" : "especialidad"}</h2>
        <p>
          {nombreMedida(medida, tipo)}. El color se compara dentro de cada columna: más oscuro = valor más alto de
          esa {tipo === "procesos" ? "columna" : "especialidad"}. Pulsa una columna para verla en el ranking.
        </p>
      </div>
      <div className="table-scroll">
        <table className="heatmap">
          <thead>
            <tr>
              <th>Territorio</th>
              {resumen.campos.map((c) => (
                <th key={c.id} className={c.id === campoSel ? "sel" : ""}>
                  <button type="button" onClick={() => setCampo(c.id)}>{c.nombre}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumen.filas.map((f) => (
              <tr key={f.ccaa}>
                <th scope="row">{f.nombre}</th>
                {f.celdas.map((c, i) => {
                  const campoCelda = resumen.campos[i];
                  return c.valor === undefined ? (
                    <td key={campoCelda.id} className="vacia" title={`${f.nombre} · ${campoCelda.nombre}: sin dato`}>—</td>
                  ) : (
                    <td
                      key={campoCelda.id}
                      style={colorCelda(c.intensidad ?? 0)}
                      title={`${f.nombre} · ${campoCelda.nombre}: ${fmt(c.valor)}`}
                      onClick={() => setCampo(campoCelda.id)}
                    >
                      {fmt(c.valor)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose notas">
        <h3>Cómo leer estos datos</h3>
        <ul>
          <li>
            <strong>Pacientes en espera estructural:</strong> los que esperan por la organización y los recursos del
            sistema. No incluye a quienes han pedido aplazar la intervención o la cita ni a quienes no pueden ser
            atendidos temporalmente por motivos clínicos.
          </li>
          <li>
            <strong>Tiempo medio:</strong> días que llevan esperando, de media, los pacientes que están en la lista en
            la fecha del corte.
          </li>
          {tipo === "consultas" ? (
            <>
              <li>
                El <strong>total de consultas</strong> incluye especialidades que el informe no desglosa, por eso es
                mayor que la suma de las diez columnas.
              </li>
              <li>El % de más de 60 días incluye a pacientes sin cita asignada que ya superaban ese plazo.</li>
            </>
          ) : null}
          {tipo === "procesos" ? (
            <li>
              El <strong>total de procesos seleccionados</strong> suma los once primeros (RD 605/2003). Prótesis de
              rodilla, cirugía cardiaca valvular, by-pass coronario e histerectomía se publican aparte y no entran en
              ese total.
            </li>
          ) : null}
          <li>«—» significa que el informe no da dato para esa casilla.</li>
          <li>
            Fuente: <a href={LISTAS.url} target="_blank" rel="noreferrer">{LISTAS.fuente}</a>, situación a{" "}
            {nombreCorte(corte)}.
          </li>
        </ul>
      </div>
    </>
  );
}
