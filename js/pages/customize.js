import { initPage, productCardHtml, hydrateThumbs, esc, $, $$, toast, confirmDialog, copyText, cardFontsReady, setMeta, ICONS } from "../ui.js";
import { findTemplate, primaryOccasion, enabledFormats, quote, money, priceLabel } from "../data.js";
import { renderFace, resolvePalette, textColorOptions } from "../card/render.js";
import { validateFields } from "../validate.js";
import { drafts, checkout } from "../store.js";
import { waLink, designEnquiryMessage } from "../whatsapp.js";

const data = await initPage("customize");
const { catalog, business } = data;
const app = $("#app");
const params = new URLSearchParams(location.search);
const templateId = params.get("t");

if (!templateId) renderPicker();
else {
  const template = findTemplate(data, templateId);
  if (template) await renderDesigner(template);
  else renderNotFound(templateId);
}

function renderPicker() {
  app.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">Customise a card</p>
      <h1>Choose a design to personalise</h1>
      <p>Pick any design below to open it in the designer. You can change the words, colours and lettering, and switch designs later without losing what you've written.</p>
      <p><a href="shop.html">Search and filter all designs</a></p>
    </header>
    <div class="picker-grid">${catalog.templates.map(t => productCardHtml(data, t)).join("")}</div>`;
  hydrateThumbs(app, data);
}

function renderNotFound(id) {
  setMeta({ title: "Design not found | Love Cards Kenya" });
  app.innerHTML = `
    <div class="empty-state" style="margin-top:32px">
      <h1>We couldn't find that design</h1>
      <p>The link may be out of date, or the design (“${esc(id)}”) is no longer available.</p>
      <div class="empty-actions"><a class="btn btn-primary" href="shop.html">Browse all designs</a></div>
    </div>`;
}

function defaultsFor(template) {
  const values = {};
  for (const f of template.fields) values[f.key] = f.default || "";
  const shared = drafts.getShared();
  for (const key of ["recipient", "sender"]) if (shared[key] && key in values) values[key] = shared[key];
  const palettes = Object.fromEntries(template.faces.map(f => [f.id, f.palettes[0]]));
  return {
    values,
    design: { font: template.defaults.font, align: template.defaults.align || "center", size: catalog.sizeRange.default, ink: "ink", palettes },
    formatId: business.fulfilment.defaultFormat,
  };
}

function sanitize(template, incoming) {
  const base = defaultsFor(template);
  const values = { ...base.values };
  for (const f of template.fields) {
    const v = incoming?.values?.[f.key];
    if (typeof v === "string") values[f.key] = v.slice(0, f.maxLength);
  }
  const d = incoming?.design || {};
  const design = { ...base.design };
  if (catalog.fonts[d.font]) design.font = d.font;
  if (["left", "center", "right"].includes(d.align)) design.align = d.align;
  const size = Number(d.size);
  if (size >= catalog.sizeRange.min && size <= catalog.sizeRange.max) design.size = size;
  if (catalog.textColors.some(c => c.id === d.ink)) design.ink = d.ink;
  for (const face of template.faces) if (face.palettes.includes(d.palettes?.[face.id])) design.palettes[face.id] = d.palettes[face.id];
  const formatId = enabledFormats(business).some(f => f.id === incoming?.formatId) ? incoming.formatId : base.formatId;
  return { values, design, formatId };
}

function encodeShare(state) {
  const json = JSON.stringify({ v: state.values, d: state.design });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShare(str) {
  try {
    const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    const obj = JSON.parse(json);
    return { values: obj.v, design: obj.d };
  } catch {
    return null;
  }
}

async function renderDesigner(template) {
  const occasion = primaryOccasion(data, template);
  const formats = enabledFormats(business);
  const isBundle = template.kind === "bundle";
  setMeta({
    title: `${template.name}: Personalised ${occasion ? occasion.name : "Greeting"} Card | Love Cards Kenya`,
    description: `${template.description} Personalise it online from ${money(template.price.amount, business)}.`,
  });

  // Starting state: shared link > saved draft > template defaults.
  let sharedNotice = false;
  let state;
  const hash = new URLSearchParams(location.hash.slice(1)).get("d");
  const shared = hash && decodeShare(hash);
  if (shared) {
    state = sanitize(template, shared);
    sharedNotice = true;
    history.replaceState(null, "", location.pathname + location.search);
  } else {
    const draft = drafts.get(template.id);
    state = draft ? sanitize(template, draft) : defaultsFor(template);
  }
  let activeFace = template.faces[0].id;
  let lastRender = {};

  const groups = isBundle
    ? [
        { title: "Who it's for", fields: template.fields.filter(f => !f.face && f.role === "recipient") },
        ...template.faces.map(face => ({ title: face.label, fields: template.fields.filter(f => f.face === face.id), face: face.id })),
        { title: "Sign-off (on both cards)", fields: template.fields.filter(f => !f.face && f.role !== "recipient") },
      ]
    : [{ title: null, fields: template.fields }];

  const fieldHtml = f => {
    const id = `f-${f.key}`;
    const val = state.values[f.key] ?? "";
    const sugg = template.suggestions?.[f.key] || (template.suggestions?.[f.role] && !isBundle ? template.suggestions[f.role] : null);
    const input = f.type === "textarea"
      ? `<textarea class="textarea" id="${id}" name="${esc(f.key)}" maxlength="${f.maxLength}" ${f.required ? "required" : ""} aria-describedby="${id}-hint ${id}-err" rows="5">${esc(val)}</textarea>`
      : `<input class="input" id="${id}" name="${esc(f.key)}" type="text" maxlength="${f.maxLength}" value="${esc(val)}" ${f.required ? "required" : ""} placeholder="${esc(f.placeholder || "")}" aria-describedby="${id}-hint ${id}-err" autocomplete="off">`;
    return `
      <div class="field" data-field="${esc(f.key)}">
        <label for="${id}">${esc(f.label)}${f.required ? "" : ' <span class="opt">(optional)</span>'}</label>
        ${input}
        <div class="hint" id="${id}-hint"><span>${f.help ? esc(f.help) : ""}</span><span class="counter" data-counter="${esc(f.key)}">${val.length}/${f.maxLength}</span></div>
        <p class="error-text" id="${id}-err"></p>
        ${sugg ? `<div class="chips" role="group" aria-label="Suggested ${esc(f.label.toLowerCase())}">${sugg.map(s => `<button type="button" class="chip" data-suggest="${esc(f.key)}" data-text="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
      </div>`;
  };

  const paletteHtml = face => face.palettes.length < 2 ? "" : `
    <fieldset>
      <legend class="label">${isBundle ? esc(face.label) + " colours" : "Colours"}</legend>
      <div class="swatches">
        ${face.palettes.map(pid => {
          const p = catalog.palettes[pid];
          return `<label class="swatch"><input type="radio" name="palette-${esc(face.id)}" value="${esc(pid)}" ${state.design.palettes[face.id] === pid ? "checked" : ""}>
            <span><i style="background:linear-gradient(135deg, ${p.bg} 0 50%, ${p.accent} 50% 75%, ${p.accent2} 75%)"></i>${esc(p.name)}</span></label>`;
        }).join("")}
      </div>
    </fieldset>`;

  const fontHtml = () => `
    <fieldset>
      <legend class="label">Lettering</legend>
      <div class="swatches">
        ${Object.entries(catalog.fonts).map(([id, f]) => `
          <label class="swatch"><input type="radio" name="font" value="${esc(id)}" ${state.design.font === id ? "checked" : ""}>
            <span style="font-family:'${esc(f.title.family)}', serif; font-size:${f.title.family === "Pinyon Script" ? "1.15rem" : "0.95rem"}; ${f.title.style === "italic" ? "font-style:italic;" : ""}">${esc(f.label)}</span></label>`).join("")}
      </div>
    </fieldset>`;

  app.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="shop.html">Cards</a>${occasion ? ` / <a href="shop.html?occasion=${esc(occasion.id)}">${esc(occasion.name)}</a>` : ""} / <span aria-current="page">${esc(template.name)}</span></nav>
    <div class="designer" data-view="edit">
      <div class="designer-head">
        <div>
          <p class="eyebrow">${esc(occasion ? occasion.name : "Greeting card")}${isBundle ? " · 2-card set" : ""}</p>
          <h1>${esc(template.name)}</h1>
          <p class="desc">${esc(template.description)}</p>
        </div>
        <p class="designer-price">${esc(priceLabel(template, business))}</p>
      </div>
      ${sharedNotice ? `<div class="notice"><p>You opened a shared design. Any changes you make are saved only on this device and don't affect the person who shared it.</p></div>` : ""}

      <div class="mobile-switch" role="group" aria-label="Designer view">
        <button type="button" data-view="edit" aria-pressed="true">Edit</button>
        <button type="button" data-view="preview" aria-pressed="false">Preview</button>
      </div>

      <div class="designer-grid">
        <section class="preview-pane" aria-label="Card preview">
          ${isBundle ? `<div class="face-tabs" role="tablist" aria-label="Card in this set">${template.faces.map((f, i) => `<button type="button" class="btn btn-sm ${i ? "btn-ghost" : "btn-secondary"}" role="tab" aria-selected="${!i}" data-face="${esc(f.id)}">${esc(f.label)}</button>`).join("")}</div>` : ""}
          <div class="preview-stage"><canvas id="preview" role="img" aria-label="Live preview of your personalised card"></canvas></div>
          <div id="fit-notice" aria-live="polite"></div>
          <p class="preview-meta">Live preview. The faint “preview” mark is not printed on your final card. Your finished ${isBundle ? "cards are" : "card is"} produced from exactly these settings.</p>
        </section>

        <section class="editor-pane" aria-label="Personalise your card">
          <form id="editor" class="panel" novalidate>
            <div class="editor-section">
              <h2>Your words</h2>
              ${groups.map(g => `${g.title ? `<h3 class="eyebrow" style="margin-top:18px">${esc(g.title)}</h3>` : ""}${g.fields.map(fieldHtml).join("")}`).join("")}
            </div>
            <div class="editor-section">
              <h2>Style</h2>
              ${template.faces.map(paletteHtml).join("")}
              ${fontHtml()}
              <fieldset>
                <legend class="label">Text colour</legend>
                <div class="swatches" id="ink-swatches"></div>
              </fieldset>
              <fieldset>
                <legend class="label">Alignment</legend>
                <div class="segmented">
                  ${["left", "center", "right"].map(a => `<label><input type="radio" name="align" value="${a}" ${state.design.align === a ? "checked" : ""}><span>${a[0].toUpperCase() + a.slice(1)}</span></label>`).join("")}
                </div>
              </fieldset>
              <div class="field">
                <label for="size">Text size <output id="size-out" for="size">${state.design.size}%</output></label>
                <input class="range" id="size" name="size" type="range" min="${catalog.sizeRange.min}" max="${catalog.sizeRange.max}" step="${catalog.sizeRange.step}" value="${state.design.size}">
                <p class="hint">Very long messages are automatically set a little smaller so they always fit.</p>
              </div>
            </div>
            <div class="editor-section">
              <h2>Format</h2>
              <div class="option-cards" role="radiogroup" aria-label="Card format">
                ${formats.map(fm => `
                  <label class="option-card">
                    <input type="radio" name="format" value="${esc(fm.id)}" ${state.formatId === fm.id ? "checked" : ""}>
                    <span><strong>${esc(fm.name)}</strong><small>${esc(fm.description)}</small></span>
                    <span class="price">${fm.priceAdjustment ? "+ " + esc(money(fm.priceAdjustment, business)) : "Included"}</span>
                  </label>`).join("")}
              </div>
              <div class="total-line"><span>Total</span><strong id="total"></strong></div>
              <p class="hint">No delivery fees or hidden charges. Standard M-PESA charges apply when you pay.</p>
            </div>
            <div class="editor-actions">
              <button type="submit" class="btn btn-primary btn-block desktop-only">Continue to order ${ICONS.arrow}</button>
              <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${waLink(business.whatsapp.number, designEnquiryMessage(business, template.name, occasion?.name))}">${ICONS.whatsapp} Ask about this design</a>
            </div>
            <div class="editor-tools">
              <button type="button" class="link-btn" id="reset">Reset to original</button>
              <button type="button" class="link-btn" id="share">Copy share link</button>
              <a href="shop.html">Choose a different design</a>
            </div>
            <p class="hint">Your work is saved on this device as you type, so you can come back to it later.</p>
          </form>
        </section>
      </div>
    </div>
    <div class="sticky-bar">
      <p class="total mt-0"><span id="total-mobile"></span><small id="format-mobile"></small></p>
      <button type="button" class="btn btn-primary" id="continue-mobile">Continue ${ICONS.arrow}</button>
    </div>`;
  document.body.classList.add("has-sticky-bar");

  const form = $("#editor");
  const canvas = $("#preview");

  // ----- rendering -----
  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }
  function draw() {
    const stage = canvas.parentElement;
    const cssW = Math.min(canvas.clientWidth || stage.clientWidth - 48, 420);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    lastRender = renderFace(canvas, { catalog, template, faceId: activeFace, values: state.values, design: state.design, width: Math.max(320, cssW * dpr), preview: true });
    // Check every face for overflow, not just the visible one.
    const problems = template.faces.map(face => {
      if (face.id === activeFace) return { face, ...lastRender };
      const c = document.createElement("canvas");
      return { face, ...renderFace(c, { catalog, template, faceId: face.id, values: state.values, design: state.design, width: 300, preview: true }) };
    });
    const overflow = problems.filter(p => p.overflow);
    const notice = $("#fit-notice");
    if (overflow.length) {
      notice.innerHTML = `<div class="notice notice-warn"><p>Your text is too long to fit${isBundle ? ` on the ${overflow.map(p => esc(p.face.label)).join(" and ")}` : ""}. Please shorten your message so nothing gets cut off.</p></div>`;
    } else if (problems.some(p => p.scale < 0.72)) {
      notice.innerHTML = `<div class="notice"><p>We've made the lettering smaller to fit your message. A slightly shorter message will read more comfortably.</p></div>`;
    } else notice.innerHTML = "";
    state.overflow = overflow.length > 0;
  }

  function updateInks() {
    const palettes = template.faces.map(face => resolvePalette(catalog, face, state.design));
    const options = textColorOptions(catalog, palettes[0]).map((opt, i) => ({
      ...opt,
      ok: palettes.every(p => textColorOptions(catalog, p)[i].ok),
      colors: palettes.map(p => textColorOptions(catalog, p)[i].color),
    }));
    if (!options.find(o => o.id === state.design.ink)?.ok) state.design.ink = "ink";
    $("#ink-swatches").innerHTML = options.map(o => `
      <label class="swatch" ${o.ok ? "" : 'title="Not enough contrast with this background"'}>
        <input type="radio" name="ink" value="${esc(o.id)}" ${state.design.ink === o.id ? "checked" : ""} ${o.ok ? "" : "disabled"}>
        <span><i style="background:${o.colors[0]}"></i>${esc(o.label)}${o.ok ? "" : '<span class="visually-hidden"> (unavailable: low contrast)</span>'}</span>
      </label>`).join("");
  }

  function updateTotal() {
    const q = quote(template, state.formatId, business);
    $("#total").textContent = money(q.total, business);
    $("#total-mobile").textContent = money(q.total, business);
    $("#format-mobile").textContent = q.format.name;
  }

  function updateChips() {
    $$("[data-suggest]").forEach(chip => chip.setAttribute("aria-pressed", String((state.values[chip.dataset.suggest] || "").trim() === chip.dataset.text)));
  }

  let saveTimer;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      drafts.save(template.id, { values: state.values, design: state.design, formatId: state.formatId });
      const shared = drafts.getShared();
      if ("recipient" in state.values) shared.recipient = state.values.recipient;
      if ("sender" in state.values) shared.sender = state.values.sender;
      drafts.saveShared(shared);
    }, 350);
  }

  function setFieldError(key, message) {
    const wrap = form.querySelector(`[data-field="${CSS.escape(key)}"]`);
    if (!wrap) return;
    wrap.classList.toggle("has-error", Boolean(message));
    wrap.querySelector(".error-text").textContent = message || "";
    wrap.querySelector("input, textarea").setAttribute("aria-invalid", message ? "true" : "false");
  }

  // ----- events -----
  form.addEventListener("input", e => {
    const t = e.target;
    const field = template.fields.find(f => f.key === t.name);
    if (field) {
      state.values[field.key] = t.value;
      const counter = form.querySelector(`[data-counter="${CSS.escape(field.key)}"]`);
      counter.textContent = `${t.value.length}/${field.maxLength}`;
      counter.classList.toggle("is-near", t.value.length > field.maxLength * 0.9);
      if (t.closest(".has-error") && t.value.trim()) setFieldError(field.key, "");
      updateChips();
    } else if (t.name === "size") {
      state.design.size = Number(t.value);
      $("#size-out").textContent = `${t.value}%`;
    }
    schedule(); persist();
  });

  form.addEventListener("change", e => {
    const t = e.target;
    if (t.name.startsWith("palette-")) { state.design.palettes[t.name.slice(8)] = t.value; updateInks(); }
    else if (t.name === "font") state.design.font = t.value;
    else if (t.name === "ink") state.design.ink = t.value;
    else if (t.name === "align") state.design.align = t.value;
    else if (t.name === "format") { state.formatId = t.value; updateTotal(); }
    else return;
    if (t.name.startsWith("palette-") && isBundle) showFace(t.name.slice(8));
    schedule(); persist();
  });

  form.addEventListener("click", e => {
    const chip = e.target.closest("[data-suggest]");
    if (!chip) return;
    const key = chip.dataset.suggest;
    const input = form.querySelector(`[name="${CSS.escape(key)}"]`);
    input.value = chip.dataset.text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const face = template.fields.find(f => f.key === key)?.face;
    if (face) showFace(face);
  });

  // Typing in a face's fields shows that face in the preview.
  form.addEventListener("focusin", e => {
    const face = template.fields.find(f => f.key === e.target.name)?.face;
    if (face && face !== activeFace) showFace(face);
  });

  function showFace(id) {
    activeFace = id;
    $$(".face-tabs [data-face]").forEach(b => {
      const on = b.dataset.face === id;
      b.setAttribute("aria-selected", String(on));
      b.classList.toggle("btn-secondary", on);
      b.classList.toggle("btn-ghost", !on);
    });
    schedule();
  }
  $$(".face-tabs [data-face]").forEach(b => b.addEventListener("click", () => showFace(b.dataset.face)));

  const designer = $(".designer");
  function setView(view) {
    designer.dataset.view = view;
    $$(".mobile-switch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    if (view === "preview") schedule();
  }
  $$(".mobile-switch button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  function proceed() {
    const errors = validateFields(template, state.values);
    for (const f of template.fields) setFieldError(f.key, errors[f.key]);
    const first = template.fields.find(f => errors[f.key]);
    if (first) {
      setView("edit");
      const el = form.querySelector(`[name="${CSS.escape(first.key)}"]`);
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      toast("Please fill in the highlighted fields first.", "error");
      return;
    }
    if (state.overflow) {
      setView("preview");
      toast("Your message is too long to fit. Please shorten it first.", "error");
      return;
    }
    clearTimeout(saveTimer);
    drafts.save(template.id, { values: state.values, design: state.design, formatId: state.formatId });
    checkout.set({ templateId: template.id, values: state.values, design: state.design, formatId: state.formatId });
    location.href = "checkout.html";
  }
  form.addEventListener("submit", e => { e.preventDefault(); proceed(); });
  $("#continue-mobile").addEventListener("click", proceed);

  $("#reset").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Reset this card?",
      body: "This clears your words and style choices for this design and restores the original. This can't be undone.",
      confirmLabel: "Reset card",
      danger: true,
    });
    if (!ok) return;
    drafts.clear(template.id);
    const fresh = defaultsFor(template);
    for (const f of template.fields) fresh.values[f.key] = f.default || "";
    state = { ...fresh, formatId: state.formatId };
    for (const f of template.fields) {
      const el = form.querySelector(`[name="${CSS.escape(f.key)}"]`);
      el.value = state.values[f.key];
      form.querySelector(`[data-counter="${CSS.escape(f.key)}"]`).textContent = `${el.value.length}/${f.maxLength}`;
      setFieldError(f.key, "");
    }
    form.querySelector(`[name="font"][value="${CSS.escape(state.design.font)}"]`).checked = true;
    form.querySelector(`[name="align"][value="${CSS.escape(state.design.align)}"]`).checked = true;
    for (const face of template.faces) { const r = form.querySelector(`[name="palette-${CSS.escape(face.id)}"][value="${CSS.escape(state.design.palettes[face.id])}"]`); if (r) r.checked = true; }
    $("#size").value = state.design.size;
    $("#size-out").textContent = `${state.design.size}%`;
    updateInks(); updateChips(); schedule();
    toast("Card reset to the original design.");
  });

  $("#share").addEventListener("click", async () => {
    const url = new URL(`customize.html?t=${encodeURIComponent(template.id)}#d=${encodeShare(state)}`, location.href).href;
    if (await copyText(url)) toast("Share link copied. It contains your card's words, so only share it with people you trust.", "success");
    else {
      await confirmDialog({ title: "Copy this link", body: url, confirmLabel: "Done", cancelLabel: "Close" });
    }
  });

  window.addEventListener("resize", schedule);
  updateInks(); updateTotal(); updateChips(); draw();
  cardFontsReady(catalog).then(schedule);
}
