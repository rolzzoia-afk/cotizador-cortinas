import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Loader2,
  MapPin,
  Mail,
  Phone,
  User,
  FileText,
  MessageSquare,
  ArrowRightCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLeadDetalle, useVendedoras } from '@/modules/leads/hooks';
import {
  ESTADOS_LABEL,
  ESTADOS_ORDEN,
  ESTADO_ES_PERDIDO,
  type Lead,
  type LeadActividad,
  type LeadEstado,
} from '@/modules/leads/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => Promise<void>;
  onChanged?: () => void;
};

const MOTIVOS_PERDIDA: Record<string, string[]> = {
  perdido_precio: ['Muy caro vs presupuesto', 'No quería pagar IVA', 'Pidió descuento que no podía dar'],
  perdido_competencia: ['Eligió otra empresa', 'Ya tenía proveedor', 'Compró en retail (Falabella, Sodimac)'],
  perdido_otro: ['No respondió más', 'Cancelado por cliente', 'Datos inválidos', 'Otro motivo'],
};

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ActividadItem({ act }: { act: LeadActividad }) {
  const det = act.detalle as Record<string, unknown>;
  let texto: React.ReactNode;
  switch (act.tipo) {
    case 'creado':
      texto = <span>Lead creado</span>;
      break;
    case 'cambio_estado':
      texto = (
        <span>
          Estado: <strong className="text-muted-foreground">{ESTADOS_LABEL[det.de as LeadEstado] || String(det.de)}</strong>
          {' → '}
          <strong className="text-foreground">{ESTADOS_LABEL[det.a as LeadEstado] || String(det.a)}</strong>
          {det.motivo ? <em className="ml-1 text-muted-foreground">· {String(det.motivo)}</em> : null}
          {det.comentario ? <div className="mt-1 text-muted-foreground">{String(det.comentario)}</div> : null}
        </span>
      );
      break;
    case 'comentario':
      texto = <span>{String(det.texto || '')}</span>;
      break;
    case 'asignacion':
      texto = <span>Asignado a vendedora</span>;
      break;
    case 'conversion_ot':
      texto = <span>Convertido en cotización (OT)</span>;
      break;
    default:
      texto = <span>{act.tipo}</span>;
  }
  return (
    <li className="flex gap-3 border-l-2 border-border pl-3 text-xs">
      <div className="flex-1">
        <div className="text-foreground">{texto}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {formatFecha(act.created_at)}
        </div>
      </div>
    </li>
  );
}

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

  useEffect(() => {
    if (lead) {
      setEstadoDraft(lead.estado);
      setVendedoraDraft(lead.vendedora_id || '');
    }
  }, [lead]);

  const vendedoraNombre = useMemo(() => {
    if (!lead?.vendedora_id) return null;
    return vendedoras.find((v) => v.id === lead.vendedora_id)?.nombre ?? '—';
  }, [vendedoras, lead?.vendedora_id]);

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
    if (vendedoraDraft === (lead.vendedora_id || '')) return;
    try {
      const { error: err } = await supabase
        .from('leads' as any)
        .update({
          vendedora_id: vendedoraDraft || null,
          ultima_actividad_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
      if (err) throw new Error(err.message);
      await supabase.from('leads_actividad' as any).insert({
        lead_id: lead.id,
        empresa_id: empresaId,
        tipo: 'asignacion',
        detalle: { vendedora_id: vendedoraDraft || null },
      });
      await refresh();
      onChanged?.();
      toast.success('Vendedora asignada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
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
      // Crear OT minimal con datos del lead
      const otId = crypto.randomUUID();
      const now = new Date().toISOString();
      const numeroOT = String(Math.floor(Date.now() / 1000)).slice(-4);
      const { error: errOT } = await supabase.from('ots').insert({
        id: otId,
        empresa_id: empresaId,
        numero_ot: numeroOT,
        estado: 'cotizacion',
        datos_generales: {
          cliente: lead.nombre,
          rut: lead.rut || '',
          mail: lead.email || '',
          telefono: lead.telefono || '',
          comuna: lead.ubicacion || '',
          canal: lead.canal || '',
          fecha: now.split('T')[0],
          ot: numeroOT,
        },
        items: [],
        total: 0,
        fecha_creacion: now,
        fecha_modificacion: now,
      });
      if (errOT) throw new Error(errOT.message);

      // Vincular lead → OT
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
    if (!confirm(`¿Eliminar el lead "${lead.nombre}"? Esto NO se puede deshacer.`)) return;
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
            <span>{lead.nombre}</span>
            <span className="rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {ESTADOS_LABEL[lead.estado]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          {/* Columna izquierda: info + acciones */}
          <div className="space-y-4">
            {/* Datos contacto */}
            <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto</div>
              <div className="grid gap-1.5 text-sm">
                {lead.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-accent"
                    >
                      {lead.telefono}
                    </a>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`mailto:${lead.email}`} className="text-foreground hover:text-accent">
                      {lead.email}
                    </a>
                  </div>
                )}
                {lead.rut && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{lead.rut}</span>
                  </div>
                )}
                {lead.ubicacion && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{lead.ubicacion}</span>
                  </div>
                )}
                {lead.canal && (
                  <div className="text-xs text-muted-foreground">
                    Canal: <span className="text-foreground">{lead.canal}</span>
                  </div>
                )}
                {lead.valor_estimado != null && (
                  <div className="text-xs text-muted-foreground">
                    Valor estimado:{' '}
                    <span className="font-semibold text-foreground">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0,
                      }).format(lead.valor_estimado)}
                    </span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Vendedora: <span className="text-foreground">{vendedoraNombre || 'Sin asignar'}</span>
                </div>
              </div>
              {lead.comentarios && (
                <div className="mt-2 rounded border border-border bg-background/40 p-2 text-xs text-muted-foreground">
                  <FileText className="mr-1 inline h-3 w-3" />
                  {lead.comentarios}
                </div>
              )}
            </section>

            {/* Cambiar estado */}
            <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Cambiar estado
              </div>
              <select
                value={estadoDraft || lead.estado}
                onChange={(e) => setEstadoDraft(e.target.value as LeadEstado)}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {ESTADOS_ORDEN.map((s) => (
                  <option key={s} value={s}>
                    {ESTADOS_LABEL[s]}
                  </option>
                ))}
              </select>

              {estadoDraft && ESTADO_ES_PERDIDO(estadoDraft) && (
                <select
                  value={motivoDraft}
                  onChange={(e) => setMotivoDraft(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">— Motivo específico (opcional) —</option>
                  {MOTIVOS_PERDIDA[estadoDraft]?.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}

              <Input
                value={comentarioCambio}
                onChange={(e) => setComentarioCambio(e.target.value)}
                placeholder="Comentario del cambio (opcional)"
              />
              <Button
                onClick={handleGuardarEstado}
                disabled={cambiando || !estadoDraft || estadoDraft === lead.estado}
                className="w-full gap-1.5"
                size="sm"
              >
                {cambiando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Guardar cambio de estado
              </Button>
            </section>

            {/* Asignar vendedora */}
            <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Asignar vendedora
              </div>
              <div className="flex gap-2">
                <select
                  value={vendedoraDraft}
                  onChange={(e) => setVendedoraDraft(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">— Sin asignar —</option>
                  {vendedoras.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleGuardarVendedora}
                  size="sm"
                  disabled={vendedoraDraft === (lead.vendedora_id || '')}
                >
                  Asignar
                </Button>
              </div>
            </section>

            {/* Conversión OT */}
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

            {/* Editar / Eliminar */}
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

          {/* Columna derecha: actividad */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="mr-1 inline h-3 w-3" />
                Actividad
              </div>
              <span className="text-[10px] text-muted-foreground">{actividad.length} entradas</span>
            </div>

            <div className="space-y-2">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Agregar comentario…"
                rows={2}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-xs focus:border-accent focus:outline-none"
              />
              <Button
                onClick={handleComentar}
                disabled={savingComentario || !comentario.trim()}
                size="sm"
                className="w-full"
              >
                {savingComentario && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Comentar
              </Button>
            </div>

            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              <Calendar className="mr-1 inline h-3 w-3" />
              Creado: {formatFecha(lead.created_at)}
            </div>

            <ul className="space-y-3">
              {actividad.length === 0 && (
                <li className={cn('rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground')}>
                  Sin actividad registrada todavía.
                </li>
              )}
              {actividad.map((a) => (
                <ActividadItem key={a.id} act={a} />
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
