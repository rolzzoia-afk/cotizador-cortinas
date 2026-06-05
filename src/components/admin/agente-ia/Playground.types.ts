// Tipos del Playground del Agente IA (panel de chat de prueba).

export type DocUsado = {
  categoria: string;
  version: number;
  updated_at: string;
  caracteres: number;
};

export type PlaygroundMeta = {
  docs_usados: DocUsado[];
  usage: { input_tokens: number; output_tokens: number } | null;
  model: string;
  system_prompt_chars: number;
};

export type PlaygroundMsg = {
  role: 'user' | 'assistant';
  content: string;
  meta?: PlaygroundMeta;
};
