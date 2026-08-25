// Bloque "Términos y condiciones" del documento de cotización (Fase 1 y 3).
//
// Los términos ya no están cableados: los define el admin por grupos y acá se
// muestran solo los que aplican a lo que se está cotizando (categorías de
// producto + gamas de tela presentes en la OT), sin repetir los que estén en
// más de un grupo. La frase de la TARJETA se genera aparte porque depende del
// proveedor y del recargo vigente, que son parámetros vivos.

import { useMemo } from 'react';
import type { ParametrosCotizador } from '@/modules/cotizador/preciosFase0';
import {
  conTerminoTarjeta,
  terminosParaCotizacion,
  textoTerminoTarjeta,
  type ConfigTerminos,
} from '@/modules/cotizador/terminos';

interface TerminosCotizacionProps {
  config: ConfigTerminos;
  /** Categorías de PRODUCTO presentes en la cotización (ROL, BEEBLACK…). */
  categorias: string[];
  /** Categorías de TELA presentes (A / B). */
  telas: string[];
  parametros: ParametrosCotizador;
  /** Formateador de porcentaje de la página (comparte el estilo del resto). */
  fmtPct: (n: number) => string;
}

export default function TerminosCotizacion({
  config,
  categorias,
  telas,
  parametros,
  fmtPct,
}: TerminosCotizacionProps) {
  // La MISMA lista que imprime el PDF descargable: si los términos configurados
  // ya hablan de la tarjeta de crédito, no se agrega la frase automática.
  const items = useMemo(
    () =>
      conTerminoTarjeta(
        // El medio de pago filtra: las cuotas sin interés son de Mercadopago.
        terminosParaCotizacion(config, categorias, telas, parametros.proveedorTarjeta),
        textoTerminoTarjeta(parametros, fmtPct),
      ),
    [config, categorias, telas, parametros, fmtPct],
  );

  return (
    <section className="mt-4 rounded-lg border border-border bg-card/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
      <div className="mb-1 font-semibold text-foreground">Términos y condiciones</div>
      <ol className="list-decimal space-y-0.5 pl-4">
        {items.map((t, i) => (
          <li key={`${i}-${t.slice(0, 24)}`}>{t}</li>
        ))}
      </ol>
    </section>
  );
}
