// ─────────────────────────────────────────────────────────────────────
// LA VISITA — lo que queda registrado de haber estado en la casa del cliente:
// el video, el informe redactado a partir de lo que se habló, el resumen de
// visita punto por punto y la firma.
//
// El informe lo propone la IA y lo corrige el vendedor: lo que vale es lo que
// queda escrito acá, no lo que dictó el modelo.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  ImagePlus,
  ListTree,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { SeccionColapsable } from '@/components/cotizador/editorPano/controles';
import { FirmaCliente } from './FirmaCliente';
import {
  AudioNoDecodificable,
  duracionWavSegundos,
  extraerAudioWav,
} from '@/modules/visita/audio';
import { comprimirFoto, MAX_FOTOS_VISITA } from '@/modules/visita/imagen';
import { capturarUbicacion } from '@/modules/visita/geo';
import {
  borrarArchivoVisita,
  generarInformeVisita,
  subirAudioVisita,
  subirFirmaVisita,
  subirFotoVisita,
  subirVideoVisita,
  urlFirmadaVisita,
  urlsFirmadasVisita,
} from '@/modules/visita/visitaStore';
import { useChecklistVisita } from '@/modules/visita/checklistVisitaStore';
import { pendientesChecklist, preguntasActivas } from '@/modules/visita/checklistVisita';
import { esqueletoInforme, tieneOscuridad } from '@/modules/visita/esqueletoInforme';
import { textoBloques } from '@/modules/visita/bloquesInforme';
import { useBloquesInforme } from '@/modules/visita/bloquesInformeStore';
import type { FotoVisita, GeoFirma, VisitaTerreno } from '@/modules/ots/types';
import type { Ventana } from '@/modules/cotizador/types';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

type Props = {
  otId: string;
  empresaId: string | null;
  visita: VisitaTerreno;
  /** Las cortinas de la OT: de acá sale el esqueleto del informe. */
  ventanas?: Ventana[];
  /** Tipos de cortina del catálogo (para reconocer los sistemas de oscuridad). */
  tipos?: readonly TipoCortina[];
  guardando: boolean;
  onGuardar: (v: VisitaTerreno) => Promise<void>;
};

