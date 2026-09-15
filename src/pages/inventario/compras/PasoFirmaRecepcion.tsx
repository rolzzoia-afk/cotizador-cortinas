// La firma de quien recibió: nombre, fecha, firma y —al confirmar— la
// ubicación del teléfono. Al lado, lo que va a pasar y lo que se le va a
// reportar a Gerencia.
//
// La ubicación NUNCA bloquea: si el teléfono no la da (permiso negado, bodega
// sin señal), se firma igual y queda escrito por qué, como en la visita.

import type { RefObject } from 'react';
import { Eraser, MapPin } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { etiquetaOrden, formatearCantidad } from '@/modules/inventario/compras';
import { fechaHoraCL } from '@/modules/inventario/recepcion';
import type { Diferencia, ResumenConteo } from '@/modules/inventario/recepcionDiferencias';
import ResumenDiferencias from './ResumenDiferencias';

export function PasoFirmaRecepcion({
  recibe,
  onRecibe,
  notas,
  onNotas,
  firmaRef,
  onFirma,
  deshabilitado,
  diferencias,
  resumen,
  documento,
}: {
  recibe: string;
  onRecibe: (v: string) => void;
  notas: string;
  onNotas: (v: string) => void;
  firmaRef: RefObject<SignatureCanvas | null>;
  onFirma: (hay: boolean) => void;
  deshabilitado?: boolean;
  diferencias: Diferencia[];
  resumen: ResumenConteo;
  documento: string;
}) {
  const estadoFinal = resumen.estadoOrden ? etiquetaOrden(resumen.estadoOrden) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rec-recibe">Quién recibe</Label>
            <Input
              id="rec-recibe"
              value={recibe}
              onChange={(e) => onRecibe(e.target.value)}
              disabled={deshabilitado}
              placeholder="Nombre y apellido"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <div className="flex h-10 items-center rounded-md border border-border bg-secondary/40 px-3 font-mono text-[0.8125rem]">
              {fechaHoraCL(new Date().toISOString(), false)}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Firma</Label>
          <div className="overflow-hidden rounded-lg bg-white">
            <SignatureCanvas
              ref={firmaRef as RefObject<SignatureCanvas>}
              onEnd={() => onFirma(!(firmaRef.current?.isEmpty() ?? true))}
              canvasProps={{
                className: 'w-full',
                width: 480,
                height: 170,
                style: { width: '100%', height: 170, display: 'block' },
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              firmaRef.current?.clear();
              onFirma(false);
            }}
            disabled={deshabilitado}
          >
            <Eraser className="h-3.5 w-3.5" /> Limpiar firma
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-notas">Notas para Gerencia (opcional)</Label>
          <Input
            id="rec-notas"
            value={notas}
            onChange={(e) => onNotas(e.target.value)}
            disabled={deshabilitado}
            placeholder="Ej.: el chofer esperó el conteo; se avisó al proveedor"
          />
        </div>
        <p className="flex items-start gap-1.5 text-[0.72rem] leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Al confirmar se guarda la ubicación del teléfono junto a la firma. Si no la da, se firma igual y queda
          anotado por qué.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-secondary/40 p-3.5 text-[0.8125rem]">
          <div className="mb-2 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">Al confirmar</div>
          <ul className="flex flex-col gap-1.5">
            <li>
              {resumen.lineas === 1 ? '1 línea contada' : `${resumen.lineas} líneas contadas`} ·{' '}
              <span className="font-mono">{documento}</span>
            </li>
            {resumen.unidadesInsumo > 0 && (
              <li>
                Entran <b className="font-mono font-medium">{formatearCantidad(resumen.unidadesInsumo)}</b> un de insumos
              </li>
            )}
            {resumen.metrosTela > 0 && (
              <li>
                Entran <b className="font-mono font-medium">{formatearCantidad(resumen.metrosTela)}</b> m de tela
              </li>
            )}
            {resumen.conDanados > 0 && (
              <li className="text-destructive">
                {resumen.conDanados === 1 ? '1 línea' : `${resumen.conDanados} líneas`} con dañados, que no entran
              </li>
            )}
            {estadoFinal && (
              <li className="flex items-center gap-1.5 pt-1">
                La orden queda <Badge variant={estadoFinal.variante}>{estadoFinal.texto}</Badge>
              </li>
            )}
          </ul>
        </div>
        <div>
          <div className="mb-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
            Lo que se le informa a Gerencia
            {resumen.errores > 0 && ` · ${resumen.errores} ${resumen.errores === 1 ? 'error' : 'errores'}`}
            {resumen.avisos > 0 && ` · ${resumen.avisos} ${resumen.avisos === 1 ? 'aviso' : 'avisos'}`}
          </div>
          <ResumenDiferencias diferencias={diferencias} />
        </div>
      </div>
    </div>
  );
}

export default PasoFirmaRecepcion;
