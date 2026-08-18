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

### Empezar la cotización en terreno

Una cotización puede nacer de dos maneras, y las dos terminan en la **Fase 3** (la cotización final que se le manda al cliente):

- **Nueva OT** — se cotiza en el escritorio, con precios desde el primer momento.
- **Nueva OT — Terreno** — se va a la casa del cliente y se cargan las cortinas midiendo. Los precios los calcula la Fase 3 después, con lo que se midió.

### Fase 2: la vista guiada

En Fase 2 hay dos formas de cargar cada cortina, con el mismo resultado:

- **Ficha**: la planilla de siempre, con todo a la vista. Sirve para cualquier tipo de cortina.
- **Guiada**: un paso a la vez, y la cortina se va dibujando al lado a medida que se llena. Se puede hacer clic en cualquier pieza del dibujo —el tubo, la cadena, la cenefa— para saltar a ese paso. Cubre roller, dual y dúo; las verticales, los sistemas de oscuridad y el beeblack se cargan siempre con la ficha.

Cambiar de vista no pierde nada de lo escrito. El botón **Replicar** copia la ficha de una cortina a las demás de la OT (tela, colores, mecanismo, cenefa, instalación) **sin tocar sus medidas ni su ubicación**: en una casa donde son todas iguales, se carga una y se replica.

### Fase 2: la visita

La pestaña **Visita** guarda lo que quedó de haber estado en la casa:

1. **Video**: se sube el recorrido explicando lo conversado. Del video se saca solo el audio (el video entero no viaja).
2. **Fotos**: hasta 20 imágenes de respaldo (muros, cornisas, enchufes, cómo estaba cada ventana), cada una con una nota opcional. Se achican solas antes de subir, así que sirven aunque haya poca señal. **Quedan en la orden: no salen en la cotización que ve el cliente.**
3. **Informe cliente**: sale con el mismo formato del correo de COTIZACIÓN FINAL — la introducción de pasos de luz según los tipos de cortina de la orden, una sección numerada por habitación (Tipo de Cortina · Color de Accesorios · Caída) y los bloques fijos al final. Hay dos maneras de llenarlo:
   - **Armar desde la orden**: arma las secciones con los datos ya cargados, sin IA. Sirve aunque todavía no haya video.
   - **Generar informe con IA**: hace lo mismo y además le agrega, habitación por habitación, lo que se conversó en el video. Los datos duros (telas, códigos, colores) no los escribe el modelo: se copian de la orden, para que no pueda equivocarlos.

   En los dos casos **el texto queda editable: lo que vale es lo que quede escrito ahí**. El botón **Copiar** lo deja listo para pegar en el correo.
4. **Resumen de visita**: las preguntas que hay que dejar conversadas antes de irse (tiempos, pasos de luz, estacionamiento, techos y muros). Se editan en **Admin → Cotizador → Resumen de visita**.
5. **Firma del cliente**: se firma con el dedo en pantalla. Al guardar la firma **se registra también la ubicación** como respaldo: si más adelante el cliente discute la visita, queda la firma y el lugar donde se dio, con un link al mapa. Si el teléfono no entrega la ubicación (el cliente no da el permiso, o no hay señal), **la firma se guarda igual** y queda anotado el motivo. Una vez firmado, el informe queda bloqueado; para cambiarlo hay que volver a pedir la firma.

El video, las fotos y la firma se guardan en un almacén privado de la empresa: no quedan con una dirección pública.

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
- **Resumen de visita** (en Cotizador): las preguntas que el vendedor confirma con el cliente antes de irse. Se agregan, se ordenan y se apagan. Las respuestas se guardan por pregunta, así que apagar o borrar una acá **no** toca lo ya contestado en OTs anteriores.
- **Bloques del informe de visita** (en Cotizador): los textos fijos que cierran el INFORME CLIENTE (corte de rodapié, «la medida considera los mecanismos», termopanel/aire/rack, límite de perforación, sistemas de oscuridad). Se pegan **tal cual** quedan escritos: la IA no los reescribe. Un bloque marcado «Solo oscuridad» aparece únicamente si la orden trae Soft Light, Dark, Oscuranti o BeeBlack.
- **Agente IA**: documentos (FAQ, tono, precios…) que alimentan al asistente de WhatsApp, mensaje de derivación y playground para probarlo. El agente SOLO responde lo que está en la FAQ; todo lo demás lo deriva a una vendedora.
- **Forzar actualización**: recarga el optimizador en todos los navegadores del taller (usar después de cada deploy).
- **Ojo de Dios**: vista de control transversal (colmena, correcciones, reconciliación, reportes, salud del inventario).

## Preguntas frecuentes

- **¿Por qué un corte dice TUBO NUEVO y el sobrante va a una colmena?** El corte sale de un tubo nuevo de fábrica; lo que sobra se guarda en la posición indicada.
- **El Excel no trae correlativo**: pasa solo en planes antiguos; desde junio 2026 el Excel del optimizador y el del historial traen el mismo correlativo.
- **Un sobrante del plan no está físicamente**: marcarlo "No existe" en el Historial de Corte para que el inventario quede cuadrado.
- **¿Quién puede borrar/restaurar planes o aplicar correcciones retroactivas?** Solo admins (bloqueado también a nivel de base de datos).
- **La vista guiada no dibuja esta cortina**: es de un sistema que se fabrica distinto a un roller (vertical, oscuridad o beeblack). Se carga con la ficha, que tiene exactamente los mismos campos.
- **«No se pudo leer el audio de este archivo»**: el video viene en un formato que el navegador no sabe abrir. Grabar con la cámara normal del teléfono (mp4) y volver a intentar.
- **Repliqué la ficha y las medidas no cambiaron**: es a propósito. Replicar copia la configuración, nunca lo que se fue a medir.
- **El informe no menciona una habitación**: solo aparecen las cortinas cargadas en la orden. Si falta una ventana, agrégala en Fase 2 y vuelve a tocar «Armar desde la orden».
- **Cambié un bloque en Admin y el informe viejo sigue igual**: los bloques se pegan al momento de armar el informe. Vuelve a armarlo (o edita el texto a mano) para que tome los nuevos.
- **¿Por qué me pide permiso de ubicación al firmar?** Para dejar registrado dónde se dio la firma, como respaldo ante un reclamo posterior. Se pide una sola vez por dispositivo. Si se rechaza, la firma se guarda igual.
- **La firma dice "sin ubicación"**: el teléfono no la entregó — permiso rechazado, sin señal de GPS (pasa en subterráneos), o la app abierta por una dirección que no es `https`. La firma es válida igual; el motivo queda anotado en la orden.