export function InformeVisita({
  otId,
  empresaId,
  visita,
  ventanas,
  tipos,
  guardando,
  onGuardar,
}: Props) {
  const { checklist, loading: cargandoChecklist } = useChecklistVisita();
  const { bloques } = useBloquesInforme();
  const [borrador, setBorrador] = useState<VisitaTerreno>(visita);
  const [subiendo, setSubiendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [paso, setPaso] = useState('');
  const [urlVideo, setUrlVideo] = useState<string | null>(null);
  const [urlFirma, setUrlFirma] = useState<string | null>(null);
  const [urlFotos, setUrlFotos] = useState<Record<string, string>>({});

  // Lo guardado manda: si otra pestaña grabó la visita, se refleja acá.
  useEffect(() => setBorrador(visita), [visita]);

  // Los archivos viven en un bucket privado: hay que pedir una URL firmada.
  useEffect(() => {
    let vivo = true;
    if (borrador.videoPath) {
      urlFirmadaVisita(borrador.videoPath).then((u) => vivo && setUrlVideo(u));
    } else setUrlVideo(null);
    return () => {
      vivo = false;
    };
  }, [borrador.videoPath]);

  useEffect(() => {
    let vivo = true;
    if (borrador.firmaPath) {
      urlFirmadaVisita(borrador.firmaPath).then((u) => vivo && setUrlFirma(u));
    } else setUrlFirma(null);
    return () => {
      vivo = false;
    };
  }, [borrador.firmaPath]);

  // Las miniaturas se firman TODAS JUNTAS: una llamada, no una por foto.
  const clavesFotos = (borrador.fotos ?? []).map((f) => f.path).join('|');
  useEffect(() => {
    let vivo = true;
    const paths = clavesFotos ? clavesFotos.split('|') : [];
    if (paths.length === 0) {
      setUrlFotos({});
      return;
    }
    urlsFirmadasVisita(paths).then((m) => vivo && setUrlFotos(m));
    return () => {
      vivo = false;
    };
  }, [clavesFotos]);

  const activas = useMemo(() => preguntasActivas(checklist), [checklist]);
  const faltanRespuestas = pendientesChecklist(checklist, borrador.checklist);
  const firmada = !!borrador.firmaPath;
  const fotos = borrador.fotos ?? [];

  const parche = (p: Partial<VisitaTerreno>) => setBorrador((v) => ({ ...v, ...p }));

  // El esqueleto sale de la orden, no del modelo: tipo de cortina, tela,
  // accesorios y caída ya están cargados dato por dato. Al modelo solo se le
  // pide lo que aporta el video — lo conversado.
  const armarEsqueleto = useCallback(
    () => esqueletoInforme(ventanas, { tipos }),
    [ventanas, tipos],
  );

  /** Los textos fijos de Admin que cierran el informe (rodapié, oscuridad…). */
  const armarBloques = useCallback(
    () => textoBloques(bloques, tieneOscuridad(ventanas, tipos)),
    [bloques, ventanas, tipos],
  );

  const armarDesdeLaOrden = async () => {
    const esqueleto = armarEsqueleto();
    if (!esqueleto) {
      toast.error('Esta orden todavía no tiene cortinas cargadas.');
      return;
    }
    if (
      (borrador.informe ?? '').trim() &&
      !(await confirmar('Esto reemplaza el informe escrito. ¿Continuar?'))
    ) {
      return;
    }
    parche({ informe: [esqueleto, armarBloques()].filter(Boolean).join('\n\n') });
    toast.success('Informe armado con los datos de la orden — agrégale lo que conversaste');
  };

  const copiarInforme = async () => {
    const texto = (borrador.informe ?? '').trim();
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Informe copiado — pégalo en el correo');
    } catch {
      toast.error('El navegador no dejó copiar. Selecciona el texto y usa Ctrl+C.');
    }
  };

  const subirVideo = async (file: File) => {
    if (!empresaId) return;
    setSubiendo(true);
    setPaso('Subiendo el video…');
    try {
      const videoPath = await subirVideoVisita(empresaId, otId, file);
      const nueva = { ...borrador, videoPath };
      setBorrador(nueva);
      await onGuardar(nueva);
      toast.success('Video guardado');
    } catch (e) {
      toast.error('No se pudo subir el video: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
      setPaso('');
    }
  };

  const subirFotos = async (files: File[]) => {
    if (!empresaId || files.length === 0) return;
    const cupo = MAX_FOTOS_VISITA - fotos.length;
    if (cupo <= 0) {
      toast.error(`Ya hay ${MAX_FOTOS_VISITA} fotos en esta visita.`);
      return;
    }
    const aSubir = files.slice(0, cupo);
    if (aSubir.length < files.length) {
      toast.warning(`Solo caben ${cupo} foto(s) más: se suben las primeras.`);
    }
    setSubiendo(true);
    const nuevas: FotoVisita[] = [];
    try {
      // Secuencial a propósito: en terreno, con datos móviles, diez subidas en
      // paralelo se pelean el ancho de banda y terminan más lento que en fila.
      for (let i = 0; i < aSubir.length; i++) {
        setPaso(`Subiendo foto ${i + 1}/${aSubir.length}…`);
        const { blob, contentType, ext } = await comprimirFoto(aSubir[i]);
        const path = await subirFotoVisita(empresaId, otId, blob, ext, contentType);
        nuevas.push({ path, subidaEl: new Date().toISOString() });
      }
      const nueva = { ...borrador, fotos: [...fotos, ...nuevas] };
      setBorrador(nueva);
      await onGuardar(nueva);
      toast.success(`${nuevas.length} foto(s) guardada(s)`);
    } catch (e) {
      // Lo que alcanzó a subir NO se pierde: se guarda igual.
      if (nuevas.length > 0) {
        const parcial = { ...borrador, fotos: [...fotos, ...nuevas] };
        setBorrador(parcial);
        await onGuardar(parcial).catch(() => undefined);
      }
      toast.error('No se pudo subir todo: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
      setPaso('');
    }
  };

  const borrarFoto = async (foto: FotoVisita) => {
    if (!(await confirmar('¿Borrar esta foto de la visita?'))) return;
    setSubiendo(true);
    try {
      await borrarArchivoVisita(foto.path);
      const nueva = { ...borrador, fotos: fotos.filter((f) => f.path !== foto.path) };
      setBorrador(nueva);
      await onGuardar(nueva);
      toast.success('Foto borrada');
    } catch (e) {
      toast.error('No se pudo borrar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
    }
  };

  const notaFoto = (path: string, nota: string) =>
    parche({ fotos: fotos.map((f) => (f.path === path ? { ...f, nota } : f)) });

  const generarInforme = async (file: File | null) => {
    if (!empresaId) return;
    setGenerando(true);
    try {
      // El video pesa cientos de megas; lo que se manda a transcribir es solo
      // su audio, sacado acá mismo en el navegador.
      setPaso('Sacando el audio del video…');
      const wav = await extraerAudioWav(file ?? (await descargar(urlVideo)));
      const minutos = duracionWavSegundos(wav.size) / 60;
      setPaso(`Subiendo ${minutos.toFixed(1)} min de audio…`);
      const audioPath = await subirAudioVisita(empresaId, otId, wav);
      setPaso('Transcribiendo y redactando el informe…');
      const { transcripcion, informe } = await generarInformeVisita(
        otId,
        audioPath,
        armarEsqueleto(),
      );
      // Los bloques fijos los pega la app, no el modelo: son compromisos
      // comerciales que deben salir palabra por palabra como los dejó Admin.
      const nueva: VisitaTerreno = {
        ...borrador,
        audioPath,
        transcripcion,
        informe: [informe, armarBloques()].filter(Boolean).join('\n\n'),
        informeGeneradoEl: new Date().toISOString(),
      };
      setBorrador(nueva);
      await onGuardar(nueva);
      toast.success('Informe redactado — revísalo y corrige lo que haga falta');
    } catch (e) {
      if (e instanceof AudioNoDecodificable) toast.error(e.message);
      else toast.error('No se pudo generar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerando(false);
      setPaso('');
    }
  };

  const firmar = async (png: Blob, nombre: string) => {
    if (!empresaId) return;
    setSubiendo(true);
    try {
      // La ubicación se pide ANTES de subir, pero NO condiciona nada: si el
      // cliente no da el permiso o no hay señal, se anota el motivo y la firma
      // se guarda igual. Perder una firma por un problema de GPS sería peor
      // que no tener la ubicación.
      setPaso('Registrando la ubicación…');
      let firmaGeo: GeoFirma | undefined;
      let firmaGeoMotivo: string | undefined;
      try {
        firmaGeo = await capturarUbicacion();
      } catch (e) {
        firmaGeoMotivo = e instanceof Error ? e.message : 'No se pudo obtener la ubicación';
      }
      setPaso('Guardando la firma…');
      const firmaPath = await subirFirmaVisita(empresaId, otId, png);
      const nueva: VisitaTerreno = {
        ...borrador,
        firmaPath,
        firmadoEl: new Date().toISOString(),
        firmanteNombre: nombre || undefined,
        firmaGeo,
        firmaGeoMotivo,
      };
      setBorrador(nueva);
      await onGuardar(nueva);
      toast.success(firmaGeo ? 'Firma guardada con su ubicación' : 'Firma guardada');
      if (firmaGeoMotivo) toast.warning(`Sin ubicación: ${firmaGeoMotivo.toLowerCase()}`);
    } catch (e) {
      toast.error('No se pudo guardar la firma: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
      setPaso('');
    }
  };

  const ocupado = subiendo || generando || guardando;

  return (
    <div className="space-y-4">
      {/* ── Video ── */}
      <section className="rounded-md border border-border bg-card/40 p-4">
        <h4 className="mb-1 text-sm font-semibold">Video de la visita</h4>
        <p className="mb-3 text-[0.72rem] text-muted-foreground">
          Graba el recorrido explicando lo que conversaste con el cliente. De ahí sale el
          borrador del informe: solo viaja el audio, no el video entero.
        </p>
        {urlVideo && (
          <video src={urlVideo} controls className="mb-3 max-h-64 w-full rounded border border-border" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-card',
              ocupado && 'pointer-events-none opacity-50',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {borrador.videoPath ? 'Reemplazar video' : 'Subir video'}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) subirVideo(f);
              }}
            />
          </label>
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20',
              ocupado && 'pointer-events-none opacity-50',
            )}
            title="Saca el audio del video, lo transcribe y redacta el borrador del informe"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar informe con IA
            <input
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) generarInforme(f);
              }}
            />
          </label>
          {borrador.videoPath && !generando && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={ocupado}
              onClick={() => generarInforme(null)}
              title="Usa el video que ya está subido"
            >
              <Video className="h-3.5 w-3.5" /> Usar el video subido
            </Button>
          )}
          {paso && (
            <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {paso}
            </span>
          )}
        </div>
      </section>

      {/* ── Fotos ── */}
      <section className="rounded-md border border-border bg-card/40 p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold">Fotos de la visita</h4>
          {fotos.length > 0 && (
            <span className="text-[0.65rem] text-muted-foreground">
              {fotos.length}/{MAX_FOTOS_VISITA}
            </span>
          )}
        </div>
        <p className="mb-3 text-[0.72rem] text-muted-foreground">
          Respaldo de cómo estaba cada ventana: muros, cornisas, enchufes, lo que convenga dejar
          registrado. Quedan en la orden — no salen en la cotización del cliente.
        </p>
        {fotos.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((f) => (
              <li key={f.path} className="rounded border border-border bg-card p-1.5">
                {urlFotos[f.path] ? (
                  <a href={urlFotos[f.path]} target="_blank" rel="noopener noreferrer">
                    <img
                      src={urlFotos[f.path]}
                      alt={f.nota || 'Foto de la visita'}
                      loading="lazy"
                      className="h-28 w-full rounded object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-28 w-full items-center justify-center rounded bg-muted/30">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1">
                  <input
                    value={f.nota ?? ''}
                    onChange={(e) => notaFoto(f.path, e.target.value)}
                    placeholder="Nota…"
                    className="min-w-0 flex-1 rounded border border-border bg-card px-1.5 py-1 text-[0.68rem]"
                  />
                  <button
                    type="button"
                    onClick={() => borrarFoto(f)}
                    disabled={ocupado}
                    title="Borrar esta foto"
                    className="shrink-0 rounded border border-border p-1 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-card',
            (ocupado || fotos.length >= MAX_FOTOS_VISITA) && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Agregar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (fs.length) subirFotos(fs);
            }}
          />
        </label>
      </section>

      {/* ── Informe ── */}
      <section className="rounded-md border border-border bg-card/40 p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold">Informe cliente</h4>
          {borrador.informeGeneradoEl && (
            <span className="text-[0.65rem] text-muted-foreground">
              Redactado el {new Date(borrador.informeGeneradoEl).toLocaleString('es-CL')}
            </span>
          )}
        </div>
        <p className="mb-2 text-[0.72rem] text-muted-foreground">
          Lo que vale es lo que quede escrito acá. Corrige, agrega o borra lo que quieras.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={ocupado || firmada}
            onClick={armarDesdeLaOrden}
            title="Arma las secciones por habitación con los datos de la orden, sin IA"
          >
            <ListTree className="h-3.5 w-3.5" /> Armar desde la orden
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={!(borrador.informe ?? '').trim()}
            onClick={copiarInforme}
            title="Copia el informe para pegarlo en el correo"
          >
            <ClipboardCopy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <textarea
          value={borrador.informe ?? ''}
          onChange={(e) => parche({ informe: e.target.value })}
          rows={12}
          disabled={firmada}
          placeholder="Escríbelo a mano, o genéralo desde el video."
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
        />
        {firmada && (
          <p className="mt-1 text-[0.68rem] text-amber-500">
            El cliente ya firmó este informe. Para cambiarlo, vuelve a pedir la firma.
          </p>
        )}
        {borrador.transcripcion && (
          <div className="mt-3">
            <SeccionColapsable title="Lo que se dijo en el video (transcripción)">
              <p className="whitespace-pre-wrap text-[0.72rem] leading-relaxed text-muted-foreground">
                {borrador.transcripcion}
              </p>
            </SeccionColapsable>
          </div>
        )}
      </section>

      {/* ── Resumen de visita ── */}
      <section className="rounded-md border border-border bg-card/40 p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold">Resumen de visita</h4>
          {faltanRespuestas > 0 && (
            <span className="text-[0.65rem] text-amber-500">
              {faltanRespuestas} sin responder
            </span>
          )}
        </div>
        <p className="mb-3 text-[0.72rem] text-muted-foreground">
          Lo que hay que dejar conversado antes de irse. Se edita en Admin → Cotizador.
        </p>
        {cargandoChecklist ? (
          <p className="text-xs text-muted-foreground">Cargando preguntas…</p>
        ) : (
          <ul className="space-y-2">
            {activas.map((p, i) => {
              const r = borrador.checklist?.[p.id];
              const setR = (respuesta: boolean | null) =>
                parche({
                  checklist: {
                    ...(borrador.checklist ?? {}),
                    [p.id]: { ...(r ?? {}), respuesta },
                  },
                });
              return (
                <li key={p.id} className="rounded border border-border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.78rem] font-medium">
                        {i + 1}. {p.titulo}
                      </p>
                      <p className="mt-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                        {p.pregunta}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {(
                        [
                          { v: true, t: 'SÍ' },
                          { v: false, t: 'NO' },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.t}
                          type="button"
                          onClick={() => setR(r?.respuesta === o.v ? null : o.v)}
                          className={cn(
                            'rounded border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors',
                            r?.respuesta === o.v
                              ? o.v
                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                                : 'border-destructive/50 bg-destructive/15 text-destructive'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {r?.respuesta === false && (
                    <input
                      value={r?.notas ?? ''}
                      onChange={(e) =>
                        parche({
                          checklist: {
                            ...(borrador.checklist ?? {}),
                            [p.id]: { respuesta: false, notas: e.target.value },
                          },
                        })
                      }
                      placeholder="¿Qué pasó? (queda en la OT)"
                      className="mt-2 w-full rounded border border-border bg-card px-2 py-1 text-[0.72rem]"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Firma ── */}
      <section className="rounded-md border border-border bg-card/40 p-4">
        <h4 className="mb-1 text-sm font-semibold">Firma del cliente</h4>
        <p className="mb-3 text-[0.72rem] text-muted-foreground">
          Con la firma, el cliente deja constancia de que entendió lo explicado en la visita.
        </p>
        <FirmaCliente
          urlFirma={urlFirma}
          firmadoEl={borrador.firmadoEl}
          firmanteNombre={borrador.firmanteNombre}
          geo={borrador.firmaGeo}
          geoMotivo={borrador.firmaGeoMotivo}
          guardando={subiendo}
          onFirmar={firmar}
          onRehacer={() =>
            // La ubicación pertenece a la firma que se está descartando: se va con ella.
            parche({
              firmaPath: undefined,
              firmadoEl: undefined,
              firmanteNombre: undefined,
              firmaGeo: undefined,
              firmaGeoMotivo: undefined,
            })
          }
        />
      </section>

      <div className="flex justify-end">
        <Button className="gap-1" disabled={ocupado} onClick={() => onGuardar(borrador)}>
          {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar visita
        </Button>
      </div>
    </div>
  );
}

/** Baja el video ya subido (URL firmada) para volver a sacarle el audio. */
async function descargar(url: string | null): Promise<Blob> {
  if (!url) throw new Error('No hay video subido en esta OT');
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo leer el video guardado');
  return res.blob();
}
