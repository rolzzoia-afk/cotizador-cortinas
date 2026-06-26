// Vista ad-hoc para 3 flujos sin OT: salida rápida, entrada rápida y
// devolución desde OT. La estructura de los 3 es muy similar (escanear
// QR → confirmar cantidad → OK), pero las mutaciones difieren:
//
// - salida: descuenta stock_mp y stock_liberado (primero liberado),
//   registra movimiento `SALIDA PRODUCCION`.
// - entrada: incrementa stock_mp, registra `NUEVO INGRESO`.
// - devolucion: incrementa stock_mp con referencia obligatoria a OT,
//   registra `DEVOLUCION` con motivo.
//
// Tiene varias guardas para evitar bugs encontrados en producción:
// - procesandoRef: anti-reentrada del scanner que dispara onScan cada
//   ~100ms y resetearía qty a 1 en cada frame.
// - lastFailedCodRef: anti-loop de toasts cuando el QR queda en cámara
//   y se reintenta indefinidamente.
// - cooldown de 1200ms al volver a fase 'scan' para que el QR del producto
//   anterior no sea re-detectado.

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Minus,
  Pencil,
  Plus,
  QrCode,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQRScanner } from '@/modules/bodega/useQRScanner';
import {
  AREAS_BODEGA,
  AREA_LABEL,
  MESES_A,
  MOTIVOS_DEVOLUCION,
  NOMBRE_KEY,
} from '../Bodeguero.config';
import type { AdHocFase, AreaBodega, InsumoAdHoc, MotivoDevolucion } from '../Bodeguero.types';

interface AdHocViewProps {
  modo: 'salida' | 'entrada' | 'devolucion';
  empresaId: string;
  onCerrar: () => void;
}

