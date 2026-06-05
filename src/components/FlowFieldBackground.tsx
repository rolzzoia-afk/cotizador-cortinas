// Flow-field particle background — versión calibrada para Landing.
//
// Decisiones de craft (post-emil + impeccable + DA):
// - Respeta prefers-reduced-motion (a11y) — si está activado, no anima
// - Pausa cuando document.hidden (no quema CPU en background tab)
// - Defaults muy mudos: 150 partículas (vs 600), velocidad 0.4 (vs 1),
//   color slate muy oscuro, trailOpacity alta (trails cortos = menos memoria visual)
// - Sin interactividad con mouse (no aporta y agrega event listeners)
// - 1px particles (vs 1.5) — menos pintura por frame
//
// Costo aprox a 60fps con defaults: ~54k ops/seg (vs 216k del original).
// En CPU básico de office se nota como una textura sutil, no como motion.

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface FlowFieldBackgroundProps {
  className?: string;
  color?: string;
  trailOpacity?: number;
  particleCount?: number;
  speed?: number;
}

export default function FlowFieldBackground({
  className,
  color = 'rgb(100, 116, 139)', // slate-500 — neutral, no compite con accent
  trailOpacity = 0.18,
  particleCount = 150,
  speed = 0.4,
}: FlowFieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect reduced-motion: no animation
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    let particles: Particle[] = [];
    let animationFrameId: number;
    let isPaused = false;

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      age: number;
      life: number;
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.age = 0;
        this.life = Math.random() * 200 + 100;
      }
      update() {
        const angle =
          (Math.cos(this.x * 0.005) + Math.sin(this.y * 0.005)) * Math.PI;
        this.vx += Math.cos(angle) * 0.2 * speed;
        this.vy += Math.sin(angle) * 0.2 * speed;
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.age++;
        if (this.age > this.life) this.reset();
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0;
        this.vy = 0;
        this.age = 0;
        this.life = Math.random() * 200 + 100;
      }
      draw(c: CanvasRenderingContext2D) {
        c.fillStyle = color;
        const alpha = 1 - Math.abs(this.age / this.life - 0.5) * 2;
        c.globalAlpha = alpha * 0.7; // un poco más mudo
        c.fillRect(this.x, this.y, 1, 1);
      }
    }

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    };

    const animate = () => {
      if (isPaused) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      // Fade overlay (creates trails) — usa el bg del tema (background CSS var)
      // Para mantenerlo en el dark scheme, usamos rgba black
      ctx.fillStyle = `rgba(8, 8, 12, ${trailOpacity})`;
      ctx.fillRect(0, 0, width, height);
      for (const p of particles) {
        p.update();
        p.draw(ctx);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      init();
    };

    const handleVisibility = () => {
      isPaused = document.hidden;
    };

    init();
    animate();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, trailOpacity, particleCount, speed]);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
