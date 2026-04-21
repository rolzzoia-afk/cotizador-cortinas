import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Rocket, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  empresa: z.string().trim().min(1, 'Ingresá el nombre de la empresa'),
  nombre: z.string().trim().min(1, 'Ingresá tu nombre'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

function mapError(message: string): string {
  if (message.includes('already registered')) {
    return 'Ese email ya está registrado. ¿Querés iniciar sesión?';
  }
  return message || 'Error al registrarse.';
}

export function Registro() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { empresa: '', nombre: '', email: '', password: '' },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('No se pudo obtener el ID del usuario.');

      const { data: tenantId, error: rpcErr } = await supabase.rpc('registrar_tenant', {
        p_nombre_empresa: v.empresa,
        p_user_id: userId,
        p_user_nombre: v.nombre,
        p_user_email: v.email,
      });
      if (rpcErr) throw new Error(rpcErr.message || 'Error creando la empresa.');

      if (tenantId) localStorage.setItem('rolzzo_tenant_id', tenantId as string);

      // Si "Confirm email" está OFF en Supabase, signUp devuelve sesión activa:
      // el AuthProvider ya cargó el perfil (vacío) antes de que corriera el RPC,
      // así que hay que re-hidratar antes de navegar — sino ProtectedRoute dispara
      // "Tu cuenta no tiene una empresa asignada".
      if (data.session) {
        await refresh();
        navigate('/setup', { replace: true });
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
            <CardTitle className="text-xl">Revisá tu email</CardTitle>
            <CardDescription>
              Te enviamos un link de activación a{' '}
              <strong className="text-foreground">{emailEnviado}</strong>. Hacé click en el link
              para activar tu cuenta y después ingresá desde el login.
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
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Crear cuenta en Rolzzo</CardTitle>
          <CardDescription>Registrá tu empresa y empezá a usar el sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Tu nombre</Label>
              <Input
                id="nombre"
                autoComplete="name"
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
              {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
