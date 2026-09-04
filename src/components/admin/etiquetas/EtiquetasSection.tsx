// Admin → Etiquetas: el diseño de cada etiqueta que imprime la app, editable.
//
// Hasta ahora agrandar una letra, correr un cuadro o cambiar el logo de una
// etiqueta pedía tocar el código. Acá el dueño mueve las cosas sobre el papel,
// lo prueba en la impresora y lo guarda; lo guardado manda en todas las
// impresiones siguientes, y «Volver al diseño original» deshace todo.
//
// Los DATOS los sigue poniendo la app: acá se edita el plano, no el contenido.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, RotateCcw, Save, Tags, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { useAuth } from '@/lib/auth';
import { imprimirHtml } from '@/lib/imprimirHtml';
import { LOGO_ROLZZO } from '@/modules/cotizador/logoRolzzo';
import { htmlDeEtiquetas } from '@/modules/etiquetas/etiquetaHtml';
import {
  muestraDeSlots,
  type ElementoEtiqueta,
  type EtiquetaId,
  type PlantillaEtiqueta,
} from '@/modules/etiquetas/plantilla';
import { etiquetasPorGrupo } from '@/modules/etiquetas/registro';
import {
  cargarPlantilla,
  guardarPlantilla,
  restaurarPlantilla,
} from '@/modules/etiquetas/plantillasStore';
import LienzoEtiqueta from './LienzoEtiqueta';
import PanelElemento from './PanelElemento';
import { ZOOM_MAX, ZOOM_MIN } from './LienzoMm';

/** Lo que se puede agregar de cero: el resto son elementos de la etiqueta. */
const AGREGABLES = [
  { tipo: 'texto' as const, label: 'Texto' },
  { tipo: 'caja' as const, label: 'Recuadro' },
  { tipo: 'linea' as const, label: 'Línea' },
  { tipo: 'imagen' as const, label: 'Imagen' },
];

function elementoNuevo(tipo: (typeof AGREGABLES)[number]['tipo']): ElementoEtiqueta {
  const id = `x-${Date.now().toString(36)}`;
  const base = { id, visible: true, x: 4, y: 4 };
  switch (tipo) {
    case 'caja':
      return { ...base, tipo: 'caja', ancho: 20, alto: 10, trazoPt: 0.5 };
    case 'linea':
      return { ...base, tipo: 'linea', ancho: 20, alto: 0, orientacion: 'h', trazoPt: 0.5 };
    case 'imagen':
      return { ...base, tipo: 'imagen', ancho: 15, alto: 10 };
    default:
      return {
        ...base,
        tipo: 'texto',
        ancho: 25,
        alto: 5,
        texto: 'TEXTO',
        estilo: { pt: 9, bold: false, align: 'izquierda', color: 'negro' },
      };
  }
}

