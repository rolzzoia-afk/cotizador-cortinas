import { useState } from 'react'
import { useData } from '../store/useData'

const IVA = 0.19
const CATEGORIAS_INSUMO = ['ESTRUCTURA', 'MECANISMO', 'INSUMO', 'MANO DE OBRA', 'COMISION', 'DESPACHO']
const SUBCATEGORIAS = ['Tubo Superior', 'Peso Inferior', 'Cenefa Ovalada', 'Cenefa Cuadrada', 'Mecanismo Roller', 'Mecanismo Dúo', 'Mecanismo Dual', 'Bracket', 'Zuncho', 'Topes', 'Tapa de Peso Inferior', 'Etiqueta', 'Peso Cadena', 'Tarugos', 'Tornillos', 'Armado', 'Instalacion', 'Review', 'Mercado Pago', 'Despacho Región', 'Otro']
const COLORES = ['', 'Negro', 'Blanco', 'Gris', 'Aluminio', 'Metalico', 'Transparente', 'Café']
const CATEGORIAS_TELA = ['Tela Blackout', 'Tela Screen', 'Tela Duo Blackout', 'Tela Duo Polyester']

function calcCIVA(ins) { return ins.costoSinIVA * (1 + IVA) }
function calcCIVAConDcto(ins) {
  const base = calcCIVA(ins)
  const d1 = ins.descuento1 > 0 ? ins.descuento1 : 1
  const d2 = ins.descuento2 > 0 ? ins.descuento2 : 1
  return base * d1 * d2
}
function fmt(n) { return Math.round(n).toLocaleString('es-CL') }

function newInsumo(id) {
  return { id: `INS-${id}`, categoria: 'INSUMO', subcategoria: 'Otro', color: '', descripcion: 'Nuevo insumo', proveedor: '', costoSinIVA: 0, descuento1: 0, descuento2: 0, sku: '', activo: true }
}
function newTela(id) {
  return { id: `T-NEW-${id}`, categoria: 'Tela Blackout', descripcion: 'Nueva tela', proveedor: '', anchoMetros: 3.0, costoSinIVA: 0, descuento1: 0, descuento2: 0, sku: '', activo: true }
}

