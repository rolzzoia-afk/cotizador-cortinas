// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Modelos de despiece
//
// El editor de `descuentos_modelo`: los centímetros que se descuentan al
// ancho vendido para cortar tubo, tela, peso, cenefas y perfiles.
//
// Antes esto solo se podía cambiar subiendo el Excel maestro, que reemplaza
// la tabla entera — por eso el tubo E78, la vertical y la pletina se perdían
// en cada import y había que volver a correr un SQL. Ahora se edita acá y la
// fila queda marcada como MANUAL: el import la respeta.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, History, Plus, Ruler, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CAMPOS_NUMERICOS,
  agruparPorSistema,
  duplicarFila,
  etiquetaRespaldo,
  filaNueva,
  validarFila,
  type FilaCatalogo,
} from '@/modules/descuentos/catalogoEdicionModelos';
import {
  cargarRespaldos,
  eliminarFilaCatalogo,
  guardarFilaCatalogo,
  respaldarCatalogo,
  restaurarRespaldo,
  useCatalogoEditable,
} from '@/modules/descuentos/catalogoStore';
import type { RespaldoCatalogo } from '@/modules/descuentos/catalogoEdicionModelos';

export function ModelosCatalogoSection() {
  const { empresaId } = useAuth();
  const { filas, conOrigen, loading, error, refresh } = useCatalogoEditable();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [edicion, setEdicion] = useState<FilaCatalogo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<FilaCatalogo | null>(null);
  const [respaldos, setRespaldos] = useState<RespaldoCatalogo[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);

  useEffect(() => {
    if (empresaId) cargarRespaldos(empresaId).then(setRespaldos);
  }, [empresaId, filas]);

  const grupos = useMemo(() => agruparPorSistema(filas), [filas]);
  const manuales = filas.filter((f) => f.origen === 'manual').length;

  const alternar = (sistema: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(sistema)) s.delete(sistema);
      else s.add(sistema);
      return s;
    });

  const onGuardar = async () => {
    if (!edicion || !empresaId) return;
    const errores = validarFila(edicion, filas);
    if (errores.length > 0) {
      toast.error(errores[0]);
      return;
    }
    setGuardando(true);
    try {
      await respaldarCatalogo(empresaId, filas, `antes de editar ${edicion.tipo_rol || 'un modelo'}`);
      await guardarFilaCatalogo(empresaId, edicion, conOrigen);
      await refresh();
      setEdicion(null);
      toast.success(
        conOrigen
          ? 'Modelo guardado. Queda marcado como manual: el Excel ya no lo reemplaza.'
          : 'Modelo guardado.',
      );
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const onBorrar = async () => {
    if (!aBorrar?.id || !empresaId) return;
    setGuardando(true);
    try {
      await respaldarCatalogo(empresaId, filas, `antes de eliminar ${aBorrar.tipo_rol}`);
      await eliminarFilaCatalogo(empresaId, aBorrar.id);
      await refresh();
      setABorrar(null);
      toast.success('Modelo eliminado. Queda en el respaldo por si hay que volver atrás.');
    } catch (e) {
      toast.error('Error al eliminar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const onRestaurar = async (r: RespaldoCatalogo) => {
    if (!empresaId) return;
    setGuardando(true);
    try {
      await respaldarCatalogo(empresaId, filas, 'antes de restaurar un respaldo');
      const n = await restaurarRespaldo(empresaId, r, conOrigen);
      await refresh();
      setVerRespaldos(false);
      toast.success(`Respaldo aplicado: ${n} modelos.`);
    } catch (e) {
      toast.error('Error al restaurar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Ruler className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Modelos de despiece</h2>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setVerRespaldos(true)} disabled={!respaldos.length}>
            <History className="mr-1 h-3.5 w-3.5" />
            Respaldos ({respaldos.length})
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEdicion(filaNueva())}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Modelo nuevo
          </Button>
        </div>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Los centímetros que se descuentan al ancho vendido para cortar cada pieza. Lo que edites acá
        manda sobre el Excel maestro: la fila queda marcada como <strong>manual</strong> y el import
        no la reemplaza.{' '}
        {!loading && (
          <>
            Hoy hay <strong>{filas.length}</strong> modelos
            {conOrigen && <> ({manuales} manuales)</>}.
          </>
        )}
        {!conOrigen && !loading && (
          <span className="text-warning">
            {' '}
            Falta correr <code>sql/20260804_catalogo_origen_import_v2.sql</code>: hasta entonces el
            import del Excel sigue reemplazando todo.
          </span>
        )}
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p className="text-xs text-destructive">No se pudo cargar el catálogo: {error}</p>
      ) : (
        <div className="space-y-2">
          {grupos.map((g) => {
            const abierto = abiertos.has(g.sistema);
            return (
              <div key={g.sistema} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => alternar(g.sistema)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-muted"
                >
                  {abierto ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {g.sistema}
                  <span className="font-normal text-muted-foreground">({g.filas.length})</span>
                </button>

                {abierto && (
                  <div className="overflow-x-auto border-t">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Tipo · mecanismo</th>
                          {CAMPOS_NUMERICOS.map((c) => (
                            <th key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                              {c.label}
                            </th>
                          ))}
                          <th className="px-2 py-1.5 text-left font-medium">Tubos</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {g.filas.map((f) => (
                          <tr key={f.id ?? f.tipo_rol} className={f.activo ? '' : 'opacity-50'}>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                className="text-left font-medium hover:underline"
                                onClick={() => setEdicion({ ...f })}
                              >
                                {f.tipo_rol}
                              </button>
                              {f.mecanismo && (
                                <span className="block text-[10px] text-muted-foreground">{f.mecanismo}</span>
                              )}
                              <span className="mt-0.5 flex gap-1">
                                {f.origen === 'manual' && (
                                  <span className="rounded bg-success/15 px-1 text-[9px] font-semibold text-success">
                                    MANUAL
                                  </span>
                                )}
                                {!f.activo && (
                                  <span className="rounded bg-muted px-1 text-[9px] font-semibold">
                                    INACTIVO
                                  </span>
                                )}
                              </span>
                            </td>
                            {CAMPOS_NUMERICOS.map((c) => (
                              <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                {f[c.key] || '·'}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                              {f.codigos_tubo || '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 text-right">
                              <button
                                type="button"
                                title="Duplicar"
                                className="rounded p-1 hover:bg-muted"
                                onClick={() => setEdicion(duplicarFila(f))}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Eliminar"
                                className="rounded p-1 text-destructive hover:bg-muted"
                                onClick={() => setABorrar(f)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor de una fila */}
      <Dialog open={!!edicion} onOpenChange={(o) => !o && setEdicion(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edicion?.id ? 'Editar modelo' : 'Modelo nuevo'}</DialogTitle>
            <DialogDescription>
              Al guardar, la fila queda como manual y el Excel maestro deja de reemplazarla.
            </DialogDescription>
          </DialogHeader>

          {edicion && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <CampoTexto
                  label="Sistema"
                  valor={edicion.sistema}
                  onChange={(v) => setEdicion({ ...edicion, sistema: v })}
                  hint="ROLLER_SIMPLE, DARK_ROLLER…"
                />
                <CampoTexto
                  label="Tipo de rol"
                  valor={edicion.tipo_rol}
                  onChange={(v) => setEdicion({ ...edicion, tipo_rol: v })}
                />
                <CampoTexto
                  label="Mecanismo"
                  valor={edicion.mecanismo}
                  onChange={(v) => setEdicion({ ...edicion, mecanismo: v })}
                  hint="MEC_18_045_… (vacío si no aplica)"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {CAMPOS_NUMERICOS.map((c) => (
                  <label key={c.key} className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">
                      {c.label} ({c.unidad})
                    </span>
                    <Input
                      type="number"
                      step="0.1"
                      value={String(edicion[c.key])}
                      onChange={(e) =>
                        setEdicion({ ...edicion, [c.key]: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </label>
                ))}
              </div>

              <CampoTexto
                label="Códigos de tubo"
                valor={edicion.codigos_tubo}
                onChange={(v) => setEdicion({ ...edicion, codigos_tubo: v })}
                hint="Separados por ; — por ejemplo E04; E05; E78"
              />
              <CampoTexto
                label="Notas"
                valor={edicion.notas}
                onChange={(v) => setEdicion({ ...edicion, notas: v })}
              />

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={edicion.activo}
                  onChange={(e) => setEdicion({ ...edicion, activo: e.target.checked })}
                />
                Activo (los inactivos no se ofrecen al cotizar)
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setEdicion(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              <Save className="mr-1 h-3.5 w-3.5" />
              {guardando ? 'Guardando…' : 'Guardar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog open={!!aBorrar} onOpenChange={(o) => !o && setABorrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar el modelo</DialogTitle>
            <DialogDescription>
              Se elimina «{aBorrar?.tipo_rol}» del catálogo. Las cortinas que se coticen con este
              modelo dejarán de tener despiece. Queda un respaldo por si hay que volver atrás.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setABorrar(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onBorrar} disabled={guardando}>
              {guardando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respaldos */}
      <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respaldos del catálogo</DialogTitle>
            <DialogDescription>
              Cada guardado deja una foto del catálogo completo. Restaurar reescribe los modelos del
              respaldo y repone los borrados; lo que hayas creado después se conserva.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {respaldos.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                <span className="flex-1">{etiquetaRespaldo(r)}</span>
                <Button size="sm" variant="secondary" onClick={() => onRestaurar(r)} disabled={guardando}>
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CampoTexto({
  label,
  valor,
  onChange,
  hint,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
