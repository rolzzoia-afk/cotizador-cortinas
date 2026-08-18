// Admin → Resumen de visita.
//
// Las preguntas que el vendedor le confirma al cliente antes de irse de la
// casa. Vienen las seis del formulario en papel; acá se editan, se ordenan y se
// agregan las propias. Cada respuesta se guarda en la OT por el ID de la
// pregunta, así que retirar una NO borra lo ya contestado en OTs viejas.
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardList, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmar } from '@/components/ui/confirm';
import { useAuth } from '@/lib/auth';
import {
  CHECKLIST_VISITA_DEFAULT,
  idDePregunta,
  moverPregunta,
  normalizarChecklistVisita,
  type ChecklistVisita,
  type PreguntaVisita,
} from '@/modules/visita/checklistVisita';
import {
  guardarChecklistVisita,
  useChecklistVisita,
} from '@/modules/visita/checklistVisitaStore';

function idLibre(base: string, usados: Set<string>): string {
  const raiz = idDePregunta(base) || `pregunta-${Date.now().toString(36)}`;
  if (!usados.has(raiz)) return raiz;
  let n = 2;
  while (usados.has(`${raiz}-${n}`)) n++;
  return `${raiz}-${n}`;
}

export function ChecklistVisitaSection() {
  const { empresaId } = useAuth();
  const { checklist, loading, refresh } = useChecklistVisita();
  const [draft, setDraft] = useState<ChecklistVisita>(CHECKLIST_VISITA_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(checklist);
      setDirty(false);
    }
  }, [loading, checklist]);

  const setPregunta = (id: string, patch: Partial<PreguntaVisita>) => {
    setDraft((d) => ({
      preguntas: d.preguntas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    setDirty(true);
  };

  const agregar = () => {
    setDraft((d) => {
      const usados = new Set(d.preguntas.map((p) => p.id));
      return {
        preguntas: [
          ...d.preguntas,
          {
            id: idLibre('pregunta nueva', usados),
            titulo: 'Pregunta nueva',
            pregunta: '',
            orden: d.preguntas.length + 1,
            activa: true,
          },
        ],
      };
    });
    setDirty(true);
  };

  const eliminar = async (p: PreguntaVisita) => {
    const ok = await confirmar(
      `¿Eliminar «${p.titulo}»? Las respuestas ya guardadas en OTs anteriores no se borran, ` +
        'pero la pregunta deja de aparecer. Si solo quieres dejar de preguntarla, apágala.',
    );
    if (!ok) return;
    setDraft((d) => ({
      preguntas: d.preguntas.filter((x) => x.id !== p.id).map((x, i) => ({ ...x, orden: i + 1 })),
    }));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    const limpio = normalizarChecklistVisita(draft);
    const sinTexto = limpio.preguntas.filter((p) => !p.pregunta.trim());
    if (sinTexto.length > 0) {
      toast.error(`Falta el texto de la pregunta en «${sinTexto[0].titulo}»`);
      return;
    }
    setSaving(true);
    try {
      await guardarChecklistVisita(empresaId, limpio);
      await refresh();
      setDirty(false);
      toast.success('Resumen de visita guardado');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const ordenadas = [...draft.preguntas].sort((a, b) => a.orden - b.orden);

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Resumen de visita</h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Lo que el vendedor confirma con el cliente antes de irse de la casa. Aparece en Fase 2 →
        Visita, con un SÍ/NO por pregunta. Las respuestas se guardan por pregunta: apagar o
        borrar una acá no toca lo ya contestado en OTs anteriores.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-3">
            {ordenadas.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg border p-3',
                  p.activa ? 'border-border' : 'border-dashed border-border/60 opacity-60',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={p.titulo}
                    onChange={(e) => setPregunta(p.id, { titulo: e.target.value })}
                    placeholder="Título corto"
                    className="h-8 max-w-xs"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground" title="Llave con la que se guarda la respuesta">
                    {p.id}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={p.activa ? 'Dejar de preguntarla' : 'Volver a preguntarla'}
                      onClick={() => setPregunta(p.id, { activa: !p.activa })}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide',
                        p.activa
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      {p.activa ? 'Activa' : 'Apagada'}
                    </button>
                    <button
                      type="button"
                      title="Subir"
                      disabled={i === 0}
                      onClick={() => {
                        setDraft((d) => moverPregunta(d, p.id, -1));
                        setDirty(true);
                      }}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Bajar"
                      disabled={i === ordenadas.length - 1}
                      onClick={() => {
                        setDraft((d) => moverPregunta(d, p.id, 1));
                        setDirty(true);
                      }}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => eliminar(p)}
                      className="rounded border border-destructive/30 bg-destructive/10 p-1 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <Label className="text-[11px]">Pregunta</Label>
                <textarea
                  value={p.pregunta}
                  onChange={(e) => setPregunta(p.id, { pregunta: e.target.value })}
                  rows={3}
                  placeholder="¿Se explicó que…?"
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={agregar} variant="secondary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar pregunta
            </Button>
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar resumen'}
            </Button>
            <Button
              onClick={() => {
                setDraft(CHECKLIST_VISITA_DEFAULT);
                setDirty(true);
                toast.info('Cargadas las preguntas de fábrica. Presiona Guardar para aplicarlas.');
              }}
              variant="ghost"
              size="sm"
              disabled={saving}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar las de fábrica
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
