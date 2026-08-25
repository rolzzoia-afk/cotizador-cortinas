// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → cómo se arma el precio de una cortina
//
// Es la hoja "Cotizador" del Excel hecha pantalla: precios de insumo, lista de
// materiales por familia y tela de referencia. Lo que se guarda acá va a
// `configuracion.reglas_precios` y viaja al cotizador por parámetro, así que
// esta pantalla nunca muestra algo distinto de lo que cobra la app.
//
// Dueña del borrador: las secciones de abajo son controladas y no guardan nada
// por su cuenta. Un error de validación bloquea el guardado.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Coins, History, Info, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { InputDecimal } from '@/components/ui/input-decimal';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { esCortinaTipo } from '@/modules/cotizador/flujoCatalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import {
  REGLAS_PRECIOS_DEFAULT,
  recetasDeSistema,
  sonReglasPreciosDefault,
  validarReglasPrecios,
  type ReglasPrecios,
} from '@/modules/cotizador/reglasPrecios';
import {
  cargarRespaldosPrecios,
  guardarReglasPrecios,
  respaldarReglasPrecios,
  useReglasPrecios,
  type RespaldoPrecios,
} from '@/modules/cotizador/reglasPreciosStore';
import { ProbadorCotizacionSection } from './ProbadorCotizacionSection';
import { InsumosPreciosSection } from './InsumosPreciosSection';
import { RecetasFamiliasSection } from './RecetasFamiliasSection';
import { SistemasPreciosSection } from './SistemasPreciosSection';
import { TelasArquetiposSection } from './TelasArquetiposSection';

/** Las pestañas de Admin → Precios. Las tres primeras son de esta sección. */
export type TabPrecios = 'probador' | 'insumos' | 'recetas' | 'telas' | 'comercial';

