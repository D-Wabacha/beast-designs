import { initPage, paintWithFonts, esc, $, $$, toast, cardFontsReady, ICONS } from "../ui.js";
import { findTemplate, primaryOccasion, enabledFormats, quote, money } from "../data.js";
import { renderFace } from "../card/render.js";
import { normalizeKenyanPhone, isEmail, validateFields } from "../validate.js";
import { checkout, drafts, myOrders, customerDetails } from "../store.js";
import { api } from "../api.js";
import { waLink, unsavedOrderMessage } from "../whatsapp.js";

const data = await initPage("checkout");
const { catalog, business } = data;
const app = $("#app");

const pending = checkout.get();
const template = pending && findTemplate(data, pending.templateId);

if (!template) {
  app.innerHTML = `
    <div class="empty-state" style="margin-top:32px">
      <h1>There's nothing to check out yet</h1>
      <p>Choose a design and personalise it first. Your card will appear here when you're ready to order.</p>
      <div class="empty-actions"><a class="btn btn-primary" href="shop.html">Browse designs</a></div>
    </div>`;
} else {
  render();
}

function render() {
  const occasion = primaryOccasion(data, template);
  const formats = enabledFormats(business);
  const state = {
    values: pending.values || {},
    design: pending.design || {},
    formatId: formats.some(f => f.id === pending.formatId) ? pending.formatId : business.fulfilment.defaultFormat,
  };
  const remembered = customerDetails.get();
  const missing = validateFields(template, state.values);

  const personal = template.fields
    .map(f => ({ f, v: (state.values[f.key] ?? f.default ?? "").trim() }))
    .filter(x => x.v)
    .map(x => `<dt>${esc(x.f.label)}</dt><dd>${esc(x.v)}</dd>`).join("");

  app.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="customize.html?t=${esc(template.id)}">${ICONS.back.replace('class="icon"', 'class="icon" style="display:inline;vertical-align:-3px"')} Back to editing</a></nav>
    <header class="page-head" style="padding-top:8px">
      <p class="eyebrow">Checkout</p>
      <h1>Review and place your order</h1>
      <p>Check your card, add your contact details, and we'll give you an order reference and payment instructions. You won't be charged anything on this page.</p>
    </header>
    ${Object.keys(missing).length ? `<div class="notice notice-error"><p>Some required card details are missing. <a href="customize.html?t=${esc(template.id)}">Go back and complete your card</a>.</p></div>` : ""}
    <div class="checkout-grid">
      <form id="order-form" class="panel" novalidate>
        <h2>Your details</h2>
        <p class="muted small">We only use these to process your order and contact you about it. See our <a href="privacy.html">privacy notice</a>.</p>
        <div class="field" data-field="name">
          <label for="c-name">Your name</label>
          <input class="input" id="c-name" name="name" autocomplete="name" maxlength="60" required value="${esc(remembered?.name || "")}" aria-describedby="c-name-err">
          <p class="error-text" id="c-name-err"></p>
        </div>
        <div class="field" data-field="phone">
          <label for="c-phone">Phone number (WhatsApp if possible)</label>
          <input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" required placeholder="e.g. 0712 345 678" value="${esc(remembered?.phone || "")}" aria-describedby="c-phone-hint c-phone-err">
          <p class="hint" id="c-phone-hint">Kenyan Safaricom or Airtel number. We'll contact you here about your order.</p>
          <p class="error-text" id="c-phone-err"></p>
        </div>
        <div class="field" data-field="email">
          <label for="c-email">Email <span class="opt">(optional)</span></label>
          <input class="input" id="c-email" name="email" type="email" autocomplete="email" maxlength="120" value="${esc(remembered?.email || "")}" aria-describedby="c-email-err">
          <p class="error-text" id="c-email-err"></p>
        </div>

        <fieldset>
          <legend class="label">Format</legend>
          <div class="option-cards">
            ${formats.map(fm => `
              <label class="option-card">
                <input type="radio" name="format" value="${esc(fm.id)}" ${state.formatId === fm.id ? "checked" : ""}>
                <span><strong>${esc(fm.name)}</strong><small>${esc(fm.description)}</small></span>
                <span class="price">${fm.priceAdjustment ? "+ " + esc(money(fm.priceAdjustment, business)) : "Included"}</span>
              </label>`).join("")}
          </div>
        </fieldset>

        <fieldset>
          <legend class="label">How would you like to receive it?</legend>
          <div class="option-cards">
            ${business.fulfilment.channels.map((ch, i) => `
              <label class="option-card"><input type="radio" name="channel" value="${esc(ch.id)}" ${i === 0 ? "checked" : ""}><span><strong>${esc(ch.label)}</strong></span></label>`).join("")}
          </div>
          <p class="hint">Digital delivery only. We don't print or deliver physical cards at the moment.</p>
        </fieldset>

        <div class="field" data-field="notes">
          <label for="c-notes">Notes for us <span class="opt">(optional)</span></label>
          <textarea class="textarea" id="c-notes" name="notes" maxlength="${business.orders.maxNotesLength}" rows="3" placeholder="e.g. Please send it before Friday evening" aria-describedby="c-notes-err"></textarea>
          <p class="error-text" id="c-notes-err"></p>
        </div>

        <div class="field" data-field="consent">
          <label class="check"><input type="checkbox" name="consent" required aria-describedby="c-consent-err"> <span>I understand my details and card message will be used to make and deliver this order, as described in the <a href="privacy.html" target="_blank">privacy notice</a>.</span></label>
          <p class="error-text" id="c-consent-err"></p>
        </div>
        <label class="check small" style="margin-bottom:18px"><input type="checkbox" name="remember" ${remembered ? "checked" : ""}> <span>Remember my name, phone and email on this device</span></label>

        <div id="submit-error" aria-live="assertive"></div>
        <button type="submit" class="btn btn-primary btn-block" id="place-order">Place order · <span data-total></span></button>
        <p class="hint" style="justify-content:center;margin-top:10px">Next, you'll get your order reference and M-PESA payment instructions.</p>
      </form>

      <aside class="summary panel" aria-labelledby="summary-title">
        <h2 id="summary-title">Order summary</h2>
        <div class="summary-card ${template.kind === "bundle" ? "is-bundle" : ""}">
          <div class="summary-thumbs">${template.faces.map(f => `<canvas data-face="${esc(f.id)}" role="img" aria-label="Your ${esc(template.kind === "bundle" ? f.label : "card")} preview"></canvas>`).join("")}</div>
          <div>
            <p class="eyebrow mt-0" style="margin-bottom:2px">${esc(occasion ? occasion.name : "")}</p>
            <h3 class="mt-0">${esc(template.name)}</h3>
            <p class="small muted mt-0" id="format-name"></p>
            <a class="small" href="customize.html?t=${esc(template.id)}">Edit card</a>
          </div>
        </div>
        <details style="margin-top:14px" open>
          <summary class="small"><strong>Your personalisation</strong></summary>
          <dl class="kv" style="margin-top:10px">${personal}</dl>
        </details>
        <table class="price-table" aria-label="Price breakdown">
          <tr><td>${esc(template.name)}${template.kind === "bundle" ? ` (${template.faces.length} cards)` : ""}</td><td>${esc(money(template.price.amount, business))}</td></tr>
          <tr><td id="fmt-row"></td><td id="fmt-price"></td></tr>
          <tr class="total"><td>Total</td><td data-total></td></tr>
        </table>
        <p class="hint">No delivery fees or hidden charges. Standard M-PESA charges set by Safaricom apply when you pay.</p>
      </aside>
    </div>`;

  paintWithFonts(catalog, () => {
    $$(".summary-thumbs canvas").forEach(c => renderFace(c, { catalog, template, faceId: c.dataset.face, values: state.values, design: state.design, width: 260, preview: true }));
  });

  const form = $("#order-form");
  const ctl = n => form.elements.namedItem(n);
  function updatePrice() {
    const q = quote(template, state.formatId, business);
    $$("[data-total]").forEach(el => { el.textContent = money(q.total, business); });
    $("#fmt-row").textContent = q.format.name;
    $("#fmt-price").textContent = q.adjustment ? money(q.adjustment, business) : "Included";
    $("#format-name").textContent = q.format.name;
  }
  updatePrice();

  form.addEventListener("change", e => {
    if (e.target.name === "format") {
      state.formatId = e.target.value;
      updatePrice();
      checkout.set({ ...pending, formatId: state.formatId });
    }
  });

  function setError(name, msg) {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    if (!wrap) return;
    wrap.classList.toggle("has-error", Boolean(msg));
    wrap.querySelector(".error-text").textContent = msg || "";
    const input = wrap.querySelector("input, textarea");
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  form.addEventListener("input", e => { if (e.target.closest(".has-error")) setError(e.target.name, ""); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    $("#submit-error").innerHTML = "";
    const name = ctl("name").value.trim();
    const phone = normalizeKenyanPhone(ctl("phone").value);
    const email = ctl("email").value.trim();
    const notes = ctl("notes").value.trim();
    const errors = {};
    if (name.length < 2) errors.name = "Please enter your name.";
    if (!phone) errors.phone = "Please enter a valid Kenyan mobile number, e.g. 0712 345 678.";
    if (email && !isEmail(email)) errors.email = "That email address doesn't look right.";
    if (!ctl("consent").checked) errors.consent = "Please confirm you've read how we use your details.";
    for (const key of ["name", "phone", "email", "consent"]) setError(key, errors[key]);
    if (Object.keys(missing).length) errors.card = true;
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      if (firstKey === "card") toast("Please complete your card before ordering.", "error");
      else form.querySelector(`[name="${firstKey}"]`).focus();
      return;
    }

    if (ctl("remember").checked) customerDetails.set({ name, phone: ctl("phone").value.trim(), email });
    else customerDetails.set(null);

    const btn = $("#place-order");
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    try {
      const res = await api("/api/orders", {
        method: "POST",
        body: {
          templateId: template.id,
          formatId: state.formatId,
          values: state.values,
          design: state.design,
          customer: { name, phone, email },
          channel: ctl("channel").value,
          notes,
          consent: true,
        },
      });
      myOrders.add({ reference: res.reference, key: res.accessKey, total: res.total, templateName: template.name, createdAt: res.createdAt });
      checkout.clear();
      drafts.clear(template.id);
      location.href = `order.html?ref=${encodeURIComponent(res.reference)}&key=${encodeURIComponent(res.accessKey)}&new=1`;
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
      if (err.fields) for (const [k, msg] of Object.entries(err.fields)) setError(k, msg);
      const q = quote(template, state.formatId, business);
      const wa = waLink(business.whatsapp.number, unsavedOrderMessage(business, state, template, occasion?.name, { name }, q.format.name, q.total));
      const offline = !err.status || err.status >= 500;
      $("#submit-error").innerHTML = `
        <div class="notice notice-error" style="margin-bottom:14px">
          <div>
            <p><strong>Your order wasn't placed.</strong> ${esc(err.message)}</p>
            ${offline ? `<p style="margin-top:8px">You can try again, or send your card details to us on WhatsApp instead. That opens WhatsApp with your details filled in. It doesn't create an order on our system until we reply to confirm.</p>
            <p style="margin-top:8px"><a class="btn btn-wa btn-sm" href="${wa}" target="_blank" rel="noopener">${ICONS.whatsapp} Send details on WhatsApp</a></p>` : ""}
          </div>
        </div>`;
      $("#submit-error").scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}
