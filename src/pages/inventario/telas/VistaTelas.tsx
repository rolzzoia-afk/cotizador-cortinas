// Catálogo de telas: el saldo en metros de cada código y sus fallas
// (lámina «Telas»).
//
// El saldo se lleva en METROS y en dos bodegas —materias primas y liberado—;
// los rollos son una forma de mirar, no una unidad que se guarde. Los
// movimientos, las mermas y la colmena de paños salieron de acá y son
// submódulos propios; la lectura la comparten todos por `telasStore`, que ya no
// trae los más de 2.000 paños salvo que se los pidan.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Boxes, Loader2, PencilRuler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { useAuth } from '@/lib/auth';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import {
  filtrarTelas,
  FILTROS_TELAS_VACIOS,
  opcionesTelas,
  ordenarTelas,
  resumenTelas,
  type ColumnaTelas,
  type FiltrosTelas as Filtros,
  type SentidoOrden,
} from '@/modules/inventario/telasCatalogo';
import AccionesTelas from './catalogo/AccionesTelas';
import FiltrosTelas from './catalogo/FiltrosTelas';
import NotasTelas from './catalogo/NotasTelas';
import TablaTelas from './catalogo/TablaTelas';
import { useEtiquetasTelas } from './catalogo/useEtiquetasTelas';
import ClonarCodigoDialog from './dialogs/ClonarCodigoDialog';
import ImportarCatalogoDialog from './dialogs/ImportarCatalogoDialog';
import QRTelaDialog from './dialogs/QRTelaDialog';
import TelaDialog from './dialogs/TelaDialog';
import FallasTab from './tabs/FallasTab';
import type { Tela } from './Telas.types';
import { useInventario } from '../InventarioLayout';

type Pestana = 'catalogo' | 'fallas';

