// Página para operario: conteo doble ciego tally por colmena.
// Cada operario ve SÓLO su propio conteo (RLS lo enforce). No ve el snapshot
// ni los conteos de los demás. Cuando el admin cierra el inventario, ya tendrá
// los dos conteos para reconciliar.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventario, useMisTallies } from '@/modules/admin/colmena';

export function InventarioConteo() {
  const navigate = useNavigate();
  const { empresaId, user } = useAuth();
  const { activo, loading: loadingInv } = useInventario();
  const { tallies, loading: loadingTallies, setConteo } = useMisTallies(
    activo?.id ?? null,
  );

  const [colmenas, setColmenas] = useState<string[]>([]);
  const [loadingColmenas, setLoadingColmenas] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  // Cargar colmenas del snapshot inicial. No exponemos cuántos tubos había
  // en cada una — sólo el nombre, para que el operario sepa qué contar.
  useEffect(() => {
    if (!activo || !empresaId) {
      setColmenas([]);
      setLoadingColmenas(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoadingColmenas(true);
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tubos_inventario_snapshot' as any)
        .select('n_colmena')
        .eq('inventario_id', activo.id);
      if (cancel) return;
      if (error) {
        toast.error('Error cargando colmenas: ' + error.message);
        setColmenas([]);
      } else {
        const setN = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((data as any[]) || []).forEach((r) => {
          if (r.n_colmena) setN.add(String(r.n_colmena));
        });
        const arr = Array.from(setN).sort((a, b) =>
          a.localeCompare(b, 'es', { numeric: true }),
        );
        setColmenas(arr);
      }
      setLoadingColmenas(false);
    })();
    return () => {
      cancel = true;
    };
  }, [activo, empresaId]);

  // Sync inputs con tallies existentes (sólo en montaje / cambio de tally)
  const talliesPorColmena = useMemo(() => {
    const m = new Map<string, number>();
    tallies.forEach((t) => m.set(t.n_colmena, t.conteo));
    return m;
  }, [tallies]);

  useEffect(() => {
    setInputs((prev) => {
      const next = { ...prev };
      colmenas.forEach((c) => {
        if (next[c] == null) {
          const existente = talliesPorColmena.get(c);
          if (existente != null) next[c] = String(existente);
        }
      });
      return next;
    });
  }, [colmenas, talliesPorColmena]);

  const guardar = async (nColmena: string) => {
    const raw = inputs[nColmena];
    if (raw == null || raw === '') {
      toast.warning('Ingresa un número antes de guardar');
      return;
    }
    const conteo = parseInt(raw, 10);
    if (!Number.isFinite(conteo) || conteo < 0) {
      toast.warning('Conteo inválido');
      return;
    }
    setGuardando(nColmena);
    try {
      await setConteo(nColmena, conteo);
      toast.success(`${nColmena}: ${conteo} tubos guardado`);
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(null);
    }
  };

  if (loadingInv) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (!activo) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="mb-2 text-base font-bold">Sin inventario activo</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Espera a que el admin inicie un inventario para registrar tu conteo.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  const totalContadas = tallies.length;
  const totalColmenas = colmenas.length;

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mb-1 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>
        </div>
        <h1 className="text-base font-bold text-warning">Conteo de inventario</h1>
        <div className="mt-1 text-[0.7rem] text-muted-foreground">
          {user?.email && <span>Tu sesión: {user.email}</span>}
          {' · '}
          {totalContadas}/{totalColmenas} colmenas contadas
        </div>
        <div className="mt-2 rounded border border-warning/30 bg-warning/10 p-2 text-[0.7rem] text-warning">
          Cada operario cuenta solo. No verás los conteos de los demás (doble ciego).
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-2 p-4">
        {loadingColmenas ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando colmenas…
          </div>
        ) : colmenas.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            El snapshot del inventario está vacío. Hablá con el admin.
          </div>
        ) : (
          colmenas.map((n) => {
            const yaGuardado = talliesPorColmena.has(n);
            const valorActual = talliesPorColmena.get(n);
            const inputValue = inputs[n] ?? '';
            const cambioPendiente =
              inputValue !== '' && parseInt(inputValue, 10) !== valorActual;
            return (
              <div
                key={n}
                className={
                  'flex items-center gap-3 rounded-lg border bg-card p-3 ' +
                  (yaGuardado && !cambioPendiente
                    ? 'border-success/30'
                    : 'border-border')
                }
              >
                <div className="flex-1">
                  <Label className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    Colmena
                  </Label>
                  <div className="font-mono text-base font-bold">{n}</div>
                  {yaGuardado && (
                    <div className="mt-0.5 text-[0.65rem] text-success">
                      Ya guardado{' '}
                      {valorActual != null && (
                        <span className="font-bold">({valorActual} tubos)</span>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={inputValue}
                  onChange={(e) =>
                    setInputs((p) => ({ ...p, [n]: e.target.value }))
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder={yaGuardado ? '' : '#'}
                  className="h-10 w-20 text-center text-base"
                />
                <Button
                  onClick={() => guardar(n)}
                  disabled={
                    guardando === n ||
                    inputValue === '' ||
                    !cambioPendiente
                  }
                  size="sm"
                  className="h-10 gap-1"
                >
                  {guardando === n ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>
      {loadingTallies && (
        <div className="pb-4 text-center text-[0.65rem] text-muted-foreground">
          Sincronizando tus conteos…
        </div>
      )}
    </div>
  );
}
