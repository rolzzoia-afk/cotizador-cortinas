// ─────────────────────────────────────────────────────────────────────
// Etiquetas Brother QL-810W — réplica de las plantillas oficiales de
// P-touch Editor (docs/referencias/ETIQ.*.lbx), impresas desde la app
// como PDF con el tamaño exacto de la etiqueta (rollo continuo 62 mm).
// El driver Brother corta cada página al largo indicado.
//
//  · ESTRUCTURA/ARMADO (62×95,5)  — una por cortina (fila del optimizador)
//  · PAÑOS            (62×51)    — una por paño de tela cortado
//  · CENEFA CUADRADA  (62×54,9)  — una por cortina con cenefa cuadrada
//
// Las posiciones (mm) vienen medidas de los .lbx originales. El QR es el
// mismo de las plantillas (WWW.CORTINASROLZZO.CL, branding).
// ─────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import type { CatalogoProductos, Pano } from './types';
import type { OptimizerRow, PiezaEtiqueta } from './tela';
import { colorPesoNormalizado } from '@/modules/descuentos/peso-oscuridad';
import { etiquetaConTira, medidaCorteCenefaCuadrada } from '@/modules/descuentos/adicionales-cenefa';

const EMPTY_PANO: Partial<Pano> = {};

type MetaPDF = {
  ot: string;
  cliente: string;
  fecha: string;
  empresa?: string;
};

