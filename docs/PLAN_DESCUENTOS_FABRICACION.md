# Plan: descuentos de fabricación, de la cotización al taller

Fuente: `DESCUENTOS ROLLER CATALOGO.xlsx` (analizado 2026-06-12).

## 1. Qué contiene el Excel

Es la **tabla maestra de despiece**: cómo pasar de la medida nominal vendida (ej. ancho 200 cm) a las medidas reales de corte de cada componente, según el modelo y mecanismo.

| Hoja | Qué es | Estado |
|---|---|---|
| DESCUENTOS ROLLER | Tabla maestra, 59 modelos en 10 sistemas (ROLLER_SIMPLE, ROLLER_DUAL, CENEFA_OVALADA, CENEFA_OVALADA_DUO, PLETINA_ROLLER, PLETINA_DUO, SOFT_LIGHT, SOFT_LIGHT_CENEFA_CUAD, DARK_ROLLER, OSCURANTI). Por fila: mecanismo, códigos de tubo aplicables (E01; E02…), diámetro, descuentos de tubo/tela/peso/cenefas/perfiles, ancho máximo, activo | Máquina-legible, lista para importar |
| DESCUENTOS CENEFA ROLLER Y DUO | Variante de cenefas con campos extra para DÚO (peso_interno, peso_u) | Solapa con la hoja 1; tiene filas incompletas |
| SISTEMAS OSCURIDAD | Hojas de CÁLCULO con ejemplos (200×200) para Soft Light interno/semi/externo: perfiles laterales/inferior con interruptores ON/OFF según instalación (a muro / a piso) que SUMAN cm | Reglas que la tabla maestra NO captura |
| BEEBLACK | Hoja de cálculo: holguras, perfiles, manillas y **lamas** (división del alto en lamas) | Sistema completo ausente de la tabla maestra |
| README | Instrucciones de uso pensadas para integración con el software | Excelente base |

La fórmula central: `corte_componente = medida_nominal − dcto_componente (± sumas por perfiles/instalación)`.
Ej.: ancho 200, ROLLER_SIMPLE MEC_05 → tubo 196.2, tela 199.5, peso 196.1.

## 2. Hallazgos a resolver ANTES de integrar (decisiones del dueño)

1. **Inconsistencia entre hojas**: CENEFA_OVALADA `MOTOR_GRD` blanco 45 mm tiene dcto_tubo **3.1** en la hoja 1 y **2.9** en la hoja de cenefas. ¿Cuál vale?
2. **Filas incompletas** en la hoja de cenefas (sin `activo` ni `ancho_max`): DUO gris 38, DUO manual/motor 45 con MEC_18/MEC_23.
3. **Valor sospechoso**: SOFT_LIGHT_SEMI_38mm tiene `dcto_tela = 5` cm (el resto usa 0.2-1). ¿Es real o dedo?
4. **Reglas de oscuridad**: los ON/OFF de perfiles (izquierdo/derecho/inferior, a muro/a piso) dependen de la INSTALACIÓN de cada ventana, no del modelo → deben capturarse como preguntas en la OT, no como columna fija.
5. **BEEBLACK**: ¿entra en esta etapa o después? Tiene lógica propia (lamas, manillas).
6. **Dónde se aplican hoy**: confirmar si el Cotizador del Jefe ya calcula estos descuentos o se hacen a mano con esta planilla (los +3 mm de la OT 3031 sugieren que hay un paso manual).

## 3. Plan de integración (cotización → taller)

**Fase A — Tabla en la app (1 sesión).**
Tabla `descuentos_modelo` por empresa (multi-tenant) + importador en Admin que lee ESTE MISMO Excel (la jefa sigue editando su planilla y la sube, igual que el inventario base): validación, vista previa de cambios y versionado. La hoja de cenefas se fusiona en la maestra para eliminar el doble mantenimiento.

**Fase B — Cotizador (1 sesión).**
Al cotizar se elige sistema/modelo/mecanismo (solo los `activo=TRUE`); el cotizador **valida ancho_max al instante** (hoy se puede vender algo infabricable) y guarda el modelo elegido en la cotización/OT.

**Fase C — Despiece automático en la OT (1-2 sesiones).**
Motor de despiece: con medida nominal + modelo (+ respuestas de instalación para sistemas de oscuridad: perfil izquierdo/derecho/inferior, a muro o piso) calcula TODAS las medidas de corte (tubo, tela, peso, cenefas, perfiles). Se muestra como "Despiece" en la OT y alimenta directamente al optimizador — **desaparece el paso manual** que generó los +3 mm.

**Fase D — Verificación cruzada en el taller (media sesión).**
El Historial de Corte compara cada medida del plan contra el despiece teórico de la OT: si difieren, marca la línea. Una reconstrucción manual con error ya no pasaría inadvertida.

**Fase E — Pruebas doradas (media sesión).**
Los ejemplos 200×200 de las hojas SISTEMAS OSCURIDAD y BEEBLACK se convierten en tests automáticos del motor de despiece: si un cambio rompe una regla, el CI lo detiene.

## 4. Orden propuesto

A → B → C son el corazón (el flujo queda continuo de venta a corte). D y E blindan. BEEBLACK al final como sistema adicional sobre el mismo motor.
