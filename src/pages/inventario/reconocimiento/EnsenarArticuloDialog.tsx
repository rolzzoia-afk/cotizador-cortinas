// Enseñarle un artículo al sistema: cinco tomas guiadas.
//
// Las dos primeras (de frente y de lado) son obligatorias; las otras tres se
// pueden omitir, pero la pantalla dice para qué sirven — la de la ETIQUETA es
// la que permite leer el código cuando dos artículos se parecen, y la de la
// REFERENCIA DE TAMAÑO es lo único que distingue dos piezas iguales de distinto
// porte.
//
// Cada toma se sube y se indexa EN SEGUNDO PLANO: la persona sigue con la
// siguiente sin esperar. Un icono por toma dice si quedó guardada, y si falló
// se puede reintentar sin empezar de nuevo.

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, SkipForward, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import {
  ANGULOS_GUIA,
  faltanObligatorias,
  rutaFotoReconocimiento,
  rutaMiniatura,
  type AnguloGuia,
  type DominioReconocimiento,
} from '@/modules/inventario/reconocimiento';
import { prepararParaEmbedding } from '@/modules/inventario/reconocimientoImagen';
import { indexarFoto, subirFotoReconocimiento } from '@/modules/inventario/reconocimientoStore';
import VistaCamara from './VistaCamara';

type Toma = {
  n: number;
  angulo: AnguloGuia['id'];
  preview: string;
  estado: 'guardando' | 'lista' | 'error';
  motivo?: string;
  reintentar?: () => Promise<void>;
};

export function EnsenarArticuloDialog({
  abierto,
  dominio,
  cod,
  nombre,
  onCerrar,
  onListo,
}: {
  abierto: boolean;
  dominio: DominioReconocimiento;
  cod: string;
  nombre: string;
  onCerrar: () => void;
  /** Se avisa al cerrar si quedó al menos una foto, para refrescar la galería. */
  onListo?: () => void;
}) {
  const { empresaId } = useAuth();
  const [paso, setPaso] = useState(0);
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const contador = useRef(0);
  const previews = useRef<string[]>([]);

  // Las URL de vista previa ocupan memoria hasta que se sueltan.
  useEffect(() => {
    if (!abierto) {
      previews.current.forEach((u) => URL.revokeObjectURL(u));
      previews.current = [];
      setTomas([]);
      setPaso(0);
    }
  }, [abierto]);

  const angulo = ANGULOS_GUIA[paso];
  const hechos = tomas.filter((t) => t.estado !== 'error').map((t) => t.angulo);
  const faltan = faltanObligatorias(hechos);
  const terminado = paso >= ANGULOS_GUIA.length;

  const guardar = async (n: number, foto: Blob, id: AnguloGuia['id']) => {
    if (!empresaId) return;
    const marcar = (cambio: Partial<Toma>) =>
      setTomas((ts) => ts.map((t) => (t.n === n ? { ...t, ...cambio } : t)));
    try {
      const { foto: lista, miniatura } = await prepararParaEmbedding(foto, dominio);
      const path = rutaFotoReconocimiento(empresaId, dominio, cod, id);
      const pathMin = rutaMiniatura(path);
      await subirFotoReconocimiento(path, lista, miniatura, pathMin);
      await indexarFoto({ dominio, cod, path, pathMin: miniatura ? pathMin : null, angulo: id });
      marcar({ estado: 'lista', motivo: undefined, reintentar: undefined });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      marcar({
        estado: 'error',
        motivo,
        reintentar: async () => {
          marcar({ estado: 'guardando', motivo: undefined });
          await guardar(n, foto, id);
        },
      });
    }
  };

  const capturar = async (foto: Blob) => {
    if (!angulo) return;
    setTrabajando(true);
    const n = ++contador.current;
    const preview = URL.createObjectURL(foto);
    previews.current.push(preview);
    setTomas((ts) => [...ts, { n, angulo: angulo.id, preview, estado: 'guardando' }]);
    // Avanzar YA: la subida y el indexado siguen solos por detrás.
    setPaso((p) => p + 1);
    setTrabajando(false);
    void guardar(n, foto, angulo.id);
  };

  const cerrar = () => {
    const guardadas = tomas.filter((t) => t.estado === 'lista').length;
    if (guardadas > 0) {
      toast.success(
        guardadas === 1 ? 'Se guardó 1 foto de este artículo' : `Se guardaron ${guardadas} fotos de este artículo`,
      );
      onListo?.();
    }
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enseñar «{nombre}»</DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">{cod}</p>
        </DialogHeader>

        {/* Dónde vamos */}
        <div className="flex items-center gap-1.5">
          {ANGULOS_GUIA.map((a, i) => {
            const toma = tomas.find((t) => t.angulo === a.id);
            const activo = i === paso;
            return (
              <div
                key={a.id}
                title={a.titulo}
                className={
                  'h-1.5 flex-1 rounded-full ' +
                  (toma?.estado === 'lista'
                    ? 'bg-primary'
                    : toma?.estado === 'error'
                      ? 'bg-destructive'
                      : toma
                        ? 'bg-primary/40'
                        : activo
                          ? 'bg-muted-foreground/60'
                          : 'bg-muted')
                }
              />
            );
          })}
        </div>

        {!terminado && angulo ? (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium">
                {paso + 1}. {angulo.titulo}
                {!angulo.obligatorio && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{angulo.ayuda}</p>
            </div>

            <VistaCamara
              onFoto={(f) => void capturar(f)}
              trabajando={trabajando}
              cuadrado={dominio === 'tela'}
              ayuda={
                dominio === 'tela'
                  ? 'La tela tiene que llenar el recuadro: el fondo confunde al sistema.'
                  : undefined
              }
            />

            {!angulo.obligatorio && (
              <Button
                variant="ghost"
                className="h-10 w-full gap-2 text-muted-foreground"
                onClick={() => setPaso((p) => p + 1)}
              >
                <SkipForward className="h-4 w-4" /> Omitir esta
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm">
              {faltan > 0
                ? 'Faltan las tomas obligatorias: sin ellas el artículo casi no se va a reconocer.'
                : 'Listo. Este artículo ya se puede reconocer con la cámara.'}
            </p>
            <Button className="h-12 w-full" onClick={cerrar}>
              Terminar
            </Button>
            <Button variant="outline" className="h-10 w-full gap-2" onClick={() => setPaso(0)}>
              <RefreshCw className="h-4 w-4" /> Sacar más fotos
            </Button>
          </div>
        )}

        {/* Lo que va quedando */}
        {tomas.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {tomas.map((t) => (
              <div key={t.n} className="relative">
                <img
                  src={t.preview}
                  alt={t.angulo}
                  className="h-16 w-16 rounded border border-border object-cover"
                />
                <span
                  className={
                    'absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ' +
                    (t.estado === 'lista'
                      ? 'bg-primary'
                      : t.estado === 'error'
                        ? 'bg-destructive'
                        : 'bg-muted-foreground')
                  }
                  title={t.estado === 'error' ? t.motivo : undefined}
                >
                  {t.estado === 'guardando' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : t.estado === 'lista' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </span>
                {t.estado === 'error' && (
                  <button
                    type="button"
                    className="absolute inset-x-0 bottom-0 bg-destructive/85 py-0.5 text-[0.6rem] text-white"
                    onClick={() => void t.reintentar?.()}
                  >
                    Reintentar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EnsenarArticuloDialog;