export function Telas() {
  const { empresaId } = useAuth();
  const { queryRol, puedeEditar } = useInventario();
  const [tab, setTab] = useState<Pestana>('catalogo');
  const { telas, fallas, validadores, colmena, loading, error, recargar } = useDatosTelas();
  const { imprimir, exportarPtouch } = useEtiquetasTelas();

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_TELAS_VACIOS);
  const [orden, setOrden] = useState<ColumnaTelas>('codigo');
  const [sentido, setSentido] = useState<SentidoOrden>('asc');
  // La selección para etiquetas va por CÓDIGO: el id cambia si se recarga.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  // `undefined` = cerrado, `null` = creando una nueva.
  const [editando, setEditando] = useState<Tela | null | undefined>(undefined);
  const [qr, setQr] = useState<Tela | null>(null);
  const [clonar, setClonar] = useState(false);
  const [importar, setImportar] = useState(false);

  const resumen = useMemo(() => resumenTelas(telas), [telas]);
  const opciones = useMemo(() => opcionesTelas(telas), [telas]);
  const lista = useMemo(
    () => ordenarTelas(filtrarTelas(telas, filtros), orden, sentido),
    [telas, filtros, orden, sentido],
  );
  const resumenLista = useMemo(() => resumenTelas(lista), [lista]);
  const sinMetrosRollo = useMemo(
    () => telas.filter((t) => !(Number(t.metros_rollo ?? 0) > 0)).length,
    [telas],
  );
  const fallasPendientes = useMemo(
    () => fallas.filter((f) => f.resuelto === 'NO').length,
    [fallas],
  );

  // En el orden en que se marcaron: al combinar, la primera es la que manda
  // (de ella salen tipo, descripción, ancho y calidad).
  const marcadas = useMemo(() => {
    const porCodigo = new Map(telas.map((t) => [t.codigo, t]));
    return [...seleccion].map((c) => porCodigo.get(c)).filter((t): t is Tela => !!t);
  }, [telas, seleccion]);

  const marcar = (codigo: string) =>
    setSeleccion((s) => {
      const next = new Set(s);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });

  const marcarTodas = () =>
    setSeleccion((s) =>
      lista.length > 0 && lista.every((t) => s.has(t.codigo))
        ? new Set()
        : new Set(lista.map((t) => t.codigo)),
    );

  const ordenarPor = (col: ColumnaTelas) => {
    if (col === orden) setSentido(sentido === 'asc' ? 'desc' : 'asc');
    else {
      setOrden(col);
      setSentido('asc');
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        miga="Inventario"
        titulo="Telas"
        hint={
          loading
            ? 'Cargando…'
            : `${resumen.total.toLocaleString('es-CL')} códigos · ${resumen.conStock.toLocaleString('es-CL')} con stock · ${resumen.bajoMinimo.toLocaleString('es-CL')} bajo mínimo · el saldo se lleva en metros`
        }
        acciones={
          tab === 'catalogo' && !loading && !error ? (
            <AccionesTelas
              marcadas={seleccion.size}
              visibles={lista.length}
              puedeEditar={puedeEditar}
              onImprimirCatalogo={() => void imprimir(seleccion.size ? marcadas : lista)}
              onCombinar={() => void imprimir(marcadas, true)}
              onExportarPtouch={() => exportarPtouch(lista, colmena)}
              onImportar={() => setImportar(true)}
              onNueva={() => setEditando(null)}
              onClonar={() => setClonar(true)}
            />
          ) : undefined
        }
      />

      {/* Movimientos, mermas y la colmena de paños ahora son submódulos
          propios: acá quedan el catálogo y las fallas, que son de la tela. */}
      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={tab === 'catalogo'}
          onClick={() => setTab('catalogo')}
          badge={<Badge variant={tab === 'catalogo' ? 'accent' : 'muted'}>{resumen.total}</Badge>}
        >
          <Boxes className="h-4 w-4" /> Catálogo
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'fallas'}
          onClick={() => setTab('fallas')}
          badge={
            <Badge variant={fallasPendientes > 0 ? 'destructive' : 'muted'}>
              {fallasPendientes > 0 ? fallasPendientes : fallas.length}
            </Badge>
          }
        >
          <AlertTriangle className="h-4 w-4" /> Fallas
        </TabButton>
        <Link
          to={`/inventario/colmena${queryRol}`}
          className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 py-2.5 text-[0.845rem] font-medium text-muted-foreground hover:text-foreground"
        >
          <PencilRuler className="h-4 w-4" /> Colmena de paños
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === 'catalogo' ? (
        <>
          <FiltrosTelas filtros={filtros} onFiltros={setFiltros} opciones={opciones} />
          <TablaTelas
            filas={lista}
            total={resumen.total}
            orden={orden}
            sentido={sentido}
            onOrden={ordenarPor}
            seleccion={seleccion}
            onMarcar={marcar}
            onMarcarTodas={marcarTodas}
            rutaFicha={(codigo) => `/inventario/telas/${encodeURIComponent(codigo)}${queryRol}`}
            onEditar={setEditando}
            onQr={setQr}
            onEtiqueta={(t) => void imprimir([t])}
            sinAncho={resumenLista.sinAncho}
          />
          <NotasTelas sinMetrosRollo={sinMetrosRollo} />
        </>
      ) : (
        <FallasTab
          fallas={fallas}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={recargar}
        />
      )}

      {editando !== undefined && (
        <TelaDialog
          tela={editando}
          validadores={validadores}
          empresaId={empresaId || ''}
          onImprimirEtiqueta={(t) => void imprimir([t])}
          onClose={() => setEditando(undefined)}
          onSaved={() => {
            setEditando(undefined);
            recargar();
          }}
        />
      )}
      {qr && <QRTelaDialog tela={qr} colmena={colmena} onClose={() => setQr(null)} />}
      {clonar && <ClonarCodigoDialog onClose={() => setClonar(false)} onSaved={recargar} />}
      {importar && <ImportarCatalogoDialog onClose={() => setImportar(false)} onSaved={recargar} />}
    </div>
  );
}

export default Telas;
