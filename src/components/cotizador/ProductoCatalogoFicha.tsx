// La parte de la ficha de un producto que NO es precio: dónde se ve, con qué
// categoría nace, de qué gama es y su lámina. Vive aparte para que el diálogo
// del producto siga siendo legible.
import { Label } from '@/components/ui/label';
import { FotosInformeEditor } from '@/components/admin/FotosInformeEditor';

type Props = {
  /** Chip del catálogo elegido a mano ('' = automático). */
  chip: string;
  onChip: (v: string) => void;
  /** El chip que le tocaría solo, ya con su nombre para mostrar. */
  chipAutoLabel: string;
  /** Las categorías del catálogo disponibles. */
  filtros: readonly { id: string; label: string }[];
  foto: string[];
  onFoto: (v: string[]) => void;
  grupoFoto: string;
  categoriaFabricacion: string;
  onCategoriaFabricacion: (v: string) => void;
  categoriasFabricacion: readonly string[];
  gama: string;
  onGama: (v: string) => void;
};

const SELECT = 'h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm';

export default function ProductoCatalogoFicha({
  chip,
  onChip,
  chipAutoLabel,
  filtros,
  foto,
  onFoto,
  grupoFoto,
  categoriaFabricacion,
  onCategoriaFabricacion,
  categoriasFabricacion,
  gama,
  onGama,
}: Props) {
  return (
    <>
      <div className="col-span-2">
        <Label className="mb-1 text-xs">Chip del catálogo (Fase 1)</Label>
        <select value={chip} onChange={(e) => onChip(e.target.value)} className={SELECT}>
          <option value="">— automático ({chipAutoLabel}) —</option>
          {/* Una categoría propia que alguien borró: se muestra para que se vea
              por qué el producto dejó de aparecer donde estaba. */}
          {chip && !filtros.some((f) => f.id === chip) && (
            <option value={chip}>{chip} (ya no existe)</option>
          )}
          {filtros.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          En qué categoría del catálogo de Fase 1 se ve este código. En automático se deduce de la
          familia; lo que no calza en ninguna cae en «Otros». Elige uno a mano cuando el automático
          no acierte (un motor nuevo, por ejemplo, para que salga junto a sus hermanos).
        </p>
      </div>

      <div className="col-span-2">
        <Label className="mb-1 text-xs">Categoría de fabricación por defecto</Label>
        <select
          value={categoriaFabricacion}
          onChange={(e) => onCategoriaFabricacion(e.target.value)}
          className={SELECT}
        >
          <option value="">— ninguna —</option>
          {categoriasFabricacion.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Con qué categoría nace la cortina al agregar este código en Fase 1. Es una propuesta: la
          vendedora la puede cambiar en la fila.
        </p>
      </div>

      <div className="col-span-2">
        <Label className="mb-1 text-xs">Gama (categoría comercial)</Label>
        <select value={gama} onChange={(e) => onGama(e.target.value)} className={SELECT}>
          <option value="">— sin clasificar —</option>
          <option value="A">A (estándar)</option>
          <option value="B">B (gama económica)</option>
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Una tela de gama B hace que la cortina nazca en categoría B, con su propio juego de
          herrajes, en las categorías que tienen receta (roller simple, cenefa ovalada 38 y dúo 38).
          Al reimportar el Excel del catálogo, la gama se vuelve a leer de la planilla.
        </p>
      </div>

      <div className="col-span-2">
        <Label className="mb-1 text-xs">Ficha de la tela (informe de visita)</Label>
        <FotosInformeEditor
          fotos={foto}
          onChange={onFoto}
          grupo={grupoFoto}
          max={1}
          etiqueta="Subir ficha"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          La lámina del producto (nombre, gama, código, ancho máximo). Sale en la sección de la
          habitación del INFORME CLIENTE de la visita, igual que en el correo que se manda a mano.
          Sin ficha, esa habitación va sin imagen. No se usa en la cotización ni en producción.
        </p>
      </div>
    </>
  );
}
