// Vista de firma + confirmación de despacho. Hace 3 cosas en serie:
//  1. UPDATE ots: estado='entregado' + firma_b64 + firma_nombre + bom_despachado.
//  2. UPDATE insumos: descontar stock_liberado primero, después stock_mp,
//     y registrar un movimiento `SALIDA PRODUCCION` por cada insumo.
//  3. UPDATE orden_materiales: marcar cada fila como completado/parcial.

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Eraser,
  Loader2,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type BOMItem,
  type Insumo,
  type OT,
  buscarInsumoMatchBOM,
} from '@/modules/bodega/bomUtils';
import { MESES_A } from '../Bodeguero.config';
import type { Contador } from '../Bodeguero.types';

interface FirmaViewProps {
  ot: OT;
  bomItems: BOMItem[];
  contadores: Record<number, Contador>;
  insumos: Insumo[];
  empresaId: string;
  onBack: () => void;
  onDone: () => void;
}

export default function FirmaView({
  ot,
  bomItems,
  contadores,
  insumos,
  empresaId,
  onBack,
  onDone,
}: FirmaViewProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);

  const limpiar = () => {
    sigRef.current?.clear();
  };

  const confirmar = async () => {
    if (!nombre.trim()) {
      toast.warning('Ingresa el nombre del receptor');
      return;
    }
    if (sigRef.current?.isEmpty()) {
      toast.warning('La firma está vacía');
      return;
    }
    setSaving(true);
    const firmaB64 = sigRef.current!.toDataURL('image/png');

    try {
      // 1. Actualizar OT con firma + estado entregado
      const dg = (ot.datos_generales || {}) as Record<string, unknown>;
      const bomDespachado = bomItems.map((it, i) => ({
        ...it,
        cantidad_despachada: contadores[i]?.pickeado || 0,
      }));
      const { error: otErr } = await supabase
        .from('ots')
        .update({
          estado: 'entregado',
          datos_generales: {
            ...dg,
            firma: firmaB64,
            firma_nombre: nombre.trim(),
            firma_fecha: new Date().toISOString(),
            bom_despachado: bomDespachado,
          },
        })
        .eq('id', ot.id);
      if (otErr) throw otErr;

      // 2. Descontar stock + registrar movimientos
      for (let idx = 0; idx < bomItems.length; idx++) {
        const item = bomItems[idx];
        const cnt = contadores[idx];
        if (!cnt || cnt.pickeado <= 0) continue;
        const ins = buscarInsumoMatchBOM(item, insumos);
        if (!ins) continue;

        const { data: insActual } = await supabase
          .from('insumos')
          .select('stock_mp,stock_liberado')
          .eq('empresa_id', empresaId)
          .eq('cod', ins.cod!)
          .single();
        if (!insActual) continue;

        const libActual = Number(insActual.stock_liberado) || 0;
        const mpActual = Number(insActual.stock_mp) || 0;
        let resta = cnt.pickeado;
        const descLib = Math.min(resta, libActual);
        resta -= descLib;
        const descMp = Math.min(resta, mpActual);

        await supabase
          .from('insumos')
          .update({
            stock_mp: mpActual - descMp,
            stock_liberado: libActual - descLib,
          })
          .eq('empresa_id', empresaId)
          .eq('cod', ins.cod!);

        await supabase.from('movimientos_insumos').insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: MESES_A[new Date().getMonth()],
          tipo: 'SALIDA PRODUCCION',
          codigo: ins.cod!,
          producto: ins.nemotecnico || ins.descriptor_proveedor || '',
          almacen: 'MP',
          cantidad: cnt.pickeado,
          ot: ot.numero_ot || ot.id.slice(-6),
          responsable_entrega: nombre.trim(),
          bitacora: `Despacho OT ${ot.numero_ot || ot.id.slice(-6)}`,
        });
      }

      // 3. Actualizar orden_materiales (filas con id UUID)
      for (let idx = 0; idx < bomItems.length; idx++) {
        const item = bomItems[idx];
        const cnt = contadores[idx];
        if (typeof item.id === 'string' && item.id.length > 10) {
          await supabase
            .from('orden_materiales')
            .update({
              cantidad_despachada: cnt.pickeado,
              estado: cnt.estado === 'completo' ? 'completado' : 'parcial',
            })
            .eq('id', item.id);
        }
      }

      toast.success('Despacho confirmado y stock actualizado');
      setTimeout(() => onDone(), 1200);
    } catch (e) {
      const err = e as Error;
      toast.error('Error: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="flex-1 text-base font-bold">Firma de conformidad</h1>
      </div>

      <div className="mx-auto max-w-md p-4">
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Resumen del despacho
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {bomItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border py-1 last:border-0"
              >
                <span>{item.descripcion}</span>
                <span className="font-semibold text-success">
                  {contadores[i]?.pickeado || 0} {item.unidad}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Label className="text-xs">Nombre del receptor *</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Juan Pérez"
          className="mb-4 border-border bg-card"
        />

        <Label className="text-xs">Firma</Label>
        <div className="mb-2 overflow-hidden rounded-xl bg-white">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: 'w-full',
              width: 400,
              height: 200,
              style: { width: '100%', height: 200, display: 'block' },
            }}
          />
        </div>
        <Button onClick={limpiar} variant="outline" size="sm" className="mb-4 gap-1.5">
          <Eraser className="h-3.5 w-3.5" /> Limpiar firma
        </Button>

        <Button
          onClick={confirmar}
          disabled={saving}
          className="h-12 w-full gap-2 bg-success text-base hover:bg-success/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> Confirmar entrega y descontar stock
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
