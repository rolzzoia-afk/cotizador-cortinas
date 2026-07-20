// Tela efectiva de un paño. Una cortina DUAL (roller doble tela) guarda la tela
// de cada roller EN el paño (codInt/producto/descripcion); rollers y dúos
// normales llevan la tela a nivel VENTANA y dejan esos campos del paño vacíos.
// telaDePano unifica ambos casos con fallback campo a campo a la ventana, así
// todo el pipeline (optimizador, hojas, etiquetas, cotización) puede leer la
// tela por paño sin ramas especiales.
export type TelaPano = { codInt: string; producto: string; descripcion: string };

/** Fuente laxa (Ventana/VentanaItem o Pano) con los campos de tela. */
type ConTela = {
  codInt?: string | null;
  producto?: string | null;
  descripcion?: string | null;
};

export function telaDePano(v: ConTela, p: ConTela): TelaPano {
  return {
    codInt: p.codInt ?? v.codInt ?? '',
    producto: p.producto ?? v.producto ?? '',
    descripcion: p.descripcion ?? v.descripcion ?? '',
  };
}