// QR de las plantillas originales (contenido: WWW.CORTINASROLZZO.CL).
const QR_ROLZZO =
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAABEZSURBVHhe7Z1/SN3V/8ff/+3aFjqLWrIg/aOmwUgjmA57TyVGk/2h/TEy1kA3KB2jNaORbbe4xjKIXZj5z25ESzchlcm6C0m5my1zowzGMrHtZm64IFiMYP75/vJd/9z387w+nMO55+bdej7+fPN8nff7eh++4Zx7fngBITnAwwuEuIBikZxAsUhOoFgkJ1AskhMEscbGxqJh3nvvPbiSDWJr6sXR0VF8siA4cuQIxCYmJjAkkUwmoTAej2NIYnFxEQqj0ej169cxJxGPx6EwmUxiKAhisRjE1L/Ghx9+iGVBMDo6CjFD1PbFi+oVkbGxMXwyUawDBw54ecDu3bvxyYKgsLAQYl1dXRiSaG9vh8LS0lIMSXz33XdQ6Hne1NQU5iSeeOIJKOzo6MBQEEQiEYiprF27FsuCoK2tDXMrQWdnJz4ZxdJCsbRQrBAUyxUUKwTFcgXFCkGxXEGxQlAsV5iK9eabb0LlunXrMOSaDRs2wE3b2towJBGLxaAwEolgKAg6OjogZkhNTQ22FQSbNm2CWHNzM4Ykjh07BoWe5y0vL0PsnXfegUxRURFkgiBobW2FWHl5OYZc8+ijj8JNDxw4gCGKpYViARQrBMVyBcUKQbFcQbFCUCxXUKwQFMsV9mKpww0lJSUYuvuN+mG2bNkCV8SLBw8exLaCoKKiAm4qitXY2AitHTp0KBVmfHwcMr7vr1+/HtovKSmBwlQqVVtbC7HCwkJsy/eLioog9tJLL+GzSty4cQNvmUphKAjS6TRkLly4gCFpuKGiogJDQfD222/D89fV1cEV8WJ3dze2lY1Yhm+slpYWiBnS2NiIbRm/sUzGsZaXlyEjUlZWBoVBEDQ3N2PODEOx3GL4xtq2bRvEDHnllVewLYqlhWJpoVghKBZAsUJQLC0UKwTFcsU9JpZhr9CtWNa9wkQigaEggIzY5WlqaoKeVyqVev311yFWVVUFD+Z53rPPPgux9vZ2bCuVUscRDHHbK8wXsfL5jeWQa9euwR09zxseHoaY4eyGoaEhDHleOp2GmCFux7EoVgiKlQnF0kOxtFAsGyiWFoplA8XSQrFsoFha7k+x7q3hBpWtW7di2d1FyRAzHG7YuXMnhlKp27dvQ/t//vknhlKppqYmaM1w+XVXVxf8NYqLizHE4QZAFMvwjaVOK1ApKCjAMuPFFE1NTRCrrq7GkDGGiylU7s83FsXKhGIBFCsExbKAYoWgWADFCkGxMrkfxDLsFRpOTVZxOzVZ/fIeeOABLMuiVyiqMDMzA4Xnzp2DK6lUqqSkBJ5NbE0lkUjAY2zfvh1Dxr3Ce2xqslsM31gqhospVAzHsUSqq6ux0oy9e/diW1lg+MZyC8XSQLHsoFgaKJYdFEsDxbKDYmmgWHZQLA0Uyw57sdThhkgkAh1RcXBBvSJeVLu1vu+vWbMGbiqKpQ43GK6EPn36NDSVTqfhjp7njYyMQOzKlSvYlu/39/fDTVW/Pc8bHByEWE9PD7bl+3DHbIYbVq9eDYXmX4F6Ub3i+z7cMSuxVgTrHf3u3LkDGc/zent7IWb4xnI7bcbt3g2qWCuC6Y5+FCsTiqWFYoWgWK6gWCEolisoVgiK5QpTsfL5kCZVrNraWihUm/pfF1VmZ2fhjqJYu3fvhsIdO3ZgyPPeeOMNiL344osYuvu/AbHnn38eMuJ23PfYIU35TK6nzahMTU1B4YogipXPUCwNFMsOiqWBYtlBsTRQLDsolgaKZQfF0kCx7FgBsZLJJP7ZJMRxLJXu7m6slPjkk0+g0HAcy1CsbHb0W7VqFbQmTjZXMZzdoI5x1NfXYygInnnmGYi1tLRgKJvZDbmGYgEUyw0UC6BYbqBYAMVyA8UCKJYbKBZAsTQsLS3h75PRqPoL//z8PIaMf+9UJwKIc4JVVLFu3bqFrUs/Qi8uLmIoGn388cehfUOxLl68iG1JTE5OYqWE+iO0OolDFKusrAwKxa9AvRKNRlevXg2t5VysH3/8EW7ped7ExATmzDh+/Di25Xl//fUXxKzfWNmQ62Pl3GK4d8NPP/0EhQMDAxiSMJ02Yw3F0kKxbKBYWiiWDRRLC8WygWJpoVg2UCwtFCvE0tISNuZ5AwMDEJuZmcFQFhiOY6nDDYZL7LPB7RJ763Esw8UUZ8+ehcKJiQkMSYg7+hlCsWygWFoolg0USwvFsoFiaaFYNlAsLRTLBoqlRRDLcCX05cuXoVD8EVrdLltk7969WCmh9szPnz8PGfFpL126BIXZ/Ait3kK9Il5MJpPQ/v9/BwoNDQ1QqDYVjUbF86pV1JuKYr322mvQvnhTFdOV0G539Kuvr4fWRH755RcoNBzHUlmRvRuyIRKJ4A2cor6xxsfHMeR5MzMzEHM8jkWxMqFYWihWCIoFUCwNFAugWCEolivyRay+vj7YKFecdzs7OwtbAv/www8YMhbrxIkT0NrHH38Mj+H7/tdffw0xdepzEARYJu2avLS0hCHfV+cEi7sm//zzzxDLhhdeeAHaF7vSkPF9Xz0ESqSnpwf+aEePHsWQ5x0/fhxix44dw1tms2uyIS+//DLcoLKyEkPGYqmI41jqxmvqjn73AXmyo584jpXzxRQUK3dQrBAUyxUUKwTFcgXFCkGxXEGxQlAsV/ynxVKHG06dOoV9U9//7LPPINbT0wNPJg43zM3N4S2NxcKHkIYbDDEcbpicnMSQ79+8eRNiIyMjGJIOaerq6oKPKQ43HD16FP5on3/+OZYZow43qD/J/zOwB7GrV69iKBuxVAwXU3z11VcY8jzxM6iYiGU4QGqI4QCp2wMERLFUPv30UyicnZ3FkDHqYopsoFgaKJYdFEsDxbKDYmmgWHZQLA0Uyw5TsaAjkEqlzp07B1fEXqH6m/n09DSGfH9oaAhaE1E3Z1LFWl5ehoznefv374em1OcXL37xxRf4rFn0CrMRC1s37hVu3LgRCisrKzHkeYlEAloz/G8XMRLr5s2b+BQSVVVVWGlMeXk5NmfGu+++C02JYllTU1MD7WeDoVhux7HUaTPinHcVcRzLEIqlgWLZQbE0UCw7KJYGimUHxdJAseygWBoolh2CWOqc982bN+M9JUSx9u/fD60dPHgQQ0Fw6dIl6Osa8v7770P74rxsw+EG9TDmwsJCbN336+rq4Mrhw4fxI92dAAKxt956C2+ZSmGZNNxQXFyMoSCYm5uDpsQPtWfPHngMcbhBxbFY1qfYi2LV1dVBbNu2bRjKArc7+jU3N2OlGeJ6E3VNREdHB4YkDN9Yhhju6KdCsfRQLAsolh6KZQHF0kOxLKBYeiiWBTkXKxKJQLfC9/0tW7bAlT179mBbedwrnJ6exoeQxHLbK4zH4xi6u8UXPNvhw4ehcPv27VhmjKFYzz33HNx037598GBiH1ZEEMvt3g2G/PvjWGVlZVAYBEFTUxPEqqurMeQa6x39DFFP/xJR56H09/djyPPUKRsiFCsExcqEYoWgWADFsoFiaaFYNlAsLRTLBoqlJV/EUocbSkpKMCQxPz8P/VVxVMJwuKGzsxMew/O8M2fOQCzXww2GsxvEOe/qqIThcMPvv/+OITMWFhbgjr7vP/TQQ/ChRNThhqeffhpD2Yhl/cYyPECgsbERKyUMt4p0O0Bq/cYaHh6GQhHxAAGHZLNKx5A//vgD7ypBsUJQLC0UKwTFcgXFCkGxXEGxQlAsV9iLpfYKH3zwQTyYRzqkSVxi/+qrr0KhePSPeNEOsSnxogmJRAI+ZhAEiUQCYjt27MBPLiHObojFYtCa+rTqFfFie3s73tLzWlpaILZr1y4MSWzcuBEKRUwPaVLFEjl58iQUimKpezckk0kMSbjd0a+jowMKRUZGRrBSwu2xcv/+AQLZLKaw39GPYmmhWJlQLD0UKxOKpYdiZUKxEIplAcUKQbFckS9iGY5jtbS0QMwQw3GsRCKBlWYUFBRgW0Gg9sNLS0sxlHvcLrFvbW2FWHl5OYYkDI+Vczy7gWLlDooVgmK5gmKFoFiuoFghKJYrKFYIiuWK/7RY6nDDY489hqG7O5vjr5ES6jJzUaze3l6sNENdwi+KlUwmoVCcJayyuLgIhdFo9Pr165iTiMfjUChOP+/q6oKYuk1XQUEBZKLRaFVVFcQefvhhDEmIP0Kr+7xfvnwZK6PRv//+G2IigliGbyxD1C9e3Lthw4YNEGtra8OQRCwWg8JIJIKhLDA8QECktLQUK/MYVaxsoFgaKJYdFEsDxbKDYmmgWHZQLA0Uyw6KpYFi2SGIlc8UFRXh38MphrMbco3hOJYhhhuvWdPZ2Ym3pFgAxbKAYumhWBZQLD0UywKKpYdiWUCx9FAsC0zFGhsbg98d1RW32SC2pl4cHR3FJwuCI0eOQEwdzvA8DzJi+/v27cMyzxseHoY7ij9Cq62pV6LRqLohwMWLFzEUjUJGPKRp7dq1GAqC0dFRaEo8U1385duElVkJnWvExRQq1uNY165dg0JRrKmpKQwZ89tvv0FrKzJtxlqslpYWbMsYihWCYmVCsUJQLIBihaBYmVAsZ1CsTO5PscRDmgxRd01W9xL2fX/NmjVwU/FH6G+//RY2GFZ3Td66dSuW3d3RGQpPnToFdxSHG65cuQLt+76vjno88sgjGPL906dPw017enow5PvffPMNxHbu3Anti0f3fvTRR9DUrl27MCQNNxQVFUGhiHhIk8rVq1fxlqJYbmc3GGI4uyFPlthv2rQJCpubmzFkfKycyRJ7cbjBEPWNVV9fjyGJgYEBKBQxHceiWFooViYUSw/FyoRi6aFYmVAshGJZQLFCUKxM7gex1OEG8ZCmWCwGvVN1ZEG8KB7SVFFRATcVxTIZbhCHM9avXw/tixiKVVNTA4XiYePT09PwtPPz8xgKAmjqf4EfSUL9a4uHNBUXF2PI93/99Vd4sJMnT0KhSF5vvGb4xlIxPEDAEEOxDN9Yhpi8sf4F1MUUjt9YFEsLxcqEYumhWJlQLGdQrEwoljMoViaOxTLsFboVy7BXqHLixAns3khH9z711FOQUeUQxbp9+zb07P75kRhaa29vx1AqpU5buHHjBoZSqYaGBmhN7dhu3rwZn1X6UNn0CgcHB+HBDh06BIX/HIcGhX19ffAxZbHurTeWyp07d6Apz/PUyeCG02YMl9gPDQ1hyPPS6TTEDKfNqNy6dQvLPE88mUzFcByrsrISYiL2x8pRrEwoFkCxQlCsTCiWDRQLoFghKFYmFEsPxQL+K2LdW8MNKsvLy9CU53lqlzidTmNIGm4QF1N8//33EBsZGcGQ8WKK2tpa6MD39/dDYRAEMBaQSqXULdcXFhagKXG4oaGhAQqDIFA39xZRbyoiiMU3ViZu31i9vb0Ykvjggw+g0BDDU+xFsXL+xqJYmVAsgGKFoFiZUCwbKJYWimUDxdKyMmIZ9gpXZGqyysLCAvSVxsfH4Y7/LEqGwmx6hX19fXBTdaW/53nqz7riSmiVWCwGhRcuXIAHC4Jgbm4OYl9++SW2JX0Fra2tUJhKpZ588kl4/nXr1kGh7/tnzpyBwvthJbSK+o3mz94NKuJh4ypu925QyevDxt1CsTKhWM6gWJlQLGdQrEwoljMoViYUyxkUK5P7Uyx1uGFFcLujn+Fh401NTRCrrq7GkDGGS+xXrVoFse7ubgxJtLW1QaHI2bNnodDwsPFsoFghKJYrKFYIiuUKihWCYrmCYoWgWK6gWCEolisEsfL5kCaV8+fPQ6H4rSSTSYjF43EMBcHg4CDEDOeVi8TjcWgtmUxi6O7/BsQmJycxJKEe0iSibsqVTqcxFI0azjk2RBCLkOyhWCQnUCySEygWyQkUi+QEikVywv8BYmRxN/d0hhoAAAAASUVORK5CYII=';

