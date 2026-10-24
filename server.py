#!/usr/bin/env python3
"""Love Cards Kenya / BeasT Designs web server.

Serves the static storefront and a small JSON order API backed by SQLite.
Standard library only. Run:  python3 server.py   (see README.md for settings)

Payment model: manual verification. Customers submit an M-PESA code, which only moves an
order to "verification_pending". Only an authenticated admin can mark an order as paid.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
VAR_DIR = Path(os.environ.get("LCK_VAR_DIR", ROOT / "var"))
DB_PATH = Path(os.environ.get("LCK_DB", VAR_DIR / "orders.sqlite3"))
HOST = os.environ.get("LCK_HOST", "127.0.0.1")
PORT = int(os.environ.get("LCK_PORT", "8000"))
ADMIN_PASSWORD = os.environ.get("LCK_ADMIN_PASSWORD") or None
SECURE_COOKIES = os.environ.get("LCK_SECURE_COOKIES") == "1"
TRUST_PROXY = os.environ.get("LCK_TRUST_PROXY") == "1"
MAX_BODY = 32 * 1024
SESSION_TTL = 8 * 3600

PUBLIC_DIRS = ("css/", "js/", "assets/")
PUBLIC_DATA = {"data/business.json", "data/occasions.json", "data/templates.json"}
PUBLIC_PAGES = {
    "index.html", "shop.html", "customize.html", "checkout.html", "order.html",
    "help.html", "privacy.html", "terms.html", "admin.html", "404.html",
}

STATUSES = ("awaiting_payment", "verification_pending", "paid", "ready", "completed", "cancelled")
# What an authenticated admin may change an order to, from each status.
ADMIN_TRANSITIONS = {
    "awaiting_payment": {"paid", "cancelled"},
    "verification_pending": {"awaiting_payment", "paid", "cancelled"},
    "paid": {"ready", "cancelled"},
    "ready": {"completed", "paid"},
    "completed": set(),
    "cancelled": {"awaiting_payment"},
}
CUSTOMER_CLAIMABLE = {"awaiting_payment", "verification_pending"}

REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PHONE_RE = re.compile(r"^(?:254|0)?([17]\d{8})$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
MPESA_RE = re.compile(r"^(?=.*[A-Z])[A-Z0-9]{10}$")
REF_RE = re.compile(r"^[A-Z]{2,5}-[A-Z0-9]{6}$")
CONTROL_RE = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------- config & data

_json_cache: dict[str, tuple[float, object]] = {}
_json_lock = threading.Lock()


def load_json(name: str):
    """Load a data file, reloading automatically when it changes on disk."""
    path = DATA_DIR / name
    mtime = path.stat().st_mtime
    with _json_lock:
        cached = _json_cache.get(name)
        if cached and cached[0] == mtime:
            return cached[1]
        data = json.loads(path.read_text(encoding="utf-8"))
        _json_cache[name] = (mtime, data)
        return data


def business():
    return load_json("business.json")


def catalog():
    return load_json("templates.json")


def find_template(template_id: str):
    for t in catalog()["templates"]:
        if t["id"] == template_id and t.get("status") == "published":
            return t
    return None


def find_format(format_id: str):
    for f in business()["formats"]:
        if f["id"] == format_id and f.get("enabled"):
            return f
    return None


def server_secret() -> bytes:
    env = os.environ.get("LCK_SECRET")
    if env:
        return env.encode()
    path = VAR_DIR / "secret.key"
    if not path.exists():
        VAR_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_hex(32))
        os.chmod(path, 0o600)
    return path.read_text().strip().encode()


SECRET = None


def access_key(reference: str) -> str:
    """Unguessable per-order key used in the customer's order link."""
    digest = hmac.new(SECRET, reference.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest)[:24].decode()


def normalize_phone(value) -> str | None:
    digits = re.sub(r"[\s\-().]", "", str(value or "")).lstrip("+")
    m = PHONE_RE.match(digits)
    return "254" + m.group(1) if m else None


def clean_text(value, max_len: int, multiline: bool = False) -> str:
    if not isinstance(value, str):
        return ""
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    if not multiline:
        value = value.replace("\n", " ")
    value = CONTROL_RE.sub("", value).strip()
    return value[: max_len + 1]


# --------------------------------------------------------------------------- database

_db_local = threading.local()


