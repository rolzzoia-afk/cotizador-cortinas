// ─────────────────────────────────────────────────────────────────────
// LOS BLOQUES FIJOS DEL INFORME CLIENTE.
//
// El correo de COTIZACIÓN FINAL cierra con textos que se repiten en TODAS las
// visitas: el corte de rodapié, que la medida considera los mecanismos, las
// preguntas de term panel / aire / rack, el límite de perforación, y el aviso
// largo de los sistemas de oscuridad.
//
// Estos textos NO los escribe la IA: son compromisos comerciales redactados por
// la empresa, y un modelo parafraseándolos cambiaría lo que el cliente acepta.
// La app los pega tal cual al final del informe.
//
// Se editan en Admin como el resumen de visita. El bloque de oscuridad lleva
// `condicion: 'oscuridad'` para no aparecer en una orden que solo trae roller.
//
// Un bloque puede llevar fotos: bajan como líneas `[foto: …]` debajo del texto
// y al copiar el informe se convierten en `<img>` (ver `imagenesInforme.ts`).
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import { normalizarFotos, textoConFotos } from './imagenesInforme';

/** Cuándo entra un bloque al informe. */
export type CondicionBloque = 'siempre' | 'oscuridad';

export type BloqueInforme = {
  /** Estable: identifica el bloque al editarlo en Admin. */
  id: string;
  /** Encabezado opcional (va en su propia línea antes del texto). */
  titulo?: string;
  texto: string;
  /**
   * URLs públicas de las fotos que acompañan al bloque, en el orden en que van
   * al correo. Bajan como líneas `[foto: …]` debajo del texto — ver
   * `imagenesInforme.ts`.
   */
  fotos?: string[];
  orden: number;
  activo: boolean;
  condicion: CondicionBloque;
};

export type BloquesInforme = { bloques: BloqueInforme[] };

/** Los del correo real, tal como se mandan hoy. */
export const BLOQUES_INFORME_DEFAULT: BloquesInforme = {
  bloques: [
    {
      id: 'rodapie',
      titulo: '',
      texto:
        'El día de la instalación (en caso de ser necesario) se cortarán rodapié o guardapolvos ' +
        'para evitar un poco más el paso de luz por los laterales; esto será informado ' +
        'previamente por los instaladores a la persona encargada.',
      orden: 1,
      activo: true,
      condicion: 'siempre',
    },
    {
      id: 'medida-mecanismos',
      titulo: '',
      texto:
        'La medida de la cortina considera los mecanismos y/o cenefas: la tela nunca quedará del ' +
        'tamaño que se indica en la cotización, debido a los descuentos que se realizan para que ' +
        'los mecanismos funcionen correctamente.',
      orden: 2,
      activo: true,
      condicion: 'siempre',
    },
    {
      id: 'cambios-en-la-casa',
      titulo: '',
      texto:
        'Por favor indícanos si cambiarás ventanas a termopanel próximamente, si instalarás un ' +
        'aire acondicionado o si instalarás un rack o mueble. Cualquiera de estas condiciones ' +
        'puede cambiar las medidas de las cortinas y por ende acarrear costos adicionales.',
      orden: 3,
      activo: true,
      condicion: 'siempre',
    },
    {
      id: 'limite-perforacion',
      titulo: '',
      texto:
        'Indícanos siempre el límite de perforación que permite tu inmobiliaria; lo puedes ver en ' +
        'el acta de entrega.',
      orden: 4,
      activo: true,
      condicion: 'siempre',
    },
    {
      id: 'sistemas-oscuridad',
      titulo:
        'Solo en caso de tener Sistemas de Oscuridad (Soft Light, Dark Roller, Oscuranti o ' +
        'BeeBlack) debes considerar lo siguiente:',
      texto:
        'Para generar el % de oscuridad indicado en la cotización se instalan perfiles laterales ' +
        'y/o cenefa que se le agregan a la cortina roller blackout. La misma se debe empastar ' +
        'entre el perfil, el muro y/o techo para que los desniveles y la separación sean ' +
        'cubiertas, evitando el paso de luz por los laterales y la parte superior. Para ello ' +
        'utilizamos Acrílico Siliconado de color blanco, negro, gris o café (colores estándar). ' +
        'En caso de requerir un color especial, deberás indicarlo a la inmobiliaria, que es quien ' +
        'tiene el código de esos colores especiales y quien debe proveer el silicón con el código ' +
        'y la marca de la pintura; en caso contrario, en Cortinas Rolzzo utilizaremos los colores ' +
        'estándar antes mencionados.\n\n' +
        'Al realizar el empastado siempre vamos a utilizar cinta de enmascarar y/o masking tape ' +
        'de 48 mm o menos, para que quede sellado de forma correcta. Debes considerar que al ' +
        'retirarla se puede venir un % de la pintura; en caso de suceder, se debe a que al pintar ' +
        'inicialmente la pared o el techo no hubo un proceso de secado correcto habiendo humedad, ' +
        'por lo que el cliente deberá comunicarse con su inmobiliaria para el retoque de la misma.',
      orden: 5,
      activo: true,
      condicion: 'oscuridad',
    },
  ],
};

