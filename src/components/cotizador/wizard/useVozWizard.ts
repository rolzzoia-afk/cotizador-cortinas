// ─────────────────────────────────────────────────────────────────────
// EL ASISTENTE DE VOZ DE LA VISTA GUIADA — la parte que habla con React.
//
// Junta las tres piezas puras: `voz.ts` (qué preguntar), `vozParsers.ts` (qué
// se entendió) y `maquinaVoz.ts` (en qué punto va la conversación), y las
// enchufa al micrófono del navegador y al wizard.
//
// LA REGLA QUE NO SE PUEDE ROMPER: después de escribir un dato, el próximo
// campo NO se calcula con el contexto viejo. Escribir el color cambia el
// mecanismo, el ancho cambia el modelo, la tubería cambia el kit… así que se
// espera el re-render del padre y recién ahí se pregunta `proximoCampo` con el
// contexto FRESCO. De ahí el `ctxRef` y el `pendienteAvanzar`.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  anunciosDelPaso,
  campoPorEtiqueta,
  opcionUnicaAutomatica,
  proximoCampo,
  type AccionVoz,
  type CampoVoz,
  type CtxVoz,
} from '@/modules/cotizador/wizard/voz';
import {
  ESTADO_VOZ_INICIAL,
  reducirVoz,
  type EstadoVoz,
  type EventoVoz,
} from '@/modules/cotizador/wizard/maquinaVoz';
import {
  matchOpcion,
  numeroHablado,
  parsearCodigoTela,
  parsearComando,
  parsearEntero,
  parsearMedida,
  parsearOrdinal,
} from '@/modules/cotizador/wizard/vozParsers';
import { faltantesPaso, type IdPaso, type PasoWizard } from '@/modules/cotizador/wizard/pasos';
import {
  AVISO_MIC_BLOQUEADO,
  AVISO_SIN_SOPORTE,
  cancelarHabla,
  crearReconocedor,
  estadoPermisoMicrofono,
  estaHablando,
  fijarVoz,
  hablar,
  mensajeErrorASR,
  nombreVozActual,
  pedirPermisoMicrofono,
  precargarVoces,
  soporteVoz,
  vocesEnCastellano,
  type Reconocedor,
} from '@/modules/voz/webSpeech';

/** Lo que se espera entre que la app termina de hablar y se abre el micrófono. */
const MS_ANTI_ECO = 350;
/** Si el re-render no llega (el dato no cambió nada), se sigue igual. */
const MS_RESPALDO_AVANCE = 700;
/**
 * Cuántas vueltas de silencio se aguantan antes de dejar el micrófono en pausa.
 * El navegador corta a los ~5 s de no oír nada, así que esto es alrededor de
 * un minuto de tranquilidad: lo que tarda cualquiera en medir una ventana.
 */
const SILENCIOS_PARA_PAUSAR = 12;

type Opciones = {
  idPaso: IdPaso;
  ctx: CtxVoz;
  pasos: readonly PasoWizard[];
  panoActivo: number;
  /** Pendientes de la ventana, para el cierre hablado del resumen. */
  pendientes?: readonly string[];
  onAccion: (accion: AccionVoz) => void;
  onIrAPaso: (id: IdPaso) => void;
};

export type VozWizard = {
  soportado: boolean;
  estado: EstadoVoz;
  encendida: boolean;
  encender: () => void;
  apagar: () => void;
  alternar: () => void;
  /** Abrir el micrófono con un toque, sin esperar a que la app termine. */
  escucharAhora: () => void;
  elegirCandidato: (indice: number) => void;
  /** Las voces en castellano del equipo, para poder cambiar la que guía. */
  voces: { name: string; lang: string; natural: boolean }[];
  vozActual: string;
  cambiarVoz: (nombre: string) => void;
};

