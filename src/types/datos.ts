export type Unidad = "eur_hab" | "pct" | "eur_mill" | "num" | "por_mil" | "dias" | "nota10" | "dias_media" | "personas";

export type Ccaa = {
  id: string;
  nombre: string;
};

export type Indicador = {
  id: string;
  nombre: string;
  unidad: Unidad;
  descripcion: string;
  fuente: string;
  url: string;
  /** "ejemplo" = valores ficticios para maquetar; "oficial" = cargados de la fuente */
  estado: "ejemplo" | "oficial";
  /** true si un valor más alto no es necesariamente "mejor" (solo informativo) */
  neutral?: boolean;
};

/** Formato largo: una fila por indicador + CCAA + año. Fácil de generar desde CSV. */
export type Valor = {
  indicador: string;
  ccaa: string;
  anio: number;
  valor: number;
  /** true si la fuente marca la cifra como provisional (p. ej. "2023(*)" en la EGSP) */
  provisional?: boolean;
};
