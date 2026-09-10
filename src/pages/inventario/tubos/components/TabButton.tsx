// Se unificó en @/components/ui/tab-button (era la misma pieza repetida en
// Tubos, Producción e Inventario). Se re-exporta para no tocar a quienes ya lo
// importaban desde acá; el archivo se borra en la etapa de retiros.

export { TabButton as default, type TabButtonProps } from '@/components/ui/tab-button';
