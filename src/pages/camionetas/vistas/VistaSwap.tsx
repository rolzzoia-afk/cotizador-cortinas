// Vista de swap en obra: registra un cambio de un insumo por otro
// (ej: mec 14 defectuoso → se usó mec 13). Inserta 2 movimientos
// vinculados (swap_salida + swap_entrada) y ajusta el inventario de
// camioneta + el stock_total de bodega.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '../components/Select';
import type { Camioneta, Insumo, StockItem } from '../Camionetas.types';

interface VistaSwapProps {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string;
  onDone: () => void;
}

export default function VistaSwap({ camioneta, stock, empresaId, onDone }: VistaSwapProps) {
  const [todos, setTodos] = useState<Insumo[]>([]);
  const [salida, setSalida] = useState('');
  const [entrada, setEntrada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('insumos')
        .select('id, nemotecnico, cod, stock_total')
        .eq('empresa_id', empresaId)
        .order('nemotecnico');
      const lista = (data as Insumo[]) ?? [];
      setTodos(lista);

      const stockIds = stock.filter((s) => s.cantidad > 0).map((s) => s.insumo_id);
      if (stockIds.length) setSalida(stockIds[0]);
      else if (lista[0]) setSalida(lista[0].id);
      if (lista[0]) setEntrada(lista[0].id);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const opcionesSalida = stock.filter((s) => s.cantidad > 0).length
    ? stock
        .filter((s) => s.cantidad > 0)
        .map((s) => ({
          id: s.insumo_id,
          label: s.insumos?.nemotecnico ?? s.insumos?.cod ?? s.insumo_id,
        }))
    : todos.map((i) => ({ id: i.id, label: i.nemotecnico ?? i.cod ?? i.id }));

  const confirmar = async () => {
    if (!salida || !entrada) {
      toast.error('Selecciona ambos insumos');
      return;
    }
    if (salida === entrada) {
      toast.warning('Los insumos deben ser diferentes');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre del instalador');
      return;
    }
    setSaving(true);
    const base = {
      empresa_id: empresaId,
      camioneta_id: camioneta.id,
      registrado_por: responsable.trim(),
      motivo: motivo.trim() || null,
    };
    const { error } = await supabase.from('movimientos_camioneta').insert([
      { ...base, insumo_id: salida, tipo: 'swap_salida', insumo_reemplazo_id: entrada, cantidad: 1 },
      { ...base, insumo_id: entrada, tipo: 'swap_entrada', insumo_reemplazo_id: salida, cantidad: 1 },
    ]);
    if (error) {
      toast.error('Error al registrar swap');
      setSaving(false);
      return;
    }

    const stockSalida = stock.find((s) => s.insumo_id === salida);
    if (stockSalida && stockSalida.cantidad > 0) {
      await supabase
        .from('inventario_camioneta')
        .update({ cantidad: Math.max(0, stockSalida.cantidad - 1) })
        .eq('id', stockSalida.id);
    }

    const stockEntrada = stock.find((s) => s.insumo_id === entrada);
    if (stockEntrada) {
      await supabase
        .from('inventario_camioneta')
        .update({ cantidad: stockEntrada.cantidad + 1 })
        .eq('id', stockEntrada.id);
    } else {
      await supabase
        .from('inventario_camioneta')
        .insert({ camioneta_id: camioneta.id, insumo_id: entrada, cantidad: 1 });
    }

    const ins = todos.find((i) => i.id === entrada);
    if (ins) {
      await supabase
        .from('insumos')
        .update({ stock_total: Math.max(0, (ins.stock_total ?? 0) - 1) })
        .eq('id', entrada);
    }

    toast.success('Cambio registrado');
    onDone();
  };

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Registra cuando un insumo fue reemplazado por otro en obra (ej: mec 14 malo → se usó mec 13).
      </p>
      <Label>¿Qué insumo se sacó?</Label>
      <Select value={salida} onChange={setSalida} options={opcionesSalida} className="mb-3" />
      <div className="my-2 text-center text-2xl text-warning">↓</div>
      <Label>¿Qué insumo se puso en su lugar?</Label>
      <Select
        value={entrada}
        onChange={setEntrada}
        options={todos.map((i) => ({ id: i.id, label: i.nemotecnico ?? i.cod ?? i.id }))}
        className="mb-3"
      />
      <Label htmlFor="motivo">Motivo</Label>
      <Input
        id="motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej: mecanismo defectuoso, cliente cambió de tipo, etc."
        className="mb-3"
      />
      <Label htmlFor="swap-resp">Registrado por</Label>
      <Input
        id="swap-resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del instalador"
        className="mb-4"
      />
      <Button onClick={confirmar} className="w-full" disabled={saving}>
        {saving ? 'Guardando…' : 'Registrar cambio'}
      </Button>
    </>
  );
}
