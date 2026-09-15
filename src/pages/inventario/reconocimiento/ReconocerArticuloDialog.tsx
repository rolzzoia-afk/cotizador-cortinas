// Apuntar la cámara a un artículo y que la app diga cuál es.
//
// El orden importa, y es todo por velocidad:
//   1. Se lee el QR de la etiqueta EN EL TELÉFONO. Si está, se acabó: no hay
//      consulta, no hay costo y es exacto.
//   2. La foto se manda a reconocer y, AL MISMO TIEMPO, se sube al bucket. No
//      se espera la subida para mostrar los candidatos.
//   3. Si el parecido dejó dudas, la segunda opinión corre DESPUÉS, con la
//      lista ya en pantalla. Se reordena sola cuando llega; si la persona ya
//      eligió, se descarta.
//
// La app propone, la persona confirma. Confirmar además enseña: esa foto pasa a
// ser una referencia más del artículo.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { leerQRDeFoto } from '@/modules/bodega/qrDeFoto';
import {
  parsearPayloadQR,
  rutaConsulta,
  rutaMiniatura,
  textoDeBanda,
  type Candidato,
  type DominioReconocimiento,
  type Juicio,
} from '@/modules/inventario/reconocimiento';
import { prepararParaEmbedding } from '@/modules/inventario/reconocimientoImagen';
import {
  calentarReconocimiento,
  confirmarReconocimiento,
  juzgarFoto,
  reconocerFoto,
  subirFotoReconocimiento,
} from '@/modules/inventario/reconocimientoStore';
import VistaCamara from './VistaCamara';

type Consulta = {
  id: string | null;
  dataUrl: string;
  path: string;
  pathMin: string | null;
  candidatos: Candidato[];
  juez: Juicio | null;
  afinando: boolean;
};

const COLOR_BANDA: Record<string, string> = {
  seguro: 'bg-primary/15 text-primary',
  probable: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  dudoso: 'bg-muted text-muted-foreground',
};

