// Diálogo de detalle/edición de un lead.
//
// Maneja: state local (drafts de estado, vendedora, prioridad, detalle,
// comentario), las 5 mutaciones a Supabase, y compone las 9 secciones
// hijas con sus props.
// Cada sección hija vive bajo ./lead-detalle/components/.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLeadDetalle, useVendedoras } from '@/modules/leads/hooks';
import {
  ESTADOS_LABEL,
  ESTADO_ES_PERDIDO,
  type Lead,
  type LeadEstado,
  type Prioridad,
} from '@/modules/leads/types';
import { actualizarPrioridadDetalle } from '@/modules/leads/seguimientos';

import ActividadColumn from './lead-detalle/components/ActividadColumn';
import AgenteDataSection from './lead-detalle/components/AgenteDataSection';
import AsignarVendedoraSection from './lead-detalle/components/AsignarVendedoraSection';
import CambioEstadoSection from './lead-detalle/components/CambioEstadoSection';
import CoachingContextual from './lead-detalle/components/CoachingContextual';
import ContactoSection from './lead-detalle/components/ContactoSection';
import PrioridadDetalleSection from './lead-detalle/components/PrioridadDetalleSection';
import SeguimientosTimeline from './lead-detalle/components/SeguimientosTimeline';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => Promise<void>;
  onChanged?: () => void;
};

