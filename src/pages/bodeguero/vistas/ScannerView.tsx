// Vista del scanner QR (state machine: loc → item → confirm).
//
// Flujo:
// 1. fase='loc' → escanear QR del rack. Si matchea la ubicación esperada
//    (LOC:...), pasar a fase='item'. Si no, marca error y se queda en loc.
// 2. fase='item' → escanear QR del contenedor (INS:codigo). Si el código
//    matchea el insumo esperado del BOM, mostrar panel confirm.
// 3. fase='confirm' → ajustar cantidad y confirmar.
//
// Cooldowns en SCAN_COOLDOWN_OK / SCAN_COOLDOWN_ERR para evitar loops.

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQRScanner } from '@/modules/bodega/useQRScanner';
import {
  type BOMItem,
  type Insumo,
  type Rack,
  buscarInsumoMatchBOM,
  getRackUbicacion,
  getRackUbicacionPorSpec,
} from '@/modules/bodega/bomUtils';
import { SCAN_COOLDOWN_ERR, SCAN_COOLDOWN_OK } from '../Bodeguero.config';
import type { Contador, ScanEstado, ScanFase } from '../Bodeguero.types';

interface ScannerViewProps {
  item: BOMItem;
  contador: Contador;
  insumos: Insumo[];
  racks: Rack[];
  initialFase: ScanFase;
  onCerrar: () => void;
  onConfirm: (cantidad: number) => void;
}

