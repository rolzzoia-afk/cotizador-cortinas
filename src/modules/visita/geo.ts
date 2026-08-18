// ─────────────────────────────────────────────────────────────────────
// DÓNDE SE FIRMÓ.
//
// Al momento de la firma se guarda la ubicación del teléfono como RESPALDO: si
// más adelante el cliente discute la visita, queda la firma y el lugar donde se
// dio.
//
// Principio de diseño: la ubicación NUNCA bloquea la firma. Si el cliente no da
// el permiso, o está en un subterráneo sin señal, la firma se guarda igual y se
// registra el motivo — que también es constancia de lo que pasó.
//
// Todo lo que da formato es puro; lo único que toca el navegador es
// `capturarUbicacion`.
// ─────────────────────────────────────────────────────────────────────
import type { GeoFirma } from '@/modules/ots/types';

/** Cuánto se espera al GPS antes de darse por vencido. */
export const TIMEOUT_GEO_MS = 8000;

/**
 * Motivo legible de por qué no se pudo obtener la ubicación.
 *
 * Los códigos son los de `GeolocationPositionError`: 1 PERMISSION_DENIED,
 * 2 POSITION_UNAVAILABLE, 3 TIMEOUT. Se traducen acá para que el texto quede
 * guardado en la OT en español y no un número que nadie va a interpretar
 * dentro de un año.
 */
export function motivoGeoError(code: number | undefined): string {
  switch (code) {
    case 1:
      return 'El cliente no dio permiso de ubicación';
    case 2:
      return 'Sin señal de GPS en el lugar';
    case 3:
      return 'El GPS demoró demasiado en responder';
    default:
      return 'No se pudo obtener la ubicación';
  }
}

/** Coordenadas legibles en es-CL: «-33,44821, -70,66271 · ±12 m». */
export function formatoGeo(geo: GeoFirma): string {
  const n = (v: number) => v.toFixed(5).replace('.', ',');
  const base = `${n(geo.lat)}, ${n(geo.lng)}`;
  return geo.precisionM ? `${base} · ±${Math.round(geo.precisionM)} m` : base;
}

/** Link al mapa para ver el punto donde se firmó. */
export function urlMapaGeo(geo: GeoFirma): string {
  return `https://www.google.com/maps?q=${geo.lat},${geo.lng}`;
}

/**
 * Pide la ubicación actual del dispositivo.
 *
 * Rechaza con un Error cuyo mensaje YA es el motivo legible: quien llama lo
 * guarda tal cual en `firmaGeoMotivo`. Requiere HTTPS (producción y localhost
 * lo cumplen; una IP de red local por http no).
 */
export function capturarUbicacion(timeoutMs: number = TIMEOUT_GEO_MS): Promise<GeoFirma> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Este navegador no entrega la ubicación'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisionM:
            typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
          capturadaEl: new Date().toISOString(),
        }),
      (err) => reject(new Error(motivoGeoError(err?.code))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
