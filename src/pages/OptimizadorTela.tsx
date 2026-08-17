// ─────────────────────────────────────────────────────────────────────
// Optimizador de Tela — selector de OT + parámetros de corte.
//
// El optimizador de tela (CotizadorTela / planCorte.ts) asigna los paños
// de una OT a los sobrantes de la colmena de telas. Necesita una OT, así
// que esta página lista las OTs activas y abre el optimizador de la
// elegida. Da una entrada propia en el menú (antes solo se llegaba
// navegando a /ots/:id/tela desde Fase 4).
//
// Tab "Parámetros de corte": valores de dimensionado seteables por
// empresa (extras de alto, reglas del rollo, mínimos de colmena) que el
// admin puede editar; el resto de roles los ve en solo lectura.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParametrosCorteTab } from './optimizador-tela/ParametrosCorteTab';
import { SelectorOTs } from './optimizador-tela/SelectorOTs';

type Tab = 'ots' | 'parametros';

const TABS: { k: Tab; l: string; i: React.ReactNode }[] = [
  { k: 'ots', l: 'OTs', i: <Scissors className="h-4 w-4" /> },
  { k: 'parametros', l: 'Parámetros de corte', i: <SlidersHorizontal className="h-4 w-4" /> },
];

export function OptimizadorTela() {
  const [tab, setTab] = useState<Tab>('ots');
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <Scissors className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Optimizador de Tela</h1>
          <p className="text-[13px] text-muted-foreground">
            Elige una OT para optimizar el corte de sus telas contra los sobrantes de la colmena.
          </p>
        </div>
      </header>

      <nav className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.k
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.i}
            {t.l}
          </button>
        ))}
      </nav>

      {tab === 'ots' && (
        <SelectorOTs
          onSelect={(o) => {
            localStorage.setItem('activeOTId', o.id);
            navigate(`/ots/${o.id}/tela`);
          }}
        />
      )}
      {tab === 'parametros' && <ParametrosCorteTab />}
    </div>
  );
}
