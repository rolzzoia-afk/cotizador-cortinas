import { useData } from '../store/useData'

export default function ComposicionModelos() {
  const { data, update } = useData()

  const MODELOS = data.modelosComposicion.map(m => ({ id: m.id, nombre: m.nombre }))

  function isChecked(modeloId, insumoId) {
    const modelo = data.modelosComposicion.find(m => m.id === modeloId)
    return modelo?.insumos.some(i => i.insumoId === insumoId) ?? false
  }

  function toggleInsumo(modeloId, insumoId) {
    update(d => ({
      ...d,
      modelosComposicion: d.modelosComposicion.map(m => {
        if (m.id !== modeloId) return m
        const existe = m.insumos.some(i => i.insumoId === insumoId)
        if (existe) {
          return { ...m, insumos: m.insumos.filter(i => i.insumoId !== insumoId) }
        } else {
          const ins = d.insumos.find(i => i.id === insumoId)
          const esLineal = ins?.subcategoria?.toLowerCase().includes('peso') ||
                           ins?.subcategoria?.toLowerCase().includes('tubo') ||
                           ins?.subcategoria?.toLowerCase().includes('zuncho')
          return {
            ...m,
            insumos: [...m.insumos, {
              insumoId,
              tipo: esLineal ? 'lineal' : 'unidad',
              cantidad: 1,
              seleccionPorColor: false
            }]
          }
        }
      })
    }))
  }

  const grupos = [
    { label: 'ESTRUCTURA',   ids: data.insumos.filter(i => i.categoria === 'ESTRUCTURA').map(i => i.id) },
    { label: 'MECANISMO',    ids: data.insumos.filter(i => i.categoria === 'MECANISMO').map(i => i.id) },
    { label: 'INSUMOS',      ids: data.insumos.filter(i => i.categoria === 'INSUMO').map(i => i.id) },
    { label: 'MANO DE OBRA', ids: data.insumos.filter(i => i.categoria === 'MANO DE OBRA').map(i => i.id) },
    { label: 'COMISION',     ids: data.insumos.filter(i => i.categoria === 'COMISION').map(i => i.id) },
    { label: 'DESPACHO',     ids: data.insumos.filter(i => i.categoria === 'DESPACHO').map(i => i.id) },
  ]

  function getTipoCalculo(ins) {
    const sub = ins.subcategoria?.toLowerCase() || ''
    if (sub.includes('peso') || sub.includes('tubo') || sub.includes('zuncho')) return 'Metro lineal'
    if (ins.id === 'BRA03-B') return 'Por ancho'
    return 'Unidad'
  }

  return (
    <div>
      <div className="module-title">Composicion por Modelo</div>
      <div className="module-subtitle">
        Define que insumos lleva cada modelo. Los checks activan el calculo en la cotizacion.
        Si agregas un insumo nuevo en Lista de Precios, aparece aqui automaticamente.
      </div>

      <div className="card">
        <div className="card-header">Insumos activos por modelo</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 70 }}>Codigo</th>
                <th style={{ minWidth: 240 }}>Insumo / Descripcion</th>
                <th style={{ minWidth: 150 }}>Categoria</th>
                <th style={{ minWidth: 80 }}>Color</th>
                <th style={{ minWidth: 100 }}>Tipo calculo</th>
                {MODELOS.map(m => (
                  <th key={m.id} className="check-cell" style={{ minWidth: 100 }}>
                    <span className="badge badge-blue">{m.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Tela — siempre activa */}
              <tr style={{ background: '#f8fef8' }}>
                <td><span className="tag">TELA</span></td>
                <td style={{ fontWeight: 500 }}>Tela (segun modelo)</td>
                <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TELA</span></td>
                <td>—</td>
                <td><span className="badge badge-green">M2</span></td>
                {MODELOS.map(m => (
                  <td key={m.id} className="check-cell">
                    <span title="Siempre incluida">✅</span>
                  </td>
                ))}
              </tr>

              {grupos.map(grupo => {
                const insGrupo = data.insumos.filter(i => grupo.ids.includes(i.id) && i.activo)
                if (!insGrupo.length) return null
                return [
                  <tr key={`grp-${grupo.label}`}>
                    <td colSpan={5 + MODELOS.length} className="section-label">{grupo.label}</td>
                  </tr>,
                  ...insGrupo.map(ins => (
                    <tr key={ins.id}>
                      <td><span className="tag">{ins.id}</span></td>
                      <td style={{ fontSize: 13 }}>{ins.descripcion}</td>
                      <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ins.subcategoria}</span></td>
                      <td>
                        {ins.color
                          ? <span className="badge badge-blue" style={{ fontSize: 10 }}>{ins.color}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: 10, background: 'var(--border)', color: 'var(--text-muted)' }}>
                          {getTipoCalculo(ins)}
                        </span>
                      </td>
                      {MODELOS.map(m => (
                        <td key={m.id} className="check-cell">
                          <input
                            type="checkbox"
                            checked={isChecked(m.id, ins.id)}
                            onChange={() => toggleInsumo(m.id, ins.id)}
                            title={`${ins.id} en modelo ${m.nombre}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">Reglas de Brackets por Ancho</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ancho maximo (m)</th>
                <th>Cantidad Brackets</th>
              </tr>
            </thead>
            <tbody>
              {data.reglas.brackets.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.anchoMaximo === 99 ? 'Mayor a 2.50m' : `Hasta ${r.anchoMaximo}m`}</td>
                  <td>
                    <input type="number" value={r.cantidad} min="1" max="20"
                      onChange={e => update(d => ({
                        ...d,
                        reglas: {
                          ...d.reglas,
                          brackets: d.reglas.brackets.map((rb, i) =>
                            i === idx ? { ...rb, cantidad: parseInt(e.target.value) || 4 } : rb
                          )
                        }
                      }))}
                      className="inline-edit" style={{ width: 60 }}
                    />
                    <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}>brackets</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--accent)', border: '1px solid #c5d8ed' }}>
        Proximamente: modelos Duo Blackout, Duo Polyester y Dual. Se agregaran como columnas adicionales.
      </div>
    </div>
  )
}
