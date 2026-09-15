// Paso 4 del asistente: qué se va a escribir y dónde queda conectado.
import { AlertTriangle, Check } from 'lucide-react';
import { validarReglasPrecios } from '@/modules/cotizador/reglasPrecios';
import type { BorradorCategoria } from '@/modules/cotizador/nuevaCategoria';
import type { ResultadoAplicar } from '@/modules/cotizador/nuevaCategoriaAplicar';
import type { ValidacionCategoria } from '@/modules/cotizador/nuevaCategoriaValidar';

type Props = {
  borrador: BorradorCategoria;
  resultado: ResultadoAplicar;
  validacion: ValidacionCategoria;
};

export default function PasoRevisar({ borrador: b, resultado, validacion }: Props) {
  const { resumen } = resultado;
  const erroresReglas = validarReglasPrecios(resultado.reglas).errores;

  const conectado: string[] = [];
  if (b.familiaExistente) {
    conectado.push(
      `Catálogo: ${resumen.productos} producto(s) nuevos en la familia ${b.familiaExistente}, que se cobra como siempre.`,
    );
  } else {
    for (const f of resumen.familias) {
      if (f.molde) {
        conectado.push(
          `Precios: ${f.cod} se cobra con la lista de materiales de ${f.molde}` +
            (f.recetasCopiadas.length > 1
              ? ` (y sus variantes: ${f.recetasCopiadas.slice(1).join(', ')})`
              : '') +
            (f.enInvertida ? ', y se puede invertir' : '') +
            '.',
        );
      } else {
        conectado.push(
          `Precios: ${f.cod} usa la receta de las verticales y su tabla de insumos VER` +
            (f.baseVertical ? `; la tela sale de ${f.baseVertical}` : '') +
            '.',
        );
      }
      conectado.push(
        f.referencia
          ? `Precios: la tela de referencia de ${f.cod} es ${f.referencia}.`
          : `Precios: ${f.cod} se cobra con la tela más cara que se venda de esa familia.`,
      );
    }
    conectado.push(
      resumen.pastilla.porFamilia
        ? `Fase 1: aparecen en la pastilla «${resumen.pastilla.label}», y los códigos nuevos de estas familias también van a caer ahí solos.`
        : `Fase 1: aparecen en la pastilla «${resumen.pastilla.label}».`,
    );
  }
  if (resumen.categoriaFabricacion) {
    conectado.push(
      `Fase 1: al agregar la cortina, la fila nace con la categoría ${resumen.categoriaFabricacion}.`,
    );
  }
  conectado.push(
    'Excel del catálogo: estas columnas (fecha de alta, proveedor, ganancia) ya se bajan y se suben con la plantilla.',
  );
  if (resumen.adicionales.length) {
    conectado.push(
      `${resumen.adicionales.join(', ')} entra(n) como adicional de precio fijo, sin tela ni medidas.`,
    );
  }

  const limites = [
    'Las etiquetas del taller imprimen la PRIMERA palabra del producto (ROLLER, DUO, CORTINA): por eso el nombre se arma así.',
    'En Admin → Precios la familia se ve con su código crudo; ponerle nombre bonito es un cambio aparte.',
    'La gama B de esta familia se cobra con el precio de tela de la gama A hasta que alguien le teclee el suyo en Admin → Precios → Sistemas.',
  ];

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-md border p-3">
        <p className="mb-1.5 font-medium">Se van a crear</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            {resumen.productos} producto(s) en el catálogo
            {resumen.sinAncho.length ? `, ${resumen.sinAncho.length} sin ancho de rollo` : ''}.
          </li>
          {resumen.familias.map((f) => (
            <li key={f.cod}>
              Familia <span className="font-mono">{f.cod}</span>
              {f.molde ? ` — como ${f.molde}` : ' — vertical'}
              {f.referencia ? ` — referencia ${f.referencia}` : ' — sin referencia'}
            </li>
          ))}
          {resumen.pastilla.nueva && <li>Pastilla nueva «{resumen.pastilla.label}».</li>}
        </ul>
      </div>

      <div>
        <p className="mb-1 font-medium">Dónde queda conectado</p>
        <ul className="space-y-1">
          {conectado.map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1 font-medium text-muted-foreground">Lo que conviene saber</p>
        <ul className="space-y-1 text-muted-foreground">
          {limites.map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
      </div>

      {(validacion.avisos.length > 0 || resultado.avisos.length > 0) && (
        <div className="rounded border border-warning/40 bg-warning/10 p-2">
          {[...validacion.avisos, ...resultado.avisos].map((a) => (
            <div key={a} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {erroresReglas.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2">
          <p className="mb-1 font-medium">Las reglas de precio quedarían mal:</p>
          {erroresReglas.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Si tienes cambios sin guardar en Admin → Precios → «Recetas y sistemas», guárdalos o
        descártalos antes de crear la categoría: al guardarlos después pisarían lo que se escriba
        acá.
      </p>
    </div>
  );
}
