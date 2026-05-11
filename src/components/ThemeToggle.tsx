import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: typeof Moon; label: string }> = [
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'dark', icon: Moon, label: 'Oscuro' },
    { value: 'system', icon: SunMoon, label: 'Auto (según sistema)' },
  ];

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-card p-1"
      role="group"
      aria-label="Cambiar tema"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full transition-all',
            theme === value
              ? 'bg-accent text-accent-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
      ))}
    </div>
  );
}
