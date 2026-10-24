// Card artwork. Each motif paints onto a 100 × 150 unit canvas (background already filled)
// and returns the rectangle the text should occupy. Motifs are drawn procedurally so every
// design is original, renders identically on screen and in high-resolution exports, and
// never depends on an external image host.
import {
  TAU, mix, rgba, circle, ring, ellipse, leaf, line, curve, along, sprig, laurel, star,
  sparkle, heartPath, petalFlower, rose, confetti, frame, cloud,
} from "./paint.js";

const MOTIFS = {
  sunrise(ctx, p, rnd) {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI + (i / 17) * Math.PI;
      line(ctx, 50 + Math.cos(a) * 24, 50 + Math.sin(a) * 24, 50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38, 0.7, rgba(p.accent2, 0.55));
    }
    circle(ctx, 50, 50, 19, p.accent2);
    circle(ctx, 50, 50, 14, mix(p.accent2, "#ffffff", 0.25));
    ctx.fillStyle = p.soft;
    ctx.beginPath();
    ctx.moveTo(0, 54); ctx.bezierCurveTo(25, 44, 45, 50, 62, 52); ctx.bezierCurveTo(78, 54, 90, 47, 100, 49);
    ctx.lineTo(100, 66); ctx.lineTo(0, 66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(p.accent, 0.85);
    ctx.beginPath();
    ctx.moveTo(0, 60); ctx.bezierCurveTo(30, 52, 55, 62, 100, 56); ctx.lineTo(100, 66); ctx.lineTo(0, 66); ctx.closePath(); ctx.fill();
    for (const [x, y, s] of [[22, 30, 2.4], [28, 26, 1.8], [76, 22, 2]]) {
      curve(ctx, [x - s, y - s * 0.6, x, y, x + s, y - s * 0.6], 0.5, p.ink);
    }
    return { x: 10, y: 72, w: 80, h: 70 };
  },

  moonlit(ctx, p, rnd) {
    for (let i = 0; i < 60; i++) {
      const x = rnd() * 100, y = rnd() * 58, r = 0.2 + rnd() * 0.45;
      circle(ctx, x, y, r, rgba(p.ink, 0.35 + rnd() * 0.5));
    }
    for (const [x, y, r] of [[18, 16, 2.2], [34, 40, 1.4], [86, 46, 1.8], [44, 12, 1.2]]) sparkle(ctx, x, y, r, p.accent);
    circle(ctx, 64, 26, 14, p.accent);
    circle(ctx, 70, 21, 12.2, p.bg);
    ctx.fillStyle = p.soft;
    ctx.beginPath();
    ctx.moveTo(0, 58); ctx.bezierCurveTo(22, 50, 40, 56, 58, 54); ctx.bezierCurveTo(76, 52, 88, 56, 100, 52);
    ctx.lineTo(100, 64); ctx.lineTo(0, 64); ctx.closePath(); ctx.fill();
    return { x: 10, y: 70, w: 80, h: 72 };
  },

  roses(ctx, p, rnd) {
    const leafC = mix(p.accent2, p.ink, 0.25);
    curve(ctx, [8, 44, 30, 30, 70, 24, 94, 6], 0.45, p.accent2);
    curve(ctx, [14, 10, 30, 22, 50, 18, 78, 40], 0.35, p.accent2);
    for (const [x, y, a, s] of [[22, 30, -2.4, 8], [36, 14, -0.6, 7], [58, 30, 0.6, 8], [74, 14, -0.9, 7], [44, 34, 1.9, 6], [82, 30, 0.2, 6]]) {
      leaf(ctx, x, y, s, 2.4, a, leafC);
    }
    const tones = { base: p.accent, dark: mix(p.accent, p.ink, 0.45), light: mix(p.accent, "#ffffff", 0.35) };
    rose(ctx, 32, 24, 9.5, tones);
    rose(ctx, 50, 17, 7, { base: p.soft, dark: mix(p.soft, p.ink, 0.35), light: mix(p.soft, "#ffffff", 0.5) });
    rose(ctx, 66, 25, 10, tones);
    for (const [x, y] of [[16, 18], [84, 20], [56, 38]]) {
      ellipse(ctx, x, y, 2, 3, 0.4, tones.base);
      leaf(ctx, x, y + 2, 3, 1.2, 1.9, leafC);
    }
    for (let i = 0; i < 14; i++) circle(ctx, 8 + rnd() * 84, 4 + rnd() * 42, 0.35, p.accent2);
    return { x: 12, y: 50, w: 76, h: 90 };
  },

  peonies(ctx, p, rnd) {
    const leafC = p.accent2;
    const peony = (x, y, r) => {
      for (let layer = 0; layer < 4; layer++) {
        const rr = r * (1 - layer * 0.22);
        const color = mix(p.soft, p.accent, layer * 0.28);
        const n = 7 - layer;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + layer * 0.5;
          ellipse(ctx, x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.45, rr * 0.55, rr * 0.42, a, color);
        }
      }
      circle(ctx, x, y, r * 0.16, mix(p.accent, p.ink, 0.3));
    };
    for (const [x, y, a] of [[70, 30, 2.3], [92, 36, 1.4], [58, 12, 3.4], [96, 8, 0.5]]) leaf(ctx, x, y, 12, 3.6, a, leafC);
    peony(80, 16, 17);
    peony(56, 6, 10);
    leaf(ctx, 20, 132, 11, 3.2, -0.8, leafC);
    leaf(ctx, 10, 128, 10, 3, -1.7, leafC);
    peony(12, 142, 11);
    return { x: 10, y: 40, w: 76, h: 86 };
  },

  "laurel-rings"(ctx, p) {
    frame(ctx, 5, 0.35, p.accent2);
    frame(ctx, 6.6, 0.2, p.accent2);
    laurel(ctx, 50, 36, 21, Math.PI * 0.62, Math.PI * 1.32, { count: 9, leafLen: 5.4, leafWidth: 1.8, color: p.accent2, dir: 1 });
    laurel(ctx, 50, 36, 21, Math.PI * 0.38, -Math.PI * 0.32, { count: 9, leafLen: 5.4, leafWidth: 1.8, color: p.accent2, dir: -1 });
    ring(ctx, 45, 36, 7.5, 1.3, p.accent);
    ring(ctx, 55, 36, 7.5, 1.3, p.accent2);
    sparkle(ctx, 50, 10, 2, p.accent);
    return { x: 13, y: 64, w: 74, h: 76 };
  },

  balloons(ctx, p, rnd) {
    const colors = [p.accent, p.accent2, mix(p.accent, p.accent2, 0.5), p.soft];
    confetti(ctx, rnd, { x: 4, y: 4, w: 92, h: 56, count: 34, colors: [p.accent, p.accent2, p.ink], size: 0.9 });
    const balloons = [[26, 26, 9.5], [47, 17, 11], [69, 27, 9.5], [86, 13, 7]];
    balloons.forEach(([x, y, r], i) => {
      curve(ctx, [x, y + r * 1.2, x + (i % 2 ? 4 : -4), y + r * 2.4, 50, 58], 0.3, rgba(p.ink, 0.6));
    });
    balloons.forEach(([x, y, r], i) => {
      ellipse(ctx, x, y, r * 0.86, r, 0, colors[i % colors.length]);
      ellipse(ctx, x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.28, 0.5, "rgba(255,255,255,0.45)");
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath(); ctx.moveTo(x, y + r * 0.95); ctx.lineTo(x - 1.2, y + r * 1.2); ctx.lineTo(x + 1.2, y + r * 1.2); ctx.fill();
    });
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  sprigs(ctx, p, rnd) {
    const leafC = p.accent;
    sprig(ctx, [4, 34, 10, 16, 22, 8, 38, 3], { leaves: 9, leafLen: 6, leafWidth: 2, color: mix(p.accent, p.ink, 0.3), leafColor: leafC });
    sprig(ctx, [10, 40, 16, 30, 24, 24, 30, 22], { leaves: 5, leafLen: 4, leafWidth: 1.4, color: mix(p.accent, p.ink, 0.3), leafColor: mix(p.accent, p.bg, 0.3) });
    sprig(ctx, [96, 116, 90, 134, 78, 142, 62, 147], { leaves: 9, leafLen: 6, leafWidth: 2, color: mix(p.accent, p.ink, 0.3), leafColor: leafC });
    for (const [x, y] of [[30, 12], [34, 16], [27, 17], [70, 138], [74, 134], [66, 134]]) circle(ctx, x, y, 0.9, p.accent2);
    return { x: 14, y: 34, w: 72, h: 82 };
  },

  mortarboard(ctx, p, rnd) {
    laurel(ctx, 50, 32, 24, Math.PI * 0.55, Math.PI * 0.95, { count: 6, leafLen: 5, leafWidth: 1.7, color: p.accent2, dir: 1 });
    laurel(ctx, 50, 32, 24, Math.PI * 0.45, Math.PI * 0.05, { count: 6, leafLen: 5, leafWidth: 1.7, color: p.accent2, dir: -1 });
    const capC = p.ink;
    ctx.fillStyle = mix(capC, p.bg, 0.15);
    ctx.beginPath(); ctx.moveTo(36, 27); ctx.lineTo(64, 27); ctx.lineTo(62, 39); ctx.quadraticCurveTo(50, 43, 38, 39); ctx.closePath(); ctx.fill();
    ctx.fillStyle = capC;
    ctx.beginPath(); ctx.moveTo(50, 13); ctx.lineTo(76, 23); ctx.lineTo(50, 33); ctx.lineTo(24, 23); ctx.closePath(); ctx.fill();
    circle(ctx, 50, 23, 1.2, p.accent2);
    curve(ctx, [50, 23, 64, 25, 70, 27], 0.5, p.accent2);
    line(ctx, 70, 27, 70, 38, 0.5, p.accent2);
    ctx.fillStyle = p.accent2;
    ctx.beginPath(); ctx.moveTo(68.6, 37); ctx.lineTo(71.4, 37); ctx.lineTo(72.2, 44); ctx.lineTo(67.8, 44); ctx.closePath(); ctx.fill();
    for (const [x, y, r] of [[18, 12, 1.6], [84, 10, 1.2], [88, 40, 1.5], [12, 44, 1.1]]) sparkle(ctx, x, y, r, p.accent);
    return { x: 10, y: 60, w: 80, h: 82 };
  },

  "star-laurel"(ctx, p, rnd) {
    laurel(ctx, 50, 32, 20, Math.PI * 0.62, Math.PI * 1.35, { count: 8, leafLen: 5.6, leafWidth: 1.9, color: p.accent2, dir: 1 });
    laurel(ctx, 50, 32, 20, Math.PI * 0.38, -Math.PI * 0.35, { count: 8, leafLen: 5.6, leafWidth: 1.9, color: p.accent2, dir: -1 });
    star(ctx, 50, 33, 11, 4.6, 5, 0, p.accent);
    star(ctx, 50, 33, 5.5, 2.3, 5, 0, mix(p.accent, "#ffffff", 0.35));
    for (let i = 0; i < 10; i++) sparkle(ctx, 8 + rnd() * 84, 4 + rnd() * 54, 0.6 + rnd() * 1.2, rgba(p.accent, 0.7));
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  horizon(ctx, p, rnd) {
    const hy = 46;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 100, hy); ctx.clip();
    circle(ctx, 50, hy, 20, p.accent2);
    circle(ctx, 50, hy, 14, mix(p.accent2, "#ffffff", 0.22));
    ctx.restore();
    line(ctx, 6, hy, 94, hy, 0.4, p.ink);
    for (let i = 0; i < 7; i++) {
      const y = hy + 2.2 + i * 2.1, half = 18 - i * 2.2;
      line(ctx, 50 - half, y, 50 + half, y, 0.8, rgba(p.accent2, 0.75 - i * 0.08));
    }
    for (let i = 0; i < 5; i++) line(ctx, 10 + rnd() * 20, hy + 4 + i * 3, 30 + rnd() * 10, hy + 4 + i * 3, 0.3, rgba(p.accent, 0.5));
    for (const [x, y, s] of [[26, 18, 2.6], [32, 24, 1.8], [72, 14, 2.2]]) curve(ctx, [x - s, y - s * 0.6, x, y, x + s, y - s * 0.6], 0.45, p.ink);
    return { x: 10, y: 66, w: 80, h: 76 };
  },

  olive(ctx, p, rnd) {
    const pts = [6, 46, 30, 40, 58, 10, 94, 8];
    curve(ctx, pts, 0.7, mix(p.accent, p.ink, 0.35));
    for (let i = 0; i < 16; i++) {
      const t = 0.06 + i * 0.058;
      const q = along(pts, t);
      const side = i % 2 ? 1 : -1;
      leaf(ctx, q.x, q.y, 9 - t * 3, 1.7, q.a + side * 0.65, i % 3 ? p.accent : mix(p.accent, p.bg, 0.3));
    }
    for (const t of [0.3, 0.52, 0.74]) {
      const q = along(pts, t);
      ellipse(ctx, q.x + 1.5, q.y + 3.5, 1.8, 2.5, q.a, p.accent2);
    }
    return { x: 12, y: 54, w: 76, h: 86 };
  },

  pine(ctx, p, rnd) {
    const needles = mix(p.accent, p.bg, 0.05);
    const bough = (x0, y0, x1, y1) => {
      const pts = [x0, y0, (x0 + x1) / 2, (y0 + y1) / 2 + 4, x1, y1];
      curve(ctx, pts, 0.6, mix(p.accent, p.ink, 0.4));
      for (let i = 0; i < 26; i++) {
        const q = along(pts, i / 26);
        line(ctx, q.x, q.y, q.x + Math.cos(q.a - 0.9) * 5, q.y + Math.sin(q.a - 0.9) * 5, 0.5, needles);
        line(ctx, q.x, q.y, q.x + Math.cos(q.a + 0.9) * 5, q.y + Math.sin(q.a + 0.9) * 5, 0.5, needles);
      }
    };
    bough(-4, 6, 46, 18);
    bough(104, 4, 52, 20);
    bough(20, -2, 78, 8);
    for (const [x, len, r, c] of [[24, 18, 4.2, p.accent2], [50, 26, 5, p.ink], [72, 20, 4, p.accent2], [38, 30, 3, p.ink]]) {
      line(ctx, x, 10, x, len + 8, 0.25, p.accent2);
      circle(ctx, x, len + 8 + r, r, c === p.ink ? mix(p.accent2, p.ink, 0.15) : c);
      circle(ctx, x - r * 0.35, len + 8 + r * 0.65, r * 0.25, "rgba(255,255,255,0.4)");
      ctx.fillStyle = p.accent2; ctx.fillRect(x - 1, len + 7.5, 2, 1.2);
    }
    for (let i = 0; i < 12; i++) sparkle(ctx, 6 + rnd() * 88, 40 + rnd() * 14, 0.6 + rnd() * 0.8, rgba(p.accent2, 0.8));
    return { x: 10, y: 60, w: 80, h: 82 };
  },

  fireworks(ctx, p, rnd) {
    const burst = (x, y, r, color, rays) => {
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU + rnd() * 0.1;
        line(ctx, x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.45, color);
        circle(ctx, x + Math.cos(a) * (r + 1.4), y + Math.sin(a) * (r + 1.4), 0.5, color);
      }
    };
    burst(30, 26, 15, p.accent, 22);
    burst(68, 16, 11, p.accent2, 18);
    burst(74, 42, 8, mix(p.accent, p.ink, 0.4), 14);
    for (let i = 0; i < 40; i++) circle(ctx, rnd() * 100, rnd() * 60, 0.2 + rnd() * 0.35, rgba(p.ink, 0.6));
    curve(ctx, [30, 58, 31, 48, 30, 42], 0.3, rgba(p.accent, 0.5));
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  tulips(ctx, p, rnd) {
    const heads = [[34, 108, -0.25], [50, 100, 0], [66, 108, 0.25], [42, 116, -0.12], [58, 117, 0.12]];
    const stemC = mix(p.accent2, p.ink, 0.2);
    for (const [x, y] of heads) curve(ctx, [x, y + 3, (x + 50) / 2, 128, 50, 148], 0.7, stemC);
    leaf(ctx, 50, 140, 16, 3.4, -2.1, p.accent2);
    leaf(ctx, 50, 140, 16, 3.4, -1.0, p.accent2);
    heads.forEach(([x, y, rot], i) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      const c = i % 2 ? mix(p.accent, p.soft, 0.35) : p.accent;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-4.5, -4); ctx.quadraticCurveTo(-5.5, 4, 0, 5); ctx.quadraticCurveTo(5.5, 4, 4.5, -4);
      ctx.lineTo(2.2, -1.5); ctx.lineTo(0, -5); ctx.lineTo(-2.2, -1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mix(c, p.ink, 0.2);
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(-2.4, 0, 0, 5); ctx.quadraticCurveTo(2.4, 0, 0, -5); ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = p.ink;
    ctx.beginPath(); ctx.ellipse(46.5, 132, 3.4, 1.6, -0.4, 0, TAU); ctx.ellipse(53.5, 132, 3.4, 1.6, 0.4, 0, TAU); ctx.fill();
    curve(ctx, [50, 132, 46, 138, 43, 142], 0.6, p.ink);
    curve(ctx, [50, 132, 54, 138, 57, 141], 0.6, p.ink);
    return { x: 10, y: 10, w: 80, h: 84 };
  },

  mountains(ctx, p, rnd) {
    circle(ctx, 72, 16, 6.5, p.accent2);
    const range = (pts, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(0, 60);
      for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.lineTo(100, 60); ctx.closePath(); ctx.fill();
    };
    range([0, 38, 18, 24, 34, 36, 52, 18, 70, 34, 86, 22, 100, 32], p.soft);
    range([0, 46, 22, 32, 40, 46, 60, 30, 80, 46, 100, 38], mix(p.accent, p.bg, 0.35));
    range([0, 54, 26, 42, 50, 54, 74, 40, 100, 52], p.accent);
    ctx.fillStyle = p.bg;
    for (const [x, y] of [[52, 18], [22, 32], [60, 30]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.closePath(); ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const [x, y, s] of [[30, 10, 2], [36, 14, 1.5]]) curve(ctx, [x - s, y - s * 0.6, x, y, x + s, y - s * 0.6], 0.45, p.ink);
    return { x: 10, y: 66, w: 80, h: 76 };
  },

  arch(ctx, p, rnd) {
    const cx = 50, cy = 54, r = 34;
    ctx.beginPath();
    ctx.moveTo(cx - r, 144); ctx.lineTo(cx - r, cy); ctx.arc(cx, cy, r, Math.PI, 0); ctx.lineTo(cx + r, 144);
    ctx.lineWidth = 0.5; ctx.strokeStyle = p.accent2; ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * 1.06 + (i / 25) * Math.PI * 0.88;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      leaf(ctx, x, y, 4.2, 1.4, a + (i % 2 ? 0.9 : -0.9), mix(p.accent2, p.ink, 0.15));
    }
    for (const a of [1.15, 1.32, 1.5, 1.68, 1.85]) {
      const x = cx + Math.cos(a * Math.PI) * r, y = cy + Math.sin(a * Math.PI) * r;
      petalFlower(ctx, x, y, 3.2, 5, p.accent, p.accent2, a);
    }
    for (const [x, y] of [[cx - r, 120], [cx + r, 126], [cx - r, 96]]) {
      leaf(ctx, x, y, 5, 1.5, -2.5, p.accent2); leaf(ctx, x, y, 5, 1.5, -0.6, p.accent2);
    }
    ring(ctx, 47.5, 30, 3.2, 0.55, p.accent2);
    ring(ctx, 52.5, 30, 3.2, 0.55, p.accent);
    return { x: 21, y: 40, w: 58, h: 98 };
  },

  baby(ctx, p, rnd) {
    cloud(ctx, 30, 40, 9, p.soft);
    cloud(ctx, 80, 48, 6.5, p.soft);
    circle(ctx, 60, 24, 13, p.accent2);
    circle(ctx, 66, 19, 11.4, p.bg);
    curve(ctx, [52.5, 25, 54, 27, 55.5, 25], 0.5, p.ink);
    for (const [x, y, r] of [[22, 14, 2], [38, 22, 1.3], [82, 22, 1.7], [88, 34, 1.1], [14, 28, 1]]) star(ctx, x, y, r, r * 0.45, 5, 0, p.accent);
    line(ctx, 88, 0, 88, 10, 0.25, p.accent);
    star(ctx, 88, 12, 2, 0.9, 5, 0, p.accent);
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  daisies(ctx, p, rnd) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.5 + (i / 11) * Math.PI * 0.5;
      line(ctx, 100 + Math.cos(a) * 24, Math.sin(a) * 24, 100 + Math.cos(a) * 32, Math.sin(a) * 32, 0.7, rgba(p.accent, 0.7));
    }
    circle(ctx, 100, 0, 20, p.accent);
    const petal = mix("#ffffff", p.bg, 0.15);
    const stems = [[14, 120, 8], [28, 112, 7], [44, 126, 6.5], [72, 122, 7], [88, 112, 8]];
    for (const [x, y] of stems) {
      curve(ctx, [x, y, x + 2, (y + 150) / 2, x - 1, 150], 0.7, p.accent2);
      leaf(ctx, x + 1, y + 16, 7, 1.8, (x < 50 ? -0.6 : -2.5), p.accent2);
    }
    for (const [x, y, r] of stems) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        ellipse(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, r * 0.14, a, petal);
      }
      ring(ctx, x, y, r * 1.02, 0.15, rgba(p.ink, 0.08));
      circle(ctx, x, y, r * 0.24, p.accent);
    }
    return { x: 10, y: 28, w: 80, h: 76 };
  },

  lilies(ctx, p, rnd) {
    const petal = mix(mix("#ffffff", p.soft, 0.5), p.accent, 0.18);
    const edge = mix(p.accent, p.ink, 0.2);
    const lily = (x, y, s, rot) => {
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * TAU;
        leaf(ctx, x, y, s, s * 0.26, a, petal);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.45, -s * 0.26, s, 0); ctx.quadraticCurveTo(s * 0.45, s * 0.26, 0, 0);
        ctx.lineWidth = 0.35; ctx.strokeStyle = edge; ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 5; i++) {
        const a = rot + 0.3 + i * 1.25;
        line(ctx, x, y, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, 0.2, p.accent2);
        circle(ctx, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, 0.45, p.accent2);
      }
    };
    const stemC = mix(p.accent, p.ink, 0.25);
    curve(ctx, [38, 26, 42, 36, 50, 46], 0.6, stemC);
    curve(ctx, [62, 20, 60, 34, 50, 46], 0.6, stemC);
    curve(ctx, [50, 46, 50, 48, 50, 50], 0.6, stemC);
    leaf(ctx, 50, 46, 12, 2.2, -2.7, p.accent);
    leaf(ctx, 50, 46, 11, 2.2, -0.35, p.accent);
    lily(38, 24, 9, 0.2);
    lily(62, 18, 8, 0.6);
    ellipse(ctx, 74, 30, 1.5, 4, 0.5, petal);
    curve(ctx, [74, 33, 70, 40, 60, 40], 0.4, stemC);
    return { x: 12, y: 56, w: 76, h: 84 };
  },

  loops(ctx, p, rnd) {
    for (let i = 0; i < 40; i++) circle(ctx, 4 + rnd() * 92, 4 + rnd() * 56, 0.5 + rnd() * 0.8, rgba(i % 2 ? p.accent : p.accent2, 0.45));
    ring(ctx, 42, 32, 15, 2.2, p.accent);
    ring(ctx, 58, 32, 15, 2.2, p.accent2);
    ctx.save();
    ctx.beginPath(); ctx.arc(42, 32, 15, -0.55, 0.55); ctx.lineWidth = 2.2; ctx.strokeStyle = p.accent; ctx.stroke();
    ctx.restore();
    return { x: 10, y: 60, w: 80, h: 82 };
  },

  window(ctx, p) {
    ctx.save();
    ctx.fillStyle = rgba(p.accent2, 0.13);
    ctx.beginPath(); ctx.moveTo(36, 52); ctx.lineTo(64, 52); ctx.lineTo(96, 150); ctx.lineTo(4, 150); ctx.closePath(); ctx.fill();
    ctx.restore();
    const path = () => { ctx.beginPath(); ctx.moveTo(34, 52); ctx.lineTo(34, 26); ctx.arc(50, 26, 16, Math.PI, 0); ctx.lineTo(66, 52); ctx.closePath(); };
    path(); ctx.fillStyle = mix(p.soft, "#ffffff", 0.4); ctx.fill();
    path(); ctx.lineWidth = 1.2; ctx.strokeStyle = p.accent2; ctx.stroke();
    line(ctx, 50, 10, 50, 52, 0.6, p.accent2);
    line(ctx, 34, 32, 66, 32, 0.6, p.accent2);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 1.15 + (i / 8) * Math.PI * 0.7;
      line(ctx, 50 + Math.cos(a) * 21, 26 + Math.sin(a) * 21, 50 + Math.cos(a) * 27, 26 + Math.sin(a) * 27, 0.45, rgba(p.accent2, 0.7));
    }
    ctx.fillStyle = p.accent2; ctx.fillRect(30, 52, 40, 1.4);
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  crescent(ctx, p, rnd) {
    for (let i = 0; i < 26; i++) circle(ctx, rnd() * 100, rnd() * 56, 0.2 + rnd() * 0.3, rgba(p.ink, 0.5));
    circle(ctx, 50, 30, 14, p.accent);
    circle(ctx, 56, 25, 12.2, p.bg);
    star(ctx, 60, 33, 2.4, 1, 5, 0.2, p.accent);
    const lantern = (x, drop, s) => {
      line(ctx, x, 0, x, drop, 0.3, p.accent);
      const y = drop;
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x, y); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(p.accent, 0.25);
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.5); ctx.quadraticCurveTo(x - s * 0.85, y + s * 1.3, x - s * 0.4, y + s * 2.1);
      ctx.lineTo(x + s * 0.4, y + s * 2.1); ctx.quadraticCurveTo(x + s * 0.85, y + s * 1.3, x + s * 0.5, y + s * 0.5); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 0.4; ctx.strokeStyle = p.accent; ctx.stroke();
      line(ctx, x, y + s * 0.5, x, y + s * 2.1, 0.25, p.accent);
      circle(ctx, x, y + s * 1.3, s * 0.18, p.accent2);
      ctx.fillStyle = p.accent; ctx.fillRect(x - s * 0.3, y + s * 2.1, s * 0.6, s * 0.18);
    };
    lantern(18, 14, 6);
    lantern(82, 8, 7);
    lantern(30, 4, 4);
    return { x: 10, y: 58, w: 80, h: 84 };
  },

  monogram(ctx, p, rnd, values, fonts) {
    frame(ctx, 6, 0.3, p.accent);
    frame(ctx, 7.4, 0.15, p.accent);
    ring(ctx, 50, 28, 12, 0.5, p.accent);
    ring(ctx, 50, 28, 13.2, 0.15, p.accent);
    line(ctx, 22, 28, 34, 28, 0.3, p.accent);
    line(ctx, 66, 28, 78, 28, 0.3, p.accent);
    const initials = (values.secondary || "").trim().slice(0, 3).toUpperCase();
    if (initials) {
      ctx.fillStyle = p.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = initials.length > 2 ? 7.5 : 9;
      ctx.font = `${fonts.title.style === "italic" ? "italic " : ""}${fonts.title.weight} ${size}px "${fonts.title.family}", serif`;
      ctx.fillText(initials, 50, 28.6);
    } else {
      star(ctx, 50, 28, 3, 1.2, 4, 0, p.accent);
    }
    return { x: 14, y: 48, w: 72, h: 90, consumes: ["secondary"] };
  },

  hearts(ctx, p, rnd) {
    const h = (x, y, s, fill, rot = 0) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); heartPath(ctx, 0, 0, s); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
    };
    h(36, 30, 20, p.soft, -0.25);
    h(62, 26, 26, p.accent, 0.12);
    h(46, 40, 13, mix(p.accent, p.ink, 0.35), -0.1);
    ctx.save(); ctx.translate(76, 44); ctx.rotate(0.3); heartPath(ctx, 0, 0, 10); ctx.lineWidth = 0.5; ctx.strokeStyle = p.accent2; ctx.stroke(); ctx.restore();
    for (let i = 0; i < 12; i++) h(6 + rnd() * 88, 4 + rnd() * 52, 1.6 + rnd() * 1.6, rgba(p.accent2, 0.6), rnd() - 0.5);
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  burst(ctx, p, rnd) {
    const colors = [p.accent, p.accent2, p.ink, mix(p.accent, p.accent2, 0.5)];
    for (let i = 0; i < 90; i++) {
      const a = rnd() * TAU, d = 5 + Math.pow(rnd(), 0.7) * 36;
      const x = 50 + Math.cos(a) * d, y = 30 + Math.sin(a) * d * 0.8;
      if (y > 58) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = colors[i % colors.length];
      const s = 0.6 + rnd() * 1.1;
      if (i % 3 === 0) ctx.fillRect(-s * 1.4, -s * 0.4, s * 2.8, s * 0.8);
      else if (i % 3 === 1) { ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.fill(); }
      ctx.restore();
    }
    curve(ctx, [14, 20, 22, 10, 30, 26, 36, 14], 0.6, p.accent);
    curve(ctx, [64, 14, 72, 24, 80, 8, 88, 20], 0.6, p.accent2);
    star(ctx, 50, 30, 6, 2.6, 8, 0, p.accent2);
    return { x: 10, y: 62, w: 80, h: 80 };
  },

  ornate(ctx, p) {
    frame(ctx, 5, 0.5, p.accent);
    frame(ctx, 7, 0.2, p.accent);
    const corner = (x, y, sx, sy) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI / 2); ctx.lineWidth = 0.35; ctx.strokeStyle = p.accent; ctx.stroke();
      leaf(ctx, 3, 3, 6, 1.4, 0.2, p.accent2);
      leaf(ctx, 3, 3, 6, 1.4, 1.37, p.accent2);
      circle(ctx, 2.6, 2.6, 0.9, p.accent);
      ctx.restore();
    };
    corner(7, 7, 1, 1); corner(93, 7, -1, 1); corner(7, 143, 1, -1); corner(93, 143, -1, -1);
    ctx.save(); ctx.translate(50, 12);
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(2, 0); ctx.lineTo(0, 2); ctx.lineTo(-2, 0); ctx.fill();
    curve(ctx, [-3, 0, -8, -3, -14, 0], 0.35, p.accent);
    curve(ctx, [3, 0, 8, -3, 14, 0], 0.35, p.accent);
    ctx.restore();
    return { x: 15, y: 18, w: 70, h: 114 };
  },

  meadow(ctx, p, rnd) {
    const grassC = mix(p.accent2, p.ink, 0.15);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 100, h = 6 + rnd() * 12;
      curve(ctx, [x, 150, x + (rnd() - 0.5) * 2, 150 - h / 2, x + (rnd() - 0.5) * 6, 150 - h], 0.35, rgba(grassC, 0.7));
    }
    const flowers = [[10, 124, p.accent], [22, 132, p.accent2], [34, 120, p.soft], [48, 134, p.accent], [60, 126, mix(p.accent, p.soft, 0.4)], [74, 118, p.accent], [86, 130, p.soft], [94, 122, p.accent2]];
    for (const [x, y] of flowers) curve(ctx, [x, 150, x + 1, (150 + y) / 2, x, y], 0.4, grassC);
    flowers.forEach(([x, y, c], i) => {
      if (i % 3 === 2) { for (let k = 0; k < 4; k++) circle(ctx, x + (k % 2) * 1.6 - 0.8, y - k * 1.8, 1.1, c); }
      else petalFlower(ctx, x, y, 3.4 + (i % 2), 5 + (i % 2), c, i % 2 ? p.accent : p.accent2, i);
    });
    return { x: 10, y: 14, w: 80, h: 96 };
  },
};

export function drawMotif(name, ctx, palette, rnd, values, fonts) {
  const motif = MOTIFS[name];
  if (!motif) return { x: 10, y: 12, w: 80, h: 126 };
  return motif(ctx, palette, rnd, values, fonts);
}

export const motifNames = Object.keys(MOTIFS);
