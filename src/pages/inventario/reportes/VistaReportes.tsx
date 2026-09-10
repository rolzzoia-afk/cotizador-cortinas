// Reportes del inventario (lámina «Reportes»).
//
// Cuánto vale lo que hay, en qué se va, qué no se mueve y qué se pierde.
//
// El número grande es SOLO lo que tiene costo en la base. Hoy eso son los
// insumos —y ni siquiera todos—: `telas_catalogo` y la colmena de tubos no
// tienen columna de costo, así que su valor no se puede calcular. La pantalla
// lo dice al lado del total en vez de rellenar con ceros: un total que se lee
// como «el inventario vale esto» y no lo es sirve para tomar malas decisiones.

import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ChipSelect } from '@/components/inventario/ChipsFiltro';
import {
  consumoMensual,
  loQueNoSeMueve,
  mermaMensual,
  millones,
  pesos,
  promedioMensual,
  valorizar,
} from '@/modules/inventario/reportes';
import { useReportes } from '@/modules/inventario/reportesStore';
import { BarrasHorizontales, BarrasMensuales } from './GraficosReportes';

const RANGOS = [
  { id: 12, texto: 'Últimos 12 meses' },
  { id: 6, texto: 'Últimos 6 meses' },
  { id: 3, texto: 'Últimos 3 meses' },
];

/** Cuántos artículos quietos se listan antes de resumir. */
const TOPE_QUIETOS = 8;

function descargarCsv(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function VistaReportes() {
  const [meses, setMeses] = useState(12);
  const { articulos, salidas, mermas, ultimaSalida, costos, fueraDeValorizacion, loading, error } =
    useReportes(meses);

  const hoy = useMemo(() => new Date().toISOString(), []);
  const valor = useMemo(() => valorizar(articulos), [articulos]);
  const consumo = useMemo(
    () => consumoMensual(salidas, costos, hoy, meses),
    [salidas, costos, hoy, meses],
  );
  const merma = useMemo(() => mermaMensual(mermas, hoy, meses), [mermas, hoy, meses]);
  const quietos = useMemo(
    () => loQueNoSeMueve(articulos, ultimaSalida, hoy),
    [articulos, ultimaSalida, hoy],
  );

  const exportar = () => {
    const cab = ['Grupo', 'Valor'];
    const filas = valor.grupos.map((g) => `"${g.nombre}";${g.valor}`);
    descargarCsv(
      '﻿' + [cab.join(';'), ...filas].join('\r\n'),
      `valorizacion-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success('Valorización exportada.');
  };

  if (error) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader miga="Inventario" titulo="Reportes" />
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        miga="Inventario"
        titulo="Reportes"
        hint="Cuánto vale lo que hay, en qué se va, qué no se mueve y qué se pierde"
        acciones={
          <>
            <ChipSelect
              valor={meses === 12 ? '' : String(meses)}
              onChange={(v) => setMeses(Number(v) || 12)}
              etiqueta="Rango de fechas"
            >
              {RANGOS.map((r) => (
                <option key={r.id} value={r.id === 12 ? '' : String(r.id)}>
                  {r.texto}
                </option>
              ))}
            </ChipSelect>
            <Button variant="outline" onClick={exportar}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Valorización */}
          <div className="grid gap-6 rounded-lg border border-border bg-card p-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div>
              <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Valor del inventario
              </div>
              <div className="mt-1.5 font-serif text-[2.5rem] font-medium leading-none tracking-[-0.02em]">
                {pesos(valor.total)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                al {new Date().toLocaleDateString('es-CL')} · saldo × costo unitario
              </div>

              <div className="mt-4 rounded-lg border border-warning/35 bg-warning/[0.09] px-3 py-2.5 text-xs leading-relaxed">
                <b className="font-medium">Esto es solo lo que tiene costo cargado.</b> Quedan
                fuera {fueraDeValorizacion.telas.toLocaleString('es-CL')} telas y{' '}
                {fueraDeValorizacion.tubos.toLocaleString('es-CL')} tubos, porque esas tablas no
                tienen columna de costo en la base
                {valor.sinCosto > 0 && (
                  <>
                    , y {valor.sinCosto.toLocaleString('es-CL')} insumos con stock que sí la tienen
                    pero está vacía
                  </>
                )}
                .
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Los paños de la colmena tampoco entran: son sobrantes ya pagados dentro de otra OT.
              </p>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="font-serif text-base font-medium">Dónde está la plata</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  Valor por grupo, en millones de pesos
                </span>
              </div>
              {valor.grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ningún artículo con saldo tiene costo cargado.
                </p>
              ) : (
                <BarrasHorizontales
                  filas={valor.grupos.slice(0, 8).map((g) => ({ nombre: g.nombre, valor: g.valor }))}
                  maximo={valor.grupos[0].valor}
                  formato={millones}
                />
              )}
            </div>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            {/* Consumo */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="font-serif text-base font-medium">Consumo mensual</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  Salidas a OT, en pesos
                </span>
              </div>
              <BarrasMensuales barras={consumo} formato={pesos} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Solo se valoriza lo que tiene costo cargado, así que la barra es un piso, no el
                total exacto. El mes en curso va apagado: todavía no terminó.
              </p>
            </div>

            {/* Lo que no se mueve */}
            <div className="flex flex-col rounded-lg border border-border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="font-serif text-base font-medium">Lo que no se mueve</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  Sin salir hace más de 6 meses
                </span>
              </div>
              {quietos.articulos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todo lo que tiene saldo salió en los últimos 6 meses.
                </p>
              ) : (
                <>
                  <BarrasHorizontales
                    filas={quietos.articulos.slice(0, TOPE_QUIETOS).map((a) => ({
                      nombre: a.codigoVisible,
                      valor: a.valor,
                    }))}
                    maximo={Math.max(1, ...quietos.articulos.slice(0, TOPE_QUIETOS).map((a) => a.valor))}
                    formato={(v) => (v > 0 ? millones(v) : 'sin costo')}
                  />
                  <div className="mt-auto pt-3.5">
                    <div className="rounded-lg border border-warning/35 bg-warning/[0.09] px-3 py-2.5 text-xs leading-relaxed">
                      <b className="font-semibold">{pesos(quietos.valorParado)}</b> parados en{' '}
                      {quietos.articulos.length.toLocaleString('es-CL')} artículos que no salen hace
                      más de medio año.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Merma */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="font-serif text-base font-medium">Merma</h2>
              <Badge variant="muted">Tela en metros cuadrados</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                Promedio {promedioMensual(merma).toLocaleString('es-CL')} m² al mes
              </span>
            </div>
            <BarrasMensuales
              barras={merma}
              formato={(v) => `${v.toLocaleString('es-CL')} m²`}
            />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Sale de los retazos que el corte descartó y de las colmenas dadas de baja. La merma
              de tubos se lleva aparte, en centímetros, y vive en la pestaña Merma de Tubos.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default VistaReportes;
