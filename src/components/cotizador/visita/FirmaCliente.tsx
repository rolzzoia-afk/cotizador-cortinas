// La firma del cliente, trazada con el dedo en el celular o con el mouse.
// Se guarda como PNG en el bucket privado `visitas`, junto con la ubicación
// donde se dio (respaldo por si el cliente después discute la visita).
import { useEffect, useRef, useState } from 'react';
import { Eraser, Loader2, MapPin, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatoGeo, urlMapaGeo } from '@/modules/visita/geo';
import type { GeoFirma } from '@/modules/ots/types';

type Props = {
  /** Firma ya guardada: se muestra en vez del lienzo. */
  urlFirma?: string | null;
  firmadoEl?: string;
  firmanteNombre?: string;
  /** Dónde se firmó, si el teléfono la entregó. */
  geo?: GeoFirma;
  /** Por qué no hay ubicación (permiso denegado, sin señal…). */
  geoMotivo?: string;
  guardando: boolean;
  onFirmar: (png: Blob, nombre: string) => void;
  onRehacer: () => void;
};

/** Alto del lienzo en px CSS; el ancho se estira al contenedor. */
const ALTO = 180;

export function FirmaCliente({
  urlFirma,
  firmadoEl,
  firmanteNombre,
  geo,
  geoMotivo,
  guardando,
  onFirmar,
  onRehacer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [nombre, setNombre] = useState(firmanteNombre ?? '');

  // El lienzo se dimensiona en píxeles REALES (dpr) para que el trazo no salga
  // pixelado en un celular; el CSS lo estira al ancho disponible.
  useEffect(() => {
    if (urlFirma) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      const ancho = canvas.clientWidth || 480;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(ALTO * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [urlFirma]);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque sin arrastre igual deja marca: firmar un punto es válido.
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
    setTieneTrazo(true);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminar = () => {
    dibujando.current = false;
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  };

  const guardar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onFirmar(blob, nombre.trim());
    }, 'image/png');
  };

  if (urlFirma) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border bg-white p-2">
          <img src={urlFirma} alt="Firma del cliente" className="mx-auto max-h-40" />
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Firmado{firmanteNombre ? ` por ${firmanteNombre}` : ''}
          {firmadoEl ? ` el ${new Date(firmadoEl).toLocaleString('es-CL')}` : ''}.
        </p>
        {geo ? (
          <p className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {formatoGeo(geo)}
            <a
              href={urlMapaGeo(geo)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              Ver en el mapa
            </a>
          </p>
        ) : (
          geoMotivo && (
            <p className="flex items-center gap-1.5 text-[0.7rem] text-amber-500">
              <MapPin className="h-3 w-3 shrink-0" /> Sin ubicación: {geoMotivo.toLowerCase()}.
            </p>
          )
        )}
        <Button size="sm" variant="outline" className="gap-1" onClick={onRehacer}>
          <PenLine className="h-3.5 w-3.5" /> Firmar de nuevo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-w-sm">
        <Label>Nombre de quien firma</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellido"
        />
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: ALTO, touchAction: 'none' }}
        className="w-full cursor-crosshair rounded-md border border-dashed border-border bg-white"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={limpiar} disabled={!tieneTrazo}>
          <Eraser className="h-3.5 w-3.5" /> Borrar
        </Button>
        <Button size="sm" className="gap-1" onClick={guardar} disabled={!tieneTrazo || guardando}>
          {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
          Guardar firma
        </Button>
        <span className="text-[0.68rem] text-muted-foreground">
          Firma con el dedo sobre el recuadro.
        </span>
      </div>
      {/* El cliente tiene derecho a saber que se registra dónde firma. */}
      <p className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        Al guardar la firma se registra la ubicación como respaldo. Si el teléfono no la
        entrega, la firma se guarda igual.
      </p>
    </div>
  );
}
