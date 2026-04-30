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
