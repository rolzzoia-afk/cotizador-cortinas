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

El **número de OT** funciona igual en los dos casos: se puede teclear (por ejemplo, el del Excel) o dejar en blanco, y ahí la orden toma sola el correlativo del mes. Si el número tecleado ya existe, la app avisa y no crea la orden duplicada.

### Fase 2: la vista guiada

En Fase 2 hay dos formas de cargar cada cortina, con el mismo resultado:

- **Ficha**: la planilla de siempre, con todo a la vista. Sirve para cualquier tipo de cortina.
- **Guiada**: un paso a la vez, y la cortina se va dibujando al lado a medida que se llena. Se puede hacer clic en cualquier pieza del dibujo —el tubo, la cadena, la cenefa— para saltar a ese paso. Cubre todos los sistemas, cada uno con su dibujo:
  - **Roller, dual y dúo**: el rollo con su tela; la dual muestra los dos rollos (el del vidrio extendido, el de adelante a media caída).
  - **Vertical**: riel cabezal y lamas colgando; no pregunta tubo ni peso porque no los lleva.
  - **Oscuridad (DARK / SOFT LIGHT / OSCURANTI)**: el esqueleto del roller más sus señas — **guías laterales**, **zócalo** y el **cajón** (DARK y OSCURANTI lo llevan por sistema, sin marcarlo; el OSCURANTI además dibuja su tubo de 63 mm más gordo). Tiene un paso propio, **«Perfiles y guías»**: ahí se elige la instalación de cada perfil (muro / piso / dentro del marco) y su perforación (int/ext) — exactamente lo mismo que el gate exige para pasar a Fase 3. Los separadores y las medidas especiales se ajustan en la vista Ficha.
  - **Beeblack**: el marco con su panel acordeón corriendo hacia el lado del cierre, con la manilla en el borde. No pregunta tubo, mecanismo, peso ni cenefa (no los lleva); pide la **variante** (interno/semi/externo, de la que salen todas las medidas) y el **cierre**.

Cambiar de vista no pierde nada de lo escrito.

#### Antes de medir: ¿qué vas a cargar?

Cada vez que se aprieta **Nueva**, lo primero es decir qué hay en ese muro:

- **Ventanas estándar (1, 2, 3, 4 o más)**: son **cortinas separadas en la misma ventana**, cada una con su tubo y su medida. Se carga la primera completa y, al guardarla, **la siguiente aparece sola con la misma ficha ya copiada**: solo hay que tomarle las medidas. Así hasta completar las que se pidieron. Quedan una al lado de la otra en la lista. Mientras dura la tanda, arriba del editor se ve cuántas faltan, con un botón **No cargar las que faltan** para cortarla antes.
- **Ventanas especiales (bow window, en L, triangular)**: es **UNA sola cortina** con un paño por cara del ángulo (el bow lleva 3, la L lleva 2, la triangular 1). El modelo queda anotado en la cortina y aparece en el informe del cliente y en el Dimensionado del taller, para que nadie los confunda con cortinas sueltas. Una ventana en U se carga como bow window: son las mismas tres caras.

Si el tipo de ventana no aparece en la lista, se toma como una ventana individual.

#### Después: selecciona el tipo de cortina

Elegida la cantidad (o el modelo especial), viene la pantalla **«Selecciona el tipo de cortina»**: los sistemas dibujados y agrupados como en la carpeta de vendedores — **Roller** (SC/BK, Dual, Dúo), **Verticales**, **Sistemas de oscuridad** (Soft Light, Dark Roller, Oscuranti), **Beeblack** y **Toldos**. Se toca la tarjeta del sistema y, si la familia tiene variantes (dúo manual o motor, roller con cenefa, 38 o 45 mm), aparecen como **chips** para afinar; la tarjeta sola ya elige la variante más común. Es el mismo «Tipo de cortina» del select de la ficha, elegido mirando el dibujo — y con **N ventanas se elige una sola vez**: las hermanas heredan la ficha completa.

Lo que la app todavía no cotiza (**S. Dreams** y **Toldos**) sale gris con «Próximamente»: se ve, pero no se puede elegir. Los **tipos propios** creados en Admin aparecen como tarjetas en la sección de su grupo.

#### La cortina dual: dos telas, UNA cortina