export function ReconocerArticuloDialog({
  abierto,
  dominio,
  onElegir,
  onCerrar,
}: {
  abierto: boolean;
  /** `null` busca en insumos y telas a la vez. */
  dominio: DominioReconocimiento | null;
  onElegir: (dominio: DominioReconocimiento, cod: string) => void;
  onCerrar: () => void;
}) {
  const { empresaId } = useAuth();
  const [estado, setEstado] = useState<'camara' | 'procesando' | 'resultado'>('camara');
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vigente = useRef(0);

  useEffect(() => {
    if (abierto) void calentarReconocimiento();
    if (!abierto) {
      setEstado('camara');
      setConsulta(null);
      setError(null);
      vigente.current++;
    }
  }, [abierto]);

  const elegir = useCallback(
    async (c: { dominio: DominioReconocimiento; cod: string }) => {
      const actual = consulta;
      onElegir(c.dominio, c.cod);
      onCerrar();
      // Guardar la elección es lo último y no bloquea: la ficha ya se abrió.
      if (actual?.id) {
        try {
          await confirmarReconocimiento(actual.id, c, actual.path, actual.pathMin);
        } catch {
          /* la elección igual sirvió; el aprendizaje se pierde y no pasa nada */
        }
      }
    },
    [consulta, onElegir, onCerrar],
  );

  const descartar = async () => {
    const actual = consulta;
    setConsulta(null);
    setEstado('camara');
    if (actual?.id) {
      try {
        await confirmarReconocimiento(actual.id, null, actual.path, actual.pathMin);
      } catch {
        /* nada que hacer: era solo para dejar anotado que no era ninguno */
      }
    }
  };

  const procesar = async (foto: Blob) => {
    if (!empresaId) return;
    const turno = ++vigente.current;
    setEstado('procesando');
    setError(null);
    try {
      // 1. El QR gana sobre cualquier parecido, y sale gratis.
      const texto = await leerQRDeFoto(foto);
      const porQR = parsearPayloadQR(texto);
      if (porQR && (!dominio || porQR.dominio === dominio)) {
        toast.success(`Leído de la etiqueta: ${porQR.cod}`);
        onElegir(porQR.dominio, porQR.cod);
        onCerrar();
        return;
      }

      const { foto: lista, miniatura, dataUrl } = await prepararParaEmbedding(
        foto,
        dominio ?? 'insumo',
      );
      const path = rutaConsulta(empresaId);
      const pathMin = miniatura ? rutaMiniatura(path) : null;

      // 2. Reconocer y subir, a la vez. La subida solo importa si confirma.
      const [r] = await Promise.all([
        reconocerFoto(dataUrl, dominio),
        subirFotoReconocimiento(path, lista, miniatura, pathMin ?? undefined).catch(() => undefined),
      ]);
      if (turno !== vigente.current) return;

      const nueva: Consulta = {
        id: r.reconocimiento_id,
        dataUrl,
        path,
        pathMin,
        candidatos: r.candidatos ?? [],
        juez: null,
        afinando: r.duda && !!r.reconocimiento_id && (r.candidatos ?? []).length > 0,
      };
      setConsulta(nueva);
      setEstado('resultado');

      // 3. La segunda opinión, ya con la lista en pantalla.
      if (nueva.afinando && nueva.id) {
        try {
          const j = await juzgarFoto(nueva.id, dataUrl);
          if (turno !== vigente.current) return;
          setConsulta((c) =>
            c && c.id === nueva.id
              ? { ...c, candidatos: j.candidatos ?? c.candidatos, juez: j.juez, afinando: false }
              : c,
          );
        } catch {
          setConsulta((c) => (c && c.id === nueva.id ? { ...c, afinando: false } : c));
        }
      }
    } catch (e) {
      if (turno !== vigente.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setEstado('camara');
    }
  };

  const candidatos = consulta?.candidatos ?? [];

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dominio === 'tela' ? 'Reconocer una tela' : dominio === 'insumo' ? 'Reconocer un insumo' : 'Reconocer'}
          </DialogTitle>
        </DialogHeader>

        {estado === 'camara' && (
          <>
            {error && (
              <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <VistaCamara
              onFoto={(f) => void procesar(f)}
              cuadrado={dominio === 'tela'}
              etiquetaBoton="Reconocer"
              ayuda={
                dominio === 'tela'
                  ? 'Que la tela llene el recuadro. Si la etiqueta tiene QR, apúntale: es exacto.'
                  : 'Acércate para que el artículo llene el cuadro. Si tiene etiqueta con QR, apúntale.'
              }
            />
          </>
        )}

        {estado === 'procesando' && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Buscando parecidos…
          </div>
        )}

        {estado === 'resultado' && consulta && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <img
                src={consulta.dataUrl}
                alt="La foto que sacaste"
                className="h-20 w-20 rounded border border-border object-cover"
              />
              <div className="flex-1 text-xs text-muted-foreground">
                {candidatos.length === 0 ? (
                  <p>
                    No se parece a ningún artículo enseñado. Si es uno que ya está en el sistema,
                    ábrelo y usa «Enseñar este artículo».
                  </p>
                ) : (
                  <p>Toca el que sea. Si ninguno es, dilo: así el sistema no aprende algo falso.</p>
                )}
                {consulta.afinando && (
                  <p className="mt-1 flex items-center gap-1 text-primary">
                    <Sparkles className="h-3 w-3 animate-pulse" /> Afinando la lista…
                  </p>
                )}
                {consulta.juez?.codigo_leido && (
                  <p className="mt-1 text-foreground">
                    Se leyó en la foto: <strong>{consulta.juez.codigo_leido}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {candidatos.map((c) => (
                <button
                  key={`${c.dominio}:${c.cod}`}
                  type="button"
                  onClick={() => void elegir({ dominio: c.dominio, cod: c.cod })}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left hover:border-primary hover:bg-muted/40"
                >
                  {c.miniatura_url ? (
                    <img
                      src={c.miniatura_url}
                      alt={c.cod}
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">{c.cod}</p>
                  </div>
                  <span
                    className={
                      'shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] ' +
                      (COLOR_BANDA[c.banda] ?? COLOR_BANDA.dudoso)
                    }
                  >
                    {textoDeBanda(c.banda)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button variant="outline" className="h-11 w-full gap-2" onClick={() => void descartar()}>
                <X className="h-4 w-4" /> No es ninguno · sacar otra foto
              </Button>
              {candidatos.length > 0 && (
                <p className="text-center text-[0.7rem] text-muted-foreground">
                  <Check className="mr-1 inline h-3 w-3" />
                  Al elegir, esta foto queda como referencia y el sistema acierta más la próxima vez.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReconocerArticuloDialog;
