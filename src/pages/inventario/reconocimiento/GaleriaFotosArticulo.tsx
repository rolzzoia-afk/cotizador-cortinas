// Las fotos con las que el sistema reconoce un artículo.
//
// Vive dentro de la ficha, en su propia pestaña. Eso no es cosmético: las
// consultas de esta tabla solo salen cuando alguien abre la pestaña, así que
// los listados de Insumos y de Telas siguen pesando exactamente lo mismo que
// antes de que existiera el reconocimiento.

import { useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { ANGULOS_GUIA, type DominioReconocimiento } from '@/modules/inventario/reconocimiento';
import { useFotosArticulo, type FotoArticulo } from '@/modules/inventario/reconocimientoStore';
import EnsenarArticuloDialog from './EnsenarArticuloDialog';

const ORIGEN: Record<FotoArticulo['origen'], string> = {
  enrolamiento: 'Enseñada',
  ficha: 'De la ficha',
  confirmacion: 'Aprendida al confirmar',
};

const tituloAngulo = (id: string) =>
  ANGULOS_GUIA.find((a) => a.id === id)?.titulo ?? 'Foto';

export function GaleriaFotosArticulo({
  dominio,
  cod,
  nombre,
  puedeEditar,
}: {
  dominio: DominioReconocimiento;
  cod: string;
  nombre: string;
  puedeEditar: boolean;
}) {
  const { fotos, loading, error, recargar, borrar } = useFotosArticulo(dominio, cod);
  const [ensenando, setEnsenando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const confirmar = useConfirm();

  const quitar = async (f: FotoArticulo) => {
    const ok = await confirmar({
      titulo: 'Quitar esta foto',
      mensaje:
        'Deja de usarse para reconocer este artículo. Si era la única, el artículo vuelve a no reconocerse.',
      confirmLabel: 'Quitar',
      destructivo: true,
    });
    if (!ok) return;
    setBorrando(f.id);
    try {
      await borrar(f);
      toast.success('Foto quitada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBorrando(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Fotos para reconocer</p>
          <p className="text-xs text-muted-foreground">
            Con estas fotos el sistema identifica el artículo cuando alguien le apunta con la
            cámara. Mientras más ángulos, mejor acierta.
          </p>
        </div>
        {puedeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setEnsenando(true)}>
            <Camera className="h-4 w-4" /> Enseñar este artículo
          </Button>
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && fotos.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Todavía no tiene fotos: este artículo no se puede reconocer con la cámara.
          {puedeEditar && ' Usa «Enseñar este artículo» y saca dos o tres tomas.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <figure key={f.id} className="relative w-24">
            {f.url ? (
              <img
                src={f.url}
                alt={tituloAngulo(f.angulo)}
                loading="lazy"
                className="h-24 w-24 rounded border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded border border-border bg-muted text-[0.6rem] text-muted-foreground">
                sin vista previa
              </div>
            )}
            <figcaption className="mt-1 text-[0.65rem] leading-tight text-muted-foreground">
              {tituloAngulo(f.angulo)}
              <br />
              <span className="opacity-70">{ORIGEN[f.origen]}</span>
            </figcaption>
            {puedeEditar && (
              <button
                type="button"
                title="Quitar esta foto"
                onClick={() => void quitar(f)}
                disabled={borrando === f.id}
                className="absolute right-1 top-1 rounded bg-background/85 p-1 text-destructive hover:bg-destructive hover:text-white"
              >
                {borrando === f.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            )}
          </figure>
        ))}
      </div>

      {ensenando && (
        <EnsenarArticuloDialog
          abierto
          dominio={dominio}
          cod={cod}
          nombre={nombre}
          onCerrar={() => setEnsenando(false)}
          onListo={() => void recargar()}
        />
      )}
    </div>
  );
}

export default GaleriaFotosArticulo;