La dual (ROL_DUAL) son **dos rollos montados en el mismo bracket**, no dos cortinas. Al elegirla, la app **crea sola el segundo rollo** y aparecen las pestañas **Paño 1** y **Paño 2**:

- **Paño 1** es el rollo que va al vidrio (normalmente la screen); **paño 2** el de adentro (el blackout). Cada uno lleva **su propia tela**: es lo único que se elige por separado.
- El dibujo muestra **los dos rollos**: el del vidrio cae entero y el de adelante queda a media ventana, que es como se usa y la única forma de ver las dos telas juntas. Si al de adelante todavía no se le eligió tela, se dibuja tenue y punteado.
- Todo lo demás —medidas, herrajes, cenefa, instalación— se escribe en los dos a la vez, porque es la misma cortina. En la lista aparece como **«Dual (2 rollos)»**.
- El kit dual, las fijaciones y **la instalación se cobran una sola vez**. Por eso una dual **nunca** se carga como dos cortinas separadas: así se pagan dos instalaciones y el taller pide dos kits.
- Si una dual quedó con **una sola tela** (viene de un Excel con el par incompleto, o de una orden vieja), el editor lo avisa arriba con el botón **Agregar la segunda tela**, y la orden no pasa a Fase 3 hasta completarla. Si estaba cargada como dos cortinas: se le agrega la segunda tela a una y se borra la otra.

#### La cortina dúo: la cenefa va sola

La dúo **siempre lleva su cenefa ovalada** — es parte del sistema, no un adicional. Por eso la app la pone sola: la cortina nace con **Cenefa: Ovalada — fija por categoría** y **CON TIRA**, y solo queda elegir el **color de tapa** y el **tipo de bracket**. Como la cenefa ya está dentro del precio de la dúo, **no se cobra aparte**: no hace falta agregar una línea CENF O en la cotización.

La **pletina dúo** (la que va pegada con velcro) no lleva cenefa.

#### El resumen de las ventanas

En la vista **Guiada**, cuando no hay ninguna cortina abierta, se ven **todas las de la orden dibujadas**, agrupadas por ubicación y con sus medidas anotadas. Las que aún no tienen medidas salen marcadas. Al tocar una se abre su ficha completa abajo, para mirar; para cambiar algo está el botón **Editar**, que la abre en la vista guiada.

Desde ahí también se puede **Replicar información**: crea **otra cortina igual a continuación**, en la misma ventana, con toda la ficha copiada —incluida la cantidad de paños y el modelo especial— y las medidas en blanco. Es lo que se usa cuando en la misma ventana van dos cortinas idénticas y solo cambian los centímetros.

El botón **Replicar** de la ficha hace algo distinto: copia la ficha de una cortina **a otras que ya existen** en la OT (tela, colores, mecanismo, cenefa, instalación) **sin tocar sus medidas ni su ubicación**. En una casa donde son todas iguales, se carga una y se replica a las demás.

### Fase 2: la visita

La pestaña **Visita** guarda lo que quedó de haber estado en la casa:

