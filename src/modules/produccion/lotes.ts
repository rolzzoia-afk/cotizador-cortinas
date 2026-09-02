// ─────────────────────────────────────────────────────────────────────
// La cola de producción y los lotes de OTs. Módulo PURO: sin React ni
// Supabase, para poder probar las reglas sin montar nada.
//
// Cola   = lo que hay HOY en el taller (OTs en estado 'produccion'), agrupado
//          por sub-etapa para que se vea dónde está cada una.
// Lote   = varias OTs que el jefe decidió cortar juntas. Su único efecto es
//          acotar el plan de corte de TELA a esas OTs; no mueve estados, no
//          toca el flujo de tubos y no cambia ninguna ficha.
// ─────────────────────────────────────────────────────────────────────

import { SUB_ETAPA_META } from '@/modules/cotizador/fase4';
import type { DatosGenerales, SubEtapaProd } from '@/modules/ots/types';

// ── La cola ──────────────────────────────────────────────────────────

/** Una OT en la cola del taller, con lo justo para la tarjeta. */
export type ItemCola = {
  /** uuid de la OT: es la llave con la que el lote la referencia. */
  id: string;
  /** Lo que se MUESTRA (`datos_generales.ot`, o el número de la columna). */
  numero: string;
  /**
   * El `numero_ot` CRUDO de la columna. Es el que hay que pasarle al buscador:
   * `useOTPorNumero` compara con `.eq('numero_ot', …)`, o sea match exacto
   * contra la columna. Muchas veces es igual a `numero`, pero no siempre.
   */
  numeroOt: string;
  cliente: string;
  subEtapa: SubEtapaProd | null;
  /** ISO o null. Se muestra recortada a la fecha. */
  fechaEntrega: string | null;
  /** Todavía no se confirmó el corte general de tela de esta OT. */
  sinCorteTela: boolean;
};

/** La fila liviana que pide la cola (no la OT completa: son cientos). */
export type FilaCola = {
  id: string;
  numero_ot: string | null;
  datos_generales: unknown;
  fecha_entrega: string | null;
};

/**
 * Pasa una fila de `ots` a un ítem de cola. Devuelve `null` para las OTs
 * huérfanas —sin cliente y sin número en datos_generales—, el MISMO criterio
 * que usan el Panel y el plan de corte para no mostrar fantasmas.
 */
export function rowACola(fila: FilaCola): ItemCola | null {
  const dg = (fila?.datos_generales || {}) as DatosGenerales;
  const numeroOt = String(fila?.numero_ot || '').trim();
  const otDg = (dg.ot || '').trim();
  const cliente = (dg.cliente || '').trim();
  if (!cliente && !otDg) return null;

  return {
    id: String(fila.id),
    numero: otDg || numeroOt || String(fila.id).slice(-6),
    numeroOt,
    cliente: cliente || '—',
    subEtapa: (dg.subEtapa as SubEtapaProd | null) ?? null,
    fechaEntrega: fila.fecha_entrega ?? dg.fechaEntrega ?? null,
    // El corte general de tela deja su huella en la OT (guard de idempotencia
    // de Fase 4). Sin ella, la tela de esta OT todavía no bajó del rollo.
    sinCorteTela: !dg.corteGeneralColmena,
  };
}

export type GrupoCola = { subEtapa: SubEtapaProd | null; items: ItemCola[] };

/** Dónde va cada sub-etapa en la cola; lo que no se reconoce, al final. */
function ordenSubEtapa(s: SubEtapaProd | null): number {
  if (!s) return 999;
  return SUB_ETAPA_META[s]?.orden ?? 999;
}

/**
 * La cola agrupada por sub-etapa, en el orden real del taller (Estructura →
 * Paños → Dimensionado → Armado → Prueba → Lista) y, dentro de cada grupo, por
 * fecha de entrega: primero lo que vence antes. Lo que no tiene fecha va al
 * final del grupo (no es urgente por no tener fecha, es que nadie la puso).
 */
