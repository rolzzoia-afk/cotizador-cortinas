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
  const [saving, setSaving] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const familias = useMemo(() => familiasDelCatalogo(catalogo), [catalogo]);
  const tipos = useMemo(() => tiposDelCatalogo(catalogo), [catalogo]);

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
    };
    setSaving(true);
    try {
      const r = guardarProductoEnCatalogo(catalogo, anchoRollo, codInt, key, cambios, anchoNum);
      await guardarCatalogoProductos(empresaId, r.catalogo);
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
      await guardarCatalogoProductos(empresaId, r.catalogo);
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
        </div>

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