// Estructura y cenefa usan la página de 62×100 mm (papel estándar "62mm x
// 100mm" del driver Brother, sin recortes ni reescalado desde el navegador).
// Los PAÑOS usan una página exacta de 62×51 mm para no gastar cinta en un
// sobrante blanco: en el driver se imprime con papel "62mm" y Longitud 51.
const ANCHO = 62;
const ALTO_PAGINA = 100;
const ALTO_PANO = 51; // bloques contiguos, 3 mm arriba y 0 abajo (offset del corte)
// Alto real del diseño de cenefa (medido del .lbx): bajo esta línea se recorta.
const FIN_CENEFA = 54.9;

const NEGRO: [number, number, number] = [20, 20, 25];
const BLANCO: [number, number, number] = [255, 255, 255];

// ── Helpers puros (exportados para tests) ────────────────────────────

/** Medida en cm sin sufijo, coma decimal es-CL ("172,0" → "172"). */
export function fmtMedidaCm(n: number): string {
  const s = n.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
}

/** Familia grande de la etiqueta de paños: BK→BLACKOUT, SCR→SCREEN, DU→DUO. */
export function familiaTelaEtiqueta(tipoTela?: string, producto?: string): string {
  const t = (tipoTela || '').toUpperCase().trim();
  if (t === 'BK') return 'BLACKOUT';
  if (t === 'SCR' || t === 'SC') return 'SCREEN';
  if (t === 'DU') return 'DUO';
  const p = (producto || '').toUpperCase();
  for (const fam of ['BLACKOUT', 'SCREEN', 'DUO']) if (p.includes(fam)) return fam;
  return p.split(/\s+/)[0] || '—';
}

