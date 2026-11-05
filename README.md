# TimeDrop: Countdown Timer + Analytics

A Shopify app that adds countdown timers to product pages and counts how often shoppers see them.

## Features

- **Fixed timers:** start and end date; every shopper counts down to the same moment.
- **Evergreen timers:** a per-visitor countdown, stored in `localStorage`.
- **Targeting:** all products, specific products or specific collections (Shopify Resource Picker).
- **Appearance:** message, colors, size, position (inline, top bar or bottom bar) and an urgency pulse before the end.
- **Dashboard:** status (active, scheduled, expired), search, filter, sort and impressions per timer.
- **Storefront:** a Preact widget in a theme app block, 7.2 KB gzipped.

## Tech stack

| Part | Choice |
|---|---|
| Database | MongoDB with Mongoose. Shopify sessions use `@shopify/shopify-app-session-storage-mongodb` |
| Server | Node 22.12+ and React Router 7, served by `@react-router/serve` (Express). JavaScript only |
| Admin UI | React, Polaris web components, App Bridge |
| Storefront | Theme app extension, Preact, esbuild |
| Tests and lint | Vitest, ESLint |

## Setup

**You need:** Node 22.12+, MongoDB (local or Atlas), a Shopify Partner account with a development store, and Shopify CLI.

```bash
git clone https://github.com/mhdajfer/time-drop.git
cd time-drop
npm install
cp .env.example .env      # set MONGODB_URI, including the database name
npm run config:link       # link to your own app in the Partner Dashboard
npm run dev               # builds the widget, starts the tunnel and the app
```

1. Press `p` in the terminal to open the app in your store's admin. Create a timer there.
2. In the theme editor, open a product template and add **Apps → Countdown timer**, then save.
3. Open a product page in the store.

| Command | What it does |
|---|---|
| `npm run dev` | Runs `shopify app dev`, which builds the widget first |
| `npm test` | Runs the unit tests |
| `npm run lint` | Runs ESLint |
| `npm run build:widget` | Bundles the widget and prints its size |
| `npm run dev:widget` | Rebuilds the widget on every change |
| `npm run deploy` | Builds the widget, then runs `shopify app deploy` |

## Architecture

```
Admin (embedded in Shopify)                 Storefront product page
  Polaris pages                               Theme app block + Preact widget
        │ fetch, with App Bridge session token     │ GET/POST /apps/timedrop/*
        ▼                                          ▼
  /api/timers  (REST)                         Shopify App Proxy (adds a signature)
        │                                          │ /proxy/*
        └──────────────► React Router server ◄─────┘
                                │
                             MongoDB  (timers, shopify_sessions)
```

```
app/
  models/timer.server.js       Timer schema, indexes and shop-scoped queries
  routes/app.*                 Admin pages: dashboard, create and edit
  routes/api.*                 Admin REST API
  routes/proxy.*               Storefront API, reached through the app proxy
  components/                  Form, preview, delete dialog, status badge
  utils/                       Timer rules, validation, timezone, rate limiter, impression buffer
widget/src/                    Storefront widget, built into the extension
extensions/countdown-timer/    Theme app extension: app block and CSS
```

### Decisions

- **No custom Express server.** The template's production server (`@react-router/serve`) is already Express. Shopify's auth helpers (`authenticate.admin`, `authenticate.public.appProxy`) work directly in routes, and nothing in the PRD needs custom middleware.
- **Admin pages call the REST API.** They use `fetch`, and App Bridge adds the session token to each request.
- **App proxy for the storefront.** Requests are same-origin, so there's no CORS. Shopify signs every request, so the shop is verified, and no keys reach the browser.
- **Theme app extension, not ScriptTag.** The merchant places the block in the theme editor.
- **One validator for both sides.** [`app/utils/validate-timer.js`](app/utils/validate-timer.js) runs in the form for instant errors and again in the API.
- **Store timezone.** Dates are entered and shown in the store's timezone (`shop.ianaTimezone`) and stored in UTC.

## Data model

One `timers` collection. Fields: `shop`, `name`, `description` (the storefront message), `type` (`fixed` or `evergreen`), `startsAt`, `endsAt`, `durationMinutes`, `targetType` (`all`, `products` or `collections`), `targetIds` (Shopify GIDs), the appearance fields, `impressions`, and timestamps.

- **Shop isolation:** every query filters by `shop`. The shop always comes from the verified session or the app proxy signature, never from request input.
- **Analytics:** `impressions` is a counter on the timer, increased with `$inc`.
- **Evergreen timers:** stored with `endsAt: null`, so one "not ended" filter covers both timer types.

| Index | Used by |
|---|---|
| `{ shop, createdAt: -1 }` | Dashboard list |
| `{ shop, targetType, endsAt }` | Storefront lookup: timers for all products |
| `{ shop, targetIds, endsAt }` | Storefront lookup: product and collection timers |
| `shopify_sessions: { id }` (unique), `{ shop }` | Session lookups, added at startup because Shopify's MongoDB storage creates no indexes |

When several timers match a product, the product timer wins, then the collection timer, then the all-products timer. Ties go to the timer that ends first.

## API

### Admin API

