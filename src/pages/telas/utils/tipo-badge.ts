// Clases CSS del badge de tipo de tela (BK/DU/SC/otros).

export function tipoBadgeCls(tipo: string | null): string {
  switch (tipo) {
    case 'BK':
      return 'bg-accent/20 text-accent border-accent/30';
    case 'DU':
      return 'bg-accent/20 text-accent border-purple-500/30';
    case 'SC':
      return 'bg-accent/20 text-blue-300 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
