// Acordeón colapsable que muestra los detalles de la respuesta del agente
// en el Playground: tokens in/out, costo, docs leídos, modelo.

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { calcularCostoUSD, formatUSD } from '../utils/costo';
import type { PlaygroundMeta } from '../Playground.types';

interface MessageDetailsProps {
  meta: PlaygroundMeta;
}

export default function MessageDetails({ meta }: MessageDetailsProps) {
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
