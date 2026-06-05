# Inventario de Telas (PRUEBA)

Módulo de gestión de inventario de rollos de tela para vendedores en
terreno y CyberDay. Persiste todo en Supabase (`inv_rollos`,
`inv_movimientos`, `inv_empresa_perfil`, `inv_permisos`) y guarda
logo/banner en el bucket `inv-empresa-assets`.

Punto de entrada: `Pagina.tsx`. Se carga lazy desde `App.tsx` en la
ruta `/inventario-telas-prueba`.

## Estructura

```
src/pages/inventario-telas-prueba/
├── Pagina.tsx                       Orquestador (compone hooks + tabs + modales)
├── README.md                        Este archivo
├── types.ts                         Tipos públicos del módulo
├── data/
│   └── initialInventory.ts          Seed legacy (no se usa en runtime)
│
├── hooks/                           Capa de datos y handlers (sin JSX)
│   ├── usePermisoInventario.ts      Gate de acceso (auth.users × inv_permisos)
│   ├── useInventarioData.ts         Queries: rollos + movimientos + refresh
│   ├── useInventarioMutations.ts    Escrituras: ajustar / editar / agregar / eliminar / reset / borrar log
│   ├── useImagenStorage.ts          Subir logo/banner al bucket
│   ├── usePerfilEmpresa.ts          Profile DB + guardarPerfil
│   ├── useNotification.ts           Banner inline de notificaciones
│   └── useInventarioHandlers.ts     Handlers async con try/catch + notificación
│
├── utils/                           Funciones puras (sin estado, testables)
│   ├── inventario-mappers.ts        RolloDB / MovimientoDB / PerfilDB → tipos UI
│   ├── stock-bar.ts                 calcMaxMeters + calcStockPercent
│   └── export-csv.ts                exportInventarioCSV
│
└── components/                      UI agrupada por dominio
    ├── InventoryStats.tsx           Cards de stats globales (tab Inventario)
    ├── HistoryLog.tsx               Lista de movimientos (tab Historial)
    ├── ModuleHeader.tsx             Header sticky con tabs y Salir
    ├── modals/                      Modales (cada uno self-contained)
    │   ├── AdjustStockModal.tsx     Sumar / Descontar metros
    │   ├── EditStockModal.tsx       Editar stock asignado (solo admin)
    │   └── AddProductModal.tsx      Agregar nuevo rollo al catálogo
    ├── product-table/               Tabla de productos
    │   ├── ProductTable.tsx         Orquesta filtros + filas
    │   ├── TableFilters.tsx         Search + chips + filtros verticales/stock
    │   ├── ProductRow.tsx           Una fila + botones de acción
    │   └── StockBar.tsx             Barra de progreso de stock
    └── company-profile/             Panel del tab Empresa
        ├── CompanyProfilePanel.tsx  Orquestador
        ├── BannerUploader.tsx       Banner + drag&drop
        ├── LogoUploader.tsx         Logo flotante + drag&drop
        ├── StaticProfileView.tsx    Vista no editable
        └── CompanyProfileForm.tsx   Formulario de edición
```

## Reglas del módulo

1. **Ningún archivo `.ts` / `.tsx` supera las 400 líneas** (excepto
   `data/initialInventory.ts` que es seed estático). Si un archivo
   crece, se subdivide en el mismo PR.
2. **Hooks separados de componentes**: la lógica de datos vive en
   `hooks/`, la presentación vive en `components/`.
3. **Funciones puras en `utils/`**: cualquier cálculo determinístico
   (mappers, formateo) va acá, no inline en componentes.
4. **Modales en `modals/`**: aislados de la tabla y del perfil, para
   que editarlos no toque otros archivos.
5. **Compatibilidad de API externa**: el resto de la app solo conoce
   `Pagina.tsx` (export default). Cualquier cambio interno mantiene
   esa puerta de entrada intacta.

## Stubs deprecated

Los siguientes archivos quedaron como re-exports de un solo `export
{ default } from './path/nuevo'` porque el filesystem actual no permite
borrar archivos:

- `useInventarioSupabase.ts`
- `components/AdjustStockModal.tsx`
- `components/EditStockModal.tsx`
- `components/AddProductModal.tsx`
- `components/CompanyProfilePanel.tsx`
- `components/ProductTable.tsx`

Borrar manualmente desde el filesystem cuando se haga limpieza.