export function useVozWizard(opts: Opciones): VozWizard {
  const soporte = useMemo(() => soporteVoz(), []);
  const soportado = soporte.escuchar && soporte.hablar;

  const [estado, setEstado] = useState<EstadoVoz>(ESTADO_VOZ_INICIAL);
  const estadoRef = useRef(estado);
  const ctxRef = useRef(opts.ctx);
  const optsRef = useRef(opts);
  const campoRef = useRef<CampoVoz | null>(null);
  const ecoRef = useRef('');
  const pendienteAvanzarRef = useRef(false);
  const programarAvanceRef = useRef<() => void>(() => {});
  /** El cierre del resumen: apagar recién CUANDO TERMINE de hablar, no antes. */
  const apagarTrasHablarRef = useRef(false);
  const timerAvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerEscuchaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerHablaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<Reconocedor | null>(null);
  /** El permiso del micrófono pedido en el clic, mientras esté en vuelo. */
  const permisoRef = useRef<Promise<boolean> | null>(null);
  /** Vueltas seguidas sin que nadie diga nada: en terreno es lo normal. */
  const silenciosRef = useRef(0);

  // El contexto se refresca en CADA render: es la única forma de que la voz vea
  // lo que las cascadas acaban de escribir.
  ctxRef.current = opts.ctx;
  optsRef.current = opts;
  estadoRef.current = estado;

  const despacharRef = useRef<(e: EventoVoz) => void>(() => {});

  /**
   * Abre el micrófono en cuanto el parlante se calla — y NUNCA lo corta.
   *
   * Cortarlo «para escuchar de una vez» era lo que dejaba las frases a mitad
   * de palabra: si el fin del habla llegaba antes de tiempo (pasa en el
   * teléfono), este camino degollaba la lectura en curso. Ahora se espera; si
   * `speaking` se queda pegado en true (bug conocido de Chrome), pasado un
   * rato se abre el micrófono IGUAL, sin cancelar nada: sobre un parlante
   * realmente mudo eso no corta nada, y si sonara, el eco lo descarta la
   * máquina.
   */
  const abrirMicrofono = useCallback((intento = 0) => {
    if (timerEscuchaRef.current) clearTimeout(timerEscuchaRef.current);
    timerEscuchaRef.current = setTimeout(
      () => {
        if (estadoRef.current.fase === 'apagado' || estadoRef.current.fase === 'pausado') return;
        if (estaHablando() && intento < 12) {
          abrirMicrofono(intento + 1);
          return;
        }
        // El permiso se pidió en el clic: hay que esperar a que suelte el
        // micrófono, o el reconocedor arranca sobre un aparato ocupado y se
        // cierra al instante (que es como se veía «no me escucha»).
        const seguir = () => {
          if (estadoRef.current.fase === 'apagado' || estadoRef.current.fase === 'pausado') return;
          recRef.current?.escuchar();
        };
        if (permisoRef.current) {
          const p = permisoRef.current;
          permisoRef.current = null;
          p.then(seguir).catch(seguir);
          return;
        }
        seguir();
      },
      intento === 0 ? MS_ANTI_ECO : 250,
    );
  }, []);
  const abrirMicrofonoRef = useRef(abrirMicrofono);
  abrirMicrofonoRef.current = abrirMicrofono;

  const ejecutar = useCallback(
    (efectos: ReturnType<typeof reducirVoz>['efectos']) => {
      for (const efecto of efectos) {
        if (efecto.tipo === 'CANCELAR') {
          cancelarHabla();
          recRef.current?.abortar();
          if (timerEscuchaRef.current) clearTimeout(timerEscuchaRef.current);
          if (timerHablaRef.current) clearTimeout(timerHablaRef.current);
        } else if (efecto.tipo === 'HABLAR') {
          const fin = () => {
            if (timerHablaRef.current) clearTimeout(timerHablaRef.current);
            if (apagarTrasHablarRef.current) {
              apagarTrasHablarRef.current = false;
              despacharRef.current({ tipo: 'APAGAR' });
              return;
            }
            despacharRef.current({ tipo: 'TTS_FIN' });
          };
          hablar(efecto.texto, fin);
          // Red de seguridad: si el navegador se come el fin del habla (o algo
          // canceló el parlante por fuera), la conversación NO puede quedarse
          // colgada en «Hablando…» con el micrófono cerrado.
          if (timerHablaRef.current) clearTimeout(timerHablaRef.current);
          timerHablaRef.current = setTimeout(
            () => {
              if (estadoRef.current.fase === 'hablando') fin();
            },
            // Última red, por detrás de la de `hablar()`: nunca debería llegar
            // a correr, y si corre es porque el parlante quedó mudo.
            efecto.texto.length * 140 + 7000,
          );
        } else if (efecto.tipo === 'ESCUCHAR') {
          abrirMicrofono();
        } else if (efecto.tipo === 'AVISO') {
          toast.error(efecto.texto);
        }
      }
    },
    [abrirMicrofono],
  );

  const despachar = useCallback(
    (evento: EventoVoz) => {
      const { estado: siguiente, efectos } = reducirVoz(estadoRef.current, evento);
      estadoRef.current = siguiente;
      setEstado(siguiente);
      ejecutar(efectos);
    },
    [ejecutar],
  );
  despacharRef.current = despachar;

  // ── Armar la próxima pregunta ───────────────────────────────────────

  const pasoActual = useCallback(
    () => optsRef.current.pasos.find((p) => p.id === optsRef.current.idPaso) ?? null,
    [],
  );

  /**
   * Pregunta el próximo campo vacío del paso, con el contexto FRESCO. Antes de
   * preguntar resuelve los campos con una sola opción posible (los pone y los
   * cuenta), y si no queda nada por preguntar cierra el paso.
   */
  const preguntarProximo = useCallback(
    (extra = '') => {
      const { idPaso, pasos } = optsRef.current;
      const prefijo = [extra, ecoRef.current].filter(Boolean).join(' ');
      ecoRef.current = '';
      const ctx = ctxRef.current;
      const campo = proximoCampo(idPaso, ctx, new Set(estadoRef.current.atendidos));
      if (campo) {
        const unica = opcionUnicaAutomatica(campo, ctx);
        if (unica) {
          // Una sola opción posible: se pone y se avisa. NO se sigue en el mismo
          // tirón — poner el tubo puede dejar un solo kit, y eso solo se sabe
          // con el contexto ya recalculado.
          optsRef.current.onAccion(campo.aplicar(unica.value, ctx));
          despachar({ tipo: 'ATENDIDO', campo: campo.clave });
          ecoRef.current = [prefijo, `${campo.etiqueta}: quedó ${unica.label}, no hay otra opción.`]
            .filter(Boolean)
            .join(' ');
          programarAvanceRef.current();
          return;
        }
        campoRef.current = campo;
        despachar({
          tipo: 'HABLAR',
          texto: [prefijo, campo.pregunta(ctx)].filter(Boolean).join(' '),
          campo: campo.clave,
        });
        return;
      }
      // No queda nada que preguntar en este paso.
      campoRef.current = null;
      const idx = pasos.findIndex((p) => p.id === idPaso);
      const siguiente = idx >= 0 ? pasos[idx + 1] : undefined;
      if (idPaso === 'resumen') {
        const pend = optsRef.current.pendientes ?? [];
        const cierre =
          pend.length === 0
            ? 'La cortina quedó completa. Apago el asistente: revisa y guarda cuando quieras.'
            : `Todavía falta: ${pend.slice(0, 3).join('; ')}${pend.length > 3 ? `, y ${pend.length - 3} más` : ''}. Apago el asistente.`;
        apagarTrasHablarRef.current = true;
        despachar({
          tipo: 'HABLAR',
          texto: [prefijo, cierre].filter(Boolean).join(' '),
          campo: null,
          luegoEscuchar: false,
        });
        return;
      }
      const texto = siguiente
        ? `${pasos[idx]?.titulo ?? 'El paso'} listo. ¿Sigo con ${siguiente.titulo}?`
        : 'No queda nada por preguntar en este paso.';
      despachar({
        tipo: 'HABLAR',
        texto: [prefijo, texto].filter(Boolean).join(' '),
        campo: null,
        luegoEscuchar: false,
      });
    },
    [despachar],
  );

  /** Después de escribir, se espera el re-render y se sigue con el contexto nuevo. */
  const programarAvance = useCallback(() => {
    pendienteAvanzarRef.current = true;
    if (timerAvanceRef.current) clearTimeout(timerAvanceRef.current);
    timerAvanceRef.current = setTimeout(() => {
      if (!pendienteAvanzarRef.current) return;
      pendienteAvanzarRef.current = false;
      preguntarProximo();
    }, MS_RESPALDO_AVANCE);
  }, [preguntarProximo]);
  programarAvanceRef.current = programarAvance;

  // El contexto cambió: si había un avance pendiente, ahora sí se puede
  // calcular el próximo campo sin arriesgarse a leer el estado viejo.
  useEffect(() => {
    if (!pendienteAvanzarRef.current) return;
    pendienteAvanzarRef.current = false;
    if (timerAvanceRef.current) clearTimeout(timerAvanceRef.current);
    preguntarProximo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.ctx]);

  const aplicarValor = useCallback(
    (campo: CampoVoz, valor: string, leido: string) => {
      optsRef.current.onAccion(campo.aplicar(valor, ctxRef.current));
      despachar({ tipo: 'ATENDIDO', campo: campo.clave });
      ecoRef.current = `Anoté ${campo.etiqueta}: ${leido}.`;
      programarAvance();
    },
    [despachar, programarAvance],
  );

  const noEntendi = useCallback(
    (texto: string) => despachar({ tipo: 'NO_ENTENDI', texto }),
    [despachar],
  );

  const irAPaso = useCallback(
    (direccion: 'siguiente' | 'anterior') => {
      const { pasos, idPaso, onIrAPaso } = optsRef.current;
      const idx = pasos.findIndex((p) => p.id === idPaso);
      const paso = pasos[idx];
      // La voz respeta el MISMO candado que el botón «Siguiente»: en terreno un
      // campo en blanco no se nota hasta que la cortina está en el taller.
      if (direccion === 'siguiente' && paso) {
        const faltan = faltantesPaso(paso, ctxRef.current);
        if (faltan.length > 0) {
          despachar({
            tipo: 'HABLAR',
            texto: `Todavía falta ${faltan.join(', ')}. Contéstalo, o di saltar si de verdad no se sabe.`,
            campo: null,
            luegoEscuchar: false,
          });
          return;
        }
      }
      const destino = pasos[direccion === 'siguiente' ? idx + 1 : idx - 1];
      if (!destino) {
        despachar({
          tipo: 'HABLAR',
          texto:
            direccion === 'siguiente'
              ? 'Este es el último paso.'
              : 'Este es el primer paso.',
          campo: null,
          luegoEscuchar: false,
        });
        return;
      }
      onIrAPaso(destino.id);
    },
    [despachar],
  );

  // ── Interpretar lo que se dijo ──────────────────────────────────────

  const elegirDeCandidatos = useCallback(
    (indice: number) => {
      const campo = campoRef.current;
      const cand = estadoRef.current.candidatos[indice];
      if (!campo || !cand) return;
      aplicarValor(campo, cand.valor, cand.etiqueta);
    },
    [aplicarValor],
  );

  const interpretar = useCallback(
    (texto: string, alternativas: string[]) => {
      const ctx = ctxRef.current;
      const campo = campoRef.current;
      const candidatos = estadoRef.current.candidatos;

      // 1. Con candidatos en el aire, lo que se espera es un número.
      if (candidatos.length > 0 && campo) {
        const orden = parsearOrdinal(texto);
        if (orden && candidatos[orden - 1]) {
          elegirDeCandidatos(orden - 1);
          return;
        }
        const m = matchOpcion(
          texto,
          candidatos.map((c) => ({ value: c.valor, label: c.etiqueta })),
        );
        if (m.tipo === 'unica') {
          const i = candidatos.findIndex((c) => c.valor === m.opcion.value);
          if (i >= 0) {
            elegirDeCandidatos(i);
            return;
          }
        }
        noEntendi('No entendí cuál. Dime el número de la opción.');
        return;
      }

      // 2. Las órdenes van primero. En texto libre solo valen dichas solas.
      const libre = campo?.tipo === 'texto' || campo?.tipo === 'libre';
      const cmd = parsearComando(texto, { soloExacto: libre });
      if (cmd) {
        switch (cmd.comando) {
          case 'siguiente':
            irAPaso('siguiente');
            return;
          case 'anterior':
            irAPaso('anterior');
            return;
          case 'parar':
            despachar({ tipo: 'APAGAR' });
            toast.info('Asistente de voz apagado.');
            return;
          case 'repetir':
            despachar({
              tipo: 'HABLAR',
              texto: estadoRef.current.pregunta || 'No hay ninguna pregunta pendiente.',
              campo: campo?.clave ?? null,
            });
            return;
          case 'saltar': {
            if (!campo) return noEntendi('No hay nada que saltar. Di siguiente para avanzar.');
            despachar({ tipo: 'ATENDIDO', campo: campo.clave });
            ecoRef.current = `${campo.etiqueta} queda pendiente.`;
            programarAvance();
            return;
          }
          case 'corregir': {
            const destino = campoPorEtiqueta(optsRef.current.idPaso, ctx, cmd.resto);
            if (!destino) return noEntendi('No encontré ese campo. ¿Cuál quieres corregir?');
            campoRef.current = destino;
            despachar({ tipo: 'HABLAR', texto: destino.pregunta(ctx), campo: destino.clave });
            return;
          }
          default:
            break;
        }
      }

      // 3. Sin campo en curso, solo se aceptan órdenes.
      if (!campo) {
        noEntendi('Di siguiente para avanzar, anterior para volver, o parar para apagar.');
        return;
      }

      // 4. El valor del campo, según su tipo.
      switch (campo.tipo) {
        case 'texto':
        case 'libre': {
          const limpio = texto.trim();
          if (!limpio) return noEntendi('No te escuché. ¿Lo repites?');
          aplicarValor(campo, limpio, limpio);
          return;
        }
        case 'medida': {
          const r = parsearMedida(texto, campo.unidad ?? 'm');
          if (!r.ok) {
            return noEntendi(
              r.motivo === 'fuera-de-rango'
                ? `${numeroHablado(String(r.numero ?? ''))} no parece una medida de cortina. ¿Me la repites?`
                : 'No entendí la medida. Puedes decirla como uno coma ochenta y cinco.',
            );
          }
          aplicarValor(campo, r.valor, `${numeroHablado(r.valor)}`);
          return;
        }
        case 'entero': {
          const r = parsearEntero(texto);
          if (!r.ok) return noEntendi('No entendí la cantidad. Dime un número.');
          aplicarValor(campo, String(r.valor), String(r.valor));
          return;
        }
        case 'tela': {
          const r = parsearCodigoTela(texto, ctx.catalogo ?? {});
          if (r.tipo === 'unica') {
            aplicarValor(campo, r.opcion.codInt, `${r.opcion.codInt}, ${r.opcion.producto}`);
            return;
          }
          if (r.tipo === 'ambigua') {
            despachar({
              tipo: 'AMBIGUO',
              texto: `¿Cuál de estas? ${r.opciones
                .map((o, i) => `${i + 1}: ${o.codInt}, ${o.producto}`)
                .join('. ')}. Dime el número.`,
              candidatos: r.opciones.map((o) => ({
                valor: o.codInt,
                etiqueta: `${o.codInt} · ${o.producto}`,
              })),
            });
            return;
          }
          noEntendi('No encontré esa tela. Puedes deletrear el código, por ejemplo be ka diez.');
          return;
        }
        case 'opcion': {
          const opciones = campo.opciones?.(ctx) ?? [];
          for (const intento of [texto, ...alternativas]) {
            const m = matchOpcion(intento, opciones);
            if (m.tipo === 'unica') {
              aplicarValor(campo, m.opcion.value, m.opcion.label);
              return;
            }
            if (m.tipo === 'ambigua') {
              despachar({
                tipo: 'AMBIGUO',
                texto: `¿Cuál? ${m.opciones.map((o, i) => `${i + 1}: ${o.label}`).join('. ')}. Dime el número.`,
                candidatos: m.opciones.map((o) => ({ valor: o.value, etiqueta: o.label })),
              });
              return;
            }
          }
          const lista = opciones.slice(0, 4).map((o) => o.label).join(', ');
          noEntendi(
            opciones.length > 0
              ? `No entendí. Las opciones son: ${lista}${opciones.length > 4 ? ', entre otras' : ''}.`
              : 'No entendí.',
          );
          return;
        }
        default:
          noEntendi('No entendí.');
      }
    },
    [aplicarValor, despachar, elegirDeCandidatos, irAPaso, noEntendi, programarAvance],
  );

  // ── El micrófono ────────────────────────────────────────────────────

  // El reconocedor se crea UNA sola vez y se llama por referencia: si se
  // recreara en cada render, cada recreación cancelaría el habla en curso y la
  // conversación se cortaría sola.
  const interpretarRef = useRef(interpretar);
  interpretarRef.current = interpretar;

  useEffect(() => {
    if (!soportado) return;
    const rec = crearReconocedor({
      onParcial: (texto) => {
        if (estadoRef.current.fase === 'apagado') return;
        estadoRef.current = { ...estadoRef.current, dicho: texto };
        setEstado(estadoRef.current);
      },
      onFinal: (texto, alternativas) => {
        silenciosRef.current = 0;
        despacharRef.current({ tipo: 'RESULTADO', texto });
        // Si el resultado era el eco del parlante, la máquina no pasó a
        // interpretar: no hay nada más que hacer.
        if (estadoRef.current.fase !== 'interpretando') return;
        interpretarRef.current(texto, alternativas);
      },
      onError: (error) => {
        const fase = estadoRef.current.fase;
        if (fase === 'apagado' || fase === 'pausado') return;
        // EL SILENCIO NO ES UN ERROR. El navegador cierra el micrófono a los
        // pocos segundos de no oír nada, y en terreno eso pasa todo el rato:
        // se está midiendo, buscando el metro, hablando con el cliente. Se
        // vuelve a abrir CALLADO, sin repetir la pregunta ni contar fallos.
        if (error === 'no-speech') {
          silenciosRef.current += 1;
          if (silenciosRef.current < SILENCIOS_PARA_PAUSAR) {
            abrirMicrofonoRef.current();
            return;
          }
          silenciosRef.current = 0;
          despacharRef.current({
            tipo: 'PAUSAR',
            texto: 'Dejo el micrófono en pausa. Tócalo cuando quieras seguir.',
          });
          return;
        }
        despacharRef.current({ tipo: 'ERROR_ASR', error, texto: mensajeErrorASR(error) });
      },
    });
    recRef.current = rec;
    return () => {
      rec?.destruir();
      recRef.current = null;
      cancelarHabla();
    };
  }, [soportado]);

  // ── Encender, apagar, cambiar de paso ───────────────────────────────

  const arrancarPaso = useCallback(() => {
    const ctx = ctxRef.current;
    const anuncios = anunciosDelPaso(optsRef.current.idPaso, ctx);
    const paso = pasoActual();
    const cabecera = [paso ? `${paso.titulo}.` : '', ...anuncios].filter(Boolean).join(' ');
    // El paso sin campos (perfiles) solo avisa y queda esperando la orden.
    preguntarProximo(cabecera);
  }, [pasoActual, preguntarProximo]);

  const encender = useCallback(() => {
    if (!soportado) {
      toast.error(AVISO_SIN_SOPORTE);
      return;
    }
    precargarVoces();
    // El permiso del micrófono se pide ACÁ, dentro del clic: pedirlo más tarde
    // (cuando la app termina de hablar) ya no cuenta como gesto del usuario en
    // varios navegadores y el reconocedor arranca muerto.
    const permiso = pedirPermisoMicrofono().catch(() => false);
    permisoRef.current = permiso;
    // Si el pedido falla, hay que saber POR QUÉ: en el teléfono, un permiso
    // negado alguna vez queda BLOQUEADO y el navegador ya ni pregunta — sin
    // este aviso, el vendedor solo ve que «no escucha» y no hay nada que tocar.
    permiso.then(async (ok) => {
      if (ok || estadoRef.current.fase === 'apagado') return;
      const st = await estadoPermisoMicrofono();
      if (st === 'denied') {
        despacharRef.current({ tipo: 'ERROR_ASR', error: 'not-allowed', texto: AVISO_MIC_BLOQUEADO });
      }
    });
    ecoRef.current = '';
    silenciosRef.current = 0;
    campoRef.current = null;
    despachar({ tipo: 'ENCENDER' });
    arrancarPaso();
  }, [arrancarPaso, despachar, soportado]);

  const apagar = useCallback(() => despachar({ tipo: 'APAGAR' }), [despachar]);

  const encendida = estado.fase !== 'apagado';

  // La lista de voces del navegador aparece con retardo: se relee al encender.
  const [voces, setVoces] = useState<{ name: string; lang: string; natural: boolean }[]>([]);
  const [vozActual, setVozActual] = useState('');
  useEffect(() => {
    if (!encendida) return;
    const leer = () => {
      setVoces(vocesEnCastellano());
      setVozActual(nombreVozActual());
    };
    leer();
    const t = setTimeout(leer, 600);
    return () => clearTimeout(t);
  }, [encendida]);

  const cambiarVoz = useCallback((nombre: string) => {
    fijarVoz(nombre);
    setVozActual(nombreVozActual());
    // Una probadita para escucharla. Va por la máquina y no por el parlante a
    // secas, para que al terminar el micrófono vuelva a abrirse solo.
    despacharRef.current({ tipo: 'HABLAR', texto: 'Listo, hablo con esta voz.' });
  }, []);

  const alternar = useCallback(() => {
    if (estadoRef.current.fase === 'pausado') {
      silenciosRef.current = 0;
      despachar({ tipo: 'REANUDAR' });
      return;
    }
    if (estadoRef.current.fase === 'apagado') encender();
    else apagar();
  }, [apagar, despachar, encender]);

  /**
   * Abre el micrófono AHORA MISMO, desde un toque. Es la salida cuando el
   * navegador se hace el desentendido: un gesto del usuario nunca falla.
   */
  const escucharAhora = useCallback(() => {
    silenciosRef.current = 0;
    if (estadoRef.current.fase === 'pausado') {
      despachar({ tipo: 'REANUDAR' });
      return;
    }
    cancelarHabla();
    recRef.current?.escuchar();
  }, [despachar]);

  // Cambió el paso o el paño: se corta lo que sonaba y se empieza el nuevo.
  const claveArranque = `${opts.idPaso}|${opts.panoActivo}`;
  const claveRef = useRef(claveArranque);
  useEffect(() => {
    if (claveRef.current === claveArranque) return;
    claveRef.current = claveArranque;
    if (estadoRef.current.fase === 'apagado') return;
    pendienteAvanzarRef.current = false;
    ecoRef.current = '';
    campoRef.current = null;
    despachar({ tipo: 'REINICIAR' });
    arrancarPaso();
  }, [claveArranque, arrancarPaso, despachar]);

  // Al desmontar (cerrar el editor) no puede quedar nada sonando.
  useEffect(
    () => () => {
      cancelarHabla();
      if (timerAvanceRef.current) clearTimeout(timerAvanceRef.current);
      if (timerEscuchaRef.current) clearTimeout(timerEscuchaRef.current);
    },
    [],
  );

  return {
    soportado,
    estado,
    encendida,
    encender,
    apagar,
    alternar,
    escucharAhora,
    elegirCandidato: elegirDeCandidatos,
    voces,
    vozActual,
    cambiarVoz,
  };
}
