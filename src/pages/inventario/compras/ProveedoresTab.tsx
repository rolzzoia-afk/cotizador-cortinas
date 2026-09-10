// Los proveedores, con los nombres que usa cada sistema.
//
// El RUT es la llave: es lo único que Finanzas y nosotros escribimos igual.
// El nombre no — «SINFLEX» acá, «SYNFLEX» allá, «IMPORTADORA NAYEM LTDA» en
// la factura. Por eso cada proveedor guarda sus ALIAS: con qué nombres aparece
// escrito en nuestros artículos.
//
// Los alias son lo único que se edita a mano. Lo demás lo trae Finanzas y se
// pisaría en la siguiente pasada.

import { useMemo, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { normalizarRut, type OrdenCompra, type ProveedorCompra } from '@/modules/inventario/compras';
import { guardarAliasProveedor } from '@/modules/inventario/comprasStore';
import { useProveedores } from '@/modules/inventario/proveedoresStore';

export function ProveedoresTab({
  proveedores,
  ordenes,
  puedeEditar,
  onCambio,
}: {
  proveedores: ProveedorCompra[];
  ordenes: OrdenCompra[];
  /** Editar los alias es de admin. */
  puedeEditar: boolean;
  onCambio: () => Promise<void>;
}) {
  // Los nombres tal como están escritos hoy en los artículos: son los
  // candidatos a alias, y evitan tener que escribirlos de memoria.
  const { proveedores: enArticulos } = useProveedores();
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const abiertasPorRut = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ordenes) {
      if (o.estado !== 'en_espera' && o.estado !== 'recibida_parcial') continue;
      const r = normalizarRut(o.proveedor_rut);
      if (!r) continue;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [ordenes]);

  const articulosPorNombre = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of enArticulos) {
      m.set(p.nombre.trim().toUpperCase(), p.insumos + p.telas);
    }
    return m;
  }, [enArticulos]);

  const cuentaArticulos = (p: ProveedorCompra): number => {
    let n = 0;
    for (const a of [p.razon_social, p.nombre ?? '', ...p.alias]) {
      const k = a.trim().toUpperCase();
      if (k) n += articulosPorNombre.get(k) ?? 0;
    }
    return n;
  };

  const cambiarAlias = async (p: ProveedorCompra, alias: string[]) => {
    setGuardando(true);
    try {
      await guardarAliasProveedor(p.id, alias);
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  if (proveedores.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-10 text-center text-sm text-muted-foreground">
        Los proveedores llegan con las órdenes de Finanzas, que es de donde sale el RUT de cada uno.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Vienen de Finanzas, con su RUT. Los <b className="font-medium text-foreground">alias</b> son
        los nombres con que aparecen escritos en nuestros artículos: sirven para saber cuánto se le
        compra a cada uno y para reconocer más rápido lo que llega.
      </p>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {proveedores.map((p) => {
          const abiertas = abiertasPorRut.get(normalizarRut(p.rut)) ?? 0;
          const arts = cuentaArticulos(p);
          const sugerencias = [...articulosPorNombre.keys()]
            .filter(
              (n) =>
                !p.alias.includes(n) &&
                n !== p.razon_social.trim().toUpperCase() &&
                (n.includes(p.razon_social.trim().toUpperCase().slice(0, 5)) ||
                  p.razon_social.toUpperCase().includes(n.slice(0, 5))),
            )
            .slice(0, 3);

          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.875rem] font-medium">{p.razon_social}</div>
                  <div className="font-mono text-[0.7rem] text-muted-foreground">{p.rut}</div>
                </div>
                {abiertas > 0 && (
                  <Badge variant="accent">
                    {abiertas} orden{abiertas === 1 ? '' : 'es'} abierta{abiertas === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>

              <div className="mt-2 text-[0.72rem] text-muted-foreground">
                {arts > 0
                  ? `${arts.toLocaleString('es-CL')} artículo${arts === 1 ? '' : 's'} nuestros`
                  : 'Ningún artículo lo nombra todavía'}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {p.alias.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-1.5 py-0.5 text-[0.7rem]"
                  >
                    {a}
                    {puedeEditar && (
                      <button
                        onClick={() => void cambiarAlias(p, p.alias.filter((x) => x !== a))}
                        aria-label={`Quitar el alias ${a}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}

                {puedeEditar &&
                  (editando === p.id ? (
                    <span className="inline-flex items-center gap-1">
                      <Input
                        autoFocus
                        value={nuevo}
                        onChange={(e) => setNuevo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditando(null);
                          if (e.key === 'Enter' && nuevo.trim()) {
                            void cambiarAlias(p, [...p.alias, nuevo]).then(() => {
                              setNuevo('');
                              setEditando(null);
                            });
                          }
                        }}
                        placeholder="SINFLEX"
                        className="h-7 w-28 text-[0.72rem]"
                      />
                      <button
                        onClick={() => {
                          if (!nuevo.trim()) return;
                          void cambiarAlias(p, [...p.alias, nuevo]).then(() => {
                            setNuevo('');
                            setEditando(null);
                          });
                        }}
                        aria-label="Guardar el alias"
                        className="text-success"
                      >
                        {guardando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditando(p.id);
                        setNuevo('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[0.7rem] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> alias
                    </button>
                  ))}
              </div>

              {puedeEditar && editando === p.id && sugerencias.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 text-[0.68rem] text-muted-foreground">
                  <span>De los artículos:</span>
                  {sugerencias.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        void cambiarAlias(p, [...p.alias, s]).then(() => setEditando(null))
                      }
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProveedoresTab;
