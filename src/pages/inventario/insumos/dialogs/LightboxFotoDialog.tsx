// Lightbox de foto a tamaño completo.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LightboxFotoDialogProps {
  foto: { url: string; cod: string } | null;
  onClose: () => void;
}

export default function LightboxFotoDialog({ foto, onClose }: LightboxFotoDialogProps) {
  return (
    <Dialog open={!!foto} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-3xl bg-card p-4">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-muted-foreground">
            {foto?.cod}
          </DialogTitle>
        </DialogHeader>
        {foto && (
          <img
            src={foto.url}
            alt={foto.cod}
            className="mx-auto max-h-[75vh] w-auto rounded-md object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
