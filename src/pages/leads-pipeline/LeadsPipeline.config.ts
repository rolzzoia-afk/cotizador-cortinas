// Mapeo de tono visual (estados de lead) a clases CSS.

export const TONO_CLS: Record<string, string> = {
  neutral: 'border-border bg-secondary text-foreground',
  progress: 'border-accent/30 bg-accent/15 text-accent',
  warn: 'border-warning/30 bg-warning/15 text-warning',
  success: 'border-success/30 bg-success/15 text-success',
  danger: 'border-destructive/30 bg-destructive/15 text-destructive',
};
