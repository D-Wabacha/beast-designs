"""End-to-end browser test using headless Chrome via the DevTools protocol (stdlib only).

Requires a running server with an admin password, e.g.:
  LCK_PORT=8765 LCK_ADMIN_PASSWORD=dev-admin-password-123 python3 server.py
Then:
  python3 tests/e2e.py http://localhost:8765 dev-admin-password-123
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"
ADMIN_PW = sys.argv[2] if len(sys.argv) > 2 else "dev-admin-password-123"
CHROME = shutil.which("google-chrome") or shutil.which("chromium") or "google-chrome"


class CDP:
    def __init__(self, ws_url):
        u = urllib.parse.urlparse(ws_url)
        self.sock = socket.create_connection((u.hostname, u.port))
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                           f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(4096)
        assert b" 101 " in resp.split(b"\r\n")[0], resp
        self.buf = resp.split(b"\r\n\r\n", 1)[1]
        self.next_id = 0
        self.events = []

    def _recv_exact(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _recv_frame(self):
        message = b""
        while True:
            b1, b2 = self._recv_exact(2)
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._recv_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._recv_exact(8))[0]
            message += self._recv_exact(length)
            if b1 & 0x80:
                return message

    def send(self, method, params=None, timeout=30):
        self.next_id += 1
        mid = self.next_id
        payload = json.dumps({"id": mid, "method": method, "params": params or {}}).encode()
        header = bytes([0x81])
        n = len(payload)
        if n < 126:
            header += bytes([0x80 | n])
        elif n < 65536:
            header += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            header += bytes([0x80 | 127]) + struct.pack(">Q", n)
        mask = os.urandom(4)
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self._recv_frame())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.events.append(msg)
        raise TimeoutError(method)


class Browser:
    def __init__(self):
        self.profile = tempfile.mkdtemp()
        self.downloads = tempfile.mkdtemp()
        self.proc = subprocess.Popen([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9333",
                                      f"--user-data-dir={self.profile}", "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen("http://127.0.0.1:9333/json"))
                page = next(t for t in targets if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.2)
        self.cdp = CDP(page["webSocketDebuggerUrl"])
        for domain in ("Page", "Runtime", "Log"):
            self.cdp.send(f"{domain}.enable")
        self.cdp.send("Browser.setDownloadBehavior", {"behavior": "allow", "downloadPath": self.downloads})
        self.viewport(1280, 900)

    def viewport(self, w, h, mobile=False):
        self.cdp.send("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": mobile})

    def js(self, expr, await_promise=True):
        r = self.cdp.send("Runtime.evaluate", {"expression": expr, "awaitPromise": await_promise, "returnByValue": True})
        if "exceptionDetails" in r:
            raise RuntimeError(f"JS error in {expr[:80]}: {r['exceptionDetails']}")
        return r["result"].get("value")

    def goto(self, url):
        self.cdp.send("Page.navigate", {"url": url})
        self.wait_ready()

    def wait_ready(self, timeout=15):
        time.sleep(0.3)
        self.wait_for("document.readyState === 'complete' && !document.querySelector('#app > .loading, .loading:only-child')", timeout)
        time.sleep(0.4)

    def wait_for(self, expr, timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if self.js(f"!!({expr})"):
                    return
            except RuntimeError:
                pass
            time.sleep(0.2)
        raise TimeoutError(expr)

    def errors(self):
        out = []
        for e in self.cdp.events:
            m, p = e.get("method"), e.get("params", {})
            if m == "Runtime.exceptionThrown":
                out.append(p["exceptionDetails"].get("exception", {}).get("description") or p["exceptionDetails"]["text"])
            elif m == "Runtime.consoleAPICalled" and p.get("type") == "error":
                out.append(" ".join(str(a.get("value", a.get("description", ""))) for a in p["args"]))
            elif m == "Log.entryAdded" and p["entry"]["level"] == "error" and "favicon" not in p["entry"].get("url", ""):
                # 4xx from deliberate negative API checks are expected
                if "status of 4" not in p["entry"]["text"]:
                    out.append(p["entry"]["text"] + " " + p["entry"].get("url", ""))
        self.cdp.events.clear()
        return out

    def close(self):
        self.proc.terminate()


PASSED, FAILED = [], []


def check(name, cond, detail=""):
    (PASSED if cond else FAILED).append(name)
    print(("  ✓ " if cond else "  ✗ ") + name + ("" if cond else f"  -- {detail}"))


def set_value(b, selector, value):
    b.js(f"""(() => {{ const el = document.querySelector({json.dumps(selector)});
      el.value = {json.dumps(value)}; el.dispatchEvent(new Event('input', {{bubbles:true}})); el.dispatchEvent(new Event('change', {{bubbles:true}})); }})()""")


def click(b, selector):
    b.js(f"document.querySelector({json.dumps(selector)}).click()")


def main():
    b = Browser()
    try:
        print("Pages load without errors, no horizontal overflow at 360px")
        pages = ["/", "/shop.html", "/shop.html?occasion=sympathy", "/customize.html", "/customize.html?t=good-morning-good-night",
                 "/customize.html?t=business-appreciation", "/checkout.html", "/order.html", "/help.html", "/privacy.html",
                 "/terms.html", "/admin.html", "/does-not-exist"]
        for w in (360, 1280):
            b.viewport(w, 800, mobile=w < 500)
            for p in pages:
                b.goto(BASE + p)
                overflow = b.js("document.documentElement.scrollWidth - window.innerWidth")
                errs = b.errors()
                check(f"{p} @{w}px", not errs and overflow <= 0, f"errors={errs} overflow={overflow}")

        b.viewport(1280, 900)
        print("Navigation links resolve")
        b.goto(BASE + "/")
        links = b.js("[...document.querySelectorAll('#site-nav a, .site-footer a')].map(a => a.href).filter(h => h.startsWith(location.origin))")
        bad = []
        for href in sorted(set(links)):
            try:
                urllib.request.urlopen(href.split("#")[0])
            except Exception as e:
                bad.append(f"{href}: {e}")
        check("all header/footer links return 200", not bad, bad)
        wa = b.js("[...document.querySelectorAll('a[href*=\"wa.me\"]')].map(a => a.href)")
        check("WhatsApp links use 254705459618", wa and all(h.startswith("https://wa.me/254705459618") for h in wa), wa)
        check("tel links use +254705459618", b.js("[...document.querySelectorAll('a[href^=\"tel:\"]')].every(a => a.getAttribute('href') === 'tel:+254705459618')"))

        print("Catalogue search and filters")
        b.goto(BASE + "/shop.html")
        total = b.js("document.querySelectorAll('#results .product').length")
        check("catalogue lists all published designs", total == 28, total)
        set_value(b, "#f-q", "pole")
        time.sleep(0.5)
        names = b.js("[...document.querySelectorAll('#results .product-name')].map(e => e.textContent)")
        check("Swahili search 'pole' finds sympathy card", "Quiet Lilies" in names, names)
        set_value(b, "#f-q", "zzzzqqq")
        time.sleep(0.5)
        check("empty state shown", b.js("!!document.querySelector('.empty-state')"))
        click(b, "[data-clear]")
        set_value(b, "#f-price", "150")
        time.sleep(0.3)
        prices = b.js("[...document.querySelectorAll('#results .product-price')].map(e => e.textContent)")
        check("price filter ≤150", prices and all("150" in p for p in prices), prices)
        set_value(b, "#f-price", "")
        set_value(b, "#f-sort", "price-desc")
        time.sleep(0.3)
        first = b.js("document.querySelector('#results .product-price').textContent")
        check("sort by price high→low", "300" in first, first)

        print("Customiser")
        b.goto(BASE + "/customize.html?t=roses-and-gold")
        before = b.js("document.querySelector('#preview').toDataURL()")
        set_value(b, "#f-recipient", "")
        click(b, "#editor button[type=submit]")
        time.sleep(0.3)
        check("required recipient blocks continue", "checkout" not in b.js("location.href") and b.js("document.querySelector('#f-recipient-err').textContent").strip() != "")
        set_value(b, "#f-recipient", "Amina & Co <test> \"quotes\"")
        set_value(b, "#f-sender", "Brian")
        time.sleep(0.3)
        after = b.js("document.querySelector('#preview').toDataURL()")
        check("preview updates when typing", before != after)
        click(b, "input[name=palette-main][value=oxblood]")
        click(b, "input[name=font][value=script]")
        time.sleep(0.3)
        check("text colour options respect contrast", b.js("document.querySelector('input[name=ink][value=charcoal]').disabled === true"))
        set_value(b, "#size", "115")
        set_value(b, "#f-message", ("Congratulations " * 30)[:320])
        time.sleep(0.4)
        check("max-length message at largest size still fits (no truncation warning)", not b.js("!!document.querySelector('#fit-notice .notice-warn')"))
        set_value(b, "#f-message", "x" * 2000)
        time.sleep(0.4)
        check("oversized message flagged and blocks ordering", b.js("!!document.querySelector('#fit-notice .notice-warn')"))
        set_value(b, "#size", "100")
        set_value(b, "#f-message", "Nakupenda — today & always. 100% yours ❤")
        click(b, "input[name=format][value=printable]")
        time.sleep(0.2)
        check("total updates with format (KES 300)", b.js("document.querySelector('#total').textContent") == "KES 300", b.js("document.querySelector('#total').textContent"))
        share = b.js("""(async () => { let url = null; navigator.clipboard.writeText = async t => { url = t; }; document.querySelector('#share').click(); await new Promise(r => setTimeout(r, 200)); return url; })()""")
        check("share link generated", bool(share) and "#d=" in share, share)
        click(b, "#editor button[type=submit]")
        b.wait_ready()
        check("continue goes to checkout", "checkout.html" in b.js("location.href"))

        print("Checkout")
        summary = b.js("document.querySelector('.summary').textContent")
        check("summary shows design, format, total", "Roses & Gold" in summary and "Printable file" in summary and "KES 300" in summary, summary[:200])
        click(b, "#place-order")
        time.sleep(0.3)
        check("checkout validation shows errors", b.js("document.querySelectorAll('#order-form .has-error').length") >= 3)
        set_value(b, "#c-name", "Wanjiru Kamau")
        set_value(b, "#c-phone", "0712 345 678")
        click(b, "input[name=consent]")
        click(b, "#place-order")
        b.wait_for("location.href.includes('order.html')", 15)
        b.wait_ready()
        url = b.js("location.href")
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        ref, key = q["ref"][0], q["key"][0]
        check("order created with reference", ref.startswith("LCK-"), url)

        print("Order confirmation & payment")
        text = b.js("document.body.innerText")
        check("status is awaiting payment", "Awaiting payment" in text)
        check("payment number and exact amount shown", "0705459618" in text and "KES 300" in text)
        for phrase in ("Payment received", "Payment verified", "Order paid", "Downloading"):
            check(f"no false claim: '{phrase}'", phrase not in text)
        check("download disabled before payment", b.js("!document.querySelector('#download')"))
        wa = b.js("[...document.querySelectorAll('a[href*=\"wa.me\"]')].map(a => a.href).find(h => h.includes('text=') && h.includes('Order%20reference'))")
        msg = urllib.parse.unquote(urllib.parse.urlparse(wa).query.split("text=", 1)[1])
        check("WhatsApp order message has reference, card, recipient, price",
              ref in msg and "Roses & Gold" in msg and "Amina & Co <test> \"quotes\"" in msg and "KES 300" in msg and "Wanjiru Kamau" in msg, msg)
        check("WhatsApp message is URL-encoded", "&" not in wa.split("text=", 1)[1] and " " not in wa)
        set_value(b, "#p-code", "123")
        click(b, "#claim button[type=submit]")
        time.sleep(0.3)
        check("invalid M-PESA code rejected", b.js("document.querySelector('#p-code-err').textContent").strip() != "")
        set_value(b, "#p-code", "sjk3abcd12")
        click(b, "#claim button[type=submit]")
        time.sleep(2)
        b.wait_ready()
        text = b.js("document.body.innerText")
        check("after code: payment being verified (not paid)", "Payment being verified" in text and "Payment confirmed" not in text.split("Timeline")[0], text[:300])

        print("Admin")
        b.goto(BASE + "/admin.html")
        set_value(b, "#pw", "wrong-password")
        click(b, "#login button")
        time.sleep(1.2)
        check("wrong admin password rejected", "isn't right" in b.js("document.body.innerText"))
        set_value(b, "#pw", ADMIN_PW)
        click(b, "#login button")
        b.wait_for(f"document.querySelector('[data-ref=\"{ref}\"]')")
        click(b, f"[data-ref=\"{ref}\"]")
        b.wait_for("document.querySelector('[data-status=paid]')")
        check("admin sees submitted code", "SJK3ABCD12" in b.js("document.querySelector('#detail').innerText"))
        for status in ("paid", "ready"):
            click(b, f"[data-status={status}]")
            b.wait_for("document.querySelector('dialog[open]')")
            click(b, "dialog[open] button[value=ok]")
            b.wait_for(f"document.querySelector('#detail .status-pill.status-{status}')")
        check("admin moved order to ready", True)

        print("Customer download after fulfilment")
        b.goto(f"{BASE}/order.html?ref={ref}&key={key}")
        check("download enabled once ready", b.js("!!document.querySelector('#download')"))
        click(b, "#download")
        deadline = time.time() + 15
        files = []
        while time.time() < deadline:
            files = [f for f in os.listdir(b.downloads) if f.endswith(".png")]
            if files:
                break
            time.sleep(0.3)
        ok = False
        if files:
            time.sleep(0.5)
            with open(os.path.join(b.downloads, files[0]), "rb") as f:
                head = f.read(24)
            w, h = struct.unpack(">II", head[16:24])
            ok = (w, h) == (2400, 3600)
        check("downloaded PNG is 2400×3600 (printable format)", ok, files)

        print("Errors during flow")
        errs = b.errors()
        check("no console errors during flow", not errs, errs)
    finally:
        b.close()
    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
