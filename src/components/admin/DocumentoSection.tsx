// Admin → Documento de cotización: editor con vista previa de cómo queda la
// Fase 1 / Fase 3 completa.
//
// La vista previa NO es una maqueta suelta: los bloques de contenido usan el
// mismo `BloqueDocRender` que el documento real, con términos y parámetros
// vivos. Las secciones del sistema (cliente, catálogo, cortinas, totales) sí se
// dibujan como maquetas, porque su contenido depende de la cotización.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LayoutTemplate, Plus, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useTerminos } from '@/modules/cotizador/terminosStore';
import {
  FLOTANTE_INICIAL,
  LABEL_TIPO,
  LAYOUT_DEFAULT,
  bloqueNuevo,
  bloquesEnFlujo,
  bloquesJuntoATotales,
  esSeccion,
  flotantesDe,
  moverBloqueA,
  type BloqueDoc,
  type LayoutDoc,
  type TipoContenidoDoc,
  type TipoSeccionDoc,
} from '@/modules/cotizador/docCotizacion';
import { guardarLayoutDoc, useLayoutDoc } from '@/modules/cotizador/docCotizacionStore';
import BloqueDocRender from '@/components/cotizador/BloquesDocumento';
import BloqueEditable from './documento/BloqueEditable';
import ImagenFlotante from './documento/ImagenFlotante';
import LienzoEscalado from './documento/LienzoEscalado';
import PanelBloque from './documento/PanelBloque';
import TarjetaSeccion from './documento/TarjetaSeccion';

/** Los bloques que el admin puede AGREGAR (términos y cuotas ya vienen). */
const AGREGABLES: TipoContenidoDoc[] = ['texto', 'imagen', 'carrusel'];

const fmtPct = (n: number) => (n * 100).toFixed(1).replace('.', ',').replace(/,0$/, '');

