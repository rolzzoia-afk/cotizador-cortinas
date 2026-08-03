// Admin → Inventario en vivo: la tabla cruda de `colmena_tubos` con realtime.
// La vista ESPACIAL (qué hay en cada ubicación) vive en /historial-tubos →
// Colmena; esta es la tabla plana para buscar un tubo puntual.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Grid3x3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Tubo = {
  id: string;
  n_colmena: string | null;
  cod: string | null;
  medida_cm: number | null;
  medida_mm: number | null;
  serial: string | null;
  agregado_por_admin: boolean | null;
  created_at: string | null;
};

interface VistaInventarioProps {
  empresaId: string | null | undefined;
}

export default function VistaInventario({ empresaId }: VistaInventarioProps) {
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('colmena_tubos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('n_colmena')
        .order('created_at');
      setTubos((data as Tubo[]) ?? []);
    };
    run();
    const ch = supabase
      .channel(`admin-tubos-${crypto.randomUUID()}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'colmena_tubos', filter: `empresa_id=eq.${empresaId}` },
        run,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  const stats = useMemo(() => {
    const total = tubos.length;
    const admin = tubos.filter((t) => t.agregado_por_admin).length;
    const codigosUnicos = new Set(tubos.map((t) => (t.cod ?? '').toUpperCase())).size;
    const ubicaciones = new Set(tubos.map((t) => t.n_colmena ?? '—')).size;
    return { total, admin, codigosUnicos, ubicaciones };
  }, [tubos]);

  const filtrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return tubos;
    return tubos.filter((t) =>
      `${t.n_colmena ?? ''} ${t.cod ?? ''} ${t.serial ?? ''} ${t.medida_cm ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [tubos, filtro]);

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Inventario en vivo — Colmena de tubos
        </h2>
        <Button asChild variant="secondary" size="sm" className="ml-auto">
          <Link to="/historial-tubos" className="flex items-center gap-1.5">
            <Grid3x3 className="h-3.5 w-3.5" />
            Ver colmena por ubicación
          </Link>
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap gap-3">
        <StatCard value={stats.total} label="Tubos total" />
        <StatCard value={stats.ubicaciones} label="Ubicaciones" />
        <StatCard value={stats.admin} label="Agregados por admin" />
        <StatCard value={stats.codigosUnicos} label="Códigos únicos" />
      </div>

      <Input
        placeholder="Buscar por código, colmena o serial…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="mb-3 max-w-sm"
      />

      <div className="max-h-[600px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>N° Colmena</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Medida (cm)</TableHead>
              <TableHead>Medida (mm)</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {tubos.length === 0 ? 'No hay tubos en el inventario' : 'Sin coincidencias'}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.n_colmena ?? '—'}</TableCell>
                  <TableCell className="font-mono">{t.cod ?? '—'}</TableCell>
                  <TableCell>{t.medida_cm ?? '—'}</TableCell>
                  <TableCell>{t.medida_mm ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{t.serial ?? '—'}</TableCell>
                  <TableCell>
                    {t.agregado_por_admin ? <Badge variant="warning">Admin</Badge> : '—'}
                  </TableCell>
                  <TableCell>{formatDate(t.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[120px] rounded-md border bg-background p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
