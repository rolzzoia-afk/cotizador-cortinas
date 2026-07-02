// ─────────────────────────────────────────────────────────────────────
// Store global simple basado en localStorage. Sin redux ni zustand —
// useState + subscribers. Funciona porque la app es pequeña y todos
// los módulos comparten el mismo store.
//
// Importante: este archivo expone calcularLinea(linea, data), la
// función que la pestaña Cotizador consume. Los campos que devuelve
// (precioListaSIVA, precioListaCIVA, totalCostoAcum y cada detalle
// con costoUnitReal / costoTotal / precioVenta) están alineados con
// lo que Cotizador.jsx espera.
// ─────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import initialData from '../data/data.json'
import { supabase } from '@/lib/supabase'

// v3 (junio 2026): cambio de schema — BRA03-B salió de composición de
// modelos y pasó a sumarse solo cuando hay cenefa.
//
// MIGRACIÓN A SUPABASE (junio 2026):
// La fuente de verdad es la tabla `cotizador_jefe_config` (1 fila por
// empresa). localStorage queda como cache local + fallback offline.
// Flujo:
//   1. Al cargar el módulo: fetch async a Supabase. Si hay registro,
//      sobrescribe globalData y notifica.
//   2. Al guardar (admin): writes a localStorage + upsert a Supabase
//      en paralelo. Los no-admin no pueden upsertear (lo bloquea RLS).
//   3. Si Supabase falla (offline / sin sesión / sin empresa): seguimos
//      con localStorage para no romper el cotizador.
const STORAGE_KEY = 'rolzzo_data_v3'

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialData
  } catch {
    return initialData
  }
}

function saveDataLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e)
  }
}

// ── Sync con Supabase ───────────────────────────────────────────────
// Cache la empresa+rol del usuario actual para evitar queries repetidas.
let cachedSession = null

async function getSession() {
  if (cachedSession) return cachedSession
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()
    if (!perfil?.empresa_id) return null
    cachedSession = { userId: user.id, empresaId: perfil.empresa_id, rol: perfil.rol }
    return cachedSession
  } catch (e) {
    console.warn('[useData] No se pudo obtener sesión:', e)
    return null
  }
}

async function fetchFromSupabase() {
  const session = await getSession()
  if (!session) return null
  try {
    const { data: config, error } = await supabase
      .from('cotizador_jefe_config')
      .select('data')
      .eq('empresa_id', session.empresaId)
      .maybeSingle()
    if (error) {
      console.warn('[useData] Error al cargar config Supabase:', error.message)
      return null
    }
    return config?.data || null
  } catch (e) {
    console.warn('[useData] No se pudo cargar config Supabase:', e)
    return null
  }
}

async function saveToSupabase(data) {
  const session = await getSession()
  if (!session) return
  if (session.rol !== 'admin') return // UI guard. RLS también lo bloquea.
  try {
    const { error } = await supabase
      .from('cotizador_jefe_config')
      .upsert({
        empresa_id: session.empresaId,
        data,
        actualizado_por: session.userId,
        actualizado_en: new Date().toISOString(),
      })
    if (error) console.warn('[useData] Error al guardar Supabase:', error.message)
  } catch (e) {
    console.warn('[useData] No se pudo guardar config en Supabase:', e)
  }
}

function saveData(data) {
  saveDataLocal(data)
  saveToSupabase(data) // fire-and-forget, errores ya logueados
}

let globalData = loadData()
const listeners = new Set()

// Kick off carga desde Supabase al arrancar el módulo. Cuando llega,
// sobrescribe globalData y notifica a todos los componentes suscritos.
fetchFromSupabase().then((remoteData) => {
  if (remoteData) {
    globalData = remoteData
    saveDataLocal(remoteData) // sync local cache
    listeners.forEach((fn) => fn(globalData))
  }
})

function notify() {
  listeners.forEach((fn) => fn(globalData))
}

