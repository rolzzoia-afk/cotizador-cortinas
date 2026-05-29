/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InventoryItem {
  id: string;
  cod: string;             // e.g. "BLACKOUT_D", "ACCESORIO"
  producto: string;        // e.g. "ROLLER BLACKOUT DELUX"
  cod_int: string;         // e.g. "BK 10" or "-"
  tipo: string;            // e.g. "DELUX", "PREMIUM"
  descripcion: string;     // e.g. "RUSTICO TOSTADO"
  telaVerticales: 'SI' | 'NO';
  descuento: string;       // e.g. "30%", "25%"
  rollos: number;          // number of rolls
  metros: number;          // meters per roll (or length per unit)
  totalMetros: number;     // actual available stock in meters
  comentario: string;      // e.g. "S/C", "STOCK LIMITAD"
}

export interface CompanyProfile {
  razonSocial: string;
  rut: string;
  instagram: string;
  paginaWeb: string;
  direccion: string;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export interface DiscountHistoryEntry {
  id: string;
  itemId: string;
  producto: string;
  cod_int: string;
  descripcion: string;
  cantidadMetros: number;
  anteriorMetros: number;
  nuevoMetros: number;
  tipoAccion: 'DESCUENTO' | 'INCREMENTO';
  fecha: string;
  comentario: string; // e.g., "Pedido #4321", "Merma de corte"
}
