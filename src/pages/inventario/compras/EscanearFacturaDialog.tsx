// Llegó un papel: se escanea y se revisa. NADA entra al stock todavía.
//
//   1. EL PAPEL: una foto o el PDF. Se sube al bucket privado y la app lo lee
//      (proveedor, número, fecha y líneas, sin precios).
//   2. REVISAR: la cabecera y cada línea emparejada con la orden. Todo se
//      corrige acá, con el papel en la mano.
//
// Al guardar queda POR CONTAR: la puede contar otra persona, otro día. «Contar
// ahora» guarda y abre el conteo de una vez.
//
// Si la lectura falla (sin señal, un HEIC de iPhone, un papel ilegible) se
// sigue sin ella: la cabecera a mano y las líneas propuestas desde la orden.

import { useState } from 'react';
import { Camera, FileImage, FileUp, Loader2, TriangleAlert } from 'lucide-react';
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
import type { OrdenCompra } from '@/modules/inventario/compras';
import { esHeic, problemasDelPapel } from '@/modules/inventario/recepcion';
import { emparejarConCatalogo } from '@/modules/inventario/recepcionCatalogo';
import {
  avisosDeCabecera,
  cabeceraDesdeExtraccion,
  emparejarConOrden,
  lineasDesdeOrden,
  lineasParaAbrir,
  problemasDeRevision,
  type CabeceraDocumento,
  type ExtraccionFactura,
  type LineaRevision,
} from '@/modules/inventario/recepcionFactura';
import { leerAprendidas, useCatalogoCompras } from '@/modules/inventario/recepcionesLecturaStore';
import {
  abrirRecepcion,
  escanearFactura,
  subirDocumentoRecepcion,
  urlFirmadaDocumento,
} from '@/modules/inventario/recepcionStore';
import CabeceraDocumentoForm from './CabeceraDocumentoForm';
import PasoRevisarFactura from './PasoRevisarFactura';

type Fase = 'papel' | 'leyendo' | 'revisar';

