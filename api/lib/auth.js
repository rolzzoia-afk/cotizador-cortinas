// ══════════════════════════════════════════════════════════════════════
//  Middleware de autenticación — verifica JWT de Supabase
//  Extrae user, perfil y empresaId del token.
// ══════════════════════════════════════════════════════════════════════

import supabaseAdmin from './supabase.js';

export async function auth(c, next) {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return c.json({ error: 'No autorizado — falta token' }, 401);
    }

    // Verificar token con Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return c.json({ error: 'Token inválido o expirado' }, 401);
    }

    // Obtener perfil y tenant
    const { data: perfil } = await supabaseAdmin
        .from('perfiles')
        .select('empresa_id, nombre, rol')
        .eq('id', user.id)
        .maybeSingle();

    if (!perfil?.empresa_id) {
        return c.json({ error: 'Sin empresa asignada' }, 403);
    }

    // Exponer en el contexto de Hono
    c.set('user', user);
    c.set('perfil', perfil);
    c.set('empresaId', perfil.empresa_id);

    await next();
}
