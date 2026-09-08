// Título de sección compartido.

import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
}

export default function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div className="mb-2 pt-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}
