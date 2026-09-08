// Bloque de sección dentro de FichaCard (cabecera con ícono + contenido).

import type { ReactNode } from 'react';

interface FichaSeccionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export default function FichaSeccion({ title, icon, children }: FichaSeccionProps) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="ml-5 text-sm">{children}</div>
    </div>
  );
}
