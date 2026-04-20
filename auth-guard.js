// ══════════════════════════════════════════════════════════════════════
//  AUTH GUARD — Rolzzo · Sistema de Gestión Interna
//  Incluir DESPUÉS de supabase CDN + config.js en cada página protegida.
//  Si no hay sesión activa → redirige a login.html
// ══════════════════════════════════════════════════════════════════════

(async function () {
    // Ocultar página hasta confirmar sesión (evita flash de contenido)
    document.documentElement.style.visibility = 'hidden';

    try {
        const _guardSb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { session }, error } = await _guardSb.auth.getSession();

        if (error || !session) {
            _redirigirALogin();
            return;
        }

        // Sesión válida — exponer usuario y mostrar página
        window._authUser = session.user;
        document.documentElement.style.visibility = '';

    } catch (e) {
        console.error('[auth-guard] Error verificando sesión:', e);
        _redirigirALogin();
    }

    function _redirigirALogin() {
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        var target = 'login.html?returnTo=' + encodeURIComponent(currentPage);

        // Si estamos en un iframe (optimizador), redirigir la ventana principal
        if (window.top !== window.self) {
            window.top.location.replace(target);
        } else {
            window.location.replace(target);
        }
    }
})();
