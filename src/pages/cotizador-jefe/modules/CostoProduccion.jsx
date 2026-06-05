export default function CostoProduccion() {
  return (
    <div>
      <div className="module-title">Costo Producción</div>
      <div className="module-subtitle">
        Sección en construcción. Próxima versión: detalle de costos por OT con metros usados,
        descuentos aplicados, margen real por línea.
      </div>

      <div className="card" style={{ marginTop: 20, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Próximamente</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Esta pestaña va a mostrar el costo real de producción por cotización,
          incluyendo metros usados, descuentos del proveedor y margen efectivo.
        </div>
      </div>
    </div>
  )
}
