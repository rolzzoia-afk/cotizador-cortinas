// Admin → Pasos de luz del informe de visita.
//
// La apertura del INFORME CLIENTE: la advertencia de pasos de luz según el tipo
// de cortina que lleva la orden, con su foto referencial. Es lo primero que lee
// el cliente y lo que evita el reclamo después de instalar («me dijeron que era
// blackout»), así que —como los bloques del final— se pega tal cual queda acá:
// la IA no lo reescribe.
//
// La lista es FIJA (una por familia, más la nota de varios paños): no se agregan
// ni se borran, porque cada una la elige el motor según lo que la orden trae.
import { useEffect, useState } from 'react';
import { Sun, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import {
  CUANDO_INTRO,
  INTROS_INFORME_DEFAULT,
  NOMBRE_INTRO,
  normalizarIntrosInforme,
  type IdIntro,
  type IntroInforme,
  type IntrosInforme,
} from '@/modules/visita/introsInforme';
import { guardarIntrosInforme, useIntrosInforme } from '@/modules/visita/introsInformeStore';
import { borrarFotoInforme } from '@/modules/visita/informeAssetsStore';
import { FotosInformeEditor, fotosHuerfanas } from './FotosInformeEditor';

const fotosDe = (c: IntrosInforme): string[] => c.intros.flatMap((i) => i.fotos);

export function IntrosInformeSection() {
  const { empresaId } = useAuth();
  const { intros, loading, refresh } = useIntrosInforme();
  const [draft, setDraft] = useState<IntrosInforme>(INTROS_INFORME_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(intros);
      setDirty(false);
    }
  }, [loading, intros]);

  const setIntro = (id: IdIntro, patch: Partial<IntroInforme>) => {
    setDraft((d) => ({
      intros: d.intros.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    const sinTexto = draft.intros.filter((i) => i.activo && !i.texto.trim());
    if (sinTexto.length > 0) {
      toast.error(
        `«${NOMBRE_INTRO[sinTexto[0].id]}» está activa pero sin texto: escríbela o apágala.`,
      );
      return;
    }
    setSaving(true);
    try {
      const limpio = normalizarIntrosInforme(draft);
      await guardarIntrosInforme(empresaId, limpio);
      // Las fotos quitadas se borran del bucket recién ahora (ver FotosInformeEditor).
      for (const url of fotosHuerfanas(fotosDe(intros), fotosDe(limpio))) {
        await borrarFotoInforme(url);
      }
      await refresh();
      setDirty(false);
      toast.success('Pasos de luz guardados');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Sun className="h-5 w-5 text-warning" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Pasos de luz del informe de visita
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Con lo que abre el INFORME CLIENTE. Solo entran las que la orden{' '}
        <strong>efectivamente trae</strong>: una cotización de puro roller no le explica al cliente
        cómo se comporta una vertical. Las fotos van debajo de su texto —como el «te dejo una foto
        referencial» del correo— y viajan pegadas cuando la vendedora usa <strong>Copiar</strong>.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-3">
            {draft.intros.map((i) => (
              <div
                key={i.id}
                className={cn(
                  'rounded-lg border p-3',
                  i.activo ? 'border-border' : 'border-dashed border-border/60 opacity-60',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {NOMBRE_INTRO[i.id]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{CUANDO_INTRO[i.id]}</span>
                  <button
                    type="button"
                    title={i.activo ? 'Sacarla de los informes' : 'Volver a incluirla'}
                    onClick={() => setIntro(i.id, { activo: !i.activo })}
                    className={cn(
                      'ml-auto rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide',
                      i.activo
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {i.activo ? 'Activa' : 'Apagada'}
                  </button>
                </div>
                <Label className="text-[11px]">Texto</Label>
                <textarea
                  value={i.texto}
                  onChange={(e) => setIntro(i.id, { texto: e.target.value })}
                  rows={3}
                  placeholder="Lo que se le explica al cliente sobre los pasos de luz de este tipo de cortina."
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                />
                <Label className="mt-2 block text-[11px]">Fotos referenciales</Label>
                <FotosInformeEditor
                  fotos={i.fotos}
                  onChange={(fotos) => setIntro(i.id, { fotos })}
                  grupo={`intro-${i.id}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar pasos de luz'}
            </Button>
            <Button
              onClick={() => {
                setDraft(INTROS_INFORME_DEFAULT);
                setDirty(true);
                toast.info('Cargados los textos de fábrica (sin fotos). Presiona Guardar.');
              }}
              variant="ghost"
              size="sm"
              disabled={saving}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar los de fábrica
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
