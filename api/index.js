// ══════════════════════════════════════════════════════════════════════
//  API Backend — Rolzzo · Sistema de Gestión Interna
//  Hono + Vercel Serverless Functions
//
//  Rutas públicas:  /api/health, /api/tenants/registro
//  Rutas protegidas: /api/kpi, /api/tenants/me, /api/billing/*
// ══════════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import supabaseAdmin from './lib/supabase.js';
import { auth } from './lib/auth.js';

const app = new Hono().basePath('/api');


// ── Middleware global ────────────────────────────────────────────────
app.use('*', cors({
    origin: [
        'https://rolzzoia-afk.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'  // Live Server de VS Code
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));


// ═══════════════════════════════════════════════════════════════════
//  RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', (c) => {
    return c.json({
        ok: true,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ── Registro de tenant ───────────────────────────────────────────────
// Crea usuario + empresa + perfil admin en una transacción
app.post('/tenants/registro', async (c) => {
    try {
        const { nombre_empresa, nombre, email, password } = await c.req.json();

        if (!nombre_empresa || !nombre || !email || !password) {
            return c.json({ error: 'Todos los campos son obligatorios' }, 400);
        }
        if (password.length < 6) {
            return c.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
        }

        // 1. Crear usuario en Supabase Auth
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false  // requiere verificación por email
        });
        if (authErr) throw authErr;

        const userId = authData.user.id;

        // 2. Crear tenant + perfil via RPC
        const { data: tenantId, error: rpcErr } = await supabaseAdmin.rpc('registrar_tenant', {
            p_nombre_empresa: nombre_empresa,
            p_user_id: userId,
            p_user_nombre: nombre,
            p_user_email: email
        });
        if (rpcErr) throw rpcErr;

        return c.json({
            ok: true,
            tenant_id: tenantId,
            mensaje: 'Cuenta creada. Revisá tu email para activarla.'
        }, 201);

    } catch (e) {
        const msg = e.message || 'Error interno';
        const status = msg.includes('already') ? 409 : 500;
        return c.json({ error: msg }, status);
    }
});


// ═══════════════════════════════════════════════════════════════════
//  RUTAS PROTEGIDAS (requieren JWT válido)
// ═══════════════════════════════════════════════════════════════════

// ── Helper: timeout wrapper para promesas ────────────────────────────
// Evita que un call colgado del SDK consuma los 300s de la función Vercel.
// Si la promesa no resuelve en `ms`, lanza un error explícito que sí va a
// los Vercel Logs y permite diagnosticar dónde se está colgando.
const withTimeout = (promesa, ms, label) => Promise.race([
    promesa,
    new Promise((_, reject) =>
        setTimeout(
            () => reject(new Error(`Timeout (${ms}ms) en ${label} — posible problema de SDK/red Vercel↔Supabase`)),
            ms,
        ),
    ),
]);


// ── Diagnóstico admin client (admin-only, GET) ───────────────────────
// Endpoint mínimo para verificar si el cliente admin de Supabase responde
// desde el runtime serverless. Si esto se cuelga también, el problema es
// del cliente entero; si responde, el problema es específico de createUser.
app.get('/usuarios/debug-admin', auth, async (c) => {
    const perfil = c.get('perfil');
    if ((perfil?.rol || '').toLowerCase() !== 'admin') {
        return c.json({ error: 'Solo admin' }, 403);
    }
    const start = Date.now();
    try {
        const result = await withTimeout(
            supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
            5000,
            'auth.admin.listUsers',
        );
        return c.json({
            ok: true,
            ms: Date.now() - start,
            user_count: result?.data?.users?.length ?? null,
            error: result?.error?.message ?? null,
        });
    } catch (e) {
        return c.json({
            ok: false,
            ms: Date.now() - start,
            error: e.message || 'Error desconocido',
        }, 500);
    }
});


// ── Invitar vendedora (admin-only) ───────────────────────────────────
// Crea un nuevo usuario en auth + perfil con rol='ventas' atado a la
// empresa del admin que llama. Devuelve la contraseña temporal una sola
// vez para que el admin la comparta con la vendedora.
app.post('/usuarios/invitar', auth, async (c) => {
    const t0 = Date.now();
    const log = (...args) => console.log('[invitar]', `${Date.now() - t0}ms`, ...args);
    try {
        log('inicio');
        const perfil = c.get('perfil');
        const empresaId = c.get('empresaId');

        if ((perfil?.rol || '').toLowerCase() !== 'admin') {
            return c.json({ error: 'Solo los administradores pueden invitar vendedoras' }, 403);
        }
        log('rol verificado:', perfil.rol);

        const { email, nombre } = await c.req.json();
        log('body parseado:', { email, nombre: !!nombre });

        const emailLimpio = (email || '').trim().toLowerCase();
        const nombreLimpio = (nombre || '').trim();

        if (!emailLimpio || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
            return c.json({ error: 'Email inválido' }, 400);
        }
        if (!nombreLimpio) {
            return c.json({ error: 'El nombre es obligatorio' }, 400);
        }

        // Generar contraseña temporal (12 chars alfanuméricos)
        const generarPassword = () => {
            const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            let pass = '';
            for (let i = 0; i < 12; i++) {
                pass += alfabeto[Math.floor(Math.random() * alfabeto.length)];
            }
            return pass;
        };
        const passwordTemporal = generarPassword();

        // 1. Crear usuario en auth (auto-confirmado: el admin invita)
        log('llamando supabaseAdmin.auth.admin.createUser...');
        const createResult = await withTimeout(
            supabaseAdmin.auth.admin.createUser({
                email: emailLimpio,
                password: passwordTemporal,
                email_confirm: true,
            }),
            10000,
            'auth.admin.createUser',
        );
        log('createUser respondió');
        const { data: authData, error: authErr } = createResult;

        if (authErr) {
            log('createUser falló:', authErr.message);
            const status = (authErr.message || '').toLowerCase().includes('already') ? 409 : 500;
            return c.json({ error: authErr.message || 'No se pudo crear el usuario' }, status);
        }

        const userId = authData.user.id;
        log('userId creado:', userId);

        // 2. Crear perfil con rol='ventas'
        log('insertando en perfiles...');
        const insertResult = await withTimeout(
            supabaseAdmin
                .from('perfiles')
                .insert({
                    id: userId,
                    empresa_id: empresaId,
                    nombre: nombreLimpio,
                    rol: 'ventas',
                }),
            10000,
            'perfiles.insert',
        );
        log('perfiles.insert respondió');
        const { error: perfilErr } = insertResult;

        if (perfilErr) {
            log('perfil falló, rollback:', perfilErr.message);
            await withTimeout(
                supabaseAdmin.auth.admin.deleteUser(userId),
                10000,
                'auth.admin.deleteUser (rollback)',
            ).catch((eDel) => log('rollback falló también:', eDel.message));
            return c.json({ error: perfilErr.message || 'No se pudo crear el perfil' }, 500);
        }

        log('OK, devolviendo response');
        return c.json({
            ok: true,
            perfil_id: userId,
            email: emailLimpio,
            nombre: nombreLimpio,
            password_temporal: passwordTemporal,
        }, 201);

    } catch (e) {
        log('catch global:', e.message);
        return c.json({ error: e.message || 'Error interno' }, 500);
    }
});


// ── Datos del tenant actual ──────────────────────────────────────────
app.get('/tenants/me', auth, async (c) => {
    const empresaId = c.get('empresaId');

    const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id, nombre, slug, plan, estado, fecha_creacion')
        .eq('id', empresaId)
        .maybeSingle();

    return c.json({ tenant, perfil: c.get('perfil') });
});

// ── KPI — datos de ventas ────────────────────────────────────────────
app.get('/kpi', auth, async (c) => {
    const empresaId = c.get('empresaId');
    const fecha = c.req.query('fecha') || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
        .from('kpi_registros')
        .select('clave, valor')
        .eq('empresa_id', empresaId)
        .eq('fecha', fecha);

    if (error) return c.json({ error: error.message }, 500);

    // Convertir a objeto { clave: valor }
    const kpi = {};
    (data || []).forEach(r => { kpi[r.clave] = r.valor; });

    return c.json({ fecha, kpi });
});

// ── Billing — placeholder ────────────────────────────────────────────
app.post('/billing/checkout', auth, async (c) => {
    const empresaId = c.get('empresaId');
    const { plan } = await c.req.json();

    // TODO: integrar con Stripe/MercadoPago
    return c.json({
        ok: true,
        mensaje: `Checkout para plan "${plan}" — integración pendiente`,
        empresa_id: empresaId
    });
});

// ── Exportar OTs a Excel — placeholder ───────────────────────────────
app.get('/exportar/ots', auth, async (c) => {
    const empresaId = c.get('empresaId');

    const { data, error } = await supabaseAdmin
        .from('ots')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) return c.json({ error: error.message }, 500);

    // Por ahora devolver JSON, luego generaremos Excel
    return c.json({ total: data?.length || 0, ots: data });
});


// ── 404 catch-all ────────────────────────────────────────────────────
app.all('*', (c) => {
    return c.json({ error: 'Ruta no encontrada' }, 404);
});


export default handle(app);
