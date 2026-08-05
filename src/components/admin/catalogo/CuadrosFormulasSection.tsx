// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Fórmulas por tipo de cortina
//
// Los cuadros de la pizarra del taller, EDITABLES: por cada sistema y
// variante, qué piezas se cortan y cuánto se les descuenta o suma.
//
// REGLA DE ORO: el total no se recalcula acá. Cada tecla vuelve a llamar al
// motor de producción (`construirCuadros` → `calcularDespiece`) con el
// borrador, así que lo que se ve mientras se edita es exactamente lo que se
// va a cortar cuando se guarde.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Save, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  CONSTANTES_EDITABLES,
  MEDIDA_PRUEBA_DEFAULT,
  agruparCuadros,
  construirCuadros,
  construirCuadrosDeCatalogo,
  formatearAjuste,
  type CuadroFormula,
} from '@/modules/descuentos/cuadrosFormulas';
import {
  FORMULAS_DEFAULT,
  conCampoEditado,
  leerCampo,
  sonDefault,
  type FormulasFamilias,
} from '@/modules/descuentos/formulasFamilias';
import {
  cargarRespaldosFormulas,
  guardarFormulas,
  respaldarFormulas,
  useFormulasFamilias,
  type RespaldoFormulas,
} from '@/modules/descuentos/formulasStore';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function CuadrosFormulasSection() {
  const { empresaId } = useAuth();
  const { modelos, loading: loadingModelos } = useDescuentosModelo();
  const { formulas, loading, refresh } = useFormulasFamilias();
  // Los tipos de cortina propios agregan sus propios cuadros.
  const { reglas } = useReglasSeleccion();

  const [draft, setDraft] = useState<FormulasFamilias>(FORMULAS_DEFAULT);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [anchoCm, setAnchoCm] = useState(String(MEDIDA_PRUEBA_DEFAULT.anchoCm));
  const [altoCm, setAltoCm] = useState(String(MEDIDA_PRUEBA_DEFAULT.altoCm));
  const [verCatalogo, setVerCatalogo] = useState(false);
  const [respaldos, setRespaldos] = useState<RespaldoFormulas[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(formulas);
      setDirty(false);
    }
  }, [loading, formulas]);

  useEffect(() => {
    if (empresaId) cargarRespaldosFormulas(empresaId).then(setRespaldos);
  }, [empresaId, formulas]);

  const medida = useMemo(
    () => ({
      anchoCm: parseFloat(anchoCm.replace(',', '.')) || MEDIDA_PRUEBA_DEFAULT.anchoCm,
      altoCm: parseFloat(altoCm.replace(',', '.')) || MEDIDA_PRUEBA_DEFAULT.altoCm,
    }),
    [anchoCm, altoCm],
  );

  // Los cuadros se recalculan con el BORRADOR: el total se mueve al tipear.
  const grupos = useMemo(
    () =>
      agruparCuadros(
        verCatalogo
          ? construirCuadrosDeCatalogo(modelos, medida, draft)
          : construirCuadros(modelos, medida, draft, reglas.tipos),
      ),
    [modelos, medida, verCatalogo, draft, reglas.tipos],
  );

  const editar = (campo: string, valor: number) => {
    setDraft((d) => conCampoEditado(d, campo, valor));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    setGuardando(true);
    try {
      await respaldarFormulas(empresaId, formulas, 'antes de editar las fórmulas');
      await guardarFormulas(empresaId, draft);
      await refresh();
      setDirty(false);
      toast.success('Fórmulas guardadas. Las OTs que se calculen ahora usan estas medidas.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const onRestaurar = async (r: RespaldoFormulas) => {
    setDraft(r.formulas);
    setDirty(true);
    setVerRespaldos(false);
    toast.info('Respaldo cargado. Presiona Guardar para aplicarlo.');
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Table2 className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Fórmulas por tipo de cortina</h2>
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVerRespaldos(true)}
            disabled={!respaldos.length}
          >
            <History className="mr-1 h-3.5 w-3.5" />
            Respaldos ({respaldos.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(FORMULAS_DEFAULT);
              setDirty(true);
              toast.info('Cargadas las fórmulas de fábrica. Presiona Guardar para aplicarlas.');
            }}
            disabled={guardando}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Valores de fábrica
          </Button>
          <Button size="sm" onClick={onGuardar} disabled={guardando || !empresaId || !dirty}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {guardando ? 'Guardando…' : 'Guardar fórmulas'}
          </Button>
        </div>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        La columna <strong>dcto. / suma</strong> es lo que se le hace a la medida vendida y se puede
        editar; <strong>total</strong> es lo que sale con la medida de prueba de acá abajo, calculado
        con el mismo motor que corta en producción. Los cambios recién afectan a las OTs cuando
        aprietas Guardar, y solo a las que se calculen desde ese momento.
      </p>

      {!sonDefault(draft) && (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          Estas fórmulas están <strong>modificadas</strong> respecto de las de fábrica.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Ancho de prueba (cm)</span>
          <Input
            className="w-32"
            value={anchoCm}
            onChange={(e) => setAnchoCm(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Alto de prueba (cm)</span>
          <Input
            className="w-32"
            value={altoCm}
            onChange={(e) => setAltoCm(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            checked={verCatalogo}
            onChange={(e) => setVerCatalogo(e.target.checked)}
          />
          Ver roller, dúo y pletina
        </label>
      </div>

      {loading || loadingModelos ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {verCatalogo && (
            <p className="mb-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              Estos cuadros salen de la fila del catálogo de cada modelo: sus descuentos se editan
              arriba, en <strong>Modelos de despiece</strong>.
            </p>
          )}
          <div className="space-y-6">
            {grupos.map((g) => (
              <div key={g.grupo}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.grupo}
                </h3>
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {g.cuadros.map((c) => (
                    <Cuadro key={c.id} cuadro={c} draft={draft} onEditar={editar} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!verCatalogo && <Constantes draft={draft} onEditar={editar} />}
        </>
      )}

      <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respaldos de las fórmulas</DialogTitle>
            <DialogDescription>
              Cada guardado deja una foto de las fórmulas anteriores. Al restaurar quedan cargadas
              como borrador: revisa los totales y presiona Guardar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {respaldos.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                <span className="flex-1">
                  {new Date(r.fecha).toLocaleString('es-CL', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {r.motivo && ` · ${r.motivo}`}
                </span>
                <Button size="sm" variant="secondary" onClick={() => onRestaurar(r)}>
                  Cargar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Cuadro({
  cuadro,
  draft,
  onEditar,
}: {
  cuadro: CuadroFormula;
  draft: FormulasFamilias;
  onEditar: (campo: string, valor: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="bg-muted/60 px-2 py-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wide">{cuadro.titulo}</div>
        <div className="text-[10px] text-muted-foreground">{cuadro.subtitulo}</div>
      </div>

      <table className="w-full text-[11px]">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr className="border-b">
            <th className="px-2 py-1 text-left font-medium">Pieza</th>
            <th className="px-2 py-1 text-right font-medium">Dcto. / suma</th>
            <th className="px-2 py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {cuadro.filas.map((f, i) => {
            const valor = f.campo ? leerCampo(draft, f.campo) : null;
            return (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1">
                  {f.componente}
                  {f.referencia === 'alto' && (
                    <span className="ml-1 text-[9px] text-muted-foreground">(alto)</span>
                  )}
                  {f.desde && (
                    <span className="block text-[9px] text-muted-foreground">desde {f.desde}</span>
                  )}
                  {f.perforacion && (
                    <span className="ml-1 text-[9px] text-muted-foreground">
                      perf. {f.perforacion}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right">
                  {f.campo && valor !== null ? (
                    <span className="inline-flex items-center gap-1">
                      {f.compartido && (
                        <span
                          title="Este número lo comparten varios cuadros: al cambiarlo se mueven todos."
                          className="cursor-help text-[9px] text-warning"
                        >
                          ⇄
                        </span>
                      )}
                      <Input
                        className="h-6 w-16 px-1 text-right text-[11px] tabular-nums"
                        value={String(valor).replace('.', ',')}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value.replace(',', '.'));
                          if (Number.isFinite(n)) onEditar(f.campo!, n);
                        }}
                        inputMode="decimal"
                      />
                    </span>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {formatearAjuste(f.ajusteCm)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right font-semibold tabular-nums">
                  {f.pendiente ? '—' : f.referencia === 'cantidad' ? f.medidaCm : fmt(f.medidaCm)}
                </td>
              </tr>
            );
          })}
          {cuadro.filas.length === 0 && (
            <tr>
              <td colSpan={3} className="px-2 py-2 text-center text-muted-foreground">
                Sin piezas para esta medida.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {cuadro.perfiles.length > 0 && (
        <>
          <div className="border-t bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Perfiles opcionales
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              {cuadro.perfiles.map((p) => (
                <tr key={p.key} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      readOnly
                      checked={p.activoPorDefecto}
                      className="mr-1.5 align-middle"
                      title={p.activoPorDefecto ? 'Viene activo de fábrica' : 'Se activa en Fase 2'}
                    />
                    {p.etiqueta}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                    {formatearAjuste(p.ajusteCm)}
                  </td>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">
                    {fmt(p.medidaCm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(cuadro.sinModelo || cuadro.montajeBase || cuadro.aproximado) && (
        <div className="border-t px-2 py-1 text-[10px] text-muted-foreground">
          {cuadro.montajeBase && <div>· El perfil base se puede montar dentro o pared a pared.</div>}
          {cuadro.sinModelo && <div>· Sin fila en el catálogo: usa sus propias reglas de taller.</div>}
          {cuadro.aproximado && <div>· Los perfiles se terminan de definir en Fase 2.</div>}
        </div>
      )}
    </div>
  );
}

/** Los números que no son el ajuste de una pieza pero mueven el corte. */
function Constantes({
  draft,
  onEditar,
}: {
  draft: FormulasFamilias;
  onEditar: (campo: string, valor: number) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Constantes compartidas
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        No pertenecen a un cuadro: cada una mueve el corte de todas las cortinas de su sistema.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CONSTANTES_EDITABLES.map((g) => (
          <div key={g.grupo} className="rounded-md border">
            <div className="bg-muted/60 px-2 py-1 text-[11px] font-bold uppercase">{g.grupo}</div>
            <div className="divide-y">
              {g.items.map((c) => {
                const valor = leerCampo(draft, c.campo);
                return (
                  <div key={c.campo} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium">{c.etiqueta}</div>
                      <div className="text-[10px] text-muted-foreground">{c.ayuda}</div>
                    </div>
                    <Input
                      className="h-7 w-20 px-1 text-right text-[11px] tabular-nums"
                      value={valor === null ? '' : String(valor).replace('.', ',')}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(',', '.'));
                        if (Number.isFinite(n)) onEditar(c.campo, n);
                      }}
                      inputMode="decimal"
                    />
                    <span className="w-4 text-[10px] text-muted-foreground">{c.unidad}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
