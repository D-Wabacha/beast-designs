// Renders a card face to a <canvas>. The same function draws catalog thumbnails, the live
// customiser preview and the full-resolution export, so what customers see is what they get.
import { drawMotif } from "./motifs.js";
import { seeded, hashString, contrast, rgba } from "./paint.js";

const UNITS_W = 100;
const RATIO = 1.5;

export function faceFields(template, faceId) {
  return template.fields.filter(f => !f.face || f.face === faceId);
}

export function resolvePalette(catalog, face, design) {
  const wanted = design?.palettes?.[face.id];
  const id = face.palettes.includes(wanted) ? wanted : face.palettes[0];
  return { id, ...catalog.palettes[id] };
}

export function textColorOptions(catalog, palette) {
  return catalog.textColors.map(opt => {
    const color = opt.value || palette[opt.id];
    return { ...opt, color, ok: opt.id === "ink" || contrast(color, palette.bg) >= 4.5 };
  });
}

function resolveInk(catalog, palette, inkId) {
  const opt = textColorOptions(catalog, palette).find(o => o.id === inkId && o.ok);
  return opt ? opt.color : palette.ink;
}

export function resolveFont(catalog, template, design) {
  return catalog.fonts[design?.font] || catalog.fonts[template.defaults.font] || Object.values(catalog.fonts)[0];
}

export async function loadCardFonts(catalog) {
  if (!document.fonts || !document.fonts.load) return;
  const specs = new Set();
  for (const f of Object.values(catalog.fonts)) {
    for (const d of [f.title, f.body]) specs.add(`${d.style === "italic" ? "italic " : ""}${d.weight} 40px "${d.family}"`);
    specs.add(`italic ${f.body.weight} 40px "${f.body.family}"`);
  }
  const all = Promise.allSettled([...specs].map(s => document.fonts.load(s)));
  await Promise.race([all, new Promise(r => setTimeout(r, 5000))]);
}

function fontString(desc, px, italic = false) {
  const style = italic || desc.style === "italic" ? "italic " : "";
  return `${style}${desc.weight} ${px}px "${desc.family}", Georgia, serif`;
}

function sizeFactor(desc) {
  if (desc.family === "Pinyon Script") return 1.3;
  if (desc.uppercase) return 0.78;
  if (desc.family === "Cormorant Garamond") return 1.1;
  return 1;
}

function fieldText(field, values, opts) {
  const raw = values?.[field.key];
  const value = (raw === undefined || raw === null ? field.default : raw).trim();
  if (value) return { text: value, placeholder: false };
  if (opts.sample && field.placeholder) return { text: field.placeholder.replace(/^e\.g\.\s*/i, ""), placeholder: false };
  if (opts.preview && field.required) return { text: (field.placeholder || field.label).replace(/^e\.g\.\s*/i, ""), placeholder: true };
  return null;
}

function buildBlocks(template, face, values, fonts, colors, opts, consumed) {
  const fields = faceFields(template, face.id).filter(f => !consumed.includes(f.role));
  const byRole = {};
  for (const f of fields) if (!byRole[f.role]) byRole[f.role] = f;

  const t = fonts.title, b = fonts.body;
  const block = (role, text, placeholder, style) => ({ role, text, placeholder, ...style });
  const out = {};

  const add = (role, style, transform = s => s) => {
    const f = byRole[role];
    if (!f) return;
    const v = fieldText(f, values, opts);
    if (!v) return;
    out[role] = block(role, transform(v.text, f), v.placeholder, style);
  };

  const recipientField = byRole.recipient;
  const nameStyle = recipientField && recipientField.display === "{value}";
  add("recipient", nameStyle
    ? { font: { ...t, uppercase: false }, size: 6.2 * (t.uppercase ? 0.85 : sizeFactor(t)), lh: 1.15, color: colors.ink, maxLines: 2 }
    : { font: b, size: 4.3 * sizeFactor(b), lh: 1.3, color: colors.ink, maxLines: 2 },
    (text, f) => (f.display || "{value}").replace("{value}", text));
  add("title", { font: t, size: 8.6 * sizeFactor(t), lh: 1.12, color: colors.ink, maxLines: 3, tracking: t.uppercase ? 0.08 : 0 },
    text => (t.uppercase ? text.toUpperCase() : text));
  add("secondary", { font: b, italic: true, size: 3.7 * sizeFactor(b), lh: 1.3, color: colors.accent, maxLines: 3 });
  add("message", { font: b, size: 4.3 * sizeFactor(b), lh: 1.45, color: colors.ink });
  add("details", { font: b, size: 2.8 * sizeFactor(b), lh: 1.4, color: colors.accent, maxLines: 3, tracking: 0.14 }, text => text.toUpperCase());

  const closing = byRole.closing && fieldText(byRole.closing, values, opts);
  const sender = byRole.sender && fieldText(byRole.sender, values, opts);
  const sig = [];
  if (closing) sig.push(block("closing", closing.text, closing.placeholder, { font: b, size: 3.9 * sizeFactor(b), lh: 1.3, color: colors.ink, maxLines: 2 }));
  if (sender) sig.push(block("sender", sender.text, sender.placeholder, { font: { ...t, uppercase: false }, size: 5.4 * (t.family === "Pinyon Script" ? 1.3 : 1), lh: 1.2, color: colors.ink, maxLines: 2 }));

  const order = nameStyle
    ? ["title", "recipient", "secondary", "message", "details"]
    : ["recipient", "title", "secondary", "message", "details"];
  const blocks = order.filter(r => out[r]).map(r => out[r]);
  sig.forEach((s, i) => { s.gap = i === 0 ? 4.6 : 1; blocks.push(s); });
  blocks.forEach((bl, i) => { if (bl.gap === undefined) bl.gap = i === 0 ? 0 : bl.role === "title" || blocks[i - 1].role === "title" ? 3 : 3.4; });
  return blocks;
}

