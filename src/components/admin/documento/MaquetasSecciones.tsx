// Maquetas de las secciones del sistema para la vista previa del editor.
//
// ESPEJO VISUAL de CotizadorFase0: cada maqueta repite el markup y las clases
// Tailwind de la sección real, con datos de ejemplo y sin lógica. No se dibuja
// la Fase 1 de verdad porque necesita OT, catálogo y Supabase, y encima hay que
// poder arrastrar bloques ENCIMA de ella.
//
// Que compartan clases es lo que hace que la vista previa sirva: las
// proporciones son las mismas, así que una imagen flotante colocada al 60 % de
// una sección cae en el mismo punto en la cotización impresa. Por eso las
// maquetas usan los MISMOS componentes (`Input`, `Button`, `FilaTotal`) que la
// página: inertes por el `pointer-events-none` de la tarjeta, pero con la caja
// exacta. Y por eso las clases `md:` / `lg:` van tal cual: el lienzo se dibuja
// al ancho REAL de la página (ver LienzoEscalado), así que los breakpoints
// caen donde caen de verdad.
//
// SI CAMBIA EL DISEÑO REAL DE UNA SECCIÓN, ACTUALIZAR LA MAQUETA DE ACÁ.

import type { ReactNode } from 'react';
import { Copy, Palette, Plus, RotateCw, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilaTotal from '@/components/cotizador/FilaTotal';
import { FILAS_TOTALES, NOTA_IVA } from '@/modules/cotizador/filasTotales';
import { calcularTotales } from '@/modules/cotizador/preciosFase0';
import { formatCLP } from '@/modules/cotizador/calculos';
import { FILTROS_CATALOGO } from '@/modules/cotizador/filtrosCatalogo';
import type { TipoSeccionDoc } from '@/modules/cotizador/docCotizacion';

// ── Datos del cliente ── ESPEJO de CotizadorFase0 (sección DATOS DEL CLIENTE)

/** Espejo de `Campo`: rótulo + `Input`. */
function CampoMaqueta({ label, valor, placeholder }: { label: string; valor?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input value={valor ?? ''} placeholder={placeholder} readOnly />
    </label>
  );
}

/** Espejo de `CampoEstado`: desplegable con código de color. */
function CampoEstadoMaqueta({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono?: 'ok' | 'mal';
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={valor}
        onChange={() => {}}
        className={cn(
          'h-9 w-full rounded-md border px-2 text-sm font-semibold focus:outline-none',
          tono === 'ok' && 'border-success bg-success/25 text-success',
          tono === 'mal' && 'border-destructive bg-destructive/25 text-destructive',
          !tono && 'border-border bg-card',
        )}
      >
        <option value={valor} className="bg-card text-foreground">
          {valor}
        </option>
      </select>
    </label>
  );
}

function MaquetaDatosCliente() {
  return (
    <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2 lg:grid-cols-3">
      <CampoMaqueta label="Nombre" valor="María Pérez" />
      <CampoMaqueta label="N° OT (Excel manual)" placeholder="Vacío = automático" />
      <CampoMaqueta label="RUT" valor="12.345.678-9" />
      <CampoMaqueta label="Teléfono" valor="+56 9 1234 5678" />
      <CampoMaqueta label="Mail" valor="cliente@correo.cl" />
      <CampoMaqueta label="Dirección" valor="Av. Siempre Viva 742" />
      <CampoMaqueta label="Comuna" valor="Las Condes" />
      <CampoMaqueta label="Región" valor="Metropolitana" />
      <CampoEstadoMaqueta label="Instalación" valor="Incluye instalación" tono="ok" />
      <CampoEstadoMaqueta label="Envío" valor="Gratis" tono="ok" />
      <CampoEstadoMaqueta label="Tubo E39 (2,2–3,0 m)" valor="Desactivado (tubo E66)" />
    </section>
  );
}

// ── Catálogo ── ESPEJO de CotizadorFase0 (sección CATÁLOGO con chips)

function MaquetaCatalogo() {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Catálogo · elige una categoría y agrega con un clic
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Todos
        </button>
        {FILTROS_CATALOGO.map((f) => (
          <button
            key={f.id}
            className={cn('rounded-md border px-2.5 py-1 text-[11px] font-bold opacity-90', f.cls)}
          >
            {f.label}
          </button>
        ))}
        <button className="rounded-md border border-border p-1 text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
        </button>
        <div className="relative ml-auto w-56">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value="" placeholder="Buscar por nombre, código…" className="h-8 pl-7 text-xs" readOnly />
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nuevo producto
        </Button>
      </div>
      <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
        Selecciona una categoría o escribe en el buscador para ver productos. También puedes seguir
        escribiendo el COD_INT directamente en la grilla de abajo.
      </div>
    </section>
  );
}

