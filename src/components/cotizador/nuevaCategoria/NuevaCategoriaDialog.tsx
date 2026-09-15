// ─────────────────────────────────────────────────────────────────────
// EL ASISTENTE «NUEVA CATEGORÍA».
//
// Cuatro pasos: qué categoría es, con qué receta se cobra, los productos (una
// grilla donde se pega el Excel) y qué se va a escribir. Al final guarda, en
// este orden: reglas de precio → pastilla → catálogo. Primero con qué cobrar y
// dónde mostrarlo, y recién después los productos.
//
// El borrador vive acá; toda la lógica es de `modules/cotizador/nuevaCategoria*`.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hoyISO } from '@/pages/ventas/utils/helpers';
import { useCatalogoProductos, useAnchoRollo, guardarCatalogoProductos, guardarAnchoRollo } from '@/modules/cotizador/catalogo';
import { useChipsCustom } from '@/modules/cotizador/chipsCustomStore';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import {
  cargarReglasPrecios,
  guardarReglasPrecios,
  respaldarReglasPrecios,
  useReglasPrecios,
} from '@/modules/cotizador/reglasPreciosStore';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import { categoriasParaSelect } from '@/modules/descuentos/tiposCortina';
import { validarReglasPrecios } from '@/modules/cotizador/reglasPrecios';
import { HEX_CHIP_CUSTOM_DEFAULT } from '@/modules/cotizador/chipsCustom';
import {
  familiasDelBorrador,
  filaNueva,
  moldeSugerido,
  type BorradorCategoria,
  type ContextoCategoria,
  type FilaProductoNueva,
} from '@/modules/cotizador/nuevaCategoria';
import { aplicarNuevaCategoria } from '@/modules/cotizador/nuevaCategoriaAplicar';
import { hayErroresDeFila, validarBorrador } from '@/modules/cotizador/nuevaCategoriaValidar';
import PasoCategoria from './PasoCategoria';
import PasoCobro from './PasoCobro';
import GrillaProductos from './GrillaProductos';
import PasoRevisar from './PasoRevisar';

type Props = {
  /** Familia existente a la que solo se le agregan productos (sin pasos 1 y 2). */
  familiaInicial?: string;
  onClose: () => void;
  onSaved: () => void;
};

const TITULOS = ['La categoría', 'Cómo se cobra', 'Los productos', 'Revisar y crear'];