export function ordenarCola(items: ItemCola[]): GrupoCola[] {
  const grupos = new Map<string, GrupoCola>();
  for (const it of items) {
    const clave = it.subEtapa ?? '';
    let g = grupos.get(clave);
    if (!g) {
      g = { subEtapa: it.subEtapa ?? null, items: [] };
      grupos.set(clave, g);
    }
    g.items.push(it);
  }
  const salida = [...grupos.values()];
  salida.sort((a, b) => ordenSubEtapa(a.subEtapa) - ordenSubEtapa(b.subEtapa));
  for (const g of salida) {
    g.items.sort((a, b) => {
      if (a.fechaEntrega && b.fechaEntrega) {
        if (a.fechaEntrega !== b.fechaEntrega) return a.fechaEntrega < b.fechaEntrega ? -1 : 1;
      } else if (a.fechaEntrega) return -1;
      else if (b.fechaEntrega) return 1;
      return a.numero.localeCompare(b.numero, 'es', { numeric: true });
    });
  }
  return salida;
}

// ── Los lotes ────────────────────────────────────────────────────────

/**
 * Una OT dentro de un lote: el uuid manda (filtra el plan), `numero` es lo que
 * se muestra y `numeroOt` es el de la COLUMNA, el único con el que el buscador
 * de Producción sabe abrirla (compara exacto contra `numero_ot`).
 */
export type LoteOtRef = { id: string; numero: string; numeroOt: string };

export type LoteProduccion = {
  id: string;
  nombre: string;
  ots: LoteOtRef[];
  creadoPor: string;
  creadoEn: string | null;
};

/**
 * Lee una fila de `lotes_produccion`. La tabla es nueva y no está en los tipos
 * generados, así que la fila llega como `unknown`: acá se valida de verdad y
 * cualquier cosa rara se descarta en vez de reventar la pantalla del taller.
 */
export function parseLoteRow(fila: unknown): LoteProduccion | null {
  if (!fila || typeof fila !== 'object') return null;
  const f = fila as Record<string, unknown>;
  const id = String(f.id || '').trim();
  const nombre = String(f.nombre || '').trim();
  if (!id || !nombre) return null;

  const crudas = Array.isArray(f.ots) ? f.ots : [];
  const ots: LoteOtRef[] = [];
  for (const o of crudas) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const otId = String(r.id || '').trim();
    if (!otId) continue;
    const numero = String(r.numero || '').trim() || otId.slice(-6);
    // Los primeros lotes se guardaron sin `numeroOt`: ahí el número que se
    // muestra es lo único que hay, y en la mayoría de las OTs coincide.
    ots.push({ id: otId, numero, numeroOt: String(r.numeroOt || '').trim() || numero });
  }

  return {
    id,
    nombre,
    ots,
    creadoPor: String(f.creado_por || '').trim(),
    creadoEn: typeof f.creado_en === 'string' ? f.creado_en : null,
  };
}

export type ResumenLote = {
  total: number;
  /** OTs del lote que ya NO están en producción: no entran al plan de tela. */
  fuera: LoteOtRef[];
  /** OTs del lote que todavía no cortan tela. */
  sinCorteTela: number;
};

/**
 * Qué queda del lote contra la cola de HOY. Una OT que salió de producción no
 * se borra de la referencia (el lote es historia de una decisión), pero se
 * rotula: el plan de tela no la va a incluir.
 */
export function resumenLote(lote: LoteProduccion, cola: ItemCola[]): ResumenLote {
  const enCola = new Map(cola.map((i) => [i.id, i]));
  const fuera: LoteOtRef[] = [];
  let sinCorteTela = 0;
  for (const ref of lote.ots) {
    const it = enCola.get(ref.id);
    if (!it) {
      fuera.push(ref);
      continue;
    }
    if (it.sinCorteTela) sinCorteTela += 1;
  }
  return { total: lote.ots.length, fuera, sinCorteTela };
}