1. **Video**: se sube el recorrido explicando lo conversado. Del video se saca solo el audio (el video entero no viaja).
2. **Fotos**: hasta 20 imágenes de respaldo (muros, cornisas, enchufes, cómo estaba cada ventana), cada una con una nota opcional. Se achican solas antes de subir, así que sirven aunque haya poca señal. **Quedan en la orden: no salen en la cotización que ve el cliente.**
3. **Informe cliente**: sale con el mismo formato del correo de COTIZACIÓN FINAL — la introducción de pasos de luz según los tipos de cortina de la orden, una sección numerada por habitación (Tipo de Cortina · Color de Accesorios · Caída) y los bloques fijos al final. Hay dos maneras de llenarlo:
   - **Armar desde la orden**: arma las secciones con los datos ya cargados, sin IA. Sirve aunque todavía no haya video.
   - **Generar informe con IA**: hace lo mismo y además le agrega, habitación por habitación, lo que se conversó en el video. Los datos duros (telas, códigos, colores) no los escribe el modelo: se copian de la orden, para que no pueda equivocarlos.

   **Las fotos van adentro del informe**, igual que en el correo que se manda a mano: la foto referencial de pasos de luz debajo de su explicación y la ficha de la tela en cada habitación. En el texto se ven como una línea `[foto: …]`; abajo hay una **vista previa** que muestra cómo va a llegar. Se mueven o se borran como cualquier línea. Las fotos se cargan una sola vez en **Admin** (pasos de luz, bloques del informe y la ficha de cada tela en el catálogo).

   Si cargas una foto en Admin **después** de haber armado el informe, el botón **Actualizar fotos y bloques** la mete en su lugar **sin tocar lo que ya está escrito** (no hay que rearmarlo y perder lo conversado). Solo agrega: nunca borra ni reescribe, y apretarlo dos veces no duplica nada.

   En los dos casos **el texto queda editable: lo que vale es lo que quede escrito ahí**. El botón **Copiar** lo deja listo para pegar en el correo, **con las fotos incluidas** — se pegan en su lugar, no hay que adjuntarlas aparte.
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
- **Pasos de luz del informe de visita** (en Cotizador): con lo que abre el INFORME CLIENTE, una advertencia por tipo de cortina (duo, blackout, screen, sistemas de oscuridad, vertical) más la nota de las cortinas de varios paños. Cada una lleva sus **fotos referenciales**. Solo entran las que la orden efectivamente trae.
- **Bloques del informe de visita** (en Cotizador): los textos fijos que cierran el INFORME CLIENTE (corte de rodapié, «la medida considera los mecanismos», termopanel/aire/rack, límite de perforación, sistemas de oscuridad). Se pegan **tal cual** quedan escritos: la IA no los reescribe. También admiten fotos. Un bloque marcado «Solo oscuridad» aparece únicamente si la orden trae Soft Light, Dark, Oscuranti o BeeBlack.
- **Ficha de la tela** (en Precios → Catálogo de productos, al editar un código): la lámina del producto con su nombre, gama y ancho máximo. Sale en la sección de la habitación del informe de visita. No se usa en la cotización ni en producción.
- **Agente IA**: documentos (FAQ, tono, precios…) que alimentan al asistente de WhatsApp, mensaje de derivación y playground para probarlo. El agente SOLO responde lo que está en la FAQ; todo lo demás lo deriva a una vendedora.
- **Forzar actualización**: recarga el optimizador en todos los navegadores del taller (usar después de cada deploy).
- **Ojo de Dios**: vista de control transversal (colmena, correcciones, reconciliación, reportes, salud del inventario).

## Preguntas frecuentes

