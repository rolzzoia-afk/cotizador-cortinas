// ─────────────────────────────────────────────────────────────────────
// Hook de datos para el módulo "Inventario de Telas (PRUEBA)".
// Conecta con Supabase para persistir rollos, movimientos y perfil
// empresa. Reemplaza el localStorage que tenía la app original.
//
// Tablas usadas:
//   - inv_rollos: catálogo de rollos en oferta
//   - inv_movimientos: historial de descuentos/incrementos/ediciones
//   - inv_empresa_perfil: razón social, logo, banner, etc.
//   - inv_permisos: emails autorizados para entrar al módulo
//
// Storage:
//   - inv-empresa-assets: bucket público para logo y banner
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { InventoryItem, CompanyProfile, DiscountHistoryEntry } from './types';

type RolloDB = {
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

type MovimientoDB = {
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

type PerfilDB = {
  empresa_id: string;
  razon_social: string;
  rut: string | null;
  instagram: string | null;
  pagina_web: string | null;
  direccion: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

// Convertir DB row a InventoryItem (lo que espera la UI original)
function rolloDBToItem(r: RolloDB): InventoryItem {
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

function movDBToEntry(m: MovimientoDB, rolloMap: Map<string, RolloDB>): DiscountHistoryEntry {
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

function perfilDBToProfile(p: PerfilDB): CompanyProfile {
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

// ── Estado del permiso del usuario ───────────────────────────────────
export type PermisoInfo = {
  loading: boolean;
  tieneAcceso: boolean;
  rol: 'editor' | 'lectura' | 'admin' | null;
  email: string | null;
  empresaId: string | null;
};

export function usePermisoInventario(): PermisoInfo {
  const { perfil } = useAuth();
  const [state, setState] = useState<PermisoInfo>({
    loading: true,
    tieneAcceso: false,
    rol: null,
    email: null,
    empresaId: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Obtener email del usuario logueado
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase().trim() || null;
      const empresaId = perfil?.empresa_id || null;

      if (!email || !empresaId) {
        if (!cancelled) setState({ loading: false, tieneAcceso: false, rol: null, email, empresaId });
        return;
      }

      // Consultar permiso
      const { data, error } = await (supabase as any).from('inv_permisos')
        .select('rol, activo')
        .eq('empresa_id', empresaId)
        .ilike('email', email)
        .eq('activo', true)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setState({ loading: false, tieneAcceso: false, rol: null, email, empresaId });
      } else {
        setState({ loading: false, tieneAcceso: true, rol: data.rol as PermisoInfo['rol'], email, empresaId });
      }
    }
    check();
    return () => { cancelled = true; };
  }, [perfil?.empresa_id]);

  return state;
}

// ── Hook principal de datos ──────────────────────────────────────────
export function useInventarioSupabase(empresaId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [historyLogs, setHistoryLogs] = useState<DiscountHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollosRaw, setRollosRaw] = useState<RolloDB[]>([]);

  const refresh = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const [rollosRes, perfilRes, movsRes] = await Promise.all([
      (supabase as any).from('inv_rollos').select('*').eq('empresa_id', empresaId).eq('activo', true).order('cod_int'),
      (supabase as any).from('inv_empresa_perfil').select('*').eq('empresa_id', empresaId).maybeSingle(),
      (supabase as any).from('inv_movimientos').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false }).limit(500),
    ]);

    const rollos = (rollosRes.data as RolloDB[]) || [];
    setRollosRaw(rollos);
    setItems(rollos.map(rolloDBToItem));

    if (perfilRes.data) {
      setProfile(perfilDBToProfile(perfilRes.data as PerfilDB));
    }

    const rolloMap = new Map(rollos.map((r) => [r.id, r]));
    setHistoryLogs(((movsRes.data as MovimientoDB[]) || []).map((m) => movDBToEntry(m, rolloMap)));
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Ajuste de stock (descuento/incremento) ─────────────────────────
  const ajustarStock = useCallback(
    async (
      itemId: string,
      meters: number,
      tipo: 'DESCUENTO' | 'INCREMENTO',
      comentario: string,
      vendedorEmail: string,
    ) => {
      const rollo = rollosRaw.find((r) => r.id === itemId);
      if (!rollo) throw new Error('Rollo no encontrado');

      const previo = rollo.total_metros;
      const nuevo = tipo === 'DESCUENTO' ? Math.max(0, previo - meters) : previo + meters;
      const nuevosRollos =
        rollo.metros_x_rollo > 0 ? Math.ceil(nuevo / rollo.metros_x_rollo) : rollo.rollos;

      const { error: upErr } = await (supabase as any).from('inv_rollos')
        .update({
          total_metros: parseFloat(nuevo.toFixed(2)),
          rollos: nuevosRollos,
          comentario: nuevo === 0 ? 'STOCK LIMITADO' : rollo.comentario,
        })
        .eq('id', itemId);
      if (upErr) throw upErr;

      const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
        empresa_id: empresaId,
        rollo_id: itemId,
        tipo,
        cantidad_metros: meters,
        anterior_metros: previo,
        nuevo_metros: parseFloat(nuevo.toFixed(2)),
        anterior_rollos: rollo.rollos,
        nuevo_rollos: nuevosRollos,
        comentario,
        vendedor_email: vendedorEmail,
      });
      if (movErr) throw movErr;
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  // ── Edición directa de stock asignado (solo admin) ─────────────────
  const editarStockAsignado = useCallback(
    async (
      itemId: string,
      nuevoRollos: number,
      nuevoMetrosPorRollo: number,
      nuevoTotalMetros: number,
      comentario: string,
      vendedorEmail: string,
    ) => {
      const rollo = rollosRaw.find((r) => r.id === itemId);
      if (!rollo) throw new Error('Rollo no encontrado');

      const { error: upErr } = await (supabase as any).from('inv_rollos')
        .update({
          rollos: nuevoRollos,
          metros_x_rollo: nuevoMetrosPorRollo,
          total_metros: nuevoTotalMetros,
          // Al editar el stock asignado, también se "resetea" el 100% de la barra
          metros_originales: nuevoTotalMetros,
        })
        .eq('id', itemId);
      if (upErr) throw upErr;

      const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
        empresa_id: empresaId,
        rollo_id: itemId,
        tipo: 'EDICION_STOCK',
        anterior_metros: rollo.total_metros,
        nuevo_metros: nuevoTotalMetros,
        anterior_rollos: rollo.rollos,
        nuevo_rollos: nuevoRollos,
        comentario,
        vendedor_email: vendedorEmail,
      });
      if (movErr) throw movErr;
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  // ── Agregar nuevo rollo ────────────────────────────────────────────
  const agregarRollo = useCallback(
    async (item: Omit<InventoryItem, 'id'>) => {
      const descPct = parseFloat(String(item.descuento).replace('%', '')) / 100 || 0.3;
      const { error } = await (supabase as any).from('inv_rollos').insert({
        empresa_id: empresaId,
        cod: item.cod,
        producto: item.producto,
        cod_int: item.cod_int,
        tipo: item.tipo,
        descripcion: item.descripcion,
        tela_verticales: item.telaVerticales,
        descuento_pct: descPct,
        rollos: item.rollos,
        metros_x_rollo: item.metros,
        total_metros: item.totalMetros,
        metros_originales: item.totalMetros, // al crear, el 100% de la barra = stock inicial
        comentario: item.comentario,
      });
      if (error) throw error;
      await refresh();
    },
    [empresaId, refresh],
  );

  // ── Eliminar rollo (soft delete) ───────────────────────────────────
  const eliminarRollo = useCallback(
    async (itemId: string) => {
      const { error } = await (supabase as any).from('inv_rollos').update({ activo: false }).eq('id', itemId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  // ── Actualizar perfil empresa ──────────────────────────────────────
  const guardarPerfil = useCallback(
    async (newProfile: CompanyProfile) => {
      if (!empresaId) return;
      const { error } = await (supabase as any).from('inv_empresa_perfil')
        .upsert({
          empresa_id: empresaId,
          razon_social: newProfile.razonSocial,
          rut: newProfile.rut,
          instagram: newProfile.instagram,
          pagina_web: newProfile.paginaWeb,
          direccion: newProfile.direccion,
          logo_url: newProfile.logoUrl,
          banner_url: newProfile.bannerUrl,
        });
      if (error) throw error;
      setProfile(newProfile);
    },
    [empresaId],
  );

  // ── Subida de imagen a Storage ─────────────────────────────────────
  const subirImagen = useCallback(
    async (file: File, tipo: 'logo' | 'banner'): Promise<string> => {
      if (!empresaId) throw new Error('Sin empresa');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${empresaId}/${tipo}-${Date.now()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from('inv-empresa-assets')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) throw error;
      const { data } = (supabase as any).storage.from('inv-empresa-assets').getPublicUrl(path);
      return data.publicUrl;
    },
    [empresaId],
  );

  // ── Borrar entrada de historial ────────────────────────────────────
  const borrarMovimiento = useCallback(
    async (logId: string) => {
      const { error } = await (supabase as any).from('inv_movimientos').delete().eq('id', logId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );
  // ── Reiniciar inventario: vuelve cada rollo a su metros_originales ──
  // Útil cuando se hicieron pruebas o descuentos por error y querés
  // limpiar todo de un saque. Solo debería estar disponible para admin.
  const reiniciarInventario = useCallback(
    async (vendedorEmail: string) => {
      if (!empresaId) throw new Error('Sin empresa');
      for (const rollo of rollosRaw) {
        const original = (rollo as any).metros_originales ?? rollo.total_metros;
        if (Number(original) === Number(rollo.total_metros)) continue;
        const nuevosRollos =
          rollo.metros_x_rollo > 0 ? Math.ceil(original / rollo.metros_x_rollo) : rollo.rollos;
        const { error: upErr } = await (supabase as any).from('inv_rollos')
          .update({
            total_metros: original,
            rollos: nuevosRollos,
            comentario: original === 0 ? 'STOCK LIMITADO' : null,
          })
          .eq('id', rollo.id);
        if (upErr) throw upErr;
        const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
          empresa_id: empresaId,
          rollo_id: rollo.id,
          tipo: 'INCREMENTO',
          cantidad_metros: Number(original) - Number(rollo.total_metros),
          anterior_metros: rollo.total_metros,
          nuevo_metros: original,
          anterior_rollos: rollo.rollos,
          nuevo_rollos: nuevosRollos,
          comentario: '[RESET] Reinicio de inventario — volvió al stock original',
          vendedor_email: vendedorEmail,
        });
        if (movErr) throw movErr;
      }
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  return {
    items,
    profile,
    historyLogs,
    loading,
    refresh,
    ajustarStock,
    editarStockAsignado,
    agregarRollo,
    eliminarRollo,
    reiniciarInventario,
    guardarPerfil,
    subirImagen,
    borrarMovimiento,
  };
}
