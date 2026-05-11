import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: typeof Sun; label: string }> = [
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'dark', icon: Moon, label: 'Oscuro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ];

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-card p-0.5"
      role="group"
      aria-label="Cambiar tema"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            theme === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