function wrap(ctx, text, maxW) {
  const lines = [];
  lines.broke = false;
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let cur = "";
    for (let word of words) {
      while (ctx.measureText(word).width > maxW && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && ctx.measureText(word.slice(0, cut) + "-").width > maxW) cut--;
        lines.broke = true;
        if (cur) { lines.push(cur); cur = ""; }
        lines.push(word.slice(0, cut) + "-");
        word = word.slice(cut);
      }
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = word; }
    }
    lines.push(cur);
  }
  return lines;
}

function setTracking(ctx, em, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = em ? `${em * px}px` : "0px";
}

function layout(ctx, blocks, box, scale) {
  let total = 0, fits = true;
  const laid = blocks.map(bl => {
    const px = bl.size * scale;
    ctx.font = fontString(bl.font, px, bl.italic);
    setTracking(ctx, bl.tracking, px);
    const lines = wrap(ctx, bl.text, box.w);
    if (bl.maxLines && lines.length > bl.maxLines) fits = false;
    // Prefer smaller lettering over splitting a word, unless the text is already very small.
    if (lines.broke && scale > 0.6) fits = false;
    const gap = bl.gap * scale;
    const height = lines.length * px * bl.lh;
    total += gap + height;
    return { ...bl, px, lines, gap, height };
  });
  setTracking(ctx, 0, 0);
  return { laid, total, fits: fits && total <= box.h };
}

function drawWatermark(ctx, ink) {
  ctx.save();
  ctx.fillStyle = rgba(ink, 0.07);
  ctx.font = `600 9px "Jost", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setTracking(ctx, 0.3, 9);
  for (const [x, y] of [[50, 32], [50, 78], [50, 124]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.42); ctx.fillText("PREVIEW", 0, 0); ctx.restore();
  }
  setTracking(ctx, 0, 0);
  ctx.restore();
}

/**
 * Draws one face of a card.
 * opts: { catalog, template, faceId, values, design, width, preview, sample }
 * Returns layout diagnostics ({ scale, overflow }) so the editor can warn about long text.
 */
export function renderFace(canvas, opts) {
  const { catalog, template, values = {}, design = {}, width = 600, preview = false, sample = false } = opts;
  const face = template.faces.find(f => f.id === opts.faceId) || template.faces[0];
  const palette = resolvePalette(catalog, face, design);
  const fonts = resolveFont(catalog, template, design);
  const ink = resolveInk(catalog, palette, design.ink || "ink");
  const accent = contrast(palette.accent, palette.bg) >= 3 ? palette.accent : ink;

  canvas.width = Math.round(width);
  canvas.height = Math.round(width * RATIO);
  const ctx = canvas.getContext("2d");
  const k = canvas.width / UNITS_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, UNITS_W, UNITS_W * RATIO);

  const rnd = seeded(hashString(template.id + ":" + face.id));
  const box = drawMotif(face.motif, ctx, palette, rnd, values, fonts);
  const blocks = buildBlocks(template, face, values, fonts, { ink, accent }, { preview, sample }, box.consumes || []);

  const userScale = Math.min(1.15, Math.max(0.85, (Number(design.size) || 100) / 100));
  let scale = userScale, result = layout(ctx, blocks, box, scale);
  while (!result.fits && scale > 0.5) {
    scale -= 0.03;
    result = layout(ctx, blocks, box, scale);
  }
  let overflow = !result.fits;
  if (overflow) {
    // Last resort: trim the longest block so nothing spills off the card.
    const msg = result.laid.find(b => b.role === "message") || result.laid[result.laid.length - 1];
    while (result.total > box.h && msg.lines.length > 1) {
      msg.lines.pop();
      result.total -= msg.px * msg.lh;
      msg.lines[msg.lines.length - 1] = msg.lines[msg.lines.length - 1].replace(/\s*\S*$/, "…");
    }
  }

  const align = ["left", "center", "right"].includes(design.align) ? design.align : template.defaults.align || "center";
  const x = align === "left" ? box.x : align === "right" ? box.x + box.w : box.x + box.w / 2;
  let y = box.y + Math.max(0, (box.h - result.total) / 2);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  for (const bl of result.laid) {
    y += bl.gap;
    ctx.font = fontString(bl.font, bl.px, bl.italic);
    setTracking(ctx, bl.tracking, bl.px);
    ctx.fillStyle = bl.placeholder ? rgba(bl.color, 0.35) : bl.color;
    for (const ln of bl.lines) {
      const lh = bl.px * bl.lh;
      ctx.fillText(ln, x, y + lh / 2);
      y += lh;
    }
  }
  setTracking(ctx, 0, 0);

  if (preview) drawWatermark(ctx, ink);
  return { scale, overflow, shrunk: scale < userScale - 0.001 };
}

export function exportFace(opts, width) {
  const canvas = document.createElement("canvas");
  renderFace(canvas, { ...opts, width, preview: false, sample: false });
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not create the image file."))), "image/png");
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
