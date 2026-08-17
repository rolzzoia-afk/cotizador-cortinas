// Editor de un producto del catálogo del cotizador (Fase 0): crear, editar
// TODOS los campos (COD_INT, familia, nombre, tipo, descripción, precio,
// descuento, ancho de rollo) y eliminar. Persiste en configuracion
// (catalogo_productos_data + ancho_rollo_data) vía guardarCatalogoProductos.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { guardarCatalogoProductos, guardarAnchoRollo } from '@/modules/cotizador/catalogo';
import {
  eliminarProductoDeCatalogo,
  familiasDelCatalogo,
  guardarProductoEnCatalogo,
  normCod,
  tiposDelCatalogo,
} from '@/modules/cotizador/catalogoEdicion';
import { flujoDeProducto } from '@/modules/cotizador/flujoCatalogo';
import {
  CHIP_IDS,
  FILTROS_CATALOGO,
  chipDeProducto,
  labelChip,
} from '@/modules/cotizador/filtrosCatalogo';
import { useReglasPrecios } from '@/modules/cotizador/reglasPreciosStore';
import { formatCLP } from '@/lib/formatters';
import type { CatalogoProductos, Producto } from '@/modules/cotizador/types';

interface ProductoCatalogoDialogProps {
  /** COD_INT a editar, o null para crear un producto nuevo. */
  codInt: string | null;
  catalogo: CatalogoProductos;
  anchoRollo: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

const num = (s: string): number | null => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function ProductoCatalogoDialog({
  codInt,
  catalogo,
  anchoRollo,
  onClose,
  onSaved,
}: ProductoCatalogoDialogProps) {
  const { empresaId } = useAuth();
  const esNuevo = codInt === null;
  const prev = codInt ? catalogo[codInt] : undefined;

  const [ci, setCi] = useState(codInt ?? '');
  const [cod, setCod] = useState(prev?.cod ?? '');
  const [nombre, setNombre] = useState(prev?.producto ?? '');
  const [tipo, setTipo] = useState(prev?.tipo ?? '');
  const [descripcion, setDescripcion] = useState(prev?.descripcion ?? '');
  const [precio, setPrecio] = useState(prev?.precio ? String(prev.precio) : '');
  const [dctoPct, setDctoPct] = useState(
    prev?.descuento ? String(Math.round(prev.descuento * 100)) : '',
  );
  const [ancho, setAncho] = useState(
    codInt && anchoRollo[codInt] != null
      ? String(anchoRollo[codInt])
      : prev?.anchoRollo
        ? String(prev.anchoRollo)
        : '',
  );
  // Gama comercial: 'A' | 'B' | '' (sin clasificar). La B hace que la cortina
  // nazca en categoría B, con su propio juego de herrajes.
  const [gama, setGama] = useState(() => {
    const g = String(prev?.categoria ?? '').trim().toUpperCase();
    return g === 'A' || g === 'B' ? g : '';
  });
  // Chip del catálogo de Fase 1. '' = automático (se deduce del COD_INT o de la
  // familia); un id explícito lo fija a mano.
  const [chip, setChip] = useState(() => {
    const c = String(prev?.chip ?? '').trim().toUpperCase();
    return CHIP_IDS.includes(c) ? c : '';
  });
  const [saving, setSaving] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  // Dónde caería el producto si se deja en automático, con lo escrito ahora.
  const chipAuto = useMemo(
    () =>
      chipDeProducto(
        { cod: cod.trim(), producto: nombre.trim(), tipo: '', descripcion: '', precio: 0 },
        normCod(ci),
      ),
    [cod, nombre, ci],
  );

  const familias = useMemo(() => familiasDelCatalogo(catalogo), [catalogo]);
  const tipos = useMemo(() => tiposDelCatalogo(catalogo), [catalogo]);

  // Qué le pasaría a este producto al cotizarlo, con lo que hay escrito ahora
  // mismo en el formulario. Es solo lectura: evita descubrir recién en la
  // cotización que la familia tecleada no tiene receta ni tela de referencia.
  const { reglas } = useReglasPrecios();
  const flujo = useMemo(() => {
    if (!cod.trim()) return null;
    const provisorio: Producto = {
      cod: cod.trim(),
      producto: nombre.trim(),
      tipo: tipo.trim(),
      descripcion: descripcion.trim(),
      precio: num(precio) ?? 0,
    };
    return flujoDeProducto(provisorio, normCod(ci) || 'NUEVO', catalogo, reglas);
  }, [cod, nombre, tipo, descripcion, precio, ci, catalogo, reglas]);

  const guardar = async () => {
    if (!empresaId) return;
    const key = normCod(ci);
    if (!key) {
      toast.error('Ingresa el COD_INT.');
      return;
    }
    if (!cod.trim()) {
      toast.error('Ingresa el COD (familia), ej. BLACKOUT_D o ACCESORIO.');
      return;
    }
    if (key !== codInt && catalogo[key]) {
      toast.error(`El código ${key} ya existe en el catálogo.`);
      return;
    }
    const precioNum = precio.trim() === '' ? 0 : num(precio);
    if (precioNum == null || precioNum < 0) {
      toast.error('Precio inválido.');
      return;
    }
    const dctoNum = dctoPct.trim() === '' ? 0 : num(dctoPct);
    if (dctoNum == null || dctoNum < 0 || dctoNum > 100) {
      toast.error('Descuento inválido (0 a 100 %).');
      return;
    }
    const anchoNum = ancho.trim() === '' ? null : num(ancho);
    if (anchoNum != null && anchoNum <= 0) {
      toast.error('Ancho de rollo inválido (en metros, ej. 2,98).');
      return;
    }

    const cambios: Producto = {
      cod: cod.trim(),
      producto: nombre.trim(),
      tipo: tipo.trim(),
      descripcion: descripcion.trim(),
      precio: precioNum,
      descuento: dctoNum / 100,
      // Siempre presente: `undefined` es «sin clasificar» y borra la gama previa.
      categoria: gama || undefined,
      // Ídem: `undefined` devuelve el producto al chip automático.
      chip: chip || undefined,
    };
    setSaving(true);
    try {
      const r = guardarProductoEnCatalogo(catalogo, anchoRollo, codInt, key, cambios, anchoNum);
      await guardarCatalogoProductos(
        empresaId,
        r.catalogo,
        esNuevo ? `antes de crear ${key}` : `antes de editar ${codInt}`,
      );
      await guardarAnchoRollo(empresaId, r.anchoRollo);
      toast.success(esNuevo ? `Código ${key} creado.` : `Código ${key} guardado.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async () => {
    if (!empresaId || !codInt) return;
    if (!confirmandoBorrado) {
      setConfirmandoBorrado(true);
      return;
    }
    setSaving(true);
    try {
      const r = eliminarProductoDeCatalogo(catalogo, anchoRollo, codInt);
      await guardarCatalogoProductos(empresaId, r.catalogo, `antes de eliminar ${codInt}`);
      await guardarAnchoRollo(empresaId, r.anchoRollo);
      toast.success(`Código ${codInt} eliminado del catálogo.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error('No se pudo eliminar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{esNuevo ? 'Nuevo producto del catálogo' : `Editar ${codInt}`}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-xs">COD_INT</Label>
            <Input
              value={ci}
              onChange={(e) => setCi(e.target.value)}
              placeholder="ej. BK 77"
              className="border-border bg-secondary font-mono uppercase"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">COD (familia)</Label>
            <Input
              list="cat-familias"
              value={cod}
              onChange={(e) => setCod(e.target.value)}
              placeholder="ej. BLACKOUT_D"
              className="border-border bg-secondary"
            />
            <datalist id="cat-familias">
              {familias.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            <Label className="mb-1 text-xs">Producto</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. ROLLER BLACKOUT DELUX"
              className="border-border bg-secondary"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Tipo</Label>
            <Input
              list="cat-tipos"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="ej. DELUX / ACCESORIO"
              className="border-border bg-secondary"
            />
            <datalist id="cat-tipos">
              {tipos.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <Label className="mb-1 text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej. RUSTICO LINO"
              className="border-border bg-secondary"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Precio de venta ($/m)</Label>
            <Input
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0 = hereda arquetipo"
              className="border-border bg-secondary text-right"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Descuento por defecto (%)</Label>
            <Input
              inputMode="decimal"
              value={dctoPct}
              onChange={(e) => setDctoPct(e.target.value)}
              placeholder="0"
              className="border-border bg-secondary text-right"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Ancho de rollo (m)</Label>
            <Input
              inputMode="decimal"
              value={ancho}
              onChange={(e) => setAncho(e.target.value)}
              placeholder="ej. 2,98"
              className="border-border bg-secondary text-right"
            />
          </div>
          <div className="col-span-2">
            <Label className="mb-1 text-xs">Chip del catálogo (Fase 1)</Label>
            <select
              value={chip}
              onChange={(e) => setChip(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm"
            >
              <option value="">— automático ({labelChip(chipAuto)}) —</option>
              {FILTROS_CATALOGO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              En qué categoría del catálogo de Fase 1 se ve este código. En automático se deduce de
              la familia; lo que no calza en ninguna cae en «Otros». Elige uno a mano cuando el
              automático no acierte (un motor nuevo, por ejemplo, para que salga junto a sus
              hermanos).
            </p>
          </div>
          <div className="col-span-2">
            <Label className="mb-1 text-xs">Gama (categoría comercial)</Label>
            <select
              value={gama}
              onChange={(e) => setGama(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm"
            >
              <option value="">— sin clasificar —</option>
              <option value="A">A (estándar)</option>
              <option value="B">B (gama económica)</option>
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Una tela de gama B hace que la cortina nazca en categoría B, con su propio juego de
              herrajes, en las categorías que tienen receta (roller simple, cenefa ovalada 38 y dúo
              38). Al reimportar el Excel del catálogo, la gama se vuelve a leer de la planilla.
            </p>
          </div>
        </div>

        {flujo && (
          <div className="rounded-md border border-border bg-secondary/40 p-2 text-[11px]">
            {flujo.entra === 'adicional' ? (
              <>
                Con el tipo «{tipo.trim() || '(vacío)'}» este código entra a la cotización como{' '}
                <strong>adicional</strong>: se cobra su precio × cantidad, sin medidas ni
                materiales. Para que se cobre como cortina, el tipo debe ser PREMIUM, DELUX,
                STANDARD o BASIC.
              </>
            ) : (
              <>
                Se cobra como <strong>cortina</strong>, con la receta de materiales{' '}
                <span className="font-mono">{flujo.recetaKey}</span>
                {!flujo.recetaPropia && ' (de respaldo: la familia no tiene receta propia)'}
                {flujo.telaReferencia ? (
                  <>
                    , y la tela se paga a {formatCLP(flujo.precioMl)}/m según{' '}
                    <span className="font-mono">{flujo.telaReferencia}</span>
                    {flujo.origenPrecio === 'maxFamilia' &&
                      ', que es la tela más cara de la familia porque no hay ninguna declarada como referencia'}
                    .
                  </>
                ) : (
                  <>. La familia todavía no tiene ninguna tela que fije el precio por metro.</>
                )}
              </>
            )}
          </div>
        )}

        {!esNuevo && normCod(ci) !== codInt && (
          <p className="text-[11px] text-amber-400">
            Estás renombrando {codInt} → {normCod(ci)}. Las cotizaciones/OTs guardadas con el
            código anterior quedarán con un código inexistente.
          </p>
        )}

        <DialogFooter className="flex items-center gap-2">
          {!esNuevo && (
            <Button
              variant="destructive"
              onClick={eliminar}
              disabled={saving}
              className="mr-auto gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmandoBorrado ? '¿Confirmar eliminación?' : 'Eliminar'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
