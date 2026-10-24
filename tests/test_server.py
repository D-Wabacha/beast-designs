"""API tests for server.py. Run: python3 -m unittest discover -s tests -v"""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

TMP = tempfile.mkdtemp()
os.environ["LCK_VAR_DIR"] = TMP
os.environ["LCK_DB"] = str(Path(TMP) / "test.sqlite3")
os.environ["LCK_ADMIN_PASSWORD"] = "test-admin-password"
os.environ["LCK_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server  # noqa: E402


def valid_order(**over):
    body = {
        "templateId": "roses-and-gold",
        "formatId": "digital",
        "values": {"recipient": "Amina", "title": "For you", "message": "Nakupenda — always & forever ❤", "sender": "Brian"},
        "design": {"font": "script", "align": "left", "size": 105, "ink": "accent", "palettes": {"main": "oxblood"}},
        "customer": {"name": "Wanjiru K", "phone": "0712 345 678", "email": ""},
        "channel": "whatsapp",
        "notes": "",
        "consent": True,
    }
    body.update(over)
    return body


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.SECRET = server.server_secret()
        server.init_db()
        server.LIMITS["order"] = (1000, 600)
        server.LIMITS["claim"] = (1000, 600)
        cls.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def req(self, method, path, body=None, headers=None, cookie=None):
        h = {"X-Requested-With": "lck"}
        if body is not None:
            h["Content-Type"] = "application/json"
        if cookie:
            h["Cookie"] = cookie
        h.update(headers or {})
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(r) as res:
                raw = res.read()
                return res.status, (json.loads(raw) if res.headers.get_content_type() == "application/json" else raw), res.headers
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw), e.headers
            except json.JSONDecodeError:
                return e.code, raw, e.headers

    def admin_cookie(self):
        status, _, headers = self.req("POST", "/api/admin/login", {"password": "test-admin-password"})
        self.assertEqual(status, 200)
        return headers["Set-Cookie"].split(";")[0]

    # ---- ordering
    def test_create_order_prices_server_side(self):
        status, res, _ = self.req("POST", "/api/orders", valid_order(formatId="printable"))
        self.assertEqual(status, 201)
        self.assertRegex(res["reference"], r"^LCK-[A-Z0-9]{6}$")
        self.assertEqual(res["total"], 300)  # 200 card + 100 printable
        self.assertEqual(res["status"], "awaiting_payment")
        status, view, _ = self.req("GET", f"/api/orders/{res['reference']}?key={res['accessKey']}")
        self.assertEqual(status, 200)
        self.assertEqual(view["values"]["message"], "Nakupenda — always & forever ❤")
        self.assertEqual(view["design"]["palettes"], {"main": "oxblood"})
        self.assertEqual(view["exportWidth"], 2400)
        self.assertNotIn("phone", view["customer"])

    def test_client_cannot_set_price_or_status(self):
        status, res, _ = self.req("POST", "/api/orders", valid_order(total=1, status="paid", price=1))
        self.assertEqual(status, 201)
        self.assertEqual(res["total"], 200)
        self.assertEqual(res["status"], "awaiting_payment")

    def test_validation_errors(self):
        body = valid_order(customer={"name": "", "phone": "123", "email": "bad"}, consent=False)
        status, res, _ = self.req("POST", "/api/orders", body)
        self.assertEqual(status, 400)
        self.assertEqual(set(res["fields"]), {"name", "phone", "email", "consent"})

    def test_required_card_fields(self):
        status, res, _ = self.req("POST", "/api/orders", valid_order(values={"recipient": ""}))
        self.assertEqual(status, 400)
        self.assertIn("recipient", res["fields"])

    def test_too_long_message_rejected(self):
        status, res, _ = self.req("POST", "/api/orders", valid_order(values={"recipient": "A", "message": "x" * 400}))
        self.assertEqual(status, 400)
        self.assertIn("message", res["fields"])

    def test_unknown_template_and_disabled_format(self):
        self.assertEqual(self.req("POST", "/api/orders", valid_order(templateId="nope"))[0], 400)
        self.assertEqual(self.req("POST", "/api/orders", valid_order(formatId="printed"))[0], 400)

    def test_invalid_design_falls_back_to_safe_defaults(self):
        status, res, _ = self.req("POST", "/api/orders", valid_order(design={"font": "comic", "size": 999, "palettes": {"main": "hotpink"}}))
        self.assertEqual(status, 201)
        _, view, _ = self.req("GET", f"/api/orders/{res['reference']}?key={res['accessKey']}")
        self.assertEqual(view["design"]["size"], 115)
        self.assertEqual(view["design"]["palettes"]["main"], "ivory-wine")
        self.assertEqual(view["design"]["font"], "classic")

    def test_wrong_key_hides_order(self):
        _, res, _ = self.req("POST", "/api/orders", valid_order())
        status, _, _ = self.req("GET", f"/api/orders/{res['reference']}?key=wrong")
        self.assertEqual(status, 404)

    def test_csrf_header_required(self):
        status, _, _ = self.req("POST", "/api/orders", valid_order(), headers={"X-Requested-With": ""})
        self.assertEqual(status, 403)
        status, _, _ = self.req("POST", "/api/orders", valid_order(), headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)

    # ---- payment
    def test_payment_claim_never_marks_paid(self):
        _, res, _ = self.req("POST", "/api/orders", valid_order())
        ref, key = res["reference"], res["accessKey"]
        status, _, _ = self.req("POST", f"/api/orders/{ref}/payment-claim", {"key": key, "code": "abc"})
        self.assertEqual(status, 400)
        status, claim, _ = self.req("POST", f"/api/orders/{ref}/payment-claim", {"key": key, "code": "sjk3abcd12"})
        self.assertEqual(status, 200)
        self.assertEqual(claim["status"], "verification_pending")
        _, view, _ = self.req("GET", f"/api/orders/{ref}?key={key}")
        self.assertEqual(view["status"], "verification_pending")
        self.assertEqual(view["payment"]["code"], "SJK3ABCD12")
        # resubmitting is idempotent
        status, again, _ = self.req("POST", f"/api/orders/{ref}/payment-claim", {"key": key, "code": "SJK3ABCD12"})
        self.assertTrue(again.get("unchanged"))
        # wrong key cannot submit
        self.assertEqual(self.req("POST", f"/api/orders/{ref}/payment-claim", {"key": "x", "code": "SJK3ABCD12"})[0], 404)

    def test_lookup_by_reference_and_phone(self):
        _, res, _ = self.req("POST", "/api/orders", valid_order())
        status, found, _ = self.req("POST", "/api/orders/lookup", {"reference": res["reference"].lower(), "phone": "+254712345678"})
        self.assertEqual(status, 200)
        self.assertEqual(found["accessKey"], res["accessKey"])
        status, _, _ = self.req("POST", "/api/orders/lookup", {"reference": res["reference"], "phone": "0799999999"})
        self.assertEqual(status, 404)

    # ---- admin
    def test_admin_requires_login(self):
        self.assertEqual(self.req("GET", "/api/admin/orders")[0], 401)
        self.assertEqual(self.req("POST", "/api/admin/login", {"password": "wrong"})[0], 401)

    def test_admin_workflow(self):
        _, res, _ = self.req("POST", "/api/orders", valid_order())
        ref = res["reference"]
        cookie = self.admin_cookie()
        status, listing, _ = self.req("GET", "/api/admin/orders", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertIn(ref, [o["reference"] for o in listing["orders"]])
        # cannot jump to completed
        self.assertEqual(self.req("POST", f"/api/admin/orders/{ref}/status", {"status": "completed"}, cookie=cookie)[0], 400)
        for s in ("paid", "ready", "completed"):
            status, view, _ = self.req("POST", f"/api/admin/orders/{ref}/status", {"status": s}, cookie=cookie)
            self.assertEqual(status, 200, view)
            self.assertEqual(view["status"], s)
        self.assertEqual(view["customer"]["phone"], "254712345678")
        # customers can no longer claim once completed
        status, _, _ = self.req("POST", f"/api/orders/{ref}/payment-claim", {"key": res["accessKey"], "code": "SJK3ABCD12"})
        self.assertEqual(status, 400)

    def test_duplicate_payment_codes_flagged(self):
        cookie = self.admin_cookie()
        refs = []
        for _ in range(2):
            _, res, _ = self.req("POST", "/api/orders", valid_order())
            self.req("POST", f"/api/orders/{res['reference']}/payment-claim", {"key": res["accessKey"], "code": "DUPL1CATE9"})
            refs.append(res["reference"])
        _, view, _ = self.req("GET", f"/api/admin/orders/{refs[1]}", cookie=cookie)
        self.assertIn(refs[0], view["duplicatePaymentCodeOn"])

    # ---- static
    def test_static_allowlist(self):
        self.assertEqual(self.req("GET", "/")[0], 200)
        self.assertEqual(self.req("GET", "/js/ui.js")[0], 200)
        self.assertEqual(self.req("GET", "/data/templates.json")[0], 200)
        self.assertEqual(self.req("GET", "/server.py")[0], 404)
        self.assertEqual(self.req("GET", "/var/test.sqlite3")[0], 404)
        self.assertEqual(self.req("GET", "/js/../server.py")[0], 404)
        self.assertEqual(self.req("GET", "/legacy/prototype-react.jsx")[0], 404)
        status, body, _ = self.req("GET", "/sitemap.xml")
        self.assertEqual(status, 200)
        self.assertIn(b"customize.html?t=roses-and-gold", body)


if __name__ == "__main__":
    unittest.main()
