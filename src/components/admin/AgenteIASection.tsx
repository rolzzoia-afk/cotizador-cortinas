import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageCircle,
  Power,
  RotateCcw,
  Save,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  AGENTE_CATEGORIAS,
  useAgenteDocs,
  useEmpresaAgenteConfig,
  useVendedoras,
  type AgenteCategoria,
} from '@/modules/admin/agente-hooks';

export function AgenteIASection() {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-indigo-500" />
        <h2 className="text-sm font-semibold text-muted-foreground">Agente IA</h2>
      </header>
      <div className="space-y-6">
        <Configuracion />
        <EditorDocs />
        <VendedorasPanel />
        <PlaygroundPanel />
      </div>
    </section>
  );
}

// ── Configuración general del agente ─────────────────────────────────
function Configuracion() {
  const { config, loading, error, guardar } = useEmpresaAgenteConfig();
  const [nombre, setNombre] = useState('');
  const [mensajeFuera, setMensajeFuera] = useState('');
  const [mensajeFallback, setMensajeFallback] = useState('');
  const [maxTurnos, setMaxTurnos] = useState<number>(8);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setNombre(config.nombre_agente ?? '');
    setMensajeFuera(config.mensaje_fuera_horario ?? '');
    setMensajeFallback(config.mensaje_fallback ?? '');
    setMaxTurnos(config.max_turnos_sin_derivar ?? 8);
  }, [config]);

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      nombre !== (config.nombre_agente ?? '') ||
      mensajeFuera !== (config.mensaje_fuera_horario ?? '') ||
      mensajeFallback !== (config.mensaje_fallback ?? '') ||
      maxTurnos !== (config.max_turnos_sin_derivar ?? 8)
    );
  }, [config, nombre, mensajeFuera, mensajeFallback, maxTurnos]);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardar({
        nombre_agente: nombre.trim() || 'Diego',
        mensaje_fuera_horario: mensajeFuera,
        mensaje_fallback: mensajeFallback,
        max_turnos_sin_derivar: maxTurnos,
      });
      toast.success('Configuración guardada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo guardar: ' + msg);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async () => {
    if (!config) return;
    try {
      await guardar({ activo: !config.activo });
      toast.success(config.activo ? 'Agente desactivado' : 'Agente activado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo cambiar estado: ' + msg);
    }
  };

  if (loading && !config) {
    return <div className="text-xs text-muted-foreground">Cargando configuración…</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        Error: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        No hay configuración de agente para esta empresa. Ejecuta el seed inicial.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
        <div>
          <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold">
            <Power className={cn('h-4 w-4', config.activo ? 'text-emerald-500' : 'text-zinc-400')} />
            Estado del agente
          </div>
          <div className="text-xs text-muted-foreground">
            {config.activo
              ? 'Recibiendo y respondiendo mensajes de WhatsApp.'
              : 'Detenido. Los mensajes entrantes no se procesan.'}
          </div>
        </div>
        <Button
          variant={config.activo ? 'destructive' : 'default'}
          size="sm"
          onClick={toggleActivo}
        >
          {config.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="nombre-agente" className="text-xs">
            Nombre del agente
          </Label>
          <Input
            id="nombre-agente"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Diego"
            className="mt-1"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Aparece en cada respuesta como "Soy {nombre || 'Diego'}, asistente virtual…"
          </p>
        </div>
        <div>
          <Label htmlFor="max-turnos" className="text-xs">
            Máx. turnos sin derivar
          </Label>
          <Input
            id="max-turnos"
            type="number"
            min={3}
            max={20}
            value={maxTurnos}
            onChange={(e) => setMaxTurnos(parseInt(e.target.value) || 8)}
            className="mt-1"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Si una conversación supera este número de turnos sin avanzar, deriva igual.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="msg-fallback" className="text-xs">
          Mensaje fallback (cuando el agente no sabe algo)
        </Label>
        <textarea
          id="msg-fallback"
          value={mensajeFallback}
          onChange={(e) => setMensajeFallback(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <Label htmlFor="msg-fuera" className="text-xs">
          Mensaje fuera de horario
        </Label>
        <textarea
          id="msg-fuera"
          value={mensajeFuera}
          onChange={(e) => setMensajeFuera(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] text-muted-foreground">
          Última actualización: {new Date(config.updated_at).toLocaleString('es-CL')}
        </p>
        <Button onClick={handleGuardar} disabled={!dirty || guardando} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}

// ── Editor de los 8 documentos ───────────────────────────────────────
function EditorDocs() {
  const { docs, loading, error, guardarDoc } = useAgenteDocs();
  const [categoria, setCategoria] = useState<AgenteCategoria>('catalogo');
  const [draft, setDraft] = useState('');
  const [guardando, setGuardando] = useState(false);

  const docActual = useMemo(
    () => docs.find((d) => d.categoria === categoria) ?? null,
    [docs, categoria],
  );
  const meta = AGENTE_CATEGORIAS.find((c) => c.id === categoria);

  useEffect(() => {
    setDraft(docActual?.contenido_md ?? '');
  }, [docActual]);

  const dirty = draft !== (docActual?.contenido_md ?? '');

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarDoc(categoria, draft);
      toast.success(`Doc "${meta?.label}" guardado (versión incrementada)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo guardar: ' + msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescartar = () => {
    setDraft(docActual?.contenido_md ?? '');
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-indigo-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Base de conocimiento
        </h3>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {AGENTE_CATEGORIAS.map((c) => {
          const doc = docs.find((d) => d.categoria === c.id);
          const tieneContenido = (doc?.contenido_md.length ?? 0) > 100;
          return (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition',
                categoria === c.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'border-border hover:bg-muted',
              )}
            >
              {c.label}
              {!tieneContenido && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                  title="Doc poco desarrollado"
                />
              )}
            </button>
          );
        })}
      </div>

      {meta && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <p className="text-muted-foreground">{meta.descripcion}</p>
          {docActual && (
            <div className="flex items-center gap-2 whitespace-nowrap text-[0.65rem] text-muted-foreground">
              <Badge variant="outline" className="text-[0.65rem]">
                v{docActual.version}
              </Badge>
              <span>{new Date(docActual.updated_at).toLocaleString('es-CL')}</span>
            </div>
          )}
        </div>
      )}

      {loading && !docActual ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          Cargando documentos…
        </div>
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={20}
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          placeholder="Markdown del documento…"
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] text-muted-foreground">
          {draft.length} caracteres · {draft.split('\n').length} líneas
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDescartar}
            disabled={!dirty || guardando}
            variant="outline"
            size="sm"
          >
            Descartar cambios
          </Button>
          <Button onClick={handleGuardar} disabled={!dirty || guardando} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {guardando ? 'Guardando…' : 'Guardar versión'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Panel de vendedoras activas ─────────────────────────────────────
function VendedorasPanel() {
  const { vendedoras, loading, error, setActiva } = useVendedoras();
  const [actualizando, setActualizando] = useState<string | null>(null);

  const handleToggle = async (perfil_id: string, activa: boolean) => {
    setActualizando(perfil_id);
    try {
      await setActiva(perfil_id, !activa);
      toast.success(activa ? 'Vendedora desactivada' : 'Vendedora activada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo actualizar: ' + msg);
    } finally {
      setActualizando(null);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-indigo-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vendedoras activas
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo las marcadas como activas reciben leads automáticos del agente. Marcar como inactiva
        cuando una vendedora esté de vacaciones o licencia.
      </p>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && vendedoras.length === 0 ? (
        <div className="text-xs text-muted-foreground">Cargando…</div>
      ) : vendedoras.length === 0 ? (
        <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
          No hay perfiles con rol "ventas" en esta empresa.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Leads asignados</TableHead>
              <TableHead>Última asignación</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedoras.map((v) => (
              <TableRow key={v.perfil_id}>
                <TableCell>
                  <div className="font-medium">{v.nombre || '—'}</div>
                </TableCell>
                <TableCell>
                  {v.activa ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <XCircle className="h-3 w-3" /> Inactiva
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.leads_asignados_acumulado}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {v.ultima_asignacion
                    ? new Date(v.ultima_asignacion).toLocaleString('es-CL')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(v.perfil_id, v.activa)}
                    disabled={actualizando === v.perfil_id}
                  >
                    {actualizando === v.perfil_id
                      ? '…'
                      : v.activa
                        ? 'Desactivar'
                        : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Playground: chatear con el agente usando los docs como contexto ──
type DocUsado = {
  categoria: string;
  version: number;
  updated_at: string;
  caracteres: number;
};

type PlaygroundMeta = {
  docs_usados: DocUsado[];
  usage: { input_tokens: number; output_tokens: number } | null;
  model: string;
  system_prompt_chars: number;
};

type PlaygroundMsg = {
  role: 'user' | 'assistant';
  content: string;
  meta?: PlaygroundMeta;
};

// Precios aproximados de Claude Sonnet 4.6 (USD por millón de tokens).
// Pueden cambiar; si el costo no cuadra con la factura real, ajustar acá.
const PRECIO_INPUT_USD_POR_M = 3;
const PRECIO_OUTPUT_USD_POR_M = 15;

function calcularCostoUSD(usage: { input_tokens: number; output_tokens: number } | null) {
  if (!usage) return 0;
  return (
    (usage.input_tokens * PRECIO_INPUT_USD_POR_M) / 1_000_000 +
    (usage.output_tokens * PRECIO_OUTPUT_USD_POR_M) / 1_000_000
  );
}

function formatUSD(usd: number) {
  if (usd === 0) return '$0';
  if (usd < 0.001) return '<$0.001';
  return '$' + usd.toFixed(4);
}

function MessageDetails({ meta }: { meta: PlaygroundMeta }) {
  const [abierto, setAbierto] = useState(false);
  const costo = calcularCostoUSD(meta.usage);
  const tokensIn = meta.usage?.input_tokens ?? 0;
  const tokensOut = meta.usage?.output_tokens ?? 0;

  return (
    <div className="mt-1 max-w-[85%]">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-1 text-[0.6rem] text-muted-foreground hover:text-foreground"
      >
        {abierto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {tokensIn + tokensOut} tokens · {formatUSD(costo)} · {meta.docs_usados.length} docs
      </button>
      {abierto && (
        <div className="mt-1 rounded-md border bg-muted/30 p-2 text-[0.65rem] space-y-1.5">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-muted-foreground">Input</div>
              <div className="font-mono">{tokensIn.toLocaleString('es-CL')} tok</div>
            </div>
            <div>
              <div className="text-muted-foreground">Output</div>
              <div className="font-mono">{tokensOut.toLocaleString('es-CL')} tok</div>
            </div>
            <div>
              <div className="text-muted-foreground">Costo</div>
              <div className="font-mono">{formatUSD(costo)}</div>
            </div>
          </div>
          <div className="border-t pt-1.5">
            <div className="mb-1 text-muted-foreground">
              Docs leídos ({meta.system_prompt_chars.toLocaleString('es-CL')} caracteres en system prompt)
            </div>
            <div className="space-y-0.5">
              {meta.docs_usados.map((d) => (
                <div key={d.categoria} className="flex items-center justify-between gap-2">
                  <span className="font-mono">{d.categoria}</span>
                  <span className="text-muted-foreground">
                    v{d.version} · {d.caracteres.toLocaleString('es-CL')} car · actualizado{' '}
                    {new Date(d.updated_at).toLocaleString('es-CL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-1 text-muted-foreground">
            Modelo: <span className="font-mono">{meta.model}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaygroundPanel() {
  const [history, setHistory] = useState<PlaygroundMsg[]>([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, enviando]);

  const totales = useMemo(() => {
    let tokensIn = 0;
    let tokensOut = 0;
    let costo = 0;
    for (const m of history) {
      if (m.meta?.usage) {
        tokensIn += m.meta.usage.input_tokens;
        tokensOut += m.meta.usage.output_tokens;
        costo += calcularCostoUSD(m.meta.usage);
      }
    }
    return { tokensIn, tokensOut, costo };
  }, [history]);

  const handleEnviar = async () => {
    const message = input.trim();
    if (!message || enviando) return;

    const nuevoHistorial: PlaygroundMsg[] = [
      ...history,
      { role: 'user', content: message },
    ];
    setHistory(nuevoHistorial);
    setInput('');
    setEnviando(true);

    try {
      const historyForRequest = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { data, error } = await supabase.functions.invoke(
        'agente-playground',
        {
          body: {
            message,
            history: historyForRequest,
          },
        },
      );
      if (error) throw error;
      const respuesta = data as {
        reply?: string;
        error?: string;
        usage?: { input_tokens: number; output_tokens: number } | null;
        model?: string;
        docs_usados?: DocUsado[];
        system_prompt_chars?: number;
      };
      const reply = respuesta?.reply;
      const errMsg = respuesta?.error;
      if (errMsg) throw new Error(errMsg);
      if (!reply) throw new Error('Respuesta vacía del agente');
      const meta: PlaygroundMeta = {
        docs_usados: respuesta.docs_usados ?? [],
        usage: respuesta.usage ?? null,
        model: respuesta.model ?? 'desconocido',
        system_prompt_chars: respuesta.system_prompt_chars ?? 0,
      };
      setHistory([
        ...nuevoHistorial,
        { role: 'assistant', content: reply, meta },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('Error: ' + msg);
      setHistory(history);
      setInput(message);
    } finally {
      setEnviando(false);
    }
  };

  const handleReset = () => {
    setHistory([]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Playground
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && totales.tokensIn + totales.tokensOut > 0 && (
            <span className="text-[0.65rem] text-muted-foreground">
              Total: {(totales.tokensIn + totales.tokensOut).toLocaleString('es-CL')} tok ·{' '}
              {formatUSD(totales.costo)}
            </span>
          )}
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={enviando}
              className="h-7 px-2 text-[0.65rem]"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reiniciar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Prueba preguntas como las que haría un cliente en WhatsApp. El agente responde usando los
        documentos guardados arriba como única fuente. Si responde mal, ajusta los documentos y
        prueba de nuevo. Debajo de cada respuesta puedes desplegar los detalles para ver qué
        documentos leyó el agente y cuánto costó esa respuesta.
      </p>

      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-2"
      >
        {history.length === 0 && !enviando && (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
            Empieza a chatear para probar al agente.
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col',
              m.role === 'user' ? 'items-end' : 'items-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed',
                m.role === 'user'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-background border',
              )}
            >
              {m.content}
            </div>
            {m.role === 'assistant' && m.meta && <MessageDetails meta={m.meta} />}
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
              Pensando…
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Hola, quiero cotizar cortinas roller para mi living…"
          disabled={enviando}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button
          onClick={handleEnviar}
          disabled={!input.trim() || enviando}
          size="sm"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Enviar
        </Button>
      </div>
    </div>
  );
}
