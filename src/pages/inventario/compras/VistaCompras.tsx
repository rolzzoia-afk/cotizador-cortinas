// Compras (lámina «Compras»).
//
// Este submódulo está DISEÑADO y no construido: espera el visto bueno de la
// jefatura. La pantalla existe para acordar el alcance —qué se guarda de un
// proveedor, cómo se pide y cómo entra la mercadería al stock—, no para
// operar.
//
// Lo único que muestra con datos de verdad son los proveedores, porque ya
// están escritos en cada artículo. Las órdenes de compra NO se inventan: una
// pantalla con órdenes de mentira se lee como si el módulo funcionara.

import { useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { useProveedores } from '@/modules/inventario/proveedoresStore';

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-background/50 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/[0.15] font-mono text-[0.72rem] font-semibold text-accent">
          {numero}
        </span>
        <b className="text-[0.84rem] font-medium">{titulo}</b>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function VistaCompras() {
  const { proveedores, loading, error } = useProveedores();

  const total = useMemo(
    () => proveedores.reduce((s, p) => s + p.insumos + p.telas, 0),
    [proveedores],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-warning/35 bg-warning/[0.09] px-4 py-3 text-xs leading-relaxed">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Diseñado, todavía no construido.</b> Este submódulo espera
          el visto bueno de la jefatura. Está acá para acordar el alcance: qué se guarda de un
          proveedor, cómo se pide y cómo entra la mercadería al stock. Nada de esta pantalla
          escribe ni pide nada todavía.
        </span>
        <Badge variant="warning">Pendiente de aprobación</Badge>
      </div>

      <PageHeader
        miga="Inventario"
        titulo="Compras"
        hint="Hoy el proveedor es un texto suelto en cada artículo y «pedir» es solo una anotación. Acá pasa a tener nombre, orden y recepción."
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* Proveedores: esto SÍ es real */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-base font-medium">Proveedores</h2>
            <Badge variant="muted" className="ml-auto">
              {proveedores.length}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Salen de los nombres que ya están escritos en los artículos. Son{' '}
            {total.toLocaleString('es-CL')} artículos con proveedor anotado.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="mt-3 flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
              {proveedores.map((p) => (
                <div key={p.nombre} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-[0.84rem] font-medium">{p.nombre}</div>
                  <div className="text-[0.72rem] text-muted-foreground">
                    {p.insumos > 0 && `${p.insumos} insumo${p.insumos === 1 ? '' : 's'}`}
                    {p.insumos > 0 && p.telas > 0 && ' · '}
                    {p.telas > 0 && `${p.telas} tela${p.telas === 1 ? '' : 's'}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Del proveedor se guardaría RUT, contacto y condiciones. El artículo queda enlazado sin
            perder el texto que ya tenía.
          </p>
        </div>

        {/* El alcance */}
        <div className="flex flex-col gap-3.5">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-serif text-base font-medium">Órdenes de compra</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Se armarían con lo que quedó marcado en Alertas y reposición: número, proveedor,
              fecha de emisión, fecha esperada, líneas y estado (borrador, enviada, recibida en
              parte, recibida).
            </p>
            <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/30 px-3.5 py-6 text-center text-xs text-muted-foreground">
              Todavía no hay órdenes: la tabla se crea cuando el módulo se apruebe.
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-serif text-base font-medium">Recepción de mercadería</h2>
              <Badge variant="muted">Se haría desde el celular, en el mesón</Badge>
            </div>
            <div className="mt-3 flex flex-col gap-2.5 lg:flex-row">
              <Paso numero={1} titulo="Sacar la foto">
                Papel o PDF. Se lee sola y saca proveedor, folio y las líneas.{' '}
                <b className="font-medium text-foreground">Sin precios.</b>
              </Paso>
              <Paso numero={2} titulo="Revisar línea por línea">
                Lo que no reconoce se enlaza a mano una vez y queda aprendido para la próxima.
              </Paso>
              <Paso numero={3} titulo="Firmar y entra al stock">
                Suma a Materias primas con un solo movimiento agrupado, cierra las líneas de la
                orden y avisa a Finanzas.
              </Paso>
            </div>
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              La recepción entraría al stock por el mismo camino que todo lo demás: la función de
              la base. Nada escribe el saldo por su cuenta. El paso de Finanzas necesita la llave
              de ese proyecto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VistaCompras;
