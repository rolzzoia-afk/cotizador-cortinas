// ─────────────────────────────────────────────────────────────────────
// Input de número que SÍ deja escribir decimales.
//
// El problema del `<input type="number">` controlado por un número: mientras
// se teclea «0,65» el campo pasa por el estado intermedio «0,», que el
// navegador considera inválido y entrega como cadena vacía. Si el padre
// convierte eso con `Number()` guarda un 0, vuelve a pintar «0» y se come la
// coma: el campo «se arregla solo» al valor anterior y nunca se puede escribir
// un decimal. En es-CL además el separador natural del teclado es la COMA, que
// `type="number"` rechaza de plano.
//
// Acá el estado que se teclea es TEXTO y solo se avisa al padre cuando lo
// escrito es un número terminado. El texto se repinta desde el número solo
// cuando el valor cambia por fuera (cargar otro borrador, restaurar un
// respaldo), nunca mientras se escribe.
//
// Mismo criterio que `ParametrosCotizadorSection`, que ya guardaba su borrador
// como strings por esta misma razón.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';

/**
 * Texto tecleado → número, aceptando coma o punto.
 *
 * Devuelve `null` cuando lo escrito todavía no es un número terminado
 * (vacío, «-», «0,», «1e»): ahí no hay que avisarle nada al padre, porque
 * un 0 momentáneo dispara las validaciones y borra lo tecleado.
 */
export function textoADecimal(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t || t.endsWith('.') || t === '-' || t === '-.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Número → texto para mostrar, con coma decimal (es-CL). */
export function decimalATexto(valor: number): string {
  return Number.isFinite(valor) ? String(valor).replace('.', ',') : '';
}

export type InputDecimalProps = Omit<InputProps, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (valor: number) => void;
};

export function InputDecimal({ value, onChange, onBlur, ...rest }: InputDecimalProps) {
  const [texto, setTexto] = useState(() => decimalATexto(value));

  // Solo repinta si el número de afuera dejó de ser el que está escrito: así
  // «0,», «0,50» y «0,5» sobreviven mientras se teclea.
  useEffect(() => {
    setTexto((t) => (textoADecimal(t) === value ? t : decimalATexto(value)));
  }, [value]);

  return (
    <Input
      {...rest}
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = textoADecimal(e.target.value);
        if (n !== null) onChange(n);
      }}
      onBlur={(e) => {
        // Al salir se normaliza a lo que de verdad quedó guardado: si el campo
        // quedó a medias («0,» o vacío) reaparece el último valor válido.
        setTexto(decimalATexto(value));
        onBlur?.(e);
      }}
    />
  );
}
