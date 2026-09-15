// El visor: el video de la cámara con el botón de captura, y el camino de
// respaldo cuando la cámara no se puede abrir dentro de la app.
//
// Se usa igual al enseñar un artículo y al reconocerlo, para que la foto de
// referencia y la de la consulta salgan del mismo encuadre.

import { useEffect, useRef } from 'react';
import { Camera, Images, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamara } from '@/modules/inventario/useCamara';

export function VistaCamara({
  onFoto,
  ayuda,
  trabajando,
  etiquetaBoton = 'Sacar la foto',
  cuadrado,
}: {
  /** Recibe el JPEG capturado, venga del video o del archivo elegido. */
  onFoto: (foto: Blob) => void;
  /** La línea que explica qué hay que encuadrar. */
  ayuda?: string;
  /** Mientras se procesa la anterior, no se deja disparar de nuevo. */
  trabajando?: boolean;
  etiquetaBoton?: string;
  /** Las telas se recortan cuadradas: el visor lo muestra así para que se vea
   *  lo mismo que se va a usar. */
  cuadrado?: boolean;
}) {
  const camara = useCamara();
  const archivoRef = useRef<HTMLInputElement>(null);
  const { iniciar } = camara;

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  const disparar = async () => {
    const foto = await camara.capturar();
    if (foto) onFoto(foto);
  };

  return (
    <div className="space-y-3">
      <div
        className={
          'relative overflow-hidden rounded-lg border border-border bg-black ' +
          (cuadrado ? 'aspect-square' : 'aspect-[4/3]')
        }
      >
        <video
          ref={camara.videoRef}
          // `playsInline` y `muted`: sin ellos iOS abre el video a pantalla
          // completa y tapa todo.
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!camara.activa && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/80">
            {camara.error ?? 'Abriendo la cámara…'}
          </div>
        )}
        {cuadrado && camara.activa && (
          <div className="pointer-events-none absolute inset-6 rounded border-2 border-dashed border-white/50" />
        )}
      </div>

      {ayuda && <p className="text-center text-xs text-muted-foreground">{ayuda}</p>}

      <div className="flex flex-col gap-2">
        {camara.activa ? (
          <Button className="h-12 w-full gap-2" onClick={disparar} disabled={trabajando}>
            <Camera className="h-5 w-5" /> {etiquetaBoton}
          </Button>
        ) : (
          camara.error && (
            <Button variant="outline" className="h-12 w-full gap-2" onClick={() => void camara.iniciar()}>
              <RefreshCw className="h-4 w-4" /> Reintentar con la cámara
            </Button>
          )
        )}

        {/* El camino de siempre, por si la cámara no se pudo abrir (o la persona
            prefiere una foto de la galería). */}
        <input
          ref={archivoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFoto(f);
            e.target.value = '';
          }}
        />
        <Button
          variant="outline"
          className="h-11 w-full gap-2"
          onClick={() => archivoRef.current?.click()}
          disabled={trabajando}
        >
          <Images className="h-4 w-4" />
          {camara.activa ? 'Usar una foto guardada' : 'Sacar la foto con la cámara del teléfono'}
        </Button>
      </div>
    </div>
  );
}

export default VistaCamara;
