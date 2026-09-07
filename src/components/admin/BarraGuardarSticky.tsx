// ─────────────────────────────────────────────────────────────────────
// Barra de guardado pegada al pie de la pantalla.
//
// El dueño (2026-09-07): «no veo un botón de guardar, entonces no sé si el
// monto que se modifica se guarda automático». El botón existía —arriba del
// todo—, pero las tablas de Admin son largas: se edita una fila a mitad de
// página, no se ve ningún botón, y es razonable suponer que se guardó solo.
// Nada de esto se guarda solo, a propósito: son los precios con que cotiza
// toda la empresa.
//
// La barra aparece SOLO cuando hay algo sin guardar, así no estorba mientras
// se mira. Es un componente tonto: el borrador y el guardado siguen viviendo
// en cada sección.
// ─────────────────────────────────────────────────────────────────────
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  /** Hay cambios sin guardar. Con `false` la barra no se dibuja. */
  visible: boolean;
  guardando?: boolean;
  /** Con `false`, Guardar queda deshabilitado (p. ej. hay errores). */
  puedeGuardar?: boolean;
  onGuardar: () => void;
  onDescartar?: () => void;
  /** «Guardar precios», «Guardar términos»… Por defecto, «Guardar». */
  etiquetaGuardar?: string;
  /** Por qué no se puede guardar, o cualquier aclaración corta. */
  mensaje?: string;
};

export function BarraGuardarSticky({
  visible,
  guardando = false,
  puedeGuardar = true,
  onGuardar,
  onDescartar,
  etiquetaGuardar = 'Guardar',
  mensaje,
}: Props) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-4 flex flex-wrap items-center gap-2 rounded-md border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2 py-0.5 text-[0.7rem] text-warning-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Cambios sin guardar
      </span>
      {mensaje && <span className="text-[0.7rem] text-muted-foreground">{mensaje}</span>}
      <div className="ml-auto flex items-center gap-2">
        {onDescartar && (
          <Button variant="ghost" size="sm" onClick={onDescartar} disabled={guardando}>
            Descartar
          </Button>
        )}
        <Button size="sm" onClick={onGuardar} disabled={guardando || !puedeGuardar}>
          <Save className="mr-1 h-3.5 w-3.5" />
          {guardando ? 'Guardando…' : etiquetaGuardar}
        </Button>
      </div>
    </div>
  );
}
