// Alta de un CÓDIGO de cortina nuevo clonando uno existente. Escribe SOLO el
// catálogo del cotizador (configuracion → catalogo_productos_data + ancho_rollo_data).
// El nuevo código hereda la receta de familia (cod), producto, tipo, color y
// ancho de rollo del código base → los cálculos del cotizador/optimizador
// quedan idénticos; solo cambian el COD_INT y el nombre del diseño.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import {
  useCatalogoProductos,
  useAnchoRollo,
  guardarCatalogoProductos,
  guardarAnchoRollo,
} from '@/modules/cotizador/catalogo';
import FieldText from '../components/fields/FieldText';
import FieldNumber from '../components/fields/FieldNumber';
import type { Producto } from '@/modules/cotizador/types';

interface ClonarCodigoDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

// Las claves del catálogo son tipo "BK 13": normalizamos a mayúsculas + un espacio.
const normCod = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

function DesgloseItem({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </>
  );
}

export default function ClonarCodigoDialog({ onClose, onSaved }: ClonarCodigoDialogProps) {
  const { empresaId } = useAuth();
  const { catalogo, loading, refresh } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();

  const [baseCod, setBaseCod] = useState('');
  const [filtro, setFiltro] = useState('');
  const [nuevoCod, setNuevoCod] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState<number | null>(null);
  const [anchoR, setAnchoR] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const codigos = useMemo(() => Object.keys(catalogo).sort(), [catalogo]);
  const opciones = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return codigos
      .filter((c) => {
        if (!q) return true;
        const p = catalogo[c];
        return [c, p?.producto, p?.tipo, p?.cod].some((v) =>
          (v || '').toString().toLowerCase().includes(q),
        );
      })
      .slice(0, 100);
  }, [codigos, catalogo, filtro]);

  const base = baseCod ? catalogo[baseCod] : null;
  const anchoBase = base ? (anchoRollo[baseCod] ?? Number(base.anchoRollo) ?? 2.98) : null;

  const elegirBase = (cod: string) => {
    setBaseCod(cod);
    const p = catalogo[cod];
    if (p) {
      setPrecio(Number(p.precio) || null);
      setAnchoR(anchoRollo[cod] ?? Number(p.anchoRollo) ?? 2.98);
    }
  };

  const guardar = async () => {
    if (!empresaId) return;
    if (!base) {
      toast.error('Elige un código base para heredar la familia.');
      return;
    }
    const codigo = normCod(nuevoCod);
    if (!codigo) {
      toast.error('Ingresa el código nuevo (COD_INT).');
      return;
    }
    if (!descripcion.trim()) {
      toast.error('Ingresa el nombre del diseño.');
      return;
    }
    if (codigos.some((c) => c.toUpperCase() === codigo)) {
      toast.error(`El código ${codigo} ya existe en el catálogo.`);
      return;
    }
    const precioNum = precio ?? Number(base.precio) ?? 0;
    const anchoNum = anchoR ?? anchoBase ?? 2.98;
    setSaving(true);
    try {
      const nuevoProducto: Producto = {
        ...base,
        descripcion: descripcion.trim(),
        precio: precioNum,
        anchoRollo: anchoNum,
      };
      await guardarCatalogoProductos(empresaId, { ...catalogo, [codigo]: nuevoProducto });
      await guardarAnchoRollo(empresaId, { ...anchoRollo, [codigo]: anchoNum });
      await refresh();
      toast.success(`Código ${codigo} creado (hereda de ${baseCod}).`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Clonar código de cortina</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Cargando catálogo…</div>
          ) : (
            <>
              {/* Paso 1: código base */}
              <div>
                <Label className="mb-1 text-xs">Código base (familia a heredar)</Label>
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar código, producto o tipo…"
                  className="mb-1 border-border bg-secondary"
                />
                <select
                  value={baseCod}
                  onChange={(e) => elegirBase(e.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-2 py-2 text-sm"
                >
                  <option value="">— Elige un código —</option>
                  {opciones.map((c) => (
                    <option key={c} value={c}>
                      {c} · {catalogo[c]?.producto} · {catalogo[c]?.tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desglose de lo heredado */}
              {base && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                  <div className="mb-1.5 font-bold uppercase tracking-wider text-muted-foreground">
                    Hereda de {baseCod}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <DesgloseItem k="Familia / receta" v={base.cod} />
                    <DesgloseItem k="Producto" v={base.producto} />
                    <DesgloseItem k="Tipo" v={base.tipo} />
                    <DesgloseItem k="Color / grupo" v={base.colorGrupo || '—'} />
                  </dl>
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                    Los cálculos de corte y materiales usan la receta{' '}
                    <strong className="text-foreground">{base.cod}</strong>, idéntica al código base →
                    el diseño nuevo cotiza igual.
                  </p>
                </div>
              )}

              {/* Paso 2: datos del nuevo código */}
              {base && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldText
                    label="Código nuevo (COD_INT)"
                    value={nuevoCod}
                    onChange={setNuevoCod}
                    placeholder="ej. BK 70"
                  />
                  <FieldText
                    label="Nombre del diseño"
                    value={descripcion}
                    onChange={setDescripcion}
                    placeholder="ej. IGUAZÚ 1906 NEGRO"
                  />
                  <FieldNumber label="Precio" value={precio} onChange={setPrecio} />
                  <FieldNumber
                    label="Ancho de rollo (m)"
                    value={anchoR}
                    onChange={setAnchoR}
                    step={0.01}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving || !base}>
            {saving ? 'Guardando…' : 'Crear código'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
