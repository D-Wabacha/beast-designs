import { initPage, paintWithFonts, esc, $, $$, toast, confirmDialog, cardFontsReady, ICONS } from "../ui.js";
import { findTemplate, money, formatDate, STATUS_LABELS } from "../data.js";
import { renderFace, exportFace, downloadBlob } from "../card/render.js";
import { displayPhone } from "../validate.js";
import { api } from "../api.js";
import { waLink } from "../whatsapp.js";

const data = await initPage("admin");
const { catalog, business } = data;
const app = $("#app");

const ACTION_LABELS = {
  paid: "Confirm payment received",
  awaiting_payment: "Back to awaiting payment",
  ready: "Mark card ready",
  completed: "Mark completed",
  cancelled: "Cancel order",
};

let filter = "";
let selected = null;

start();

async function start() {
  let session;
  try {
    session = await api("/api/admin/session");
  } catch (err) {
    app.innerHTML = `<div class="empty-state" style="margin-top:32px"><h1>Admin unavailable</h1><p>${esc(err.message)}</p></div>`;
    return;
  }
  if (!session.enabled) {
    app.innerHTML = `
      <div class="empty-state" style="margin-top:32px">
        <h1>Admin is switched off</h1>
        <p>To manage orders, start the server with an admin password, e.g. <code>LCK_ADMIN_PASSWORD='a-long-secret' python3 server.py</code>. See README.md.</p>
      </div>`;
    return;
  }
  if (session.authenticated) renderDashboard();
  else renderLogin();
}

function renderLogin(message) {
  app.innerHTML = `
    <div class="narrow" style="max-width:420px;margin:48px auto">
      <form class="panel" id="login" novalidate>
        <h1 style="font-size:1.6rem">Orders admin</h1>
        <p class="muted small">For ${esc(business.businessName)} staff only.</p>
        ${message ? `<div class="notice notice-error" style="margin-bottom:12px"><p>${esc(message)}</p></div>` : ""}
        <div class="field">
          <label for="pw">Password</label>
          <input class="input" id="pw" name="password" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
      </form>
    </div>`;
  const form = $("#login");
  $("#pw").focus();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button");
    btn.disabled = true; btn.classList.add("is-loading");
    try {
      await api("/api/admin/login", { method: "POST", body: { password: $("#pw").value } });
      renderDashboard();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function renderDashboard() {
  app.innerHTML = `
    <header class="page-head" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:end">
      <div><p class="eyebrow">Admin</p><h1 class="mt-0" style="margin:0">Orders</h1></div>
      <div class="admin-actions"><button class="btn btn-sm btn-ghost" id="reload">Refresh</button><button class="btn btn-sm btn-secondary" id="logout">Sign out</button></div>
    </header>
    <div class="occasion-chips" id="status-filter" role="group" aria-label="Filter by status"></div>
    <div class="admin-layout">
      <ul class="order-list" id="order-list" aria-label="Orders"><li class="loading">Loading orders…</li></ul>
      <section id="detail" class="panel" aria-live="polite"><p class="muted">Select an order to see its details.</p></section>
    </div>`;
  $("#reload").addEventListener("click", () => loadList());
  $("#logout").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: {} }).catch(() => {});
    renderLogin();
  });
  await loadList();
}

async function loadList() {
  let res;
  try {
    res = await api(`/api/admin/orders${filter ? `?status=${filter}` : ""}`);
  } catch (err) {
    if (err.status === 401) return renderLogin("Your session ended. Please sign in again.");
    $("#order-list").innerHTML = `<li class="notice notice-error"><p>${esc(err.message)}</p></li>`;
    return;
  }
  const total = Object.values(res.counts).reduce((a, b) => a + b, 0);
  const statuses = ["verification_pending", "awaiting_payment", "paid", "ready", "completed", "cancelled"];
  $("#status-filter").innerHTML = `<button type="button" class="chip" data-s="" aria-pressed="${!filter}">All (${total})</button>` +
    statuses.map(s => `<button type="button" class="chip" data-s="${s}" aria-pressed="${filter === s}">${esc(STATUS_LABELS[s])} (${res.counts[s] || 0})</button>`).join("");
  $$("#status-filter .chip").forEach(c => c.addEventListener("click", () => { filter = c.dataset.s; loadList(); }));

  $("#order-list").innerHTML = res.orders.length
    ? res.orders.map(o => `
      <li><button type="button" data-ref="${esc(o.reference)}" aria-current="${o.reference === selected}">
        <span class="ref">${esc(o.reference)}</span><span class="status-pill status-${esc(o.status)}">${esc(STATUS_LABELS[o.status])}</span>
        <small>${esc(o.customerName)} · ${esc(o.templateName)} · ${esc(money(o.total, business))}${o.paymentCode ? ` · code ${esc(o.paymentCode)}` : ""}<br>${esc(formatDate(o.createdAt))}</small>
      </button></li>`).join("")
    : `<li style="padding:16px" class="muted">No orders here yet.</li>`;
  $$("#order-list [data-ref]").forEach(b => b.addEventListener("click", () => loadDetail(b.dataset.ref)));
  if (selected) loadDetail(selected, false);
}

