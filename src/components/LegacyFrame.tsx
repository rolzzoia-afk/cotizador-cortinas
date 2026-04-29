import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Props = {
  src: string;
  title?: string;
};

export function LegacyFrame({ src, title }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const { search } = useLocation();

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

  // Cache-busting del HTML legacy: append `?v=<BUILD_ID>` para invalidar el
  // cache del navegador en cada deploy. Sin esto, un operario con la pestaña
  // abierta días puede correr código pre-deploy y aplastar datos nuevos
  // (incidente 2026-04-29: sync stale borró 81 tubos del baseline).
  const buildId = import.meta.env.VITE_BUILD_ID ?? 'dev';
  const versioned = `${src}${src.includes('?') ? '&' : '?'}v=${buildId}`;
  const finalSrc = search ? `${versioned}&${search.slice(1)}` : versioned;

  return (
    <iframe
      ref={ref}
      src={finalSrc}
      title={title ?? 'Legacy'}
      className="h-[calc(100vh-4rem)] w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
      allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen"
    />
  );
}
