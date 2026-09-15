// Inventario → Configuración → Reconocer con la cámara.
//
// Dos cosas que solo hace quien administra:
//   1. INDEXAR LAS FOTOS QUE YA ESTÁN. Muchos artículos tienen foto en su ficha;
//      con un botón se convierten en fotos de referencia, sin que nadie
//      fotografíe nada de nuevo. Es la forma de partir con algo el primer día.
//   2. MIRAR SI ESTÁ ACERTANDO. La tabla de abajo es la que se usa para mover
//      los umbrales: la banda «Muy parecido» tiene que acertar 9 de cada 10. Si
//      acierta menos, el umbral está bajo; si casi no aparece, está alto.

import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { textoDeBanda, type Banda, type DominioReconocimiento } from '@/modules/inventario/reconocimiento';
import {
  aciertoPorBanda,
  articulosEnsenados,
  conteoFotos,
  reindexarFichas,
  type ArticuloEnsenado,
} from '@/modules/inventario/reconocimientoStore';

type Conteos = { insumo: number; tela: number; consultas: number };
type Acierto = { banda: string; total: number; acertadas: number; msMediano: number };

export function ReconocimientoSection({ activo }: { activo: boolean }) {
  const { empresaId } = useAuth();
  const [conteos, setConteos] = useState<Conteos | null>(null);
  const [acierto, setAcierto] = useState<Acierto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [indexando, setIndexando] = useState<DominioReconocimiento | null>(null);
  const [avance, setAvance] = useState('');
  const [verLista, setVerLista] = useState<DominioReconocimiento | null>(null);
  const [lista, setLista] = useState<ArticuloEnsenado[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setCargando(true);
    try {
      const [c, a] = await Promise.all([conteoFotos(empresaId), aciertoPorBanda(empresaId)]);
      setConteos(c);
      setAcierto(a);
    } catch {
      /* el panel es informativo: si no se puede leer, no se muestra nada */
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (activo) void cargar();
  }, [activo, cargar]);

  /** Qué artículos quedaron listos: sin esto, el número de arriba no sirve para probar. */
  const verCuales = async (dominio: DominioReconocimiento) => {
    if (verLista === dominio) {
      setVerLista(null);
      return;
    }
    setVerLista(dominio);
    if (!empresaId) return;
    setCargandoLista(true);
    try {
      setLista(await articulosEnsenados(empresaId, dominio));
    } catch {
      setLista([]);
    } finally {
      setCargandoLista(false);
    }
  };

  const indexar = async (dominio: DominioReconocimiento) => {
    setIndexando(dominio);
    setAvance('Empezando…');
    try {
      const r = await reindexarFichas(dominio, (a) =>
        setAvance(
          a.esperando
            ? `${a.indexadas} indexadas · ${a.esperando}`
            : `${a.indexadas} indexadas · ${a.pendientes} por hacer`,
        ),
      );
      toast.success(
        r.indexadas === 0
          ? 'No había fotos nuevas que indexar'
          : `${r.indexadas} fotos indexadas${r.errores > 0 ? ` · ${r.errores} no se pudieron` : ''}`,
      );
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexando(null);
      setAvance('');
    }
  };

  if (!activo) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-medium">Reconocer artículos con la cámara</h3>
        <p className="text-xs text-muted-foreground">
          Está apagado. Se enciende más arriba, en los interruptores, después de correr el SQL del
          reconocimiento y dejar puesta la llave del servicio de huellas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Reconocer artículos con la cámara</h3>
          <p className="text-xs text-muted-foreground">
            El sistema solo reconoce lo que se le enseñó. Acá se parte: se indexan de una vez las
            fotos que los artículos ya tienen en su ficha.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualizar
        </Button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        {[
          { rotulo: 'Fotos de insumos', valor: conteos?.insumo, dominio: 'insumo' as const },
          { rotulo: 'Fotos de telas', valor: conteos?.tela, dominio: 'tela' as const },
          { rotulo: 'Consultas hechas', valor: conteos?.consultas, dominio: null },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-md border border-border bg-background p-2.5">
            <p className="text-[0.7rem] text-muted-foreground">{c.rotulo}</p>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-medium">{(c.valor ?? 0).toLocaleString('es-CL')}</p>
              {c.dominio && (c.valor ?? 0) > 0 && (
                <button
                  type="button"
                  className="text-[0.7rem] text-muted-foreground underline hover:text-foreground"
                  onClick={() => void verCuales(c.dominio)}
                >
                  {verLista === c.dominio ? 'ocultar' : 'ver cuáles'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {verLista && (
        <div className="mb-3 rounded-md border border-border bg-background p-2.5">
          <p className="mb-1.5 text-[0.7rem] text-muted-foreground">
            {cargandoLista
              ? 'Buscando…'
              : `${lista.length.toLocaleString('es-CL')} ${
                  verLista === 'insumo' ? 'insumos' : 'telas'
                } se pueden reconocer hoy. Con estos se prueba.`}
          </p>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {lista.map((a) => (
                  <tr key={a.cod} className="border-b border-border/60 last:border-0">
                    <td className="w-20 py-1 font-medium">{a.cod}</td>
                    <td className="py-1 text-muted-foreground">{a.nombre}</td>
                    <td className="w-16 py-1 text-right text-muted-foreground">
                      {a.fotos === 1 ? '1 foto' : `${a.fotos} fotos`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['insumo', 'tela'] as const).map((d) => (
          <Button
            key={d}
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void indexar(d)}
            disabled={indexando !== null}
          >
            {indexando === d ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Indexar las fotos de {d === 'insumo' ? 'los insumos' : 'las telas'}
          </Button>
        ))}
        {avance && <span className="text-xs text-muted-foreground">{avance}</span>}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium">Cómo viene acertando</p>
        <p className="mb-2 text-[0.7rem] text-muted-foreground">
          De las últimas 300 consultas confirmadas: cuántas veces el primero de la lista era el
          artículo correcto. «Muy parecido» debería andar sobre el 90 %.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1 font-normal">Banda</th>
              <th className="py-1 text-right font-normal">Consultas</th>
              <th className="py-1 text-right font-normal">Acertó primero</th>
              <th className="py-1 text-right font-normal">Tiempo típico</th>
            </tr>
          </thead>
          <tbody>
            {acierto.map((a) => (
              <tr key={a.banda} className="border-b border-border/60 last:border-0">
                <td className="py-1.5">{textoDeBanda(a.banda as Banda)}</td>
                <td className="py-1.5 text-right">{a.total}</td>
                <td className="py-1.5 text-right">
                  {a.total === 0 ? '—' : `${Math.round((a.acertadas / a.total) * 100)} %`}
                </td>
                <td className="py-1.5 text-right">
                  {a.msMediano === 0 ? '—' : `${(a.msMediano / 1000).toFixed(1)} s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReconocimientoSection;
