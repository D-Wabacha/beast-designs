# Love Cards Kenya by BeasT Designs

A mobile-first storefront for personalised greeting cards. Customers browse designs, personalise them with a live preview, place an order, pay by M-PESA (Pochi La Biashara), and hand off to WhatsApp. Staff verify payments and release final files from a password-protected admin page.

Plain HTML, CSS and JavaScript (ES modules), plus a Python server that uses only the standard library. Nothing to install.

## Run it locally

```bash
LCK_ADMIN_PASSWORD='choose-a-long-password' python3 server.py
# open http://127.0.0.1:8000/
```

Without `LCK_ADMIN_PASSWORD` the shop works, but the admin page stays switched off.

| Setting | Default | Purpose |
|---|---|---|
| `LCK_HOST` / `LCK_PORT` | `127.0.0.1` / `8000` | Where the server listens |
| `LCK_ADMIN_PASSWORD` | unset (admin off) | Password for `/admin.html`. Minimum 10 characters |
| `LCK_SECRET` | auto-generated in `var/secret.key` | Signs customer order links. Keep it stable, or old order links stop working |
| `LCK_DB` | `var/orders.sqlite3` | Order database |
| `LCK_SECURE_COOKIES=1` | off | Set when served over HTTPS |
| `LCK_TRUST_PROXY=1` | off | Set when behind a reverse proxy that sets `X-Forwarded-For` / `X-Forwarded-Host` |

The pages must be served by `server.py` (or another server). They won't work when opened directly as files, because ES modules and the order API need HTTP.

## Changing business details, prices and designs

Everything lives in `data/` as JSON. The browser and the server read the same files, and the server reloads them automatically when they change.

- **`data/business.json`**: business name, phone/WhatsApp numbers, Pochi number, payment steps and notes, formats and their price differences, delivery options. `siteUrl` should be set to the public URL once deployed (used in the sitemap).
- **`data/templates.json`**: card designs. Each has a stable `id`, `price` (`type`: `fixed`, `from` or `bundle`), `status` (`published` to show it), `featured` (shown on the homepage, in catalogue order), `new` (adds a "New" badge and lists it in the homepage's new-collection section), the `faces` (artwork motif + allowed colour palettes), editable `fields` (label, max length, required) and `suggestions`. Set `status` to anything else to hide a design.
- **`data/occasions.json`**: occasion categories, groups and search synonyms (e.g. "pole", "harusi", "KCSE").

Card artwork is drawn in code (`js/card/motifs.js`), so every design is original and renders identically on screen and in the high-resolution export. New designs can reuse any existing motif with different palettes and words.

Designs can also use a picture as the background instead of a drawn motif. These faces have an `art` object in place of `motif`: `src` (a 1000 × 1500 JPEG in `assets/templates/`), `zones` (the boxes where the text goes, on a 100 × 150 grid; a zone with `roles` takes only those fields, and the rest go to the zone without `roles`; `ink`/`accent` fix a zone's text colour, `panel` puts a soft backing behind it) and an optional `shadow` for text on busy, dark artwork. To add or change one, put the original image in a folder, add it to `ART` in `tools/prepare_art.py` (crop, plus any sample text to erase), and run `python3 tools/prepare_art.py <folder>` (needs Pillow). This crops it to 2:3 and saves it.

## How ordering works

1. **Customise.** `customize.html?t=<id>` shows the live canvas preview (with a faint "preview" mark). Drafts auto-save in the browser.
2. **Checkout.** `checkout.html` collects name, phone (validated as a Kenyan mobile number), optional email, format, delivery channel and consent. The server re-validates everything and **computes the price itself**.
3. **Order saved.** The server stores the order in SQLite with status `awaiting_payment` and returns a reference (e.g. `LCK-7K2Q9M`) and a private link `order.html?ref=…&key=…`.
4. **Pay.** The order page shows the exact amount, Pochi number, step-by-step instructions, and a form for the M-PESA code. Submitting a code only moves the order to `verification_pending`. **Customers can never mark an order as paid.**
5. **Verify.** Staff open `/admin.html`, check the code and amount against the M-PESA statement, and click *Confirm payment received* → `paid`, then *Mark card ready* → `ready`, then `completed`. Duplicate codes across orders are flagged.
6. **Deliver.** Once `ready`, the customer's order page enables the full-resolution PNG download. Admin can also download the final files and message the customer on WhatsApp.

Customers who lose their link can look up an order with reference + phone at `order.html`.

### WhatsApp
`js/whatsapp.js` builds `https://wa.me/254705459618?text=…` links with `encodeURIComponent`. Opening one only pre-fills a message in WhatsApp. Nothing is sent until the customer presses send, and the site says so.

### Exports
`js/card/render.js` draws each card at any width. Digital = 1200 × 1800 px PNG, Printable = 2400 × 3600 px PNG (2:3 portrait, set in `business.json`). Files are produced in the browser from the stored order, without the preview mark.

## What still needs a business decision or an external service

- **Automatic M-PESA verification.** Pochi La Biashara has no developer API, so payment checks are manual. Automating it needs a Till or Paybill with Safaricom Daraja API access (or a payment aggregator). Its callbacks would be verified on the server and then call the same status change the admin uses (`admin_set_status(ref, "paid", …)` in `server.py`), keyed by the M-PESA transaction ID for idempotency. Credentials would belong in server environment variables, never in the frontend.
- **Prices for new designs and the printable-file surcharge (+KES 100)** are proposals. Edit them in the JSON files.
- **Privacy and terms pages** describe what the software actually does, but the owner should review them, set a data-retention period, and consider Kenya's Data Protection Act obligations.
- **Physical printing/delivery** is modelled but disabled (`"enabled": false` on the `printed` format). Turn it on only once it's actually offered.
- **Hosting:** deploy behind HTTPS (e.g. a small VPS with Caddy or nginx in front of `server.py`), set `LCK_SECURE_COOKIES=1`, a strong `LCK_ADMIN_PASSWORD`, a stable `LCK_SECRET`, and `siteUrl`. Back up `var/orders.sqlite3`.
- **Business hours and an email address** aren't set and aren't shown anywhere. Add them to `business.json` if wanted.
- **Social preview image:** pages have Open Graph titles and descriptions but no share image yet.

## Content protection note

The final PNG is rendered in the customer's browser from their own stored design. The download button only appears once staff have marked the order ready. A technically skilled user could still reproduce a design from the preview, since the artwork code is public. If that matters, move rendering to the server (for example a headless-browser render job) and serve files only to authorised orders.

## Tests

```bash
python3 -m unittest discover -s tests -v          # API: validation, pricing, payment states, admin auth, static allowlist
LCK_PORT=8765 LCK_ADMIN_PASSWORD=dev-admin-password-123 python3 server.py &
python3 tests/e2e.py http://localhost:8765 dev-admin-password-123   # full browser journey in headless Chrome
```

## Project layout

```
server.py              Python server: static files, order API, admin API (stdlib only)
data/                  business.json, templates.json, occasions.json
css/styles.css         Design tokens and all styles
js/card/               paint.js (drawing helpers), motifs.js (artwork), render.js (layout, preview, export)
js/pages/              One script per page
js/*.js                data, validation, WhatsApp links, storage, API client, shared UI
*.html                 Pages: index, shop, customize, checkout, order, help, privacy, terms, admin, 404
assets/templates/      Background pictures for image-based designs
tools/                 prepare_art.py (turns raw artwork into 2:3 card backgrounds)
tests/                 test_server.py (API), e2e.py (browser)
legacy/                The original React prototype, kept for reference (not served)
```