Every request needs the App Bridge session token (`Authorization: Bearer ...`). All responses send `Cache-Control: no-store`.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/timers` | `200 { timers }` | 401 |
| POST | `/api/timers` | `201 { timer }` and a `Location` header | 400, 401, 422 |
| GET | `/api/timers/:id` | `200 { timer }` | 401, 404 |
| PUT | `/api/timers/:id` | `200 { timer }` | 400, 401, 404, 422 |
| DELETE | `/api/timers/:id` | `204` | 401, 404 |

- **Other methods:** `405` with an `Allow` header.
- **Unexpected errors:** `500`.
- **Error body:** `{ "error": "message", "errors": { "field": "message" } }`. The `errors` object is only sent with 422.
- **Other shops:** a timer belonging to another shop returns 404.

Request body for POST and PUT:

```json
{
  "name": "Black Friday",
  "description": "Black Friday sale ends in",
  "type": "fixed",
  "startsAt": "2026-11-27T05:00:00.000Z",
  "endsAt": "2026-12-01T04:59:00.000Z",
  "durationMinutes": null,
  "targetType": "collections",
  "targetIds": ["gid://shopify/Collection/123"],
  "backgroundColor": "#1a1a1a",
  "textColor": "#ffffff",
  "size": "medium",
  "position": "inline",
  "urgency": "pulse",
  "urgencyMinutes": 15
}
```

Responses return the stored timer, with `id` (in place of `_id`) and its current `status`.

### Storefront API (through the app proxy)

Shopify forwards `/apps/timedrop/*` to `/proxy/*` and signs each request. A missing or invalid signature returns `400`.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/apps/timedrop/timer?product=<id>&collections=<id,id>` | `200 { timer }`, or `{ timer: null }` | 400, 429 |
| POST | `/apps/timedrop/impressions` with body `{ "timerId": "..." }` | `202` | 400, 405, 429 |

The timer response is cached with `Cache-Control: public, max-age=60, stale-while-revalidate=60`. It contains only what the widget needs:

- `id`, `type`, `endsAt`, `durationMinutes`
- `message`
- `backgroundColor`, `textColor`, `size`, `position`
- `urgency`, `urgencyMinutes`

## Rate limiting

- **Storefront endpoints:** 300 requests per minute for each shop and shopper IP (`X-Forwarded-For`). This is a fixed window held in memory, and the limit returns `429` with `Retry-After`.
- **Admin API:** no app-level limit. Every call needs a valid session token.
- **Limitations:**
  - The counters live in one process. With several instances, they'd need a shared store such as Redis.
  - Shopify sometimes forwards its own IP in `X-Forwarded-For`, so the limit is set high enough not to throttle a busy store.

## Performance

Measured locally (Windows, MongoDB 6.0.8):

| What | Result | How it was measured |
|---|---|---|
| Widget bundle | 16.9 KB raw, **7.2 KB gzipped** | Printed by `npm run build:widget`. Preact is about 13 KB of the raw size |
| Timer endpoint | **p50 4.2 ms, p95 5.1 ms** | 100 signed requests through the production build, including the signature check, session lookup and query. Not measured through Shopify's proxy |
| Layout shift | **CLS 0** with an inline timer; **0.017** when the slot is released | `PerformanceObserver` in Chromium, on a local test page with a mock API |

What keeps it fast:

- **One request per product page,** cached for 60 seconds in the browser and in `sessionStorage`. The widget refetches only after a fixed timer ends.
- **Indexed, shop-scoped queries.** `explain()` shows index scans for the storefront lookup. Queries use `lean()` and load only the fields they need.
- **Batched impressions.** They're counted in memory and written every 5 seconds as one `bulkWrite`.
- **No layout shift.** The block reserves the timer's height (96 px). Digits are fixed-width, the pulse only uses `transform`, and reduced-motion settings are respected.
- **Widget size.** Shopify's guideline for app block JavaScript is 10 KB compressed. Theme Check measures raw bytes, so [`.theme-check.yml`](extensions/countdown-timer/.theme-check.yml) raises the raw threshold to cover Preact.

## Security

- **Admin:** `authenticate.admin` verifies the session token. A request with no token gets `401`.
- **Storefront:** `authenticate.public.appProxy` verifies Shopify's HMAC signature.
- **Database access:** every query is scoped to the authenticated shop. IDs are validated, so operator objects like `{ "$ne": null }` are rejected.
- **Input:** only known fields are kept. HTML is stripped, colors must be hex, options must match fixed lists, Shopify IDs must match their format, and lists are capped. Text is rendered escaped by React and Preact.
- **Browser data:** the storefront never receives the shop, internal names or impressions. Secrets stay in server environment variables.

## Testing

`npm test` runs 73 Vitest tests covering:

- timer status, matching and priority
- input validation and sanitizing
- timezone conversion and form value conversion
- the rate limiter and the impression buffer
- the widget's countdown and evergreen logic
- the admin and storefront route handlers, with Shopify auth and the database mocked

The admin UI and the theme block aren't covered by automated tests.

## Assumptions

- **Create and edit pages** are full pages instead of the modal in the reference screenshot.
- **Position:** "inline" means wherever the merchant places the block. "Top" and "bottom" are fixed bars.
- **Evergreen timers** restart after they run out, after 30 minutes away (a session), or if their length changes.
- **One timer per product:** product timers win, then collection timers, then all-products timers. Ties go to the timer that ends first.
- **An impression** is one page view where the timer was shown. Views in the theme editor aren't counted.
- **Fixed timers** use the shopper's clock. A server time correction would conflict with the 60-second response cache.

## Trade-offs and what I'd improve

- **Layout shift:** CLS is 0.017 when the reserved slot is released, either because the product has no timer or because the timer is a bar. Syncing a per-product hint to an app metafield would let the theme reserve space only when needed.
- **Single instance:** the rate limiter and impression buffer are in memory. Moving them to Redis would support several instances. A crash can lose up to 5 seconds of impressions.
- **Caching delay:** timer changes can take up to about a minute to show on the storefront.
- **Not built yet:**
  - GDPR compliance webhooks (required for the App Store)
  - deleting a shop's timers after uninstall
  - dashboard pagination
  - an on/off switch per timer
  - impression charts over time
- **More tests:** end-to-end tests for the admin UI and the theme block.
