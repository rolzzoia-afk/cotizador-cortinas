// Leer el QR de una foto ya sacada (no de la cámara en vivo).
//
// Las etiquetas que imprime la app traen un QR con el código del artículo
// (`INS:` / `TEL:`). Si aparece en la foto, no hay nada que reconocer: el
// artículo está diciendo su nombre. Se intenta SIEMPRE primero porque se
// resuelve en el teléfono, sin red y sin costo.
//
// Usa el mismo `html5-qrcode` que el escáner de bodega (`useQRScanner`), pero
// su modo archivo. No pueden convivir en pantalla: la librería necesita un
// elemento montado y la cámara solo la puede tener uno.

import { Html5Qrcode } from 'html5-qrcode';

/** El texto del QR, o `null` si la foto no tiene ninguno legible. */
export async function leerQRDeFoto(archivo: File | Blob): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const contenedor = document.createElement('div');
  contenedor.id = `qr-foto-${Date.now()}`;
  contenedor.style.display = 'none';
  document.body.appendChild(contenedor);
  try {
    const lector = new Html5Qrcode(contenedor.id);
    const file =
      archivo instanceof File ? archivo : new File([archivo], 'foto.jpg', { type: 'image/jpeg' });
    const r = await lector.scanFileV2(file, false);
    return r?.decodedText?.trim() || null;
  } catch {
    // Que no haya QR es lo normal, no un error: se sigue con el reconocimiento
    // por parecido.
    return null;
  } finally {
    contenedor.remove();
  }
}
