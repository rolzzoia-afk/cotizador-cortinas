// La cámara del teléfono, abierta DENTRO de la app.
//
// En el resto del sistema una foto se saca con `<input type="file" capture>`,
// que abre la cámara nativa del teléfono. Eso está bien para una foto suelta
// —la factura, la foto del insumo—, pero acá se sacan CINCO seguidas al enseñar
// un artículo, y en el reconocimiento se vuelve a intentar hasta acertar. Con
// el input hay que salir de la app y volver en cada toma.
//
// Por eso, y solo acá, se usa `getUserMedia`: el video se ve dentro de la
// pantalla y capturar es un clic. Si el navegador no lo permite (permiso
// denegado, un equipo sin cámara, http sin candado), `soportada` queda en false
// y la pantalla ofrece el input de siempre. Nunca se queda sin camino.
//
// Lo que captura es SIEMPRE un JPEG dibujado en un canvas: eso de paso saca del
// medio el problema del HEIC del iPhone, que el motor de huellas no sabe leer.

import { useCallback, useEffect, useRef, useState } from 'react';

const RESTRICCIONES: MediaStreamConstraints = {
  video: {
    // La de atrás: la de adelante enfoca a 30 cm y no sirve para un tubo.
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

function motivoDeError(e: unknown): string {
  const nombre = (e as { name?: string })?.name ?? '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'No diste permiso para usar la cámara. Puedes sacar la foto con el botón de abajo.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'Este equipo no tiene una cámara que se pueda usar.';
  }
  if (nombre === 'NotReadableError') {
    return 'La cámara está ocupada por otra aplicación.';
  }
  return 'No se pudo abrir la cámara.';
}

export type Camara = {
  videoRef: React.RefObject<HTMLVideoElement>;
  /** ¿Este navegador puede abrir la cámara dentro de la app? */
  soportada: boolean;
  activa: boolean;
  error: string | null;
  iniciar: () => Promise<void>;
  detener: () => void;
  /** Un JPEG del cuadro que se ve ahora. `null` si la cámara no está lista. */
  capturar: () => Promise<Blob | null>;
};

export function useCamara(): Camara {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activa, setActiva] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soportada =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const detener = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActiva(false);
  }, []);

  const iniciar = useCallback(async () => {
    if (!soportada) {
      setError('Este navegador no deja abrir la cámara dentro de la app.');
      return;
    }
    if (streamRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(RESTRICCIONES);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // `playsInline` va en el JSX: sin él, iOS abre el video a pantalla
        // completa y tapa la pantalla.
        await videoRef.current.play().catch(() => undefined);
      }
      setActiva(true);
    } catch (e) {
      // Si la cámara de atrás no existe (un notebook), se prueba con cualquiera
      // antes de darse por vencido.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setActiva(true);
      } catch {
        setError(motivoDeError(e));
        setActiva(false);
      }
    }
  }, [soportada]);

  const capturar = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Calidad alta acá: el achicado de verdad lo hace `prepararParaEmbedding`,
    // que es el único lugar donde se decide el tamaño final.
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  // Apagar la cámara al salir NO es opcional: el led queda prendido y el
  // teléfono se calienta.
  useEffect(() => detener, [detener]);

  return { videoRef, soportada, activa, error, iniciar, detener, capturar };
}
