// Con qué rol se está mirando la app.
//
// «Ver como» (?rol= en la URL) es una vista previa SOLO PARA ADMINS: cambia lo
// que se muestra, nunca lo que se puede hacer — el bloqueo real de rutas lo
// sigue haciendo ProtectedRoute con el rol del perfil. Antes cualquiera podía
// escribir ?rol=admin y ver el menú completo.
//
// Vivía dentro de TopBar. Se sacó acá cuando la barra lateral del inventario
// necesitó lo mismo: dos copias de esta lógica terminan diciendo cosas
// distintas.

import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';

export type RolEfectivo = {
  /** El rol del perfil, el que manda de verdad. */
  rolReal: string;
  /** Con el que se dibuja la pantalla (el de ?rol= si un admin lo pidió). */
  rolEfectivo: string;
  /** El rol simulado, o '' si no hay ninguno. */
  viendoComo: string;
  /** `?rol=x` para pegar a los enlaces, o '' — así no se pierde al navegar. */
  queryRol: string;
};

export function useRolEfectivo(): RolEfectivo {
  const { perfil } = useAuth();
  const [params] = useSearchParams();

  const rolReal = (perfil?.rol || '').toLowerCase().trim();
  const viendoComo = esRolAdmin(rolReal) ? (params.get('rol') || '').toLowerCase().trim() : '';

  return {
    rolReal,
    rolEfectivo: viendoComo || rolReal,
    viendoComo,
    queryRol: viendoComo ? `?rol=${viendoComo}` : '',
  };
}
