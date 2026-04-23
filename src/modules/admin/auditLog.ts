// Audit log — tipos + hook de carga con filtros.
// La tabla + trigger están en Supabase (ver migración SQL en Fase 5.3).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type AuditLogRow = {
  id: number;
  empresa_id: string;
  user_id: string | null;
  user_email: string | null;
  tabla: string;
  accion: AuditAction;
  entidad_id: string | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  timestamp: string;
};

export type AuditFiltros = {
  tabla?: string;
  accion?: AuditAction | '';
  userEmail?: string;
  entidadId?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  limite?: number;
};

export const AUDIT_TABLAS = [
  'ots',
  'insumos',
  'perfiles',
  'colmena_tubos',
  'colmena_panos',
  'orden_materiales',
] as const;

export function useAuditLog(filtros: AuditFiltros = {}) {
  const { empresaId } = useAuth();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('audit_log')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('timestamp', { ascending: false })
        .limit(filtros.limite ?? 200);

      if (filtros.tabla) q = q.eq('tabla', filtros.tabla);
      if (filtros.accion) q = q.eq('accion', filtros.accion);
      if (filtros.userEmail) q = q.ilike('user_email', `%${filtros.userEmail}%`);
      if (filtros.entidadId) q = q.eq('entidad_id', filtros.entidadId);
      if (filtros.desde) q = q.gte('timestamp', filtros.desde);
      if (filtros.hasta) q = q.lte('timestamp', filtros.hasta);

      const { data, error: err } = await q;
      if (err) throw err;
      setRows((data || []) as AuditLogRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [
    empresaId,
    filtros.tabla,
    filtros.accion,
    filtros.userEmail,
    filtros.entidadId,
    filtros.desde,
    filtros.hasta,
    filtros.limite,
  ]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { rows, loading, error, refrescar: cargar };
}

// Formatea un valor de JSON para mostrar en la tabla (truncado, legible)
export function formatJsonValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Resumen legible del cambio: solo diff si es UPDATE, o "entidad creada/eliminada"
export function resumenCambio(row: AuditLogRow): string {
  if (row.accion === 'INSERT') return 'Creado';
  if (row.accion === 'DELETE') return 'Eliminado';
  const diff = row.diff || {};
  const keys = Object.keys(diff);
  if (keys.length === 0) return 'Sin cambios';
  if (keys.length <= 3) return keys.join(', ');
  return `${keys.slice(0, 3).join(', ')} y ${keys.length - 3} más`;
}
