// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Precios de insumo (la hoja "Insumos" del Excel)
//
// El VALOR MAXIMO de cada material. De acá sale el costo de TODAS las cortinas:
// subir un tubo acá sube el precio de todas las que lo llevan. Componente
// controlado: el borrador y el guardado viven en ReglasPreciosSection.
//
// También es la puerta de entrada de un material nuevo: se da de alta con su
// precio y se une a la receta de una familia sin salir de la pantalla. El
// código se contrasta con el inventario, porque un insumo que no existe en
// bodega entra igual al precio pero después nadie lo puede descontar.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { useConfirm } from '@/components/ui/confirm';
import { formatCLP } from '@/lib/formatters';
import {
  FAMILIAS_CON_RECETA,
  REGLAS_PRECIOS_DEFAULT,
  RECETA_DUO_GENERICO_KEY,
  RECETA_VERTICAL_KEY,
  type InsumoPrecio,
  type LineaReceta,
} from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

type Props = {
  valor: Record<string, InsumoPrecio>;
  /** Divisor del margen (0,65 = margen 35 %). Viene de los parámetros. */
  margenInsumo: number;
  /** Códigos que alguna receta usa: los demás se marcan como sin uso. */
  usados: Set<string>;
  /** Solo lectura: para decir en qué familias está cada insumo. */
  recetas: Record<string, LineaReceta[]>;
  onChange: (v: Record<string, InsumoPrecio>) => void;
  /** Agrega el insumo a la receta de esa familia (la mutación vive en la contenedora). */
  onUsarEnFamilia: (cod: string, familia: string) => void;
  /**
   * Un sistema con precios propios (beeblack). Cuando viene, la sección edita
   * SU tabla en vez de la general: cambia el título, la explicación y las
   * familias que ofrece el menú «usar en…».
   */
  sistema?: { clave: string; nombre: string; familias: string[] };
  /**
   * Solo con `sistema`: el precio que tiene ese código en la tabla GENERAL, que
   * es el que se cobraría si se saca de acá. `undefined` = no está en la general.
   */
  precioEnGeneral?: (cod: string) => number | undefined;
};

type Alta = { cod: string; descripcion: string; valorMaximo: string };

/** Lo que el inventario sabe de un código: sirve de sugerencia, no de verdad. */
type FilaInventario = { nemotecnico: string; costoIva: number; porPaquete: number };

const ORDEN_FAMILIAS = [...FAMILIAS_CON_RECETA, RECETA_VERTICAL_KEY, RECETA_DUO_GENERICO_KEY];

/** Sin espacios ni guiones: así calzan «E 02» del cálculo y «E02» de la bodega. */
const clave = (cod: string) => String(cod ?? '').toUpperCase().replace(/[\s.\-]/g, '');

/** Número con coma decimal, para escribir la cuenta tal como se lee acá. */
const textoDivisor = (n: number) =>
  n.toLocaleString('es-CL', { maximumFractionDigits: 4 });

