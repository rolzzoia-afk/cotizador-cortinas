import { useState } from 'react';
import { Eye, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOTs } from '@/modules/ots/hooks';
import { useTelas } from '@/modules/admin/hooks';
import { Dashboard } from '@/components/ojo-de-dios/Dashboard';
import { Clientes } from '@/components/ojo-de-dios/Clientes';
import { Stock } from '@/components/ojo-de-dios/Stock';
import { Reportes } from '@/components/ojo-de-dios/Reportes';
import { Control } from '@/components/ojo-de-dios/Control';
import { Colmena } from '@/components/ojo-de-dios/Colmena';
import { Correcciones } from '@/components/ojo-de-dios/Correcciones';
import { Reconciliacion } from '@/components/ojo-de-dios/Reconciliacion';

type Tab =
  | 'dashboard'
  | 'clientes'
  | 'stock'
  | 'reportes'
  | 'colmena'
  | 'reconciliacion'
  | 'correcciones'
  | 'control';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'stock', label: 'Stock Telas' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'colmena', label: 'Colmena' },
  { id: 'reconciliacion', label: 'Reconciliación' },
  { id: 'correcciones', label: 'Correcciones' },
  { id: 'control', label: 'Control' },
];

export function OjoDeDios() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { ots, online } = useOTs();
  const { telas } = useTelas();

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-purple-400" />
          <div>
            <h2 className="text-base font-semibold">Ojo de Dios</h2>
            <p className="text-xs text-zinc-500">Panel de administración</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem]',
              online
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300',
            )}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10 bg-zinc-900/40 px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-t-md border border-b-0 px-4 py-2 text-xs font-medium transition',
              tab === t.id
                ? 'border-white/10 bg-zinc-950 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {tab === 'dashboard' && <Dashboard ots={ots} />}
        {tab === 'clientes' && <Clientes ots={ots} />}
        {tab === 'stock' && <Stock />}
        {tab === 'reportes' && <Reportes ots={ots} telas={telas} />}
        {tab === 'colmena' && <Colmena />}
        {tab === 'reconciliacion' && <Reconciliacion />}
        {tab === 'correcciones' && <Correcciones />}
        {tab === 'control' && <Control ots={ots} telas={telas} online={online} />}
      </div>
    </div>
  );
}