/** Tipo de cortina ("ROLLER") = primera palabra del producto. */
export function tipoCortinaEtiqueta(producto?: string, tipo?: string): string {
  const p = (producto || '').trim().split(/\s+/)[0];
  return (p || tipo || '—').toUpperCase();
}

/**
 * Espec del tubo "38 mm de 1,2 mm": diámetro del código corto ("38mm_E02")
 * + espesor del texto del chip de tubería ("0,38mm [E02] 1,2mm").
 */
export function especTuboEtiqueta(tuberiaCod?: string, tuberiaChip?: string): string {
  const dia = (tuberiaCod || '').match(/(\d{2,3})\s*mm/i);
  if (!dia) return '';
  const espesores = [...(tuberiaChip || '').matchAll(/(\d+[.,]\d+)\s*mm/gi)];
  const esp = espesores.length ? espesores[espesores.length - 1][1] : '';
  return esp ? `${dia[1]} mm de ${esp.replace('.', ',')} mm` : `${dia[1]} mm`;
}

/** "CAD [DERECHA]" → "DERECHA" (lado de cadena limpio). */
export function ladoCadenaEtiqueta(direccion?: string): string {
  const raw = String(direccion || '—').trim();
  const m = raw.match(/\[([^\]]+)\]/);
  const limpio = (m ? m[1] : raw.replace(/^CAD\s*/i, '')).trim();
  return (limpio || '—').toUpperCase();
}

/** Descripción del accionamiento: "4 METROS NEGRO" (o "MOTOR <tipo>"). */
export function textoAccionamiento(p: Partial<Pano>): string {
  if (p.motorTipo) return `MOTOR ${String(p.motorTipo).toUpperCase()}`.trim();
  const raw = String(p.largoCadena ?? '').trim();
  const num = parseFloat(raw.replace(',', '.'));
  const largo = Number.isFinite(num) && num > 0 ? `${String(num).replace('.', ',')} METROS` : raw;
  const color = colorPesoNormalizado(p.colorCadena || '') || '';
  return [largo, color].filter(Boolean).join(' ').toUpperCase();
}

// ── Helpers de dibujo ────────────────────────────────────────────────

function qr(doc: jsPDF, x: number, y: number, lado: number, cuadrado = false) {
  // Respaldo blanco para que el QR se lea sobre el encabezado negro.
  doc.setFillColor(...BLANCO);
  if (cuadrado) doc.rect(x - 0.5, y - 0.5, lado + 1, lado + 1, 'F');
  else doc.roundedRect(x - 0.5, y - 0.5, lado + 1, lado + 1, 1, 1, 'F');
  doc.addImage(QR_ROLZZO, 'PNG', x, y, lado, lado);
}

function txt(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  size: number,
  opts: {
    bold?: boolean;
    color?: [number, number, number];
    align?: 'left' | 'center' | 'right';
    max?: number;
    /**
     * Escala horizontal del texto (plantillas .lbx: Arial con lfWidth fijo —
     * títulos estirados ~1,1 y rótulos/medidas condensados 0,70–0,85). La
     * alineación derecha/centro de jsPDF ignora la escala, así que se
     * compensa a mano con el ancho ya escalado.
     */
    hScale?: number;
  } = {},
) {
  doc.setFont('helvetica', opts.bold === false ? 'normal' : 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color || NEGRO));
  const t = opts.max ? s.substring(0, opts.max) : s;
  const esc = opts.hScale;
  if (esc && esc !== 1) {
    let xx = x;
    if (opts.align === 'right') xx = x - doc.getTextWidth(t) * esc;
    else if (opts.align === 'center') xx = x - (doc.getTextWidth(t) * esc) / 2;
    doc.text(t, xx, y, { horizontalScale: esc });
  } else {
    doc.text(t, x, y, { align: opts.align || 'left' });
  }
}

/** Línea punteada donde termina el diseño: marca dónde recortar la cinta. */
function lineaDeCorte(doc: jsPDF, y: number) {
  doc.setDrawColor(170, 170, 175);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.4, 1.2], 0);
  doc.line(2, y, ANCHO - 2, y);
  doc.setLineDashPattern([], 0);
}

function pieza(row: OptimizerRow, col: string): PiezaEtiqueta | undefined {
  return (row.piezas || []).find((x) => x.columnaExcel === col);
}

/** Código corto de una pieza: "38mm_E02" → "E02". */
function codCorto(pz?: PiezaEtiqueta): string {
  if (!pz?.cod) return '';
  return pz.cod.includes('_') ? pz.cod.split('_').pop() || pz.cod : pz.cod;
}

/** Etiqueta "LABEL: [COD]" (sin corchetes si no hay código). */
function conCod(label: string, cod: string): string {
  return cod ? `${label}: [${cod}]` : `${label}:`;
}