/** Lo tecleado en el alta, aceptando coma (es-CL) además de punto. */
const montoAlta = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function InsumosPreciosSection({
  valor,
  margenInsumo,
  usados,
  recetas,
  onChange,
  onUsarEnFamilia,
  sistema,
  precioEnGeneral,
}: Props) {
  const { empresaId } = useAuth();
  const confirmar = useConfirm();
  const [filtro, setFiltro] = useState('');
  const [alta, setAlta] = useState<Alta | null>(null);
  /** Lo que hay en bodega, por código. Vacío = no se pudo leer el inventario. */
  const [inventario, setInventario] = useState<Map<string, FilaInventario>>(new Map());

  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from('insumos')
      .select('cod,nemotecnico,costo_iva,can_x_paquete')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        if (!data) return;
        const m = new Map<string, FilaInventario>();
        for (const i of data as {
          cod: string;
          nemotecnico: string | null;
          costo_iva: number | null;
          can_x_paquete: number | null;
        }[]) {
          // El inventario escribe los códigos sin espacios (E02) y el cálculo
          // con espacios (E 02): se guardan sin separadores para que calcen.
          const cod = clave(i.cod);
          if (!cod) continue;
          m.set(cod, {
            nemotecnico: (i.nemotecnico || '').trim(),
            costoIva: Number(i.costo_iva) || 0,
            porPaquete: Number(i.can_x_paquete) || 0,
          });
        }
        setInventario(m);
      });
  }, [empresaId]);

  const enBodega = (cod: string) => inventario.get(clave(cod));

  const filas = useMemo(() => {
    const f = filtro.trim().toUpperCase();
    return Object.entries(valor)
      .filter(([cod, ins]) => !f || cod.toUpperCase().includes(f) || (ins.descripcion ?? '').toUpperCase().includes(f))
      .sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [valor, filtro]);

  /** En qué familias aparece cada insumo, para el aviso al borrar y el menú. */
  const familiasPorInsumo = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [fam, lineas] of Object.entries(recetas)) {
      for (const l of lineas) {
        const previas = m.get(l.insumo) ?? [];
        if (!previas.includes(fam)) m.set(l.insumo, [...previas, fam]);
      }
    }
    return m;
  }, [recetas]);

  const editar = (cod: string, patch: Partial<InsumoPrecio>) =>
    onChange({ ...valor, [cod]: { ...valor[cod], ...patch } });

  /** Familias que puede recibir un insumo de esta tabla. */
  const familiasDisponibles = sistema ? sistema.familias : ORDEN_FAMILIAS;

  const quitar = async (cod: string) => {
    const enFamilias = familiasPorInsumo.get(cod) ?? [];
    const esDeFabrica = sistema
      ? !!REGLAS_PRECIOS_DEFAULT.sistemas[sistema.clave]?.insumos[cod]
      : !!REGLAS_PRECIOS_DEFAULT.insumos[cod];
    // Sacarlo de la tabla de un SISTEMA no lo deja sin precio si el código
    // también está en la general: pasa a cobrarse a ese otro valor, en
    // silencio. Es justo lo que hay que decir antes de borrarlo.
    const precioGeneral = sistema ? precioEnGeneral?.(cod) : undefined;
    const partes = [`Se quita «${cod}» de la lista de precios.`];
    if (enFamilias.length && precioGeneral && precioGeneral > 0) {
      partes.push(
        `Lo usan ${enFamilias.length} receta${enFamilias.length === 1 ? '' : 's'} ` +
          `(${enFamilias.map(nombreFamilia).join(', ')}). No van a quedar sin precio: pasan a ` +
          `cobrarlo al valor GENERAL, ${formatCLP(Math.round(precioGeneral))} en vez de ` +
          `${formatCLP(Math.round(valor[cod]?.valorMaximo ?? 0))}.`,
      );
    } else if (enFamilias.length) {
      partes.push(
        `Lo usan ${enFamilias.length} receta${enFamilias.length === 1 ? '' : 's'} ` +
          `(${enFamilias.map(nombreFamilia).join(', ')}), ` +
          'así que quedarían sin precio y no se va a poder guardar hasta sacarlo de ahí también.',
      );
    }
    if (esDeFabrica) {
      partes.push(
        'Además viene de fábrica: si alguna receta lo sigue nombrando, vuelve solo con su precio original.',
      );
    }
    const ok = await confirmar({
      titulo: '¿Quitar este insumo?',
      mensaje: partes.join('\n\n'),
      confirmLabel: 'Quitar',
      destructivo: true,
    });
    if (!ok) return;
    const copia = { ...valor };
    delete copia[cod];
    onChange(copia);
  };

  const abrirAlta = () => setAlta({ cod: '', descripcion: '', valorMaximo: '' });

  /** Al escribir el código, si está en bodega se propone su nemotécnico. */
  const escribirCod = (texto: string) => {
    const cod = texto.toUpperCase();
    setAlta((a) => {
      if (!a) return a;
      const sugerida = enBodega(cod)?.nemotecnico;
      const previa = enBodega(a.cod)?.nemotecnico;
      // Solo se pisa la descripción si era la sugerida antes (o estaba vacía).
      const puedeSugerir = !a.descripcion || a.descripcion === previa;
      return { ...a, cod, descripcion: puedeSugerir && sugerida ? sugerida : a.descripcion };
    });
  };

  /**
   * Lo que el inventario sugiere para el código que se está dando de alta. El
   * costo de bodega es el del PAQUETE completo (rollo o barra), así que si se
   * sabe cuántas unidades trae, el valor del cálculo es el de una unidad.
   */
  const sugerencia = useMemo(() => {
    const cod = alta?.cod.trim();
    if (!cod) return null;
    const fila = enBodega(cod);
    if (!fila || !(fila.costoIva > 0)) return null;
    const porUnidad = fila.porPaquete > 1 ? fila.costoIva / fila.porPaquete : fila.costoIva;
    return { ...fila, porUnidad };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alta?.cod, inventario]);

  const confirmarAlta = () => {
    if (!alta) return;
    const cod = alta.cod.trim().toUpperCase();
    const monto = montoAlta(alta.valorMaximo);
    if (!cod || !(monto > 0)) return;
    if (valor[cod]) {
      toast.info(`«${cod}» ya está en la lista de precios.`);
      setFiltro(cod);
      setAlta(null);
      return;
    }
    onChange({ ...valor, [cod]: { valorMaximo: monto, descripcion: alta.descripcion.trim() } });
    setAlta(null);
    setFiltro(cod);
    toast.success(
      `«${cod}» agregado. Para que se cobre, únelo a la receta de una familia con «Usar en…».`,
    );
  };

  const usarEn = (cod: string, fam: string) => {
    onUsarEnFamilia(cod, fam);
    toast.success(
      `«${cod}» agregado a ${nombreFamilia(fam)} con la regla «1 por cortina». ` +
        'Ajusta la cantidad en Materiales por familia y presiona Guardar precios.',
    );
  };

  const hayInventario = inventario.size > 0;
  const altaValida = !!alta && !!alta.cod.trim() && montoAlta(alta.valorMaximo) > 0;

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Package className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          {sistema ? `Precios de insumo — ${sistema.nombre}` : 'Precios de insumo'}
        </h2>
        <span className="text-xs text-muted-foreground">({Object.keys(valor).length})</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar código o descripción"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={abrirAlta} disabled={!!alta}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Insumo nuevo
          </Button>
        </div>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        El <strong>valor máximo</strong> es lo que cuesta el material. El precio con el que se cobra
        sale de <strong>dividirlo por {String(margenInsumo).replace('.', ',')}</strong> —o sea, un
        margen del {Math.round((1 - margenInsumo) * 100)} %—, salvo las líneas que la receta marca
        «a costo». Un insumo recién agregado no cambia ningún precio hasta que entre en la receta de
        alguna familia. Las variantes de color o de proveedor de un mismo material comparten precio:
        aparecen en la lista para poder cambiar una por otra, y por eso muchas figuran «sin uso».
      </p>
      {sistema ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Estos precios son <strong>solo del {sistema.nombre.toLowerCase()}</strong> y{' '}
          <strong>pisan</strong> a los de la lista general cuando el código está en las dos: la
          publicidad y los materiales varios, por ejemplo, valen bastante más acá. Lo que no esté en
          esta tabla se cobra con el precio general.
        </p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          La <strong>mano de obra</strong>, la <strong>instalación</strong> y el{' '}
          <strong>traslado</strong> también son insumos en la planilla, pero acá se editan más
          abajo, en «Parámetros de cotización»: el cálculo los toma de ahí.
        </p>
      )}

      {alta && (
        <div className="mb-3 rounded-md border border-success/40 bg-success/10 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Código</span>
              <Input
                value={alta.cod}
                onChange={(e) => escribirCod(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && altaValida && confirmarAlta()}
                placeholder="ej. E 90"
                className="h-8 w-32 font-mono text-xs uppercase"
                autoFocus
              />
            </label>
            <label className="text-xs flex-1 min-w-[12rem]">
              <span className="mb-1 block text-muted-foreground">Descripción</span>
              <Input
                value={alta.descripcion}
                onChange={(e) => setAlta({ ...alta, descripcion: e.target.value })}
                placeholder="ej. Tubo Ø45 reforzado"
                className="h-8 text-xs"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Valor máximo</span>
              <Input
                inputMode="decimal"
                value={alta.valorMaximo}
                onChange={(e) => setAlta({ ...alta, valorMaximo: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && altaValida && confirmarAlta()}
                placeholder="0"
                className="h-8 w-28 text-right text-xs"
              />
            </label>
            <Button size="sm" onClick={confirmarAlta} disabled={!altaValida}>
              Agregar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAlta(null)}>
              Cancelar
            </Button>
          </div>
          {sugerencia ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <span>
                En Inventario: <strong>{sugerencia.nemotecnico}</strong>, cuesta{' '}
                {formatCLP(sugerencia.costoIva)} con IVA
                {sugerencia.porPaquete > 1 &&
                  ` el paquete de ${sugerencia.porPaquete} → ${formatCLP(sugerencia.porUnidad)} por unidad`}
                .
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[0.7rem]"
                onClick={() =>
                  setAlta((a) => (a ? { ...a, valorMaximo: String(sugerencia.porUnidad) } : a))
                }
              >
                Usar ese valor
              </Button>
              <span>Conviene revisarlo: el costo de bodega no siempre está al día.</span>
            </p>
          ) : (
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              {hayInventario && alta.cod.trim() && !enBodega(alta.cod)
                ? `«${alta.cod.trim().toUpperCase()}» no está en Inventario: se puede cobrar igual, pero la bodega no lo va a poder descontar hasta darlo de alta allá.`
                : 'El valor máximo es el costo del material; el precio de venta lo calcula el margen.'}
            </p>
          )}
        </div>
      )}

      <div className="max-h-[28rem] overflow-y-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Código</th>
              <th className="px-2 py-1.5 text-left font-medium">Descripción</th>
              <th className="px-2 py-1.5 text-right font-medium">Valor máximo</th>
              {/* La cuenta va en el título de la columna porque «de dónde sale
                  este número» era la pregunta que nadie podía contestar
                  mirando la tabla. */}
              <th className="px-2 py-1.5 text-right font-medium">
                Precio de venta
                <span className="block font-normal text-[0.65rem]">
                  = valor máximo ÷ {textoDivisor(margenInsumo)}
                </span>
              </th>
              <th className="px-2 py-1.5 text-left font-medium">Se usa en</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filas.map(([cod, ins]) => {
              const enFamilias = familiasPorInsumo.get(cod) ?? [];
              return (
                <tr key={cod} className="border-t align-top">
                  <td className="px-2 py-1 font-mono">
                    {cod}
                    {hayInventario && !enBodega(cod) && (
                      <div className="text-[0.65rem] text-warning">no está en Inventario</div>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={ins.descripcion ?? ''}
                      onChange={(e) => editar(cod, { descripcion: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <InputDecimal
                      value={ins.valorMaximo}
                      onChange={(valorMaximo) => editar(cod, { valorMaximo })}
                      className="h-7 w-28 text-right text-xs"
                    />
                  </td>
                  <td
                    className="px-2 py-1 text-right text-muted-foreground"
                    title={`${textoDivisor(ins.valorMaximo)} ÷ ${textoDivisor(margenInsumo)} = ${formatCLP(ins.valorMaximo / margenInsumo)}`}
                  >
                    {formatCLP(ins.valorMaximo / margenInsumo)}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value=""
                      onChange={(e) => e.target.value && usarEn(cod, e.target.value)}
                      className="h-7 w-40 rounded-md border border-input bg-background px-1 text-xs"
                      title="Agregar este insumo a la receta de una familia"
                    >
                      <option value="">
                        {enFamilias.length
                          ? `${enFamilias.length} familias · usar en…`
                          : usados.has(cod)
                            ? 'usar en…'
                            : 'sin uso · usar en…'}
                      </option>
                      {familiasDisponibles.map((f) => (
                        <option key={f} value={f} disabled={enFamilias.includes(f)}>
                          {nombreFamilia(f)}
                          {enFamilias.includes(f) ? ' (ya lo lleva)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => quitar(cod)}
                      title="Quitar de la lista de precios"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!filas.length && (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                  Ningún insumo con ese texto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
