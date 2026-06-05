// ─────────────────────────────────────────────────────────────────────
// Tipos DB (forma de las filas en Supabase) + funciones puras que las
// convierten al formato que esperan los componentes de UI.
//
// Vive en utils/ porque son funciones puras sin estado ni efectos.
// Todo lo que toca BD usa estos mappers, todo lo que toca UI lee
// InventoryItem / DiscountHistoryEntry / CompanyProfile (los tipos
// públicos definidos en ../types.ts).
// ─────────────────────────────────────────────────────────────────────

import type { CompanyProfile, DiscountHistoryEntry, InventoryItem } from '../types';

export type RolloDB = {
  id: string;
  empresa_id: string;
  cod: string;
  producto: string;
  cod_int: string;
  tipo: string | null;
  descripcion: string | null;
  proveedor: string | null;
  tela_verticales: 'SI' | 'NO';
  descuento_pct: number;
  rollos: number;
  metros_x_rollo: number;
  total_metros: number;
  metros_originales: number;
  comentario: string | null;
  activo: boolean;
};

export type MovimientoDB = {
  id: string;
  rollo_id: string;
  tipo: 'DESCUENTO' | 'INCREMENTO' | 'EDICION_STOCK';
  cantidad_metros: number | null;
  anterior_metros: number | null;
  nuevo_metros: number | null;
  anterior_rollos: number | null;
  nuevo_rollos: number | null;
  comentario: string | null;
  vendedor_email: string;
  fecha: string;
};

export type PerfilDB = {
  empresa_id: string;
  razon_social: string;
  rut: string | null;
  instagram: string | null;
  pagina_web: string | null;
  direccion: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

// Convertir DB row a InventoryItem (lo que espera la UI original).
export function rolloDBToItem(r: RolloDB): InventoryItem {
  return {
    id: r.id,
    cod: r.cod,
    producto: r.producto,
    cod_int: r.cod_int,
    tipo: r.tipo || '',
    descripcion: r.descripcion || '',
    telaVerticales: r.tela_verticales,
    descuento: `${Math.round(r.descuento_pct * 100)}%`,
    rollos: r.rollos,
    metros: r.metros_x_rollo,
    totalMetros: r.total_metros,
    metrosOriginales: r.metros_originales ?? r.total_metros,
    comentario: r.comentario || '',
  };
}

// Convertir movimiento DB a entrada de historial. Necesita el mapa de
// rollos para enriquecer la fila con nombre / código que la UI muestra.
export function movDBToEntry(m: MovimientoDB, rolloMap: Map<string, RolloDB>): DiscountHistoryEntry {
  const r = rolloMap.get(m.rollo_id);
  return {
    id: m.id,
    itemId: m.rollo_id,
    producto: r?.producto || '',
    cod_int: r?.cod_int || '',
    descripcion: r?.descripcion || '',
    cantidadMetros: m.cantidad_metros || 0,
    anteriorMetros: m.anterior_metros || 0,
    nuevoMetros: m.nuevo_metros || 0,
    tipoAccion:
      m.tipo === 'EDICION_STOCK' ? 'INCREMENTO' : (m.tipo as 'DESCUENTO' | 'INCREMENTO'),
    fecha: m.fecha,
    comentario:
      m.tipo === 'EDICION_STOCK'
        ? `[EDICIÓN] ${m.comentario || ''} (rollos: ${m.anterior_rollos}→${m.nuevo_rollos})`
        : m.comentario || '',
  };
}

// Convertir perfil DB a CompanyProfile.
export function perfilDBToProfile(p: PerfilDB): CompanyProfile {
  return {
    razonSocial: p.razon_social,
    rut: p.rut || '',
    instagram: p.instagram || '',
    paginaWeb: p.pagina_web || '',
    direccion: p.direccion || '',
    logoUrl: p.logo_url,
    bannerUrl: p.banner_url,
  };
}
