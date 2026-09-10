// Ingresar un paño a la colmena, o mover uno de sitio.
//
// Es el mismo formulario: lo que cambia es que al ingresar se pregunta también
// el código y la medida. Hasta ahora un paño solo podía entrar por la
// importación del Excel o por un corte, así que un retazo que aparecía en el
// galpón no tenía manera de llegar al mapa.
//
// La posición se escribe como la escribe la importación —`MAPA M7-3`, con
// rack/fila/columna en `datos_extra`— para que las dos fuentes se dibujen en
// la misma grilla. Las zonas de repisa (Rolzzo) no tienen coordenada: ahí la
// ubicación es el texto del estante, «A-19».

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import type { ColmenaPano } from '@/modules/admin/colmena';
import { medidaTexto, ubicacionTexto } from '@/modules/inventario/colmenaVista';
import { ZONAS, zonaDe } from '@/modules/telas/colmenaViva';

type Modo = 'ingresar' | 'mover';

/** Las zonas que se pueden elegir a mano. «Cortes nuevos» la escribe el corte. */
const ZONAS_ELEGIBLES = ['GALPON', 'LIBERADO', 'ROLZZO'];

function entero(v: number): number | null {
  return Number.isInteger(v) && v >= 1 ? v : null;
}

export function UbicarPanoDialog({
  modo,
  pano,
  panos,
  empresaId,
  zonaInicial,
  onClose,
  onGuardado,
}: {
  modo: Modo;
  /** El paño que se mueve. Al ingresar viene `null`. */
  pano: ColmenaPano | null;
  /** Todos los paños, para avisar si la celda ya está ocupada. */
  panos: ColmenaPano[];
  empresaId: string;
  zonaInicial: string;
  onClose: () => void;
  onGuardado: () => void | Promise<void>;
}) {
  const [codigo, setCodigo] = useState(pano?.codigo ?? '');
  const [ancho, setAncho] = useState(Number(pano?.medida_ancho ?? 0));
  const [alto, setAlto] = useState(Number(pano?.medida_alto ?? 0));
  const [zona, setZona] = useState(pano ? zonaDe(pano) : zonaInicial);
  const [rack, setRack] = useState(Number(pano?.datos_extra?.rack ?? 0));
  const [fila, setFila] = useState(Number(pano?.datos_extra?.m ?? 0));
  const [col, setCol] = useState(Number(pano?.datos_extra?.col ?? 0));
  const [estante, setEstante] = useState(pano?.ubicacion ?? '');
  const [guardando, setGuardando] = useState(false);

  const esGrilla = (ZONAS[zona]?.modo ?? 'grid') === 'grid';
  const prefijo = ZONAS[zona]?.filaPrefix ?? '';

  // Quién está en la celda de destino. Un paño por celda: si ya hay otro, es
  // un dato del galpón que alguien tiene que resolver antes, no un choque que
  // la pantalla pueda decidir sola.
  const ocupante = useMemo(() => {
    if (!esGrilla) return null;
    const r = entero(rack);
    const f = entero(fila);
    const c = entero(col);
    if (r == null || f == null || c == null) return null;
    return (
      panos.find(
        (p) =>
          p.id !== pano?.id &&
          zonaDe(p) === zona &&
          Number(p.datos_extra?.rack) === r &&
          Number(p.datos_extra?.m) === f &&
          Number(p.datos_extra?.col) === c,
      ) ?? null
    );
  }, [panos, pano?.id, zona, rack, fila, col, esGrilla]);

  const problema = useMemo(() => {
    if (modo === 'ingresar') {
      if (!codigo.trim()) return 'Falta el código de la tela.';
      if (!(ancho > 0) || !(alto > 0)) return 'Falta la medida del paño.';
    }
    if (esGrilla) {
      if (entero(rack) == null) return 'El rack es un número desde 1.';
      if (entero(fila) == null) return 'La fila es un número desde 1.';
      if (entero(col) == null) return 'La columna es un número desde 1.';
    } else if (!estante.trim()) {
      return 'Falta el estante, por ejemplo «A-19».';
    }
    return null;
  }, [modo, codigo, ancho, alto, esGrilla, rack, fila, col, estante]);

  const guardar = async () => {
    if (problema) {
      toast.warning(problema);
      return;
    }
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      const ubicacion = esGrilla ? `MAPA ${prefijo}${fila}-${col}` : estante.trim().toUpperCase();
      const posicion = esGrilla
        ? { zona, rack: entero(rack), m: entero(fila), col: entero(col) }
        : // Al pasar a una repisa se BORRA la coordenada de grilla: si quedara,
          // el paño seguiría dibujándose en una celda donde ya no está.
          { zona, rack: null, m: null, col: null, cell: null };

      if (modo === 'mover' && pano) {
        const { error } = await supabase
          .from('colmena_panos')
          .update({
            ubicacion,
            datos_extra: { ...(pano.datos_extra || {}), ...posicion, movido_en: ahora },
          })
          .eq('id', pano.id);
        if (error) throw error;
        toast.success(`${pano.codigo} quedó en ${ubicacion}.`);
      } else {
        const { error } = await supabase.from('colmena_panos').insert({
          empresa_id: empresaId,
          codigo: codigo.trim().toUpperCase(),
          medida_ancho: ancho,
          medida_alto: alto,
          disponible: true,
          ubicacion,
          datos_extra: { fuente: 'ingreso_manual', creadoEn: ahora, ...posicion },
        });
        if (error) throw error;
        toast.success(`${codigo.trim().toUpperCase()} entró a la colmena en ${ubicacion}.`);
      }
      await onGuardado();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{modo === 'mover' ? 'Mover el paño' : 'Ingresar un paño'}</DialogTitle>
        </DialogHeader>
        {modo === 'mover' && pano ? (
          <p className="-mt-1 text-xs text-muted-foreground">
            {pano.codigo} · {medidaTexto(pano.medida_ancho, pano.medida_alto)} cm. Hoy está en{' '}
            {ubicacionTexto(pano)}.
          </p>
        ) : (
          <p className="-mt-1 text-xs text-muted-foreground">
            Un retazo que apareció en el galpón y no está en el mapa. Entra disponible, con la
            medida que se le tomó.
          </p>
        )}

        {modo === 'ingresar' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Código de la tela</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="SC 48"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Ancho (cm)</Label>
              <InputDecimal value={ancho} onChange={setAncho} placeholder="120" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Alto (cm)</Label>
              <InputDecimal value={alto} onChange={setAlto} placeholder="240" />
            </div>
          </div>
        )}

        <div>
          <Label className="mb-1 block text-xs">Zona</Label>
          <select
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm"
          >
            {ZONAS_ELEGIBLES.map((z) => (
              <option key={z} value={z}>
                {ZONAS[z]?.label ?? z}
              </option>
            ))}
          </select>
        </div>

        {esGrilla ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Rack</Label>
              <InputDecimal value={rack} onChange={setRack} placeholder="3" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">
                Fila {prefijo ? `(${prefijo}…)` : ''}
              </Label>
              <InputDecimal value={fila} onChange={setFila} placeholder="7" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Columna</Label>
              <InputDecimal value={col} onChange={setCol} placeholder="3" />
            </div>
          </div>
        ) : (
          <div>
            <Label className="mb-1 block text-xs">Estante</Label>
            <Input
              value={estante}
              onChange={(e) => setEstante(e.target.value.toUpperCase())}
              placeholder="A-19"
              className="font-mono"
            />
          </div>
        )}

        {ocupante && (
          <p className="rounded-lg border border-warning/35 bg-warning/[0.09] px-3 py-2.5 text-xs leading-relaxed">
            En esa celda ya está {ocupante.codigo} ({medidaTexto(ocupante.medida_ancho, ocupante.medida_alto)}{' '}
            cm). Cada celda es una posición física: si van los dos, el mapa va a mostrar solo uno.
          </p>
        )}
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
            {guardando ? 'Guardando…' : modo === 'mover' ? 'Mover' : 'Ingresar a la colmena'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UbicarPanoDialog;
