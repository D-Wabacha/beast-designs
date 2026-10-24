// Loads the business configuration, occasions and card templates (all plain JSON in /data)
// and exposes small helpers for prices and lookups. The Python server reads the same files,
// so prices shown here always match the prices charged.

let cache = null;

async function getJSON(path) {
  const res = await fetch(new URL(`../${path}`, import.meta.url), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

export async function loadData() {
  if (!cache) {
    cache = Promise.all([getJSON("data/business.json"), getJSON("data/occasions.json"), getJSON("data/templates.json")])
      .then(([business, occ, catalog]) => {
        const templates = catalog.templates.filter(t => t.status === "published");
        return {
          business,
          groups: occ.groups,
          occasions: occ.occasions,
          catalog: { ...catalog, templates },
        };
      });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

export function findTemplate(data, id) {
  return data.catalog.templates.find(t => t.id === id) || null;
}

export function findOccasion(data, id) {
  return data.occasions.find(o => o.id === id) || null;
}

export function primaryOccasion(data, template) {
  return findOccasion(data, template.occasions[0]);
}

export function enabledFormats(business) {
  return business.formats.filter(f => f.enabled);
}

const moneyFmt = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

export function money(amount, business) {
  const code = business?.currency?.code || "KES";
  return `${code} ${moneyFmt.format(amount)}`;
}

export function priceLabel(template, business) {
  const base = money(template.price.amount, business);
  if (template.price.type === "from") return `From ${base}`;
  if (template.price.type === "bundle") return `${base} for ${template.faces.length} cards`;
  return base;
}

export function quote(template, formatId, business) {
  const format = enabledFormats(business).find(f => f.id === formatId);
  if (!format) return null;
  const base = template.price.amount;
  const adjustment = format.priceAdjustment || 0;
  return { format, base, adjustment, total: base + adjustment };
}

export function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const STATUS_LABELS = {
  awaiting_payment: "Awaiting payment",
  verification_pending: "Payment being verified",
  paid: "Payment confirmed",
  ready: "Card ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_HELP = {
  awaiting_payment: "We've saved your order. Please pay using the instructions below, then share your M-PESA code.",
  verification_pending: "Thanks! We're checking your payment against our M-PESA statement. This is done by hand, so it may take a little while.",
  paid: "Your payment has been confirmed and we're finishing your card.",
  ready: "Your card is ready. Download it below or check WhatsApp.",
  completed: "This order is complete. Thank you!",
  cancelled: "This order was cancelled. Contact us on WhatsApp if you think this is a mistake.",
};

export const DOWNLOADABLE_STATUSES = ["ready", "completed"];
