// Vista "Trazabilidad": buscador de tubos por código/colmena/medida/OT
// + ficha completa al seleccionar uno. Permite navegar la cadena padre-hijo.

import { useState } from 'react';
import { Ruler, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import FichaCard from '../components/FichaCard';
import EmptyState from '../components/EmptyState';
import type { FichaTuboResp, TuboResultado } from '../HistorialTubos.types';

interface VistaTrazabilidadProps {
  empresaId: string | null | undefined;
}

export default function VistaTrazabilidad({ empresaId }: VistaTrazabilidadProps) {
  const [cod, setCod] = useState('');
  const [colmena, setColmena] = useState('');
  const [medida, setMedida] = useState('');
  const [otBuscar, setOTBuscar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<TuboResultado[] | null>(null);
  const [tuboSel, setTuboSel] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaTuboResp | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  const buscar = async () => {
    if (!empresaId) return;
    setError(null);
    if (!cod.trim() && !colmena.trim() && !medida.trim() && !otBuscar.trim()) {
      setError('Ingresa al menos un criterio: código, colmena, medida o número de OT.');
      setResultados(null);
      return;
    }
    let medidaNum: number | null = null;
    if (medida.trim()) {
      medidaNum = parseFloat(medida.trim().replace(',', '.'));
      if (!Number.isFinite(medidaNum) || medidaNum <= 0) {
        setError('La medida debe ser un número positivo (ej: 156 o 156.5).');
        setResultados(null);
        return;
      }
    }
    setLoading(true);
    setTuboSel(null);
    setFicha(null);
    // (supabase.rpc as any): RPCs nuevos, todavía no están en database.ts.
    const { data, error: err } = await (supabase.rpc as any)('buscar_tubos', {
      p_cod: cod.trim() || null,
      p_colmena: colmena.trim() || null,
      p_medida: medidaNum,
      p_ot: otBuscar.trim() || null,
      p_limit: 100,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      setResultados(null);
      return;
    }
    setResultados((data || []) as TuboResultado[]);
  };

  const verFicha = async (id: string) => {
    setTuboSel(id);
    setFicha(null);
    setLoadingFicha(true);
    const { data, error: err } = await (supabase.rpc as any)('ficha_tubo', {
      p_tubo_raiz_id: id,
    });
    setLoadingFicha(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFicha(data as FichaTuboResp);
    setTimeout(() => {
      document.getElementById('ficha-tubo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const limpiar = () => {
    setCod('');
    setColmena('');
    setMedida('');
    setOTBuscar('');
    setResultados(null);
    setTuboSel(null);
    setFicha(null);
    setError(null);
  };

  return (
    <>
      <div className="mb-3 rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Busca un tubo por sus datos físicos (código + colmena + medida) o por la OT en
          la que participó. Clickeá un resultado para ver su ficha completa: de dónde
          vino, qué se hizo con él, y qué piezas o sobrantes generó.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Código (ej: E13)"
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Input
            placeholder="Colmena (ej: A20)"
            value={colmena}
            onChange={(e) => setColmena(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Input
            placeholder="Medida cm (±0.5)"
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            inputMode="decimal"
          />
          <Input
            placeholder="OT (ej: 2944)"
            value={otBuscar}
            onChange={(e) => setOTBuscar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={buscar} disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar tubo'}
          </Button>
          {(cod || colmena || medida || otBuscar || resultados) && (
            <Button variant="outline" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!resultados && !loading && !error && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          Busca un tubo para ver su historia completa.
        </EmptyState>
      )}

      {resultados && resultados.length === 0 && (
        <EmptyState>
          <Search className="mx-auto mb-3 h-10 w-10" />
          No se encontraron tubos con esos criterios.
          <p className="mt-2 text-xs">
            Probá relajar algún criterio. Ten en cuenta que un tubo ya cortado no
            aparece por colmena/medida (cambia de identidad al cortarse) — para esos
            casos, buscá por OT.
          </p>
        </EmptyState>
      )}

      {resultados && resultados.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{resultados.length}</strong> tubo(s)
            encontrado(s) · Click en una fila para ver la ficha completa
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colmena</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Medida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((t) => (
                  <TableRow
                    key={t.tubo_raiz_id}
                    onClick={() => verFicha(t.tubo_raiz_id)}
                    className={cn(
                      'cursor-pointer hover:bg-primary/5',
                      tuboSel === t.tubo_raiz_id && 'bg-primary/10',
                    )}
                  >
                    <TableCell className="font-semibold">{t.n_colmena ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.cod ?? '—'}</TableCell>
                    <TableCell>
                      {t.medida_cm != null
                        ? `${Number(t.medida_cm).toFixed(1)} cm`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {t.en_inventario ? (
                        <Badge className="bg-success/20 text-success">En stock</Badge>
                      ) : (
                        <Badge variant="secondary">Consumido</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">→</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tuboSel && (
        <div id="ficha-tubo">
          {loadingFicha && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Cargando ficha...
            </div>
          )}
          {!loadingFicha && ficha && <FichaCard ficha={ficha} onVerTubo={verFicha} />}
        </div>
      )}
    </>
  );
}
