// Catalogue search and filtering. Matches template names, occasions (including Swahili and
// everyday synonyms from occasions.json), keywords and descriptions.

function tokens(q) {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(t => t.length > 1);
}

export function relevance(template, occasions, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const occ = template.occasions.map(id => occasions.find(o => o.id === id)).filter(Boolean);
  const name = template.name.toLowerCase();
  const occText = occ.map(o => [o.name, ...o.keywords].join(" ")).join(" ").toLowerCase();
  const kw = template.keywords.join(" ").toLowerCase();
  const desc = template.description.toLowerCase();
  let score = 0;
  if (name.includes(q)) score += 12;
  if (occText.includes(q)) score += 8;
  if (kw.includes(q)) score += 6;
  for (const t of tokens(q)) {
    if (name.includes(t)) score += 4;
    if (occText.includes(t)) score += 3;
    if (kw.includes(t)) score += 2;
    if (desc.includes(t)) score += 1;
  }
  return score;
}

export function filterTemplates(templates, occasions, { q = "", occasion = "", maxPrice = 0, sort = "relevance" }) {
  let list = templates.map((t, i) => ({ t, i, score: relevance(t, occasions, q) }));
  if (q.trim()) list = list.filter(x => x.score > 0);
  if (occasion) list = list.filter(x => x.t.occasions.includes(occasion));
  if (maxPrice) list = list.filter(x => x.t.price.amount <= maxPrice);
  const byPrice = (a, b) => a.t.price.amount - b.t.price.amount || a.i - b.i;
  if (sort === "price-asc") list.sort(byPrice);
  else if (sort === "price-desc") list.sort((a, b) => -byPrice(a, b));
  else if (sort === "name") list.sort((a, b) => a.t.name.localeCompare(b.t.name));
  else list.sort((a, b) => b.score - a.score
    || (occasion ? a.t.occasions.indexOf(occasion) - b.t.occasions.indexOf(occasion) : 0)
    || Number(b.t.featured) - Number(a.t.featured) || a.i - b.i);
  return list.map(x => x.t);
}
