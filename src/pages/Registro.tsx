import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Rocket, Mail, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { APP_NAME } from '@/lib/marca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  empresa: z.string().trim(),
  nombre: z.string().trim().min(1, 'Ingresa tu nombre'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

type InfoInvitacion = {
  valida: boolean;
  motivo?: string;
  empresa_nombre?: string;
  rol?: string;
  email?: string | null;
};

function mapError(message: string): string {
  if (message.includes('already registered')) {
    return 'Ese email ya está registrado. ¿Quieres iniciar sesión?';
  }
  return message || 'Error al registrarse.';
}

export function Registro() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const codigoInvitacion = (params.get('invitacion') || '').trim();
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);
  const [invitacion, setInvitacion] = useState<InfoInvitacion | null>(null);
  const conInvitacion = !!codigoInvitacion && invitacion?.valida === true;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { empresa: '', nombre: '', email: '', password: '' },
  });

  // Cargar info de la invitación (nombre de la empresa, rol, email fijado)
  useEffect(() => {
    if (!codigoInvitacion) return;
    (async () => {
      const { data, error } = await supabase.rpc('info_invitacion' as never, {
        p_codigo: codigoInvitacion,
      } as never);
      if (error) {
        setInvitacion({ valida: false, motivo: 'No se pudo verificar la invitación.' });
        return;
      }
      const info = data as unknown as InfoInvitacion;
      setInvitacion(info);
      if (info?.valida && info.email) setValue('email', info.email);
    })();
  }, [codigoInvitacion, setValue]);

  const onSubmit = async (v: FormValues) => {
    try {
      if (!conInvitacion && v.empresa.length < 1) {
        setError('empresa', { message: 'Ingresa el nombre de la empresa' });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('No se pudo obtener el ID del usuario.');

      let tenantId: string | null = null;
      if (conInvitacion) {
        // Unirse a la empresa que invitó
        const { data: empresaId, error: rpcErr } = await supabase.rpc(
          'aceptar_invitacion' as never,
          {
            p_codigo: codigoInvitacion,
            p_user_id: userId,
            p_user_nombre: v.nombre,
            p_user_email: v.email,
          } as never,
        );
        if (rpcErr) throw new Error(rpcErr.message || 'Error aceptando la invitación.');
        tenantId = empresaId as unknown as string;
      } else {
        // Crear empresa nueva
        const { data: nuevoTenant, error: rpcErr } = await supabase.rpc('registrar_tenant', {
          p_nombre_empresa: v.empresa,
          p_user_id: userId,
          p_user_nombre: v.nombre,
          p_user_email: v.email,
        });
        if (rpcErr) throw new Error(rpcErr.message || 'Error creando la empresa.');
        tenantId = nuevoTenant as unknown as string;
      }

      if (tenantId) localStorage.setItem('rolzzo_tenant_id', tenantId);

      // Si "Confirm email" está OFF en Supabase, signUp devuelve sesión activa:
      // re-hidratar antes de navegar para que ProtectedRoute tenga el perfil.
      if (data.session) {
        await refresh();
        navigate(conInvitacion ? '/' : '/setup', { replace: true });
        return;
      }
      setEmailEnviado(v.email);
    } catch (e) {
      setError('root', { message: mapError((e as Error).message) });
    }
  };

  if (emailEnviado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Enviamos un enlace de activación a{' '}
              <strong className="text-foreground">{emailEnviado}</strong>. Haz clic en el enlace
              para activar tu cuenta y después inicia sesión.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {conInvitacion ? (
              <UserPlus className="h-6 w-6 text-primary" />
            ) : (
              <Rocket className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">
            {conInvitacion ? `Únete a ${invitacion?.empresa_nombre}` : `Crear cuenta en ${APP_NAME}`}
          </CardTitle>
          <CardDescription>
            {conInvitacion
              ? `Fuiste invitado/a como ${invitacion?.rol}. Crea tu cuenta para entrar.`
              : 'Registra tu empresa y empieza a usar el sistema'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {codigoInvitacion && invitacion && !invitacion.valida && (
            <Alert variant="destructive">
              <AlertDescription>
                {invitacion.motivo || 'Invitación inválida.'} Puedes registrar una empresa nueva
                con el formulario de abajo.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {!conInvitacion && (
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Nombre de la empresa</Label>
                <Input
                  id="empresa"
                  autoComplete="organization"
                  autoFocus
                  aria-invalid={!!errors.empresa}
                  {...register('empresa')}
                />
                {errors.empresa && (
                  <p className="text-xs text-destructive">{errors.empresa.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Tu nombre</Label>
              <Input
                id="nombre"
                autoComplete="name"
                autoFocus={conInvitacion}
                aria-invalid={!!errors.nombre}
                {...register('nombre')}
              />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                readOnly={conInvitacion && !!invitacion?.email}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? 'Creando cuenta…'
                : conInvitacion
                  ? `Unirme a ${invitacion?.empresa_nombre}`
                  : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
