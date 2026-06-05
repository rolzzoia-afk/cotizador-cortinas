// Hook chico de notificaciones inline (banner verde / azul / rojo
// arriba del contenido). El banner aparece por 4.5 segundos y se va
// solo. Si llega otra notificación antes, reemplaza la anterior.

import { useCallback, useState } from 'react';

export type NotificationType = 'success' | 'info' | 'error';

export type Notification = {
  message: string;
  type: NotificationType;
};

export type UseNotification = {
  notification: Notification | null;
  triggerNotification: (message: string, type?: NotificationType) => void;
};

export function useNotification(): UseNotification {
  const [notification, setNotification] = useState<Notification | null>(null);

  const triggerNotification = useCallback<UseNotification['triggerNotification']>(
    (message, type = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4500);
    },
    [],
  );

  return { notification, triggerNotification };
}