async function loadDetail(ref, scroll = true) {
  selected = ref;
  $$("#order-list [data-ref]").forEach(b => b.setAttribute("aria-current", String(b.dataset.ref === ref)));
  const detail = $("#detail");
  try {
    const o = await api(`/api/admin/orders/${encodeURIComponent(ref)}`);
    renderDetail(o);
    if (scroll && window.innerWidth < 1000) detail.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    if (err.status === 401) return renderLogin("Your session ended. Please sign in again.");
    detail.innerHTML = `<div class="notice notice-error"><p>${esc(err.message)}</p></div>`;
  }
}

function customerMessage(o) {
  const first = o.customer.name.split(" ")[0];
  if (o.status === "ready" || o.status === "completed") return `Hello ${first}, your ${business.storefrontName} card (order ${o.reference}) is ready! We've attached it here. Thank you for ordering with ${business.businessName}.`;
  if (o.status === "paid") return `Hello ${first}, we've confirmed your payment of ${business.currency.code} ${o.total} for order ${o.reference}. We're finishing your card now.`;
  if (o.status === "verification_pending") return `Hello ${first}, thanks for your order ${o.reference}. We're checking your M-PESA payment (code ${o.payment?.code || ""}) and will update you shortly.`;
  return `Hello ${first}, thanks for your ${business.storefrontName} order ${o.reference}. To complete it, please pay ${business.currency.code} ${o.total} via ${business.payment.methodName} to ${business.payment.number} and send us the M-PESA code.`;
}

