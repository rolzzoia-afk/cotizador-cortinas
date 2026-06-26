// ─────────────────────────────────────────────────────────────────────
// Diálogo de confirmación propio (reemplaza window.confirm).
//
// Uso:
//   const confirmar = useConfirm();
//   if (!(await confirmar('¿Eliminar la tela?'))) return;
//   // …o con opciones:
//   await confirmar({ titulo: 'Eliminar lead', mensaje: '…', destructivo: true,
//                     confirmLabel: 'Eliminar lead' });
//
// Montar <ConfirmProvider> una vez cerca de la raíz (ya está en main.tsx).
// Devuelve una promesa<boolean>: true = confirmó, false = canceló/cerró.
// ─────────────────────────────────────────────────────────────────────
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ConfirmOpts = {
  titulo?: string;
  mensaje: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructivo?: boolean;
};

type ConfirmFn = (opts: string | ConfirmOpts) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

// Acceso imperativo (sin hook): el ConfirmProvider registra su función aquí,
// para poder llamar `confirmar(...)` desde cualquier handler sin tener que
// añadir el hook a cada componente. Reemplazo 1:1 de window.confirm.
let _confirmar: ConfirmFn | null = null;

export function confirmar(opts: string | ConfirmOpts): Promise<boolean> {
  if (!_confirmar) {
    // Fallback defensivo si el provider aún no montó (no debería pasar).
    return Promise.resolve(window.confirm(typeof opts === 'string' ? opts : opts.mensaje));
  }
  return _confirmar(opts);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback<ConfirmFn>((arg) => {
    const o = typeof arg === 'string' ? { mensaje: arg } : arg;
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // Registrar para el acceso imperativo `confirmar(...)`.
  useEffect(() => {
    _confirmar = confirmar;
    return () => {
      _confirmar = null;
    };
  }, [confirmar]);

  const cerrar = (valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setOpts(null);
  };

  const destructivo = !!opts?.destructivo;

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Dialog open={!!opts} onOpenChange={(abierto) => !abierto && cerrar(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {destructivo && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {opts?.titulo ?? 'Confirmar'}
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{opts?.mensaje}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => cerrar(false)}>
              {opts?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={destructivo ? 'destructive' : 'default'}
              onClick={() => cerrar(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
