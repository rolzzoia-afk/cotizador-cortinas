// El cliente de Rolzzo-Finanzas y el mapeo de sus vistas a nuestras tablas.
//
// Es LISTA BLANCA: cada campo se toma por nombre, uno por uno. Si mañana
// alguien agrega una columna de precio a la vista, no entra. Por eso en nuestra
// copia no hay plata, y por eso la pantalla de Compras se le puede mostrar al
// taller completo sin esconder nada.

/** Limpia un secret pegado a mano: espacios de sobra y comillas alrededor. */
export function limpiarSecret(v: string | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * La base del proyecto de Finanzas, venga como venga pegada.
 *
 * El panel de Supabase muestra la URL del API con el `/rest/v1` incluido, así
 * que es lo natural de copiar — y entonces la ruta salía `/rest/v1/rest/v1/…`
 * y PostgREST devolvía un 404 `PGRST125` que se leía como «la vista no existe»
 * (pasó de verdad el 2026-09-10). Se le saca el sufijo y las barras finales.
 */
export function urlBaseFinanzas(v: string): string {
  return v.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');
}

export const txt = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type ConexionFinanzas = { url: string; key: string };

/**
 * Una consulta a las vistas de Finanzas, por REST.
 *
 * Los mensajes de error se muestran en la pantalla de Compras, así que tienen
 * que decir qué hacer sin abrir la consola del navegador.
 */
export async function leerDeFinanzas(
  conexion: ConexionFinanzas,
  vista: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${urlBaseFinanzas(conexion.url)}/rest/v1/${vista}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      apikey: conexion.key,
      Authorization: `Bearer ${conexion.key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const cuerpo = await res.text();
    // Al log, para poder diagnosticarlo sin adivinar. Va el HOST y nunca la
    // llave: el cuerpo de PostgREST no la incluye.
    console.error(
      `[finanzas] ${res.status} en ${url.host}${url.pathname} → ${cuerpo.slice(0, 500)}`,
    );
    // El código de PostgREST, si el cuerpo es suyo. Un 404 puede ser tres cosas
    // muy distintas y decir la equivocada manda a correr un SQL ya corrido.
    let codigo = '';
    try {
      codigo = String((JSON.parse(cuerpo) as { code?: unknown }).code ?? '');
    } catch {
      codigo = '';
    }
    if (res.status === 404) {
      // PGRST205 = PostgREST no encuentra la relación: o no existe, o la creaste
      // y su caché de esquema no se enteró (pasa cuando el CREATE VIEW no
      // disparó el reload).
      if (codigo.startsWith('PGRST')) {
        throw new Error(
          `Finanzas no ve la vista «${vista}» (${codigo}). Si ya corriste ` +
            'sql/finanzas/20260911_bodega_contrato.sql en ese proyecto, corre ahí ' +
            "«NOTIFY pgrst, 'reload schema';» y vuelve a intentar.",
        );
      }
      // Sin cuerpo de PostgREST el 404 no viene de la base: la URL no apunta al
      // API del proyecto (el link del panel NO sirve, tiene que ser el
      // https://<ref>.supabase.co de Project Settings → API).
      throw new Error(
        `La URL de Finanzas no responde al API en «${url.host}». El secret ` +
          'FINANZAS_URL tiene que ser el Project URL (https://<ref>.supabase.co), ' +
          `no el link del panel. Contestó 404: ${cuerpo.slice(0, 200)}`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'La llave de Finanzas no sirve, fue rotada o no es la que corresponde: ' +
          `${vista} solo la lee service_role. FINANZAS_SERVICE_KEY tiene que ser ` +
          `la clave SECRETA del proyecto, no la publicable. (${res.status}${codigo ? ` ${codigo}` : ''})`,
      );
    }
    throw new Error(`Finanzas respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
  }
  return await res.json();
}

// Pedir las líneas de todas las órdenes de una vez revienta la URL: un `in`
// con más de 200 identificadores da un 414 que además no siempre se ve como
// error. Se pide de a tandas.
const TANDA = 100;