function renderDetail(o) {
  const template = findTemplate(data, o.templateId);
  const detail = $("#detail");
  const personal = template
    ? template.fields.map(f => ({ f, v: (o.values[f.key] || "").trim() })).filter(x => x.v).map(x => `<dt>${esc(x.f.label)}</dt><dd>${esc(x.v)}</dd>`).join("")
    : Object.entries(o.values).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");

  detail.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between">
      <h2 class="mt-0" style="margin:0;letter-spacing:.04em">${esc(o.reference)}</h2>
      <span class="status-pill status-${esc(o.status)}">${esc(STATUS_LABELS[o.status])}</span>
    </div>
    <p class="small muted">Placed ${esc(formatDate(o.createdAt))} · updated ${esc(formatDate(o.updatedAt))}</p>

    ${o.payment ? `
      <div class="notice ${o.duplicatePaymentCodeOn?.length ? "notice-warn" : ""}" style="margin:12px 0">
        <div>
          <p><strong>M-PESA code submitted by customer:</strong> ${esc(o.payment.code)}${o.payment.payerName ? ` · payer name: ${esc(o.payment.payerName)}` : ""} · ${esc(formatDate(o.payment.submittedAt))}</p>
          <p class="small">Check this code and the amount (${esc(money(o.total, business))}) in your M-PESA statement before confirming. A code typed by a customer is not proof of payment.</p>
          ${o.duplicatePaymentCodeOn?.length ? `<p class="small"><strong>Warning:</strong> the same code was also submitted on ${o.duplicatePaymentCodeOn.map(esc).join(", ")}.</p>` : ""}
        </div>
      </div>` : `<div class="notice" style="margin:12px 0"><p>No M-PESA code submitted yet.</p></div>`}

    <div class="admin-actions" style="margin:12px 0 20px">
      ${o.allowedTransitions.map(s => `<button type="button" class="btn btn-sm ${s === "cancelled" ? "btn-ghost" : s === "paid" ? "btn-primary" : "btn-secondary"}" data-status="${s}">${esc(ACTION_LABELS[s] || s)}</button>`).join("") || `<span class="muted small">No further status changes available.</span>`}
    </div>

    <div class="split" style="gap:20px">
      <div>
        <h3>Customer</h3>
        <dl class="kv">
          <dt>Name</dt><dd>${esc(o.customer.name)}</dd>
          <dt>Phone</dt><dd><a href="tel:+${esc(o.customer.phone)}">${esc(displayPhone(o.customer.phone))}</a></dd>
          ${o.customer.email ? `<dt>Email</dt><dd><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></dd>` : ""}
          <dt>Delivery</dt><dd>${esc(business.fulfilment.channels.find(c => c.id === o.channel)?.label || o.channel)}</dd>
        </dl>
        ${o.notes ? `<p class="small" style="margin-top:10px"><strong>Customer notes</strong></p><p class="personal-text">${esc(o.notes)}</p>` : ""}
        <p style="margin-top:12px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${waLink(o.customer.phone, customerMessage(o))}">${ICONS.whatsapp} Message customer</a></p>

        <h3 style="margin-top:20px">Order</h3>
        <dl class="kv">
          <dt>Design</dt><dd>${esc(o.templateName)}</dd>
          <dt>Format</dt><dd>${esc(o.formatName)} (${esc(o.exportWidth)} × ${esc(o.exportHeight)} px)</dd>
          <dt>Price</dt><dd>${esc(money(o.basePrice, business))}${o.adjustment ? ` + ${esc(money(o.adjustment, business))}` : ""} = <strong>${esc(money(o.total, business))}</strong></dd>
        </dl>
        <p class="small" style="margin-top:10px"><strong>Personalisation</strong></p>
        <dl class="kv">${personal}</dl>
      </div>
      <div>
        ${template ? `
          <div class="summary-thumbs" style="justify-content:center">${template.faces.map(f => `<canvas data-face="${esc(f.id)}" style="width:${template.faces.length > 1 ? "48%" : "70%"}" role="img" aria-label="${esc(f.label)}"></canvas>`).join("")}</div>
          <button type="button" class="btn btn-secondary btn-block" id="export" style="margin-top:12px">${ICONS.download} Download final PNG${template.faces.length > 1 ? "s" : ""}</button>
          <p class="hint">Full resolution, no preview mark. Send to the customer once payment is confirmed.</p>` : `<p class="notice notice-warn">This design is no longer in templates.json, so it can't be rendered.</p>`}
        <form id="note-form" style="margin-top:16px">
          <label class="label" for="admin-note"><strong class="small">Internal note</strong></label>
          <textarea class="textarea" id="admin-note" maxlength="1000" rows="3">${esc(o.adminNote || "")}</textarea>
          <button class="btn btn-sm btn-ghost" type="submit">Save note</button>
        </form>
        <h3 style="margin-top:16px">History</h3>
        <ol class="timeline">${o.history.map(h => `<li class="is-done">${esc(STATUS_LABELS[h.status] || h.status)} <span class="muted small">by ${esc(h.actor)}</span><small>${esc(formatDate(h.at))}${h.note ? ` · ${esc(h.note)}` : ""}</small></li>`).join("")}</ol>
      </div>
    </div>`;

  if (template) {
    paintWithFonts(catalog, () => {
      $$("#detail canvas[data-face]").forEach(c => renderFace(c, { catalog, template, faceId: c.dataset.face, values: o.values, design: o.design, width: 360 }));
    });
    $("#export").addEventListener("click", async e => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.classList.add("is-loading");
      try {
        for (const face of template.faces) {
          const blob = await exportFace({ catalog, template, faceId: face.id, values: o.values, design: o.design }, o.exportWidth || 1200);
          downloadBlob(blob, `${o.reference}${template.faces.length > 1 ? "-" + face.id : ""}.png`);
        }
      } catch (err) {
        toast(err.message, "error");
      } finally {
        btn.disabled = false; btn.classList.remove("is-loading");
      }
    });
  }

  $$("#detail [data-status]").forEach(b => b.addEventListener("click", async () => {
    const status = b.dataset.status;
    const prompts = {
      paid: { title: "Confirm payment?", body: `Only continue if you've seen ${money(o.total, business)}${o.payment ? ` with code ${o.payment.code}` : ""} arrive in your ${business.payment.methodName} statement. The customer will see “Payment confirmed”.` },
      cancelled: { title: "Cancel this order?", body: "The customer will see the order as cancelled. You can reopen it later if needed.", danger: true },
      awaiting_payment: { title: "Move back to awaiting payment?", body: "Use this if the submitted code couldn't be matched. Let the customer know on WhatsApp." },
      ready: { title: "Mark card ready?", body: "The customer will be able to download the full-resolution card from their order page." },
      completed: { title: "Mark order completed?", body: "Use this once the card has been delivered." },
    };
    const p = prompts[status] || { title: "Change status?", body: "" };
    const ok = await confirmDialog({ title: p.title, body: p.body, confirmLabel: ACTION_LABELS[status] || "Confirm", danger: p.danger });
    if (!ok) return;
    try {
      const updated = await api(`/api/admin/orders/${encodeURIComponent(o.reference)}/status`, { method: "POST", body: { status } });
      toast(`Order ${o.reference}: ${STATUS_LABELS[updated.status]}`, "success");
      loadList();
    } catch (err) {
      toast(err.message, "error");
    }
  }));

  $("#note-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await api(`/api/admin/orders/${encodeURIComponent(o.reference)}/note`, { method: "POST", body: { note: $("#admin-note").value } });
      toast("Note saved.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}
