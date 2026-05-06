-- ============================================================================
-- Bump opt_version_minima a 5.3 (consolidación de pesos NO destructiva)
-- Fecha: 2026-05-06
-- ============================================================================

INSERT INTO configuracion (empresa_id, clave, valor)
VALUES ('67c635a5-152c-4780-a066-23f5081175a9'::uuid, 'opt_version_minima', '5.3')
ON CONFLICT (empresa_id, clave) DO UPDATE SET valor = EXCLUDED.valor;