const tapaLabels: Record<string, string> = {
  SIN_TAPA: 'MURO A MURO', // legacy → muro a muro
  CON_1_TAPA: 'CON 1 TAPA',
  CON_2_TAPAS: 'CON 2 TAPAS',
  MURO_MURO: 'MURO A MURO',
};

// ── ETIQUETA ESTRUCTURA/ARMADO (62×95,5) ─────────────────────────────

function dibujarEstructura(
  doc: jsPDF,
  row: OptimizerRow,
  n: number,
  total: number,
  meta: MetaPDF,
  catalogo: CatalogoProductos,
) {
  const p = (row.pano || EMPTY_PANO) as Partial<Pano>;
  const anchoCm = row.anchoCm || 0;
  const altoCm = row.altoCm || 0;
  const colorAcc = colorPesoNormalizado(p.colorMecanismo || p.color) || '—';
  const sistema = tipoCortinaEtiqueta(row.producto, row.tipo);

  // Mismo estilo que la etiqueta de paños: esquinas cuadradas, contorno
  // exterior común (x 1,325 → 60,075; los rellenos se expanden medio trazo)
  // y borde derecho en 59,9 (el filo derecho del cabezal imprime débil).
  // Tamaños y escalas horizontales calcados del .lbx oficial (Arial con
  // lfWidth fijo): títulos estirados ~1,1 y rótulos/medidas condensados.

  // Encabezado negro: sistema + Cortina n/N + [tipoTela] + QR
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 3, 58.75, 20, 'F');
  const tamTitulo = sistema.length > 8 ? 13 : 19.2;
  const escTitulo = sistema.length > 8 ? 1 : 1.04;
  txt(doc, sistema, 3.7, 12.4, tamTitulo, { color: BLANCO, max: 12, hScale: escTitulo });
  txt(doc, `Cortina ${n}/${total}`, 3.7, 16.4, 9.5, { color: BLANCO, hScale: 1.02 });
  // El chip de despiece dice SCR, pero la etiqueta muestra SC (familia). Va
  // justo después de donde termina el título (con tope antes del QR).
  const chipTela = String(p.tipoTela || '').toUpperCase().replace(/^SCR$/, 'SC');
  if (chipTela) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tamTitulo);
    const finTitulo = 3.7 + doc.getTextWidth(sistema.substring(0, 12)) * escTitulo;
    txt(doc, `[${chipTela}]`, Math.min(finTitulo + 1, 33.5), 11.4, 9.9, {
      color: BLANCO,
      hScale: 1.02,
    });
  }
  qr(doc, 41.7, 4.4, 17, true);

  // Ubicación + OT + cliente
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.35);
  doc.rect(1.5, 23, 58.4, 11.8, 'S');
  txt(doc, 'UBICACIÓN:', 2.9, 26.3, 6, { bold: false, hScale: 0.83 });
  const ubic = (row.ubicacion || '—').toUpperCase();
  txt(doc, ubic, 2.4, 32.6, ubic.length > 9 ? 11 : 19.3, {
    max: 18,
    hScale: ubic.length > 9 ? 1 : 1.03,
  });
  txt(doc, String(meta.cliente || '').toUpperCase(), 58.3, 26.3, 6, {
    bold: false,
    align: 'right',
    max: 26,
    hScale: 0.83,
  });
  txt(doc, String(meta.ot), 58.3, 32.6, 19.3, { align: 'right', hScale: 1.03 });

  // Barra INFORMACIÓN PRODUCCIÓN
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 34.8, 58.75, 5.2, 'F');
  txt(doc, 'INFORMACIÓN PRODUCCIÓN', 30.7, 38.4, 9.5, {
    color: BLANCO,
    align: 'center',
    hScale: 1.02,
  });

  // Columna izquierda: TUBO / PESO / TELA
  doc.rect(1.5, 40, 28.9, 23.7, 'S');
  const pzTubo = pieza(row, 'TUBO');
  const tuboCm = pzTubo ? fmtMedidaCm(pzTubo.medidaCm) : fmtMedidaCm(anchoCm - 3.8);
  txt(doc, conCod('TUBO', codCorto(pzTubo) || (row.tuberiaCod || '').split('_').pop() || ''), 3.1, 44.2, 8.2, { hScale: 0.73 });
  txt(doc, tuboCm, 29.4, 45.7, 14.6, { align: 'right', hScale: 0.79 });
  const espec = especTuboEtiqueta(row.tuberiaCod, p.tuberia);
  if (espec) txt(doc, espec, 3.1, 46.9, 2.4, { bold: false, hScale: 1.04 });

  const pzPeso = pieza(row, 'PESO');
  const pesoCm = pzPeso ? fmtMedidaCm(pzPeso.medidaCm) : fmtMedidaCm(anchoCm - 4.2);
  txt(doc, conCod('PESO', codCorto(pzPeso)), 3.1, 51.9, 8.4, { hScale: 0.77 });
  txt(doc, pesoCm, 29.4, 53.4, 14.6, { align: 'right', hScale: 0.79 });
  txt(doc, `PESO ${sistema} ${colorAcc}`.trim(), 3.1, 55.2, 2.4, { bold: false, max: 30, hScale: 1.04 });

  const pzTela = (row.piezas || []).find((x) => x.componente.toUpperCase().startsWith('TELA'));
  txt(doc, 'TELA:', 3.1, 59.8, 7.5, { hScale: 0.8 });
  if (pzTela) txt(doc, fmtMedidaCm(pzTela.medidaCm), 29.4, 61.3, 14.6, { align: 'right', hScale: 0.79 });
  txt(doc, 'DIMENSIONADO', 3.1, 62.6, 2.4, { bold: false, hScale: 1.13 });

  // Columna derecha: CEF. OV. (o PESO U dúo) / tira / PLAT
  doc.rect(30.4, 40, 29.5, 23.7, 'S');
  const pzCef = pieza(row, 'CENEFA OVALADA');
  const pzPesoU = pieza(row, 'PESO U');
  const pzPesoInt = pieza(row, 'PESO INTERNO');
  if (pzCef) {
    txt(doc, conCod('CEF. OV.', codCorto(pzCef)), 31.5, 44.6, 8.4, { hScale: 0.66 });
    txt(doc, fmtMedidaCm(pzCef.medidaCm), 59.1, 45.7, 14.6, { align: 'right', hScale: 0.79 });
    txt(doc, 'CENEFA OVALADA', 32, 47.3, 2.4, { bold: false, hScale: 1.04 });
  } else if (pzPesoU) {
    txt(doc, conCod('PESO U.', codCorto(pzPesoU)), 31.5, 44.6, 8.4, { hScale: 0.66 });
    txt(doc, fmtMedidaCm(pzPesoU.medidaCm), 59.1, 45.7, 14.6, { align: 'right', hScale: 0.79 });
  } else {
    // Sin cenefa ovalada ni peso U: fila explícita, como el "NO" de platina.
    txt(doc, 'CEF. OV.:', 31.5, 44.6, 8.4, { hScale: 0.66 });
    txt(doc, 'N/A', 59.1, 45.7, 10, { align: 'right', hScale: 0.79 });
    txt(doc, 'CENEFA OVALADA', 32, 47.3, 2.4, { bold: false, hScale: 1.04 });
  }
  // Franja negra central: CON/SIN TIRA (cenefa ov.) o PESO INTERNO (dúo)
  doc.setFillColor(...NEGRO);
  doc.rect(30.225, 48.8, 29.85, 5.9, 'F');
  if (pzCef) {
    txt(doc, etiquetaConTira(p.cenefaTira), 45.2, 52.7, 9, {
      color: BLANCO,
      align: 'center',
      hScale: 0.98,
    });
  } else if (pzPesoInt) {
    txt(doc, `PESO INT: ${fmtMedidaCm(pzPesoInt.medidaCm)}`, 45.2, 52.7, 8, {
      color: BLANCO,
      align: 'center',
      hScale: 0.98,
    });
  }
  const pzPlat = pieza(row, 'PLETINA');
  const platCm = pzPlat
    ? fmtMedidaCm(pzPlat.medidaCm)
    : p.cenefa === 'Cuadrada'
      ? fmtMedidaCm(anchoCm + 1)
      : 'NO';
  txt(doc, conCod('PLAT', codCorto(pzPlat)), 31.5, 59.8, 7.5, { hScale: 0.8 });
  txt(doc, platCm, 59.1, 61.3, platCm === 'NO' ? 10 : 14.6, { align: 'right', hScale: 0.79 });
  txt(doc, 'PLATINA', 31.9, 62.6, 2.4, { bold: false, hScale: 1.13 });

  // Barra INFORMACIÓN TERRENO
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 63.7, 58.75, 5.2, 'F');
  txt(doc, 'INFORMACIÓN TERRENO', 30.7, 67.3, 9.5, {
    color: BLANCO,
    align: 'center',
    hScale: 1.02,
  });

  // Caja tela (identidad): codInt grande + descripción
  doc.rect(1.5, 68.9, 28.9, 18.8, 'S');
  const codInt = row.codInt || '—';
  txt(doc, codInt, 15.9, 80, codInt.length > 6 ? 15 : 23.7, {
    align: 'center',
    max: 10,
    hScale: codInt.length > 6 ? 1 : 0.8,
  });
  const telaDesc = (catalogo[row.codInt]?.descripcion || '').toUpperCase();
  if (telaDesc) txt(doc, telaDesc, 15.9, 84, 4.8, { bold: false, align: 'center', max: 26 });

  // Caja terreno: caída / cadena / accesorios + franja accionamiento
  doc.rect(30.4, 68.9, 29.5, 13.3, 'S');
  const caida = String(p.armado || row.sentido || '—').toUpperCase();
  txt(doc, `CAIDA: ${caida}`, 32, 72.5, 7.5, { max: 24, hScale: 0.8 });
  txt(doc, `CADENA: ${ladoCadenaEtiqueta(row.direccion)}`, 32, 76.7, 7.5, { max: 24, hScale: 0.8 });
  txt(doc, `ACCESORIOS: ${colorAcc}`, 32, 80.9, 7.5, { max: 24, hScale: 0.8 });
  doc.setFillColor(...NEGRO);
  doc.rect(30.225, 82, 29.85, 5.6, 'F');
  const codCad = String(p.codCadena || '').toUpperCase();
  txt(doc, codCad ? `ACCIONAMIENTO: [${codCad}]` : 'ACCIONAMIENTO:', 31.3, 85.3, 7.5, {
    color: BLANCO,
    max: 30,
    hScale: 0.8,
  });
  txt(doc, textoAccionamiento(p), 31.3, 87.2, 2.5, { bold: false, color: BLANCO, max: 34 });

  // Barra DIMENSIONADO: ancho × alto terminados
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 87.6, 58.75, 5.2, 'F');
  txt(doc, 'ANCHO:', 3.8, 91.2, 6.1, { color: BLANCO, hScale: 1.02 });
  txt(doc, fmtMedidaCm(anchoCm), 14.2, 91.4, 9.2, { color: BLANCO, hScale: 1.03 });
  txt(doc, 'ALTO:', 32.6, 91.2, 6.1, { color: BLANCO, hScale: 1.02 });
  txt(doc, fmtMedidaCm(altoCm), 40.4, 91.4, 9.2, { color: BLANCO, hScale: 1.03 });
}

