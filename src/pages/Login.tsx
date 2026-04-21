import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

type FormValues = z.infer<typeof schema>;

function mapError(message: string): string {
  if (message === 'Invalid login credentials') return 'Email o contraseña incorrectos.';
  return message || 'Error al iniciar sesión.';
}

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useAuth();

  const returnTo = params.get('returnTo') || '/';
  const expired = params.get('expired') === '1';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Ya logueado → ir al destino
  useEffect(() => {
    if (!loading && session) {
      navigate(decodeURIComponent(returnTo), { replace: true });
    }
  }, [loading, session, navigate, returnTo]);

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (error) {
      setError('root', { message: mapError(error.message) });
      return;
    }
    // AuthProvider se encarga de hidratar perfil + empresa_id y gatillar
    // la redirección en el useEffect de arriba cuando `session` cambie.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Cortinas Rolzzo</CardTitle>
          <CardDescription>Ingresá con tu cuenta para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {expired && (
            <Alert variant="warning">
              <AlertDescription>
                Tu sesión expiró. Ingresá de nuevo para continuar.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="email@ejemplo.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{' '}
            <Link to="/registro" className="font-medium text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
