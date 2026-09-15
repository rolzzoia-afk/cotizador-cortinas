// Lo que no calzó en una recepción, como lo va a leer Gerencia: primero los
// errores, después los avisos, cada uno con su texto y sus fotos.

import { useState } from 'react';
import { CheckCircle2, ImageIcon, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { TITULOS_DIFERENCIA, type Diferencia } from '@/modules/inventario/recepcionDiferencias';
import { urlFirmadaDocumento } from '@/modules/inventario/recepcionStore';

export function ResumenDiferencias({
  diferencias,
  vacio = 'Todo calza: lo contado es lo facturado, y lo facturado es lo que se pidió.',
}: {
  diferencias: Diferencia[];
  vacio?: string;
}) {
  if (diferencias.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/35 bg-success/[0.08] px-3.5 py-2.5 text-xs">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {vacio}
      </div>
    );
  }
  const ordenadas = [
    ...diferencias.filter((d) => d.gravedad === 'error'),
    ...diferencias.filter((d) => d.gravedad !== 'error'),
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {ordenadas.map((d, i) => (
        <li
          key={`${d.tipo}-${d.linea_id ?? d.orden_linea_id ?? ''}-${i}`}
          className={
            d.gravedad === 'error'
              ? 'rounded-lg border border-destructive/35 bg-destructive/[0.06] px-3 py-2 text-xs leading-relaxed'
              : 'rounded-lg border border-warning/35 bg-warning/[0.07] px-3 py-2 text-xs leading-relaxed'
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <TriangleAlert
              className={d.gravedad === 'error' ? 'h-3.5 w-3.5 text-destructive' : 'h-3.5 w-3.5 text-warning'}
            />
            <Badge variant={d.gravedad === 'error' ? 'destructive' : 'warning'}>
              {TITULOS_DIFERENCIA[d.tipo] ?? d.tipo}
            </Badge>
            <span>{d.texto}</span>
          </div>
          {d.nota && <p className="mt-1 text-muted-foreground">Nota: {d.nota}</p>}
          {(d.fotos ?? []).length > 0 && <FotosDiferencia fotos={d.fotos ?? []} />}
        </li>
      ))}
    </ul>
  );
}

function FotosDiferencia({ fotos }: { fotos: string[] }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const ver = async () => {
    setCargando(true);
    const u = (await Promise.all(fotos.map((f) => urlFirmadaDocumento(f)))).filter((x): x is string => !!x);
    setCargando(false);
    if (u.length === 0) toast.error('No se pudieron abrir las fotos.');
    setUrls(u);
  };

  if (!urls) {
    return (
      <button
        type="button"
        onClick={() => void ver()}
        disabled={cargando}
        className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[0.7rem] hover:bg-secondary"
      >
        <ImageIcon className="h-3 w-3" /> {cargando ? 'Abriendo…' : `Ver ${fotos.length === 1 ? 'la foto' : `las ${fotos.length} fotos`}`}
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
          <img src={u} alt="Foto del problema" className="h-20 w-20 rounded-md border border-border object-cover" />
        </a>
      ))}
    </div>
  );
}

export default ResumenDiferencias;