export default function ScannerView({
  item,
  contador,
  insumos,
  racks,
  initialFase,
  onCerrar,
  onConfirm,
}: ScannerViewProps) {
  const [fase, setFase] = useState<ScanFase>(initialFase);
  const [estado, setEstado] = useState<ScanEstado>('esperando');
  const [mensaje, setMensaje] = useState('');
  const [submensaje, setSubmensaje] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [needItemScanTap, setNeedItemScanTap] = useState(false);
  const [qty, setQty] = useState<number>(0);
  const [maxQty, setMaxQty] = useState<number>(1);

  // Ubicación esperada
  const ubicacionInfo = useMemo(() => {
    if (item._es_tela && item._ubicacion_rack) {
      const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '');
      return {
        display: item._ubicacion_rack,
        qr: `LOC:${ascii(item._ubicacion_rack)}`,
      };
    }
    const spec = (item.especificacion || '').trim();
    if (spec) {
      const r = getRackUbicacionPorSpec(spec, racks);
      if (r) return r;
    }
    const ins = buscarInsumoMatchBOM(item, insumos);
    if (ins) {
      const r = getRackUbicacion(ins.cod, racks);
      if (r) return r;
    }
    return null;
  }, [item, racks, insumos]);

  const locDisplay = ubicacionInfo
    ? `📍 ${ubicacionInfo.display}`
    : '⚠ Sin rack asignado — escanea directo el insumo';

  const insumoEsperado = useMemo(() => buscarInsumoMatchBOM(item, insumos), [item, insumos]);

  useEffect(() => {
    if (fase === 'loc') {
      setEstado('esperando');
      setMensaje('Escanea el QR de la ubicación');
      setSubmensaje('El QR está pegado en el estante');
    } else {
      setEstado('esperando');
      setMensaje('Escanea el QR del contenedor');
      setSubmensaje('El QR está en la caja/bolsa del insumo');
    }
  }, [fase]);

  const scanner = useQRScanner({
    onScan: (decoded) => handleScan(decoded),
  });

  const handleScan = async (decoded: string) => {
    if (fase === 'loc') {
      const norm = (s: string) => s.trim().toUpperCase();
      const ok = ubicacionInfo && norm(decoded) === norm(ubicacionInfo.qr);
      if (ubicacionInfo && !ok) {
        setEstado('error');
        setMensaje('❌ Ubicación incorrecta');
        setSubmensaje(
          `Busca: ${ubicacionInfo.display}  |  Escaneaste: ${decoded.replace('LOC:', '').replace(/\|/g, ' · ')}`,
        );
        scanner.startCooldown(SCAN_COOLDOWN_ERR);
        setTimeout(() => {
          setEstado('esperando');
          setMensaje('Escanea el QR de la ubicación');
          setSubmensaje('El QR está pegado en el estante');
        }, SCAN_COOLDOWN_ERR);
        return;
      }
      // OK
      setEstado('ok');
      setMensaje('✅ Ubicación confirmada');
      setSubmensaje(
        ubicacionInfo
          ? `${ubicacionInfo.display} — Ahora toma el insumo`
          : 'Sin rack — toma el insumo',
      );
      scanner.startCooldown(SCAN_COOLDOWN_OK);
      await scanner.stop();
      setFase('item');
      setNeedItemScanTap(true);
      return;
    }

    // fase === 'item'
    if (decoded.startsWith('LOC:')) {
      setEstado('error');
      setMensaje('❌ Eso es una ubicación');
      setSubmensaje('Ya pasamos la ubicación — escanea la caja/insumo');
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }
    if (!decoded.startsWith('INS:')) {
      setEstado('error');
      setMensaje('❌ QR no reconocido');
      setSubmensaje(`Esperaba INS:... · Escaneaste: "${decoded.substring(0, 20)}"`);
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }

    const codEscaneado = decoded.replace('INS:', '').trim();
    const normCod = (s: string) => (s || '').trim().toUpperCase().replace(/\s+/g, '');
    if (insumoEsperado && normCod(insumoEsperado.cod || '') !== normCod(codEscaneado)) {
      setEstado('error');
      setMensaje('❌ Insumo incorrecto');
      setSubmensaje(`Escaneaste: ${codEscaneado}  |  Necesitas: ${insumoEsperado.cod}`);
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }

    // Insumo correcto → panel confirmar
    await scanner.stop();
    const restante = contador.requerido - contador.pickeado;
    setMaxQty(restante);
    setQty(restante);
    setShowConfirm(true);
  };

  useEffect(() => {
    if (!needItemScanTap && !showConfirm) {
      scanner.start('reader-bodega');
    }
    return () => {
      scanner.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, showConfirm]);

  const saltarUbicacion = async () => {
    await scanner.stop();
    setFase('item');
    setNeedItemScanTap(true);
    setEstado('ok');
    setMensaje('↩ Rack salteado');
    setSubmensaje('Toma el insumo y presiona el botón');
  };

  const activarFaseItem = () => {
    setNeedItemScanTap(false);
    setEstado('esperando');
    setMensaje('Escanea el QR del contenedor');
    setSubmensaje('El QR está en la caja/bolsa del insumo');
    scanner.start('reader-bodega');
  };

  const volverAEscanearItem = () => {
    setShowConfirm(false);
    setEstado('esperando');
    setMensaje('Escanea el QR del contenedor');
    setSubmensaje('El QR está en la caja/bolsa del insumo');
    scanner.start('reader-bodega');
  };

  const paso = showConfirm ? 3 : fase === 'item' ? 2 : 1;

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={async () => {
            await scanner.stop();
            onCerrar();
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Cerrar
        </button>
        <h1 className="flex-1 truncate text-base font-bold">{item.descripcion}</h1>
      </div>

      <div className="mx-auto max-w-md p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          {(['Ubicación', 'Insumo', 'Confirmar'] as const).map((label, i) => {
            const n = i + 1;
            const completo = n < paso;
            const activo = n === paso;
            return (
              <div key={label} className="flex-1 text-center">
                <div
                  className={cn(
                    'mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                    completo
                      ? 'border-emerald-500 bg-success/15 text-success'
                      : activo
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {completo ? '✓' : n}
                </div>
                <div
                  className={cn(
                    'text-[10px] uppercase',
                    activo ? 'text-accent' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {!showConfirm && (
          <div className="mb-3 rounded-xl border border-border bg-card p-3 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.categoria}
            </div>
            <div className="font-semibold">{item.descripcion}</div>
            <div className="text-[11px] text-muted-foreground">
              {[item.especificacion, item.color].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-2 text-[12px] text-foreground">{locDisplay}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Progreso: {contador.pickeado} / {contador.requerido} {item.unidad}
            </div>
          </div>
        )}

        {!showConfirm && (
          <div
            className={cn(
              'mb-3 rounded-xl border p-3 text-center text-sm',
              estado === 'error'
                ? 'border-destructive/30 bg-destructive/15 text-destructive'
                : estado === 'ok'
                  ? 'border-success/30 bg-success/15 text-success'
                  : 'border-accent/30 bg-accent/10 text-accent',
            )}
          >
            <div className="text-base font-semibold">{mensaje}</div>
            <div className="mt-0.5 text-[11px] opacity-80">{submensaje}</div>
          </div>
        )}

        {!showConfirm && !needItemScanTap && (
          <div
            id="reader-bodega"
            className="mx-auto mb-3 aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-black"
          />
        )}

        {scanner.error && !showConfirm && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/15 p-3 text-center text-sm text-destructive">
            <Camera className="mx-auto mb-1 h-6 w-6" />
            <div className="font-semibold">Sin acceso a cámara</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{scanner.error}</div>
            <Button onClick={() => scanner.start('reader-bodega')} size="sm" className="mt-2 gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Reintentar
            </Button>
          </div>
        )}

        {!showConfirm && fase === 'loc' && estado === 'esperando' && (
          <Button onClick={saltarUbicacion} variant="outline" className="w-full">
            No encuentro el QR de ubicación
          </Button>
        )}
        {!showConfirm && needItemScanTap && (
          <Button onClick={activarFaseItem} className="w-full gap-2">
            <Camera className="h-4 w-4" /> Escanear QR del insumo
          </Button>
        )}

        {showConfirm && (
          <div className="rounded-2xl border border-success/30 bg-success/15 p-5">
            <div className="mb-1 text-xs uppercase tracking-wider text-success">
              Confirmar cantidad
            </div>
            <div className="mb-0.5 text-base font-semibold">{item.descripcion}</div>
            <div className="mb-4 text-xs text-muted-foreground">
              El sistema requiere {maxQty} {item.unidad} para esta OT
            </div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <Button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setQty(Math.max(1, Math.min(maxQty, n)));
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 w-24 text-center text-3xl font-bold"
              />
              <Button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <Button
              onClick={() => onConfirm(qty)}
              className="mb-2 h-12 w-full gap-2 bg-success text-base hover:bg-success/90"
            >
              <Check className="h-5 w-5" /> Confirmar {qty} {item.unidad}
            </Button>
            <Button onClick={volverAEscanearItem} variant="outline" className="w-full">
              Volver a escanear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
