// ══════════════════════════════════════════════════════════════════════
//  AUTH GUARD — Rolzzo · Sistema de Gestión Interna
//  Incluir DESPUÉS de supabase CDN + config.js en cada página protegida.
//
//  Responsabilidades:
//  1. Verificar sesión activa → si no hay, redirigir a login.html
//  2. Resolver EMPRESA_ID dinámicamente desde el perfil del usuario
//     (ya NO viene hardcodeado en config.js)
//  3. Exponer window._authReady (Promise) para que las páginas puedan
//     esperar a que la autenticación termine antes de inicializar.
// ══════════════════════════════════════════════════════════════════════

// ── Paso sincrónico: leer tenant_id de localStorage (disponible inmediatamente) ──
// Esto permite que scripts que se cargan después accedan a EMPRESA_ID
// sin esperar el fetch asíncrono (funciona desde la segunda carga en adelante).
window.EMPRESA_ID = localStorage.getItem('rolzzo_tenant_id') || null;

// ── Promise global: las páginas pueden hacer `await window._authReady` ──
// Se resuelve cuando la sesión y el tenant fueron verificados.
var _authResolve;
window._authReady = new Promise(function (resolve) { _authResolve = resolve; });

// ── Short-circuit cuando el HTML corre dentro del shell React (iframe) ──
// El shell ya validó sesión + empresa + onboarding antes de montar el iframe,
// así que acá evitamos: (1) crear un tercer cliente Supabase que compite por
// el Web Lock con el cliente de React y con `sbOpt` del propio optimizador
// —contención que hace que `getSession()` se trabe y la página quede en
// blanco—, y (2) el flash de `visibility:hidden` → `''`. Tomamos el tenant
// que ya dejó el padre en localStorage y resolvemos inmediatamente.
if (window.top !== window.self) {
    if (window.EMPRESA_ID) {
        _authResolve({ user: null, perfil: null, empresa_id: window.EMPRESA_ID });
    } else {
        // Sin tenant en localStorage: el padre no alcanzó a setearlo. Pedirle
        // que nos mande a /login en vez de intentar resolver acá.
        try { window.parent.postMessage({ navigate: '/login' }, '*'); } catch (e) {}
    }
} else {
  (async function () {
    // Ocultar página hasta confirmar sesión (evita flash de contenido)
    document.documentElement.style.visibility = 'hidden';

    try {
        var _guardSb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        var result = await _guardSb.auth.getSession();
        var session = result.data.session;

        if (!session) {
            _redirigirALogin();
            return;
        }

        // ── Obtener perfil: empresa_id + nombre + rol ──
        var perfilResult = await _guardSb.from('perfiles')
            .select('empresa_id, nombre, rol')
            .eq('id', session.user.id)
            .maybeSingle();

        var perfil = perfilResult.data;

        if (perfil && perfil.empresa_id) {
            window.EMPRESA_ID = perfil.empresa_id;
            localStorage.setItem('rolzzo_tenant_id', perfil.empresa_id);
        }

        if (!window.EMPRESA_ID) {
            alert('Tu cuenta no tiene una empresa asignada. Contactá al administrador.');
            await _guardSb.auth.signOut();
            _redirigirALogin();
            return;
        }

        // ── Verificar onboarding (solo si no estamos ya en setup.html) ──
        var currentPage = window.location.pathname.split('/').pop() || '';
        if (currentPage !== 'setup.html') {
            var onbResult = await _guardSb.from('configuracion')
                .select('valor')
                .eq('empresa_id', window.EMPRESA_ID)
                .eq('clave', 'onboarding_completado')
                .maybeSingle();
            if (!onbResult.data || onbResult.data.valor !== 'true') {
                window.location.replace('setup.html');
                return;
            }
        }

        // ── Sesión y tenant válidos — exponer datos y mostrar página ──
        window._authUser = session.user;
        window._authPerfil = perfil || null;
        document.documentElement.style.visibility = '';
        _authResolve({
            user:       session.user,
            perfil:     perfil,
            empresa_id: window.EMPRESA_ID
        });

    } catch (e) {
        console.error('[auth-guard] Error verificando sesión:', e);
        _redirigirALogin();
    }

    function _redirigirALogin() {
        // Si estamos dentro del shell React (iframe), pedirle al padre que navegue
        if (window.top !== window.self) {
            try { window.parent.postMessage({ navigate: '/login' }, '*'); } catch (e) {}
            return;
        }
        // Acceso directo a /legacy/*.html — ir al shell React
        window.location.replace('/login');
    }
  })();
}
