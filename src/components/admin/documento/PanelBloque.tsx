// Panel de propiedades del bloque seleccionado en el editor del documento.
// Los bloques `terminos` y `banner_cuotas` no tienen contenido editable acá
// (los términos se editan en su propia sección); sí su ancho/alineación, que
// se manejan desde la barra del bloque. Las secciones del sistema tampoco se
// editan: solo se mueven.

import { useRef, useState } from 'react';
import { Columns2, ImagePlus, Link2, Loader2, Move } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ANCHO_MAX,
  ANCHO_MIN,
  LABEL_TIPO,
  SECCIONES,
  esSeccion,
  puedeFlotar,
  type BloqueDoc,
  type PosicionFlotante,
  type TipoSeccionDoc,
} from '@/modules/cotizador/docCotizacion';
import { subirImagenDoc } from '@/modules/cotizador/docCotizacionStore';
import PanelCarrusel from './PanelCarrusel';

interface PanelBloqueProps {
  bloque: BloqueDoc | null;
  empresaId: string | null | undefined;
  onChange: (patch: Partial<BloqueDoc>) => void;
  /** Posición con la que nace una imagen al volverse flotante. */
  flotanteInicial: Omit<PosicionFlotante, 'sobre'>;
}

export default function PanelBloque({
  bloque,
  empresaId,
  onChange,
  flotanteInicial,
}: PanelBloqueProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!bloque) {
    return (
      <p className="text-xs text-muted-foreground">
        Selecciona un bloque de la vista previa para editarlo.
      </p>
    );
  }

  if (esSeccion(bloque.tipo)) {
    return (
      <p className="text-xs text-muted-foreground">
        Es una sección del sistema: su contenido lo arma la cotización. Se puede mover arrastrando
        su manija, pero no ocultar ni eliminar.
      </p>
    );
  }

  const subir = async (file: File | undefined) => {
    if (!file || !empresaId) return;
    setSubiendo(true);
    try {
      const url = await subirImagenDoc(empresaId, file);
      onChange({ url });
      toast.success('Imagen subida.');
    } catch (e) {
      toast.error('No se pudo subir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
    }
  };

  const flot = bloque.flotante;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">
          Ancho ({bloque.ancho}%{flot ? ' de la sección' : ''})
        </Label>
        <input
          type="range"
          min={ANCHO_MIN}
          max={ANCHO_MAX}
          value={bloque.ancho}
          onChange={(e) => onChange({ ancho: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {!flot && (
        <label className="flex items-start gap-2 rounded-md border p-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={!!bloque.juntoATotales}
            onChange={(e) => onChange({ juntoATotales: e.target.checked || undefined })}
          />
          <span>
            <Columns2 className="mr-1 inline h-3.5 w-3.5" />
            Junto a los totales
            <span className="block text-[11px] text-muted-foreground">
              Comparte fila con el recuadro de precios, a su izquierda.
            </span>
          </span>
        </label>
      )}

      {bloque.tipo === 'texto' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Título (opcional)</Label>
            <Input
              value={bloque.titulo ?? ''}
              onChange={(e) => onChange({ titulo: e.target.value })}
              placeholder="Formas de pago, Garantías…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto</Label>
            <textarea
              value={bloque.texto ?? ''}
              onChange={(e) => onChange({ texto: e.target.value })}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              placeholder="Escribe el texto. Los saltos de línea se respetan."
            />
          </div>
        </>
      )}

      {puedeFlotar(bloque.tipo) && (
        <div className="space-y-1 rounded-md border p-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!flot}
              onChange={(e) =>
                onChange({
                  flotante: e.target.checked
                    ? { sobre: SECCIONES[0], ...flotanteInicial }
                    : undefined,
                  // Flotar y compartir fila con los totales son excluyentes.
                  juntoATotales: undefined,
                })
              }
            />
            <Move className="h-3.5 w-3.5" />
            Flotante sobre una sección
          </label>
          {flot ? (
            <>
              <select
                value={flot.sobre}
                onChange={(e) =>
                  onChange({ flotante: { ...flot, sobre: e.target.value as TipoSeccionDoc } })
                }
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                {SECCIONES.map((s) => (
                  <option key={s} value={s}>
                    {LABEL_TIPO[s]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Arrástralo en la vista previa para colocarlo (x {flot.x}% · y {flot.y}%).
                {flot.sobre === 'catalogo' && ' Ojo: el catálogo no sale impreso.'}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Sin flotar, ocupa su propia franja en el orden del documento.
            </p>
          )}
        </div>
      )}

      {bloque.tipo === 'carrusel' && (
        <PanelCarrusel
          imagenes={bloque.imagenes ?? []}
          empresaId={empresaId}
          onChange={(imagenes) => onChange({ imagenes })}
        />
      )}

      {bloque.tipo === 'imagen' && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              subir(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-xs transition ${
              dragActive ? 'border-accent bg-accent/10' : 'border-border'
            }`}
          >
            {subiendo ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              {subiendo ? 'Subiendo…' : 'Arrastra una imagen o haz clic para elegirla'}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => subir(e.target.files?.[0])}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">O pega una URL</Label>
            <Input
              value={bloque.url ?? ''}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-xs">
              <Link2 className="h-3 w-3" />
              Enlace al hacer clic (opcional)
            </Label>
            <Input
              value={bloque.enlace ?? ''}
              onChange={(e) => onChange({ enlace: e.target.value })}
              placeholder="https://www.instagram.com/…"
            />
            <p className="text-[11px] text-muted-foreground">
              Funciona en pantalla; al imprimir sale solo la imagen.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto alternativo</Label>
            <Input
              value={bloque.alt ?? ''}
              onChange={(e) => onChange({ alt: e.target.value })}
              placeholder="Descripción de la imagen"
            />
          </div>
          {bloque.url && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ url: '' })}>
              Quitar imagen
            </Button>
          )}
        </>
      )}

      {(bloque.tipo === 'terminos' || bloque.tipo === 'banner_cuotas') && (
        <p className="text-[11px] text-muted-foreground">
          {bloque.tipo === 'terminos'
            ? 'El contenido se edita en la sección "Términos y condiciones".'
            : 'El texto del banner depende del proveedor de tarjeta configurado en Comisiones.'}
        </p>
      )}
    </div>
  );
}