export function EscanearFacturaDialog({
  orden,
  onCerrar,
  onAbierta,
}: {
  /** `null` = sin orden de compra (solo un administrador llega acá). */
  orden: OrdenCompra | null;
  onCerrar: () => void;
  onAbierta: (recepcionId: string, contarAhora: boolean) => void;
}) {
  const { empresaId } = useAuth();
  const { catalogo } = useCatalogoCompras(true);

  const [fase, setFase] = useState<Fase>('papel');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [doc, setDoc] = useState<{ path: string; mime: string } | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [extraccion, setExtraccion] = useState<ExtraccionFactura | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [cab, setCab] = useState<CabeceraDocumento>(() => cabeceraDesdeExtraccion(null, orden));
  const [lineas, setLineas] = useState<LineaRevision[]>([]);
  const [guardando, setGuardando] = useState(false);

  const heic = archivo ? esHeic(archivo) : false;

  const elegirArchivo = (f: File | null) => {
    setArchivo(f);
    setDoc(null);
    setErrorLectura(null);
  };

  /** Sube el papel (una sola vez) y devuelve dónde quedó. */
  const subir = async (): Promise<{ path: string; mime: string } | null> => {
    if (doc) return doc;
    if (!archivo || !empresaId) return null;
    const subido = await subirDocumentoRecepcion(empresaId, orden?.id ?? 'sin-orden', archivo);
    setDoc(subido);
    return subido;
  };

  const leer = async () => {
    setFase('leyendo');
    setErrorLectura(null);
    try {
      const subido = await subir();
      if (!subido) throw new Error('Elige primero el papel.');
      if (heic) {
        throw new Error('Es una foto HEIC y la lectura automática no la abre. Quedó guardada como respaldo.');
      }
      const [lectura, aprendidas] = await Promise.all([escanearFactura(subido.path), leerAprendidas()]);
      const c = cabeceraDesdeExtraccion(lectura.extraccion, orden);
      setExtraccion(lectura.extraccion);
      setModelo(lectura.modelo);
      setCab(c);
      setLineas(
        orden
          ? emparejarConOrden(lectura.extraccion.lineas, orden, aprendidas, c.rut)
          : emparejarConCatalogo(lectura.extraccion.lineas, catalogo, aprendidas, c.rut),
      );
      setFase('revisar');
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : String(e));
      setFase('papel');
    }
  };

  /** Sin lectura: cabecera a mano, y las líneas que faltan de la orden como propuesta. */
  const seguirSinLectura = async () => {
    try {
      const subido = await subir();
      if (!subido) {
        toast.warning('Primero hay que subir el papel: es el respaldo de lo que se cuenta.');
        return;
      }
      setExtraccion(null);
      setModelo(null);
      setCab(cabeceraDesdeExtraccion(null, orden));
      setLineas(orden ? lineasDesdeOrden(orden) : []);
      setFase('revisar');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const verPapel = async () => {
    if (!doc) return;
    const url = await urlFirmadaDocumento(doc.path);
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('No se pudo abrir el papel.');
  };

  const problemas = fase === 'revisar' ? [...problemasDelPapel(cab), ...problemasDeRevision(lineas, orden)] : [];
  const avisos = fase === 'revisar' ? avisosDeCabecera(cab, extraccion, orden) : [];

  const guardar = async (contarAhora: boolean) => {
    if (problemas.length > 0) {
      toast.warning(problemas[0]);
      return;
    }
    if (!doc) return;
    setGuardando(true);
    try {
      const r = await abrirRecepcion(
        orden?.id ?? null,
        {
          tipo: cab.tipo,
          numero: cab.numero,
          fecha: cab.fecha || null,
          path: doc.path,
          mime: doc.mime,
          proveedor_rut: cab.rut.trim() || null,
          proveedor_nombre: cab.nombre.trim() || null,
          // Queda escrito si la cabecera y las líneas se tipearon a mano: sirve
          // para saber después de dónde salió un error.
          escaneo_error: extraccion ? null : (errorLectura ?? 'Sin lectura automática'),
        },
        lineasParaAbrir(lineas),
        extraccion,
        modelo,
      );
      toast.success(`${r.numero} guardada: queda por contar.`);
      for (const a of r.avisos) toast.warning(a);
      onAbierta(r.recepcionId, contarAhora);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const ocupado = fase === 'leyendo' || guardando;

  return (
    <Dialog open onOpenChange={(v) => !v && !ocupado && onCerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{orden ? `Llegó mercadería de ${orden.numero}` : 'Recibir sin orden de compra'}</DialogTitle>
          <DialogDescription>
            {orden ? `${orden.proveedor_nombre || 'Sin proveedor'} · ` : 'Solo un administrador · '}
            nada entra al stock hasta contar y firmar.
          </DialogDescription>
        </DialogHeader>

        {fase !== 'revisar' ? (
          <div className="flex flex-col gap-3.5">
            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              Saca una foto de la factura o de la guía (o sube el PDF). La app la lee y propone las líneas; después
              las revisas con el papel en la mano.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[0.8125rem] hover:bg-secondary">
                <Camera className="h-4 w-4" /> Sacar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={ocupado}
                  onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[0.8125rem] hover:bg-secondary">
                <FileUp className="h-4 w-4" /> Elegir PDF o foto
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  disabled={ocupado}
                  onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
                />
              </label>
              {archivo && <span className="text-xs text-muted-foreground">{archivo.name}</span>}
            </div>

            {heic && (
              <div className="rounded-lg border border-warning/35 bg-warning/[0.09] px-3.5 py-2.5 text-xs leading-relaxed">
                Es una foto <b>HEIC</b> de iPhone: se guarda como respaldo, pero la lectura automática no la abre y
                tendrás que escribir las líneas. Para la próxima: Ajustes → Cámara → Formatos → «Más compatible».
              </div>
            )}

            {fase === 'leyendo' && (
              <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el papel… (10 a 30 segundos)
              </div>
            )}

            {errorLectura && (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] px-3.5 py-2.5 text-xs leading-relaxed">
                <span className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  {errorLectura}
                </span>
                <div className="flex flex-wrap gap-2">
                  {!heic && (
                    <Button size="sm" variant="outline" onClick={() => void leer()}>
                      Volver a intentar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void seguirSinLectura()}>
                    Seguir sin lectura automática
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <CabeceraDocumentoForm cab={cab} onCambiar={setCab} deshabilitado={guardando} />

            {avisos.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg border border-warning/35 bg-warning/[0.09] px-3.5 py-2.5 text-xs leading-relaxed">
                {avisos.map((a) => (
                  <li key={a} className="flex items-start gap-1.5">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {a}
                  </li>
                ))}
              </ul>
            )}
            {!extraccion && orden && (
              <p className="text-xs text-muted-foreground">
                Sin lectura automática: las cantidades vienen de lo que falta de la orden.{' '}
                <b className="font-medium text-foreground">Corrígelas con lo que dice el papel.</b>
              </p>
            )}

            <PasoRevisarFactura
              lineas={lineas}
              orden={orden}
              catalogo={catalogo}
              deshabilitado={guardando}
              onCambiar={setLineas}
            />

            {problemas.length > 0 && <p className="text-xs text-muted-foreground">{problemas[0]}</p>}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {doc && (
            <Button variant="ghost" onClick={() => void verPapel()} className="mr-auto" disabled={ocupado}>
              <FileImage className="h-4 w-4" /> Ver el papel
            </Button>
          )}
          <Button variant="ghost" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          {fase !== 'revisar' ? (
            <Button onClick={() => void (heic ? seguirSinLectura() : leer())} disabled={!archivo || ocupado}>
              {fase === 'leyendo' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {heic ? 'Subir y seguir sin lectura' : 'Leer el papel'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void guardar(false)} disabled={guardando || problemas.length > 0}>
                Guardar para contar
              </Button>
              <Button onClick={() => void guardar(true)} disabled={guardando || problemas.length > 0}>
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Contar ahora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EscanearFacturaDialog;
