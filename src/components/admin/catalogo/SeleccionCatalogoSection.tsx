// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Tuberías y mecanismos (editable)
//
// Qué tubo y qué mecanismo elige la app sola, y con qué criterio. Lo que se
// guarda acá va a `configuracion.reglas_seleccion` y viaja al cotizador por
// parámetro: no hay copia intermedia, esta pantalla nunca muestra algo
// distinto de lo que hace el motor.
//
// El validador corre en vivo: un MEC o un tubo que ninguna regla puede
// resolver es un ERROR y bloquea el guardado — antes eso fallaba en silencio
// (la regla se ignoraba y decidía la siguiente).
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, Info, RotateCcw, Save, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  REGLAS_SELECCION_DEFAULT,
  sonReglasDefault,
  validarReglasSeleccion,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import {
  cargarRespaldosReglas,
  guardarReglasSeleccion,
  respaldarReglasSeleccion,
  useReglasSeleccion,
  type RespaldoReglas,
} from '@/modules/descuentos/reglasSeleccionStore';
import { SeleccionTuberias } from './SeleccionTuberias';
import { SeleccionMecanismos } from './SeleccionMecanismos';
import { SeleccionCadenas } from './SeleccionCadenas';
import { ColoresAccesorioSection } from './ColoresAccesorioSection';

export function SeleccionCatalogoSection() {
  const { empresaId } = useAuth();
  const confirmar = useConfirm();
  const { reglas, loading, refresh } = useReglasSeleccion();

  const [draft, setDraft] = useState<ReglasSeleccion>(REGLAS_SELECCION_DEFAULT);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [respaldos, setRespaldos] = useState<RespaldoReglas[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(reglas);
      setDirty(false);
    }
  }, [loading, reglas]);

  useEffect(() => {
    if (empresaId) cargarRespaldosReglas(empresaId).then(setRespaldos);
  }, [empresaId, reglas]);

  const { errores, avisos } = useMemo(() => validarReglasSeleccion(draft), [draft]);

  const editar = (patch: Partial<ReglasSeleccion>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId || errores.length > 0) return;
    if (avisos.length > 0) {
      const ok = await confirmar({
        titulo: 'Hay avisos en las reglas',
        mensaje: `${avisos.join('\n')}\n\n¿Guardar igual?`,
        confirmLabel: 'Guardar igual',
      });
      if (!ok) return;
    }
    setGuardando(true);
    try {
      await respaldarReglasSeleccion(empresaId, reglas, 'antes de editar las reglas');
      await guardarReglasSeleccion(empresaId, draft);
      await refresh();
      setDirty(false);
      toast.success('Reglas guardadas. Las OTs que se abran ahora usan estos tubos y kits.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Sliders className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Selección de tubería y mecanismo
          </h2>
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
                setDraft(REGLAS_SELECCION_DEFAULT);
                setDirty(true);
                toast.info('Cargadas las reglas de fábrica. Presiona Guardar para aplicarlas.');
              }}
              disabled={guardando}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Valores de fábrica
            </Button>
            <Button
              size="sm"
              onClick={onGuardar}
              disabled={guardando || !empresaId || !dirty || errores.length > 0}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {guardando ? 'Guardando…' : 'Guardar reglas'}
            </Button>
          </div>
        </header>

        <p className="text-xs text-muted-foreground">
          El orden de decisión es: regla de la categoría → regla por ancho → color de accesorios. Un
          tubo o un kit que se marque <strong>oculto</strong> deja de ofrecerse en Fase 2, pero las
          OTs que ya lo tienen guardado lo siguen mostrando y calculando: por eso es la forma segura
          de retirar algo, en vez de borrarlo.
        </p>

        {!sonReglasDefault(draft) && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
            Estas reglas están <strong>modificadas</strong> respecto de las de fábrica.
          </p>
        )}

        {errores.length > 0 && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Hay que corregir esto antes de guardar
            </div>
            <ul className="ml-4 list-disc space-y-0.5">
              {errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
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
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <ColoresAccesorioSection
        valor={draft.colores}
        mecanismos={draft.mecanismo}
        onChange={(colores, mecanismo) =>
          editar(mecanismo ? { colores, mecanismo } : { colores })
        }
      />
      <SeleccionTuberias valor={draft.tuberia} onChange={(t) => editar({ tuberia: t })} />
      <SeleccionMecanismos
        valor={draft.mecanismo}
        onChange={(m) => editar({ mecanismo: m })}
        paleta={draft.colores}
      />
      <SeleccionCadenas
        valor={draft.cadenas}
        onChange={(c) => editar({ cadenas: c })}
        paleta={draft.colores}
      />

      <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respaldos de las reglas</DialogTitle>
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
                    {new Date(r.fecha).toLocaleString('es-CL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div className="text-muted-foreground">{r.motivo}</div>
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
