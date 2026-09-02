// Cerrar el corte de tela: decir qué quedó y dejarlo anotado.
//
// Es el paso que faltaba. Hasta ahora el cortador bajaba el paño, cortaba, y
// lo que sobraba se apoyaba en el rack sin que nadie escribiera nada: ni si
// servía, ni dónde quedó, ni cuánta tela se perdió.
//
// Acá, de una sola pasada: la app propone para qué sirve cada trozo (por sus
// medidas), el cortador lo corrige si la tela tiene una falla o un dibujo que
// las medidas no ven, escribe dónde lo va a dejar, y al confirmar se guarda
// todo —sobrantes a la colmena, mermas al registro de pérdidas, el sello de
// «tela cortada» en cada OT— y sale la etiqueta para pegarle al rollo.
//
// Con la colmena de paños apagada este corte NO descuenta nada: solo registra
// lo que salió. El descuento clásico sigue viviendo en Fase 4.

import { useState } from 'react';
import { CheckCircle2, Loader2, Printer, Scissors, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { supabase } from '@/lib/supabase';
import type { GrupoRollo } from '@/modules/cotizador/planCorte';
import type { ParametrosCorte } from '@/modules/cotizador/parametros';
import {
  filasColmenaDeCorte,
  filasMermasDeCorte,
  metrosPrimerCorte,
  prefijoSerial,
  rotuloOrigen,
  salidasDeRollo,
  serialSobrante,
  stampCorteProduccion,
  type FilaSobranteEditada,
  type OrigenCorte,
  type SalidaCorte,
} from '@/modules/produccion/salidasCorte';
import {
  funcionalDeMarca,
  htmlEtiquetasSobrante,
  marcaDeFuncional,
  type EtiquetaSobrante,
  type MarcaFuncional,
} from '@/modules/telas/etiquetaSobrante';

/** Una salida con lo que el operario decidió encima. */
type FilaEditable = {
  salida: SalidaCorte;
  marca: MarcaFuncional;
  ubicacion: string;
  serial: string;
};

const OPCIONES: { v: MarcaFuncional; t: string }[] = [
  { v: 'vertical', t: 'VERTICAL' },
  { v: 'roller', t: 'ROLLER' },
  { v: 'ambas', t: 'AMBAS' },
  { v: 'nada', t: 'No sirve' },
];

const textoError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Abre la ventana de impresión con las etiquetas ya dibujadas. */
function imprimir(etiquetas: EtiquetaSobrante[]): void {
  if (etiquetas.length === 0) return;
  const w = window.open('', '_blank', 'width=860,height=680');
  if (!w) {
    toast.error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes.');
    return;
  }
  w.document.open();
  w.document.write(htmlEtiquetasSobrante(etiquetas));
  w.document.close();
}

export default function ConfirmarCorteDialog({
  grupos,
  params,
  origen,
  otIds,
  empresaId,
  onConfirmado,
  onClose,
}: {
  /** Los rollos TAL COMO quedaron en pantalla (con las inversiones decididas). */
  grupos: GrupoRollo[];
  params: ParametrosCorte;
  origen: OrigenCorte;
  /** Las OTs que este corte deja con la tela cortada. */
  otIds: string[];
  empresaId: string;
  onConfirmado: () => void;
  onClose: () => void;
}) {
  // Lo que se va a guardar se congela al ABRIR: el operario revisa una lista y
  // confirma ESA, no una que se recalculó por debajo mientras la miraba.
  const [salidas] = useState<SalidaCorte[]>(() =>
    grupos.flatMap((g) => salidasDeRollo(g, params)),
  );

  // La fecha, igual: un corte empezado a las 23:59 repartiría seriales de dos
  // días distintos si cada uno tomara la hora al confirmarse.
  const [abiertoEn] = useState(() => new Date().toISOString());

  const [filas, setFilas] = useState<FilaEditable[]>(() =>
    salidas
      .filter((s) => s.clase === 'sobrante')
      .map((s, i) => ({
        salida: s,
        marca: marcaDeFuncional(s.funcional),
        ubicacion: '',
        serial: serialSobrante(origen, i + 1, abiertoEn),
      })),
  );
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<EtiquetaSobrante[] | null>(null);

  const rotulo = rotuloOrigen(origen);

  // Lo que el operario desmarcó deja de ser sobrante: se anota como merma.
  const aGuardar = filas.filter((f) => f.marca !== 'nada');
  const descartadas = filas.filter((f) => f.marca === 'nada');
  const mermas: SalidaCorte[] = [
    ...salidas.filter((s) => s.clase === 'merma'),
    ...descartadas.map((f) => ({ ...f.salida, clase: 'merma' as const })),
  ];

  const setFila = (i: number, patch: Partial<FilaEditable>) =>
    setFilas((prev) => prev.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  const etiquetasDe = (listas: FilaEditable[]): EtiquetaSobrante[] =>
    listas.map((f) => ({
      codigo: f.salida.codInt,
      funcional: funcionalDeMarca(f.marca),
      anchoCm: f.salida.ancho,
      altoCm: f.salida.alto,
      origen: rotulo,
      otsDelLote: origen.tipo === 'lote' ? origen.ots.map((o) => o.numero) : undefined,
      fechaISO: abiertoEn,
      ubicacion: f.ubicacion.trim().toUpperCase(),
      serial: f.serial,
    }));

  const confirmar = async () => {
    const sinUbicacion = aGuardar.find((f) => !f.ubicacion.trim());
    if (sinUbicacion) {
      toast.error(
        `Falta la ubicación del sobrante ${sinUbicacion.salida.codInt} ` +
          `${sinUbicacion.salida.ancho}×${sinUbicacion.salida.alto}cm. ` +
          'Sin ubicación el paño se pierde en el rack.',
      );
      return;
    }
    setGuardando(true);
    try {
      // ── 1. Que ninguna de estas OTs tenga ya la tela cortada ──────────
      // Se relee de la BD: el plan pudo haberse generado hace rato y otra
      // persona pudo cortar una de estas OTs por su cuenta mientras tanto.
      const { data: filasOT, error: errOT } = await supabase
        .from('ots')
        .select('id, numero_ot, datos_generales')
        .in('id', otIds);
      if (errOT) throw errOT;

      if (!filasOT || filasOT.length === 0) {
        // Sin OTs no hay a qué atribuir el corte ni dónde dejar el sello: si
        // se guardaran los sobrantes igual, quedarían huérfanos y la tela
        // seguiría figurando sin cortar.
        toast.error('No se encontraron las OTs de este plan. Volvé a generarlo antes de cerrar.');
        setGuardando(false);
        return;
      }

      const yaCortadas = filasOT.filter(
        (o) => (o.datos_generales as { corteGeneralColmena?: unknown } | null)?.corteGeneralColmena,
      );
      if (yaCortadas.length > 0) {
        toast.error(
          `Ya tienen la tela cortada: ${yaCortadas.map((o) => `OT ${o.numero_ot}`).join(', ')}. ` +
            'Sacalas del lote y volvé a armar el plan.',
        );
        setGuardando(false);
        return;
      }

      // ── 2. ¿Este mismo corte se registró antes? ───────────────────────
      // Red de seguridad por si la confirmación anterior murió entre los
      // inserts y el sello. El filtro sobre jsonb puede no estar disponible;
      // si falla, se sigue: el guard de arriba es el que manda.
      const prefijo = prefijoSerial(origen, abiertoEn);
      try {
        const { data: repetidos } = await supabase
          .from('colmena_panos')
          .select('id')
          .eq('empresa_id', empresaId)
          .like('datos_extra->>serial', `${prefijo}%`)
          .limit(1);
        if (repetidos && repetidos.length > 0) {
          toast.error(
            `Ya hay sobrantes registrados con el serial ${prefijo}… de hoy. ` +
              'Revisá la Colmena antes de volver a guardar.',
          );
          setGuardando(false);
          return;
        }
      } catch {
        // Sin pre-chequeo: no es motivo para bloquear el cierre del corte.
      }

      // ── 3. Sobrantes y mermas ─────────────────────────────────────────
      const editadas: FilaSobranteEditada[] = aGuardar.map((f) => ({
        ...f.salida,
        funcional: funcionalDeMarca(f.marca),
        clase: 'sobrante',
        ubicacion: f.ubicacion,
        serial: f.serial,
      }));

      const problemas: string[] = [];
      if (editadas.length > 0) {
        const { error } = await supabase
          .from('colmena_panos')
          .insert(filasColmenaDeCorte(editadas, empresaId, origen, abiertoEn));
        if (error) problemas.push(`sobrantes: ${error.message}`);
      }
      if (mermas.length > 0) {
        const { error } = await supabase
          .from('telas_mermas')
          .insert(filasMermasDeCorte(mermas, empresaId, origen, abiertoEn));
        if (error) problemas.push(`mermas: ${error.message}`);
      }

      // ── 4. El sello, SIEMPRE ──────────────────────────────────────────
      // Aunque algo de arriba haya fallado: sin sello, un reintento duplicaría
      // lo que sí se guardó. Los fallos se avisan para arreglarlos a mano.
      const stamp = stampCorteProduccion(
        origen,
        abiertoEn,
        editadas.map((e) => e.serial),
        mermas.length,
      );
      const sellos = await Promise.all(
        filasOT.map(async (o) => {
          const dg = (o.datos_generales || {}) as Record<string, unknown>;
          const { error } = await supabase
            .from('ots')
            .update({ datos_generales: { ...dg, corteGeneralColmena: stamp } })
            .eq('id', o.id);
          return error ? `OT ${o.numero_ot}` : null;
        }),
      );
      const sinSello = sellos.filter((s): s is string => s !== null);
      if (sinSello.length > 0) problemas.push(`sin marcar: ${sinSello.join(', ')}`);

      // ── 5. Las etiquetas ──────────────────────────────────────────────
      const etiquetas = etiquetasDe(aGuardar);
      setListo(etiquetas);
      imprimir(etiquetas);

      if (problemas.length > 0) {
        toast.error(`Corte cerrado con problemas — ${problemas.join(' · ')}`);
      } else {
        toast.success(
          `Corte de ${rotulo} cerrado: ${editadas.length} sobrante(s) a la colmena` +
            (mermas.length ? `, ${mermas.length} merma(s)` : '') +
            '.',
        );
      }
      onConfirmado();
    } catch (e) {
      toast.error('No se pudo cerrar el corte: ' + textoError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-w-2xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Cerrar el corte · {rotulo}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
          {/* Qué se bajó del rollo: el primer corte de cada tela. */}
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Primer corte
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {grupos.map((g, i) => (
                <span key={i}>
                  <strong className="font-mono">{g.codInt}</strong> ·{' '}
                  {metrosPrimerCorte(g.altoCorte)}
                </span>
              ))}
            </div>
          </div>

          {listo ? (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-success">
              <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
              Corte guardado. Si la impresión no salió, volvé a mandarla desde el botón de abajo.
            </div>
          ) : (
            <>
              {filas.length === 0 && mermas.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Este corte no deja trozos aprovechables ni merma que anotar. Al confirmar solo se
                  marca la tela como cortada.
                </div>
              )}

              {filas.map((f, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm">
                      <strong className="font-mono">{f.salida.codInt}</strong>{' '}
                      <span className="text-muted-foreground">
                        {f.salida.ancho} × {f.salida.alto} cm ·{' '}
                        {f.salida.detalle === 'franja_rollo' ? 'tira del costado' : 'faja de abajo'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{f.serial}</span>
                  </div>

                  <div className="mt-2">
                    <Label className="text-[11px] text-muted-foreground">Funcional para</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {OPCIONES.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setFila(i, { marca: o.v })}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-[0.72rem] font-semibold transition',
                            f.marca === o.v
                              ? o.v === 'nada'
                                ? 'border-destructive bg-destructive/15 text-destructive'
                                : 'border-accent bg-accent/15 text-accent'
                              : 'border-border text-muted-foreground hover:border-accent/50',
                          )}
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {f.marca === 'nada' ? (
                    <div className="mt-2 text-[11px] text-destructive">
                      Se anota como merma: no entra a la colmena ni lleva etiqueta.
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Label className="text-[11px] text-muted-foreground">
                        Dónde queda (va en la etiqueta)
                      </Label>
                      <Input
                        value={f.ubicacion}
                        onChange={(e) => setFila(i, { ubicacion: e.target.value.toUpperCase() })}
                        placeholder="A-54"
                        className="mt-1 h-8 max-w-[200px] text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}

              {mermas.length > 0 && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Merma: {mermas.length} trozo{mermas.length === 1 ? '' : 's'} que no alcanza
                    {mermas.length === 1 ? '' : 'n'} para nada
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-warning/90">
                    {mermas.map((m, i) => (
                      <span key={i} className="font-mono">
                        {m.codInt} {m.ancho}×{m.alto}cm
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Queda registrado a nombre de {rotulo} para saber cuánta tela se está perdiendo.
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                Al confirmar se marca la tela como cortada en{' '}
                <strong className="text-foreground">
                  {otIds.length} {otIds.length === 1 ? 'OT' : 'OTs'}
                </strong>{' '}
                y no se podrá volver a cerrar este corte.
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {listo ? (
            <>
              <Button variant="secondary" onClick={() => imprimir(listo)} disabled={listo.length === 0}>
                <Printer className="mr-1.5 h-4 w-4" />
                Reimprimir etiquetas
              </Button>
              <Button onClick={onClose}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={guardando}>
                {guardando ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Confirmar e imprimir
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