export default function NuevaCategoriaDialog({ familiaInicial, onClose, onSaved }: Props) {
  const { empresaId, user } = useAuth();
  const { catalogo, refresh: refreshCatalogo } = useCatalogoProductos();
  const { anchoRollo, refresh: refreshAncho } = useAnchoRollo();
  const { chips, guardar: guardarChips } = useChipsCustom();
  const { reglas } = useReglasPrecios();
  const { reglas: seleccion } = useReglasSeleccion();
  const { parametros } = useParametrosCotizador();

  // Con una familia ya elegida no hay nada que decidir de la categoría: se
  // entra directo a la grilla.
  const [paso, setPaso] = useState(familiaInicial ? 3 : 1);
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<BorradorCategoria>(() => ({
    nombre: '',
    tipo: 'roller',
    baseCod: '',
    pastilla: { modo: 'nueva', label: '', hex: HEX_CHIP_CUSTOM_DEFAULT },
    categoriaFabricacion: '',
    moldes: {},
    baseVerticalDe: {},
    filas: [],
    ...(familiaInicial ? { familiaExistente: familiaInicial } : {}),
  }));

  const ctx: ContextoCategoria = useMemo(
    () => ({
      catalogo,
      anchoRollo,
      reglas,
      chips,
      parametros: { iva: parametros.iva, margenInsumo: parametros.margenInsumo },
      categoriasSelect: categoriasParaSelect(seleccion.tipos),
      hoy: hoyISO(),
    }),
    [catalogo, anchoRollo, reglas, chips, parametros, seleccion.tipos],
  );

  const validacion = useMemo(() => validarBorrador(borrador, ctx), [borrador, ctx]);
  const resultado = useMemo(() => aplicarNuevaCategoria(borrador, ctx), [borrador, ctx]);

  /** Al tocar la categoría se re-proponen los moldes de las familias nuevas. */
  const cambiar = (patch: Partial<BorradorCategoria>) =>
    setBorrador((b) => {
      const siguiente = { ...b, ...patch };
      const moldes = { ...siguiente.moldes };
      for (const cod of familiasDelBorrador(siguiente)) {
        if (!moldes[cod] && siguiente.tipo !== 'vertical') {
          moldes[cod] = moldeSugerido(cod, siguiente.tipo);
        }
      }
      return { ...siguiente, moldes };
    });

  const setFilas = (filas: FilaProductoNueva[]) => cambiar({ filas });

  // Al llegar a la grilla sin nada escrito, una fila para empezar.
  const irA = (n: number) => {
    if (n === 3 && !borrador.filas.length) {
      setBorrador((b) => ({ ...b, filas: [filaNueva(b, ctx)] }));
    }
    setPaso(n);
  };

  const puedeAvanzar =
    paso === 1
      ? !!borrador.nombre.trim() && !!borrador.baseCod.trim()
      : paso === 3
        ? !hayErroresDeFila(validacion)
        : true;

  const guardar = async () => {
    if (!empresaId) return;
    if (validacion.errores.length || hayErroresDeFila(validacion)) {
      toast.error('Todavía hay cosas que corregir.');
      return;
    }
    setGuardando(true);
    try {
      // Se relee lo guardado: si alguien tocó los precios mientras este
      // asistente estaba abierto, se escribe sobre lo suyo y no sobre una copia
      // vieja.
      const frescas = await cargarReglasPrecios(empresaId);
      const r = aplicarNuevaCategoria(borrador, { ...ctx, reglas: frescas });
      const { errores } = validarReglasPrecios(r.reglas);
      if (errores.length) {
        toast.error(errores[0]);
        return;
      }
      const motivo = borrador.familiaExistente
        ? `antes de agregar productos a ${borrador.familiaExistente}`
        : `antes de crear la categoría ${borrador.baseCod}`;

      if (r.reglas !== frescas) {
        await respaldarReglasPrecios(empresaId, frescas, motivo, user?.email ?? undefined);
        await guardarReglasPrecios(empresaId, r.reglas);
      }
      if (r.chips !== chips) await guardarChips(r.chips);
      await guardarCatalogoProductos(empresaId, r.catalogo, motivo);
      await guardarAnchoRollo(empresaId, r.anchoRollo);

      refreshCatalogo();
      refreshAncho();
      toast.success(
        borrador.familiaExistente
          ? `${r.resumen.productos} producto(s) agregados a ${borrador.familiaExistente}.`
          : `Categoría ${borrador.baseCod} creada con ${r.resumen.productos} producto(s).`,
      );
      onSaved();
      onClose();
    } catch (e) {
      toast.error('No se pudo crear: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const primerPaso = familiaInicial ? 3 : 1;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        className={`max-h-[92vh] overflow-y-auto ${paso === 3 ? 'max-w-[95vw]' : 'max-w-3xl'}`}
      >
        <DialogHeader>
          <DialogTitle>
            {familiaInicial
              ? `Agregar productos a ${familiaInicial}`
              : 'Nueva categoría del catálogo'}
          </DialogTitle>
          <DialogDescription>
            Paso {paso} de 4 · {TITULOS[paso - 1]}
          </DialogDescription>
        </DialogHeader>

        {paso === 1 && (
          <PasoCategoria borrador={borrador} ctx={ctx} tipos={seleccion.tipos} onChange={cambiar} />
        )}
        {paso === 2 && <PasoCobro borrador={borrador} ctx={ctx} onChange={cambiar} />}
        {paso === 3 && (
          <GrillaProductos
            borrador={borrador}
            ctx={ctx}
            porFila={validacion.porFila}
            onFilas={setFilas}
          />
        )}
        {paso === 4 && (
          <PasoRevisar borrador={borrador} resultado={resultado} validacion={validacion} />
        )}

        {paso < 4 && validacion.errores.length > 0 && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px]">
            {validacion.errores.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-2">
          {paso > primerPaso && (
            <Button variant="ghost" size="sm" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
          )}
          {paso === 3 && (
            <span className="text-[11px] text-muted-foreground">
              {borrador.filas.length} fila(s) ·{' '}
              {Object.values(validacion.porFila).filter((f) => Object.keys(f.errores).length).length}{' '}
              con error
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            {paso < 4 ? (
              <Button size="sm" onClick={() => irA(paso + 1)} disabled={!puedeAvanzar}>
                Continuar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={guardar}
                disabled={guardando || validacion.errores.length > 0 || hayErroresDeFila(validacion)}
              >
                {guardando ? 'Creando…' : familiaInicial ? 'Agregar los productos' : 'Crear la categoría'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
