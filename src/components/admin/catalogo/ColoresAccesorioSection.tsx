// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Colores de accesorios
//
// Dar de alta un color (un dorado, por ejemplo) no es solo agregar un botón:
// hay que decir con qué kit se arma, con qué tapas, con qué peso y con qué
// perfiles. El asistente hace esas preguntas en orden y cierra mostrando dónde
// quedó conectado el color y qué quedó pendiente.
//
// Lo que no se completa NO rompe nada: la pieza sale con su descripción y sin
// código, visible en el inventario, en vez de desaparecer en silencio.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CAMPOS_INSUMO_COLOR,
  CAMPOS_MEC,
  CODIGOS_BUILTIN,
  NOMBRE_USO,
  USOS_COLOR,
  validarColores,
  type ColorAccesorio,
  type InsumosColor,
  type UsoColor,
} from '@/modules/descuentos/coloresAccesorio';
import {
  numeroMecDeChip,
  type MecanismoCatalogo,
  type ReglasMecanismo,
} from '@/modules/descuentos/reglas-mecanismo';

const PASOS = 4;

const COLOR_VACIO = (): ColorAccesorio => ({
  codigo: '',
  nombre: '',
  usos: { accesorio: true, manilla: false, tapaOvalada: false, tapaCuadrada: false },
  insumos: {},
});

/** Los campos del paso 3, agrupados como los pregunta el asistente. */
const GRUPOS = ['Tapas', 'Perfiles y pesos'] as const;

type Props = {
  valor: readonly ColorAccesorio[];
  /** Los mecanismos, para elegir kit existente o crear uno nuevo desde acá. */
  mecanismos: ReglasMecanismo;
  /** Devuelve los colores y, si el asistente creó un kit, el catálogo nuevo. */
  onChange: (colores: readonly ColorAccesorio[], mecanismos?: ReglasMecanismo) => void;
};

