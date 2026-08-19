// Admin → Bloques del informe de visita.
//
// Los textos fijos que cierran el INFORME CLIENTE: corte de rodapié, «la medida
// considera los mecanismos», term panel / aire / rack, límite de perforación y
// el aviso de los sistemas de oscuridad.
//
// Son compromisos comerciales, no redacción: la IA NO los escribe ni los
// parafrasea — la app los pega tal cual como quedan acá. Un bloque puede
// condicionarse a que la orden traiga sistemas de oscuridad, para no llenar de
// letra chica una cotización de puro roller.
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmar } from '@/components/ui/confirm';
import { useAuth } from '@/lib/auth';
import {
  BLOQUES_INFORME_DEFAULT,
  idDeBloque,
  moverBloque,
  normalizarBloquesInforme,
  type BloqueInforme,
  type BloquesInforme,
} from '@/modules/visita/bloquesInforme';
import { guardarBloquesInforme, useBloquesInforme } from '@/modules/visita/bloquesInformeStore';
import { borrarFotoInforme } from '@/modules/visita/informeAssetsStore';
import { FotosInformeEditor, fotosHuerfanas } from './FotosInformeEditor';

/** Todas las fotos de una configuración, para saber cuáles quedaron huérfanas. */
const fotosDe = (c: BloquesInforme): string[] => c.bloques.flatMap((b) => b.fotos ?? []);

function idLibre(base: string, usados: Set<string>): string {
  const raiz = idDeBloque(base) || `bloque-${Date.now().toString(36)}`;
  if (!usados.has(raiz)) return raiz;
  let n = 2;
  while (usados.has(`${raiz}-${n}`)) n++;
  return `${raiz}-${n}`;
}

export function BloquesInformeSection() {
  const { empresaId } = useAuth();
  const { bloques, loading, refresh } = useBloquesInforme();
  const [draft, setDraft] = useState<BloquesInforme>(BLOQUES_INFORME_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(bloques);
      setDirty(false);
    }
  }, [loading, bloques]);

  const setBloque = (id: string, patch: Partial<BloqueInforme>) => {
    setDraft((d) => ({
      bloques: d.bloques.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
    setDirty(true);
  };

  const agregar = () => {
    setDraft((d) => {
      const usados = new Set(d.bloques.map((b) => b.id));
      return {
        bloques: [
          ...d.bloques,
          {
            id: idLibre('bloque nuevo', usados),
            titulo: '',
            texto: '',
            fotos: [],
            orden: d.bloques.length + 1,
            activo: true,
            condicion: 'siempre' as const,
          },
        ],
      };
    });
    setDirty(true);
  };

  const eliminar = async (b: BloqueInforme) => {
    const ok = await confirmar(
      `¿Eliminar este bloque? Dejará de aparecer en los informes nuevos. Si solo quieres ` +
        'sacarlo por ahora, apágalo.',
    );
    if (!ok) return;
    setDraft((d) => ({
      bloques: d.bloques.filter((x) => x.id !== b.id).map((x, i) => ({ ...x, orden: i + 1 })),
    }));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    const sinTexto = draft.bloques.filter((b) => !b.texto.trim());
    if (sinTexto.length > 0) {
      toast.error('Hay un bloque sin texto: escríbelo o elimínalo.');
      return;
    }
    setSaving(true);
    try {
      const limpio = normalizarBloquesInforme(draft);
      await guardarBloquesInforme(empresaId, limpio);
      // Recién ahora se borran del bucket las fotos que se quitaron: si se
      // borraran al quitarlas, salir sin guardar dejaría el informe apuntando a
      // un archivo que ya no existe.
      for (const url of fotosHuerfanas(fotosDe(bloques), fotosDe(limpio))) {
        await borrarFotoInforme(url);
      }
      await refresh();
      setDirty(false);
      toast.success('Bloques del informe guardados');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const ordenados = [...draft.bloques].sort((a, b) => a.orden - b.orden);

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Bloques del informe de visita
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Los textos fijos que van al final del INFORME CLIENTE, después de lo conversado en la
        visita. Se pegan <strong>tal cual</strong> quedan acá: la IA no los reescribe. Marca
        «Solo con sistemas de oscuridad» para que un bloque no aparezca en órdenes de puro roller.
        Las fotos que le cargues bajan debajo de su texto y viajan pegadas al correo cuando la
        vendedora usa <strong>Copiar</strong>.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-3">
            {ordenados.map((b, i) => (
              <div
                key={b.id}
                className={cn(
                  'rounded-lg border p-3',
                  b.activo ? 'border-border' : 'border-dashed border-border/60 opacity-60',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={b.titulo ?? ''}
                    onChange={(e) => setBloque(b.id, { titulo: e.target.value })}
                    placeholder="Encabezado (opcional)"
                    className="h-8 max-w-md"
                  />
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      title={
                        b.condicion === 'oscuridad'
                          ? 'Solo entra si la orden trae sistemas de oscuridad'
                          : 'Entra en todos los informes'
                      }
                      onClick={() =>
                        setBloque(b.id, {
                          condicion: b.condicion === 'oscuridad' ? 'siempre' : 'oscuridad',
                        })
                      }
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide',
                        b.condicion === 'oscuridad'
                          ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      {b.condicion === 'oscuridad' ? 'Solo oscuridad' : 'Siempre'}
                    </button>
                    <button
                      type="button"
                      title={b.activo ? 'Sacarlo de los informes' : 'Volver a incluirlo'}
                      onClick={() => setBloque(b.id, { activo: !b.activo })}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide',
                        b.activo
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      {b.activo ? 'Activo' : 'Apagado'}
                    </button>
                    <button
                      type="button"
                      title="Subir"
                      disabled={i === 0}
                      onClick={() => {
                        setDraft((d) => moverBloque(d, b.id, -1));
                        setDirty(true);
                      }}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Bajar"
                      disabled={i === ordenados.length - 1}
                      onClick={() => {
                        setDraft((d) => moverBloque(d, b.id, 1));
                        setDirty(true);
                      }}
                      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => eliminar(b)}
                      className="rounded border border-destructive/30 bg-destructive/10 p-1 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <Label className="text-[11px]">Texto</Label>
                <textarea
                  value={b.texto}
                  onChange={(e) => setBloque(b.id, { texto: e.target.value })}
                  rows={4}
                  placeholder="El texto que va al informe, tal cual lo lee el cliente."
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                />
                <Label className="mt-2 block text-[11px]">Fotos (van debajo del texto)</Label>
                <FotosInformeEditor
                  fotos={b.fotos ?? []}
                  onChange={(fotos) => setBloque(b.id, { fotos })}
                  grupo={`bloque-${b.id}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={agregar} variant="secondary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar bloque
            </Button>
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar bloques'}
            </Button>
            <Button
              onClick={() => {
                setDraft(BLOQUES_INFORME_DEFAULT);
                setDirty(true);
                toast.info('Cargados los bloques de fábrica. Presiona Guardar para aplicarlos.');
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
