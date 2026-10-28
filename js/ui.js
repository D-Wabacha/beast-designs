// Shared page chrome (header, footer, floating WhatsApp button) and small UI utilities.
import { loadData, money, priceLabel, primaryOccasion } from "./data.js";
import { waLink, enquiryMessage } from "./whatsapp.js";
import { renderFace, loadCardFonts } from "./card/render.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICONS = {
  whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="currentColor" d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.2 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.4Z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 7.7 7.7l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-5-5 5 5-5 5"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M19 12H5m5-5-5 5 5 5"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="m6 6 12 12M18 6 6 18"/></svg>`,
  download: `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>`,
};

// Gold crown from the BeasT Designs logo. `id` keeps gradient/mask ids unique when it appears twice on a page.
function crownSvg(id) {
  return `<svg class="brand-crown" viewBox="0 0 120 72" aria-hidden="true">
  <defs>
    <linearGradient id="gold-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc8f"/><stop offset=".4" stop-color="#d9b45c"/><stop offset=".65" stop-color="#a97c32"/><stop offset="1" stop-color="#e2c271"/></linearGradient>
    <mask id="cut-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="72">
      <rect width="120" height="72" fill="#fff"/>
      <circle cx="42" cy="47" r="1.8"/><circle cx="51" cy="45.6" r="1.8"/><circle cx="60" cy="45.2" r="2.2"/><circle cx="69" cy="45.6" r="1.8"/><circle cx="78" cy="47" r="1.8"/>
      <path d="M60 22c3 4 3 8 0 12-3-4-3-8 0-12Z"/>
    </mask>
  </defs>
  <g fill="url(#gold-${id})">
    <path mask="url(#cut-${id})" d="M25 55 11 22l19 18 5-12 12 11 13-25 13 25 12-11 5 12 19-18-14 33Q60 48 25 55Z"/>
    <path d="M24 58Q60 51 96 58v5Q60 56 24 63Z"/>
    <path d="M26 67Q60 61 94 67v1.6Q60 62.6 26 68.6Z"/>
    <circle cx="11" cy="19.5" r="3.6"/><circle cx="35" cy="25.2" r="3"/><circle cx="85" cy="25.2" r="3"/><circle cx="109" cy="19.5" r="3.6"/>
    <path d="M60 1c4.5 4.6 4.8 9.3.9 13.6h-1.8C55.2 10.3 55.5 5.6 60 1Z"/>
    <path d="M58.6 13.2c-2.2-2.7-6.4-2.4-7.3.5-.7 2.3 1.3 4 3.3 3.3-1.2-.4-1.5-1.6-.8-2.3.9-.9 2.6-.6 3.7.8Z"/>
    <path d="M61.4 13.2c2.2-2.7 6.4-2.4 7.3.5.7 2.3-1.3 4-3.3 3.3 1.2-.4 1.5-1.6.8-2.3-.9-.9-2.6-.6-3.7.8Z"/>
    <rect x="56" y="14.4" width="8" height="1.8" rx=".9"/>
  </g>
