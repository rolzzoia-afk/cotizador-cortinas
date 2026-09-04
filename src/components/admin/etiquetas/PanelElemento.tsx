// Las propiedades del elemento elegido en el lienzo: dónde está, qué tamaño
// tiene y cómo se ve.
//
// Todos los números van con `InputDecimal`: en es-CL el separador es la coma y
// un `<input type=number>` controlado no deja escribirla (se come el decimal y
// el padre guarda un cero).

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import { subirImagenDoc } from '@/modules/cotizador/docCotizacionStore';
import type {
  AlineacionEtiqueta,
  ColorEtiqueta,
  DefEtiqueta,
  ElementoEtiqueta,
  EstiloTexto,
} from '@/modules/etiquetas/plantilla';

const ROTULO_TIPO: Record<ElementoEtiqueta['tipo'], string> = {
  caja: 'Recuadro',
  linea: 'Línea',
  texto: 'Texto fijo',
  campo: 'Dato de la app',
  imagen: 'Imagen',
  qr: 'Código QR',
  casilla: 'Casilla para marcar',
};

const COLORES: { valor: ColorEtiqueta; label: string }[] = [
  { valor: 'negro', label: 'Negro' },
  { valor: 'blanco', label: 'Blanco' },
  { valor: 'gris', label: 'Gris' },
];

const ALINEACIONES: { valor: AlineacionEtiqueta; label: string }[] = [
  { valor: 'izquierda', label: 'Izquierda' },
  { valor: 'centro', label: 'Centro' },
  { valor: 'derecha', label: 'Derecha' },
];

const selectCls =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-xs';

export default function PanelElemento({
  elemento,
  def,
  empresaId,
  onChange,
  onEliminar,
}: {
  elemento: ElementoEtiqueta | null;
  def: DefEtiqueta;
  empresaId: string | null | undefined;
  onChange: (patch: Partial<ElementoEtiqueta>) => void;
  onEliminar: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  if (!elemento) {
    return (
      <p className="text-xs text-muted-foreground">
        Toca un elemento de la etiqueta para moverlo, agrandarlo o esconderlo.
      </p>
    );
  }

  const esPropio = elemento.id.startsWith('x-');
  const conEstilo = 'estilo' in elemento ? (elemento.estilo as EstiloTexto) : null;
  const setEstilo = (patch: Partial<EstiloTexto>) => {
    if (!conEstilo) return;
    onChange({ estilo: { ...conEstilo, ...patch } } as Partial<ElementoEtiqueta>);
  };

  const subir = async (f: File) => {
    if (!empresaId) return;
    setSubiendo(true);
    try {
      onChange({ url: await subirImagenDoc(empresaId, f) } as Partial<ElementoEtiqueta>);
      toast.success('Imagen cambiada. Acuérdate de guardar.');
    } catch (e) {
      toast.error('No se pudo subir: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="font-semibold">{ROTULO_TIPO[elemento.tipo]}</p>
          {elemento.tipo === 'campo' && (
            <p className="text-[0.65rem] text-muted-foreground">
              {def.slots[elemento.slot]?.label ?? elemento.slot} — lo pone la app
            </p>
          )}
        </div>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={elemento.visible}
            onChange={(e) => onChange({ visible: e.target.checked })}
          />
          Se imprime
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y', 'ancho', 'alto'] as const).map((k) => (
          <div key={k}>
            <Label className="text-[0.65rem] capitalize">{k} (mm)</Label>
            <InputDecimal
              className="h-8"
              value={elemento[k]}
              onChange={(v) => onChange({ [k]: v } as Partial<ElementoEtiqueta>)}
            />
          </div>
        ))}
      </div>

      {elemento.tipo === 'texto' && (
        <div>
          <Label className="text-[0.65rem]">Lo que dice</Label>
          <textarea
            className="min-h-[3.5rem] w-full rounded-md border border-input bg-background p-2 text-xs"
            value={elemento.texto}
            onChange={(e) => onChange({ texto: e.target.value })}
          />
          <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
            Se puede intercalar un dato con llaves:{' '}
            {Object.keys(def.slots)
              .slice(0, 3)
              .map((s) => `{${s}}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {elemento.tipo === 'casilla' && (
        <div>
          <Label className="text-[0.65rem]">Rótulo de la casilla</Label>
          <Input
            className="h-8"
            value={elemento.rotulo}
            onChange={(e) => onChange({ rotulo: e.target.value })}
          />
        </div>
      )}

      {conEstilo && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[0.65rem]">Tamaño (pt)</Label>
              <InputDecimal
                className="h-8"
                value={conEstilo.pt}
                onChange={(pt) => setEstilo({ pt })}
              />
            </div>
            <div>
              <Label className="text-[0.65rem]">Alineación</Label>
              <select
                className={selectCls}
                value={conEstilo.align}
                onChange={(e) => setEstilo({ align: e.target.value as AlineacionEtiqueta })}
              >
                {ALINEACIONES.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[0.65rem]">Color de la letra</Label>
              <select
                className={selectCls}
                value={conEstilo.color}
                onChange={(e) => setEstilo({ color: e.target.value as ColorEtiqueta })}
              >
                {COLORES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[0.65rem]">Fondo</Label>
              <select
                className={selectCls}
                value={conEstilo.fondo ?? ''}
                onChange={(e) =>
                  setEstilo({ fondo: (e.target.value || undefined) as ColorEtiqueta | undefined })
                }
              >
                <option value="">Sin fondo</option>
                {COLORES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={conEstilo.bold}
              onChange={(e) => setEstilo({ bold: e.target.checked })}
            />
            Negrita
          </label>
          {conEstilo.encoger && (
            <p className="text-[0.62rem] text-muted-foreground">
              Si el dato no cabe, la letra baja sola hasta {conEstilo.encoger.minPt} pt
              {conEstilo.encoger.partir ? ' y puede partirse en dos renglones' : ''}.
            </p>
          )}
        </div>
      )}

      {(elemento.tipo === 'imagen' || elemento.tipo === 'qr') && (
        <div className="space-y-1.5">
          <Label className="text-[0.65rem]">Imagen</Label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={subiendo || !empresaId}
              onClick={() => archivo.current?.click()}
            >
              {subiendo ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
              )}
              Cambiar
            </Button>
            {elemento.url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => onChange({ url: undefined } as Partial<ElementoEtiqueta>)}
              >
                Volver al logo
              </Button>
            )}
          </div>
          <input
            ref={archivo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {(elemento.tipo === 'caja' || elemento.tipo === 'linea') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[0.65rem]">Grosor (pt)</Label>
            <InputDecimal
              className="h-8"
              value={elemento.trazoPt}
              onChange={(trazoPt) => onChange({ trazoPt } as Partial<ElementoEtiqueta>)}
            />
          </div>
          {elemento.tipo === 'linea' && (
            <label className="flex items-end gap-1.5 pb-1">
              <input
                type="checkbox"
                checked={!!elemento.punteada}
                onChange={(e) =>
                  onChange({ punteada: e.target.checked } as Partial<ElementoEtiqueta>)
                }
              />
              Punteada
            </label>
          )}
        </div>
      )}

      {esPropio && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-full text-destructive"
          onClick={onEliminar}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Eliminar este elemento
        </Button>
      )}
      {!esPropio && (
        <p className="text-[0.62rem] text-muted-foreground">
          Los elementos que trae la etiqueta no se borran: se destildan de «Se imprime» y dejan de
          salir, pero quedan por si hay que recuperarlos.
        </p>
      )}
    </div>
  );
}
