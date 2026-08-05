// Maquetas de las secciones del sistema para la vista previa del editor.
//
// ESPEJO VISUAL de CotizadorFase0: cada maqueta repite el markup y las clases
// Tailwind de la sección real, con datos de ejemplo y sin lógica. No se dibuja
// la Fase 1 de verdad porque necesita OT, catálogo y Supabase, y encima hay que
// poder arrastrar bloques ENCIMA de ella.
//
// Que compartan clases es lo que hace que la vista previa sirva: las
// proporciones son las mismas, así que una imagen flotante colocada al 60 % de
// una sección cae en el mismo punto en la cotización impresa.
//
// SI CAMBIA EL DISEÑO REAL DE UNA SECCIÓN, ACTUALIZAR LA MAQUETA DE ACÁ.

import { Palette, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILTROS_CATALOGO } from '@/modules/cotizador/filtrosCatalogo';
import type { TipoSeccionDoc } from '@/modules/cotizador/docCotizacion';

/** Campo del bloque de cliente: mismo alto y tipografía que `Campo` + `Input`. */
function CampoMaqueta({ label, valor, tono }: { label: string; valor?: string; tono?: 'ok' }) {
  return (
    <div className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          'flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm',
          tono === 'ok' && 'border-success/40 bg-success/10 font-semibold text-success',
          !valor && 'text-muted-foreground',
        )}
      >
        {valor || '—'}
      </div>
    </div>
  );
}

function MaquetaDatosCliente() {
  return (
    // Sin `lg:` — los breakpoints miden el VIEWPORT, no esta vista previa, que
    // es bastante más angosta que la página real.
    <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 sm:grid-cols-2">
      <CampoMaqueta label="Nombre" valor="María Pérez" />
      <CampoMaqueta label="N° OT (Excel manual)" />
      <CampoMaqueta label="RUT" valor="12.345.678-9" />
      <CampoMaqueta label="Teléfono" valor="+56 9 1234 5678" />
      <CampoMaqueta label="Mail" valor="cliente@correo.cl" />
      <CampoMaqueta label="Dirección" valor="Av. Siempre Viva 742" />
      <CampoMaqueta label="Comuna" valor="Las Condes" />
      <CampoMaqueta label="Región" valor="Metropolitana" />
      <CampoMaqueta label="Instalación" valor="Incluye instalación" tono="ok" />
      <CampoMaqueta label="Envío" valor="Gratis" tono="ok" />
      <CampoMaqueta label="Tubo E78 (2,2–3,0 m)" valor="Desactivado (tubo E66)" tono="ok" />
    </section>
  );
}

function MaquetaCatalogo() {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Catálogo · elige una categoría y agrega con un clic
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
          Todos
        </span>
        {FILTROS_CATALOGO.map((f) => (
          <span
            key={f.id}
            className={cn('rounded-md border px-2.5 py-1 text-[11px] font-bold opacity-90', f.cls)}
          >
            {f.label}
          </span>
        ))}
        <span className="rounded-md border border-border p-1 text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
        </span>
        <div className="relative ml-auto w-56 max-w-full">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <div className="flex h-8 items-center rounded-md border border-input bg-background pl-7 text-xs text-muted-foreground">
            Buscar por nombre, código…
          </div>
        </div>
        <span className="flex h-8 items-center gap-1 rounded-md border border-input px-3 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nuevo producto
        </span>
      </div>
      <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
        Selecciona una categoría o escribe en el buscador para ver productos. También puedes seguir
        escribiendo el COD_INT directamente en la grilla de abajo.
      </div>
    </section>
  );
}

const COLS_CORTINAS = [
  'COD', 'CANT', 'PRODUCTO', 'COD_INT', 'TIPO', 'DESCRIPCIÓN',
  'UBIC.', 'ANCHO', 'ALTO', 'VAL.UNIT.', 'DCT %', 'TOTAL',
];

const FILAS_EJEMPLO = [
  ['BLACKOUT_D', '1', 'ROLLER BLACKOUT DELUX', 'BK 18', 'DELUX', 'CS 0303 IVORY', 'PPAL.1', '2,20', '2,50', '$137.296', '30', '$96.107'],
  ['SCREEN_P', '1', 'ROLLER SCREEN - TRASLUCIDO', 'TR 02', 'PREMIUM', 'GRIS TRASLUCIDA', 'TERRAZA', '1,50', '1,85', '$135.221', '30', '$94.654'],
];

function MaquetaCortinas() {
  return (
    // `overflow-x-auto` como en la grilla real de Fase 1: la tabla no cabe
    // entera en la vista previa y debe scrollear, no empujar el layout.
    <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
      <table className="w-full min-w-[46rem] text-xs">
        <thead className="bg-card/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th colSpan={7} className="px-2 py-1.5 text-center font-semibold">
              Información del producto
            </th>
            <th colSpan={2} className="border-l border-border px-2 py-1.5 text-center font-semibold">
              Medidas
            </th>
            <th colSpan={3} className="border-l border-border px-2 py-1.5 text-center font-semibold">
              Precio
            </th>
          </tr>
          <tr className="border-b border-border">
            {COLS_CORTINAS.map((c) => (
              <th key={c} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FILAS_EJEMPLO.map((fila, i) => (
            <tr key={i} className="border-t border-border align-middle">
              {fila.map((celda, j) => (
                <td key={j} className="whitespace-nowrap px-2 py-1.5 align-middle">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border">
            <td colSpan={COLS_CORTINAS.length} className="px-2 py-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs">
                <Plus className="h-3 w-3" /> Agregar cortina
              </span>
            </td>
          </tr>
          <tr className="border-t border-border bg-card/60">
            <td
              colSpan={COLS_CORTINAS.length}
              className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Adicionales (instalaciones extras, cenefas, motores, controles, traslados…)
            </td>
          </tr>
          <tr className="border-t border-border">
            <td colSpan={COLS_CORTINAS.length} className="px-2 py-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs">
                <Plus className="h-3 w-3" /> Agregar adicional
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function FilaTotalMaqueta({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn('flex justify-between', fuerte && 'font-bold')}>
      <span className={cn(!fuerte && 'text-muted-foreground')}>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

function MaquetaTotales() {
  return (
    <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
      <FilaTotalMaqueta label="Subtotal neto" valor="$760.646" />
      <FilaTotalMaqueta label="IVA 19%" valor="$144.523" />
      <FilaTotalMaqueta label="Total transferencia" valor="$905.169" fuerte />
      <div className="my-1 border-t border-border" />
      <FilaTotalMaqueta label="Total tarjeta crédito" valor="$1.030.082" />
      <FilaTotalMaqueta label="Abono 50% (inicio)" valor="$452.585" />
      <div className="my-1 border-t border-border" />
      <div className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
        Guardar como OT
      </div>
    </section>
  );
}

/** La maqueta de una sección del sistema. */
export default function MaquetaSeccion({ tipo }: { tipo: TipoSeccionDoc }) {
  switch (tipo) {
    case 'datos_cliente':
      return <MaquetaDatosCliente />;
    case 'catalogo':
      return <MaquetaCatalogo />;
    case 'cortinas':
      return <MaquetaCortinas />;
    case 'totales':
      return <MaquetaTotales />;
    default:
      return null;
  }
}