export function EtiquetasSection() {
  const { empresaId, perfil } = useAuth();
  const grupos = useMemo(() => etiquetasPorGrupo(), []);
  const primera = grupos[0]?.etiquetas[0]?.id ?? 'catalogo';
  const [id, setId] = useState<EtiquetaId>(primera);
  const def = useMemo(
    () => grupos.flatMap((g) => g.etiquetas).find((d) => d.id === id) ?? grupos[0]?.etiquetas[0],
    [grupos, id],
  );

  const [draft, setDraft] = useState<PlantillaEtiqueta | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Al cambiar de etiqueta se trae la guardada (o la de fábrica si no hay).
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setSel(null);
    const traer = async () => {
      if (!def) return;
      const p = empresaId ? await cargarPlantilla(empresaId, def.id) : def.plantillaDefault;
      if (!vivo) return;
      setDraft(p);
      setDirty(false);
      setCargando(false);
    };
    traer();
    return () => {
      vivo = false;
    };
  }, [empresaId, def]);

  if (!def) return null;

  const muestra = muestraDeSlots(def);
  const elegido = draft?.elementos.find((e) => e.id === sel) ?? null;

  const patch = (idEl: string, cambio: Partial<ElementoEtiqueta>) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            elementos: d.elementos.map((e) =>
              e.id === idEl ? ({ ...e, ...cambio } as ElementoEtiqueta) : e,
            ),
          }
        : d,
    );
    setDirty(true);
  };

  const agregar = (tipo: (typeof AGREGABLES)[number]['tipo']) => {
    const nuevo = elementoNuevo(tipo);
    setDraft((d) => (d ? { ...d, elementos: [...d.elementos, nuevo] } : d));
    setSel(nuevo.id);
    setDirty(true);
  };

  const eliminar = (idEl: string) => {
    setDraft((d) => (d ? { ...d, elementos: d.elementos.filter((e) => e.id !== idEl) } : d));
    setSel(null);
    setDirty(true);
  };

  const guardar = async () => {
    if (!empresaId || !draft) return;
    setGuardando(true);
    try {
      await guardarPlantilla(empresaId, def.id, draft, perfil?.nombre ?? 'admin');
      setDirty(false);
      toast.success(`Etiqueta «${def.label}» guardada. Se imprime así de ahora en adelante.`);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = async () => {
    if (!empresaId) return;
    const sigue = await confirmar({
      titulo: 'Volver al diseño original',
      mensaje: `La etiqueta «${def.label}» vuelve a como venía de fábrica. Lo que hay ahora queda guardado como respaldo.`,
      confirmLabel: 'Volver al original',
    });
    if (!sigue) return;
    setGuardando(true);
    try {
      await restaurarPlantilla(empresaId, def.id, perfil?.nombre ?? 'admin');
      setDraft(def.plantillaDefault);
      setDirty(false);
      toast.success('Listo: la etiqueta volvió al diseño original.');
    } catch (e) {
      toast.error('No se pudo restaurar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  /** Prueba con los datos de ejemplo y el diseño de la pantalla, sin guardar. */
  const imprimirPrueba = () => {
    if (!draft) return;
    imprimirHtml(
      htmlDeEtiquetas(draft, [muestra], {
        titulo: `Prueba · ${def.label}`,
        logo: LOGO_ROLZZO,
      }),
    );
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Tags className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Etiquetas</h2>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={id}
          onChange={(e) => setId(e.target.value as EtiquetaId)}
        >
          {grupos.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.etiquetas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="text-[0.7rem] text-muted-foreground">
          papel de {draft?.hoja.ancho ?? def.plantillaDefault.hoja.ancho} ×{' '}
          {draft?.hoja.alto ?? def.plantillaDefault.hoja.alto} mm
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25))}
            title="Achicar la vista"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-[0.7rem] tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25))}
            title="Agrandar la vista"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={imprimirPrueba}>
            <Printer className="mr-1 h-3.5 w-3.5" />
            Imprimir prueba
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={restaurar} disabled={guardando}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Volver al original
          </Button>
          <Button size="sm" className="h-8" onClick={guardar} disabled={!dirty || guardando}>
            <Save className="mr-1 h-3.5 w-3.5" />
            Guardar
          </Button>
        </div>
      </header>

      {def.ayuda && <p className="text-[0.7rem] text-muted-foreground">{def.ayuda}</p>}

      {cargando || !draft ? (
        <p className="text-xs text-muted-foreground">Cargando el diseño…</p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <LienzoEtiqueta
              plantilla={draft}
              datos={muestra}
              zoom={zoom}
              logo={LOGO_ROLZZO}
              seleccion={sel}
              onSeleccionar={setSel}
              onMover={(idEl, caja) => patch(idEl, caja)}
            />
            <p className="max-w-[24rem] text-[0.65rem] text-muted-foreground">
              Los datos que se ven son de ejemplo: al imprimir de verdad los pone la app. Arrastra
              para mover y tira de la esquina para agrandar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AGREGABLES.map((a) => (
                <Button
                  key={a.tipo}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[0.7rem]"
                  onClick={() => agregar(a.tipo)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-w-[16rem] flex-1 space-y-3">
            <div className="rounded-lg border border-border p-3">
              <PanelElemento
                elemento={elegido}
                def={def}
                empresaId={empresaId}
                onChange={(cambio) => elegido && patch(elegido.id, cambio)}
                onEliminar={() => elegido && eliminar(elegido.id)}
              />
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="mb-1.5 text-[0.7rem] font-semibold">Todo lo que lleva la etiqueta</p>
              <ul className="space-y-0.5">
                {draft.elementos.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[0.7rem] ${
                        sel === e.id ? 'bg-primary/15 text-primary' : 'hover:bg-muted'
                      } ${e.visible ? '' : 'line-through opacity-60'}`}
                      onClick={() => setSel(e.id)}
                    >
                      {e.tipo === 'campo'
                        ? (def.slots[e.slot]?.label ?? e.slot)
                        : e.tipo === 'texto'
                          ? `«${e.texto.split('\n')[0]}»`
                          : e.id.startsWith('x-')
                            ? `${e.tipo} (agregado)`
                            : e.tipo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
