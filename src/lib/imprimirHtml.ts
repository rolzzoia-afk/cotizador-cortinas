// Abrir el diálogo de impresión con un documento armado por la app.
//
// El mismo bloque estaba copiado en cinco pantallas (catálogo de telas, colmena
// viva, cierre del corte, bolsa de bodega y QR de insumo), cada una con su
// propio tamaño de ventana y su propio mensaje de error. Acá va una sola vez.
//
// El `window.open` DEBE ocurrir dentro del gesto del usuario (el click): si se
// espera un `await` antes, el navegador lo toma como popup y lo bloquea. Por eso
// los datos y la plantilla se cargan antes, no acá.
import { toast } from 'sonner';

/**
 * Abre una ventana con el HTML dado. El documento trae su propio
 * `window.print()`, así que acá solo se escribe.
 *
 * Devuelve `false` si el navegador bloqueó la ventana (y ya avisó al usuario).
 */
export function imprimirHtml(html: string, opts: { ancho?: number; alto?: number } = {}): boolean {
  const w = window.open('', '_blank', `width=${opts.ancho ?? 860},height=${opts.alto ?? 680}`);
  if (!w) {
    toast.error('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.');
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