export function resetToDefaults() {
  localStorage.removeItem(STORAGE_KEY)
  globalData = JSON.parse(JSON.stringify(initialData))
  saveData(globalData)
  notify()
}

export function useData() {
  const [data, setData] = useState(globalData)

  useEffect(() => {
    const onChange = (d) => setData({ ...d })
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }, [])

  function update(updater) {
    globalData = updater(globalData)
    saveData(globalData)
    notify()
  }

  return { data, update }
}

// ── Helpers de precios ────────────────────────────────────────────────

// Costo c/IVA SIN descuento del proveedor — para PRECIO DE VENTA de insumos.
export function getCostoInsumo(insumo, config) {
  return insumo.costoSinIVA * (1 + config.ivaRate)
}

// Costo c/IVA CON descuentos del proveedor — para COSTO REAL nuestro.
export function getCostoInsumoReal(insumo, config) {
  const base = insumo.costoSinIVA * (1 + config.ivaRate)
  const d1 = insumo.descuento1 > 0 ? insumo.descuento1 : 1
  const d2 = insumo.descuento2 > 0 ? insumo.descuento2 : 1
  return base * d1 * d2
}

// Devuelve la tela ref de una categoría según la estrategia configurada.
function getTelaRef(telas, categoria, estrategia = 'mas_barata') {
  const delCat = telas.filter((t) => t.activo && t.categoria === categoria)
  if (!delCat.length) return null
  if (estrategia === 'mas_cara') {
    return delCat.reduce((max, t) => (t.costoSinIVA > max.costoSinIVA ? t : max))
  }
  return delCat.reduce((min, t) => (t.costoSinIVA < min.costoSinIVA ? t : min))
}

// Precio venta por m² de la tela. Si precioVentaUsaDescuentoProveedorTela
// está true (Excel del jefe), aplica los descuentos del proveedor al
// costo de la tela antes de calcular el precio de venta.
export function calcPrecioTelaM2(telas, categoria, config) {
  const t = getTelaRef(telas, categoria, config.estrategiaTela)
  if (!t) return 0
  let costoBase = t.costoSinIVA * (1 + config.ivaRate)
  if (config.precioVentaUsaDescuentoProveedorTela) {
    const d1 = t.descuento1 > 0 ? t.descuento1 : 1
    const d2 = t.descuento2 > 0 ? t.descuento2 : 1
    costoBase = costoBase * d1 * d2
  }
  const precioML = costoBase / config.margenBase / config.margenDescuento
  return precioML / t.anchoMetros
}

// Costo real por m² de la tela = costo c/IVA × descuentos del proveedor ÷ ancho.
export function calcCostoTelaM2Real(telas, categoria, config) {
  const t = getTelaRef(telas, categoria, config.estrategiaTela)
  if (!t) return 0
  const costoCIVA = t.costoSinIVA * (1 + config.ivaRate)
  const d1 = t.descuento1 > 0 ? t.descuento1 : 1
  const d2 = t.descuento2 > 0 ? t.descuento2 : 1
  return (costoCIVA * d1 * d2) / t.anchoMetros
}

// Margen base se aplica a todo, salvo a COMISION (que tiene su valor calibrado
// a costoSinIVA=1681 = 1093/0.65, así que dividir de nuevo por 0.65 lo duplicaría).
// MANO DE OBRA antes estaba acá pero el Excel del jefe (versión mayo 26) ahora
// la divide por 0.65 también, así que la sacamos del opt-out.
function aplicaMargenBase(insumo) {
  const cat = (insumo.categoria || '').toUpperCase()
  return cat !== 'COMISION'
}

// Brackets por ancho — primera regla que matchea anchoMaximo.
export function getBracketsQty(ancho, reglas) {
  for (const r of reglas.brackets) {
    if (ancho <= r.anchoMaximo) return r.cantidad
  }
  return 4
}

