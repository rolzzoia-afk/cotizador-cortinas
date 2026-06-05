// ─────────────────────────────────────────────────────────────────────
// ⚠️ DEPRECATED — junio 2026
//
// Este archivo era el hook monolítico de inventario. Fue dividido en:
//   - hooks/usePermisoInventario.ts
//   - hooks/useInventarioData.ts
//   - hooks/useInventarioMutations.ts
//   - hooks/useImagenStorage.ts
//   - hooks/usePerfilEmpresa.ts
//
// Se mantiene como re-export para no romper imports existentes en caso
// de que alguien externo al módulo importara de acá (verificado a junio
// 2026: nadie lo hace).
//
// Borrar este archivo cuando se haga la próxima limpieza manual.
// ─────────────────────────────────────────────────────────────────────

export { usePermisoInventario, type PermisoInfo } from './hooks/usePermisoInventario';
export { useInventarioData } from './hooks/useInventarioData';
export { useInventarioMutations } from './hooks/useInventarioMutations';
export { useImagenStorage } from './hooks/useImagenStorage';
export { usePerfilEmpresa } from './hooks/usePerfilEmpresa';
