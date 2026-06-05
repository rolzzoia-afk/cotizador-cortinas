// Agrupa los handlers async del módulo: cada uno envuelve una
// mutation o un grupo de mutations con try/catch + notificación
// (éxito/error). Devuelve callbacks listos para los componentes.
//
// Razón de ser: el orquestador `Pagina.tsx` no debería tener 150
// líneas de try/catch repetitivos — los movemos acá.

import { useCallback } from 'react';
import type { CompanyProfile, DiscountHistoryEntry, InventoryItem } from '../types';
import type { UseInventarioMutations } from './useInventarioMutations';
import type { UseImagenStorage } from './useImagenStorage';
import type { UsePerfilEmpresa } from './usePerfilEmpresa';
import type { NotificationType } from './useNotification';

type TriggerNotification = (message: string, type?: NotificationType) => void;

interface UseInventarioHandlersArgs {
  items: InventoryItem[];
  historyLogs: DiscountHistoryEntry[];
  /** Puede ser null mientras los datos están cargando. Los handlers que lo usan se llaman solo cuando ya hay profile. */
  profile: CompanyProfile | null;
  puedeEditarStock: boolean;
  emailUsuario: string | null;
  muts: UseInventarioMutations;
  imagen: UseImagenStorage;
  perfilEmpresa: UsePerfilEmpresa;
  triggerNotification: TriggerNotification;
}

export type UseInventarioHandlers = {
  handleStockAdjustment: (
    itemId: string,
    meters: number,
    actionType: 'DESCUENTO' | 'INCREMENTO',
    comment: string,
  ) => Promise<void>;
  handleAddProduct: (newProduct: Omit<InventoryItem, 'id'>) => Promise<void>;
  handleDeleteItem: (itemId: string) => Promise<void>;
  handleSaveProfile: (newProfile: CompanyProfile) => Promise<void>;
  handleUploadImage: (file: File, tipo: 'logo' | 'banner') => Promise<string>;
  handleDeleteLog: (logId: string) => Promise<void>;
  handleResetInventario: () => Promise<void>;
  handleClearLogs: () => Promise<void>;
};

export function useInventarioHandlers({
  items,
  historyLogs,
  profile,
  puedeEditarStock,
  emailUsuario,
  muts,
  imagen,
  perfilEmpresa,
  triggerNotification,
}: UseInventarioHandlersArgs): UseInventarioHandlers {
  const errorMsg = (e: unknown) => 'Error: ' + (e instanceof Error ? e.message : String(e));

  const handleStockAdjustment = useCallback<UseInventarioHandlers['handleStockAdjustment']>(
    async (itemId, meters, actionType, comment) => {
      try {
        await muts.ajustarStock(itemId, meters, actionType, comment, emailUsuario || 'desconocido');
        const item = items.find((i) => i.id === itemId);
        const verbo = actionType === 'DESCUENTO' ? 'descontaron' : 'añadieron';
        triggerNotification(`¡Stock modificado! Se ${verbo} ${meters} metros de "${item?.descripcion || ''}".`);
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [items, muts, emailUsuario, triggerNotification],
  );

  const handleAddProduct = useCallback<UseInventarioHandlers['handleAddProduct']>(
    async (newProduct) => {
      try {
        await muts.agregarRollo(newProduct);
        triggerNotification(`Se añadió "${newProduct.descripcion}" al catálogo.`);
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [muts, triggerNotification],
  );

  const handleDeleteItem = useCallback<UseInventarioHandlers['handleDeleteItem']>(
    async (itemId) => {
      try {
        const target = items.find((i) => i.id === itemId);
        await muts.eliminarRollo(itemId);
        triggerNotification(`Se eliminó "${target?.descripcion || ''}".`, 'info');
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [items, muts, triggerNotification],
  );

  const handleSaveProfile = useCallback<UseInventarioHandlers['handleSaveProfile']>(
    async (newProfile) => {
      try {
        await perfilEmpresa.guardarPerfil(newProfile);
        triggerNotification('Perfil corporativo guardado.');
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [perfilEmpresa, triggerNotification],
  );

  const handleUploadImage = useCallback<UseInventarioHandlers['handleUploadImage']>(
    async (file, tipo) => {
      if (!profile) throw new Error('Perfil aún no cargado');
      const url = await imagen.subirImagen(file, tipo);
      const updated: CompanyProfile = {
        ...profile,
        [tipo === 'logo' ? 'logoUrl' : 'bannerUrl']: url,
      };
      await perfilEmpresa.guardarPerfil(updated);
      triggerNotification(`${tipo === 'logo' ? 'Logo' : 'Banner'} subido correctamente.`);
      return url;
    },
    [imagen, perfilEmpresa, profile, triggerNotification],
  );

  const handleDeleteLog = useCallback<UseInventarioHandlers['handleDeleteLog']>(
    async (logId) => {
      try {
        await muts.borrarMovimiento(logId);
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [muts, triggerNotification],
  );

  const handleResetInventario = useCallback<UseInventarioHandlers['handleResetInventario']>(
    async () => {
      if (!puedeEditarStock) {
        triggerNotification('Solo administradores pueden reiniciar el inventario.', 'error');
        return;
      }
      if (!confirm('¿Reiniciar TODO el inventario? Cada rollo vuelve a su stock original (descarta todos los descuentos). Queda registro de cada cambio en el historial.')) return;
      try {
        await muts.reiniciarInventario(emailUsuario || 'desconocido');
        triggerNotification('Inventario reiniciado al stock original.', 'info');
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [puedeEditarStock, muts, emailUsuario, triggerNotification],
  );

  const handleClearLogs = useCallback<UseInventarioHandlers['handleClearLogs']>(
    async () => {
      if (!confirm('¿Vaciar TODO el historial? No se puede deshacer.')) return;
      try {
        for (const log of historyLogs) {
          await muts.borrarMovimiento(log.id);
        }
        triggerNotification('Historial vaciado.', 'info');
      } catch (e) {
        triggerNotification(errorMsg(e), 'error');
      }
    },
    [historyLogs, muts, triggerNotification],
  );

  return {
    handleStockAdjustment,
    handleAddProduct,
    handleDeleteItem,
    handleSaveProfile,
    handleUploadImage,
    handleDeleteLog,
    handleResetInventario,
    handleClearLogs,
  };
}
