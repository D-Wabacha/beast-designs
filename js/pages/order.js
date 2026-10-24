import { initPage, paintWithFonts, esc, $, $$, toast, copyText, cardFontsReady, ICONS } from "../ui.js";
import { findTemplate, findOccasion, money, formatDate, STATUS_LABELS, STATUS_HELP, DOWNLOADABLE_STATUSES } from "../data.js";
import { renderFace, exportFace, downloadBlob } from "../card/render.js";
import { normalizeKenyanPhone, normalizeMpesaCode, isMpesaCode } from "../validate.js";
import { myOrders } from "../store.js";
import { api } from "../api.js";
import { waLink, orderMessage, enquiryMessage } from "../whatsapp.js";

const data = await initPage("order");
const { catalog, business } = data;
const app = $("#app");
const params = new URLSearchParams(location.search);
const ref = (params.get("ref") || "").trim().toUpperCase();
const key = params.get("key") || "";

if (ref && key) loadOrder();
else renderLookup();

function renderLookup(message) {
  const local = myOrders.list();
  app.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">My order</p>
      <h1>Check on your order</h1>
      <p>Enter your order reference and the phone number you used when ordering. Your reference looks like <strong>${esc(business.orders.referencePrefix)}-7K2Q9M</strong>.</p>
    </header>
    <div class="split">
      <form class="panel" id="lookup" novalidate>
        ${message ? `<div class="notice notice-error" style="margin-bottom:16px"><p>${esc(message)}</p></div>` : ""}
        <div class="field" data-field="ref">
          <label for="l-ref">Order reference</label>
          <input class="input" id="l-ref" name="ref" autocomplete="off" autocapitalize="characters" maxlength="20" value="${esc(ref)}" required aria-describedby="l-ref-err">
          <p class="error-text" id="l-ref-err"></p>
        </div>
        <div class="field" data-field="phone">
          <label for="l-phone">Phone number used for the order</label>
          <input class="input" id="l-phone" name="phone" type="tel" inputmode="tel" maxlength="20" required aria-describedby="l-phone-err">
          <p class="error-text" id="l-phone-err"></p>
        </div>
        <div id="lookup-error" aria-live="assertive"></div>
        <button class="btn btn-primary btn-block" type="submit">Find my order</button>
      </form>
      <div>
        ${local.length ? `
          <div class="panel">
            <h2>Orders placed on this device</h2>
            <p class="small muted">Saved in this browser for convenience. Your orders themselves are stored securely on our system.</p>
            <ul class="footer-list" style="margin-top:10px">
              ${local.map(o => `<li><a href="order.html?ref=${encodeURIComponent(o.reference)}&key=${encodeURIComponent(o.key)}"><strong>${esc(o.reference)}</strong></a> · ${esc(o.templateName || "")} · ${esc(money(o.total, business))}${o.createdAt ? ` · <span class="muted">${esc(formatDate(o.createdAt))}</span>` : ""}</li>`).join("")}
            </ul>
          </div>` : ""}
        <div class="panel">
          <h2>Can't find your reference?</h2>
          <p class="muted">Message us with your name and the card you ordered and we'll look it up for you.</p>
          <a class="btn btn-wa" href="${waLink(business.whatsapp.number, enquiryMessage(business, "I'd like to check on my order, but I can't find my order reference."))}" target="_blank" rel="noopener">${ICONS.whatsapp} Ask on WhatsApp</a>
        </div>
      </div>
    </div>`;

  const form = $("#lookup");
  const setErr = (name, msg) => {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    wrap.classList.toggle("has-error", Boolean(msg));
    wrap.querySelector(".error-text").textContent = msg || "";
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const r = form.elements.namedItem("ref").value.trim().toUpperCase();
    const phone = normalizeKenyanPhone(form.elements.namedItem("phone").value);
    setErr("ref", /^[A-Z]{2,5}-[A-Z0-9]{6}$/.test(r) ? "" : "Please enter the reference exactly as shown, e.g. LCK-7K2Q9M.");
    setErr("phone", phone ? "" : "Please enter a valid Kenyan mobile number.");
    if (!/^[A-Z]{2,5}-[A-Z0-9]{6}$/.test(r) || !phone) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.classList.add("is-loading");
    try {
      const res = await api("/api/orders/lookup", { method: "POST", body: { reference: r, phone } });
      location.href = `order.html?ref=${encodeURIComponent(res.reference)}&key=${encodeURIComponent(res.accessKey)}`;
    } catch (err) {
      btn.disabled = false; btn.classList.remove("is-loading");
      $("#lookup-error").innerHTML = `<div class="notice notice-error" style="margin-bottom:14px"><p>${esc(err.message)}</p></div>`;
    }
  });
}

async function loadOrder() {
  try {
    const order = await api(`/api/orders/${encodeURIComponent(ref)}?key=${encodeURIComponent(key)}`);
    renderOrder(order);
  } catch (err) {
    if (err.status === 404 || err.status === 403) renderLookup("We couldn't open that order link. Please look it up with your reference and phone number.");
    else app.innerHTML = `
      <div class="empty-state" style="margin-top:32px">
        <h1>We couldn't load your order</h1>
        <p>${esc(err.message)}</p>
        <div class="empty-actions"><button class="btn btn-primary" type="button" id="retry">Try again</button>
        <a class="btn btn-wa" href="${waLink(business.whatsapp.number, enquiryMessage(business, `I'm checking on order ${ref}.`))}" target="_blank" rel="noopener">${ICONS.whatsapp} Ask on WhatsApp</a></div>
      </div>`;
    $("#retry")?.addEventListener("click", () => location.reload());
  }
}

const TIMELINE = [
  { id: "placed", label: "Order placed" },
  { id: "verification_pending", label: "M-PESA code shared" },
  { id: "paid", label: "Payment confirmed by us" },
  { id: "ready", label: "Card ready" },
  { id: "completed", label: "Completed" },
];
const RANK = { awaiting_payment: 0, verification_pending: 1, paid: 2, ready: 3, completed: 4 };

function renderOrder(order) {
  const template = findTemplate(data, order.templateId);
  const occasion = template ? findOccasion(data, template.occasions[0]) : null;
  const status = order.status;
  const canPay = status === "awaiting_payment" || status === "verification_pending";
  const downloadable = DOWNLOADABLE_STATUSES.includes(status);
  const isNew = params.get("new") === "1";
  const message = orderMessage(business, order, template, occasion?.name);
  const historyAt = s => order.history.find(h => h.status === s)?.at;

  myOrders.add({ reference: order.reference, key, total: order.total, templateName: order.templateName, createdAt: order.createdAt });

  const rank = RANK[status] ?? -1;
  const timeline = status === "cancelled"
    ? `<li class="is-current">Cancelled<small>${esc(formatDate(historyAt("cancelled") || order.updatedAt))}</small></li>`
    : TIMELINE.map((step, i) => {
        const cls = i < rank ? "is-done" : i === rank ? (i === 0 ? "is-done" : "is-current") : "";
        const at = i === 0 ? order.createdAt : historyAt(step.id);
        return `<li class="${cls}">${esc(step.label)}${at && i <= rank ? `<small>${esc(formatDate(at))}</small>` : ""}</li>`;
      }).join("");

  const routes = business.payment.routes;
  const amount = money(order.total, business);
  const fill = s => s.replace("{number}", business.payment.number).replace("{amount}", amount);

  app.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">${isNew ? "Order received" : "Your order"}</p>
      <h1>${isNew ? "Thank you, your order is saved" : "Order " + esc(order.reference)}</h1>
      ${isNew ? `<p>We've saved your order on our system. <strong>It isn't paid yet.</strong> Follow the payment steps below, then share your M-PESA code so we can verify it.</p>` : ""}
    </header>

    <div class="ref-box">
      <div>
        <p class="small muted mt-0" style="margin:0">Order reference</p>
        <p class="ref-code mt-0" style="margin:0">${esc(order.reference)}</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="copy-ref">${ICONS.copy} Copy</button>
      <span class="status-pill status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>
      <button type="button" class="btn btn-sm btn-ghost" id="refresh" style="margin-left:auto">Refresh status</button>
    </div>
    ${isNew ? "" : `<p class="muted" style="margin-top:12px">${esc(STATUS_HELP[status] || "")}</p>`}
    <p class="small muted">Bookmark this page to come back to it. Anyone with this link can see your order, so don't share it publicly.</p>

    <div class="checkout-grid" style="margin-top:20px">
      <div>
        ${canPay ? `
        <section class="panel" aria-labelledby="pay-title" id="pay">
          <p class="eyebrow">Step 1 · Pay</p>
          <h2 id="pay-title">Pay ${esc(amount)} via ${esc(business.payment.methodName)}</h2>
          <dl class="kv" style="font-size:1rem">
            <dt>Number</dt><dd><span class="pay-number">${esc(business.payment.number)}</span>${business.payment.accountName ? ` <span class="muted">(${esc(business.payment.accountName)})</span>` : ""}</dd>
            <dt>Amount</dt><dd><strong>${esc(amount)}</strong></dd>
            <dt>Reference</dt><dd>${esc(order.reference)} <span class="muted small">(share with us after paying)</span></dd>
          </dl>
          <div class="pay-routes">
            <div class="tabs" role="tablist" aria-label="Ways to pay">
              ${routes.map((r, i) => `<button type="button" class="tab" role="tab" id="tab-${esc(r.id)}" aria-controls="panel-${esc(r.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(r.label)}</button>`).join("")}
            </div>
            ${routes.map((r, i) => `<div class="tabpanel" role="tabpanel" id="panel-${esc(r.id)}" aria-labelledby="tab-${esc(r.id)}" ${i ? "hidden" : ""}><ol>${r.steps.map(s => `<li>${esc(fill(s))}</li>`).join("")}</ol></div>`).join("")}
          </div>
          <div style="margin-top:16px">${business.payment.notes.map(n => `<div class="notice"><p>${esc(n)}</p></div>`).join("")}</div>
        </section>

        <section class="panel" aria-labelledby="code-title">
          <p class="eyebrow">Step 2 · Tell us you've paid</p>
          <h2 id="code-title">Share your M-PESA confirmation code</h2>
          ${order.payment?.code ? `<div class="notice notice-success" style="margin-bottom:14px"><p>We received the code <strong>${esc(order.payment.code)}</strong> on ${esc(formatDate(order.payment.submittedAt))}. We're checking it against our M-PESA statement. You don't need to do anything else. If the code was wrong, you can send the correct one below.</p></div>` : ""}
          <form id="claim" novalidate>
            <div class="field" data-field="code">
              <label for="p-code">M-PESA transaction code</label>
              <input class="input" id="p-code" name="code" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="e.g. SJK3ABCD12" required aria-describedby="p-code-hint p-code-err">
              <p class="hint" id="p-code-hint">The 10-character code at the start of your M-PESA confirmation SMS.</p>
              <p class="error-text" id="p-code-err"></p>
            </div>
            <div class="field" data-field="payer">
              <label for="p-payer">Name on the M-PESA payment <span class="opt">(optional)</span></label>
              <input class="input" id="p-payer" name="payer" maxlength="60" autocomplete="name" aria-describedby="p-payer-hint">
              <p class="hint" id="p-payer-hint">Helps us match your payment if someone else paid for you.</p>
            </div>
            <div id="claim-result" aria-live="polite"></div>
            <button class="btn btn-primary" type="submit">Submit code for verification</button>
          </form>
          <p class="hint" style="margin-top:12px">Submitting a code doesn't confirm payment. We confirm it once we've seen the money arrive.</p>
        </section>` : ""}

        <section class="panel" aria-labelledby="wa-title">
          <h2 id="wa-title">Send your order on WhatsApp</h2>
          <p class="muted">This opens WhatsApp with your order details already written. You still need to press send, and the message reaches us only after you do. It's the quickest way to share your M-PESA code or ask about your order.</p>
          <details style="margin-bottom:14px"><summary class="small">See the message</summary><p class="personal-text">${esc(message)}</p></details>
          <a class="btn btn-wa" href="${waLink(business.whatsapp.number, message)}" target="_blank" rel="noopener">${ICONS.whatsapp} Open WhatsApp with my order</a>
        </section>
      </div>

      <aside class="summary">
        <section class="panel" aria-labelledby="card-title">
          <h2 id="card-title">Your card</h2>
          ${template ? `<div class="summary-thumbs" style="justify-content:center;margin-bottom:14px">${template.faces.map(f => `<canvas data-face="${esc(f.id)}" style="width:${template.faces.length > 1 ? "46%" : "60%"}" role="img" aria-label="Preview of your ${esc(template.faces.length > 1 ? f.label : "card")}"></canvas>`).join("")}</div>` : `<p class="muted">This design is no longer in our catalogue. Contact us and we'll help.</p>`}
          <dl class="kv">
            <dt>Design</dt><dd>${esc(order.templateName)}</dd>
            <dt>Format</dt><dd>${esc(order.formatName)}</dd>
            <dt>Delivery</dt><dd>${esc(business.fulfilment.channels.find(c => c.id === order.channel)?.label || order.channel)}</dd>
            <dt>Placed</dt><dd>${esc(formatDate(order.createdAt))}</dd>
          </dl>
          <table class="price-table">
            <tr><td>Card</td><td>${esc(money(order.basePrice, business))}</td></tr>
            <tr><td>${esc(order.formatName)}</td><td>${order.adjustment ? esc(money(order.adjustment, business)) : "Included"}</td></tr>
            <tr class="total"><td>Total</td><td>${esc(amount)}</td></tr>
          </table>
          <div style="margin-top:16px">
            ${downloadable && template
              ? `<button type="button" class="btn btn-primary btn-block" id="download">${ICONS.download} Download your ${template.faces.length > 1 ? "cards" : "card"} (PNG)</button>
                 <p class="hint">${esc(order.exportWidth)} × ${esc(order.exportHeight)} px, generated from your final design.</p>`
              : `<button type="button" class="btn btn-secondary btn-block" disabled aria-describedby="dl-why">${ICONS.download} Download</button>
                 <p class="hint" id="dl-why">${status === "cancelled" ? "Not available for cancelled orders." : "Your full-resolution card becomes available here once we've confirmed payment and marked it ready."}</p>`}
          </div>
        </section>
        <section class="panel">
          <h2>Timeline</h2>
          <ol class="timeline">${timeline}</ol>
        </section>
      </aside>
    </div>`;

  $("#copy-ref").addEventListener("click", async () => toast((await copyText(order.reference)) ? "Reference copied." : `Your reference is ${order.reference}`));
  $("#refresh").addEventListener("click", () => location.reload());

  // Payment route tabs (arrow-key navigable)
  const tabs = $$('.tabs [role="tab"]');
  const select = tab => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      select(next); next.focus();
    });
  });

  if (template) {
    paintWithFonts(catalog, () => {
      $$(".summary-thumbs canvas").forEach(c => renderFace(c, { catalog, template, faceId: c.dataset.face, values: order.values, design: order.design, width: 300, preview: !downloadable }));
    });
  }

  $("#download")?.addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.classList.add("is-loading");
    try {
      await cardFontsReady(catalog);
      for (const face of template.faces) {
        const blob = await exportFace({ catalog, template, faceId: face.id, values: order.values, design: order.design }, order.exportWidth);
        downloadBlob(blob, `${order.reference}${template.faces.length > 1 ? "-" + face.id : ""}.png`);
      }
      toast("Download started.", "success");
    } catch (err) {
      console.error(err);
      toast("We couldn't create the file on this device. Please contact us on WhatsApp and we'll send it to you.", "error");
    } finally {
      btn.disabled = false; btn.classList.remove("is-loading");
    }
  });

  const claim = $("#claim");
  claim?.addEventListener("submit", async e => {
    e.preventDefault();
    const codeInput = claim.elements.namedItem("code");
    const code = normalizeMpesaCode(codeInput.value);
    const wrap = claim.querySelector('[data-field="code"]');
    const err = isMpesaCode(code) ? "" : "M-PESA codes are 10 letters and numbers, e.g. SJK3ABCD12. Please check your SMS.";
    wrap.classList.toggle("has-error", Boolean(err));
    wrap.querySelector(".error-text").textContent = err;
    codeInput.setAttribute("aria-invalid", err ? "true" : "false");
    if (err) { codeInput.focus(); return; }
    const btn = claim.querySelector("button[type=submit]");
    btn.disabled = true; btn.classList.add("is-loading");
    try {
      await api(`/api/orders/${encodeURIComponent(order.reference)}/payment-claim`, {
        method: "POST",
        body: { key, code, payerName: claim.elements.namedItem("payer").value.trim() },
      });
      toast("Code received. We'll verify your payment and update your order.", "success");
      setTimeout(() => location.reload(), 900);
    } catch (e2) {
      btn.disabled = false; btn.classList.remove("is-loading");
      $("#claim-result").innerHTML = `<div class="notice notice-error" style="margin-bottom:12px"><p>${esc(e2.message)}</p></div>`;
    }
  });
}