export function ReglasPreciosSection({ tab = 'probador' }: { tab?: TabPrecios } = {}) {
  const { empresaId, user } = useAuth();
  const confirmar = useConfirm();
  const { reglas, loading, refresh } = useReglasPrecios();
  const { parametros } = useParametrosCotizador();
  const { catalogo } = useCatalogoProductos();

  const [draft, setDraft] = useState<ReglasPrecios>(REGLAS_PRECIOS_DEFAULT);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [respaldos, setRespaldos] = useState<RespaldoPrecios[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);

  // Carga lo guardado en el borrador, pero NUNCA encima de lo que se está
  // editando: `useReglasPrecios` recarga sola en cada `focus` de la ventana, y
  // sin esta guarda un alt-tab al Excel descartaba los cambios en silencio (el
  // campo «volvía» al valor guardado sin que nadie tocara nada).
  useEffect(() => {
    if (loading || dirty) return;
    setDraft(reglas);
  }, [loading, reglas, dirty]);

  useEffect(() => {
    if (empresaId) cargarRespaldosPrecios(empresaId).then(setRespaldos);
  }, [empresaId, reglas]);

  const { errores, avisos } = useMemo(() => validarReglasPrecios(draft), [draft]);
  const usados = useMemo(() => {
    const s = new Set<string>();
    for (const lineas of Object.values(draft.recetas)) for (const l of lineas) s.add(l.insumo);
    return s;
  }, [draft.recetas]);
  /** Las familias que de verdad existen en el catálogo de la empresa. */
  const familiasCatalogo = useMemo(() => {
    const s = new Set<string>();
    for (const p of Object.values(catalogo)) {
      const cod = (p?.cod || '').trim();
      if (cod && esCortinaTipo(p?.tipo)) s.add(cod);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogo]);

  // Cambiar de pestaña o cerrar con el borrador sucio se llevaba todo sin
  // preguntar. El navegador solo deja avisar, no impedir.
  useEffect(() => {
    if (!dirty) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [dirty]);

  const editar = (patch: Partial<ReglasPrecios>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  /** Suma un insumo a la receta de una familia, venga de la lista que venga. */
  const agregarAReceta = (cod: string, familia: string) =>
    setDraft((d) => {
      setDirty(true);
      return {
        ...d,
        recetas: {
          ...d.recetas,
          [familia]: [
            ...(d.recetas[familia] ?? []),
            { insumo: cod, precio: 'venta', cantidad: { tipo: 'porCortina' } },
          ],
        },
      };
    });

  const onGuardar = async () => {
    if (!empresaId || errores.length > 0) return;
    const ok = await confirmar({
      titulo: '¿Guardar los precios?',
      mensaje:
        'Las cotizaciones que se hagan a partir de ahora usan estos valores, y las que se vuelvan a abrir se recalculan.' +
        (avisos.length ? `\n\nAvisos:\n${avisos.join('\n')}` : ''),
      confirmLabel: 'Guardar',
    });
    if (!ok) return;
    setGuardando(true);
    try {
      await respaldarReglasPrecios(
        empresaId,
        reglas,
        'antes de editar los precios',
        user?.email ?? undefined,
      );
      await guardarReglasPrecios(empresaId, draft);
      await refresh();
      setDirty(false);
      toast.success('Precios guardados. Las cotizaciones nuevas ya los usan.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  // Las pestañas que edita ESTA sección. En las otras se queda montada (para no
  // perder el borrador) pero solo deja el aviso de que hay cambios pendientes.
  const miTab = tab === 'probador' || tab === 'insumos' || tab === 'recetas';
  if (!miTab) {
    return dirty ? (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Tienes cambios sin guardar en los precios. Vuelve a <strong>Insumos</strong> o{' '}
          <strong>Recetas y sistemas</strong> para guardarlos.
        </span>
      </div>
    ) : null;
  }

  return (
    <>
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Coins className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold text-muted-foreground">Cómo se arma el precio</h2>
          {dirty && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.7rem]">
              Cambios sin guardar
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(reglas);
                  setDirty(false);
                  toast.info('Se descartaron los cambios: quedó lo último guardado.');
                }}
                disabled={guardando}
              >
                Descartar cambios
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setVerRespaldos(true)} disabled={!respaldos.length}>
              <History className="mr-1 h-3.5 w-3.5" />
              Respaldos ({respaldos.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(REGLAS_PRECIOS_DEFAULT);
                setDirty(true);
                toast.info('Cargados los precios de fábrica. Presiona Guardar para aplicarlos.');
              }}
              disabled={guardando}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Valores de fábrica
            </Button>
            <Button size="sm" onClick={onGuardar} disabled={guardando || !empresaId || !dirty || errores.length > 0}>
              <Save className="mr-1 h-3.5 w-3.5" />
              {guardando ? 'Guardando…' : 'Guardar precios'}
            </Button>
          </div>
        </header>

        <p className="text-xs text-muted-foreground">
          Una cortina no se cobra por su tela: se junta a las de su misma familia, se suma la tela
          optimizada por paños, los materiales, la mano de obra y el traslado, y ese total se reparte
          entre los metros cuadrados de todas. De ahí sale el <strong>valor del m²</strong>, y cada
          cortina paga sus metros cuadrados a ese valor más la instalación. Por eso agregar o quitar
          una cortina cambia el precio de las otras de su familia; marcarla B o invertirla, no: su
          valor del m² se calcula como si toda la familia fuera igual que ella.
        </p>

        {!sonReglasPreciosDefault(draft) && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
            Estos precios están <strong>modificados</strong> respecto de los de fábrica. Cuidado: si
            más adelante se corrige una receta en el sistema, la corrección no llega sola a las
            familias que estén editadas acá.
          </p>
        )}

        {errores.length > 0 && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Hay que corregir esto antes de guardar
            </div>
            <ul className="ml-4 list-disc space-y-0.5">
              {errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {avisos.length > 0 && (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <Info className="h-3.5 w-3.5" />
              Revisa esto (se puede guardar igual)
            </div>
            <ul className="ml-4 list-disc space-y-0.5">
              {avisos.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Regalo por familia</span>
            <InputDecimal
              value={draft.regalo}
              onChange={(regalo) => editar({ regalo })}
              className="h-8 w-32 text-xs"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Ancho de rollo de respaldo (m)</span>
            <InputDecimal
              value={draft.anchoRolloFallbackM}
              onChange={(anchoRolloFallbackM) => editar({ anchoRolloFallbackM })}
              className="h-8 w-32 text-xs"
            />
          </label>
        </div>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-[0.7rem] text-muted-foreground">
          <li>
            <strong>Regalo por familia:</strong> se suma UNA vez a cada familia (no por cortina) y
            entra al costo antes de repartirlo entre los metros cuadrados, así que se diluye en el
            valor del m². Hoy está en {draft.regalo === 0 ? 'cero, o sea no se cobra nada' : 'un valor distinto de cero'}.
          </li>
          <li>
            <strong>Ancho de rollo de respaldo:</strong> se usa solo si la tela no tiene ancho de
            rollo cargado en ninguna parte. Si aparece seguido en el probador, conviene revisar el
            catálogo de telas. Ojo: el optimizador de corte tiene su propio ancho por defecto
            ({parametros.anchoRolloDefaultM} m) y son cosas distintas — este de acá replica el del
            Excel de precios.
          </li>
          <li>
            <strong>La tela extra por cortina</strong> ({parametros.extraAltoCm} cm) también mueve
            todos los precios y se edita en el tab <em>Optimizador de tela → Parámetros de corte</em>,
            no acá: es el mismo número con el que el taller corta.
          </li>
        </ul>
      </section>

      {tab === 'probador' && (
        <ProbadorCotizacionSection reglas={draft} hayErrores={errores.length > 0} />
      )}

      {tab === 'recetas' && (
        <SistemasPreciosSection
          valor={draft.sistemas}
          familiasCatalogo={familiasCatalogo}
          onChange={(sistemas) => editar({ sistemas })}
        />
      )}

      {tab === 'insumos' && (
        <>
          <InsumosPreciosSection
            valor={draft.insumos}
            margenInsumo={parametros.margenInsumo}
            usados={usados}
            recetas={draft.recetas}
            onChange={(insumos) => editar({ insumos })}
            onUsarEnFamilia={agregarAReceta}
          />

          {Object.entries(draft.sistemas).map(([clave, s]) => (
            <InsumosPreciosSection
              key={clave}
              valor={s.insumos}
              margenInsumo={s.margenInsumo}
              usados={usados}
              recetas={draft.recetas}
              sistema={{
                clave,
                nombre: s.nombre,
                // La categoría B y la invertida cotizan con sus recetas con sufijo
                // (`|B`, `|INV`): ahí es donde el menú «usar en…» tiene que poder
                // meter un insumo.
                familias: recetasDeSistema(clave, s, draft.recetas),
              }}
              precioEnGeneral={(cod) => draft.insumos[cod]?.valorMaximo}
              onChange={(insumos) =>
                editar({ sistemas: { ...draft.sistemas, [clave]: { ...s, insumos } } })
              }
              onUsarEnFamilia={agregarAReceta}
            />
          ))}
        </>
      )}

      {tab === 'recetas' && (
        <RecetasFamiliasSection
          recetas={draft.recetas}
          insumos={draft.insumos}
          margenInsumo={parametros.margenInsumo}
          sistemas={draft.sistemas}
          pasoLamaM={draft.telaVertical.pasoLamaM}
          familiasCatalogo={familiasCatalogo}
          onChange={(recetas) => editar({ recetas })}
        />
      )}

      {/* Va con las recetas: es la otra mitad de «con qué se cotiza una
          familia» (los materiales y la tela de referencia). */}
      {tab === 'recetas' && (
        <TelasArquetiposSection
          arquetipos={draft.arquetipos}
          baseVertical={draft.baseVertical}
          telaVertical={draft.telaVertical}
          catalogo={catalogo}
          onChange={editar}
        />
      )}

      <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respaldos de los precios</DialogTitle>
            <DialogDescription>
              Cada vez que se guarda queda una foto de cómo estaban antes. Al restaurar una, se carga
              en pantalla: todavía hay que presionar Guardar para aplicarla.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {respaldos.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2 text-xs">
                <div>
                  <div className="font-medium">
                    {new Date(r.fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div className="text-muted-foreground">
                    {r.motivo}
                    {r.autor ? ` · ${r.autor}` : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(r.reglas);
                    setDirty(true);
                    setVerRespaldos(false);
                    toast.info('Respaldo cargado. Presiona Guardar para aplicarlo.');
                  }}
                >
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