// ── Cortinas ── ESPEJO de CotizadorFase0 (GRILLA UNIFICADA)
//
// Las 17 columnas de Fase 1 (`showCols` es de Fase 3, que suma 2 más) con sus
// mismos `min-w-`: son las que fuerzan el `min-w-[1830px]` y el scroll
// horizontal de la sección.

const COLS_CORTINAS: Array<{ label: string; cls: string }> = [
  { label: 'COD', cls: 'min-w-[6rem]' },
  { label: 'CANT', cls: 'min-w-[3.5rem]' },
  { label: 'PRODUCTO', cls: 'min-w-[12rem]' },
  { label: 'COD_INT', cls: 'min-w-[6rem]' },
  { label: 'TIPO', cls: 'min-w-[5rem]' },
  { label: 'DESCRIPCIÓN', cls: 'min-w-[10rem]' },
  { label: 'INVERTIDA', cls: 'min-w-[4.5rem] text-center' },
  { label: 'CATEGORÍA', cls: 'min-w-[5.5rem] text-center' },
  { label: 'UBIC.', cls: 'min-w-[5rem]' },
  { label: 'COLOR ACCESORIOS', cls: 'min-w-[7rem]' },
  { label: 'ANCHO', cls: 'min-w-[5rem] border-l border-border' },
  { label: 'ALTO', cls: 'min-w-[5rem]' },
  { label: 'M²', cls: 'min-w-[4rem] border-l border-border' },
  { label: 'VAL.UNIT.', cls: 'min-w-[7rem]' },
  { label: 'DCT %', cls: 'min-w-[3.5rem]' },
  { label: 'TOTAL', cls: 'min-w-[7rem]' },
];

/** Las 16 columnas + la de los botones de la derecha. */
const COLSPAN_TOTAL = COLS_CORTINAS.length + 1;

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('whitespace-nowrap px-2 py-1.5 align-middle', className)}>{children}</td>;
}

/** Espejo de `CellInput`: la celda editable de la grilla. */
function CeldaInput({ valor, className }: { valor?: string; className?: string }) {
  return (
    <Input
      value={valor ?? ''}
      readOnly
      className={cn('h-7 rounded-md border-border bg-card px-2 py-0 text-xs', className)}
    />
  );
}

const FILAS_EJEMPLO = [
  {
    cod: 'BLACKOUT_D',
    cant: '1',
    producto: 'ROLLER BLACKOUT DELUX',
    codInt: 'BK 18',
    tipo: 'DELUX',
    desc: 'CS 0303 IVORY',
    ubic: 'PPAL.1',
    color: 'BLANCO',
    ancho: '2.2',
    alto: '2.5',
    m2: '5.50',
    valorUnit: '$137.296',
    dct: '30',
    total: '$96.107',
  },
  {
    cod: 'SCREEN_P',
    cant: '1',
    producto: 'ROLLER SCREEN - TRASLUCIDO',
    codInt: 'TR 02',
    tipo: 'PREMIUM',
    desc: 'GRIS TRASLUCIDA',
    ubic: 'TERRAZA',
    color: 'GRIS',
    ancho: '1.5',
    alto: '1.85',
    m2: '2.78',
    valorUnit: '$135.221',
    dct: '30',
    total: '$94.654',
  },
];

