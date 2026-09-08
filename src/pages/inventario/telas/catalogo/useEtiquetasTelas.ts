// Imprimir y exportar las etiquetas de las telas.
//
// Estaba dentro de la pestaña del catálogo, pero ahora los botones viven en el
// encabezado y el «···» de cada fila hace lo mismo con una sola tela: el
// procedimiento se saca acá para que los dos llamen exactamente al mismo.

import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm';
import { imprimirHtml } from '@/lib/imprimirHtml';
import { LOGO_ROLZZO } from '@/modules/cotizador/logoRolzzo';
import { usePlantillaEtiqueta } from '@/modules/etiquetas/plantillasStore';
import {
  combinarEtiquetas,
  datosEtiquetaCatalogo,
  htmlEtiquetasCatalogo,
} from '@/modules/telas/etiquetaCatalogo';
import {
  construirFilasEtiquetas,
  descargarEtiquetasPtouchXlsx,
} from '@/modules/telas/exportEtiquetasPtouch';
import type { Colmena, Tela } from '../Telas.types';

// Sobre esta cantidad se pregunta antes de mandar a la impresora: son
// etiquetas físicas, no una vista previa que se pueda cerrar sin costo.
const AVISO_DESDE = 20;

export function useEtiquetasTelas() {
  const confirmar = useConfirm();
  // El diseño de la etiqueta, tal como quedó en Admin → Etiquetas. Se pide al
  // montar la pantalla para tenerlo listo cuando se apriete Imprimir.
  const { plantilla } = usePlantillaEtiqueta('catalogo');

  /** La etiqueta del catálogo de muestras, en la Brother. */
  const imprimir = async (lote: Tela[], combinar = false) => {
    if (lote.length === 0) {
      toast.error('No hay telas para etiquetar con los filtros actuales.');
      return;
    }
    const etiquetas = combinar ? [combinarEtiquetas(lote)] : lote.map(datosEtiquetaCatalogo);
    if (
      etiquetas.length >= AVISO_DESDE &&
      !(await confirmar({
        titulo: 'Imprimir etiquetas de catálogo',
        mensaje: `Se van a imprimir ${etiquetas.length} etiquetas. ¿Seguir?`,
        confirmLabel: 'Imprimir',
      }))
    ) {
      return;
    }
    // La plantilla ya está cargada (se pide al montar): si se esperara acá, el
    // `window.open` dejaría de ser parte del clic y el navegador lo bloquearía
    // como popup.
    imprimirHtml(htmlEtiquetasCatalogo(etiquetas, LOGO_ROLZZO, plantilla));
  };

  /** El Excel que el P-touch Editor lee como base de datos. */
  const exportarPtouch = (lista: Tela[], colmena: Colmena) => {
    if (lista.length === 0) {
      toast.error('No hay telas para exportar con los filtros actuales.');
      return;
    }
    // Nombre FIJO: P-touch Editor vincula la base de datos por ruta de archivo;
    // un nombre con fecha rompería el vínculo de la plantilla en cada export.
    descargarEtiquetasPtouchXlsx(construirFilasEtiquetas(lista, colmena), 'etiquetas-ptouch.xlsx');
    toast.success(
      `${lista.length} etiqueta${lista.length === 1 ? '' : 's'} exportada${
        lista.length === 1 ? '' : 's'
      }. Vincula el archivo como base de datos en P-touch Editor.`,
    );
  };

  return { imprimir, exportarPtouch };
}