const txt = (v: unknown): string => String(v ?? '').trim();

/** Un id utilizable: minúsculas, sin espacios ni acentos. */
export function idDeBloque(titulo: string): string {
  return txt(titulo)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Deja los bloques guardados en forma usable: descarta los vacíos, resuelve ids
 * repetidos y renumera. Nunca lanza: una configuración corrupta cae a los de
 * fábrica — el informe nunca debe quedarse sin sus compromisos comerciales.
 */
export function normalizarBloquesInforme(raw: unknown): BloquesInforme {
  const lista = Array.isArray((raw as BloquesInforme)?.bloques)
    ? (raw as BloquesInforme).bloques
    : Array.isArray(raw)
      ? (raw as BloqueInforme[])
      : null;
  if (!lista) return BLOQUES_INFORME_DEFAULT;

  const vistos = new Set<string>();
  const bloques: BloqueInforme[] = [];
  for (const b of lista) {
    if (!b || typeof b !== 'object') continue;
    const texto = txt(b.texto);
    const titulo = txt(b.titulo);
    // Un bloque sin texto no aporta nada al informe, aunque tenga título.
    if (!texto) continue;
    let id = txt(b.id) || idDeBloque(titulo || texto);
    if (!id) continue;
    if (vistos.has(id)) {
      let n = 2;
      while (vistos.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    vistos.add(id);
    bloques.push({
      id,
      titulo: titulo || undefined,
      texto,
      fotos: normalizarFotos(b.fotos),
      orden: Number.isFinite(b.orden) ? Number(b.orden) : bloques.length + 1,
      activo: b.activo !== false,
      condicion: b.condicion === 'oscuridad' ? 'oscuridad' : 'siempre',
    });
  }
  if (bloques.length === 0) return BLOQUES_INFORME_DEFAULT;
  bloques.sort((a, b) => a.orden - b.orden);
  return { bloques: bloques.map((b, i) => ({ ...b, orden: i + 1 })) };
}

/** Los bloques que entran a ESTE informe, en orden. */
export function bloquesActivos(c: BloquesInforme, hayOscuridad: boolean): BloqueInforme[] {
  return c.bloques
    .filter((b) => b.activo && (b.condicion === 'siempre' || hayOscuridad))
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Cada bloque aplicable como su propio texto (título + cuerpo + fotos).
 *
 * En lista y no unidos, porque el bloque de oscuridad tiene DOS párrafos: quien
 * quiera separarlos otra vez no puede partir por la línea en blanco.
 */
export function textosBloques(c: BloquesInforme, hayOscuridad: boolean): string[] {
  return bloquesActivos(c, hayOscuridad).map((b) =>
    textoConFotos(b.titulo ? `${b.titulo}\n${b.texto}` : b.texto, b.fotos),
  );
}

/** El texto que se pega al final del informe (vacío si no aplica ninguno). */
export function textoBloques(c: BloquesInforme, hayOscuridad: boolean): string {
  return textosBloques(c, hayOscuridad).join('\n\n');
}

/** Mueve un bloque un lugar arriba o abajo, renumerando el orden. */
export function moverBloque(c: BloquesInforme, id: string, delta: -1 | 1): BloquesInforme {
  const lista = [...c.bloques].sort((a, b) => a.orden - b.orden);
  const i = lista.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return c;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return { bloques: lista.map((b, k) => ({ ...b, orden: k + 1 })) };
}
