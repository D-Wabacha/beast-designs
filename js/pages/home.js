import { initPage, productCardHtml, hydrateThumbs, esc, $ } from "../ui.js";
import { money } from "../data.js";

const data = await initPage("home");
const { catalog, groups, occasions, business } = data;

const lowest = Math.min(...catalog.templates.map(t => t.price.amount));
const heroPrice = $("[data-hero-price]");
if (heroPrice) heroPrice.textContent = money(lowest, business);

const featured = catalog.templates.filter(t => t.featured).slice(0, 9);
$("#featured").innerHTML = featured
  .map((t, i) => productCardHtml(data, t, { variant: i === 0 ? "product--lead" : "" }))
  .join("");

const fresh = catalog.templates.filter(t => t.new);
$("#more-new").innerHTML = fresh.filter(t => !t.featured).slice(0, 8).map(t => productCardHtml(data, t)).join("");
const newCount = $("[data-new-count]");
if (newCount) newCount.textContent = `See all ${fresh.length} new designs`;

const counts = Object.fromEntries(occasions.map(o => [o.id, catalog.templates.filter(t => t.occasions.includes(o.id)).length]));
$("#occasion-groups").innerHTML = groups.map(g => `
  <div class="occasion-group">
    <h3>${esc(g.name)}</h3>
    <ul class="occasion-list">
      ${occasions.filter(o => o.group === g.id).map(o => `
        <li><a href="shop.html?occasion=${encodeURIComponent(o.id)}">${esc(o.name)}<span class="count">${counts[o.id]} design${counts[o.id] === 1 ? "" : "s"}</span></a></li>`).join("")}
    </ul>
  </div>`).join("");

hydrateThumbs(document, data);
