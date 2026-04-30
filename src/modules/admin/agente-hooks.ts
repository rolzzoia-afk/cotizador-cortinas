import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

// ── Tipos ────────────────────────────────────────────────────────────
export type AgenteCategoria =
  | 'catalogo'
  | 'politicas'
  | 'faq'
  | 'zonas'
  | 'precios'
  | 'tono'
  | 'derivacion'
  | 'objeciones';

export const AGENTE_CATEGORIAS: Array<{ id: AgenteCategoria; label: string; descripcion: string }> = [
  { id: 'catalogo', label: 'Catálogo', descripcion: 'Productos, modelos, telas, usos' },
  { id: 'politicas', label: 'Políticas', descripcion: 'Garantía, instalación, postventa, pagos' },
  { id: 'faq', label: 'FAQ', descripcion: 'Preguntas frecuentes (limpieza, motores, medición)' },
  { id: 'zonas', label: 'Zonas', descripcion: 'Cobertura geográfica, showroom, envíos' },
  { id: 'precios', label: 'Precios', descripcion: 'Rangos orientativos, cuándo NO cotizar' },
  { id: 'tono', label: 'Tono', descripcion: 'Cómo habla el agente, personalidad' },
  { id: 'derivacion', label: 'Derivación', descripcion: 'Cuándo pasa a humano' },
  { id: 'objeciones', label: 'Objeciones', descripcion: 'Respuestas a "está caro", "vi otra", etc.' },
];

export type EmpresaAgenteConfig = {
  empresa_id: string;
  nombre_agente: string;
  modelo: string;
  activo: boolean;
  whatsapp_phone_id: string | null;
  horario_atencion: Record<string, [number, number] | null> | null;
  temperatura: number;
  max_turnos_sin_derivar: number;
  mensaje_fuera_horario: string | null;
  mensaje_fallback: string | null;
  updated_at: string;
};

export type AgenteDoc = {
  id: string;
  empresa_id: string;
  categoria: AgenteCategoria;
  contenido_md: string;
  version: number;
  activo: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type VendedoraActiva = {
  empresa_id: string;
  perfil_id: string;
  activa: boolean;
  peso: number;
  leads_asignados_acumulado: number;
  ultima_asignacion: string | null;
  // Campos derivados del JOIN con perfiles:
  nombre?: string | null;
};

// ── Hook: configuración del agente ──────────────────────────────────
export function useEmpresaAgenteConfig(): {
  config: EmpresaAgenteConfig | null;
  loading: boolean;
  error: string | null;
  guardar: (cambios: Partial<EmpresaAgenteConfig>) => Promise<void>;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [config, setConfig] = useState<EmpresaAgenteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('empresa_agente_config' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (e) throw e;
      setConfig((data as EmpresaAgenteConfig | null) ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (cambios: Partial<EmpresaAgenteConfig>) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error: e } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('empresa_agente_config' as any)
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('empresa_id', empresaId);
      if (e) throw new Error(e.message || JSON.stringify(e));
      await cargar();
    },
    [empresaId, cargar],
  );

  return { config, loading, error, guardar, refrescar: cargar };
}

// ── Hook: documentos del agente (8 por empresa) ─────────────────────
export function useAgenteDocs(): {
  docs: AgenteDoc[];
  loading: boolean;
  error: string | null;
  guardarDoc: (categoria: AgenteCategoria, contenido_md: string) => Promise<void>;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [docs, setDocs] = useState<AgenteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('agente_docs' as any)
        .select('*')
        .eq('empresa_id', empresaId)
        .order('categoria');
      if (e) throw e;
      setDocs(((data ?? []) as unknown) as AgenteDoc[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarDoc = useCallback(
    async (categoria: AgenteCategoria, contenido_md: string) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error: e } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('agente_docs' as any)
        .update({ contenido_md })
        .eq('empresa_id', empresaId)
        .eq('categoria', categoria);
      if (e) throw new Error(e.message || JSON.stringify(e));
      await cargar();
    },
    [empresaId, cargar],
  );

  return { docs, loading, error, guardarDoc, refrescar: cargar };
}

// ── Tipo: respuesta de invitación ───────────────────────────────────
export type InvitacionVendedora = {
  ok: true;
  perfil_id: string;
  email: string;
  nombre: string;
  password_temporal: string;
};

// ── Hook: vendedoras activas + listado de candidatas ────────────────
export function useVendedoras(): {
  vendedoras: VendedoraActiva[];
  loading: boolean;
  error: string | null;
  setActiva: (perfil_id: string, activa: boolean) => Promise<void>;
  invitar: (email: string, nombre: string) => Promise<InvitacionVendedora>;
  refrescar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [vendedoras, setVendedoras] = useState<VendedoraActiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      // Traer perfiles con rol ventas (case-insensitive)
      const { data: perfilesRaw, error: ePerf } = await supabase
        .from('perfiles')
        .select('id, nombre, rol')
        .eq('empresa_id', empresaId);
      if (ePerf) throw ePerf;
      const perfilesVentas = (perfilesRaw ?? []).filter(
        (p) => (p.rol || '').toLowerCase().trim() === 'ventas',
      );

      // Traer estado actual
      const { data: estadoRaw, error: eEst } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('vendedoras_activas' as any)
        .select('*')
        .eq('empresa_id', empresaId);
      if (eEst) throw eEst;
      const estadoMap = new Map<string, VendedoraActiva>();
      for (const v of ((estadoRaw ?? []) as unknown) as VendedoraActiva[]) {
        estadoMap.set(v.perfil_id, v);
      }

      const merged: VendedoraActiva[] = perfilesVentas.map((p) => {
        const existente = estadoMap.get(p.id);
        return {
          empresa_id: empresaId,
          perfil_id: p.id,
          activa: existente?.activa ?? false,
          peso: existente?.peso ?? 1,
          leads_asignados_acumulado: existente?.leads_asignados_acumulado ?? 0,
          ultima_asignacion: existente?.ultima_asignacion ?? null,
          nombre: p.nombre,
        };
      });
      setVendedoras(merged);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setActiva = useCallback(
    async (perfil_id: string, activa: boolean) => {
      if (!empresaId) throw new Error('Empresa no resuelta');
      const { error: e } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('vendedoras_activas' as any)
        .upsert(
          { empresa_id: empresaId, perfil_id, activa },
          { onConflict: 'empresa_id,perfil_id' },
        );
      if (e) throw new Error(e.message || JSON.stringify(e));
      await cargar();
    },
    [empresaId, cargar],
  );

  const invitar = useCallback(
    async (email: string, nombre: string): Promise<InvitacionVendedora> => {
      const resp = await api.post<InvitacionVendedora>('/usuarios/invitar', {
        email,
        nombre,
      });
      await cargar();
      return resp;
    },
    [cargar],
  );

  return { vendedoras, loading, error, setActiva, invitar, refrescar: cargar };
}