def db() -> sqlite3.Connection:
    conn = getattr(_db_local, "conn", None)
    if conn is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _db_local.conn = conn
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
  reference TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  format_id TEXT NOT NULL,
  format_name TEXT NOT NULL,
  export_width INTEGER,
  export_height INTEGER,
  base_price INTEGER NOT NULL,
  adjustment INTEGER NOT NULL,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  values_json TEXT NOT NULL,
  design_json TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  channel TEXT NOT NULL,
  notes TEXT,
  payment_code TEXT,
  payment_payer TEXT,
  payment_submitted_at TEXT,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS orders_payment_code ON orders(payment_code);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL REFERENCES orders(reference),
  at TEXT NOT NULL,
  status TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS events_ref ON order_events(reference, id);
"""


def init_db():
    db().executescript(SCHEMA)


def add_event(conn, reference, status, actor, note=None):
    conn.execute(
        "INSERT INTO order_events(reference, at, status, actor, note) VALUES (?,?,?,?,?)",
        (reference, now_iso(), status, actor, note),
    )


def new_reference(conn) -> str:
    prefix = re.sub(r"[^A-Z]", "", business()["orders"].get("referencePrefix", "LCK").upper())[:5] or "LCK"
    for _ in range(20):
        ref = f"{prefix}-" + "".join(secrets.choice(REF_ALPHABET) for _ in range(6))
        if not conn.execute("SELECT 1 FROM orders WHERE reference=?", (ref,)).fetchone():
            return ref
    raise RuntimeError("Could not allocate an order reference")


def get_order(reference: str):
    return db().execute("SELECT * FROM orders WHERE reference=?", (reference,)).fetchone()


def order_events(reference: str):
    return db().execute(
        "SELECT at, status, actor, note FROM order_events WHERE reference=? ORDER BY id", (reference,)
    ).fetchall()


def public_view(row) -> dict:
    """What a customer with the order link may see."""
    view = {
        "reference": row["reference"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "templateId": row["template_id"],
        "templateName": row["template_name"],
        "formatId": row["format_id"],
        "formatName": row["format_name"],
        "exportWidth": row["export_width"],
        "exportHeight": row["export_height"],
        "basePrice": row["base_price"],
        "adjustment": row["adjustment"],
        "total": row["total"],
        "currency": row["currency"],
        "values": json.loads(row["values_json"]),
        "design": json.loads(row["design_json"]),
        "channel": row["channel"],
        "customer": {"name": row["customer_name"]},
        "payment": None,
        "history": [{"status": e["status"], "at": e["at"]} for e in order_events(row["reference"])],
    }
    if row["payment_code"]:
        view["payment"] = {"code": row["payment_code"], "submittedAt": row["payment_submitted_at"], "payerName": row["payment_payer"]}
    return view


def admin_view(row) -> dict:
    view = public_view(row)
    view["customer"] = {"name": row["customer_name"], "phone": row["customer_phone"], "email": row["customer_email"]}
    view["notes"] = row["notes"]
    view["adminNote"] = row["admin_note"]
    view["history"] = [dict(e) for e in order_events(row["reference"])]
    view["allowedTransitions"] = sorted(ADMIN_TRANSITIONS.get(row["status"], set()))
    if row["payment_code"]:
        dupes = db().execute(
            "SELECT reference FROM orders WHERE payment_code=? AND reference<>?", (row["payment_code"], row["reference"])
        ).fetchall()
        view["duplicatePaymentCodeOn"] = [d["reference"] for d in dupes]
    return view


# --------------------------------------------------------------------------- validation

class ValidationError(Exception):
    def __init__(self, message, fields=None):
        super().__init__(message)
        self.fields = fields or {}


def validate_order(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("Invalid request.")
    fields: dict[str, str] = {}
    template = find_template(str(payload.get("templateId", "")))
    if not template:
        raise ValidationError("That card design is no longer available. Please choose another design.")
    fmt = find_format(str(payload.get("formatId", "")))
    if not fmt:
        raise ValidationError("Please choose an available card format.", {"format": "Please choose a format."})

    raw_values = payload.get("values") if isinstance(payload.get("values"), dict) else {}
    values = {}
    for f in template["fields"]:
        v = raw_values.get(f["key"], f.get("default", ""))
        v = clean_text(v, f["maxLength"], multiline=f.get("type") == "textarea")
        if len(v) > f["maxLength"]:
            fields[f["key"]] = f"Please keep this under {f['maxLength']} characters."
        elif f.get("required") and not v:
            fields[f["key"]] = f"Please add the {f['label'].lower()}."
        values[f["key"]] = v
    if fields:
        raise ValidationError("Some card details are missing. Please go back and complete your card.", fields)

    cat = catalog()
    raw_design = payload.get("design") if isinstance(payload.get("design"), dict) else {}
    font = raw_design.get("font") if raw_design.get("font") in cat["fonts"] else template["defaults"]["font"]
    align = raw_design.get("align") if raw_design.get("align") in ("left", "center", "right") else template["defaults"].get("align", "center")
    size_range = cat["sizeRange"]
    try:
        size = int(raw_design.get("size", size_range["default"]))
    except (TypeError, ValueError):
        size = size_range["default"]
    size = min(size_range["max"], max(size_range["min"], size))
    ink_ids = {c["id"] for c in cat["textColors"]}
    ink = raw_design.get("ink") if raw_design.get("ink") in ink_ids else "ink"
    raw_palettes = raw_design.get("palettes") if isinstance(raw_design.get("palettes"), dict) else {}
    palettes = {
        face["id"]: raw_palettes.get(face["id"]) if raw_palettes.get(face["id"]) in face["palettes"] else face["palettes"][0]
        for face in template["faces"]
    }
    design = {"font": font, "align": align, "size": size, "ink": ink, "palettes": palettes}

    cust = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    name = clean_text(cust.get("name"), 60)
    if len(name) < 2 or len(name) > 60:
        fields["name"] = "Please enter your name."
    phone = normalize_phone(cust.get("phone"))
    if not phone:
        fields["phone"] = "Please enter a valid Kenyan mobile number, e.g. 0712 345 678."
    email = clean_text(cust.get("email"), 120)
    if email and (len(email) > 120 or not EMAIL_RE.match(email)):
        fields["email"] = "That email address doesn't look right."

    biz = business()
    channels = {c["id"] for c in biz["fulfilment"]["channels"]}
    channel = payload.get("channel") if payload.get("channel") in channels else None
    if not channel:
        fields["channel"] = "Please choose how you'd like to receive your card."
    max_notes = biz["orders"].get("maxNotesLength", 500)
    notes = clean_text(payload.get("notes"), max_notes, multiline=True)
    if len(notes) > max_notes:
        fields["notes"] = f"Please keep notes under {max_notes} characters."
    if payload.get("consent") is not True:
        fields["consent"] = "Please confirm you've read how we use your details."
    if fields:
        raise ValidationError("Please check the highlighted details.", fields)

    base = int(template["price"]["amount"])
    adjustment = int(fmt.get("priceAdjustment", 0))
    export = fmt.get("export") or {}
    return {
        "template": template, "format": fmt, "values": values, "design": design,
        "name": name, "phone": phone, "email": email or None, "channel": channel, "notes": notes or None,
        "base": base, "adjustment": adjustment, "total": base + adjustment,
        "export_width": export.get("width"), "export_height": export.get("height"),
    }


def create_order(payload: dict) -> dict:
    o = validate_order(payload)
    conn = db()
    ts = now_iso()
    conn.execute("BEGIN IMMEDIATE")
    try:
        ref = new_reference(conn)
        conn.execute(
            """INSERT INTO orders(reference, status, created_at, updated_at, template_id, template_name, format_id,
                 format_name, export_width, export_height, base_price, adjustment, total, currency, values_json,
                 design_json, customer_name, customer_phone, customer_email, channel, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ref, "awaiting_payment", ts, ts, o["template"]["id"], o["template"]["name"], o["format"]["id"],
             o["format"]["name"], o["export_width"], o["export_height"], o["base"], o["adjustment"], o["total"],
             business()["currency"]["code"], json.dumps(o["values"], ensure_ascii=False), json.dumps(o["design"]),
             o["name"], o["phone"], o["email"], o["channel"], o["notes"]),
        )
        add_event(conn, ref, "awaiting_payment", "customer", "Order placed")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return {"reference": ref, "accessKey": access_key(ref), "status": "awaiting_payment", "total": o["total"], "createdAt": ts}


