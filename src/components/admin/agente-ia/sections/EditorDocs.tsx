// Editor de los 8 documentos de la base de conocimiento del agente.
// Cada doc tiene una categoría, contenido markdown y versión. Guardar
// incrementa la versión.

import { useEffect, useMemo, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AGENTE_CATEGORIAS,
  useAgenteDocs,
  type AgenteCategoria,
} from '@/modules/admin/agente-hooks';

export default function EditorDocs() {
  const { docs, loading, error, guardarDoc } = useAgenteDocs();
  const [categoria, setCategoria] = useState<AgenteCategoria>('catalogo');
  const [draft, setDraft] = useState('');
  const [guardando, setGuardando] = useState(false);

  const docActual = useMemo(
    () => docs.find((d) => d.categoria === categoria) ?? null,
    [docs, categoria],
  );
  const meta = AGENTE_CATEGORIAS.find((c) => c.id === categoria);

  useEffect(() => {
    setDraft(docActual?.contenido_md ?? '');
  }, [docActual]);

  const dirty = draft !== (docActual?.contenido_md ?? '');

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarDoc(categoria, draft);
      toast.success(`Doc "${meta?.label}" guardado (versión incrementada)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo guardar: ' + msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescartar = () => {
    setDraft(docActual?.contenido_md ?? '');
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Base de conocimiento
        </h3>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {AGENTE_CATEGORIAS.map((c) => {
          const doc = docs.find((d) => d.categoria === c.id);
          const tieneContenido = (doc?.contenido_md.length ?? 0) > 100;
          return (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition',
                categoria === c.id
                  ? 'border-accent bg-accent/10 text-accent dark:text-accent'
                  : 'border-border hover:bg-muted',
              )}
            >
              {c.label}
              {!tieneContenido && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning"
                  title="Doc poco desarrollado"
                />
              )}
            </button>
          );
        })}
      </div>

      {meta && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <p className="text-muted-foreground">{meta.descripcion}</p>
          {docActual && (
            <div className="flex items-center gap-2 whitespace-nowrap text-[0.65rem] text-muted-foreground">
              <Badge variant="outline" className="text-[0.65rem]">
                v{docActual.version}
              </Badge>
              <span>{new Date(docActual.updated_at).toLocaleString('es-CL')}</span>
            </div>
          )}
        </div>
      )}

      {loading && !docActual ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          Cargando documentos…
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={20}
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          placeholder="Markdown del documento…"
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] text-muted-foreground">
          {draft.length} caracteres · {draft.split('\n').length} líneas
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDescartar}
            disabled={!dirty || guardando}
            variant="outline"
            size="sm"
          >
            Descartar cambios
          </Button>
          <Button onClick={handleGuardar} disabled={!dirty || guardando} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {guardando ? 'Guardando…' : 'Guardar versión'}
          </Button>
        </div>
      </div>
    </div>
  );
}