</svg>`;
}

// Stacked logo: crown, "BeasT", "DESIGNS", then the storefront name.
function brandLogo(business, id) {
  const [first, ...rest] = business.businessName.split(" ");
  return `${crownSvg(id)}
    <span class="brand-name">${esc(first)}</span>
    <span class="brand-designs">${esc(rest.join(" "))}</span>
    <span class="brand-sub">${esc(business.storefrontName)}</span>`;
}

const NAV = [
  { href: "shop.html", label: "Shop cards", page: "shop" },
  { href: "index.html#occasions", label: "Occasions", page: "occasions" },
  { href: "customize.html", label: "Customise a card", page: "customize" },
  { href: "help.html#how", label: "How it works", page: "help" },
  { href: "order.html", label: "My order", page: "order" },
];

function headerHtml(business, page) {
  const wa = waLink(business.whatsapp.number, enquiryMessage(business));
  return `
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="index.html" aria-label="${esc(business.storefrontName)} by ${esc(business.businessName)}, home">
        ${brandLogo(business, "hd")}
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">${ICONS.menu}<span>Menu</span></button>
      <nav id="site-nav" class="site-nav" aria-label="Main">
        <ul>
          ${NAV.map(n => `<li><a href="${n.href}"${n.page === page ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("")}
        </ul>
        <a class="btn btn-wa btn-sm" href="${wa}" target="_blank" rel="noopener">${ICONS.whatsapp}<span>WhatsApp us</span></a>
      </nav>
    </div>
  </header>`;
}

function footerHtml(data) {
  const { business, groups, occasions } = data;
  const wa = waLink(business.whatsapp.number, enquiryMessage(business));
  const popular = ["birthday", "romantic", "graduation", "anniversary-wedding", "thank-you", "christmas", "sympathy", "custom"]
    .map(id => occasions.find(o => o.id === id)).filter(Boolean);
  return `
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div class="footer-brand">
        <p class="brand footer-logo" aria-label="${esc(business.storefrontName)} by ${esc(business.businessName)}">${brandLogo(business, "ft")}</p>
        <p class="muted">Personalised greeting cards for birthdays, love, milestones, faith, comfort and everything in between, made to order in Kenya.</p>
      </div>
      <div>
        <h2 class="footer-h">Cards</h2>
        <ul class="footer-list">
          ${popular.map(o => `<li><a href="shop.html?occasion=${o.id}">${esc(o.name)}</a></li>`).join("")}
          <li><a href="shop.html">All designs</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-h">Help</h2>
        <ul class="footer-list">
          <li><a href="help.html#how">How to order</a></li>
          <li><a href="help.html#payment">Payment information</a></li>
          <li><a href="help.html#faq">FAQ</a></li>
          <li><a href="order.html">Check an order</a></li>
          <li><a href="privacy.html">Privacy notice</a></li>
          <li><a href="terms.html">Terms &amp; service policy</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-h">Contact</h2>
        <ul class="footer-list">
          <li><a href="tel:${business.phone.international}">${ICONS.phone}<span>${esc(business.phone.display)}</span></a></li>
          <li><a href="${wa}" target="_blank" rel="noopener">${ICONS.whatsapp}<span>WhatsApp ${esc(business.phone.display)}</span></a></li>
          <li class="muted">${esc(business.payment.methodName)}: <strong>${esc(business.payment.number)}</strong></li>
        </ul>
      </div>
    </div>
    <div class="wrap footer-base">
      <p>© ${new Date().getFullYear()} ${esc(business.businessName)} · ${esc(business.storefrontName)}</p>
      <p>Prices in ${esc(business.currency.code)}. Payments verified by hand. We never ask for your M-PESA PIN.</p>
    </div>
  </footer>
  <a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Chat with ${esc(business.businessName)} on WhatsApp">${ICONS.whatsapp}<span>Chat with us</span></a>
  <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`;
}

function wireNav() {
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (!toggle || !nav) return;
  const set = open => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    toggle.innerHTML = `${open ? ICONS.close : ICONS.menu}<span>${open ? "Close" : "Menu"}</span>`;
  };
  toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("is-open")) { set(false); toggle.focus(); } });
}

function showFatal(message) {
  if ($(".fatal-banner")) return;
  const div = document.createElement("div");
  div.className = "fatal-banner";
  div.setAttribute("role", "alert");
  div.innerHTML = `<p>${esc(message)}</p><button type="button" class="btn btn-sm btn-ghost">Reload page</button>`;
  div.querySelector("button").addEventListener("click", () => location.reload());
  document.body.prepend(div);
}

/** Loads data, renders the header/footer and returns the data bundle. */
export async function initPage(page) {
  window.addEventListener("unhandledrejection", e => {
    console.error(e.reason);
    showFatal("Something went wrong on this page. Please reload, or contact us on WhatsApp if it keeps happening.");
  });
  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showFatal("We couldn't load our card catalogue. Please check your connection and reload the page.");
    throw err;
  }
  $("#site-header")?.insertAdjacentHTML("afterbegin", headerHtml(data.business, page));
  $("#site-footer")?.insertAdjacentHTML("afterbegin", footerHtml(data));
  wireNav();
  bindConfig(data.business);
  return data;
}

