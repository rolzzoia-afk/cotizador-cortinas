// ══════════════════════════════════════════════════════════════════════
//  Middleware de autenticación — verifica JWT de Supabase
//  Extrae user, perfil y empresaId del token.
// ══════════════════════════════════════════════════════════════════════

import supabaseAdmin from './supabase.js';

// Timeout wrapper: si el SDK de Supabase se cuelga (incidente 2026-04-30
// con `auth.admin.createUser` sin respuesta), el middleware no puede
// quedarse esperando 300s — bloquearía cualquier diagnóstico río abajo
// porque las rutas nunca empezarían a ejecutarse.
const withTimeout = (promesa, ms, label) => Promise.race([
    promesa,
    new Promise((_, reject) =>
        setTimeout(
            () => reject(new Error(`Timeout (${ms}ms) en middleware/${label}`)),
            ms,
        ),
    ),
]);

export async function auth(c, next) {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return c.json({ error: 'No autorizado — falta token' }, 401);
    }

    // Verificar token con Supabase
    let user;
    try {
        const result = await withTimeout(
            supabaseAdmin.auth.getUser(token),
            8000,
            'auth.getUser',
        );
        if (result.error || !result.data?.user) {
            return c.json({ error: 'Token inválido o expirado' }, 401);
        }
        user = result.data.user;
    } catch (e) {
        console.error('[auth-middleware] getUser falló:', e.message);
        return c.json({ error: e.message || 'Error verificando sesión' }, 503);
    }

    // Obtener perfil y tenant
    let perfil;
    try {
        const result = await withTimeout(
            supabaseAdmin
                .from('perfiles')
                .select('empresa_id, nombre, rol')
                .eq('id', user.id)
                .maybeSingle(),
            8000,
            'perfiles.select',
        );
        perfil = result.data;
    } catch (e) {
        console.error('[auth-middleware] perfiles.select falló:', e.message);
        return c.json({ error: e.message || 'Error consultando perfil' }, 503);
    }

    if (!perfil?.empresa_id) {
        return c.json({ error: 'Sin empresa asignada' }, 403);
    }

    // Exponer en el contexto de Hono
    c.set('user', user);
    c.set('perfil', perfil);
    c.set('empresaId', perfil.empresa_id);

    await next();
}
