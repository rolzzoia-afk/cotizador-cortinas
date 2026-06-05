// Panel de chat para probar el agente con los docs cargados como contexto.
// Llama la edge function `agente-playground` con (mensaje, historial),
// muestra los detalles de tokens/costo/docs leídos en cada respuesta.

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import MessageDetails from './MessageDetails';
import { calcularCostoUSD, formatUSD } from '../utils/costo';
import type { DocUsado, PlaygroundMeta, PlaygroundMsg } from '../Playground.types';

export default function PlaygroundPanel() {
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
      const { data, error } = await supabase.functions.invoke('agente-playground', {
        body: {
          message,
          history: historyForRequest,
        },
      });
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
      setHistory([...nuevoHistorial, { role: 'assistant', content: reply, meta }]);
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
          <MessageCircle className="h-4 w-4 text-accent" />
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
                m.role === 'user' ? 'bg-accent text-foreground' : 'bg-background border',
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
        <Button onClick={handleEnviar} disabled={!input.trim() || enviando} size="sm">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Enviar
        </Button>
      </div>
    </div>
  );
}
