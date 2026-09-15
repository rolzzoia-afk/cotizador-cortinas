// Contar y firmar una recepción que está POR CONTAR.
//
//   1. CONTAR: bueno y dañado de cada línea (`PasoContarLineas`).
//   2. FIRMAR: nombre, fecha, firma y ubicación, con el resumen de lo que no
//      calzó (`PasoFirmaRecepcion`).
//
// Al confirmar, la base hace todo junto o nada: el conteo, lo bueno al stock,
// la orden y lo aprendido. Después se le manda a Gerencia; si eso falla, el
// conteo YA quedó guardado y se reintenta desde la ficha: nunca se pierde un
// conteo porque Finanzas no contestó.

import { useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { OrdenCompra } from '@/modules/inventario/compras';
import type { GeoFirma } from '@/modules/ots/types';
import { capturarUbicacion } from '@/modules/visita/geo';
import {
  etiquetaDocumento,
  etiquetaResultado,
  lineasParaConfirmar,
  problemasDeLaFirma,
  problemasDelConteo,
  type LineaConteo,
} from '@/modules/inventario/recepcion';
import { diferenciasDeRecepcion, resumenConteo } from '@/modules/inventario/recepcionDiferencias';
import {
  lineaAConteo,
  useCatalogoCompras,
  type RecepcionDetalle,
} from '@/modules/inventario/recepcionesLecturaStore';
import { confirmarRecepcion, enviarRecepcionFinanzas } from '@/modules/inventario/recepcionStore';
import PasoContarLineas from './PasoContarLineas';
import PasoFirmaRecepcion from './PasoFirmaRecepcion';

type Paso = 'contar' | 'firmar';

export function ContarRecepcionDialog({
  recepcion,
  orden,
  onCerrar,
  onContada,
}: {
  recepcion: RecepcionDetalle;
  orden: OrdenCompra | null;
  onCerrar: () => void;
  onContada: () => void | Promise<void>;
}) {
  const { perfil } = useAuth();
  const { catalogo } = useCatalogoCompras(true);
  // La orden como estaba AL ABRIR: lo que faltaba de cada línea viaja como
  // `esperado`, y si alguien recibió en el medio la base no deja firmar.
  // Recalcularlo con una orden recargada escondería justamente eso.
  const [ordenAlAbrir] = useState(orden);

  const [paso, setPaso] = useState<Paso>('contar');
  const [lineas, setLineas] = useState<LineaConteo[]>(() => recepcion.lineas.map(lineaAConteo));
  const [recibe, setRecibe] = useState(perfil?.nombre ?? '');
  const [notas, setNotas] = useState('');
  const [hayFirma, setHayFirma] = useState(false);
  const [estado, setEstado] = useState<'' | 'ubicacion' | 'guardando' | 'enviando'>('');
  const firmaRef = useRef<SignatureCanvas | null>(null);

  const diferencias = useMemo(
    () =>
      diferenciasDeRecepcion(lineas, ordenAlAbrir, {
        rutFactura: recepcion.proveedor_rut,
        rutOrden: ordenAlAbrir?.proveedor_rut,
      }),
    [lineas, ordenAlAbrir, recepcion.proveedor_rut],
  );
  const resumen = useMemo(() => resumenConteo(lineas, ordenAlAbrir, diferencias), [lineas, ordenAlAbrir, diferencias]);
  const problemasConteo = problemasDelConteo(lineas);
  const problemasFirma = problemasDeLaFirma({ recibe, hayFirma });
  const ocupado = estado !== '';
  const documento = etiquetaDocumento(recepcion.doc_tipo, recepcion.doc_numero);

  const confirmar = async () => {
    const problemas = [...problemasConteo, ...problemasFirma];
    if (problemas.length > 0) {
      toast.warning(problemas[0]);
      return;
    }
    // Un lienzo vacío también da un PNG de varios KB: se mira el lienzo.
    if (!firmaRef.current || firmaRef.current.isEmpty()) {
      setHayFirma(false);
      toast.warning('Falta la firma de quien recibe.');
      return;
    }
    const firma = firmaRef.current.toDataURL('image/png');

    setEstado('ubicacion');
    let geo: GeoFirma | null = null;
    let geoMotivo: string | null = null;
    try {
      geo = await capturarUbicacion();
    } catch (e) {
      geoMotivo = e instanceof Error ? e.message : String(e);
    }

    setEstado('guardando');
    try {
      const r = await confirmarRecepcion(
        recepcion.id,
        { recibe, firma, geo, geoMotivo, notas },
        lineasParaConfirmar(lineas, ordenAlAbrir),
        diferencias,
      );
      const res = etiquetaResultado(r.resultado);
      toast.success(
        `${r.numero} contada · ${res?.texto ?? r.resultado}` +
          (r.danadas > 0 ? ` · ${r.danadas} con dañados` : '') +
          (geo ? '' : ' · sin ubicación'),
      );

      setEstado('enviando');
      try {
        await enviarRecepcionFinanzas(recepcion.id);
        toast.success('Se le mandó a Gerencia.');
      } catch (e) {
        toast.warning(
          `Se guardó y entró al stock, pero no se pudo mandar a Gerencia: ${
            e instanceof Error ? e.message : String(e)
          }. Reintenta desde la ficha.`,
        );
      }
      await onContada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEstado('');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !ocupado && onCerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Contar {recepcion.numero} · {documento}
          </DialogTitle>
          <DialogDescription>
            {recepcion.proveedor_nombre || 'Sin proveedor'}
            {ordenAlAbrir ? ` · ${ordenAlAbrir.numero}` : ' · sin orden de compra'} · lo bueno entra a Materias primas al
            firmar.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {(['contar', 'firmar'] as const).map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-5 bg-border" />}
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full font-mono text-[0.72rem] font-semibold',
                  paso === p ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className={paso === p ? 'font-medium' : 'text-muted-foreground'}>
                {p === 'contar' ? 'Contar' : 'Firmar'}
              </span>
            </li>
          ))}
        </ol>

        {paso === 'contar' ? (
          <PasoContarLineas
            lineas={lineas}
            orden={ordenAlAbrir}
            catalogo={catalogo}
            recepcionId={recepcion.id}
            deshabilitado={ocupado}
            onCambiar={setLineas}
          />
        ) : (
          <PasoFirmaRecepcion
            recibe={recibe}
            onRecibe={setRecibe}
            notas={notas}
            onNotas={setNotas}
            firmaRef={firmaRef}
            onFirma={setHayFirma}
            deshabilitado={ocupado}
            diferencias={diferencias}
            resumen={resumen}
            documento={documento}
          />
        )}

        {paso === 'contar' && problemasConteo.length > 0 && (
          <p className="text-xs text-muted-foreground">{problemasConteo[0]}</p>
        )}

        <DialogFooter className="gap-2">
          {paso === 'firmar' ? (
            <Button
              variant="ghost"
              onClick={() => {
                // El lienzo se desarma al salir del paso: la firma se pierde.
                setHayFirma(false);
                setPaso('contar');
              }}
              disabled={ocupado}
            >
              Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={onCerrar} disabled={ocupado}>
              Cerrar sin guardar
            </Button>
          )}
          {paso === 'contar' ? (
            <Button onClick={() => setPaso('firmar')} disabled={problemasConteo.length > 0}>
              Seguir a la firma
            </Button>
          ) : (
            <Button onClick={() => void confirmar()} disabled={ocupado || problemasFirma.length > 0}>
              {ocupado ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {estado === 'ubicacion'
                    ? 'Tomando la ubicación…'
                    : estado === 'enviando'
                      ? 'Mandando a Gerencia…'
                      : 'Guardando…'}
                </>
              ) : (
                'Confirmar, firmar y entrar al stock'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContarRecepcionDialog;
