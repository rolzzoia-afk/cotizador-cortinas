import { useState } from 'react'
import { useData, calcularLinea, fmt } from '../store/useData'

// Modelos disponibles = los que existen en data.modelosComposicion.
// Cuando se agrega un modelo nuevo en data.json, aparece automáticamente
// en el desplegable sin tocar código.
function newLinea(id, modeloDefault = 'BLACKOUT') {
  return {
    id,
    lugar: '',
    modelo: modeloDefault,
    colorAccesorio: 'Negro',
    colorCadena: 'Negro',
    ancho: '',
    alto: '',
    cenefa: false,
    tipoCenefa: 'Cuadrada',
    motor: false,
    notas: '',
  }
}

export default function Cotizador({ restringido = false } = {}) {
  const { data } = useData()
  const MODELOS_DISPONIBLES = data.modelosComposicion.map((m) => m.id)
  const modeloDefault = MODELOS_DISPONIBLES[0] || 'BLACKOUT'

  const [cliente, setCliente] = useState({
    nombre: '',
    proyecto: '',
    fecha: new Date().toISOString().slice(0, 10),
    ot: '',
    contacto: '',
    telefono: '',
  })
  const [lineas, setLineas] = useState([newLinea(1, modeloDefault)])
  const [descuento, setDescuento] = useState('')
  const [verDetalle, setVerDetalle] = useState(null)

  const pctDcto = parseFloat(descuento) || 0
  const resultados = lineas.map((l) => ({ linea: l, calc: calcularLinea(l, data) }))

  const totalListaSIVA = resultados.reduce((s, r) => s + (r.calc?.precioListaSIVA || 0), 0)
  const totalListaCIVA = resultados.reduce((s, r) => s + (r.calc?.precioListaCIVA || 0), 0)
  const totalConDcto = totalListaCIVA * (1 - pctDcto / 100)
  const totalCosto = resultados.reduce((s, r) => s + (r.calc?.totalCostoAcum || 0), 0)
  const margenReal =
    totalListaSIVA > 0 ? ((totalListaSIVA - totalCosto) / totalListaSIVA) * 100 : 0
  const maxDcto = ((1 - data.config.margenDescuento) * 100).toFixed(0)

  return (
    <div>
      <div className="module-title">Cotizador</div>
      <div className="module-subtitle">
        Agrega las cortinas una por una. El precio se calcula automáticamente.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Datos del Cliente y Proyecto</div>
        <div
          style={{
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { field: 'nombre', label: 'Nombre cliente' },
            { field: 'proyecto', label: 'Proyecto / Referencia' },
            { field: 'ot', label: 'OT Número' },
            { field: 'contacto', label: 'Contacto' },
            { field: 'telefono', label: 'Teléfono' },
            { field: 'fecha', label: 'Fecha', type: 'date' },
          ].map((f) => (
            <div key={f.field}>
              <div className="field-label">{f.label}</div>
              <input
                type={f.type || 'text'}
                value={cliente[f.field]}
                onChange={(e) => setCliente((c) => ({ ...c, [f.field]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span>Cortinas a Cotizar</span>
          <button
            className="btn btn-success btn-sm"
            onClick={() => setLineas((l) => [...l, newLinea(Date.now(), modeloDefault)])}
          >
            + Agregar cortina
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Lugar / Área</th>
                <th>Modelo</th>
                <th>Color Accesorio</th>
                <th>Color Cadena</th>
                <th>Ancho (m)</th>
                <th>Alto (m)</th>
                <th className="num-right">M²</th>
                <th>Cenefa</th>
                <th>Motor</th>
                <th className="num-right">Precio Lista c/IVA</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const r = resultados[idx].calc
                const m2 =
                  l.ancho && l.alto
                    ? (parseFloat(l.ancho) * parseFloat(l.alto)).toFixed(2)
                    : '—'
                return [
                  <tr key={l.id}>
                    <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={l.lugar}
                        placeholder="Ej: Living"
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, lugar: e.target.value } : x)),
                          )
                        }
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>
                      <select
                        value={l.modelo}
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, modelo: e.target.value } : x)),
                          )
                        }
                        style={{ width: 130 }}
                      >
                        {MODELOS_DISPONIBLES.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={l.colorAccesorio}
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) =>
                              x.id === l.id ? { ...x, colorAccesorio: e.target.value } : x,
                            ),
                          )
                        }
                        style={{ width: 110 }}
                      >
                        {data.coloresAccesorio.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={l.colorCadena}
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) =>
                              x.id === l.id ? { ...x, colorCadena: e.target.value } : x,
                            ),
                          )
                        }
                        style={{ width: 110 }}
                      >
                        {data.coloresCadena.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={l.ancho}
                        min="0.3"
                        max="5"
                        step="0.01"
                        placeholder="0.00"
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, ancho: e.target.value } : x)),
                          )
                        }
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={l.alto}
                        min="0.3"
                        max="5"
                        step="0.01"
                        placeholder="0.00"
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, alto: e.target.value } : x)),
                          )
                        }
                        style={{ width: 80 }}
                      />
                    </td>
                    <td className="num-right" style={{ fontWeight: 500 }}>
                      {m2}
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          alignItems: 'center',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={l.cenefa}
                            onChange={(e) =>
                              setLineas((ls) =>
                                ls.map((x) =>
                                  x.id === l.id ? { ...x, cenefa: e.target.checked } : x,
                                ),
                              )
                            }
                          />
                          Sí
                        </label>
                        {l.cenefa && (
                          <select
                            value={l.tipoCenefa}
                            onChange={(e) =>
                              setLineas((ls) =>
                                ls.map((x) =>
                                  x.id === l.id ? { ...x, tipoCenefa: e.target.value } : x,
                                ),
                              )
                            }
                            style={{ width: 100, fontSize: 11 }}
                          >
                            {data.tiposCenefa.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="check-cell">
                      <input
                        type="checkbox"
                        checked={l.motor}
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, motor: e.target.checked } : x)),
                          )
                        }
                        title="Motor (próximamente)"
                      />
                    </td>
                    <td className="num-right">
                      {r ? (
                        restringido ? (
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            {fmt(r.precioListaCIVA)}
                          </span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontWeight: 600, color: 'var(--accent)' }}
                            onClick={() => setVerDetalle(verDetalle === l.id ? null : l.id)}
                          >
                            {fmt(r.precioListaCIVA)} {verDetalle === l.id ? '▲' : '▼'}
                          </button>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={l.notas}
                        placeholder="Notas..."
                        onChange={(e) =>
                          setLineas((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, notas: e.target.value } : x)),
                          )
                        }
                        style={{ width: 120 }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setLineas((ls) => ls.filter((x) => x.id !== l.id))}
                        disabled={lineas.length === 1}
                        title={lineas.length === 1 ? 'Mínimo una cortina' : 'Eliminar'}
                      >
                        x
                      </button>
                    </td>
                  </tr>,
                  !restringido && verDetalle === l.id && r && (
                    <tr key={`det-${l.id}`}>
                      <td colSpan={13} style={{ padding: 0 }}>
                        <div
                          style={{
                            background: '#f8fbff',
                            borderTop: '2px solid var(--accent)',
                            padding: '12px 20px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 500,
                              marginBottom: 8,
                              color: 'var(--accent)',
                              fontSize: 13,
                            }}
                          >
                            Detalle #{idx + 1} — {l.lugar || 'Sin nombre'} — {l.modelo} {l.ancho}x
                            {l.alto}m
                          </div>
                          <table style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th>Componente</th>
                                <th className="num-right">Cant.</th>
                                <th>Un.</th>
                                <th className="num-right">Costo unit. real</th>
                                <th className="num-right">Costo total real</th>
                                <th className="num-right">Precio venta (ref.)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.detalle.map((d, di) => (
                                <tr key={di}>
                                  <td>{d.descripcion}</td>
                                  <td className="num-right">
                                    {typeof d.cantidad === 'number' ? d.cantidad.toFixed(2) : '—'}
                                  </td>
                                  <td>{d.unidad || '—'}</td>
                                  <td className="num-right" style={{ color: 'var(--text-muted)' }}>
                                    {fmt(d.costoUnitReal)}
                                  </td>
                                  <td className="num-right" style={{ color: 'var(--green)' }}>
                                    {fmt(d.costoTotal)}
                                  </td>
                                  <td className="num-right">{fmt(d.precioVenta)}</td>
                                </tr>
                              ))}
                              <tr className="total-row">
                                <td colSpan={3}>
                                  <strong>TOTAL CORTINA</strong>
                                </td>
                                <td></td>
                                <td className="num-right" style={{ color: 'var(--green)' }}>
                                  <strong>{fmt(r.totalCostoAcum)}</strong>
                                </td>
                                <td className="num-right">
                                  <strong>{fmt(r.precioListaCIVA)}</strong>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ),
                ].filter(Boolean)
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">Descuento Comercial</div>
          <div style={{ padding: 16 }}>
            <div className="field-label" style={{ marginBottom: 6 }}>
              % de descuento a aplicar (máximo {maxDcto}%)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={descuento}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '')
                  // Clamp al máximo permitido (40 según config). El input
                  // no acepta valores que superen ese límite para que el
                  // vendedor no pueda "tipear más alto" por error.
                  const num = parseFloat(raw)
                  const max = parseFloat(maxDcto)
                  if (!isNaN(num) && num > max) {
                    setDescuento(String(max))
                  } else {
                    setDescuento(raw)
                  }
                }}
                style={{ width: 80, fontSize: 16, fontWeight: 600 }}
              />
              <span style={{ fontSize: 16 }}>%</span>
              {pctDcto > 0 && pctDcto <= parseFloat(maxDcto) && (
                <span className="badge badge-amber">Descuento válido</span>
              )}
              {pctDcto > parseFloat(maxDcto) && (
                <span className="badge badge-red">Supera el máximo</span>
              )}
            </div>
            {pctDcto > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                Ahorro cliente: <strong>{fmt((totalListaCIVA * pctDcto) / 100)}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Resumen Cotización</div>
          <div style={{ padding: 16 }}>
            {[
              { label: 'Total precio lista s/IVA', val: fmt(totalListaSIVA), muted: true },
              {
                label: `IVA (${(data.config.ivaRate * 100).toFixed(0)}%)`,
                val: fmt(totalListaCIVA - totalListaSIVA),
                muted: true,
              },
              { label: 'Total precio lista c/IVA', val: fmt(totalListaCIVA), bold: true },
              pctDcto > 0 && {
                label: `Descuento ${pctDcto}%`,
                val: `- ${fmt((totalListaCIVA * pctDcto) / 100)}`,
                color: 'var(--amber)',
              },
              pctDcto > 0 && {
                label: 'TOTAL CON DESCUENTO',
                val: fmt(totalConDcto),
                bold: true,
                big: true,
                color: 'var(--accent)',
              },
            ]
              .filter(Boolean)
              .map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '5px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontSize: row.big ? 14 : 13,
                      color: row.muted ? 'var(--text-muted)' : 'var(--text)',
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontWeight: row.bold ? 600 : 400,
                      fontSize: row.big ? 16 : 13,
                      color: row.color || 'var(--text)',
                    }}
                  >
                    {row.val}
                  </span>
                </div>
              ))}
            {!restringido && (
              <div
                style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Margen bruto estimado</span>
                <span
                  className={`badge ${margenReal >= 30 ? 'badge-green' : margenReal >= 15 ? 'badge-amber' : 'badge-red'}`}
                >
                  {margenReal.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
