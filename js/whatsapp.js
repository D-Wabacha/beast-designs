// WhatsApp click-to-chat links. Opening one only hands the customer over to WhatsApp with a
// pre-filled message; nothing is sent until they press send in WhatsApp.

export function waLink(number, message) {
  const n = String(number).replace(/\D/g, "");
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

export function enquiryMessage(business, context) {
  const lines = [`Hello ${business.businessName}! I have a question about ${business.storefrontName} cards.`];
  if (context) lines.push("", context);
  return lines.join("\n");
}

export function designEnquiryMessage(business, templateName, occasionName) {
  return [
    `Hello ${business.businessName}! I'm interested in the "${templateName}" card${occasionName ? ` (${occasionName})` : ""}.`,
    "",
    "Could you help me with it?",
  ].join("\n");
}

export function personalisationLines(template, values) {
  const lines = [];
  for (const f of template.fields) {
    const v = (values?.[f.key] ?? "").trim();
    if (v) lines.push(`${f.label}: ${v}`);
  }
  return lines;
}

export function orderMessage(business, order, template, occasionName) {
  const lines = [
    `Hello ${business.businessName}! I'd like to place an order.`,
    "",
    `Order reference: ${order.reference}`,
    `Card: ${order.templateName}`,
  ];
  if (occasionName) lines.push(`Occasion: ${occasionName}`);
  lines.push(`Format: ${order.formatName}`);
  if (template) lines.push(...personalisationLines(template, order.values));
  lines.push(`Price: ${business.currency.code} ${order.total}`);
  lines.push(`Customer name: ${order.customer.name}`);
  if (order.payment?.code) lines.push(`M-PESA code: ${order.payment.code}`);
  lines.push("", "Please confirm the next steps and payment process.");
  return lines.join("\n");
}

export function unsavedOrderMessage(business, draft, template, occasionName, customer, formatName, total) {
  const lines = [
    `Hello ${business.businessName}! I'd like to order a card. (I couldn't submit it on the website, so I'm sending the details here.)`,
    "",
    `Card: ${template.name}`,
  ];
  if (occasionName) lines.push(`Occasion: ${occasionName}`);
  lines.push(`Format: ${formatName}`);
  lines.push(...personalisationLines(template, draft.values));
  lines.push(`Price: ${business.currency.code} ${total}`);
  if (customer?.name) lines.push(`Customer name: ${customer.name}`);
  lines.push("", "Please confirm the next steps and payment process.");
  return lines.join("\n");
}
