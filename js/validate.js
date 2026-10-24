// Input validation shared by the customiser, checkout and order pages.
// The server repeats every check; these exist to give customers instant, friendly feedback.

export function normalizeKenyanPhone(input) {
  const digits = String(input || "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const m = digits.match(/^(?:254|0)?([17]\d{8})$/);
  return m ? "254" + m[1] : null;
}

export function displayPhone(normalized) {
  if (!normalized) return "";
  return "+" + normalized.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function normalizeMpesaCode(input) {
  return String(input || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isMpesaCode(code) {
  return /^[A-Z0-9]{10}$/.test(code) && /[A-Z]/.test(code);
}

export function validateFields(template, values) {
  const errors = {};
  for (const f of template.fields) {
    const raw = values[f.key];
    const v = (raw === undefined || raw === null ? f.default : raw).trim();
    if (f.required && !v) errors[f.key] = `Please add the ${f.label.toLowerCase()}.`;
    else if (v.length > f.maxLength) errors[f.key] = `Please keep this under ${f.maxLength} characters.`;
  }
  return errors;
}