export default function AdHocView({ modo, empresaId, onCerrar }: AdHocViewProps) {
  const [nombre, setNombre] = useState<string>(() => localStorage.getItem(NOMBRE_KEY) || '');
  const [modalNombre, setModalNombre] = useState(false);
  const [nombreInput, setNombreInput] = useState(nombre);
  const [fase, setFase] = useState<AdHocFase>('scan');
  const [scanMsg, setScanMsg] = useState('Esperando escaneo…');
  const [codManual, setCodManual] = useState('');
  const [insumo, setInsumo] = useState<InsumoAdHoc | null>(null);
  const [qty, setQty] = useState(1);
  const [otRef, setOtRef] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [docRef, setDocRef] = useState('');
  const [motivo, setMotivo] = useState<MotivoDevolucion>('Error de picking');
  const [area, setArea] = useState<AreaBodega>('general');
  const [recibe, setRecibe] = useState('');
  const [saving, setSaving] = useState(false);
  const [resumen, setResumen] = useState<{ msg: string; sub: string } | null>(null);

  // Anti-reentrada: el scanner dispara onScan cada ~100ms mientras el QR
  // está en cámara. Sin este guard, cada frame resetea qty a 1 y pisa lo
  // que el usuario haya tocado.
  const procesandoRef = useRef(false);
  // Anti-loop: si el scanner detecta un código que acabamos de marcar como
  // "no encontrado", lo ignoramos por unos segundos. Sin esto, el QR queda
  // en cámara, se redetecta inmediatamente y entra en bucle infinito de
  // toasts "Insumo X no encontrado".
  const lastFailedCodRef = useRef<{ cod: string; at: number } | null>(null);
  const FAILED_COD_TTL_MS = 5000;

  const titulo =
    modo === 'salida'
      ? 'Salida rápida'
      : modo === 'entrada'
        ? 'Entrada rápida'
        : 'Devolución desde OT';
  const colorAccent =
    modo === 'salida' ? '#ef4444' : modo === 'entrada' ? '#22c55e' : '#f59e0b';
  const labelNombre =
    modo === 'salida' ? 'Quién retira' : modo === 'entrada' ? 'Quién ingresa' : 'Quién devuelve';

  const cargarInsumo = async (cod: string) => {
    const norm = cod.trim().toUpperCase();
    if (!norm) {
      toast.warning('Ingresa un código');
      procesandoRef.current = false;
      return;
    }
    procesandoRef.current = true;
    await scanner.stop();
    const { data } = await supabase
      .from('insumos')
      .select('cod,nemotecnico,descriptor_proveedor,stock_mp,stock_liberado,proveedor')
      .eq('empresa_id', empresaId)
      .eq('cod', norm)
      .maybeSingle();
    if (!data) {
      toast.error(`Insumo "${norm}" no encontrado`);
      lastFailedCodRef.current = { cod: norm, at: Date.now() };
      procesandoRef.current = false;
      scanner.start('adhoc-reader', 1500);
      return;
    }
    setInsumo(data as InsumoAdHoc);
    setQty(1);
    if (modo === 'entrada' && data.proveedor) setProveedor(data.proveedor);
    setCodManual('');
    setFase('confirm');
  };

  const scanner = useQRScanner({
    onScan: async (decoded) => {
      if (procesandoRef.current) return;
      const cod = decoded.startsWith('INS:') ? decoded.slice(4) : decoded.trim().toUpperCase();
      const lastFailed = lastFailedCodRef.current;
      if (
        lastFailed &&
        lastFailed.cod === cod &&
        Date.now() - lastFailed.at < FAILED_COD_TTL_MS
      ) {
        return;
      }
      procesandoRef.current = true;
      setScanMsg(`Código detectado: ${cod}`);
      await cargarInsumo(cod);
    },
  });

  useEffect(() => {
    if (!nombre) {
      setModalNombre(true);
      return;
    }
    const t = setTimeout(() => scanner.start('adhoc-reader'), 200);
    return () => {
      clearTimeout(t);
      scanner.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre]);

  useEffect(() => {
    if (fase !== 'scan' || !nombre) return;
    setScanMsg('Esperando escaneo…');
    const t = setTimeout(() => scanner.start('adhoc-reader', 1200), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const guardarNombre = () => {
    const n = nombreInput.trim();
    if (!n) {
      toast.warning('Ingresa tu nombre');
      return;
    }
    localStorage.setItem(NOMBRE_KEY, n);
    setNombre(n);
    setModalNombre(false);
    toast.success(`Guardado como "${n}"`);
  };

  const stockActual = insumo ? (insumo.stock_mp || 0) + (insumo.stock_liberado || 0) : 0;

  const confirmar = async () => {
    if (!insumo) return;
    if (!nombre) {
      setModalNombre(true);
      return;
    }
    setSaving(true);
    try {
      const { data: insActual } = await supabase
        .from('insumos')
        .select('stock_mp,stock_liberado')
        .eq('empresa_id', empresaId)
        .eq('cod', insumo.cod)
        .single();

      if (modo === 'salida') {
        if (insActual) {
          const lib = Number(insActual.stock_liberado) || 0;
          const mp = Number(insActual.stock_mp) || 0;
          let resta = qty;
          const descLib = Math.min(resta, lib);
          resta -= descLib;
          const descMp = Math.min(resta, mp);
          const { error } = await supabase
            .from('insumos')
            .update({
              stock_mp: mp - descMp,
              stock_liberado: lib - descLib,
            })
            .eq('empresa_id', empresaId)
            .eq('cod', insumo.cod);
          if (error) throw error;
        }

        const recibeTrim = recibe.trim();
        const { error: errMov } = await supabase.from('movimientos_insumos').insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: MESES_A[new Date().getMonth()],
          tipo: 'SALIDA PRODUCCION',
          codigo: insumo.cod,
          producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
          almacen: 'MP',
          cantidad: qty,
          ot: otRef.trim(),
          area,
          responsable_entrega: nombre,
          recepcion: recibeTrim || null,
          bitacora: `Salida rápida — ${nombre} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''}${otRef.trim() ? ' · OT ' + otRef.trim() : ''}`,
        });
        if (errMov) throw errMov;

        const stockRestante = Math.max(0, stockActual - qty);
        setResumen({
          msg: `${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Registrado a nombre de ${nombre} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''}${otRef.trim() ? ' · OT ' + otRef.trim() : ''} · Stock restante: ${stockRestante}`,
        });
      } else if (modo === 'entrada') {
        const mpActual = insActual ? Number(insActual.stock_mp) || 0 : 0;
        const libActual = insActual ? Number(insActual.stock_liberado) || 0 : 0;
        const { error } = await supabase
          .from('insumos')
          .update({ stock_mp: mpActual + qty })
          .eq('empresa_id', empresaId)
          .eq('cod', insumo.cod);
        if (error) throw error;

        const recibeTrim = recibe.trim();
        const { error: errMov } = await supabase.from('movimientos_insumos').insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: MESES_A[new Date().getMonth()],
          tipo: 'NUEVO INGRESO',
          codigo: insumo.cod,
          producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
          almacen: 'MP',
          cantidad: qty,
          area,
          responsable_entrega: nombre,
          recepcion: recibeTrim || nombre,
          bitacora: `Ingreso rápido — ${nombre} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''}${proveedor.trim() ? ' · Proveedor: ' + proveedor.trim() : ''}${docRef.trim() ? ' · Doc: ' + docRef.trim() : ''}`,
        });
        if (errMov) throw errMov;

        const stockNuevo = mpActual + libActual + qty;
        setResumen({
          msg: `+${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Registrado por ${nombre} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''}${proveedor.trim() ? ' · ' + proveedor.trim() : ''}${docRef.trim() ? ' · ' + docRef.trim() : ''} · Stock nuevo: ${stockNuevo}`,
        });
      } else {
        if (!otRef.trim()) {
          toast.warning('Ingresa la OT de origen');
          setSaving(false);
          return;
        }
        const mpActual = insActual ? Number(insActual.stock_mp) || 0 : 0;
        const libActual = insActual ? Number(insActual.stock_liberado) || 0 : 0;
        const { error } = await supabase
          .from('insumos')
          .update({ stock_mp: mpActual + qty })
          .eq('empresa_id', empresaId)
          .eq('cod', insumo.cod);
        if (error) throw error;

        const recibeTrim = recibe.trim();
        const { error: errMov } = await supabase.from('movimientos_insumos').insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: MESES_A[new Date().getMonth()],
          tipo: 'DEVOLUCION',
          codigo: insumo.cod,
          producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
          almacen: 'MP',
          cantidad: qty,
          ot: otRef.trim(),
          area,
          responsable_entrega: nombre,
          recepcion: recibeTrim || null,
          bitacora: `Devolución — Motivo: ${motivo} · Devolvió: ${nombre} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''}`,
        });
        if (errMov) throw errMov;

        const stockNuevo = mpActual + libActual + qty;
        setResumen({
          msg: `+${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Devuelto a stock por ${nombre} · OT ${otRef.trim()} · ${motivo} · Área: ${AREA_LABEL[area]}${recibeTrim ? ' · Recibe: ' + recibeTrim : ''} · Stock nuevo: ${stockNuevo}`,
        });
      }
      setFase('ok');
    } catch (e) {
      const err = e as Error;
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const nuevoItem = () => {
    setInsumo(null);
    setQty(1);
    setOtRef('');
    setProveedor('');
    setDocRef('');
    setMotivo('Error de picking');
    setArea('general');
    setRecibe('');
    setResumen(null);
    setFase('scan');
    procesandoRef.current = false;
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={async () => {
            await scanner.stop();
            onCerrar();
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="flex-1 text-base font-bold" style={{ color: colorAccent }}>
          {titulo}
        </h1>
        <button
          onClick={() => {
            setNombreInput(nombre);
            setModalNombre(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-card"
        >
          <User className="h-3.5 w-3.5" />
          {nombre || labelNombre}
          <Pencil className="h-3 w-3 opacity-60" />
        </button>
      </div>

      <div className="mx-auto max-w-md p-4">
        {fase === 'scan' && (
          <>
            <div
              id="adhoc-reader"
              className="mx-auto mb-3 aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-black"
            />
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-center text-sm text-accent">
              <QrCode className="mx-auto mb-1 h-5 w-5" />
              {scanMsg}
            </div>
            {scanner.error && (
              <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/15 p-3 text-center text-sm text-destructive">
                <Camera className="mx-auto mb-1 h-5 w-5" />
                <div className="font-semibold">Cámara no disponible</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{scanner.error}</div>
                <Button onClick={() => scanner.start('adhoc-reader')} size="sm" className="mt-2">
                  Reintentar
                </Button>
              </div>
            )}
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O escribe el código manualmente
            </div>
            <div className="flex gap-2">
              <Input
                value={codManual}
                onChange={(e) => setCodManual(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && cargarInsumo(codManual)}
                placeholder="Ej: MEC14"
                className="border-border bg-card"
              />
              <Button onClick={() => cargarInsumo(codManual)} className="gap-1.5">
                <KeyRound className="h-4 w-4" /> Buscar
              </Button>
            </div>
          </>
        )}

        {fase === 'confirm' && insumo && (
          <>
            <div className="mb-4 rounded-2xl border border-border bg-card p-4">
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                Código: {insumo.cod}
              </div>
              <div className="text-base font-semibold">
                {insumo.nemotecnico || insumo.descriptor_proveedor || insumo.cod}
              </div>
              <div className="mt-2 text-xs">
                {modo === 'salida' ? (
                  stockActual <= 0 ? (
                    <span className="text-destructive">
                      <AlertTriangle className="mr-1 inline h-3 w-3" /> Sin stock disponible
                    </span>
                  ) : stockActual <= 5 ? (
                    <span className="text-warning">
                      <AlertTriangle className="mr-1 inline h-3 w-3" /> Stock bajo: {stockActual} unidades
                    </span>
                  ) : (
                    <span className="text-success">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" /> Stock disponible: {stockActual} unidades
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">Stock actual: {stockActual} unidades</span>
                )}
              </div>
            </div>

            <Label className="mb-1 text-xs">Cantidad</Label>
            <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-3">
              <Button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setQty(Math.max(1, n));
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 w-24 text-center text-3xl font-bold"
              />
              <Button
                onClick={() => setQty((q) => q + 1)}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <Label className="mb-1 text-xs">
              Área que {modo === 'salida' ? 'pide' : modo === 'entrada' ? 'recibe' : 'devuelve'} el material
            </Label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as AreaBodega)}
              className="mb-3 w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
            >
              {AREAS_BODEGA.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABEL[a]}
                </option>
              ))}
            </select>

            <Label className="mb-1 text-xs">Persona que recibe</Label>
            <Input
              value={recibe}
              onChange={(e) => setRecibe(e.target.value)}
              placeholder="Nombre del que recibe (opcional)"
              className="mb-4 border-border bg-card"
            />

            {modo === 'salida' && (
              <>
                <Label className="mb-1 text-xs">OT (opcional)</Label>
                <Input
                  value={otRef}
                  onChange={(e) => setOtRef(e.target.value)}
                  placeholder="Ej: 12345"
                  className="mb-4 border-border bg-card"
                />
              </>
            )}

            {modo === 'entrada' && (
              <>
                <Label className="mb-1 text-xs">Proveedor (opcional)</Label>
                <Input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej: Meriggi"
                  className="mb-3 border-border bg-card"
                />
                <Label className="mb-1 text-xs">N° de documento (opcional)</Label>
                <Input
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="Ej: Factura 1234"
                  className="mb-4 border-border bg-card"
                />
              </>
            )}

            {modo === 'devolucion' && (
              <>
                <Label className="mb-1 text-xs">OT de origen</Label>
                <Input
                  value={otRef}
                  onChange={(e) => setOtRef(e.target.value)}
                  placeholder="Ej: 12345"
                  className="mb-3 border-border bg-card"
                />
                <Label className="mb-1 text-xs">Motivo</Label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoDevolucion)}
                  className="mb-4 w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
                >
                  {MOTIVOS_DEVOLUCION.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            )}

            <Button
              onClick={confirmar}
              disabled={
                saving ||
                (modo === 'salida' && stockActual <= 0) ||
                (modo === 'devolucion' && !otRef.trim())
              }
              className={cn(
                'mb-2 h-12 w-full gap-2 text-base',
                modo === 'salida'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : modo === 'entrada'
                    ? 'bg-success hover:bg-success/90'
                    : 'bg-warning hover:bg-warning/90',
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {modo === 'salida'
                    ? 'Confirmar salida'
                    : modo === 'entrada'
                      ? 'Confirmar ingreso'
                      : 'Confirmar devolución'}
                </>
              )}
            </Button>
            <Button onClick={nuevoItem} variant="outline" className="w-full">
              Volver a escanear
            </Button>
          </>
        )}

        {fase === 'ok' && resumen && (
          <div className="rounded-2xl border border-success/30 bg-success/15 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-success" />
            <div className="mb-1 text-lg font-bold text-foreground">{resumen.msg}</div>
            <div className="mb-4 text-xs text-muted-foreground">{resumen.sub}</div>
            <Button onClick={nuevoItem} className="w-full gap-1.5">
              <QrCode className="h-4 w-4" />{' '}
              {modo === 'salida'
                ? 'Otra salida'
                : modo === 'entrada'
                  ? 'Otra entrada'
                  : 'Otra devolución'}
            </Button>
          </div>
        )}
      </div>

      {/* Modal nombre */}
      {modalNombre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <User className="h-5 w-5 text-accent" /> ¿Quién{' '}
              {modo === 'salida' ? 'retira' : modo === 'entrada' ? 'ingresa' : 'devuelve'}?
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Este nombre se usa para todos los movimientos que registres desde este dispositivo.
              Queda guardado en el celular.
            </p>
            <Input
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
              placeholder="Tu nombre"
              autoFocus
              className="mb-3 border-border bg-secondary"
            />
            <div className="flex justify-end gap-2">
              {nombre && (
                <Button variant="outline" onClick={() => setModalNombre(false)}>
                  Cancelar
                </Button>
              )}
              <Button onClick={guardarNombre}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
