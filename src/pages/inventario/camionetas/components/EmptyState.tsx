// Placeholder genérico para cuando no hay datos.

import type { ReactNode } from 'react';

interface EmptyStateProps {
  children: ReactNode;
}

export default function EmptyState({ children }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
