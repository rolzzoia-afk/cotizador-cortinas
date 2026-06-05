// Barra de progreso horizontal — data viz funcional.
//
// Animación: width de 0 al valor real al montar, usando CSS transition
// (no framer-motion, no deps nuevas). Motion comunica estado, no decoración.
// Tono por severidad. respeta prefers-reduced-motion via dashboard-pro.css.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface StockBarProps {
  value: number; // 0..max
  max: number;
  tone?: 'success' | 'warning' | 'destructive' | 'accent' | 'muted';
  height?: number; // px
  className?: string;
  showThreshold?: boolean; // muestra una línea vertical en value/max=1 (mínimo)
}

export default function StockBar({
  value,
  max,
  tone = 'accent',
  height = 4,
  className,
  showThreshold = false,
}: StockBarProps) {
  // Capamos al 100% para mostrar correctamente exceso de stock como "lleno"
  const target = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const [animated, setAnimated] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) {
      // updates posteriores: ir directo al nuevo valor
      setAnimated(target);
      return;
    }
    // mount inicial: dejar que pinte en 0, después transicionar al target
    const id = requestAnimationFrame(() => {
      setAnimated(target);
      mountedRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-sm bg-foreground/[0.06]', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(target)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${animated}%`,
          background: `hsl(var(--${tone}))`,
          transition: 'width 600ms var(--ease-out-strong)',
        }}
      />
      {showThreshold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground/30"
          style={{ left: '100%' }}
        />
      )}
    </div>
  );
}
