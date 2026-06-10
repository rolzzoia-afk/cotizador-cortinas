// ─────────────────────────────────────────────────────────────────────
// Marca del PRODUCTO (no de la empresa cliente).
//
// - APP_NAME: nombre del software, usado en pantallas pre-login
//   (Landing, Login, Registro, Setup). Se puede cambiar por instalación
//   con la variable de entorno VITE_APP_NAME, sin tocar código.
// - El nombre de la EMPRESA del usuario (tenant) se obtiene de
//   useAuth().empresaNombre y se usa en TopBar, PDFs, mensajes de
//   WhatsApp, etc.
// ─────────────────────────────────────────────────────────────────────
export const APP_NAME: string = import.meta.env.VITE_APP_NAME ?? 'Rolzzo';
