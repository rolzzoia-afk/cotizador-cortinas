# Diseño del módulo de Inventario

Maquetas aprobadas por el dueño el 2026-09-08 («me gusta el diseño»). **Son la
fuente de verdad visual del módulo `/inventario`**: si el código y una lámina no
coinciden, gana la lámina, salvo que el dueño haya pedido otra cosa después.

Canvas navegable (pan/zoom, 3 páginas):
<https://claude.ai/code/artifact/374f3848-f5a6-4cb6-8e33-196f3a12c0fb>

Cada archivo `.dc.html` es un artboard y se abre solo en el navegador.
`canvas.json` guarda la posición de cada uno, las 3 páginas y las notas.
Todo el HTML es estático: no hay datos vivos ni lógica, y los números que se ven
salieron de una consulta real a producción el día del diseño.

## Escritorio (1440 × 900)

| Archivo | Qué decide |
|---|---|
| `Mapa.dc.html` | Las 15 rutas de `/inventario/*`, la matriz rol × submódulo, los redirects de las rutas viejas y dónde entra Compras |
| `Main.dc.html` | El armazón: TopBar + barra lateral de 248 px con sus 3 grupos + el Tablero con 6 KPI, movimientos del día, conteo activo y atajos |
| `Insumos.dc.html` | Catálogo: columnas, saldo por almacén, badges de estado, filtros, densidad de la tabla, pie con conteos |
| `Ficha.dc.html` | Ficha de un artículo (sirve igual para insumo y para tela): saldo por almacén, pestañas, consumo de 6 meses, últimos movimientos |
| `Kardex.dc.html` | Filtros, color por tipo de movimiento, panel de detalle, las filas atenuadas del histórico de tubos y paños |
| `Movimiento.dc.html` | El diálogo de movimiento nuevo, paso a paso, con el reparto «liberado primero» y el error de stock insuficiente |
| `Telas.dc.html` | Catálogo de telas en metros, rollos equivalentes, y la nota de que este pasa a ser el único inventario de telas |
| `Colmena.dc.html` | Grilla del galpón, colores por familia, alerta de 90 días y el panel del paño con su dibujo a escala |
| `Tubos.dc.html` | Las 4 vistas de tubos, la ficha con su línea de tiempo y el aviso de que el optimizador no se toca |
| `Conteo.dc.html` | Conteo doble ciego: tarjeta del conteo activo, tabla de diferencias A/B y el cierre con firma |
| `Alertas.dc.html` | Alertas y reposición, con punto de reposición y objetivo editables en la misma tabla |
| `Compras.dc.html` | **Pendiente de aprobación de la jefatura.** Se dibuja para acordar el alcance; no se programa |
| `Reportes.dc.html` | Valorización, consumo, rotación y merma + la pantalla de Configuración |

## Celular (390 × 844)

| Archivo | Qué decide |
|---|---|
| `MovilInicio.dc.html` | Inicio y **menú inferior de 5 ítems** |
| `MovilDespacho.dc.html` | Despacho por OT en pantalla plena (mismo flujo y mismos QR que hoy) |
| `MovilContar.dc.html` | Contar en pantalla plena |
| `MovilVenta.dc.html` | Descontar metros de tela en terreno (rol ventas) |

## Piezas

`Componentes.dc.html` — estados vacío / cargando / error / sin permiso, KPI,
pestañas, botones, campos, badges de tipo de movimiento y de estado, chips de
almacén, barra de guardar, barra de progreso y la tabla densa. Incluye la
franja en **modo oscuro**.

## Cómo editarlas

Se generaron con la skill `design` de Claude Code, que arma el canvas a partir
de estos mismos archivos. Para cambiar una lámina se edita su `.dc.html` y se
vuelve a sembrar el canvas; el HTML es plano, sin dependencias.
