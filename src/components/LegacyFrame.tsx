import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  src: string;
  title?: string;
};

export function LegacyFrame({ src, title }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.source !== ref.current?.contentWindow) return;
      const data = ev.data as { navigate?: string } | undefined;
      if (data && typeof data.navigate === 'string') {
        navigate(data.navigate);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title ?? 'Legacy'}
      className="h-[calc(100vh-4rem)] w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
    />
  );
}
