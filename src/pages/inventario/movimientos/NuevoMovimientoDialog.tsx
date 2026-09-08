// Registrar un movimiento a mano (lámina «Nuevo movimiento»).
//
// Los cuatro pasos de la lámina en una sola columna: qué está pasando, qué
// artículo, cuánto y por qué. Lo escribe la función de la base, así que las dos
// cosas —el saldo y el registro— pasan juntas o no pasa ninguna.
//
// Corregir un movimiento es registrar el CONTRARIO, no editar el original: un
// libro que se puede editar no sirve para averiguar qué pasó.

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { etiquetaAlmacen } from '@/modules/inventario/almacenes';
import { resumenDeMovimientos, type LineaKardex, type TipoKardex } from '@/modules/inventario/kardex';
import { useRegistrarKardex } from '@/modules/inventario/kardexStore';
import type { FilaKardexVista } from '@/modules/inventario/kardexVista';

const TIPOS: ReadonlyArray<{ id: TipoKardex; texto: string }> = [
  { id: 'INGRESO', texto: 'Ingreso' },
  { id: 'SALIDA', texto: 'Salida' },
  { id: 'TRASLADO', texto: 'Traslado' },
  { id: 'DEVOLUCION', texto: 'Devolución' },
  { id: 'AJUSTE', texto: 'Ajuste' },
  { id: 'MERMA', texto: 'Merma' },
];

const ALMACENES = ['MP', 'LIB'];

/** El movimiento que deshace a otro: el mismo, al revés. */
function contrarioDe(m: FilaKardexVista): { tipo: TipoKardex; origen: string; destino: string } {
  if (m.tipo === 'SALIDA' || m.tipo === 'MERMA') {
    return { tipo: 'INGRESO', origen: '', destino: m.origen || 'MP' };
  }
  if (m.tipo === 'TRASLADO') {
    return { tipo: 'TRASLADO', origen: m.destino || '', destino: m.origen || '' };
  }
  return { tipo: 'SALIDA', origen: m.destino || 'MP', destino: '' };
}