def submit_payment_claim(reference: str, code: str, payer: str) -> dict:
    conn = db()
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = conn.execute("SELECT status, payment_code FROM orders WHERE reference=?", (reference,)).fetchone()
        if not row:
            raise LookupError
        if row["status"] not in CUSTOMER_CLAIMABLE:
            raise ValidationError("This order no longer needs a payment code. Contact us on WhatsApp if something looks wrong.")
        if row["payment_code"] == code and row["status"] == "verification_pending":
            conn.execute("COMMIT")
            return {"status": row["status"], "unchanged": True}
        ts = now_iso()
        conn.execute(
            "UPDATE orders SET status='verification_pending', payment_code=?, payment_payer=?, payment_submitted_at=?, updated_at=? WHERE reference=?",
            (code, payer or None, ts, ts, reference),
        )
        add_event(conn, reference, "verification_pending", "customer", f"M-PESA code submitted: {code}")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return {"status": "verification_pending"}


def admin_set_status(reference: str, new_status: str, note: str | None) -> dict:
    conn = db()
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = conn.execute("SELECT status FROM orders WHERE reference=?", (reference,)).fetchone()
        if not row:
            raise LookupError
        if new_status not in ADMIN_TRANSITIONS.get(row["status"], set()):
            raise ValidationError(f"An order that is '{row['status']}' can't be changed to '{new_status}'.")
        ts = now_iso()
        conn.execute("UPDATE orders SET status=?, updated_at=? WHERE reference=?", (new_status, ts, reference))
        add_event(conn, reference, new_status, "admin", note)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return admin_view(get_order(reference))