export function LeadDetalleDialog({
  open,
  onOpenChange,
  leadId,
  onEdit,
  onDelete,
  onChanged,
}: Props) {
  const navigate = useNavigate();
  const { empresaId } = useAuth();
  const { lead, actividad, loading, refresh, agregarComentario } = useLeadDetalle(leadId);
  const { vendedoras } = useVendedoras();
  const [comentario, setComentario] = useState('');
  const [savingComentario, setSavingComentario] = useState(false);
  const [estadoDraft, setEstadoDraft] = useState<LeadEstado | null>(null);
  const [motivoDraft, setMotivoDraft] = useState<string>('');
  const [comentarioCambio, setComentarioCambio] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [creandoOT, setCreandoOT] = useState(false);
  const [vendedoraDraft, setVendedoraDraft] = useState<string>('');
  const [prioridadDraft, setPrioridadDraft] = useState<Prioridad>('media');
  const [detalleDraft, setDetalleDraft] = useState('');
  const [guardandoPD, setGuardandoPD] = useState(false);

  useEffect(() => {
    if (lead) {
      setEstadoDraft(lead.estado);
      setVendedoraDraft(lead.asignado_a || '');
      setPrioridadDraft(lead.prioridad ?? 'media');
      setDetalleDraft(lead.detalle_personal ?? '');
    }
  }, [lead]);

  const vendedoraNombre = useMemo(() => {
    if (!lead?.asignado_a) return null;
    return vendedoras.find((v) => v.id === lead.asignado_a)?.nombre ?? '—';
  }, [vendedoras, lead?.asignado_a]);

  // Detecta si vino del agente: tiene whatsapp_phone o scoring o resumen
  const tieneDatosAgente = useMemo(() => {
    if (!lead) return false;
    return (
      !!lead.whatsapp_phone ||
      !!lead.whatsapp_wa_id ||
      lead.scoring != null ||
      !!lead.resumen_para_vendedor ||
      !!lead.producto_interes
    );
  }, [lead]);

  if (!lead) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl border-border bg-card text-foreground">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lead no encontrado'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleGuardarEstado = async () => {
    if (!estadoDraft || estadoDraft === lead.estado) return;
    setCambiando(true);
    try {
      const { error: err } = await supabase.rpc('lead_cambiar_estado' as any, {
        p_lead_id: lead.id,
        p_nuevo_estado: estadoDraft,
        p_motivo: ESTADO_ES_PERDIDO(estadoDraft) ? motivoDraft || null : null,
        p_comentario: comentarioCambio.trim() || null,
      });
      if (err) throw new Error(err.message);
      setMotivoDraft('');
      setComentarioCambio('');
      await refresh();
      onChanged?.();
      toast.success('Estado actualizado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setCambiando(false);
    }
  };

  const handleGuardarVendedora = async () => {
    if (vendedoraDraft === (lead.asignado_a || '')) return;
    try {
      const { error: err } = await supabase
        .from('leads' as any)
        .update({
          asignado_a: vendedoraDraft || null,
          asignado_at: vendedoraDraft ? new Date().toISOString() : null,
          ultima_actividad_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
      if (err) throw new Error(err.message);
      await supabase.from('leads_actividad' as any).insert({
        lead_id: lead.id,
        empresa_id: empresaId,
        tipo: 'asignacion',
        detalle: { asignado_a: vendedoraDraft || null },
      });
      await refresh();
      onChanged?.();
      toast.success('Vendedora asignada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    }
  };

  const handleGuardarPrioridadDetalle = async () => {
    setGuardandoPD(true);
    try {
      await actualizarPrioridadDetalle(lead.id, {
        prioridad: prioridadDraft,
        detalle_personal: detalleDraft,
      });
      await refresh();
      onChanged?.();
      toast.success('Prioridad y detalle guardados');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setGuardandoPD(false);
    }
  };

  const handleComentar = async () => {
    if (!comentario.trim()) return;
    setSavingComentario(true);
    try {
      await agregarComentario(comentario.trim());
      setComentario('');
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setSavingComentario(false);
    }
  };

  const handleCrearCotizacion = async () => {
    if (!empresaId) return;
    setCreandoOT(true);
    try {
      const otId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Número de OT con formato año-mes-secuencial (ej. 26-5-1, 26-12-1).
      // La RPC `generar_numero_ot` mantiene un contador por (empresa, periodo)
      // con UPSERT atómico — garantiza unicidad incluso con clicks simultáneos.
      const { data: numeroData, error: errNum } = await supabase.rpc(
        'generar_numero_ot' as any,
        { p_empresa_id: empresaId },
      );
      if (errNum) throw new Error(errNum.message);
      const numeroOT = String(numeroData ?? '');
      if (!numeroOT) throw new Error('No se pudo generar el número de OT');

      const { error: errOT } = await supabase.from('ots').insert({
        id: otId,
        empresa_id: empresaId,
        numero_ot: numeroOT,
        estado: 'cotizacion',
        datos_generales: {
          cliente: lead.nombre || '',
          rut: lead.rut || '',
          mail: lead.email || '',
          telefono: lead.whatsapp_phone || '',
          comuna: lead.comuna || '',
          canal: lead.fuente || '',
          fecha: now.split('T')[0],
          ot: numeroOT,
        },
        items: [],
        total: 0,
        fecha_creacion: now,
        fecha_modificacion: now,
      });
      if (errOT) throw new Error(errOT.message);

      const { error: errLink } = await supabase.rpc('lead_vincular_ot' as any, {
        p_lead_id: lead.id,
        p_ot_id: otId,
      });
      if (errLink) throw new Error(errLink.message);

      toast.success('Cotización creada · abriendo Fase 1');
      onOpenChange(false);
      navigate(`/ots/${otId}/fase1`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al crear OT: ' + msg);
    } finally {
      setCreandoOT(false);
    }
  };

  const handleEliminar = async () => {
    if (!confirm(`¿Eliminar el lead "${lead.nombre || '(sin nombre)'}"? Esto NO se puede deshacer.`))
      return;
    try {
      await onDelete(lead.id);
      onOpenChange(false);
      toast.success('Lead eliminado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{lead.nombre || '(sin nombre)'}</span>
            <span className="rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {ESTADOS_LABEL[lead.estado]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          {/* Columna izquierda */}
          <div className="space-y-4">
            <ContactoSection lead={lead} vendedoraNombre={vendedoraNombre} />

            {tieneDatosAgente && <AgenteDataSection lead={lead} />}

            <PrioridadDetalleSection
              lead={lead}
              prioridadDraft={prioridadDraft}
              setPrioridadDraft={setPrioridadDraft}
              detalleDraft={detalleDraft}
              setDetalleDraft={setDetalleDraft}
              guardando={guardandoPD}
              onGuardar={handleGuardarPrioridadDetalle}
            />

            <SeguimientosTimeline lead={lead} />

            <CoachingContextual estado={lead.estado} />

            <CambioEstadoSection
              lead={lead}
              estadoDraft={estadoDraft}
              setEstadoDraft={setEstadoDraft}
              motivoDraft={motivoDraft}
              setMotivoDraft={setMotivoDraft}
              comentarioCambio={comentarioCambio}
              setComentarioCambio={setComentarioCambio}
              cambiando={cambiando}
              onGuardar={handleGuardarEstado}
            />

            <AsignarVendedoraSection
              vendedoras={vendedoras}
              vendedoraDraft={vendedoraDraft}
              setVendedoraDraft={setVendedoraDraft}
              actualAsignada={lead.asignado_a || ''}
              onAsignar={handleGuardarVendedora}
            />

            {!lead.ot_id ? (
              <Button
                onClick={handleCrearCotizacion}
                disabled={creandoOT}
                className="w-full gap-1.5"
              >
                {creandoOT && <Loader2 className="h-4 w-4 animate-spin" />}
                <FileText className="h-4 w-4" />
                Crear cotización (OT)
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/ots/${lead.ot_id}/fase1`);
                }}
                className="w-full gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir OT vinculada
              </Button>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(lead)} className="flex-1">
                Editar datos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEliminar}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Eliminar
              </Button>
            </div>
          </div>

          {/* Columna derecha */}
          <ActividadColumn
            lead={lead}
            actividad={actividad}
            comentario={comentario}
            setComentario={setComentario}
            savingComentario={savingComentario}
            onComentar={handleComentar}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
