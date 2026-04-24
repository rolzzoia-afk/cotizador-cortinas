import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type UseQRScannerOpts = {
  onScan: (decoded: string) => void;
  // ms sin dejar leer después de un scan procesado
  cooldownMs?: number;
  // número de lecturas iguales consecutivas para confirmar
  confirmReads?: number;
};

/**
 * Hook wrapper sobre html5-qrcode.
 * `start(elementId)` inicia la cámara sobre un `<div id={elementId} />`.
 * `stop()` la detiene. `startCooldown(ms)` ignora lecturas por N ms.
 */
export function useQRScanner({
  onScan,
  cooldownMs = 0,
  confirmReads = 1,
}: UseQRScannerOpts) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastValRef = useRef<string>('');
  const repCountRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const resetDebounce = () => {
    lastValRef.current = '';
    repCountRef.current = 0;
  };

  const startCooldown = (ms: number) => {
    cooldownRef.current = true;
    resetDebounce();
    setTimeout(() => {
      cooldownRef.current = false;
    }, ms);
  };

  const handleDecoded = (decoded: string) => {
    if (cooldownRef.current) return;
    if (decoded === lastValRef.current) {
      repCountRef.current += 1;
    } else {
      lastValRef.current = decoded;
      repCountRef.current = 1;
    }
    if (repCountRef.current < confirmReads) return;
    resetDebounce();
    onScanRef.current(decoded);
  };

  const start = async (elementId: string, initialCooldownMs?: number) => {
    // Stop previous scanner cleanly
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* ignore */
      }
      try {
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    const readerEl = document.getElementById(elementId);
    if (readerEl) readerEl.innerHTML = '';

    setError(null);
    resetDebounce();
    cooldownRef.current = false;

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    // Aplicar cooldown inicial DESPUÉS de que el scanner arranque, para que
    // no sea pisado por el reset de cooldownRef de arriba. Evita que un QR
    // que todavía está en cámara (ej: trabajador que acaba de tocar "Otra
    // salida" y no movió el teléfono) sea re-detectado instantáneamente.
    const applyInitialCooldown = () => {
      if (initialCooldownMs && initialCooldownMs > 0) {
        startCooldown(initialCooldownMs);
      }
    };

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        handleDecoded,
        () => {
          /* silent frame errors */
        },
      );
      setIsRunning(true);
      applyInitialCooldown();
    } catch (e) {
      try {
        await scanner.start(
          {},
          { fps: 10, qrbox: { width: 260, height: 260 } },
          handleDecoded,
          () => {
            /* silent */
          },
        );
        setIsRunning(true);
        applyInitialCooldown();
      } catch (e2) {
        const err = e2 as Error;
        setError(`${err.name || 'Error'}: ${err.message || 'sin acceso a cámara'}`);
        setIsRunning(false);
      }
    }
  };

  const stop = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setIsRunning(false);
  };

  useEffect(() => {
    return () => {
      // cleanup en unmount
      stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  // Si el usuario no pasa cooldownMs por defecto, 0 = sin auto-cooldown
  useEffect(() => {
    if (cooldownMs > 0) startCooldown(cooldownMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldownMs]);

  return { start, stop, startCooldown, resetDebounce, isRunning, error };
}