- **Importé un Excel en Fase 1 y me pedía el mecanismo, la dirección y el sentido**: ya no. Fase 1 solo exige lo que muestra —producto, ubicación, ancho y alto—; el COD SEC, la dirección de cadena y el sentido de corte se capturan en Terreno y se completan en la Fase 3.
- **La cortina de velcro no me deja elegir cadena**: es correcto. El paño va pegado con velcro, no sube ni baja, así que no lleva cadena, ni peso de cadena, ni lado de accionamiento. En el cotizador esas dos columnas aparecen como "—" y en Fase 2 no se pregunta nada de cadena.
- **¿Por qué un corte dice TUBO NUEVO y el sobrante va a una colmena?** El corte sale de un tubo nuevo de fábrica; lo que sobra se guarda en la posición indicada.
- **El Excel no trae correlativo**: pasa solo en planes antiguos; desde junio 2026 el Excel del optimizador y el del historial traen el mismo correlativo.
- **Un sobrante del plan no está físicamente**: marcarlo "No existe" en el Historial de Corte para que el inventario quede cuadrado.
- **¿Quién puede borrar/restaurar planes o aplicar correcciones retroactivas?** Solo admins (bloqueado también a nivel de base de datos).
- **La vista guiada no dibuja esta cortina**: su tipo no tiene dibujo (un tipo propio con un molde que la app no reconoce). Se carga con la ficha, que tiene exactamente los mismos campos. La oscuridad y el beeblack ya tienen su dibujo, así que este aviso solo debería aparecer en tipos raros.
- **Elegí «3 ventanas» y solo veo una**: es así. Se carga la primera y, al guardarla, aparece la segunda con la ficha ya copiada (solo faltan las medidas), y después la tercera. El aviso al guardar dice cuántas quedan.
- **Elegí «3 ventanas» y me arrepentí**: aprieta **No cargar las que faltan** en el aviso de arriba (o **Cancelar**, si tampoco quieres la que estás llenando). Lo ya guardado queda; las que faltaban no se crean.
- **Empecé una tanda y me fui a revisar otra cortina de la lista**: la tanda se corta ahí — la app no vuelve sola a ella. Para seguir, aprieta **Nueva** y elige las que falten.
- **¿Cuándo uso «bow window» y cuándo «3 ventanas»?** Si es **una sola cortina** que da la vuelta siguiendo el ángulo del muro, es bow window (o en L). Si son **cortinas distintas**, cada una con su tubo y su cadena, aunque estén pegadas, son 3 ventanas.
- **Mi ventana no es de ninguna de esas formas**: cárgala como ventana individual, y deja la explicación en el comentario de la cortina.
- **A la dúo le apareció la cenefa sola**: es la regla — la dúo siempre la lleva y ya está incluida en su precio. Antes había que acordarse de marcarla, y si no, el taller no recibía ni la tapa ni el bracket.
- **¿Le agrego la cenefa a la dúo en la cotización?** No. Va en el precio del sistema; agregar una línea CENF O la cobraría dos veces.
- **¿La dual va como una cortina o como dos?** Como **UNA**, con sus dos rollos (paño 1 al vidrio, paño 2 adentro). Cargarla como dos cortinas cobra dos instalaciones y le pide dos kits al taller. Si ya está cargada así, abre una, aprieta **Agregar la segunda tela**, elígela y borra la otra cortina.
- **Cambié la dual a otro sistema y desapareció un paño**: es a propósito. Al salir de la dual se retira el rollo que la app había creado sola, siempre que no le hayas elegido tela; si se la elegiste, el paño se queda.
- **«No se pudo leer el audio de este archivo»**: el video viene en un formato que el navegador no sabe abrir. Grabar con la cámara normal del teléfono (mp4) y volver a intentar.
- **Repliqué la ficha y las medidas no cambiaron**: es a propósito. Replicar copia la configuración, nunca lo que se fue a medir.
- **El informe no menciona una habitación**: solo aparecen las cortinas cargadas en la orden. Si falta una ventana, agrégala en Fase 2 y vuelve a tocar «Armar desde la orden».
- **Cambié un bloque en Admin y el informe viejo sigue igual**: los bloques se pegan al momento de armar el informe. Vuelve a armarlo (o edita el texto a mano) para que tome los nuevos.
- **Pegué el informe en el correo y las fotos no salieron**: pega con `Ctrl+V` en el cuerpo del correo (no en un cuadro de «texto sin formato»). Si el navegador no dejó copiar con formato, el aviso lo dice y las fotos quedan como link: ábrelo y arrástralo al correo.
- **La foto que cargué no aparece en el informe**: dos motivos posibles. (1) Quedó en un tipo de cortina que esa orden no tiene — la advertencia de duo solo entra si la orden trae una duo; revisa en qué bloque de «Pasos de luz» la cargaste. (2) El informe ya estaba armado antes: aprieta **Actualizar fotos y bloques**.
- **Avisó que no pudo ubicar una foto**: el texto del que colgaba esa foto se reescribió (a mano o por la IA), así que la app no adivina dónde ponerla — prefiere avisarte antes que dejarla en el lugar equivocado. Pégala donde corresponda, o vuelve a armar el informe.
- **Una habitación salió sin la foto de la tela**: ese código todavía no tiene ficha cargada. Se sube en **Admin → Precios → Catálogo de productos**, editando el código.
- **La IA me dejó fuera una foto**: pasa muy de vez en cuando. El aviso lo dice al terminar; aprieta **Armar desde la orden** para recuperarlas y vuelve a agregar lo conversado, o pega la foto a mano en el correo.
- **¿Por qué me pide permiso de ubicación al firmar?** Para dejar registrado dónde se dio la firma, como respaldo ante un reclamo posterior. Se pide una sola vez por dispositivo. Si se rechaza, la firma se guarda igual.
- **La firma dice "sin ubicación"**: el teléfono no la entregó — permiso rechazado, sin señal de GPS (pasa en subterráneos), o la app abierta por una dirección que no es `https`. La firma es válida igual; el motivo queda anotado en la orden.
