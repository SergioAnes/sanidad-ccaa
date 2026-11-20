"use client";

import { useMemo, useState } from "react";
import { BarChart3, GitCompare, Info, Database } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { MetricCard } from "@/components/MetricCard";
import {
  CCAA, INDICADORES, aniosDisponibles, formatear, mediaSimple, nombreCcaa, ranking, serie, variacionPct,
} from "@/lib/datos";
import { porcentaje } from "@/lib/formatos";

type Tab = "ranking" | "comparar" | "fuentes";

export function HomeClient() {
  const [tab, setTab] = useState<Tab>("ranking");
  const [indId, setIndId] = useState(INDICADORES[0].id);
  const indicador = INDICADORES.find((i) => i.id === indId)!;
  const anios = aniosDisponibles(indId);
  const [anio, setAnio] = useState(anios[anios.length - 1]);
  const anioSel = anios.includes(anio) ? anio : anios[anios.length - 1];
  const [ccaaA, setCcaaA] = useState("MD");
  const [ccaaB, setCcaaB] = useState("CT");

  const filas = useMemo(() => ranking(indId, anioSel), [indId, anioSel]);
  const media = mediaSimple(filas);
  const maximo = filas[0];
  const minimo = filas[filas.length - 1];
  const hayEjemplo = INDICADORES.some((i) => i.estado === "ejemplo");

  const comparacion = useMemo(() => {
    const a = serie(indId, ccaaA);
    const b = serie(indId, ccaaB);
    return a.map((p) => ({ anio: p.anio, A: p.valor, B: b.find((q) => q.anio === p.anio)?.valor }));
  }, [indId, ccaaA, ccaaB]);

  const fmt = (v: number | undefined) => formatear(v, indicador.unidad);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow">Datos abiertos · Sistema Nacional de Salud</div>
          <h1>Sanidad por comunidades</h1>
          <p>
            Compara cuánto y en qué gasta cada comunidad autónoma en sanidad pública: gasto por habitante,
            peso de los conciertos con la privada, atención primaria, farmacia…
          </p>
        </div>
        <div className="hero-card">
          <span>{indicador.nombre} · {anioSel}</span>
          <strong>{fmt(media)}</strong>
          <small>Media simple de las 17 comunidades. Máximo: {maximo?.nombre} ({fmt(maximo?.valor)}).</small>
        </div>
      </section>

      {hayEjemplo ? (
        <div className="warning">
          <strong>Datos de ejemplo.</strong> Los valores que ves son ficticios y sirven solo para construir la web.
          Hay que sustituirlos por los datos oficiales del Ministerio de Sanidad antes de publicarla.
        </div>
      ) : null}

      <nav className="tabs">
        <button className={tab === "ranking" ? "active" : ""} onClick={() => setTab("ranking")}>
          <BarChart3 size={16} /> Ranking
        </button>
        <button className={tab === "comparar" ? "active" : ""} onClick={() => setTab("comparar")}>
          <GitCompare size={16} /> Comparar dos CCAA
        </button>
        <button className={tab === "fuentes" ? "active" : ""} onClick={() => setTab("fuentes")}>
          <Database size={16} /> Fuentes
        </button>
      </nav>

      <section className="panel">
        {tab !== "fuentes" ? (
          <div className={`controls ${tab === "ranking" ? "grid-2" : "grid-3"}`}>
            <label>
              Indicador
              <select value={indId} onChange={(e) => setIndId(e.target.value)}>
                {INDICADORES.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </label>
            {tab === "ranking" ? (
              <label>
                Año
                <select value={anioSel} onChange={(e) => setAnio(Number(e.target.value))}>
                  {anios.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Comunidad A
                  <select value={ccaaA} onChange={(e) => setCcaaA(e.target.value)}>
                    {CCAA.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Comunidad B
                  <select value={ccaaB} onChange={(e) => setCcaaB(e.target.value)}>
                    {CCAA.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        ) : null}

        {tab === "ranking" ? (
          <>
            <div className="section-title">
              <h2>{indicador.nombre}, {anioSel}</h2>
              <p><Info size={14} /> {indicador.descripcion}</p>
            </div>
            <div className="metrics">
              <MetricCard label="Media CCAA" value={fmt(media)} />
              <MetricCard label="Máximo" value={fmt(maximo?.valor)} hint={maximo?.nombre} />
              <MetricCard label="Mínimo" value={fmt(minimo?.valor)} hint={minimo?.nombre} />
              <MetricCard
                label="Distancia máx./mín."
                value={maximo && minimo ? porcentaje(variacionPct(minimo.valor, maximo.valor)) : "—"}
                hint="Cuánto más alto es el máximo que el mínimo"
              />
            </div>
            <div className="chart tall">
              <ResponsiveContainer width="100%" height={520}>
                <BarChart data={filas} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => fmt(v)} />
                  <YAxis type="category" dataKey="nombre" width={140} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <ReferenceLine x={media} stroke="#b42318" strokeDasharray="4 4" label={{ value: "media", position: "top" }} />
                  <Bar dataKey="valor" name={indicador.nombre} radius={[0, 6, 6, 0]}>
                    {filas.map((f) => (
                      <Cell key={f.ccaa} fill={f.ccaa === ccaaA || f.ccaa === ccaaB ? "#1d4ed8" : "#93b4f5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : null}

        {tab === "comparar" ? (
          <>
            <div className="section-title">
              <h2>{nombreCcaa(ccaaA)} frente a {nombreCcaa(ccaaB)}</h2>
              <p>{indicador.nombre}, evolución anual.</p>
            </div>
            <div className="chart tall">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={comparacion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="anio" />
                  <YAxis tickFormatter={(v: number) => fmt(v)} width={90} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="A" name={nombreCcaa(ccaaA)} stroke="#1d4ed8" strokeWidth={3} />
                  <Line type="monotone" dataKey="B" name={nombreCcaa(ccaaB)} stroke="#0f8a5f" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Año</th><th>{nombreCcaa(ccaaA)}</th><th>{nombreCcaa(ccaaB)}</th></tr>
                </thead>
                <tbody>
                  {comparacion.map((r) => (
                    <tr key={r.anio}>
                      <td>{r.anio}</td>
                      <td>{fmt(r.A)}</td>
                      <td>{fmt(r.B)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {tab === "fuentes" ? (
          <div className="prose">
            <h2>Fuentes y estado de los datos</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Indicador</th><th>Fuente</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {INDICADORES.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nombre}</td>
                      <td><a href={i.url} target="_blank" rel="noreferrer">{i.fuente}</a></td>
                      <td>{i.estado === "oficial" ? "Oficial" : "Ejemplo (pendiente)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Las medias son simples (cada comunidad cuenta igual), no ponderadas por población.</p>
          </div>
        ) : null}
      </section>

      <footer>
        <span>Proyecto abierto · datos públicos</span>
        <span>Hecho con Next.js y Recharts</span>
      </footer>
    </main>
  );
}