// Mapa MODELO → categoría de tela.
// DUAL es especial: usa DOS telas (Blackout + Screen sumadas).
export const TELA_POR_MODELO = {
  BLACKOUT: 'Tela Blackout',
  SCREEN: 'Tela Screen',
  'DUO BLACKOUT': 'Tela Duo Blackout',
  'DUO POLY': 'Tela Duo Polyester',
  'DUO POLYESTER': 'Tela Duo Polyester',
  DUAL: null,
}

const TELAS_DUAL = ['Tela Blackout', 'Tela Screen']


// Devuelve el data actual (para descargar como JSON).
export function exportData() {
  return JSON.parse(JSON.stringify(globalData))
}

// Reemplaza globalData por uno importado desde un archivo.
// Valida que tenga las claves principales antes de aplicar.
export function importData(newData) {
  if (
    !newData ||
    typeof newData !== 'object' ||
    !Array.isArray(newData.insumos) ||
    !Array.isArray(newData.telas) ||
    !Array.isArray(newData.modelosComposicion) ||
    !newData.config
  ) {
    throw new Error('El archivo no tiene la estructura esperada. Verifica que sea un JSON exportado desde esta app.')
  }
  globalData = JSON.parse(JSON.stringify(newData))
  saveData(globalData)
  notify()
}

