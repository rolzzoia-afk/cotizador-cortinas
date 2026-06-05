// Paleta y estilo de tooltip compartidos por los charts del dashboard
// de Métricas de Leads.

export const COLORES_ORIGEN = [
  '#7F77DD',
  '#1D9E75',
  '#378ADD',
  '#EF9F27',
  '#888780',
  '#D85A30',
  '#D4537E',
];

export const COLORES_PERDIDA = ['#E24B4A', '#D85A30', '#888780'];

// Estilo de tooltip consistente y legible en modo oscuro
export const TOOLTIP_STYLE = {
  backgroundColor: '#1f1f1f',
  border: '1px solid #3a3a3a',
  borderRadius: 6,
  fontSize: 12,
  color: '#f5f5f5',
  padding: '6px 10px',
} as const;

export const TOOLTIP_ITEM_STYLE = { color: '#f5f5f5' };
export const TOOLTIP_LABEL_STYLE = { color: '#f5f5f5', fontWeight: 500, marginBottom: 2 };
