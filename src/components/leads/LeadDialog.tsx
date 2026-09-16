// Crear o editar un cliente con las columnas de la planilla: contacto,
// Instagram, comuna y región, canal y anuncio, lo que pidió, quién llamó,
// quién cotiza y quién sale a la visita. Editar pasa por `lead_editar`, que
// deja en el historial qué cambió y quién.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { opcionesCanal, opcionesEquipo } from '@/modules/canales/canales';
import { REGIONES_CHILE } from '@/modules/cotizador/regiones-chile';
import type { Lead, LeadInput } from '@/modules/leads/types';
import { PRESUPUESTO_RANGOS } from '@/modules/leads/types';
import { useVendedoras } from '@/modules/leads/hooks';
import { useEquipoVentas } from '@/modules/leads/planillaStore';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: Lead | null;
  canales: string[];
  onSubmit: (input: LeadInput) => Promise<void>;
};

const EMPTY: LeadInput = {
  nombre: '',
  whatsapp_phone: '',
  email: '',
  rut: '',
  comuna: '',
  fuente: '',
  asignado_a: null,
  presupuesto_rango: '',
  comentarios: '',
  instagram: '',
  region: '',
  anuncio: '',
  mensaje: '',
  llamada_por: '',
  cotizado_por: '',
  visita_por: '',
  monto: 0,
};

const SELECT =
  'w-full rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none';

export function LeadDialog({ open, onOpenChange, lead, canales, onSubmit }: Props) {
  const { vendedoras } = useVendedoras();
  const { equipo } = useEquipoVentas();
  const [draft, setDraft] = useState<LeadInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setDraft({
        nombre: lead.nombre ?? '',
        whatsapp_phone: lead.whatsapp_phone ?? '',
        email: lead.email ?? '',
        rut: lead.rut ?? '',
        comuna: lead.comuna ?? '',
        fuente: lead.fuente ?? '',
        asignado_a: lead.asignado_a ?? null,
        presupuesto_rango: lead.presupuesto_rango ?? '',
        comentarios: lead.comentarios ?? '',
        instagram: lead.instagram ?? '',
        region: lead.region ?? '',
        anuncio: lead.anuncio ?? '',
        mensaje: lead.mensaje ?? '',
        llamada_por: lead.llamada_por ?? '',
        cotizado_por: lead.cotizado_por ?? '',
        visita_por: lead.visita_por ?? '',
        monto: lead.monto === null ? 0 : Number(lead.monto),
      });
    } else {
      setDraft(EMPTY);
    }
  }, [open, lead]);

  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const handleGuardar = async () => {
    if (!draft.nombre.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }
    setSaving(true);
    try {
      // Con OT, el monto lo manda la OT: no se envía.
      const input: LeadInput = lead?.ot_id ? { ...draft, monto: undefined } : draft;
      await onSubmit(input);
      onOpenChange(false);
      toast.success(lead ? 'Cliente actualizado' : 'Cliente creado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const personas = (lista: string[], guardado: string | undefined) => opcionesEquipo(lista, guardado);
  const regionGuardadaFuera = draft.region && !(REGIONES_CHILE as readonly string[]).includes(draft.region);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Nombre*</Label>
              <Input value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="María González" autoFocus />
            </div>
            <div>
              <Label>WhatsApp / Teléfono</Label>
              <Input value={draft.whatsapp_phone || ''} onChange={(e) => set('whatsapp_phone', e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            <div>
              <Label>Mail</Label>
              <Input value={draft.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="cliente@email.com" type="email" />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={draft.instagram || ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@usuario" />
            </div>
            <div>
              <Label>RUT</Label>
              <Input value={draft.rut || ''} onChange={(e) => set('rut', e.target.value)} placeholder="12.345.678-9" />
            </div>
            <div>
              <Label>Comuna</Label>
              <Input value={draft.comuna || ''} onChange={(e) => set('comuna', e.target.value)} placeholder="Las Condes, Vitacura, etc." />
            </div>
            <div>
              <Label>Región</Label>
              <select value={draft.region || ''} onChange={(e) => set('region', e.target.value)} className={SELECT}>
                <option value="">— Sin región —</option>
                {REGIONES_CHILE.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {regionGuardadaFuera && <option value={draft.region}>{draft.region}</option>}
              </select>
            </div>
            <div>
              <Label>Canal</Label>
              <select value={draft.fuente || ''} onChange={(e) => set('fuente', e.target.value)} className={SELECT}>
                <option value="">— Sin canal —</option>
                {opcionesCanal(canales, draft.fuente).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Qué anuncio viene</Label>
              <Input value={draft.anuncio || ''} onChange={(e) => set('anuncio', e.target.value)} placeholder="Promo septiembre, reel roller dúo…" />
            </div>
            <div>
              <Label>Asignar vendedora</Label>
              <select
                value={draft.asignado_a || ''}
                onChange={(e) => set('asignado_a', e.target.value || null)}
                className={SELECT}
              >
                <option value="">— Sin asignar —</option>
                {vendedoras.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Mensaje (lo que pidió)</Label>
            <textarea
              value={draft.mensaje || ''}
              onChange={(e) => set('mensaje', e.target.value)}
              placeholder="«Cortina roller dual, ancho 153 cm» — lo que escribió el cliente"
              rows={2}
              className={SELECT}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label>Llamada</Label>
              <select value={draft.llamada_por || ''} onChange={(e) => set('llamada_por', e.target.value)} className={SELECT}>
                <option value="">—</option>
                {personas(equipo.vendedoras, draft.llamada_por).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Persona que cotiza</Label>
              <select value={draft.cotizado_por || ''} onChange={(e) => set('cotizado_por', e.target.value)} className={SELECT}>
                <option value="">—</option>
                {personas(equipo.vendedoras, draft.cotizado_por).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Salida a visita</Label>
              <select value={draft.visita_por || ''} onChange={(e) => set('visita_por', e.target.value)} className={SELECT}>
                <option value="">—</option>
                {personas(equipo.terreno, draft.visita_por).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Los nombres se editan en Clientes → Planilla → «Equipo».
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Presupuesto estimado</Label>
              <select value={draft.presupuesto_rango || ''} onChange={(e) => set('presupuesto_rango', e.target.value)} className={SELECT}>
                <option value="">— Sin definir —</option>
                {PRESUPUESTO_RANGOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Monto cotizado</Label>
              {lead?.ot_id ? (
                <p className="py-2 text-xs text-muted-foreground">Lo pone la OT al cotizar.</p>
              ) : (
                <InputDecimal value={draft.monto ?? 0} onChange={(v) => set('monto', v)} placeholder="0" />
              )}
            </div>
          </div>

          <div>
            <Label>Información adicional</Label>
            <textarea
              value={draft.comentarios || ''}
              onChange={(e) => set('comentarios', e.target.value)}
              placeholder="Notas internas del cliente"
              rows={2}
              className={SELECT}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {lead ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
