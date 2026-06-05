// Sección "Agente IA" del AdminPanel. Wrapper que compone las 4
// sub-secciones: configuración, editor de docs, vendedoras activas y
// playground de pruebas. Cada sub-sección vive en su archivo bajo
// ./agente-ia/sections/.

import { Bot } from 'lucide-react';
import Configuracion from './agente-ia/sections/Configuracion';
import EditorDocs from './agente-ia/sections/EditorDocs';
import VendedorasPanel from './agente-ia/sections/VendedorasPanel';
import PlaygroundPanel from './agente-ia/sections/PlaygroundPanel';

export function AgenteIASection() {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-accent" />
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
