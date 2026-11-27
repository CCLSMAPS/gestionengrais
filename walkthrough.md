# Security Summary

**Reviewed Files**: 17
**Issues Resolved**: 10

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Static File Exposure & Path Resolution | `server.js` | 33–127 | Static asset serving relied on a denylist (`BLOCKED_FILES`) instead of an explicit allowlist, risking exposure of newly added config, documentation, or source files. | High | Fixed | Replaced the denylist with strict `ALLOWED_ROOT_FILES`, `ALLOWED_DIST_FILES`, and `/assets/` path-confinement checks (`path.resolve` + `startsWith(dir + path.sep)`), rejecting null bytes, backslashes, and `..` segments with `404`. |
| Missing HTTP Security Headers | `server.js` | 16, 55–75 | Server responses omitted defensive browser headers and advertised the `X-Powered-By` Express header. | Medium | Fixed | Disabled `X-Powered-By` and added `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `X-DNS-Prefetch-Control`. |
| Client-Side Auth Bypass (`localStorage`) | `dashboard.html` | 314–326 | `dashboard.html` relied on a spoofable `localStorage` flag (`ccls_logged`) and contained a typo in the Supabase project key (`ibnkdlpk...`). | High | Fixed | Replaced the `localStorage` gate with `db.auth.getSession()` and `db.auth.signOut()`, and aligned the Supabase project key with `common.js`. |
| Unsanitized HTML Rendering (Stored XSS) | `dashboard.html`, `users.html`, `warehouse.html`, `index.html` | `dashboard.html:299, 363–544`; `users.html:71–75, 102–104, 146–150`; `warehouse.html:263–284, 441–466`; `index.html:204–212, 356–365, 579–587` | Several table cells, modal summaries, role/permission checkboxes, and inline `onclick` attributes interpolated database strings directly into `innerHTML`. | High | Fixed | Escaped all dynamic values via `esc()` / `escHtml()`, removed interpolated inline event attributes, and switched dynamic buttons to `data-*` event delegation. |
| Spreadsheet Formula Injection in CSV Exports | `common.js` | 59–72 | Exported CSV cells containing leading `=`, `+`, `-`, `@`, tab, or carriage-return characters were written verbatim, allowing formula execution in Excel/LibreOffice. | Medium | Fixed | Prefixed dangerous leading formula characters with `'` while preserving legitimate negative numbers (e.g., `-12.5`), and revoked object URLs after download. |
| Missing Positive Quantity & Input Validation | `index.html`, `bons.html`, `dashboard.html`, `common.js` | `index.html:142, 437, 638`; `bons.html:353`; `dashboard.html:389, 491, 552`; `common.js:52–57` | Forms could submit zero, negative, or `NaN` quantities or empty product names, corrupting inventory and invoice balances. | Medium | Fixed | Enforced `Number.isFinite(qty) && qty > 0` across stock-in, invoice, pickup, and bon-de-sortie handlers, and validated non-empty product names in `productId()`. |
| Silent Join-Table Wipeout on Update Failure | `warehouse.html`, `users.html` | `warehouse.html:495–501`; `users.html:92–93` | Deleting `warehouse_categories` or `role_permissions` ignored errors before re-inserting rows, risking partial or empty permission/category sets. | Medium | Fixed | Added explicit error checks (`delErr`, `insErr`, `delPermErr`) that abort and notify the user before proceeding. |
| Wrong Row Update on Duplicate Dossier Numbers | `crops.html` | 134, 142 | Superficie updates matched only `dossier_no`, updating the wrong row when a dossier number appeared across multiple seasons. | Medium | Fixed | Bound each row input to its exact array index (`data-sup-idx`) so updates target the selected dossier record. |
| Database Helper Search Path & Blocked User RLS | `supabase-setup.sql`, `supabase-dossiers.sql`, `supabase-bons.sql` | `supabase-setup.sql:12–38`; `supabase-dossiers.sql:27–50`; `supabase-bons.sql:24–47` | `public.is_admin()` lacked an explicit `search_path = ''`, and `dossier_receptions` / `bon_sorties` RLS policies did not check `profiles.is_blocked`. | High | Needs Follow-Up | Updated SQL migration scripts (`set search_path = ''`, `is_active_user()`, and non-blocked RLS predicates); project administrator must run the updated `.sql` files in Supabase SQL Editor. |
| `lockForms()` Null Crash on Forms Without Primary Button | `common.js` | 144–155 | `lockForms()` threw a `TypeError` on forms lacking `button.p` (such as `#ft` theme selector). | Low | Fixed | Guarded missing `button.p` elements in `lockForms()` before reading or updating button state. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Static Path Confinement | `server.js` | Only explicitly allowlisted root files, `dist/*.js` bundles, and files strictly inside `public/assets` are served; all configuration, SQL, source TypeScript, and documentation files return `404`. |
| Authentication & Role Checks | `common.js`, `dashboard.html` | Authenticated Supabase session (`getSession` / `onAuthStateChange`) and profile/role lookup govern UI access; blocked accounts (`is_blocked === true`) receive zero page permissions and an explicit suspension notice. |
| Database Queries | `common.js`, `index.html`, `warehouse.html`, `users.html`, `crops.html`, `bons.html`, `reception.html`, `dashboard.html` | All reads and writes go through the Supabase JS SDK parameterized query builder (`.eq()`, `.in()`, `.insert()`, `.update()`) rather than raw concatenated SQL. |
| Iframe & Preview Compatibility | `server.js`, `dashboard.html` | Disallowed `window.alert` dialogs were replaced with non-blocking toast notifications (`#dashToast`), and `X-Frame-Options` is intentionally omitted so the preview iframe loads normally while CSP protects script/resource origins. |

