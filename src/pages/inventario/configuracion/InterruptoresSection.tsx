// Los interruptores del módulo, encendibles desde acá.
//
// Solo los toca quien administra: cambian cómo se guarda el stock de toda la
// empresa. Cada uno se puede apagar en el acto y el sistema vuelve a
// funcionar como antes, sin migrar nada de vuelta.

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { problemasDeFlags, type FlagsInventario } from '@/modules/inventario/flags';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';

type Rotulo = {
  id: keyof FlagsInventario;
  titulo: string;
  detalle: string;
  /** Lo que hay que confirmar antes de encenderlo. */
  aviso?: string;
};

const ROTULOS: Rotulo[] = [
  {
    id: 'kardexRpc',
    titulo: 'Registrar los movimientos en la base',
    detalle:
      'Hoy el stock se ajusta desde el navegador con dos escrituras sueltas: si dos personas registran a la vez, una se pierde. Con esto encendido lo hace la base en una sola operación, con el artículo bloqueado, y deja el movimiento anotado.',
    aviso:
      'Desde ahora, mover stock pasa a hacerlo la base. Sacar más de lo que hay va a quedar RECHAZADO en vez de recortarse a cero en silencio, así que puede que aparezcan avisos que antes no salían. Se puede apagar en cualquier momento.',
  },
  {
    id: 'dualWrite',
    titulo: 'Escribir también en el registro viejo',
    detalle:
      'Copia de respaldo mientras conviven los dos registros, para que ninguna pantalla que todavía no migra quede ciega.',
  },
  {
    id: 'bloqueoDirecto',
    titulo: 'Rechazar escrituras que no pasen por la base',
    detalle:
      'Mientras esté apagado, quien escriba el stock por fuera queda anotado y nada más. Encenderlo antes de que esa lista esté vacía deja pantallas sin poder guardar.',
    aviso:
      'Cualquier pantalla que todavía escriba el stock por fuera va a dejar de funcionar. Enciéndelo solo si la lista de escrituras directas lleva días vacía.',
  },
  {
    id: 'compras',
    titulo: 'Mostrar Compras',
    detalle: 'Proveedores, órdenes de compra y recepción de facturas. Espera a la jefatura.',
  },
];

export function InterruptoresSection({ puedeEditar }: { puedeEditar: boolean }) {
  const { flags, loading, guardar } = useFlagsInventario();
  const [borrador, setBorrador] = useState<FlagsInventario>(flags);
  const [guardando, setGuardando] = useState(false);
  const confirmar = useConfirm();

  // El borrador nace de lo guardado y se repone cuando termina de cargar.
  useEffect(() => {
    if (!loading) setBorrador(flags);
  }, [loading, flags]);

  const sucio = ROTULOS.some((r) => borrador[r.id] !== flags[r.id]);
  const problemas = problemasDeFlags(borrador);

  const alternar = async (r: Rotulo) => {
    const encendiendo = !borrador[r.id];
    if (encendiendo && r.aviso) {
      const ok = await confirmar({
        titulo: r.titulo,
        mensaje: r.aviso,
        confirmLabel: 'Encender',
      });
      if (!ok) return;
    }
    setBorrador((b) => ({ ...b, [r.id]: encendiendo }));
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      await guardar(borrador);
      toast.success('Interruptores guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-[0.9375rem] font-medium">Interruptores del módulo</h2>
        {!puedeEditar && (
          <Badge variant="muted" className="ml-auto">
            Solo lectura
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        El cambio de cómo se guarda el stock se enciende por partes y se puede apagar en el acto.
        Apagarlo no deshace lo ya registrado: el libro queda y el sistema vuelve a moverse como
        antes.
      </p>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {ROTULOS.map((r) => (
          <div key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-[0.845rem] font-medium">{r.titulo}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.detalle}</p>
            </div>
            {puedeEditar ? (
              <Button
                variant={borrador[r.id] ? 'default' : 'outline'}
                size="sm"
                className="ml-auto mt-0.5 shrink-0"
                onClick={() => void alternar(r)}
                disabled={loading}
              >
                {borrador[r.id] ? 'Encendido' : 'Apagado'}
              </Button>
            ) : (
              <Badge variant={flags[r.id] ? 'success' : 'muted'} className="ml-auto mt-0.5 shrink-0">
                {loading ? '…' : flags[r.id] ? 'Encendido' : 'Apagado'}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {problemas.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/[.09] p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            {problemas.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {puedeEditar && sucio && (
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={() => void guardarCambios()} disabled={guardando || problemas.length > 0}>
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
          <Button variant="ghost" onClick={() => setBorrador(flags)} disabled={guardando}>
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}

export default InterruptoresSection;