// Fills static markup from business.json so contact and payment details live in one place:
// <span data-config="payment.number">, <a data-link="whatsapp">, <a data-link="tel">.
export function bindConfig(business, root = document) {
  for (const el of $$("[data-config]", root)) {
    const value = el.dataset.config.split(".").reduce((o, k) => (o == null ? o : o[k]), business);
    if (value != null) el.textContent = value;
  }
  for (const el of $$("[data-link]", root)) {
    if (el.dataset.link === "tel") el.href = `tel:${business.phone.international}`;
    if (el.dataset.link === "whatsapp") {
      el.href = waLink(business.whatsapp.number, el.dataset.message || enquiryMessage(business));
      el.target = "_blank";
      el.rel = "noopener";
    }
  }
}

export function toast(message, kind = "info") {
  const region = $(".toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.classList.add("is-leaving"), 3600);
  setTimeout(() => el.remove(), 4200);
}

export function confirmDialog({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
  return new Promise(resolve => {
    const dlg = document.createElement("dialog");
    dlg.className = "dialog";
    dlg.setAttribute("aria-labelledby", "dlg-title");
    dlg.innerHTML = `
      <form method="dialog">
        <h2 id="dlg-title">${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-ghost">${esc(cancelLabel)}</button>
          <button value="ok" class="btn ${danger ? "btn-danger" : "btn-primary"}">${esc(confirmLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => { resolve(dlg.returnValue === "ok"); dlg.remove(); });
    dlg.showModal();
    dlg.querySelector('button[value="cancel"]').focus();
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

let fontsReady = null;
export function cardFontsReady(catalog) {
  if (!fontsReady) fontsReady = loadCardFonts(catalog);
  return fontsReady;
}

/** Card tile used in the catalogue and featured sections. */
export function productCardHtml(data, t, { variant = "" } = {}) {
  const occ = primaryOccasion(data, t);
  const bundle = t.kind === "bundle";
  return `
  <article class="product ${variant}">
    <a class="product-link" href="customize.html?t=${encodeURIComponent(t.id)}" aria-label="${esc(t.name)}, ${esc(priceLabel(t, data.business))}. Customise this design.">
      <div class="product-art${bundle ? " is-bundle" : ""}">
        ${t.new ? `<span class="product-badge">New</span>` : ""}
        ${t.faces.map(f => `<canvas data-thumb="${esc(t.id)}" data-face="${esc(f.id)}" role="img" aria-label="${esc(t.name)} ${bundle ? esc(f.label) : "card"} design preview"></canvas>`).join("")}
      </div>
      <div class="product-body">
        <p class="product-occ">${esc(occ ? occ.name : "")}</p>
        <h3 class="product-name">${esc(t.name)}</h3>
        <p class="product-meta"><span class="product-price">${esc(priceLabel(t, data.business))}</span><span class="product-tag">Personalise</span></p>
      </div>
    </a>
  </article>`;
}

/** Renders every <canvas data-thumb> inside `root`, lazily when possible. */
export function hydrateThumbs(root, data, width = 360) {
  // Draw straight away (fallback fonts if needed), then redraw once the card fonts arrive.
  cardFontsReady(data.catalog).then(() => {
    $$("canvas[data-thumb][data-drawn]", root).forEach(c => { delete c.dataset.drawn; draw(c); });
  });
  const draw = canvas => {
    if (canvas.dataset.drawn) return;
    const t = data.catalog.templates.find(x => x.id === canvas.dataset.thumb);
    if (!t) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round((canvas.clientWidth || width / 2) * dpr) || width;
    renderFace(canvas, { catalog: data.catalog, template: t, faceId: canvas.dataset.face, values: {}, design: {}, width: Math.max(w, 200), sample: true });
    canvas.dataset.drawn = "1";
  };
  const canvases = $$("canvas[data-thumb]", root);
  if (!("IntersectionObserver" in window)) { canvases.forEach(draw); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); }
  }, { rootMargin: "300px" });
  canvases.forEach(c => io.observe(c));
}

/** Runs `paint` now and again once the card fonts have loaded. */
export function paintWithFonts(catalog, paint) {
  paint();
  cardFontsReady(catalog).then(paint);
}

export function setMeta({ title, description }) {
  if (title) document.title = title;
  if (description) {
    $('meta[name="description"]')?.setAttribute("content", description);
    $('meta[property="og:description"]')?.setAttribute("content", description);
  }
  if (title) $('meta[property="og:title"]')?.setAttribute("content", title);
}

export { money };
