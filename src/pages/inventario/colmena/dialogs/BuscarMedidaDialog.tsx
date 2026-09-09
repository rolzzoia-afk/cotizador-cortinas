// «Buscar medida»: de qué paño sale la pieza que hay que cortar.
//
// Es la pregunta para la que existe la colmena. Ordena por lo que sobra, así
// que arriba queda el retazo más justo: cortar del más grande deja un pedazo
// nuevo que vuelve al rack y la colmena no baja nunca.
//
// NO se gira el paño: la tela tiene diseño y no se acuesta sola, la misma
// regla del optimizador. Un paño de 240 × 120 no sirve para una pieza de
// 120 × 240 aunque los números sean los mismos.

import { useMemo, useState } from 'react';
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
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  desperdicioCm2,
  medidaTexto,
  panosQueCaben,
  ubicacionTexto,
} from '@/modules/inventario/colmenaVista';

const MAX_RESULTADOS = 40;

export function BuscarMedidaDialog({
  panos,
  onClose,
  onElegir,
  onResaltar,
}: {
  panos: ColmenaPano[];
  onClose: () => void;
  /** Al elegir uno: se selecciona en el mapa y el diálogo se cierra. */
  onElegir: (p: ColmenaPano) => void;
  /** Los ids que el mapa tiene que dejar marcados al cerrar. */
  onResaltar: (ids: Set<string>) => void;
}) {
  const [ancho, setAncho] = useState(0);
  const [alto, setAlto] = useState(0);
  const [codigo, setCodigo] = useState('');

  const pide = ancho > 0 && alto > 0;
  const caben = useMemo(
    () => (pide ? panosQueCaben(panos, { ancho, alto }, codigo) : []),
    [panos, ancho, alto, codigo, pide],
  );

  const cerrarMarcando = () => {
    onResaltar(new Set(caben.map((p) => p.id)));
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Buscar un paño por medida</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-muted-foreground">
          Escribe la pieza que hay que cortar. Salen los paños de los que sale, del que menos
          desperdicia al que más. El paño no se gira: se compara ancho con ancho y alto con alto.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs">Ancho de la pieza (cm)</Label>
            <InputDecimal value={ancho} onChange={setAncho} placeholder="120" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Alto (cm)</Label>
            <InputDecimal value={alto} onChange={setAlto} placeholder="240" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Código (opcional)</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="SC 48"
              className="font-mono"
            />
          </div>
        </div>

        {!pide ? (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
            Falta la medida. Con el ancho y el alto se busca en los {panos.length.toLocaleString('es-CL')}{' '}
            paños de la colmena.
          </p>
        ) : caben.length === 0 ? (
          <p className="rounded-lg border border-warning/35 bg-warning/[0.09] px-3 py-2.5 text-xs leading-relaxed">
            Ningún paño disponible da para {medidaTexto(ancho, alto)} cm
            {codigo ? ` en ${codigo}` : ''}. Esta pieza sale de un rollo.
          </p>
        ) : (
          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
            <div className="text-xs text-muted-foreground">
              {caben.length.toLocaleString('es-CL')} paño{caben.length === 1 ? '' : 's'} sirve
              {caben.length === 1 ? '' : 'n'}
            </div>
            {caben.slice(0, MAX_RESULTADOS).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onResaltar(new Set(caben.map((x) => x.id)));
                  onElegir(p);
                }}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent/[0.06]"
              >
                <span className="font-mono text-sm font-semibold">{p.codigo}</span>
                <span className="font-mono text-xs">
                  {medidaTexto(p.medida_ancho, p.medida_alto)} cm
                </span>
                <span className="ml-auto text-right text-[0.6875rem] text-muted-foreground">
                  <span className="block">{ubicacionTexto(p)}</span>
                  <span className="block">
                    sobran{' '}
                    {(desperdicioCm2(p, { ancho, alto }) / 10_000).toLocaleString('es-CL', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    m²
                  </span>
                </span>
              </button>
            ))}
            {caben.length > MAX_RESULTADOS && (
              <div className="px-1 text-[0.6875rem] text-muted-foreground">
                y {(caben.length - MAX_RESULTADOS).toLocaleString('es-CL')} más. Ajusta la medida o
                el código para acortar la lista.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={cerrarMarcando} disabled={caben.length === 0}>
            Marcarlos en el mapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BuscarMedidaDialog;
