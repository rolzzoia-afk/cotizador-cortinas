import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  Loader2,
  MapPin,
  Mail,
  Phone,
  User,
  FileText,
  Flame,
  MessageSquare,
  ArrowRightCircle,
  ExternalLink,
  Bot,
  Star,
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
  PRIORIDAD_LABEL,
  PRIORIDAD_ORDEN,
  SEG_RESULTADO_LABEL,
  type Lead,
  type LeadActividad,
  type LeadEstado,
  type Prioridad,
} from '@/modules/leads/types';
import {
  actualizarPrioridadDetalle,
  fechaProximoSeguimiento,
  prioridadSugerida,
} from '@/modules/leads/seguimientos';

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
      texto = <span>Lead creado{det.fuente ? <em className="ml-1 text-muted-foreground">· {String(det.fuente)}</em> : null}</span>;
      break;
    case 'agente_ingreso':
      texto = <span>Ingresado por agente IA</span>;
      break;
    case 'cambio_estado':
      texto = (
        <span>
          Estado:{' '}
          <strong className="text-muted-foreground">
            {ESTADOS_LABEL[det.de as LeadEstado] || String(det.de)}
          </strong>
          {' → '}
          <strong className="text-foreground">
            {ESTADOS_LABEL[det.a as LeadEstado] || String(det.a)}
          </strong>
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
    case 'seguimiento':
      if (det.accion === 'archivado_auto') {
        texto = <span>Archivado automáticamente por falta de respuesta (día +8)</span>;
      } else {
        texto = (
          <span>
            Seguimiento {det.etapa ? String(det.etapa) : ''}:{' '}
            <strong className="text-foreground">
              {SEG_RESULTADO_LABEL[det.resultado as keyof typeof SEG_RESULTADO_LABEL] ||
                String(det.resultado ?? '')}
            </strong>
            {det.nota ? <div className="mt-1 text-muted-foreground">{String(det.nota)}</div> : null}
          </span>
        );
      }
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

function SeguimientosTimeline({ lead }: { lead: Lead }) {
  const proxima = fechaProximoSeguimiento(lead);
  const activo = lead.estado === 'cotizado' && !lead.archivado;
  const etapas = [
    { n: 1, fecha: lead.seg1_fecha, resultado: lead.seg1_resultado },
    { n: 2, fecha: lead.seg2_fecha, resultado: lead.seg2_resultado },
    { n: 3, fecha: lead.seg3_fecha, resultado: lead.seg3_resultado },
  ];

  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3 w-3" /> Seguimientos
      </div>
      {!lead.fecha_cotizacion ? (
        <p className="text-xs text-muted-foreground">
          El ciclo de 3 seguimientos arranca cuando el lead pasa a estado{' '}
          <strong className="text-foreground">Cotizado</strong> (cotización enviada).
        </p>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="text-muted-foreground">
            Cotización enviada:{' '}
            <span className="text-foreground">{formatFecha(lead.fecha_cotizacion)}</span>
          </div>
          {etapas.map((e) => {
            const hecho = !!e.fecha;
            const pendiente = activo && lead.etapa_seguimiento === e.n;
            return (
              <div key={e.n} className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                    hecho
                      ? 'border-success/40 bg-success/15 text-success'
                      : pendiente
                        ? 'border-warning/40 bg-warning/15 text-warning'
                        : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {e.n}
                </span>
                <div className="flex-1">
                  {hecho ? (
                    <span className="text-foreground">
                      {SEG_RESULTADO_LABEL[e.resultado as keyof typeof SEG_RESULTADO_LABEL] ||
                        e.resultado}{' '}
                      · <span className="text-muted-foreground">{formatFecha(e.fecha!)}</span>
                    </span>
                  ) : pendiente ? (
                    <span className="text-warning">
                      Pendiente{proxima ? ` · ${formatFecha(proxima.toISOString())}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
          {lead.archivado && (
            <div className="mt-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
              Archivado por falta de respuesta
              {lead.fecha_archivado ? ` · ${formatFecha(lead.fecha_archivado)}` : ''}
            </div>
          )}
          {lead.etapa_seguimiento === 4 && !lead.archivado && (
            <div className="mt-1 text-success">Ciclo cerrado — el cliente respondió.</div>
          )}
        </div>
      )}
    </section>
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
            <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto</div>
              <div className="grid gap-1.5 text-sm">
                {lead.whatsapp_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`https://wa.me/${lead.whatsapp_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-accent"
                    >
                      {lead.whatsapp_phone}
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
                {lead.comuna && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-foreground">{lead.comuna}</span>
                  </div>
                )}
                {lead.fuente && (
                  <div className="text-xs text-muted-foreground">
                    Fuente: <span className="text-foreground">{lead.fuente}</span>
                  </div>
                )}
                {lead.presupuesto_rango && (
                  <div className="text-xs text-muted-foreground">
                    Presupuesto: <span className="font-semibold text-foreground">{lead.presupuesto_rango}</span>
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

            {/* Datos del agente IA (si vino por WhatsApp) */}
            {tieneDatosAgente && (
              <section className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-accent">
                  <Bot className="h-3 w-3" /> Datos capturados por agente IA
                </div>
                <div className="space-y-1 text-xs">
                  {lead.scoring != null && (
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-warning" />
                      <span className="text-muted-foreground">Scoring:</span>
                      <span className="font-bold text-foreground">{lead.scoring}/100</span>
                    </div>
                  )}
                  {lead.producto_interes && (
                    <div>
                      <span className="text-muted-foreground">Producto: </span>
                      <span className="text-foreground">{lead.producto_interes}</span>
                    </div>
                  )}
                  {lead.cantidad_ventanas != null && (
                    <div>
                      <span className="text-muted-foreground">Cantidad ventanas: </span>
                      <span className="text-foreground">{lead.cantidad_ventanas}</span>
                    </div>
                  )}
                  {lead.tiene_medidas != null && (
                    <div>
                      <span className="text-muted-foreground">Medidas tomadas: </span>
                      <span className="text-foreground">{lead.tiene_medidas ? 'Sí' : 'No'}</span>
                    </div>
                  )}
                  {lead.necesita_instalacion != null && (
                    <div>
                      <span className="text-muted-foreground">Requiere instalación: </span>
                      <span className="text-foreground">
                        {lead.necesita_instalacion ? 'Sí' : 'No'}
                      </span>
                    </div>
                  )}
                  {lead.urgencia && (
                    <div>
                      <span className="text-muted-foreground">Urgencia: </span>
                      <span className="text-foreground">{lead.urgencia}</span>
                    </div>
                  )}
                  {lead.motivo_derivacion && (
                    <div>
                      <span className="text-muted-foreground">Motivo derivación: </span>
                      <span className="text-foreground">{lead.motivo_derivacion}</span>
                    </div>
                  )}
                </div>
                {lead.resumen_para_vendedor && (
                  <div className="mt-2 rounded border border-accent/20 bg-card/40 p-2 text-xs italic text-foreground">
                    "{lead.resumen_para_vendedor}"
                  </div>
                )}
              </section>
            )}

            {/* Prioridad y detalle personal (CONECTOR) */}
            <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Flame className="h-3 w-3" /> Prioridad y detalle personal
                </div>
                {prioridadSugerida(lead) !== prioridadDraft && (
                  <button
                    onClick={() => setPrioridadDraft(prioridadSugerida(lead))}
                    className="text-[10px] text-accent hover:underline"
                    title="Aplicar la prioridad sugerida según scoring, presupuesto y urgencia"
                  >
                    Sugerida: {PRIORIDAD_LABEL[prioridadSugerida(lead)]}
                  </button>
                )}
              </div>
              <div className="flex gap-1.5">
                {PRIORIDAD_ORDEN.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrioridadDraft(p)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors',
                      prioridadDraft === p
                        ? p === 'alta'
                          ? 'border-destructive/50 bg-destructive/15 text-destructive'
                          : p === 'media'
                            ? 'border-warning/50 bg-warning/15 text-warning'
                            : 'border-accent/40 bg-accent/15 text-accent'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {PRIORIDAD_LABEL[p]}
                  </button>
                ))}
              </div>
              <textarea
                value={detalleDraft}
                onChange={(e) => setDetalleDraft(e.target.value)}
                placeholder="Conector / detalle personal: lo importante que surgió en la conversación (ej. 'se muda en marzo', 'le preocupa la luz de la mañana')…"
                rows={2}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-xs focus:border-accent focus:outline-none"
              />
              <Button
                onClick={handleGuardarPrioridadDetalle}
                disabled={
                  guardandoPD ||
                  (prioridadDraft === (lead.prioridad ?? 'media') &&
                    detalleDraft.trim() === (lead.detalle_personal ?? '').trim())
                }
                size="sm"
                className="w-full"
              >
                {guardandoPD && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Guardar prioridad y detalle
              </Button>
            </section>

            {/* Línea de tiempo de seguimientos */}
            <SeguimientosTimeline lead={lead} />

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
                  disabled={vendedoraDraft === (lead.asignado_a || '')}
                >
                  Asignar
                </Button>
              </div>
            </section>

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
