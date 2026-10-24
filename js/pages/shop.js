import { initPage, productCardHtml, hydrateThumbs, esc, $, $$, setMeta } from "../ui.js";
import { findOccasion } from "../data.js";
import { filterTemplates } from "../search.js";
import { waLink, enquiryMessage } from "../whatsapp.js";

const data = await initPage("shop");
const { catalog, occasions, groups, business } = data;

const form = $("#filters");
const q = $("#f-q"), occ = $("#f-occasion"), price = $("#f-price"), sort = $("#f-sort");

occ.insertAdjacentHTML("beforeend", groups.map(g => `
  <optgroup label="${esc(g.name)}">
    ${occasions.filter(o => o.group === g.id).map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}
  </optgroup>`).join(""));

const quick = ["birthday", "romantic", "gm-gn", "graduation", "exam-success", "anniversary-wedding", "thank-you", "apology", "christmas", "sympathy", "new-baby", "business"];
$("#occasion-chips").innerHTML = `<button type="button" class="chip" data-occ="">All</button>` +
  quick.map(id => findOccasion(data, id)).filter(Boolean)
    .map(o => `<button type="button" class="chip" data-occ="${esc(o.id)}">${esc(o.name)}</button>`).join("");

function readParams() {
  const p = new URLSearchParams(location.search);
  q.value = p.get("q") || "";
  occ.value = occasions.some(o => o.id === p.get("occasion")) ? p.get("occasion") : "";
  price.value = ["150", "200", "300"].includes(p.get("max")) ? p.get("max") : "";
  sort.value = ["relevance", "price-asc", "price-desc", "name"].includes(p.get("sort")) ? p.get("sort") : "relevance";
}

function writeParams() {
  const p = new URLSearchParams();
  if (q.value.trim()) p.set("q", q.value.trim());
  if (occ.value) p.set("occasion", occ.value);
  if (price.value) p.set("max", price.value);
  if (sort.value !== "relevance") p.set("sort", sort.value);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function render() {
  const filters = { q: q.value, occasion: occ.value, maxPrice: Number(price.value) || 0, sort: sort.value };
  const list = filterTemplates(catalog.templates, occasions, filters);
  const o = findOccasion(data, occ.value);

  $("#shop-title").textContent = o ? `${o.name} cards` : "Personalised cards for every occasion";
  setMeta({
    title: o ? `${o.name} Cards — Personalised in Kenya | Love Cards Kenya` : "Shop Personalised Cards | Love Cards Kenya",
    description: o ? `Personalised ${o.name.toLowerCase()} cards you can customise online and order in KES.` : undefined,
  });
  $$("#occasion-chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.occ === occ.value)));

  const active = Boolean(filters.q.trim() || filters.occasion || filters.maxPrice);
  $("#clear-filters").hidden = !active;
  $("#result-count").textContent = list.length
    ? `${list.length} design${list.length === 1 ? "" : "s"}${o ? ` for ${o.name.toLowerCase()}` : ""}${filters.q.trim() ? ` matching "${filters.q.trim()}"` : ""}`
    : "No designs found";

  const results = $("#results");
  if (!list.length) {
    const custom = waLink(business.whatsapp.number, enquiryMessage(business,
      `I'm looking for a card${o ? ` for ${o.name.toLowerCase()}` : ""}${filters.q.trim() ? ` (${filters.q.trim()})` : ""}. Can you help?`));
    results.className = "";
    results.innerHTML = `
      <div class="empty-state">
        <h2>Nothing matches just yet</h2>
        <p>Try a broader search, or pick one of our open designs. They work for almost any occasion. We can also help you find the right card on WhatsApp.</p>
        <div class="empty-actions">
          <button type="button" class="btn btn-secondary" data-clear>Clear filters</button>
          <a class="btn btn-primary" href="shop.html?occasion=custom">Open designs</a>
          <a class="btn btn-wa" href="${custom}" target="_blank" rel="noopener">Ask on WhatsApp</a>
        </div>
      </div>`;
    results.querySelector("[data-clear]").addEventListener("click", clearAll);
    return;
  }
  results.className = "product-grid";
  results.innerHTML = list.map(t => productCardHtml(data, t)).join("");
  hydrateThumbs(results, data);
}

function clearAll() {
  q.value = ""; occ.value = ""; price.value = ""; sort.value = "relevance";
  writeParams(); render(); q.focus();
}

let timer;
q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { writeParams(); render(); }, 180); });
[occ, price, sort].forEach(el => el.addEventListener("change", () => { writeParams(); render(); }));
form.addEventListener("submit", e => { e.preventDefault(); writeParams(); render(); });
$("#clear-filters").addEventListener("click", clearAll);
$("#occasion-chips").addEventListener("click", e => {
  const chip = e.target.closest("[data-occ]");
  if (!chip) return;
  occ.value = chip.dataset.occ;
  writeParams(); render();
});
window.addEventListener("popstate", () => { readParams(); render(); });

readParams();
render();