/** Las líneas de todas esas órdenes, en tandas que la URL aguante. */
export async function leerLineas(
  conexion: ConexionFinanzas,
  idsOrden: string[],
): Promise<Record<string, unknown>[]> {
  const salida: Record<string, unknown>[] = [];
  for (let i = 0; i < idsOrden.length; i += TANDA) {
    const tanda = idsOrden.slice(i, i + TANDA);
    const parte = await leerDeFinanzas(conexion, 'v_bodega_orden_lineas', {
      select: '*',
      orden_id: `in.(${tanda.map((x) => `"${x}"`).join(',')})`,
    });
    salida.push(...parte);
  }
  return salida;
}

/** La cabecera de la orden, campo por campo. Nada que no esté acá se copia. */
export function cabeceraDeOrden(o: Record<string, unknown>, empresaId: string) {
  return {
    empresa_id: empresaId,
    finanzas_id: String(o.id),
    numero: String(o.numero ?? '').trim(),
    estado_finanzas: txt(o.estado),
    anulada: o.anulada === true,
    aprobada_en: txt(o.aprobada_en),
    aprobada_por: txt(o.aprobada_por),
    fecha_emision: txt(o.fecha_emision),
    fecha_esperada: txt(o.fecha_esperada),
    proveedor_rut: txt(o.proveedor_rut),
    proveedor_nombre: txt(o.proveedor_razon_social) ?? txt(o.proveedor_nombre),
    solicitado_por: txt(o.solicitado_por),
    solicitud_ref: txt(o.solicitud_ref),
    guia: txt(o.guia),
    // Si Finanzas ya cargó la factura, su folio es otra forma de encontrar la
    // orden con el papel en la mano. Solo el folio y el tipo: el documento de
    // Finanzas tiene montos que no salen de allá.
    factura_folio: txt(o.factura_folio),
    factura_tipo: txt(o.factura_tipo),
    comentarios: txt(o.comentarios),
    sincronizada_en: new Date().toISOString(),
  };
}

/**
 * Una línea. El código interno se copia TAL CUAL, con espacios y todo
 * («DU 30»): lo normaliza la función `oc_autovincular` de nuestra base, que es
 * la que sabe cómo se escriben nuestros códigos.
 */
export function lineaDeOrden(
  l: Record<string, unknown>,
  ordenId: string,
  empresaId: string,
) {
  return {
    orden_id: ordenId,
    empresa_id: empresaId,
    finanzas_linea_id: String(l.id),
    posicion: Math.trunc(num(l.posicion)),
    codigo_interno: txt(l.codigo_interno),
    codigo_proveedor: txt(l.codigo_proveedor),
    descripcion: txt(l.descripcion),
    cantidad_pedida: num(l.cantidad),
    unidad: txt(l.unidad),
  };
}

/** El proveedor que se conoce por su RUT, que es lo único que los dos escriben igual. */
export function proveedoresDeOrdenes(
  ordenes: Record<string, unknown>[],
  empresaId: string,
): Record<string, unknown>[] {
  const porRut = new Map<string, Record<string, unknown>>();
  for (const o of ordenes) {
    const rut = txt(o.proveedor_rut);
    if (!rut || porRut.has(rut)) continue;
    porRut.set(rut, {
      empresa_id: empresaId,
      rut,
      razon_social: txt(o.proveedor_razon_social) ?? txt(o.proveedor_nombre) ?? rut,
      nombre: txt(o.proveedor_nombre),
      actualizado_en: new Date().toISOString(),
    });
  }
  return [...porRut.values()];
}

/** Los campos de plata que hayan llegado igual, para avisarlo en modo prueba. */
export function camposDePlata(ordenes: Record<string, unknown>[]): string[] {
  return [
    ...new Set(
      ordenes.flatMap((o) =>
        Object.keys(o).filter((k) => /precio|monto|total|neto|iva|costo|valor/i.test(k)),
      ),
    ),
  ];
}
