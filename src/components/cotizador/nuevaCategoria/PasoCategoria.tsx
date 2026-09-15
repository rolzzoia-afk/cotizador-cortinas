// Paso 1 del asistente: qué categoría es, cómo se va a llamar su familia, en
// qué pastilla del catálogo se ve y con qué categoría de fabricación nacen sus
// cortinas.
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { estiloChipHex } from '@/modules/cotizador/coloresFila';
import { filtrosCatalogoCon } from '@/modules/cotizador/filtrosCatalogo';
import { HEX_CHIP_CUSTOM_DEFAULT } from '@/modules/cotizador/chipsCustom';
import { categoriasFase1ConTipos } from '@/modules/cotizador/categorias';
import { categoriaEfectiva, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import {
  baseCodSugerido,
  familiasDelBorrador,
  type BorradorCategoria,
  type ContextoCategoria,
  type TipoCategoria,
} from '@/modules/cotizador/nuevaCategoria';

const TIPOS: { id: TipoCategoria; titulo: string; ayuda: string }[] = [
  { id: 'roller', titulo: 'Roller', ayuda: 'Una tela, un tubo. Lo de siempre.' },
  { id: 'duo', titulo: 'Dúo', ayuda: 'Dos telas: se cobra el doble de tela.' },
  { id: 'vertical', titulo: 'Vertical', ayuda: 'Lamas. Usa sus propios insumos VER.' },
  { id: 'accesorio', titulo: 'No es cortina', ayuda: 'Precio fijo, sin tela ni medidas.' },
];

/** Las categorías de fabricación que tienen sentido para este tipo. */
function categoriasDelTipo(tipo: TipoCategoria, tipos: readonly TipoCortina[]) {
  return categoriasFase1ConTipos(tipos)
    .map((g) => ({
      label: g.label,
      options: g.options.filter((o) => {
        const e = categoriaEfectiva(o.value, tipos).toUpperCase();
        if (tipo === 'vertical') return e === 'VERTICAL';
        if (e === 'VERTICAL' || e === 'BEEBLACK') return false;
        return tipo === 'duo' ? e.includes('DUO') : !e.includes('DUO');
      }),
    }))
    .filter((g) => g.options.length > 0);
}

type Props = {
  borrador: BorradorCategoria;
  ctx: ContextoCategoria;
  tipos: readonly TipoCortina[];
  onChange: (patch: Partial<BorradorCategoria>) => void;
};

export default function PasoCategoria({ borrador: b, ctx, tipos, onChange }: Props) {
  const pastillas = useMemo(() => filtrosCatalogoCon(ctx.chips), [ctx.chips]);
  const grupos = useMemo(() => categoriasDelTipo(b.tipo, tipos), [b.tipo, tipos]);
  const familias = familiasDelBorrador(b);

  const cambiarTipo = (tipo: TipoCategoria) =>
    onChange({
      tipo,
      // El código se re-sugiere mientras nadie lo haya tocado a mano: un dúo
      // necesita DUO adelante y una vertical su `_V`.
      baseCod: baseCodSugerido(b.nombre, tipo),
      categoriaFabricacion: '',
      moldes: {},
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1 text-xs">¿Cómo se llama la categoría?</Label>
          <Input
            value={b.nombre}
            onChange={(e) =>
              onChange({
                nombre: e.target.value,
                baseCod: baseCodSugerido(e.target.value, b.tipo),
                pastilla:
                  b.pastilla.modo === 'nueva'
                    ? { ...b.pastilla, label: e.target.value.trim().slice(0, 24) }
                    : b.pastilla,
              })
            }
            placeholder="Lino"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Código de la familia</Label>
          <Input
            value={b.baseCod}
            onChange={(e) => onChange({ baseCod: e.target.value.toUpperCase() })}
            className="font-mono"
            placeholder="LINO"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {familias.length
              ? `Se van a crear: ${familias.join(' · ')}`
              : 'Cada gama arma su familia: LINO_P (premium), LINO_D (delux), LINO_S (standard).'}
          </p>
        </div>
      </div>

      <div>
        <Label className="mb-1 text-xs">¿Qué tipo de cortina es?</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiarTipo(t.id)}
              className={`rounded-md border p-2 text-left text-xs transition-colors ${
                b.tipo === t.id ? 'border-accent bg-accent/10' : 'hover:border-accent/40'
              }`}
            >
              <div className="font-medium">{t.titulo}</div>
              <div className="text-[11px] text-muted-foreground">{t.ayuda}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1 text-xs">¿En qué pastilla del catálogo se ve?</Label>
          {b.pastilla.modo === 'nueva' ? (
            <div className="flex items-center gap-2">
              <Input
                value={b.pastilla.label}
                maxLength={24}
                onChange={(e) =>
                  onChange({ pastilla: { modo: 'nueva', label: e.target.value, hex: hex(b) } })
                }
                placeholder="Lino"
              />
              <input
                type="color"
                value={hex(b)}
                onChange={(e) =>
                  onChange({
                    pastilla: { modo: 'nueva', label: label(b), hex: e.target.value },
                  })
                }
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                title="Color de la pastilla"
              />
              <span
                className="whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold"
                style={estiloChipHex(hex(b))}
              >
                {label(b) || 'Nueva'}
              </span>
            </div>
          ) : (
            <select
              value={b.pastilla.id}
              onChange={(e) => onChange({ pastilla: { modo: 'existente', id: e.target.value } })}
              className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm"
            >
              {pastillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() =>
              onChange({
                pastilla:
                  b.pastilla.modo === 'nueva'
                    ? { modo: 'existente', id: pastillas[0]?.id ?? '' }
                    : { modo: 'nueva', label: b.nombre.trim().slice(0, 24), hex: HEX_CHIP_CUSTOM_DEFAULT },
              })
            }
            className="mt-1 text-[11px] text-muted-foreground underline hover:text-accent"
          >
            {b.pastilla.modo === 'nueva'
              ? 'Usar una pastilla que ya existe'
              : 'Crear una pastilla nueva'}
          </button>
        </div>

        {b.tipo !== 'accesorio' && (
          <div>
            <Label className="mb-1 text-xs">¿Con qué categoría de fabricación nacen?</Label>
            <select
              value={b.categoriaFabricacion}
              onChange={(e) => onChange({ categoriaFabricacion: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm"
            >
              <option value="">Elige una…</option>
              {grupos.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Es la que trae la fila al agregar la cortina en Fase 1. Se puede cambiar cortina por
              cortina.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const hex = (b: BorradorCategoria) =>
  b.pastilla.modo === 'nueva' ? b.pastilla.hex : HEX_CHIP_CUSTOM_DEFAULT;
const label = (b: BorradorCategoria) => (b.pastilla.modo === 'nueva' ? b.pastilla.label : '');