export function NuevoMovimientoDialog({
  corrigiendo,
  onClose,
  onGuardado,
}: {
  /** Si viene, el diálogo nace con el movimiento CONTRARIO ya armado. */
  corrigiendo: FilaKardexVista | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const corregir = corrigiendo?.editable ? corrigiendo : null;
  const inicial = corregir ? contrarioDe(corregir) : null;

  const [tipo, setTipo] = useState<TipoKardex>(inicial?.tipo ?? 'SALIDA');
  const [dominio, setDominio] = useState<'insumo' | 'tela'>(
    (corregir?.dominio as 'insumo' | 'tela') || 'insumo',
  );
  const [codigo, setCodigo] = useState(corregir?.item_cod ?? '');
  const [cantidad, setCantidad] = useState<number>(corregir?.cantidad ?? 0);
  const [origen, setOrigen] = useState(inicial?.origen ?? '');
  const [destino, setDestino] = useState(inicial?.destino ?? '');
  const [motivo, setMotivo] = useState(corregir ? `Corrige el movimiento del ${new Date(corregir.fecha).toLocaleDateString('es-CL')}` : '');
  const [ot, setOt] = useState('');
  const [area, setArea] = useState('');
  const [recibe, setRecibe] = useState('');
  const [notas, setNotas] = useState('');

  const { guardando, registrar } = useRegistrarKardex();

  const pideOrigen = tipo === 'SALIDA' || tipo === 'TRASLADO' || tipo === 'MERMA' || tipo === 'AJUSTE';
  const pideDestino = tipo === 'INGRESO' || tipo === 'TRASLADO' || tipo === 'DEVOLUCION';

  const problema = useMemo(() => {
    if (!codigo.trim()) return 'Falta el código del artículo.';
    if (!(cantidad > 0)) return 'La cantidad tiene que ser mayor que 0.';
    if (dominio === 'insumo' && cantidad !== Math.round(cantidad)) {
      return 'Los insumos se cuentan en números enteros; la tela sí admite decimales.';
    }
    if (tipo === 'TRASLADO' && (!origen || !destino)) return 'Un traslado necesita de dónde sale y a dónde va.';
    if (tipo === 'TRASLADO' && origen === destino) return 'El origen y el destino son el mismo almacén.';
    if (tipo === 'AJUSTE' && !origen) return 'Elige en qué almacén se ajusta.';
    return null;
  }, [codigo, cantidad, dominio, tipo, origen, destino]);

  const guardar = async () => {
    if (problema) {
      toast.warning(problema);
      return;
    }
    const linea: LineaKardex = {
      dominio,
      item_cod: codigo.trim(),
      tipo,
      cantidad,
      referencia_tipo: ot.trim() ? 'ot' : 'manual',
    };
    if (pideOrigen && origen) linea.origen = origen;
    if (pideDestino && destino) linea.destino = destino;
    if (motivo.trim()) linea.motivo = motivo.trim();
    if (ot.trim()) {
      linea.ot = ot.trim();
      linea.referencia_id = ot.trim();
    }
    if (area.trim()) linea.area = area.trim();
    if (recibe.trim()) linea.recibe = recibe.trim();
    if (notas.trim()) linea.notas = notas.trim();

    const r = await registrar([linea]);
    if (!r.ok) {
      toast.error(r.motivo);
      return;
    }
    toast.success(resumenDeMovimientos(r.respuesta));
    onGuardado();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{corregir ? 'Corregir un movimiento' : 'Nuevo movimiento'}</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-muted-foreground">
          {corregir
            ? 'El original no se toca: se registra el movimiento contrario, y los dos quedan a la vista.'
            : 'Se guarda en el kardex y ajusta el saldo en la misma operación.'}
        </p>

        {/* 1 · Qué está pasando */}
        <div>
          <Label className="mb-1.5 block text-xs">1 · Qué está pasando</Label>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={cn(
                  'h-9 rounded-lg border border-border px-3 text-[0.8125rem] transition-colors',
                  tipo === t.id
                    ? 'border-accent bg-accent/[0.12] font-medium text-accent'
                    : 'text-muted-foreground',
                )}
              >
                {t.texto}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
            El conteo genera su propio movimiento al cerrarse.
          </p>
        </div>

        {/* 2 · Qué artículo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label className="mb-1 block text-xs">2 · Qué artículo</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="MEC 18"
              className="font-mono"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Tipo</Label>
            <select
              value={dominio}
              onChange={(e) => setDominio(e.target.value as 'insumo' | 'tela')}
              className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm"
            >
              <option value="insumo">Insumo</option>
              <option value="tela">Tela</option>
            </select>
          </div>
        </div>

        {/* 3 · Cuánto */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs">
              3 · Cuánto {dominio === 'tela' ? '(metros)' : '(unidades)'}
            </Label>
            {/* Nunca un `<input type=number>`: con la coma de es-CL no deja
                escribir los decimales de la tela. */}
            <InputDecimal
              value={cantidad}
              onChange={setCantidad}
              placeholder={dominio === 'tela' ? '12,5' : '4'}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Sale de</Label>
            <select
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              disabled={!pideOrigen}
              className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm disabled:opacity-40"
            >
              {tipo === 'SALIDA' && <option value="">Liberado primero</option>}
              {tipo !== 'SALIDA' && <option value="">— elegir —</option>}
              {ALMACENES.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAlmacen(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Va a</Label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              disabled={!pideDestino}
              className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm disabled:opacity-40"
            >
              <option value="">{tipo === 'SALIDA' ? 'A una OT' : '— elegir —'}</option>
              {ALMACENES.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAlmacen(a)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {tipo === 'SALIDA' && !origen && (
          <p className="-mt-1 text-[0.6875rem] text-muted-foreground">
            Sin elegir bodega, sale de Liberado y sigue por Materias primas cuando no alcanza. Si se
            reparte, quedan dos líneas agrupadas en el kardex.
          </p>
        )}

        {/* 4 · Motivo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-xs">4 · Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Despacho de OT"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">OT (opcional)</Label>
            <Input value={ot} onChange={(e) => setOt(e.target.value)} placeholder="3221" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Área</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Armado" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Recibe</Label>
            <Input
              value={recibe}
              onChange={(e) => setRecibe(e.target.value)}
              placeholder="Nombre de quien retira"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Nota (opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Para acordarse después de por qué se hizo"
            />
          </div>
        </div>

        {problema && (
          <p className="rounded-lg border border-warning/40 bg-warning/[0.09] px-3 py-2 text-xs">
            {problema}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando || !!problema}>
            {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Registrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NuevoMovimientoDialog;
