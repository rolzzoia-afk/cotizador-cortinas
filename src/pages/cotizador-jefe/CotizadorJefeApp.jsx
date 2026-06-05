import { useRef, useState } from 'react'
import ListaPrecios from './modules/ListaPrecios'
import ComposicionModelos from './modules/ComposicionModelos'
import Cotizador from './modules/Cotizador'
import CostoProduccion from './modules/CostoProduccion'
import HistorialCotizaciones from './modules/HistorialCotizaciones'
import { resetToDefaults, exportData, importData } from './store/useData'
import './CotizadorJefe.css'

const TABS_ADMIN = [
  { id: 'lista', label: 'Lista de Precios' },
  { id: 'composicion', label: 'Composicion Modelos' },
  { id: 'cotizador', label: 'Cotizador' },
  { id: 'historial', label: 'Cotizaciones guardadas' },
  { id: 'costo', label: 'Costo Produccion' },
]
const TABS_VENTAS = [
  { id: 'cotizador', label: 'Cotizador' },
  { id: 'historial', label: 'Cotizaciones guardadas' },
]

// Modo restringido (rol "ventas"):
// - Solo se muestra el tab "Cotizador"
// - No se muestran los botones Exportar / Importar / Reset (admin-only)
// - Se oculta el "Margen bruto estimado" dentro del Cotizador
// - El input de descuento ya está clampeado al máximo permitido para todos
export default function App({ restringido = false } = {}) {
  const [tab, setTab] = useState('cotizador')
  const [confirmReset, setConfirmReset] = useState(false)
  const [importInfo, setImportInfo] = useState(null)
  const fileInputRef = useRef(null)
  // Cotización a cargar en el Cotizador (cuando se abre desde el Historial).
  // Cambia a null después de que el Cotizador la consume.
  const [cotizacionACargar, setCotizacionACargar] = useState(null)

  // Lista de tabs según el rol
  const TABS = restringido ? TABS_VENTAS : TABS_ADMIN

  function handleReset() {
    resetToDefaults()
    setConfirmReset(false)
    window.location.reload()
  }

  // Descarga la configuración actual como archivo JSON.
  function handleExport() {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const fecha = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `rolzzo-config-${fecha}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setImportInfo({ tipo: 'ok', msg: `✓ Configuración exportada: rolzzo-config-${fecha}.json` })
    setTimeout(() => setImportInfo(null), 4000)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target.result
        const parsed = JSON.parse(text)
        importData(parsed)
        setImportInfo({
          tipo: 'ok',
          msg: `✓ Configuración importada (${parsed.insumos.length} insumos · ${parsed.telas.length} telas · ${parsed.modelosComposicion.length} modelos). Recargando…`,
        })
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) {
        setImportInfo({ tipo: 'error', msg: `✗ Error: ${err.message || String(err)}` })
      } finally {
        e.target.value = ''
      }
    }
    reader.onerror = () => setImportInfo({ tipo: 'error', msg: '✗ No se pudo leer el archivo' })
    reader.readAsText(file)
  }

  // En modo restringido solo permitimos cotizador / historial.
  const tabActivo = restringido && tab !== 'historial' && tab !== 'cotizador' ? 'cotizador' : tab

  // Handler: cargar una cotización guardada al Cotizador
  function handleAbrirCotizacion(cotizacion) {
    setCotizacionACargar(cotizacion)
    setTab('cotizador')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <img
            src="/Siane%20otro.png"
            alt="Siane"
            className="app-logo"
            onError={(e) => {
              // Si por alguna razón no carga la imagen, mostramos un fallback textual
              // para no romper el layout (ej. mientras se sube el asset por primera vez).
              e.currentTarget.style.display = 'none'
              const fallback = e.currentTarget.nextSibling
              if (fallback) fallback.style.display = 'inline'
            }}
          />
          <span className="app-brand-fallback" style={{ display: 'none' }}>
            Siane
          </span>
          <span className="app-subtitle">Sistema de Cotizacion v1.1</span>
        </div>

        <nav className="app-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {!restringido && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 16, alignItems: 'center' }}>
            <button
              className="nav-btn"
              style={{ fontSize: 12 }}
              onClick={handleExport}
              title="Descargar todos los datos (precios, modelos, composicion) como un archivo JSON"
            >
              📥 Exportar
            </button>
            <button
              className="nav-btn"
              style={{ fontSize: 12 }}
              onClick={handleImportClick}
              title="Cargar un JSON previamente exportado y reemplazar la configuracion actual"
            >
              📤 Importar
            </button>
            <button
              className="nav-btn"
              style={{ fontSize: 11, opacity: 0.6 }}
              onClick={() => setConfirmReset(true)}
              title="Restaurar datos originales"
            >
              ↺ Reset
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
        )}
      </header>

      {importInfo && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            right: 24,
            zIndex: 200,
            background: importInfo.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
            color: importInfo.tipo === 'ok' ? '#16a34a' : '#dc2626',
            border: `1px solid ${importInfo.tipo === 'ok' ? '#86efac' : '#fca5a5'}`,
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxWidth: 480,
          }}
        >
          {importInfo.msg}
        </div>
      )}

      {confirmReset && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ background: 'white', borderRadius: 8, padding: 24, maxWidth: 360, width: '90%' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Restaurar datos originales</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Esto borra todos los cambios que hayas hecho a precios e insumos y vuelve a los valores
              iniciales. Las cotizaciones no se ven afectadas.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleReset}>
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        {tabActivo === 'lista' && <ListaPrecios />}
        {tabActivo === 'composicion' && <ComposicionModelos />}
        {tabActivo === 'cotizador' && (
          <Cotizador
            restringido={restringido}
            cotizacionACargar={cotizacionACargar}
            onCotizacionCargada={() => setCotizacionACargar(null)}
          />
        )}
        {tabActivo === 'historial' && (
          <HistorialCotizaciones onEditar={handleAbrirCotizacion} restringido={restringido} />
        )}
        {tabActivo === 'costo' && <CostoProduccion />}
      </main>
    </div>
  )
}
