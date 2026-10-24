// Browser storage for conveniences only: unfinished card drafts and quick links to orders
// placed on this device. Orders themselves live on the server. Storage may be unavailable
// (private browsing, blocked cookies), so every access is guarded.

const PREFIX = "lck:";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const drafts = {
  get: templateId => read("draft:" + templateId, null),
  save: (templateId, draft) => write("draft:" + templateId, { ...draft, savedAt: Date.now() }),
  clear: templateId => write("draft:" + templateId, null),
  // Names carry across designs so switching templates doesn't mean retyping them.
  getShared: () => read("shared-names", {}),
  saveShared: names => write("shared-names", names),
};

export const checkout = {
  get: () => read("checkout", null),
  set: value => write("checkout", value),
  clear: () => write("checkout", null),
};

export const customerDetails = {
  get: () => read("customer", null),
  set: value => write("customer", value),
};

export const myOrders = {
  list: () => read("orders", []),
  add: entry => {
    const list = read("orders", []).filter(o => o.reference !== entry.reference);
    list.unshift(entry);
    write("orders", list.slice(0, 20));
  },
};