// ── ETIQUETA CENEFA CUADRADA (62×54,9) ───────────────────────────────

function dibujarCenefaCuadrada(
  doc: jsPDF,
  row: OptimizerRow,
  n: number,
  total: number,
  meta: MetaPDF,
) {
  const p = (row.pano || EMPTY_PANO) as Partial<Pano>;
  const anchoCm = row.anchoCm || 0;
  const tapaTexto = (p.cenefaTapa && tapaLabels[p.cenefaTapa]) || 'MURO A MURO';
  const anchoCenefa = medidaCorteCenefaCuadrada(anchoCm, p.cenefaTapa);
  const colorCenefa =
    colorPesoNormalizado(p.colorTapa || p.colorMecanismo || p.color) || '—';
  const ubic = (row.ubicacion || '—').toUpperCase();

  // Mismo estilo que la etiqueta de paños: esquinas cuadradas, contorno
  // exterior común (rellenos expandidos medio trazo) y borde derecho en 59,9.
  // Tamaños y escalas horizontales calcados del .lbx oficial.

  // Encabezado negro
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 3, 58.75, 21.4, 'F');
  txt(doc, 'CENEFA CUADRADA', 3.7, 12.2, 18.6, { color: BLANCO, hScale: 0.55 });
  txt(doc, `Cenefa ${n}/${total}`, 4, 17.9, 10.2, { color: BLANCO, hScale: 1.03 });
  qr(doc, 41.7, 4.5, 18.2, true);

  // Ubicación + OT + cliente
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.35);
  doc.rect(1.5, 24.3, 58.4, 12.7, 'S');
  txt(doc, 'UBICACIÓN:', 2.9, 27.9, 6.4, { bold: false, hScale: 0.85 });
  txt(doc, ubic, 2.3, 34.9, ubic.length > 9 ? 11 : 20.4, {
    max: 18,
    hScale: ubic.length > 9 ? 1 : 1.04,
  });
  txt(doc, String(meta.cliente || '').toUpperCase(), 58.3, 27.9, 6.4, {
    bold: false,
    align: 'right',
    max: 24,
    hScale: 0.85,
  });
  txt(doc, String(meta.ot), 58.3, 34.9, 20.4, { align: 'right', hScale: 1.04 });

  // Fila 1: UBICACIÓN | TIPO DE INSTALACIÓN
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 36.9, 58.75, 3.5, 'F');
  txt(doc, 'UBICACIÓN:', 16.3, 39.3, 4.5, { color: BLANCO, align: 'center', hScale: 0.95 });
  txt(doc, 'TIPO DE INSTALACIÓN', 45.6, 39.3, 4.5, { color: BLANCO, align: 'center', hScale: 0.95 });
  doc.rect(1.5, 40.4, 29.6, 4.2, 'S');
  doc.rect(31.2, 40.4, 28.7, 4.2, 'S');
  txt(doc, ubic, 16.3, 43.3, 5.4, { align: 'center', max: 20, hScale: 0.91 });
  txt(doc, tapaTexto, 45.6, 43.3, 5.5, { align: 'center', hScale: 0.9 });

  // Fila 2: ANCHO DE CENEFA | COLOR DE CENEFA
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 44.6, 58.75, 3.5, 'F');
  txt(doc, 'ANCHO DE CENEFA', 16.3, 47, 4.6, { color: BLANCO, align: 'center', hScale: 0.89 });
  txt(doc, 'COLOR DE CENEFA', 45.6, 47, 4.6, { color: BLANCO, align: 'center', hScale: 0.89 });
  doc.rect(1.5, 48, 29.6, 4.2, 'S');
  doc.rect(31.2, 48, 28.7, 4.2, 'S');
  txt(doc, anchoCenefa > 0 ? fmtMedidaCm(anchoCenefa) : '—', 16.3, 50.9, 5.4, {
    align: 'center',
    hScale: 0.91,
  });
  txt(doc, colorCenefa, 45.6, 50.9, 5.4, { align: 'center', hScale: 0.91 });
}

