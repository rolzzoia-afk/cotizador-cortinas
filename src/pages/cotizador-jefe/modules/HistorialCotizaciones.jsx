// Historial de cotizaciones guardadas en Supabase.
// Lista por fecha desc. Click "Editar" carga la cotización en el Cotizador.
// Visible para todos los roles (admin + ventas) — la RLS de la tabla
// filtra por empresa automáticamente.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt } from '../store/useData'

export default function HistorialCotizaciones({ onEditar, restringido = false }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('')

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('cotizaciones_jefe')
        .select(
          'id, correlativo, cliente, descuento, total_lista_con_iva, total_con_descuento, estado, creado_en, actualizado_en, lineas, margen_real, total_lista_sin_iva',
        )
        .order('creado_en', { ascending: false })
        .limit(200)
      if (error) throw error
      setCotizaciones(data || [])
    } catch (e) {
      console.error('[Historial] Error al cargar:', e)
      setError(e.message || 'No se pudieron cargar las cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  // Filtro simple por nombre de cliente o correlativo
  const visibles = cotizaciones.filter((c) => {
    if (!filtro.trim()) return true
    const q = filtro.toLowerCase().trim()
    const nombre = (c.cliente?.nombre || '').toLowerCase()
    const proyecto = (c.cliente?.proyecto || '').toLowerCase()
    const corr = String(c.correlativo)
    return nombre.includes(q) || proyecto.includes(q) || corr.includes(q)
  })

  function fmtFecha(s) {
    if (!s) return '—'
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div>
      <div className="module-title">Cotizaciones guardadas</div>
      <div className="module-subtitle">
        {restringido
          ? 'Tus cotizaciones guardadas y las del equipo.'
          : 'Lista completa de cotizaciones del equipo.'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8 }}>
        <input
          type="text"
          placeholder="Buscar por cliente, proyecto o número…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ maxWidth: 360, flex: 1 }}
        />
        <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--red-light)',
            color: 'var(--red)',
            border: '1px solid var(--red)',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando cotizaciones…
          </div>
        ) : visibles.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            {cotizaciones.length === 0
              ? 'No hay cotizaciones guardadas aún. Andá al Cotizador y guarda la primera.'
              : `No hay cotizaciones que coincidan con "${filtro}".`}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  #
                </th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Cliente / Proyecto
                </th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Fecha
                </th>
                <th
                  className="num-right"
                  style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}
                >
                  Líneas
                </th>
                <th
                  className="num-right"
                  style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}
                >
                  Total c/IVA
                </th>
                <th
                  className="num-right"
                  style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}
                >
                  Con dcto
                </th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Estado
                </th>
                <th style={{ padding: '10px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const nLineas = Array.isArray(c.lineas) ? c.lineas.length : 0
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                      #{c.correlativo}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{c.cliente?.nombre || '—'}</div>
                      {c.cliente?.proyecto && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.cliente.proyecto}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13 }}>
                      {fmtFecha(c.cliente?.fecha || c.creado_en)}
                    </td>
                    <td className="num-right" style={{ padding: '12px', fontSize: 13 }}>
                      {nLineas}
                    </td>
                    <td className="num-right" style={{ padding: '12px', fontWeight: 600 }}>
                      {fmt(c.total_lista_con_iva)}
                    </td>
                    <td
                      className="num-right"
                      style={{ padding: '12px', fontWeight: 600, color: 'var(--accent)' }}
                    >
                      {c.descuento > 0 ? fmt(c.total_con_descuento) : '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        className={`badge ${
                          c.estado === 'aprobada'
                            ? 'badge-green'
                            : c.estado === 'rechazada'
                              ? 'badge-red'
                              : c.estado === 'enviada'
                                ? 'badge-amber'
                                : ''
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {c.estado}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onEditar?.(c)}
                        title="Cargar esta cotización en el Cotizador para verla o modificarla"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