function MaquetaCortinas() {
  return (
    <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
      <table className="w-full min-w-[1830px] border-collapse text-xs">
        <thead className="bg-card text-[12px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th colSpan={10} className="px-2 py-1.5 text-center font-semibold">
              Información del producto
            </th>
            <th colSpan={2} className="border-l border-border px-2 py-1.5 text-center font-semibold">
              Medidas
            </th>
            <th colSpan={4} className="border-l border-border px-2 py-1.5 text-center font-semibold">
              Precio
            </th>
            <th></th>
          </tr>
          <tr className="border-b border-border">
            {COLS_CORTINAS.map((c) => (
              <Th key={c.label} className={c.cls}>
                {c.label}
              </Th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {FILAS_EJEMPLO.map((f) => (
            <tr key={f.codInt} className="border-t border-border align-middle">
              <Td className="text-muted-foreground">{f.cod}</Td>
              <Td>
                <CeldaInput valor={f.cant} className="w-14 text-right" />
              </Td>
              <Td className="text-muted-foreground">{f.producto}</Td>
              <Td>
                <CeldaInput valor={f.codInt} className="w-24" />
              </Td>
              <Td className="text-muted-foreground">{f.tipo}</Td>
              <Td className="text-muted-foreground">{f.desc}</Td>
              <Td className="text-center">
                <button className="rounded-md border border-border p-1.5 text-muted-foreground opacity-60">
                  <RotateCw className="h-4 w-4" />
                </button>
              </Td>
              <Td className="text-center">
                <button className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                  A
                </button>
              </Td>
              <Td>
                <CeldaInput valor={f.ubic} className="w-20" />
              </Td>
              <Td>
                <CeldaInput valor={f.color} className="w-24" />
              </Td>
              <Td className="border-l border-border">
                <CeldaInput valor={f.ancho} className="w-20 text-right" />
              </Td>
              <Td>
                <CeldaInput valor={f.alto} className="w-20 text-right" />
              </Td>
              <Td className="border-l border-border text-right text-muted-foreground">{f.m2}</Td>
              <Td className="text-right">
                <span className="underline decoration-dotted underline-offset-2">{f.valorUnit}</span>
              </Td>
              <Td>
                <CeldaInput valor={f.dct} className="w-14 text-right" />
              </Td>
              <Td className="text-right font-semibold">{f.total}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-0.5">
                  <span className="rounded p-1 text-muted-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </span>
                  <span className="rounded p-1 text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Td>
            </tr>
          ))}
          {/* Agregar cortina + categoría de todas */}
          <tr>
            <td colSpan={COLSPAN_TOTAL} className="border-t border-border bg-card/40 px-2 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Agregar cortina
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Categoría de todas:</span>
                  <button className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                    A
                  </button>
                  <button className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-400">
                    B
                  </button>
                  <button className="rounded-md border border-border px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
                    Según tela
                  </button>
                </div>
              </div>
            </td>
          </tr>
          {/* Divisor ADICIONALES */}
          <tr>
            <td
              colSpan={COLSPAN_TOTAL}
              className="border-y-2 border-border bg-card/80 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-foreground"
            >
              Adicionales (instalaciones extras, cenefas, motores, controles, traslados…)
            </td>
          </tr>
          <tr>
            <td colSpan={COLSPAN_TOTAL} className="px-3 py-3 text-center text-xs text-muted-foreground">
              Sin adicionales. Filtra el catálogo arriba para agregar con un clic, o usa el botón de
              abajo.
            </td>
          </tr>
          <tr>
            <td colSpan={COLSPAN_TOTAL} className="border-t border-border bg-card/40 px-2 py-2">
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Agregar adicional
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ── Totales ── ESPEJO de CotizadorFase0 (sección TOTALES)
//
// Las filas salen del MISMO descriptor que la página (`FILAS_TOTALES`) y los
// montos del MISMO `calcularTotales`: si mañana cambia una fila, cambia en los
// dos lados sola.

const TOTALES_EJEMPLO = calcularTotales(760_646);

function MaquetaTotales() {
  return (
    <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
      {FILAS_TOTALES.map((f) => (
        <div key={f.id}>
          {f.separadorAntes && <div className="my-1 border-t border-border" />}
          <FilaTotal label={f.label} valor={formatCLP(f.valor(TOTALES_EJEMPLO))} fuerte={f.fuerte} />
        </div>
      ))}
      <p className="pt-1 text-center text-[11px] text-muted-foreground">{NOTA_IVA}</p>
      <div className="my-1 border-t border-border" />
      <Button className="w-full gap-1.5">Guardar como OT</Button>
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
