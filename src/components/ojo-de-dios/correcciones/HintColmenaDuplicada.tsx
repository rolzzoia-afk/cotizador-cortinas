// Hint permanente al final del módulo: explica al operario qué hacer
// cuando aparece un tubo con dos códigos en la colmena (no eliminar a
// mano — usar Restaurar plan o corrección retroactiva).

import { AlertTriangle } from 'lucide-react';

export default function HintColmenaDuplicada() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[0.72rem] text-amber-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="space-y-1">
          <strong className="block text-amber-100">
            ¿Te aparece un tubo con dos códigos en la colmena?
          </strong>
          <p className="opacity-90">
            Si el bodeguero ingresó un tubo duplicado, no lo elimines manualmente.
            Usa <em>Restaurar plan</em> con el plan correcto, o crea una corrección
            retroactiva indicando el tubo válido. Eliminar a mano deja la colmena
            descuadrada.
          </p>
        </div>
      </div>
    </div>
  );
}