// ── Cálculo de una línea de cortina ───────────────────────────────────
export function calcularLinea(linea, data) {
  const { config, insumos, telas, modelosComposicion, reglas } = data
  if (!linea?.modelo) return null

  const modelo = modelosComposicion.find((m) => m.id === linea.modelo)
  if (!modelo) return null

  const ancho = parseFloat(linea.ancho)
  const alto = parseFloat(linea.alto)
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    return null
  }
  const m2 = ancho * alto

  // Tela ───────────────────────────────────────────────────────────────
  const categoriasTela =
    linea.modelo === 'DUAL'
      ? TELAS_DUAL
      : TELA_POR_MODELO[linea.modelo]
        ? [TELA_POR_MODELO[linea.modelo]]
        : []

  const detalle = []
  let totalVenta = 0
  let totalCostoAcum = 0

  for (const cat of categoriasTela) {
    const precioM2 = calcPrecioTelaM2(telas, cat, config)
    const costoM2 = calcCostoTelaM2Real(telas, cat, config)
    detalle.push({
      id: `TELA-${cat}`,
      descripcion: `${cat} (${m2.toFixed(2)} m²)`,
      cantidad: m2,
      unidad: 'm²',
      costoUnitReal: costoM2,
      costoTotal: costoM2 * m2,
      precioVenta: precioM2 * m2,
    })
    totalVenta += precioM2 * m2
    totalCostoAcum += costoM2 * m2
  }

  // Insumos según composición del modelo ──────────────────────────────
  for (const comp of modelo.insumos) {
    if (comp.seleccionPorColor) {
      const colorRef = comp.colorRef === 'cadena' ? linea.colorCadena : linea.colorAccesorio
      if (comp.colorValor !== colorRef) continue
    }

    const ins = insumos.find((i) => i.id === comp.insumoId)
    if (!ins || !ins.activo) continue

    const costoUnitVenta = getCostoInsumo(ins, config)
    const costoUnitReal = getCostoInsumoReal(ins, config)

    let base = comp.cantidad || 1
    let unidad = 'u'

    if (comp.tipo === 'lineal') {
      base = ancho * (comp.cantidad || 1)
      unidad = 'ml'
    } else if (comp.tipo === 'brackets') {
      base = getBracketsQty(ancho, reglas)
      unidad = 'u'
    }

    const divisorBobina = ins.anchoBobina && comp.tipo === 'lineal' ? ins.anchoBobina : 1
    const divMargen = aplicaMargenBase(ins) ? config.margenBase : 1

    const precioVenta = ((costoUnitVenta / divisorBobina) * base) / divMargen / config.margenDescuento
    const costoTotal = (costoUnitReal / divisorBobina) * base

    detalle.push({
      id: ins.id,
      descripcion: ins.descripcion,
      cantidad: base,
      unidad,
      costoUnitReal: costoUnitReal / divisorBobina,
      costoTotal,
      precioVenta,
    })

    totalVenta += precioVenta
    totalCostoAcum += costoTotal
  }

  // Cenefa opcional ────────────────────────────────────────────────────
  if (linea.cenefa && linea.tipoCenefa) {
    const colorC = linea.colorAccesorio
    const cenefaId =
      linea.tipoCenefa === 'Cuadrada' ? (colorC === 'Negro' ? 'E67-B' : 'E68-B') : null
    if (cenefaId) {
      const insCenefa = insumos.find((i) => i.id === cenefaId)
      if (insCenefa) {
        const divCenefa = insCenefa.anchoBobina || 1
        const cuVenta = getCostoInsumo(insCenefa, config)
        const cuReal = getCostoInsumoReal(insCenefa, config)
        const cantML = ancho
        const pv = ((cuVenta / divCenefa) * cantML) / config.margenBase / config.margenDescuento
        const ct = (cuReal / divCenefa) * cantML
        detalle.push({
          id: insCenefa.id,
          descripcion: insCenefa.descripcion,
          cantidad: cantML,
          unidad: 'ml',
          costoUnitReal: cuReal / divCenefa,
          costoTotal: ct,
          precioVenta: pv,
        })
        totalVenta += pv
        totalCostoAcum += ct

        // Mecanismo de la cenefa
        const mecId =
          linea.tipoCenefa === 'Cuadrada' ? (colorC === 'Negro' ? 'MEC42-B' : 'MEC43-B') : null
        const insMec = mecId ? insumos.find((i) => i.id === mecId) : null
        if (insMec) {
          const mvV = getCostoInsumo(insMec, config)
          const mvR = getCostoInsumoReal(insMec, config)
          const pvM = mvV / config.margenBase / config.margenDescuento
          detalle.push({
            id: insMec.id,
            descripcion: insMec.descripcion,
            cantidad: 1,
            unidad: 'u',
            costoUnitReal: mvR,
            costoTotal: mvR,
            precioVenta: pvM,
          })
          totalVenta += pvM
          totalCostoAcum += mvR
        }

        // Brackets — solo cuando hay cenefa (regla del jefe). Cantidad
        // según el ancho de la cortina (2 / 3 / 4 / 5 según reglas.brackets).
        // Antes BRA03-B venía en la composición de cada modelo y se sumaba
        // siempre. Ahora va acá adentro, condicional a cenefa.
        const insBracket = insumos.find((i) => i.id === 'BRA03-B')
        if (insBracket && insBracket.activo) {
          const cantBrackets = getBracketsQty(ancho, reglas)
          const cuV = getCostoInsumo(insBracket, config)
          const cuR = getCostoInsumoReal(insBracket, config)
          const pvB = (cuV * cantBrackets) / config.margenBase / config.margenDescuento
          const ctB = cuR * cantBrackets
          detalle.push({
            id: insBracket.id,
            descripcion: insBracket.descripcion,
            cantidad: cantBrackets,
            unidad: 'u',
            costoUnitReal: cuR,
            costoTotal: ctB,
            precioVenta: pvB,
          })
          totalVenta += pvB
          totalCostoAcum += ctB
        }
      }
    }
  }

  // Decisión del jefe 2026-07-02: la suma bruta de componentes × (1+IVA)
  // ES el precio final c/IVA. (El fix de junio 2026 trataba ese valor como
  // "s/IVA" y le aplicaba IVA encima otra vez — factor cobrado dos veces.)
  // totalVenta queda expuesto para el TOTAL CORTINA del detalle (bruto,
  // sin IVA ni nada) y como base del margen.
  return {
    m2,
    totalVenta,
    precioListaSIVA: totalVenta,
    precioListaCIVA: totalVenta * (1 + config.ivaRate),
    totalCostoAcum,
    detalle,
  }
}

// Formato de moneda CLP.
export function fmt(n) {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}