// ── ETIQUETA PAÑOS (página exacta 62×51) ─────────────────────────────

function dibujarPano(
  doc: jsPDF,
  row: OptimizerRow,
  n: number,
  total: number,
  meta: MetaPDF,
  catalogo: CatalogoProductos,
) {
  const p = (row.pano || EMPTY_PANO) as Partial<Pano>;
  const familia = familiaTelaEtiqueta(p.tipoTela, row.producto);
  const tipoCortina = tipoCortinaEtiqueta(row.producto, row.tipo);
  const junto = row.junto && row.junto !== '·' ? row.junto : '—';
  const altoCorteCm = (row.altoCorte || 0) * 100;

  // Bloques CONTIGUOS con esquinas cuadradas y bordes laterales visibles:
  // los recuadros van de x 1,5 a 59,9 — el lado derecho entra 0,5 mm más que
  // el límite teórico porque el filo derecho del cabezal imprime débil y el
  // borde salía más tenue que el izquierdo (medido en impresiones reales).
  // Margen superior de 3 mm y 0 abajo (compensa el corrimiento del corte
  // medido en impresiones reales): 3+19,8+11,3+16,7(+borde) = 51.

  // Los rectángulos con BORDE dibujan el trazo (0,35) centrado en la línea:
  // su contorno externo sobresale 0,175 de la coordenada. Los rellenos
  // negros se expanden ese medio trazo para que todos los cantos queden
  // perfectamente alineados (contorno exterior común: x 1,325 → 60,075).

  // Encabezado negro: familia + PAÑO n/N + QR (3 → 22,8)
  doc.setFillColor(...NEGRO);
  doc.rect(1.325, 3, 58.75, 19.8, 'F');
  // Título alineado a la izquierda, sobre el mismo eje que "PAÑO n/N".
  txt(doc, familia, 3.6, 11.8, familia.length > 8 ? 13 : 18.4, { color: BLANCO, max: 12 });
  txt(doc, `PAÑO ${n}/${total}`, 3.6, 17.9, 9.1, { color: BLANCO });
  qr(doc, 41.7, 4.4, 16.2, true);

  // OT + cliente (izquierda) | SE CORTA JUNTO (derecha) — 22,8 → 34,1
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.35);
  doc.rect(1.5, 22.8, 58.4, 11.3, 'S');
  txt(doc, String(meta.cliente || '').toUpperCase(), 2.9, 26.2, 5.6, {
    bold: false,
    max: 24,
  });
  txt(doc, String(meta.ot), 2.9, 32.7, 18.4);
  txt(doc, 'SE CORTA JUNTO:', 58.3, 26.2, 5.6, { align: 'right' });
  txt(doc, junto, 58.3, 32.7, 18.4, { align: 'right', max: 6 });

  // Caja tela: codInt grande + descripción (34,1 → 50,8, ancho hasta 30)
  doc.rect(1.5, 34.1, 28.5, 16.7, 'S');
  const codInt = row.codInt || '—';
  txt(doc, codInt, 15.6, 44.4, codInt.length > 6 ? 15 : 22.7, { align: 'center', max: 10 });
  const telaDesc = (catalogo[row.codInt]?.descripcion || '').toUpperCase();
  if (telaDesc) txt(doc, telaDesc, 15.6, 48.4, 4.7, { bold: false, align: 'center', max: 26 });

  // Columna derecha (30 → 59,9): ALTO grande + TIPO DE CORTINA
  doc.rect(30, 34.1, 29.9, 6.9, 'S');
  txt(doc, `ALTO:${fmtMedidaCm(altoCorteCm)}`, 45, 39.3, 14, { align: 'center', max: 12 });
  doc.setFillColor(...NEGRO);
  doc.rect(29.825, 41, 30.25, 4.4, 'F');
  txt(doc, 'TIPO DE CORTINA:', 45, 44.3, 8.4, { color: BLANCO, align: 'center' });
  doc.rect(30, 45.4, 29.9, 5.4, 'S');
  txt(doc, tipoCortina, 45, 49.6, 12.1, { align: 'center', max: 12 });
}

