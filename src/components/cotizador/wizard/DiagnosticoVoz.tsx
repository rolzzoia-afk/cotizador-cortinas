// El PROBADOR del asistente de voz. Corre en el aparato del vendedor y muestra
// en pantalla, paso por paso, qué anda y qué no: si el navegador trae el
// reconocedor, si el permiso está dado, si el micrófono abre, si el parlante
// suena y qué eventos dispara el reconocedor en vivo. Nació porque «no me
// escucha» en un teléfono ajeno no se puede depurar de otra forma: acá el
// vendedor toca UN botón y manda la captura.
//
// A propósito usa las APIs del navegador A PELO (no los envoltorios de
// webSpeech.ts): la gracia es ver la verdad cruda del aparato.
import { useEffect, useRef, useState } from 'react';
import { ClipboardCopy, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Linea = { t: string; texto: string; tipo: 'ok' | 'mal' | 'info' };

type ReconocedorCrudo = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DiagnosticoVoz({ onCerrar }: { onCerrar: () => void }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const t0 = useRef(0);
  const vivoRef = useRef(true);
  const recRef = useRef<ReconocedorCrudo | null>(null);

  useEffect(
    () => () => {
      vivoRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* nada */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* nada */
      }
    },
    [],
  );

  const log = (texto: string, tipo: Linea['tipo'] = 'info') => {
    if (!vivoRef.current) return;
    const seg = ((performance.now() - t0.current) / 1000).toFixed(1);
    setLineas((ls) => [...ls, { t: `${seg}s`, texto, tipo }]);
  };

  const probar = async () => {
    setLineas([]);
    setCorriendo(true);
    t0.current = performance.now();
    const w = window as Window & {
      SpeechRecognition?: new () => ReconocedorCrudo;
      webkitSpeechRecognition?: new () => ReconocedorCrudo;
    };

    // ── 1. El navegador ──
    log(`Navegador: ${navigator.userAgent.slice(0, 90)}`);
    log(
      `Página: ${location.protocol}//${location.host}`,
      location.protocol === 'https:' ? 'ok' : 'mal',
    );
    if (location.protocol !== 'https:') {
      log('Sin https el navegador NO entrega el micrófono.', 'mal');
    }

    // ── 2. Las APIs ──
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    log(Ctor ? 'Reconocedor de voz: SÍ existe' : 'Reconocedor de voz: NO existe en este navegador', Ctor ? 'ok' : 'mal');
    const synth = window.speechSynthesis;
    log(synth ? 'Parlante (síntesis): SÍ existe' : 'Parlante (síntesis): NO existe', synth ? 'ok' : 'mal');
    if (synth) {
      let voces = synth.getVoices();
      if (voces.length === 0) {
        await esperar(600);
        voces = synth.getVoices();
      }
      const es = voces.filter((v) => (v.lang || '').toLowerCase().startsWith('es'));
      log(
        `Voces cargadas: ${voces.length} (${es.length} en castellano${es[0] ? `; ej: ${es[0].name}` : ''})`,
        voces.length > 0 ? 'ok' : 'mal',
      );
    }

    // ── 3. El permiso ──
    try {
      const p = await navigator.permissions?.query?.({ name: 'microphone' as PermissionName });
      if (p) {
        log(
          `Permiso del micrófono según el navegador: ${p.state.toUpperCase()}`,
          p.state === 'granted' ? 'ok' : p.state === 'denied' ? 'mal' : 'info',
        );
      } else {
        log('Este navegador no informa el estado del permiso.');
      }
    } catch {
      log('Este navegador no informa el estado del permiso.');
    }

    // ── 4. Abrir el micrófono de verdad ──
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const pista = stream.getAudioTracks()[0];
        log(`Micrófono ABIERTO: «${pista?.label || 'sin nombre'}»`, 'ok');
        for (const tr of stream.getTracks()) tr.stop();
      } catch (e) {
        const err = e as { name?: string; message?: string };
        log(`El micrófono NO abrió: ${err?.name || '?'} — ${err?.message || ''}`, 'mal');
        if (err?.name === 'NotAllowedError') {
          log('Permiso negado o bloqueado (por el sitio, por Chrome o por el teléfono).', 'mal');
        }
        if (err?.name === 'NotFoundError') log('El aparato no encuentra ningún micrófono.', 'mal');
        if (err?.name === 'NotReadableError') log('Otra aplicación tiene tomado el micrófono.', 'mal');
      }
    } else {
      log('Este navegador no permite pedir el micrófono (getUserMedia).', 'mal');
    }

    // ── 5. El parlante en vivo ──
    if (synth) {
      await new Promise<void>((fin) => {
        let cerrado = false;
        const cerrar = (msg: string, tipo: Linea['tipo']) => {
          if (cerrado) return;
          cerrado = true;
          log(msg, tipo);
          fin();
        };
        try {
          synth.cancel();
          const u = new SpeechSynthesisUtterance('Probando el parlante: uno, dos, tres.');
          u.lang = 'es-CL';
          u.onstart = () => log('El parlante EMPEZÓ a sonar.', 'ok');
          u.onend = () => cerrar('El parlante terminó bien.', 'ok');
          u.onerror = (e) => cerrar(`El parlante FALLÓ: ${(e as { error?: string })?.error || '?'}`, 'mal');
          synth.speak(u);
          setTimeout(() => cerrar('El parlante NUNCA avisó que terminó (se siguió igual).', 'mal'), 7000);
        } catch {
          cerrar('El parlante lanzó un error al hablar.', 'mal');
        }
      });
      await esperar(400);
    }

    // ── 6. El reconocedor en vivo ──
    if (Ctor) {
      log('Escuchando 10 segundos: DI ALGO AHORA (por ejemplo «hola hola»)…');
      await new Promise<void>((fin) => {
        let cerrado = false;
        let entendioAlgo = false;
        const cerrar = () => {
          if (cerrado) return;
          cerrado = true;
          recRef.current = null;
          fin();
        };
        try {
          const rec = new Ctor();
          recRef.current = rec;
          rec.lang = 'es-CL';
          rec.continuous = false;
          rec.interimResults = true;
          rec.maxAlternatives = 1;
          rec.onstart = () => log('El reconocedor ARRANCÓ (micrófono al aire).', 'ok');
          rec.onaudiostart = () => log('Está captando audio.', 'ok');
          rec.onspeechstart = () => log('Detectó que alguien habla.', 'ok');
          rec.onresult = (ev) => {
            const e = ev as { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } };
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              const texto = r[0]?.transcript?.trim();
              if (!texto) continue;
              entendioAlgo = true;
              log(`${r.isFinal ? 'ENTENDIÓ' : 'va oyendo'}: «${texto}»`, r.isFinal ? 'ok' : 'info');
            }
          };
          rec.onerror = (e) => log(`El reconocedor dio error: ${e.error}`, e.error === 'no-speech' ? 'info' : 'mal');
          rec.onend = () => {
            log(
              entendioAlgo
                ? 'Prueba de escucha TERMINADA: el reconocedor funciona.'
                : 'El reconocedor se cerró sin entender nada.',
              entendioAlgo ? 'ok' : 'mal',
            );
            cerrar();
          };
          rec.start();
          setTimeout(() => {
            try {
              rec.abort();
            } catch {
              /* nada */
            }
            cerrar();
          }, 10000);
        } catch (e) {
          log(`El reconocedor no pudo arrancar: ${(e as Error)?.message || '?'}`, 'mal');
          cerrar();
        }
      });
    }

    log('— Fin de la prueba. Manda una captura de esto. —');
    setCorriendo(false);
  };

  const copiar = async () => {
    const texto = lineas.map((l) => `[${l.t}] ${l.texto}`).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Diagnóstico copiado.');
    } catch {
      toast.error('No se pudo copiar: manda una captura de pantalla.');
    }
  };

  return (
    <div className="rounded-md border border-border bg-card/60 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold">Probador del micrófono y el parlante</span>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" className="h-7 gap-1 px-2 text-[0.68rem]" onClick={probar} disabled={corriendo}>
            <Play className="h-3.5 w-3.5" /> {corriendo ? 'Probando…' : 'Probar'}
          </Button>
          {lineas.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[0.68rem]" onClick={copiar}>
              <ClipboardCopy className="h-3.5 w-3.5" /> Copiar
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" onClick={onCerrar} title="Cerrar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {lineas.length === 0 ? (
        <p className="text-[0.68rem] text-muted-foreground">
          Toca «Probar»: revisa el permiso, abre el micrófono, hace sonar el parlante y escucha 10
          segundos. Cada paso dice si anduvo o no — manda la captura de lo que salga.
        </p>
      ) : (
        <div className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-[0.66rem] leading-snug">
          {lineas.map((l, i) => (
            <div
              key={i}
              className={
                l.tipo === 'ok'
                  ? 'text-emerald-500'
                  : l.tipo === 'mal'
                    ? 'text-red-400'
                    : 'text-muted-foreground'
              }
            >
              <span className="opacity-60">[{l.t}]</span> {l.tipo === 'ok' ? '✓' : l.tipo === 'mal' ? '✗' : '·'}{' '}
              {l.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
