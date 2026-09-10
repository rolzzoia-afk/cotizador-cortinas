// Crear o editar una familia de código.
//
// El PREFIJO solo se escribe al crear: después es la llave con la que se
// buscan los códigos ya emitidos. Renombrar MEC a MECA dejaría 46 artículos
// sin familia y el correlativo volvería a empezar en 1.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import type { FamiliaInsumo } from '@/modules/inventario/codigosInsumo';
import { formatearCodigo } from '@/modules/inventario/codigosInsumo';
import { crearFamilia, guardarFamilia } from '@/modules/inventario/familiasStore';
import { avisosDeFamilia, problemaPrefijoNuevo } from '@/modules/inventario/validadores';

type Borrador = Omit<FamiliaInsumo, 'id'>;

const NUEVA: Borrador = {
  prefijo: '',
  nombre: '',
  categoria: null,
  sub_categoria: null,
  digitos: 2,
  siguiente: 1,
  activo: true,
  descripcion: null,
};

export default function FamiliaDialog({
  abierta,
  familia,
  familias,
  maximoUsado,
  categorias,
  subCategorias,
  empresaId,
  onCerrar,
  onGuardada,
}: {
  abierta: boolean;
  /** `null` es una familia nueva. */
  familia: FamiliaInsumo | null;
  familias: FamiliaInsumo[];
  maximoUsado: number | undefined;
  categorias: string[];
  subCategorias: string[];
  empresaId: string;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const esNueva = !familia;
  const [b, setB] = useState<Borrador>(() => (familia ? { ...familia } : { ...NUEVA }));
  const [guardando, setGuardando] = useState(false);

  const cambiar = (patch: Partial<Borrador>) => setB((x) => ({ ...x, ...patch }));

  const errorPrefijo = esNueva ? problemaPrefijoNuevo(b.prefijo, familias) : null;
  const avisos = avisosDeFamilia(b, maximoUsado);
  const ejemplo = b.prefijo
    ? formatearCodigo(b.prefijo, b.siguiente, b.digitos === 3 ? 3 : 2)
    : '';

  const guardar = async () => {
    if (errorPrefijo) return;
    setGuardando(true);
    const r = esNueva
      ? await crearFamilia(empresaId, {
          ...b,
          prefijo: b.prefijo.trim().toUpperCase(),
          nombre: b.nombre.trim() || b.prefijo.trim().toUpperCase(),
        })
      : await guardarFamilia(familia.id!, {
          nombre: b.nombre.trim() || b.prefijo,
          categoria: b.categoria,
          sub_categoria: b.sub_categoria,
          digitos: b.digitos,
          siguiente: b.siguiente,
          activo: b.activo,
          descripcion: b.descripcion,
        });
    setGuardando(false);
    if (!r.ok) {
      toast.error(r.motivo);
      return;
    }
    toast.success(esNueva ? `Familia ${b.prefijo.toUpperCase()} creada` : 'Familia guardada');
    onGuardada();
  };

  return (
    <Dialog open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esNueva ? 'Nueva familia de código' : `Familia ${familia.prefijo}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="w-28">
              <Label>Prefijo *</Label>
              <Input
                value={b.prefijo}
                onChange={(e) =>
                  cambiar({ prefijo: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })
                }
                disabled={!esNueva}
                maxLength={4}
                placeholder="MEC"
                className="font-mono"
              />
            </div>
            <div className="flex-1">
              <Label>Nombre</Label>
              <Input
                value={b.nombre}
                onChange={(e) => cambiar({ nombre: e.target.value })}
                placeholder="Mecanismos"
              />
            </div>
          </div>
          {errorPrefijo && <p className="-mt-1 text-[0.7rem] text-destructive">{errorPrefijo}</p>}
          {!esNueva && (
            <p className="-mt-2 text-[0.7rem] text-muted-foreground">
              El prefijo no se cambia: es con lo que se buscan los códigos ya emitidos.
            </p>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Categoría por defecto</Label>
              <select
                value={b.categoria ?? ''}
                onChange={(e) => cambiar({ categoria: e.target.value || null })}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">Sin definir</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Label>Subcategoría por defecto</Label>
              <select
                value={b.sub_categoria ?? ''}
                onChange={(e) => cambiar({ sub_categoria: e.target.value || null })}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">Sin definir</option>
                {subCategorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="w-32">
              <Label>Próximo número</Label>
              <InputDecimal
                value={b.siguiente}
                onChange={(n) => cambiar({ siguiente: Math.max(1, Math.round(n)) })}
              />
            </div>
            <div className="w-28">
              <Label>Dígitos</Label>
              <select
                value={b.digitos}
                onChange={(e) => cambiar({ digitos: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value={2}>2 · MEC46</option>
                <option value={3}>3 · INS265</option>
              </select>
            </div>
            {ejemplo && (
              <p className="pb-2 text-[0.7rem] text-muted-foreground">
                El próximo sería <b className="font-mono text-foreground">{ejemplo}</b>
              </p>
            )}
          </div>

          <div>
            <Label>Qué va acá (y qué no)</Label>
            <Input
              value={b.descripcion ?? ''}
              onChange={(e) => cambiar({ descripcion: e.target.value || null })}
              placeholder="Mecanismos de roller, cuadrada y ovalada. Los de vertical van en VER."
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={b.activo}
              onChange={(e) => cambiar({ activo: e.target.checked })}
              className="h-3.5 w-3.5 accent-current"
            />
            Se ofrece al dar de alta un artículo
          </label>

          {avisos.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/[.09] p-2.5 text-[0.7rem]">
              {avisos.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando || !!errorPrefijo}>
            {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