---

## PoC Verification

### 1. Path Traversal & Sensitive File Disclosure (`server.js`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Arbitrary File Exposure via Static Path Handling |
| Impact | High |
| Affected File | `server.js:33–127` |
| Test Scenario | `GET /server.js`, `GET /package.json`, `GET /supabase-setup.sql`, `GET /dist/../server.js`, `GET /%2e%2e/server.js`, `GET /walkthrough.md` |

#### How It Was Fixed
Replaced the `BLOCKED_FILES` denylist with explicit allowlists (`ALLOWED_ROOT_FILES`, `ALLOWED_DIST_FILES`) and confined `/assets/` paths inside `PUBLIC_ASSETS_DIR` after `decodeURIComponent`, null-byte/backslash rejection, and `..` filtering.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request `/%2e%2e/server.js` or `/supabase-setup.sql` enters `app.use()` at `server.js:124`. | Passed to `resolveSafePath(req.path)` |
| 2 | `resolveSafePath` decodes URI (`/../server.js`), verifies `ALLOWED_ROOT_FILES.has(decoded)` (`false`), checks `/dist/` and `/assets/` prefixes (`false`), and returns `null` at `server.js:111`. | Path rejected |
| 3 | Handler at `server.js:125–127` sees `!filePath` and responds `404 Not found`. | **Handled Safely** (verified live via HTTP test suite: all 15 blocked/traversal routes returned `404`) |

---

### 2. Stored XSS in User & Dashboard Tables (`users.html`, `dashboard.html`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized HTML Rendering |
| Impact | High |
| Affected File | `users.html:102–104, 146–150`; `dashboard.html:299, 423–449` |
| Test Scenario | A farmer name or permission label containing `<img src=x onerror=alert(1)>` or `" onclick="alert(1)` |

#### How It Was Fixed
All interpolated fields pass through `esc()` / `escHtml()`, encoding `&`, `<`, `>`, `"`, and `'` into HTML entities, and interactive row actions read `dataset` attributes via delegated listeners.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Payload `<img src=x onerror=alert(1)>` is loaded in `facturesList` (`dashboard.html:419`) or `ROLES`/`PERMS` (`users.html:102`). | Enters table template builder |
| 2 | `escHtml(f.nom_client)` (`dashboard.html:432`) and `esc(l)` (`users.html:103`) convert `<`, `>`, `"`, `'` to `&lt;`, `&gt;`, `&quot;`, `&#39;`. | Markup neutralized |
| 3 | Browser parses the table cell as plain text; no `<img>` node or `onerror` handler is created. | **Handled Safely** |

---

### 3. CSV Formula Injection (`common.js`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized Spreadsheet Export Cells |
| Impact | Medium |
| Affected File | `common.js:59–72` |
| Test Scenario | Exporting a farmer note or name set to `=CMD()` or `+1+1` vs negative numeric balance `-12.5` |

#### How It Was Fixed
`csv()` passes every cell through `safeCell()`, prefixing leading `=`, `+`, `-`, `@`, `\t`, or `\r` characters with a single quote (`'`) unless the value matches a plain negative number (`/^-\d+(\.\d+)?$/`).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `=CMD()` and `-12.5` are passed to `safeCell()` at `common.js:60–64`. | Evaluated by regex guard |
| 2 | `=CMD()` matches `/^[=+\-@\t\r]/` and fails `/^-\d+(\.\d+)?$/`, becoming `"'=CMD()"`; `-12.5` remains `"-12.5"`. | Formula neutralized; numeric sign preserved |
| 3 | Written to UTF-8 BOM CSV blob and temporary object URL revoked after 4s (`common.js:71`). | **Handled Safely** (verified via Node assertion test) |

---

### 4. Client-Side Auth Bypass (`dashboard.html`)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Session Verification |
| Impact | High |
| Affected File | `dashboard.html:314–326` |
| Test Scenario | Opening `/dashboard.html` with `localStorage.setItem('ccls_logged', 'true')` and no valid Supabase auth session |

#### How It Was Fixed
Removed the `localStorage` flag check and switched `DOMContentLoaded` to verify `await db.auth.getSession()`, redirecting unauthenticated visitors to `index.html`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Browser loads `dashboard.html` with forged `localStorage.ccls_logged`. | `DOMContentLoaded` listener runs (`dashboard.html:314`) |
| 2 | `db.auth.getSession()` (`dashboard.html:315`) checks signed Supabase session tokens; `data?.session` is `null`. | Forged local flag ignored |
| 3 | Execution enters `if (!data?.session)` (`dashboard.html:316–317`) and redirects to `index.html` without calling `init()`. | **Handled Safely** |
