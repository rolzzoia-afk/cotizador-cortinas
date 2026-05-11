-- ============================================================================
-- Bump opt_version_minima a 5.4 (consolidación de pesos con evento de origen)
-- Fecha: 2026-05-11
-- ============================================================================

INSERT INTO configuracion (empresa_id, clave, valor)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'opt_version_minima', '5.4')
ON CONFLICT (empresa_id, clave) DO UPDATE SET valor = EXCLUDED.valor;