export function DocumentoSection() {
  const { empresaId } = useAuth();
  const { layout, loading, refresh } = useLayoutDoc();
  const { terminos } = useTerminos();
  const { parametros } = useParametrosCotizador();
  const [draft, setDraft] = useState<LayoutDoc>(LAYOUT_DEFAULT);
  const [sel, setSel] = useState<string | null>(null);
  // Se arrastra por ID y no por índice: las imágenes flotantes no ocupan lugar
  // en la lista, así que los índices del render no son los del array.
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(layout);
      setDirty(false);
    }
  }, [loading, layout]);

  const bloqueSel = useMemo(() => draft.bloques.find((b) => b.id === sel) ?? null, [draft, sel]);

  const setBloque = (id: string, patch: Partial<BloqueDoc>) => {
    setDraft((d) => ({ bloques: d.bloques.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    setDirty(true);
  };

  const agregar = (tipo: TipoContenidoDoc) => {
    const b = bloqueNuevo(tipo, Date.now().toString(36));
    setDraft((d) => ({ bloques: [...d.bloques, b] }));
    setSel(b.id);
    setDirty(true);
  };

  const eliminar = (id: string) => {
    setDraft((d) => ({ bloques: d.bloques.filter((b) => b.id !== id) }));
    if (sel === id) setSel(null);
    setDirty(true);
  };

  /** Soltar sobre un bloque (se inserta antes) o en el vacío del final. */
  const soltarEn = (antesDeId?: string) => {
    if (!dragId) return;
    setDraft((d) => ({ bloques: moverBloqueA(d.bloques, dragId, antesDeId) }));
    setDragId(null);
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      await guardarLayoutDoc(empresaId, draft);
      await refresh();
      setDirty(false);
      toast.success('Documento guardado. Fase 1 y Fase 3 ya lo muestran así.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  // Vista previa con datos de ejemplo: una cotización que incluya de todo.
  const datosBloques = useMemo(
    () => ({
      terminos,
      categorias: [...new Set(terminos.grupos.flatMap((g) => g.categorias ?? []))],
      telas: [...new Set(terminos.grupos.flatMap((g) => g.telas ?? []))],
      parametros,
      fmtPct,
    }),
    [terminos, parametros],
  );

  const bloquesTotales = useMemo(() => bloquesJuntoATotales(draft.bloques), [draft]);

  /** Las flotantes ancladas a una sección, arrastrables sobre su maqueta. */
  const flotantesDeSeccion = (tipo: TipoSeccionDoc) =>
    flotantesDe(draft.bloques, tipo).map((b) => (
      <ImagenFlotante
        key={b.id}
        bloque={b}
        seleccionada={sel === b.id}
        onSeleccionar={() => setSel(b.id)}
        onMover={(pos) => setBloque(b.id, { flotante: pos })}
      />
    ));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <LayoutTemplate className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Documento de cotización (Fase 1 / Fase 3)
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Arrastra la manija de cualquier cuadro para reordenar la página —incluidas las secciones del
        sistema—, tira del borde derecho para cambiar su ancho y agrega cuadros de texto o imágenes
        donde quieras. Una imagen puede volverse <strong>flotante</strong> desde el panel de la
        derecha: entonces se arrastra libre por encima de la sección que elijas.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        La vista previa es una <strong>réplica a escala</strong> de la página: se dibuja al ancho que
        tiene la Fase 1 en este monitor y se achica entera, así que lo que coloques acá cae en el
        mismo punto al entrar a la cotización.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        // `minmax(0,1fr)` + `min-w-0`: sin eso, el track de la vista previa no
        // puede achicarse por debajo del ancho natural del lienzo (que se dibuja
        // al ancho REAL de la página) y el panel de la derecha terminaba pintado
        // FUERA del borde del card.
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          {/* Vista previa: el documento completo, en orden, dibujado al ancho
              real de la Fase 1 en este monitor y achicado con `scale`. */}
          <LienzoEscalado
            className="rounded-lg border bg-background"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              soltarEn();
            }}
          >
            {bloquesEnFlujo(draft.bloques).map((b) =>
              esSeccion(b.tipo) ? (
                // Las flotantes envuelven la FILA completa, igual que
                // `SeccionDocumento` en la cotización real: en la de totales el
                // ancla incluye los bloques de la izquierda (los términos), no
                // solo la tarjeta de precios.
                <SeccionEditable key={b.id} flotantes={flotantesDeSeccion(b.tipo)}>
                  <FilaSeccion
                    // Los bloques "junto a los totales" se dibujan a la izquierda
                    // de esa tarjeta, igual que en el documento real.
                    izquierda={b.tipo === 'totales' ? bloquesTotales : []}
                    render={(bl) => (
                      <BloqueEditable
                        bloque={bl}
                        seleccionado={sel === bl.id}
                        arrastrando={dragId === bl.id}
                        onSeleccionar={() => setSel(bl.id)}
                        onChange={(patch) => setBloque(bl.id, patch)}
                        onEliminar={() => eliminar(bl.id)}
                        onDragStart={() => setDragId(bl.id)}
                        onDropEn={() => soltarEn(bl.id)}
                      >
                        <BloqueDocRender bloque={bl} datos={datosBloques} conPlaceholder />
                      </BloqueEditable>
                    )}
                  >
                    <TarjetaSeccion
                      tipo={b.tipo}
                      seleccionada={sel === b.id}
                      arrastrando={dragId === b.id}
                      onSeleccionar={() => setSel(b.id)}
                      onDragStart={() => setDragId(b.id)}
                      onDropEn={() => soltarEn(b.id)}
                    />
                  </FilaSeccion>
                </SeccionEditable>
              ) : (
                <BloqueEditable
                  key={b.id}
                  bloque={b}
                  seleccionado={sel === b.id}
                  arrastrando={dragId === b.id}
                  onSeleccionar={() => setSel(b.id)}
                  onChange={(patch) => setBloque(b.id, patch)}
                  onEliminar={() => eliminar(b.id)}
                  onDragStart={() => setDragId(b.id)}
                  onDropEn={() => soltarEn(b.id)}
                >
                  <BloqueDocRender bloque={b} datos={datosBloques} conPlaceholder />
                </BloqueEditable>
              ),
            )}
          </LienzoEscalado>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Agregar bloque
              </div>
              <div className="flex flex-wrap gap-1">
                {AGREGABLES.map((t) => (
                  <Button key={t} variant="secondary" size="sm" onClick={() => agregar(t)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {LABEL_TIPO[t]}
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Entra al final; arrástralo a su lugar.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                {bloqueSel ? LABEL_TIPO[bloqueSel.tipo] : 'Propiedades'}
              </div>
              <PanelBloque
                bloque={bloqueSel}
                empresaId={empresaId}
                onChange={(patch) => bloqueSel && setBloque(bloqueSel.id, patch)}
                flotanteInicial={FLOTANTE_INICIAL}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Guardando…' : 'Guardar documento'}
        </Button>
        <Button
          onClick={() => {
            setDraft(LAYOUT_DEFAULT);
            setSel(null);
            setDirty(true);
            toast.info('Cargado el diseño por defecto. Presiona Guardar para aplicarlo.');
          }}
          variant="ghost"
          size="sm"
          disabled={saving}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restaurar diseño original
        </Button>
      </div>
    </section>
  );
}

/**
 * El envoltorio de una sección en la vista previa: ESPEJO de `SeccionDocumento`
 * del documento real. Importa que sea el mismo box, porque las imágenes
 * flotantes se posicionan en % de él — si acá el ancla fuera más chica (antes
 * era solo la tarjeta de totales, sin los términos de al lado), la imagen caía
 * en otro punto al abrir la Fase 1.
 */
function SeccionEditable({ flotantes, children }: { flotantes: ReactNode[]; children: ReactNode }) {
  return (
    <div className={flotantes.length ? 'relative' : undefined}>
      {children}
      {flotantes}
    </div>
  );
}

/**
 * Una sección de la vista previa. Si tiene bloques a la izquierda (los "junto a
 * los totales"), se dibujan en fila con ella; si no, la sección va sola y ocupa
 * todo el ancho, como en el documento.
 */
function FilaSeccion({
  izquierda,
  render,
  children,
}: {
  izquierda: BloqueDoc[];
  render: (b: BloqueDoc) => ReactNode;
  children: ReactNode;
}) {
  if (!izquierda.length) return <>{children}</>;
  // Mismo reparto que la fila real de totales en la cotización: la maqueta de
  // totales ya trae su `ml-auto max-w-sm`, así que el lado derecho no lleva
  // ancho forzado.
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="min-w-0 flex-1">{izquierda.map((b) => render(b))}</div>
      {children}
    </div>
  );
}