export default function ListaPrecios() {
  const { data, update } = useData()
  const [seccion, setSeccion] = useState('insumos')
  const [filterCat, setFilterCat] = useState('TODAS')
  const [globalMargen, setGlobalMargen] = useState('')
  const [globalDcto, setGlobalDcto] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  const categorias = ['TODAS', ...new Set(data.insumos.map(i => i.categoria))]
  const insumosFiltrados = data.insumos.filter(i => filterCat === 'TODAS' || i.categoria === filterCat)

  function updateInsumo(id, field, value) {
    update(d => ({ ...d, insumos: d.insumos.map(i => i.id === id ? { ...i, [field]: value } : i) }))
  }
  function updateTela(id, field, value) {
    update(d => ({ ...d, telas: d.telas.map(t => t.id === id ? { ...t, [field]: value } : t) }))
  }
  function addInsumo() {
    const id = Date.now()
    update(d => ({ ...d, insumos: [...d.insumos, newInsumo(id)] }))
  }
  function addTela() {
    const id = Date.now()
    update(d => ({ ...d, telas: [...d.telas, newTela(id)] }))
  }
  function deleteInsumo(id) {
    update(d => ({ ...d, insumos: d.insumos.filter(i => i.id !== id) }))
    setConfirmDel(null)
  }
  function deleteTela(id) {
    update(d => ({ ...d, telas: d.telas.filter(t => t.id !== id) }))
    setConfirmDel(null)
  }
  function applyGlobalMargen() {
    const val = parseFloat(globalMargen)
    if (isNaN(val) || val <= 0 || val >= 1) return
    update(d => ({ ...d, config: { ...d.config, margenBase: val } }))
    setGlobalMargen('')
  }
  function applyGlobalDcto() {
    const val = parseFloat(globalDcto)
    if (isNaN(val) || val <= 0 || val >= 1) return
    update(d => ({ ...d, config: { ...d.config, margenDescuento: val } }))
    setGlobalDcto('')
  }
  function updateConfig(field, value) {
    update(d => ({ ...d, config: { ...d.config, [field]: value } }))
  }

  return (
    <div>
      <div className="module-title">Lista de Precios</div>
      <div className="module-subtitle">Todos los insumos y telas. Edita celda por celda, agrega o elimina filas.</div>

      {/* Config global */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 13 }}>⚙️ Configuración Global de Márgenes</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="field-label">Margen base</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={globalMargen || data.config.margenBase} step="0.01" min="0.1" max="0.99"
                onChange={e => setGlobalMargen(e.target.value)} style={{ width: 80 }} />
              <button className="btn btn-primary btn-sm" onClick={applyGlobalMargen}>Aplicar</button>
              <span className="badge badge-blue">Actual: {(data.config.margenBase * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="field-label">Factor descuento comercial</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={globalDcto || data.config.margenDescuento} step="0.01" min="0.1" max="0.99"
                onChange={e => setGlobalDcto(e.target.value)} style={{ width: 80 }} />
              <button className="btn btn-primary btn-sm" onClick={applyGlobalDcto}>Aplicar</button>
              <span className="badge badge-blue">Dcto máx: {((1 - data.config.margenDescuento) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="field-label">IVA (%)</div>
            <input type="number" value={(data.config.ivaRate * 100).toFixed(0)} step="1" min="0"
              onChange={e => updateConfig('ivaRate', parseFloat(e.target.value) / 100 || 0)}
              style={{ width: 70 }} />
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          Fórmula precio venta: <code>Costo C/IVA ÷ {data.config.margenBase} ÷ {data.config.margenDescuento}</code>
          &nbsp;→ permite dar hasta <strong>{((1 - data.config.margenDescuento) * 100).toFixed(0)}% de descuento</strong> manteniendo margen real de <strong>{((1 - data.config.margenBase) * 100).toFixed(0)}%</strong>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['insumos', 'telas'].map(s => (
          <button key={s} className={`btn ${seccion === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSeccion(s)}>
            {s === 'insumos' ? '🔩 Insumos y Estructuras' : '🎨 Telas'}
          </button>
        ))}
      </div>

      {/* Modal confirmación eliminar */}
      {confirmDel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 24, maxWidth: 380, width: '90%' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>¿Eliminar este ítem?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              <strong>{confirmDel.descripcion}</strong><br />Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => confirmDel.tipo === 'insumo' ? deleteInsumo(confirmDel.id) : deleteTela(confirmDel.id)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {seccion === 'insumos' && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span>🔩 Insumos, Estructuras y Mano de Obra ({insumosFiltrados.length} ítems)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>
              <button className="btn btn-success btn-sm" onClick={addInsumo}>+ Agregar insumo</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>On</th>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th>Sub Categoría</th>
                  <th>Descripción</th>
                  <th>Color</th>
                  <th>Proveedor</th>
                  <th className="num-right">Costo s/IVA</th>
                  <th className="num-right">IVA</th>
                  <th className="num-right">C/IVA Sin Dcto</th>
                  <th>Dcto 1</th>
                  <th>Dcto 2</th>
                  <th className="num-right">C/IVA Con Dcto</th>
                  <th className="num-right">P. Venta Ref.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insumosFiltrados.map(ins => {
                  const civa = calcCIVA(ins)
                  const civaConDcto = calcCIVAConDcto(ins)
                  const precioVentaRef = civa / data.config.margenBase / data.config.margenDescuento
                  return (
                    <tr key={ins.id}>
                      <td className="check-cell">
                        <input type="checkbox" checked={ins.activo} onChange={e => updateInsumo(ins.id, 'activo', e.target.checked)} />
                      </td>
                      <td>
                        <input type="text" value={ins.id}
                          onChange={e => updateInsumo(ins.id, 'id', e.target.value)}
                          className="inline-edit" style={{ width: 80, fontFamily: 'monospace', fontSize: 11 }} />
                      </td>
                      <td>
                        <select value={ins.categoria} onChange={e => updateInsumo(ins.id, 'categoria', e.target.value)}
                          className="inline-edit" style={{ width: 120, fontSize: 11 }}>
                          {CATEGORIAS_INSUMO.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={ins.subcategoria} onChange={e => updateInsumo(ins.id, 'subcategoria', e.target.value)}
                          className="inline-edit" style={{ width: 130, fontSize: 11 }}>
                          {SUBCATEGORIAS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ minWidth: 200 }}>
                        <input type="text" value={ins.descripcion}
                          onChange={e => updateInsumo(ins.id, 'descripcion', e.target.value)}
                          className="inline-edit" style={{ width: '100%' }} />
                      </td>
                      <td>
                        <select value={ins.color} onChange={e => updateInsumo(ins.id, 'color', e.target.value)}
                          className="inline-edit" style={{ width: 100 }}>
                          {COLORES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" value={ins.proveedor}
                          onChange={e => updateInsumo(ins.id, 'proveedor', e.target.value)}
                          className="inline-edit" style={{ width: 100, fontSize: 11 }} />
                      </td>
                      <td className="num-right">
                        <input type="number" value={ins.costoSinIVA} min="0"
                          onChange={e => updateInsumo(ins.id, 'costoSinIVA', parseFloat(e.target.value) || 0)}
                          className="inline-edit num" style={{ width: 80, textAlign: 'right' }} />
                      </td>
                      <td className="num-right" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmt(ins.costoSinIVA * IVA)}</td>
                      <td className="num-right" style={{ fontWeight: 500 }}>{fmt(civa)}</td>
                      <td>
                        <input type="number" value={ins.descuento1} min="0" max="1" step="0.01"
                          onChange={e => updateInsumo(ins.id, 'descuento1', parseFloat(e.target.value) || 0)}
                          className="inline-edit" style={{ width: 58 }} />
                      </td>
                      <td>
                        <input type="number" value={ins.descuento2} min="0" max="1" step="0.01"
                          onChange={e => updateInsumo(ins.id, 'descuento2', parseFloat(e.target.value) || 0)}
                          className="inline-edit" style={{ width: 58 }} />
                      </td>
                      <td className="num-right" style={{ color: 'var(--green)', fontSize: 12 }}>{fmt(civaConDcto)}</td>
                      <td className="num-right" style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmt(precioVentaRef)}</td>
                      <td>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDel({ id: ins.id, descripcion: ins.descripcion, tipo: 'insumo' })}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={15} style={{ padding: '8px 10px' }}>
                    <button className="btn btn-success btn-sm" onClick={addInsumo}>+ Agregar insumo</button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {seccion === 'telas' && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span>🎨 Telas — C/IVA sin descuentos (base para cotización)</span>
            <button className="btn btn-success btn-sm" onClick={addTela}>+ Agregar tela</button>
          </div>
          <div style={{ padding: '8px 16px', background: 'var(--amber-bg)', fontSize: 12, color: 'var(--amber)', borderBottom: '1px solid var(--border)' }}>
            ⚡ Regla activa: el cotizador usa SIEMPRE el precio C/IVA más caro dentro de cada categoría de tela.
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>On</th>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Proveedor</th>
                  <th>SKU</th>
                  <th className="num-right">Ancho (m)</th>
                  <th className="num-right">Costo s/IVA</th>
                  <th className="num-right">C/IVA Sin Dcto</th>
                  <th>Dcto 1</th>
                  <th>Dcto 2</th>
                  <th className="num-right">C/IVA Con Dcto</th>
                  <th>¿Usada?</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIAS_TELA.map(cat => {
                  const telasCat = data.telas.filter(t => t.categoria === cat)
                  if (!telasCat.length) return null
                  const maxCosto = Math.max(...telasCat.map(t => t.costoSinIVA * (1 + IVA)))
                  return telasCat.map((tela) => {
                    const civa = tela.costoSinIVA * (1 + IVA)
                    const civaConDcto = civa * (tela.descuento1 > 0 ? tela.descuento1 : 1) * (tela.descuento2 > 0 ? tela.descuento2 : 1)
                    const esMasCara = civa === maxCosto
                    return (
                      <tr key={tela.id} style={esMasCara ? { background: '#fffbe6' } : {}}>
                        <td className="check-cell">
                          <input type="checkbox" checked={tela.activo} onChange={e => updateTela(tela.id, 'activo', e.target.checked)} />
                        </td>
                        <td>
                          <input type="text" value={tela.id}
                            onChange={e => updateTela(tela.id, 'id', e.target.value)}
                            className="inline-edit" style={{ width: 90, fontFamily: 'monospace', fontSize: 11 }} />
                        </td>
                        <td>
                          <select value={tela.categoria} onChange={e => updateTela(tela.id, 'categoria', e.target.value)}
                            className="inline-edit" style={{ width: 140, fontSize: 11 }}>
                            {CATEGORIAS_TELA.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ minWidth: 240 }}>
                          <input type="text" value={tela.descripcion}
                            onChange={e => updateTela(tela.id, 'descripcion', e.target.value)}
                            className="inline-edit" style={{ width: '100%' }} />
                        </td>
                        <td>
                          <input type="text" value={tela.proveedor}
                            onChange={e => updateTela(tela.id, 'proveedor', e.target.value)}
                            className="inline-edit" style={{ width: 90, fontSize: 11 }} />
                        </td>
                        <td>
                          <input type="text" value={tela.sku}
                            onChange={e => updateTela(tela.id, 'sku', e.target.value)}
                            className="inline-edit" style={{ width: 110, fontSize: 11 }} />
                        </td>
                        <td className="num-right">
                          <input type="number" value={tela.anchoMetros} min="0.5" max="5" step="0.1"
                            onChange={e => updateTela(tela.id, 'anchoMetros', parseFloat(e.target.value) || 3)}
                            className="inline-edit" style={{ width: 60, textAlign: 'right' }} />
                        </td>
                        <td className="num-right">
                          <input type="number" value={tela.costoSinIVA} min="0"
                            onChange={e => updateTela(tela.id, 'costoSinIVA', parseFloat(e.target.value) || 0)}
                            className="inline-edit num" style={{ width: 80, textAlign: 'right' }} />
                        </td>
                        <td className="num-right" style={{ fontWeight: 500 }}>{fmt(civa)}</td>
                        <td>
                          <input type="number" value={tela.descuento1} min="0" max="1" step="0.01"
                            onChange={e => updateTela(tela.id, 'descuento1', parseFloat(e.target.value) || 0)}
                            className="inline-edit" style={{ width: 58 }} />
                        </td>
                        <td>
                          <input type="number" value={tela.descuento2} min="0" max="1" step="0.01"
                            onChange={e => updateTela(tela.id, 'descuento2', parseFloat(e.target.value) || 0)}
                            className="inline-edit" style={{ width: 58 }} />
                        </td>
                        <td className="num-right" style={{ color: 'var(--green)', fontSize: 12 }}>{fmt(civaConDcto)}</td>
                        <td className="check-cell">
                          {esMasCara && <span className="badge badge-amber">✓ usada</span>}
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDel({ id: tela.id, descripcion: tela.descripcion, tipo: 'tela' })}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })
                })}
                {/* Telas sin categoría definida */}
                {data.telas.filter(t => !CATEGORIAS_TELA.includes(t.categoria)).map(tela => {
                  const civa = tela.costoSinIVA * (1 + IVA)
                  const civaConDcto = civa * (tela.descuento1 > 0 ? tela.descuento1 : 1) * (tela.descuento2 > 0 ? tela.descuento2 : 1)
                  return (
                    <tr key={tela.id} style={{ background: '#fff8f0' }}>
                      <td className="check-cell"><input type="checkbox" checked={tela.activo} onChange={e => updateTela(tela.id, 'activo', e.target.checked)} /></td>
                      <td><input type="text" value={tela.id} onChange={e => updateTela(tela.id, 'id', e.target.value)} className="inline-edit" style={{ width: 90, fontFamily: 'monospace', fontSize: 11 }} /></td>
                      <td><select value={tela.categoria} onChange={e => updateTela(tela.id, 'categoria', e.target.value)} className="inline-edit" style={{ width: 140, fontSize: 11 }}>{CATEGORIAS_TELA.map(c => <option key={c}>{c}</option>)}</select></td>
                      <td><input type="text" value={tela.descripcion} onChange={e => updateTela(tela.id, 'descripcion', e.target.value)} className="inline-edit" style={{ width: '100%' }} /></td>
                      <td><input type="text" value={tela.proveedor} onChange={e => updateTela(tela.id, 'proveedor', e.target.value)} className="inline-edit" style={{ width: 90, fontSize: 11 }} /></td>
                      <td><input type="text" value={tela.sku} onChange={e => updateTela(tela.id, 'sku', e.target.value)} className="inline-edit" style={{ width: 110, fontSize: 11 }} /></td>
                      <td className="num-right"><input type="number" value={tela.anchoMetros} min="0.5" max="5" step="0.1" onChange={e => updateTela(tela.id, 'anchoMetros', parseFloat(e.target.value) || 3)} className="inline-edit" style={{ width: 60, textAlign: 'right' }} /></td>
                      <td className="num-right"><input type="number" value={tela.costoSinIVA} min="0" onChange={e => updateTela(tela.id, 'costoSinIVA', parseFloat(e.target.value) || 0)} className="inline-edit num" style={{ width: 80, textAlign: 'right' }} /></td>
                      <td className="num-right" style={{ fontWeight: 500 }}>{fmt(civa)}</td>
                      <td><input type="number" value={tela.descuento1} min="0" max="1" step="0.01" onChange={e => updateTela(tela.id, 'descuento1', parseFloat(e.target.value) || 0)} className="inline-edit" style={{ width: 58 }} /></td>
                      <td><input type="number" value={tela.descuento2} min="0" max="1" step="0.01" onChange={e => updateTela(tela.id, 'descuento2', parseFloat(e.target.value) || 0)} className="inline-edit" style={{ width: 58 }} /></td>
                      <td className="num-right" style={{ color: 'var(--green)', fontSize: 12 }}>{fmt(civaConDcto)}</td>
                      <td></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => setConfirmDel({ id: tela.id, descripcion: tela.descripcion, tipo: 'tela' })}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={14} style={{ padding: '8px 10px' }}>
                    <button className="btn btn-success btn-sm" onClick={addTela}>+ Agregar tela</button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