# --------------------------------------------------------------------------- rate limits & sessions

class RateLimiter:
    def __init__(self):
        self.hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, bucket: str, ip: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        with self.lock:
            q = self.hits[(bucket, ip)]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


LIMITS = {"order": (10, 600), "claim": (12, 600), "lookup": (20, 600), "login": (8, 900), "view": (120, 600)}
limiter = RateLimiter()
sessions: dict[str, float] = {}
sessions_lock = threading.Lock()


def new_session() -> str:
    token = secrets.token_urlsafe(32)
    with sessions_lock:
        now = time.time()
        for t, exp in list(sessions.items()):
            if exp < now:
                del sessions[t]
        sessions[token] = now + SESSION_TTL
    return token


def valid_session(token: str | None) -> bool:
    if not token:
        return False
    with sessions_lock:
        exp = sessions.get(token)
        return bool(exp and exp > time.time())


# --------------------------------------------------------------------------- HTTP

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    ),
}


class Handler(BaseHTTPRequestHandler):
    server_version = "LoveCardsKenya"
    sys_version = ""

    # ---- helpers
    def log_message(self, fmt, *args):
        # Never log query strings: order links carry access keys.
        path = urlparse(self.path).path
        sys.stderr.write(f"{self.log_date_time_string()} {self.command} {path} {args[1] if len(args) > 1 else ''}\n")

    def client_ip(self) -> str:
        if TRUST_PROXY and self.headers.get("X-Forwarded-For"):
            return self.headers["X-Forwarded-For"].split(",")[0].strip()
        return self.client_address[0]

    def send(self, status: int, body: bytes, content_type: str, extra: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json(self, status: int, obj, extra: dict | None = None):
        headers = {"Cache-Control": "no-store"}
        headers.update(extra or {})
        self.send(status, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8", headers)

    def error_json(self, status: int, message: str, fields=None):
        body = {"error": message}
        if fields:
            body["fields"] = fields
        self.json(status, body)

    def read_json(self):
        ctype = self.headers.get("Content-Type", "")
        if not ctype.startswith("application/json"):
            raise ValidationError("Expected JSON.")
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValidationError("Request too large.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValidationError("Invalid JSON.")

    def same_origin(self) -> bool:
        if self.headers.get("X-Requested-With") != "lck":
            return False
        origin = self.headers.get("Origin")
        if origin:
            host = self.headers.get("X-Forwarded-Host") if TRUST_PROXY and self.headers.get("X-Forwarded-Host") else self.headers.get("Host")
            return urlparse(origin).netloc == host
        return True

    def cookie(self, name: str) -> str | None:
        c = SimpleCookie(self.headers.get("Cookie", ""))
        return c[name].value if name in c else None

    def is_admin(self) -> bool:
        return valid_session(self.cookie("lck_admin"))

    def limited(self, bucket: str) -> bool:
        limit, window = LIMITS[bucket]
        if limiter.allow(bucket, self.client_ip(), limit, window):
            return False
        self.error_json(429, "Too many attempts. Please wait a few minutes and try again.")
        return True

    # ---- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        try:
            if path.startswith("/api/"):
                return self.api_get(path, parse_qs(url.query))
            if path == "/sitemap.xml":
                return self.sitemap()
            if path == "/robots.txt":
                return self.robots()
            return self.static(path)
        except Exception as exc:  # pragma: no cover - last-resort guard
            self.log_error("Unhandled error: %r", exc)
            self.error_json(500, "Something went wrong on our side. Please try again.")

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return self.error_json(405, "Method not allowed.")
        if not self.same_origin():
            return self.error_json(403, "Request blocked.")
        try:
            return self.api_post(path)
        except ValidationError as exc:
            return self.error_json(400, str(exc), exc.fields)
        except LookupError:
            return self.error_json(404, "Order not found.")
        except Exception as exc:  # pragma: no cover
            self.log_error("Unhandled error: %r", exc)
            return self.error_json(500, "Something went wrong on our side. Please try again.")

    # ---- API
    def api_get(self, path: str, query: dict):
        if path == "/api/health":
            return self.json(200, {"ok": True})

        m = re.fullmatch(r"/api/orders/([A-Z0-9-]{3,20})", path)
        if m:
            if self.limited("view"):
                return
            ref = m.group(1)
            key = (query.get("key") or [""])[0]
            row = get_order(ref)
            if not row or not hmac.compare_digest(access_key(ref), key):
                return self.error_json(404, "Order not found.")
            return self.json(200, public_view(row))

        if path == "/api/admin/session":
            return self.json(200, {"authenticated": self.is_admin(), "enabled": bool(ADMIN_PASSWORD)})
        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.error_json(401, "Please sign in.")
            if path == "/api/admin/orders":
                status = (query.get("status") or [""])[0]
                sql = "SELECT * FROM orders"
                args: list = []
                if status in STATUSES:
                    sql += " WHERE status=?"
                    args.append(status)
                sql += " ORDER BY created_at DESC LIMIT 300"
                rows = db().execute(sql, args).fetchall()
                counts = {r["status"]: r["n"] for r in db().execute("SELECT status, COUNT(*) n FROM orders GROUP BY status")}
                return self.json(200, {
                    "orders": [{
                        "reference": r["reference"], "status": r["status"], "createdAt": r["created_at"],
                        "templateName": r["template_name"], "total": r["total"], "customerName": r["customer_name"],
                        "paymentCode": r["payment_code"],
                    } for r in rows],
                    "counts": counts,
                })
            m = re.fullmatch(r"/api/admin/orders/([A-Z0-9-]{3,20})", path)
            if m:
                row = get_order(m.group(1))
                return self.json(200, admin_view(row)) if row else self.error_json(404, "Order not found.")
        return self.error_json(404, "Not found.")

    def api_post(self, path: str):
        if path == "/api/orders":
            if self.limited("order"):
                return
            return self.json(201, create_order(self.read_json()))

        if path == "/api/orders/lookup":
            if self.limited("lookup"):
                return
            body = self.read_json()
            ref = str(body.get("reference", "")).strip().upper()
            phone = normalize_phone(body.get("phone"))
            row = get_order(ref) if REF_RE.match(ref) else None
            if not row or not phone or not hmac.compare_digest(row["customer_phone"], phone):
                return self.error_json(404, "We couldn't find an order with that reference and phone number. Please check both and try again.")
            return self.json(200, {"reference": ref, "accessKey": access_key(ref)})

        m = re.fullmatch(r"/api/orders/([A-Z0-9-]{3,20})/payment-claim", path)
        if m:
            if self.limited("claim"):
                return
            ref = m.group(1)
            body = self.read_json()
            if not get_order(ref) or not hmac.compare_digest(access_key(ref), str(body.get("key", ""))):
                return self.error_json(404, "Order not found.")
            code = re.sub(r"\s+", "", str(body.get("code", ""))).upper()
            if not MPESA_RE.match(code):
                raise ValidationError("M-PESA codes are 10 letters and numbers. Please check your SMS.", {"code": "Invalid code."})
            payer = clean_text(body.get("payerName"), 60)[:60]
            result = submit_payment_claim(ref, code, payer)
            return self.json(200, {**result, "message": "Code received. Payment verification is pending."})

        if path == "/api/admin/login":
            if not ADMIN_PASSWORD:
                return self.error_json(503, "Admin is disabled on this server. Set LCK_ADMIN_PASSWORD and restart to enable it.")
            if self.limited("login"):
                return
            body = self.read_json()
            if not hmac.compare_digest(str(body.get("password", "")).encode(), ADMIN_PASSWORD.encode()):
                time.sleep(0.5)
                return self.error_json(401, "That password isn't right.")
            token = new_session()
            cookie = f"lck_admin={token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}"
            if SECURE_COOKIES:
                cookie += "; Secure"
            return self.json(200, {"ok": True}, {"Set-Cookie": cookie})

        if path == "/api/admin/logout":
            token = self.cookie("lck_admin")
            with sessions_lock:
                sessions.pop(token, None)
            return self.json(200, {"ok": True}, {"Set-Cookie": "lck_admin=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0"})

        if path.startswith("/api/admin/"):
            if not self.is_admin():
                return self.error_json(401, "Please sign in.")
            m = re.fullmatch(r"/api/admin/orders/([A-Z0-9-]{3,20})/status", path)
            if m:
                body = self.read_json()
                status = body.get("status")
                if status not in STATUSES:
                    raise ValidationError("Unknown status.")
                note = clean_text(body.get("note"), 300, multiline=True)[:300] or None
                return self.json(200, admin_set_status(m.group(1), status, note))
            m = re.fullmatch(r"/api/admin/orders/([A-Z0-9-]{3,20})/note", path)
            if m:
                body = self.read_json()
                note = clean_text(body.get("note"), 1000, multiline=True)[:1000] or None
                if not get_order(m.group(1)):
                    raise LookupError
                db().execute("UPDATE orders SET admin_note=?, updated_at=? WHERE reference=?", (note, now_iso(), m.group(1)))
                return self.json(200, admin_view(get_order(m.group(1))))
        return self.error_json(404, "Not found.")

    # ---- static & SEO
    def static(self, path: str):
        rel = path.lstrip("/") or "index.html"
        allowed = rel in PUBLIC_PAGES or rel in PUBLIC_DATA or (rel.startswith(PUBLIC_DIRS) and ".." not in rel)
        target = (ROOT / rel).resolve()
        if not allowed or not str(target).startswith(str(ROOT)) or not target.is_file():
            body = (ROOT / "404.html").read_bytes()
            return self.send(404, body, "text/html; charset=utf-8", {"Cache-Control": "no-cache"})
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json", "image/svg+xml"):
            ctype += "; charset=utf-8"
        cache = "no-cache"
        extra = {"Cache-Control": cache}
        if rel == "admin.html":
            extra["X-Robots-Tag"] = "noindex, nofollow"
        self.send(200, target.read_bytes(), ctype, extra)

    def base_url(self) -> str:
        configured = business().get("siteUrl")
        if configured:
            return configured.rstrip("/")
        scheme = "https" if SECURE_COOKIES else "http"
        return f"{scheme}://{self.headers.get('Host', f'{HOST}:{PORT}')}"

    def sitemap(self):
        base = self.base_url()
        urls = ["/", "/shop.html", "/customize.html", "/help.html", "/privacy.html", "/terms.html"]
        urls += [f"/shop.html?occasion={o['id']}" for o in load_json("occasions.json")["occasions"]]
        urls += [f"/customize.html?t={t['id']}" for t in catalog()["templates"] if t.get("status") == "published"]
        body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        body += "".join(f"  <url><loc>{xml_escape(base + u)}</loc></url>\n" for u in urls)
        body += "</urlset>\n"
        self.send(200, body.encode(), "application/xml; charset=utf-8", {"Cache-Control": "no-cache"})

    def robots(self):
        body = (
            "User-agent: *\nDisallow: /api/\nDisallow: /admin.html\nDisallow: /checkout.html\nDisallow: /order.html\n"
            f"Sitemap: {self.base_url()}/sitemap.xml\n"
        )
        self.send(200, body.encode(), "text/plain; charset=utf-8", {"Cache-Control": "no-cache"})


mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")


def main():
    global SECRET
    SECRET = server_secret()
    init_db()
    if ADMIN_PASSWORD and len(ADMIN_PASSWORD) < 10:
        print("Refusing to start: LCK_ADMIN_PASSWORD must be at least 10 characters.", file=sys.stderr)
        sys.exit(1)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Love Cards Kenya running at http://{HOST}:{PORT}/")
    print("Admin: " + ("enabled at /admin.html" if ADMIN_PASSWORD else "disabled (set LCK_ADMIN_PASSWORD to enable)"))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