// ── Generadores públicos ─────────────────────────────────────────────

/**
 * Etiquetas de ESTRUCTURA/ARMADO (una por cortina) + página extra de
 * CENEFA CUADRADA por cada cortina con cenefa cuadrada. Formato oficial
 * de las plantillas P-touch (docs/referencias).
 */
export function generarEtiquetasPDF(
  rows: OptimizerRow[],
  meta: MetaPDF,
  catalogo: CatalogoProductos,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay filas para imprimir. Guarda el plan en Tela primero.');
  }
  const cenefas = rows.filter((r) => (r.pano || EMPTY_PANO).cenefa === 'Cuadrada');
  const doc = new jsPDF('p', 'mm', [ANCHO, ALTO_PAGINA]);
  let first = true;
  let nCenefa = 0;

  rows.forEach((row, i) => {
    if (!first) doc.addPage([ANCHO, ALTO_PAGINA], 'p');
    first = false;
    dibujarEstructura(doc, row, i + 1, rows.length, meta, catalogo);

    if ((row.pano || EMPTY_PANO).cenefa === 'Cuadrada') {
      nCenefa += 1;
      doc.addPage([ANCHO, ALTO_PAGINA], 'p');
      dibujarCenefaCuadrada(doc, row, nCenefa, cenefas.length, meta);
      lineaDeCorte(doc, FIN_CENEFA);
    }
  });

  doc.save(`Etiquetas_${meta.ot}.pdf`);
}

/** Etiquetas de PAÑOS (una por paño de tela cortado), formato oficial. */
export function generarEtiquetasPanosPDF(
  rows: OptimizerRow[],
  meta: MetaPDF,
  catalogo: CatalogoProductos,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay filas para imprimir. Guarda el plan en Tela primero.');
  }
  // Página exacta 62×54: orientación 'l' porque jsPDF voltea las páginas
  // "apaisadas" (ancho > alto) cuando se le pide 'p'.
  const doc = new jsPDF('l', 'mm', [ANCHO, ALTO_PANO]);
  rows.forEach((row, i) => {
    if (i > 0) doc.addPage([ANCHO, ALTO_PANO], 'l');
    dibujarPano(doc, row, i + 1, rows.length, meta, catalogo);
  });
  doc.save(`Etiquetas_Panos_${meta.ot}.pdf`);
}
