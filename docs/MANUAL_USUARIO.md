# Manual de usuario

Guía de operación diaria, organizada por rol. El rol de cada persona se asigna en **Admin → Usuarios y roles** y define qué secciones ve y puede usar.

## Roles y accesos

| Rol | Accede a |
|---|---|
| `admin` | Todo el sistema, incluido el panel Admin y Ojo de Dios |
| `ventas` | Panel de OTs, Cotizador, Ventas (KPIs), Leads, Inteligencia, Cotizador del Jefe (modo vendedor) |
| `bodeguero` | Telas, Inventario, Bodega, Camionetas, Conteo de inventario |
| `produccion` | Optimizador, Historial de Corte, Historial de Tubos, Telas |
| `dimensionado` | Historial de Corte, Telas |
| `telas` | Telas |
| `operario` | Todas las secciones de taller (telas, inventario, optimizador, bodega, camionetas, historiales) |
| `pruebas` | Panel de OTs |

Si alguien ve "No tienes acceso a esta sección", su rol no corresponde — el admin lo ajusta en Usuarios y roles.

---

## Flujo comercial (rol ventas)

1. **Leads**: los contactos entran al pipeline en **Leads**. Cada lead tiene actividad, seguimientos y cambio de estado. Desde el detalle se puede pasar a cotizar.
2. **Cotizar (Fase 0)**: en **Cotizar**, agregar líneas (producto, ancho, alto, cantidad, descuento) y adicionales. Los precios usan el catálogo y los parámetros de la empresa (IVA, márgenes, instalación, etc.). El total muestra transferencia y tarjeta, con abono del 50%.
3. **Panel de OTs**: cada orden avanza por estados: cotización → esperando → terreno → aprobada → producción (con sub-etapas Estructura → Paños → Dimensionado → Armado → Prueba → Lista) → lista → instalada. El botón de WhatsApp envía al cliente el mensaje del estado actual, firmado con el nombre de la empresa.
4. **Fases 1-4 de la OT**: datos generales → ventanas/medidas → tela → producción. En Fase 4 se generan el PDF de producción y las etiquetas.

## Flujo de taller (producción / bodega)

1. **Optimizador** (producción): carga las órdenes del día, propone desde qué tubo cortar cada pieza (sobrante de colmena, reemplazo o tubo nuevo) minimizando desperdicio. Al **Confirmar**: descuenta el inventario, registra los eventos de trazabilidad, guarda el plan y descarga el Excel del plan con su **CORRELATIVO** (orden de prioridad por fecha de entrega).
2. **Reglas del plan**:
   - *CORTAR*: cortar la medida indicada del tubo de la colmena señalada (o TUBO NUEVO).
   - *GUARDAR SOBRANTE*: el resto vuelve a la colmena indicada.
   - *DESECHAR MERMA*: restos de **10 cm o menos** van al basurero, nunca a la colmena.
   - *RESERVAR EN MESA*: el sobrante se reutiliza en un corte posterior del mismo plan; dejarlo en la mesa.
3. **Historial de Corte**: muestra cada plan con sus líneas. Ahí se registran **errores de corte** (botón ⚠ Error, con motivo y reemplazo) y se marca un sobrante como **No existe** si físicamente no está. El Excel se puede re-descargar con el correlativo.
4. **Inventario / Colmena**: estado de los tubos por posición. El conteo físico se hace en **Conteo de inventario** y el admin puede resetear con **Cargar inventario base desde Excel**.
5. **Bodega y Camionetas** (bodeguero): despacho y recepción de materiales con QR, carga/devolución/intercambio de insumos por camioneta.

## Panel Admin (solo admin)

- **Usuarios y roles**: asignar el rol de cada integrante. Los cambios aplican al instante.
- **Parámetros de cotización**: IVA, margen de insumos, recargo tarjeta, instalación, mano de obra y traslado de TU empresa. "Restaurar defaults" vuelve a los valores históricos.
- **Cargar inventario base desde Excel**: reseteo completo del inventario de tubos a partir del conteo físico.
- **Agente IA**: documentos (FAQ, tono, precios…) que alimentan al asistente de WhatsApp, mensaje de derivación y playground para probarlo. El agente SOLO responde lo que está en la FAQ; todo lo demás lo deriva a una vendedora.
- **Forzar actualización**: recarga el optimizador en todos los navegadores del taller (usar después de cada deploy).
- **Ojo de Dios**: vista de control transversal (colmena, correcciones, reconciliación, reportes, salud del inventario).

## Preguntas frecuentes

- **¿Por qué un corte dice TUBO NUEVO y el sobrante va a una colmena?** El corte sale de un tubo nuevo de fábrica; lo que sobra se guarda en la posición indicada.
- **El Excel no trae correlativo**: pasa solo en planes antiguos; desde junio 2026 el Excel del optimizador y el del historial traen el mismo correlativo.
- **Un sobrante del plan no está físicamente**: marcarlo "No existe" en el Historial de Corte para que el inventario quede cuadrado.
- **¿Quién puede borrar/restaurar planes o aplicar correcciones retroactivas?** Solo admins (bloqueado también a nivel de base de datos).