export function ColoresAccesorioSection({ valor, mecanismos, onChange }: Props) {
  const confirmar = useConfirm();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const [color, setColor] = useState<ColorAccesorio>(COLOR_VACIO());
  // Kits que el asistente crea sobre la marcha (se aplican al guardar).
  const [kitsNuevos, setKitsNuevos] = useState<MecanismoCatalogo[]>([]);
  const [kitEnCreacion, setKitEnCreacion] = useState<string | null>(null);
  const [kitNombre, setKitNombre] = useState('');
  const [kitMec, setKitMec] = useState('');

  const catalogoConNuevos = useMemo(
    () => [...mecanismos.mecanismos, ...kitsNuevos],
    [mecanismos.mecanismos, kitsNuevos],
  );

  // Se valida contra la lista SIN el color en edición, para que editarlo no se
  // acuse a sí mismo de código repetido.
  const validacion = useMemo(() => {
    const otros = valor.filter((c) => c.codigo !== editando);
    return validarColores([...otros, color]);
  }, [valor, color, editando]);

  const abrirNuevo = () => {
    setEditando(null);
    setColor(COLOR_VACIO());
    setKitsNuevos([]);
    setPaso(1);
    setAbierto(true);
  };

  const abrirEdicion = (c: ColorAccesorio) => {
    setEditando(c.codigo);
    setColor({ ...c, insumos: { ...(c.insumos ?? {}) } });
    setKitsNuevos([]);
    setPaso(1);
    setAbierto(true);
  };

  const setInsumo = (campo: keyof InsumosColor, bruto: string) => {
    const insumos = { ...(color.insumos ?? {}) };
    const texto = bruto.trim().toUpperCase();
    if (!texto) delete insumos[campo];
    else if (CAMPOS_MEC.has(campo)) {
      const n = parseInt(texto.replace(/\D/g, ''), 10);
      if (Number.isFinite(n)) (insumos as Record<string, number>)[campo] = n;
      else delete insumos[campo];
    } else (insumos as Record<string, string>)[campo] = texto;
    setColor({ ...color, insumos });
  };

  const valorInsumo = (campo: keyof InsumosColor): string => {
    const v = color.insumos?.[campo];
    return v == null ? '' : String(v);
  };

  const guardar = () => {
    const limpio: ColorAccesorio = {
      ...color,
      codigo: color.codigo.trim().toUpperCase(),
      nombre: (color.nombre.trim() || color.codigo.trim()).toUpperCase(),
      ...(Object.keys(color.insumos ?? {}).length > 0 ? { insumos: color.insumos } : {}),
    };
    const otros = valor.filter((c) => c.codigo !== editando);
    const lista = editando
      ? valor.map((c) => (c.codigo === editando ? limpio : c))
      : [...otros, limpio];
    // Los kits creados durante el asistente entran al catálogo de mecanismos, y
    // el mapa color → kit queda escrito para que la selección los use sola.
    const kits = kitsNuevos.length > 0 ? [...mecanismos.mecanismos, ...kitsNuevos] : null;
    const mapa = (destino: Record<string, number>, mec?: number) => {
      const out = { ...destino };
      if (mec == null) {
        delete out[limpio.codigo];
        delete out[limpio.nombre];
      } else {
        out[limpio.codigo] = mec;
        out[limpio.nombre] = mec;
      }
      return out;
    };
    const mecActualizado: ReglasMecanismo = {
      ...mecanismos,
      ...(kits ? { mecanismos: kits } : {}),
      colorAMec: mapa(mecanismos.colorAMec, limpio.insumos?.kitSimple),
      colorAMecReforzado: mapa(mecanismos.colorAMecReforzado, limpio.insumos?.kitReforzado),
      kitOvaladaPorColor: mapa(mecanismos.kitOvaladaPorColor, limpio.insumos?.kitOvalada),
    };
    onChange(lista, mecActualizado);
    setAbierto(false);
  };

  const eliminar = async (c: ColorAccesorio) => {
    const ok = await confirmar({
      titulo: `¿Quitar el color «${c.codigo}»?`,
      mensaje:
        'Las cortinas ya guardadas con este color lo conservan y se siguen calculando igual; ' +
        'lo que cambia es que deja de ofrecerse en los selectores de Fase 2.',
      destructivo: true,
      confirmLabel: 'Quitar del catálogo',
    });
    if (!ok) return;
    onChange(valor.filter((x) => x.codigo !== c.codigo));
  };

  const alternarUso = (uso: UsoColor) =>
    setColor({ ...color, usos: { ...color.usos, [uso]: !color.usos[uso] } });

  const puedeAvanzar =
    paso !== 1 || (!!color.codigo.trim() && !!color.nombre.trim() && validacion.errores.length === 0);

  /** Selector de kit con opción de crear uno nuevo sin salir del asistente. */
  const selectorKit = (campo: 'kitSimple' | 'kitReforzado' | 'kitOvalada', etiqueta: string) => {
    const actual = color.insumos?.[campo];
    const creando = kitEnCreacion === campo;
    const nEnCurso = parseInt(kitMec.replace(/\D/g, ''), 10);
    return (
      <div key={campo} className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-44 text-xs text-muted-foreground">{etiqueta}</span>
          <select
            className="h-8 min-w-[16rem] rounded-md border bg-background px-2 text-xs"
            value={actual == null ? '' : String(actual)}
            onChange={(e) => setInsumo(campo, e.target.value)}
          >
            <option value="">— lo elige el vendedor —</option>
            {catalogoConNuevos.map((m) => {
              const n = numeroMecDeChip(m.chip);
              return n == null ? null : (
                <option key={m.chip} value={String(n)}>
                  MEC {n} · {m.chip.replace(/\s*\[MEC \d+\]\s*/, '')}
                </option>
              );
            })}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setKitEnCreacion(creando ? null : campo);
              setKitNombre(`KIT ${etiqueta.split(' ')[1] ?? ''} ${color.nombre || color.codigo} 38MM`
                .replace(/\s+/g, ' ')
                .toUpperCase());
              setKitMec('');
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {creando ? 'Cancelar' : 'Crear kit'}
          </Button>
        </div>
        {creando && (
          <div className="ml-44 flex flex-wrap items-end gap-2 rounded-md border p-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Nombre del kit</span>
              <Input
                className="h-8 w-64 text-xs"
                value={kitNombre}
                onChange={(e) => setKitNombre(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">N° MEC</span>
              <Input
                className="h-8 w-20 text-xs"
                value={kitMec}
                onChange={(e) => setKitMec(e.target.value.replace(/\D/g, ''))}
                placeholder="43"
              />
            </label>
            <Button
              size="sm"
              disabled={!kitNombre.trim() || !Number.isFinite(nEnCurso)}
              onClick={() => {
                const chip = `${kitNombre.trim().toUpperCase()} [MEC ${nEnCurso}]`;
                setKitsNuevos((k) => [...k, { chip, estado: 'activo' }]);
                setInsumo(campo, String(nEnCurso));
                setKitEnCreacion(null);
              }}
            >
              Agregar
            </Button>
          </div>
        )}
      </div>
    );
  };

  const sinCompletar = CAMPOS_INSUMO_COLOR.filter(
    (c) => !CAMPOS_MEC.has(c.campo) && color.insumos?.[c.campo] == null,
  );

  return (
    <>
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex items-center gap-2">
          <Palette className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold text-muted-foreground">Colores de accesorios</h2>
        </header>
        <p className="mb-3 text-xs text-muted-foreground">
          Los colores que se ofrecen en Fase 2 y con qué se fabrica cada uno. Al agregar uno, el
          asistente pregunta el kit, las tapas, el peso y los perfiles, para que la cortina salga
          completa en el inventario y en las etiquetas.
        </p>

        <div className="mb-3">
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar color
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-xs">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 text-left font-medium">Código</th>
                <th className="py-1.5 pr-3 text-left font-medium">Nombre</th>
                <th className="py-1.5 pr-3 text-left font-medium">Se ofrece en</th>
                <th className="py-1.5 pr-3 text-left font-medium">Códigos propios</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {valor.map((c) => {
                const propios = Object.keys(c.insumos ?? {}).length;
                return (
                  <tr key={c.codigo} className="border-t">
                    <td className="py-1.5 pr-3 font-mono">{c.codigo}</td>
                    <td className="py-1.5 pr-3">{c.nombre}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {USOS_COLOR.filter((u) => c.usos[u])
                        .map((u) => NOMBRE_USO[u].split(' (')[0])
                        .join(' · ') || '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {propios > 0 ? `${propios}` : 'de fábrica'}
                    </td>
                    <td className="py-1.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!CODIGOS_BUILTIN.includes(c.codigo) && (
                        <Button variant="ghost" size="sm" onClick={() => eliminar(c)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? `Editar el color ${editando}` : 'Agregar un color de accesorios'}
            </DialogTitle>
            <DialogDescription>
              Paso {paso} de {PASOS}
            </DialogDescription>
          </DialogHeader>

          {paso === 1 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium">Código corto</label>
                  <Input
                    className="font-mono"
                    value={color.codigo}
                    disabled={!!editando}
                    onChange={(e) => setColor({ ...color, codigo: e.target.value.toUpperCase() })}
                    placeholder="DOR"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Es lo que se guarda en la cortina y viaja al Excel de órdenes. No se cambia
                    después.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium">Nombre completo</label>
                  <Input
                    value={color.nombre}
                    onChange={(e) => setColor({ ...color, nombre: e.target.value.toUpperCase() })}
                    placeholder="DORADO"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Con este nombre se buscan el modelo del catálogo y la cadena del inventario, que
                    se identifican por texto.
                  </p>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 text-xs font-medium">¿Dónde se puede elegir este color?</div>
                <div className="space-y-1.5">
                  {USOS_COLOR.map((u) => (
                    <label key={u} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={color.usos[u]}
                        onChange={() => alternarUso(u)}
                      />
                      {NOMBRE_USO[u]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Con qué kit se arma una cortina de este color. Se puede elegir uno del catálogo o
                crear el kit nuevo acá mismo. Si se deja vacío, la app no elige sola: el kit lo pone
                el vendedor en Fase 2 (es lo que pasa hoy con el metálico).
              </p>
              <div className="space-y-2 rounded-md border p-3">
                {selectorKit('kitSimple', 'Kit simple (el default)')}
                {selectorKit('kitReforzado', 'Kit reforzado')}
                {selectorKit('kitOvalada', 'Kit de cenefa ovalada')}
              </div>
              {kitsNuevos.length > 0 && (
                <div className="rounded-md border border-success/40 bg-success/10 p-2 text-[11px]">
                  Se agregarán al catálogo de mecanismos al guardar:{' '}
                  {kitsNuevos.map((k) => k.chip).join(' · ')}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Al cambiar el color de accesorios de una cortina, el kit se recalcula solo y pasa al
                de este color, conservando la familia (simple o reforzado).
              </p>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Códigos de bodega de las piezas que dependen del color. Lo que quede vacío igual se
                fabrica: la pieza aparece en el inventario con su descripción y sin código, para
                catalogarla después.
              </p>
              {GRUPOS.map((grupo) => (
                <div key={grupo} className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium">{grupo}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CAMPOS_INSUMO_COLOR.filter((c) => c.grupo === grupo).map((c) => (
                      <label key={c.campo} className="flex items-center gap-2">
                        <span className="flex-1 text-[11px] text-muted-foreground">{c.label}</span>
                        <Input
                          className="h-8 w-28 font-mono text-xs"
                          value={valorInsumo(c.campo)}
                          onChange={(e) => setInsumo(c.campo, e.target.value)}
                          placeholder={c.ejemplo}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px]">
                La CADENA no se pide acá: se elige sola si existe una de este color (se busca por el
                nombre «{color.nombre || '—'}»). Si no la encuentra, la pone el vendedor. Para
                declarar el largo y el color de una cadena, o dar de alta una nueva, andá a la
                sección <strong>Cadenas</strong>.
              </div>
            </div>
          )}

          {paso === 4 && (
            <div className="space-y-3 text-xs">
              <div className="rounded-md border border-success/40 bg-success/10 p-3">
                <div className="mb-1.5 font-medium">Dónde queda conectado</div>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    Botones de Fase 2:{' '}
                    {USOS_COLOR.filter((u) => color.usos[u])
                      .map((u) => NOMBRE_USO[u].split(' (')[0])
                      .join(', ') || 'ninguno (no se ofrecerá)'}
                    . En Fase 1 el color se escribe libre y ya se acepta.
                  </li>
                  <li>
                    Mecanismo:{' '}
                    {color.insumos?.kitSimple != null
                      ? `kit MEC ${color.insumos.kitSimple} automático, y se recolorea solo al cambiar el color de una cortina.`
                      : 'sin kit automático — lo elige el vendedor.'}
                  </li>
                  <li>
                    Modelo de fabricación: se toma la fila del catálogo cuyo mecanismo diga «
                    {color.nombre}». Si no existe, usa la primera de la categoría.
                  </li>
                  <li>Despiece, Excel de órdenes, Cálculo General y optimizador: sin cambios — las medidas no dependen del color.</li>
                  <li>Inventario y etiquetas: con los códigos del paso anterior.</li>
                </ul>
              </div>

              {sinCompletar.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                  <div className="mb-1.5 font-medium">Queda sin código (saldrá sin catalogar)</div>
                  <div className="text-muted-foreground">
                    {sinCompletar.map((c) => c.label).join(' · ')}
                  </div>
                </div>
              )}

              <div className="rounded-md border p-3">
                <div className="mb-1.5 font-medium">Sigue siendo manual</div>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>
                    Cortinas DÚO: los mecanismos duales existen solo en blanco, negro y gris, así que
                    en este color el chip dual lo elige el vendedor.
                  </li>
                  <li>
                    Dar de alta los insumos en bodega: acá se anotan los CÓDIGOS, pero el insumo en
                    sí se carga en el inventario.
                  </li>
                  <li>
                    Vertical y bee black usan sus propios juegos de color (blanco/negro/café).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {validacion.errores.length > 0 && color.codigo && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px]">
              <ul className="ml-4 list-disc space-y-0.5">
                {validacion.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between">
            {paso > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setPaso(paso - 1)}>
                Atrás
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              {paso < PASOS ? (
                <Button size="sm" onClick={() => setPaso(paso + 1)} disabled={!puedeAvanzar}>
                  Siguiente
                </Button>
              ) : (
                <Button size="sm" onClick={guardar} disabled={validacion.errores.length > 0}>
                  {editando ? 'Guardar cambios' : 'Agregar color'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
