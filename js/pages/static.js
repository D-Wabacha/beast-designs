// Shared script for content pages (help, privacy, terms, 404).
import { initPage, esc, $ } from "../ui.js";
import { money } from "../data.js";

const page = document.body.dataset.page;
const { business } = await initPage(page);

const routes = $("#pay-routes");
if (routes) {
  const fill = s => s.replace("{number}", business.payment.number).replace("{amount}", "the total shown on your order page");
  routes.innerHTML = business.payment.routes.map(r => `
    <h3 style="margin-top:16px">${esc(r.label)}</h3>
    <ol>${r.steps.map(s => `<li>${esc(fill(s))}</li>`).join("")}</ol>`).join("");
}

const notes = $("#pay-notes");
if (notes) notes.innerHTML = business.payment.notes.map(n => `<div class="notice"><p>${esc(n)}</p></div>`).join("");

const formats = $("#formats-list");
if (formats) {
  formats.innerHTML = business.formats.filter(f => f.enabled).map(f => `
    <div class="option-card" style="cursor:default">
      <span><strong>${esc(f.name)}</strong><small>${esc(f.description)}</small></span>
      <span class="price">${f.priceAdjustment ? "+ " + esc(money(f.priceAdjustment, business)) : "Included"}</span>
    </div>`).join("");
}
