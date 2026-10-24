// Low-level drawing helpers shared by the card motifs.
// All coordinates are in "card units": the card is 100 units wide and 150 tall.

export const TAU = Math.PI * 2;

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const ca = parseHex(a), cb = parseHex(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}

export function rgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ring(ctx, x, y, r, width, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export function ellipse(ctx, x, y, rx, ry, rot, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

// A pointed leaf whose base sits at (x, y) and which points along `angle`.
export function leaf(ctx, x, y, length, width, angle, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.45, -width, length, 0);
  ctx.quadraticCurveTo(length * 0.45, width, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, width, stroke) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";
  ctx.stroke();
}

export function curve(ctx, pts, width, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";
  ctx.stroke();
}

// Point and tangent angle on a quadratic or cubic curve.
export function along(pts, t) {
  if (pts.length === 6) {
    const [x0, y0, cx, cy, x1, y1] = pts, m = 1 - t;
    return {
      x: m * m * x0 + 2 * m * t * cx + t * t * x1,
      y: m * m * y0 + 2 * m * t * cy + t * t * y1,
      a: Math.atan2(2 * m * (cy - y0) + 2 * t * (y1 - cy), 2 * m * (cx - x0) + 2 * t * (x1 - cx)),
    };
  }
  const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = pts, m = 1 - t;
  const x = m ** 3 * x0 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t ** 3 * x1;
  const y = m ** 3 * y0 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t ** 3 * y1;
  const dx = 3 * m * m * (c1x - x0) + 6 * m * t * (c2x - c1x) + 3 * t * t * (x1 - c2x);
  const dy = 3 * m * m * (c1y - y0) + 6 * m * t * (c2y - c1y) + 3 * t * t * (y1 - c2y);
  return { x, y, a: Math.atan2(dy, dx) };
}

// A stem with alternating leaves along it.
export function sprig(ctx, pts, { leaves = 8, leafLen = 6, leafWidth = 2, stem = 0.5, color, leafColor, start = 0.12 }) {
  curve(ctx, pts, stem, color);
  for (let i = 0; i < leaves; i++) {
    const t = start + (1 - start) * (i / leaves);
    const p = along(pts, t);
    const side = i % 2 ? 1 : -1;
    leaf(ctx, p.x, p.y, leafLen * (0.75 + 0.25 * (1 - t)), leafWidth, p.a + side * 0.75, leafColor || color);
  }
  const end = along(pts, 1);
  leaf(ctx, end.x, end.y, leafLen * 0.8, leafWidth, end.a, leafColor || color);
}

// Leaves placed along an arc, all pointing the same rotational direction.
export function laurel(ctx, cx, cy, r, a0, a1, { count = 9, leafLen = 6, leafWidth = 2, color, stem = 0.45, dir = 1 }) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
  ctx.lineWidth = stem;
  ctx.strokeStyle = color;
  ctx.stroke();
  for (let i = 0; i < count; i++) {
    const a = a0 + (a1 - a0) * (i / (count - 1));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const tangent = a + (dir * Math.PI) / 2;
    leaf(ctx, x, y, leafLen, leafWidth, tangent - dir * 0.5, color);
    leaf(ctx, x, y, leafLen, leafWidth, tangent + dir * 0.5, color);
  }
}

export function star(ctx, x, y, outer, inner, points, rot, fill) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function sparkle(ctx, x, y, r, fill) {
  star(ctx, x, y, r, r * 0.22, 4, 0, fill);
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.1, y + s * 0.2, x - s * 0.55, y + s * 0.05, x - s * 0.5, y - s * 0.22);
  ctx.bezierCurveTo(x - s * 0.45, y - s * 0.5, x - s * 0.08, y - s * 0.5, x, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.08, y - s * 0.5, x + s * 0.45, y - s * 0.5, x + s * 0.5, y - s * 0.22);
  ctx.bezierCurveTo(x + s * 0.55, y + s * 0.05, x + s * 0.1, y + s * 0.2, x, y + s * 0.35);
  ctx.closePath();
}

export function petalFlower(ctx, x, y, r, petals, petalColor, centerColor, rot = 0, petalWidth = 0.42) {
  for (let i = 0; i < petals; i++) {
    const a = rot + (i / petals) * TAU;
    ellipse(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * petalWidth * 0.55 * 1.6, a, petalColor);
  }
  circle(ctx, x, y, r * 0.28, centerColor);
}

export function rose(ctx, x, y, r, { base, dark, light }) {
  circle(ctx, x, y, r, base);
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.88 - i * 0.16);
    const a = i * 1.9;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.06, y + Math.sin(a) * r * 0.06, rr, a, a + 3.6);
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = i % 2 ? light : dark;
    ctx.stroke();
  }
  circle(ctx, x, y, r * 0.12, dark);
  ctx.restore();
}

export function confetti(ctx, rnd, { x, y, w, h, count, colors, size = 1.4 }) {
  for (let i = 0; i < count; i++) {
    const px = x + rnd() * w, py = y + rnd() * h;
    const c = colors[Math.floor(rnd() * colors.length)];
    const kind = rnd();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rnd() * TAU);
    ctx.fillStyle = c;
    if (kind < 0.4) ctx.fillRect(-size, -size * 0.45, size * 2, size * 0.9);
    else if (kind < 0.75) { ctx.beginPath(); ctx.arc(0, 0, size * 0.6, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size, size * 0.8); ctx.lineTo(-size, size * 0.8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}

export function frame(ctx, inset, width, stroke, W = 100, H = 150) {
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
}

export function cloud(ctx, x, y, s, fill) {
  ctx.beginPath();
  ctx.arc(x - s * 0.9, y, s * 0.55, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x - s * 0.3, y - s * 0.45, s * 0.65, Math.PI, Math.PI * 1.85);
  ctx.arc(x + s * 0.5, y - s * 0.25, s * 0.55, Math.PI * 1.2, Math.PI * 0.1);
  ctx.arc(x + s * 0.95, y + s * 0.1, s * 0.42, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
