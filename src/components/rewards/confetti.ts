/**
 * Confetti for a completed card: bursts popping all over the screen on one
 * throwaway canvas, removed when the last piece has fallen. Skipped entirely
 * under reduced motion.
 */

const COLORS = ['#d9a93f', '#f2e8d2', '#c2321f', '#2f7a5f', '#8ee3c6', '#e7a0d6'];

type Piece = { x: number; y: number; vx: number; vy: number; r: number; spin: number; w: number; h: number; color: string; round: boolean };

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '100' });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = [];
  const burst = (x: number, y: number, n: number, power: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.35 + Math.random() * 0.65);
      pieces.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.35,
        r: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.25,
      });
    }
  };

  // Pops scattered across the screen, one after another, then a cannon from each bottom corner.
  const timers = Array.from({ length: 9 }, (_, i) =>
    setTimeout(() => burst(W * (0.1 + Math.random() * 0.8), H * (0.12 + Math.random() * 0.55), 70, 13), i * 160));
  timers.push(setTimeout(() => {
    for (const side of [0, 1]) {
      for (let i = 0; i < 90; i++) {
        const a = -Math.PI / 2 + (side ? -1 : 1) * (0.25 + Math.random() * 0.45);
        const v = 16 + Math.random() * 12;
        pieces.push({
          x: side * W, y: H, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          r: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.4,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 8,
          color: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.25,
        });
      }
    }
  }, 500));

  const start = performance.now();
  const frame = (now: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx + Math.sin((now + p.r * 900) / 260) * 0.6;
      p.y += p.vy;
      p.r += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.r * 2)); // The flutter: pieces turn edge-on as they spin.
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    const alive = pieces.some((p) => p.y < H + 20);
    if (now - start < 1800 || alive) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  return () => { timers.forEach(clearTimeout); canvas.remove(); };
}
