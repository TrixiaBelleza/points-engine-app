# Points Engine — Admin Loyalty App

**Status:** Draft for review  
**Date:** 2026-08-26  
**Audience:** Product + engineering (admin web app; SQLite for members/ledger, JSON file for program settings)

This spec is written so you can change decisions without rewriting the whole document. Anything marked **[Open]** is a product call. Chat decisions already locked are in the **Your decision** column.

Two public instances ship: **production** and **staging**. ClouderaAI does **not** read the settings file; it `GET`s `/api/meta` on the production URL (§10.1).

---

## 1. Product summary

An **admin-only** loyalty app. Staff create members, log activities that award points, redeem points, and see when remaining points will expire.

Members do **not** have their own login in v1. Staff sign in on `/login`. There is **no sign-up**. The first **superadmin** is seeded; further admins are created on the **Admins** page.

**Program settings** (expiration interval, timezone, tier rules) are stored as **JSON on the instance filesystem**, not in SQLite. SQLite holds members, lots, ledger, and admin users.

### Example

Elena earns **200 points** on **26 Aug 2026, 14:14:32**.  
With a **1-year** expiration interval, those 200 points expire at **27 Aug 2027, 00:00:00** (app timezone) — end of the anniversary calendar day, not the same clock time as the earn. They remain spendable through **26 Aug 2027**; they are gone as of **27 Aug 2027 00:00**.

---

## 2. Goals and non-goals

### Goals (v1)

- Create and look up members (name + contact number).
- Log an activity against a member and award points (`Create Activity`).
- Redeem points from a member’s available balance.
- Expire unused points after a **global** interval: **6 months** or **1 year**. Expiry is **end of the anniversary calendar day**: earn on 26 Aug 2026 → expire **27 Aug 2027 00:00:00** (app timezone), not 26 Aug 2027 14:14:32.
- Member **page 1 — Points history:** last **3 months** of history by default, with a way to widen the range.
- Member **page 2 — Profile:** name, contact number, **tier**, **next expiration** (when + how many points).
- **Tiers** (Bronze / Silver / Gold / Platinum by default), based on points **earned** in a configurable lookback period. Rules are edited in Settings.
- **Login** (email + password). No public sign-up.
- **Admins** page: a superadmin or an admin creates other admins and sets their passwords.
- **Settings:** the signed-in user can change **their own** password. Saving expiration/tier rules writes the program-settings JSON for this environment.
- Two internet-facing instances (**production** and **staging**) plus public `GET /api/meta` (version/tag + current program settings).

### Non-goals (v1)

- Member-facing app, SMS, email, or wallet pass.
- Tier **multipliers**, exclusive rewards, or partner/brand programs (tier is a status label in v1).
- POS / payment integration (admin types the activity).
- Multi-location, multi-brand, or multi-tenant SaaS.
- Partial-point values (see **[Open] Q12**).
- Automated earning from receipts or CSV import.
- Public sign-up, member login, magic link, Google, or self-serve forgot-password email.
- Chrome extension, Jira plugin, ClouderaAI UI, or generating `.robot` files (those consume this app later).
- ClouderaAI (or any client) reading the program-settings file (or any object store) directly.

---

## 3. Users and access

| Role | Access |
|------|--------|
| Superadmin | Everything an admin can do, plus: create **superadmins**, deactivate anyone except the last remaining superadmin. Superadmin passwords are **never** reset from the Admins page — only via Settings (own password) |
| Admin | Members, activities, redemptions, program Settings (expiry / tiers). **Admins** page: create **admins** (not superadmins) and **set passwords for other admins only** (never a superadmin). Change own password in Settings |
| (none) | Unauthenticated → `/login` for HTML. **Exception:** `GET /api/meta` is public (no cookie) |

There is **no Create account / Sign up** anywhere.

**[Assumed]** Email + password session. First user is a seeded superadmin (env or SQL seed).  
**Q1 / Q2** below are decided by this section unless you override them.

---

## 4. Open questions — polish these first

Answer these in place. Implementation should follow this list, not buried comments.

| ID | Question | Suggested default | Your decision |
|----|----------|-------------------|---------------|
| Q1 | How many admin users? | **Many.** Seeded superadmin + more via Admins page | Many |
| Q2 | Auth method? | Email + password only. No sign-up, magic link, or Google | Email + password |
| Q3 | Is **contact number unique** (one member per phone)? | Yes | Yes |
| Q4 | Country / phone format? | PH mobile, store as E.164 (`+63917…`) | PH / E.164 |
| Q5 | Can the admin **edit** name/phone after create? | Yes | Yes |
| Q6 | Activity catalog vs free-text? | Small catalog + optional note; points entered each time | Catalog |
| Q7 | Can activity points be **0** or **negative**? | No negatives on Create Activity | No negatives |
| Q8 | Can the admin **backdate** an activity? | Yes; `occurred_at` defaults to now | Yes |
| Q9 | Can an earn be cancelled? | Feature-flagged full or partial cancellation of unexpired remaining points | `ENABLE_CANCEL_EARN` |
| Q9b | Can a redemption be cancelled? | Feature-flagged full or partial cancellation while consumed lots are unexpired | `ENABLE_CANCEL_REDEEM` |
| Q10 | Redemption: FIFO or FEFO? | **FEFO** | FEFO |
| Q11 | Redemption amount? | Any integer ≥ 1, up to available | Any integer |
| Q12 | Points precision? | Integer only | Integer |
| Q13 | “Last 3 months” meaning? | Rolling: `occurred_at >= now - 3 months` | Rolling 3 months |
| Q14 | Next expiration grouping? | Calendar day in app timezone; sum remaining expiring that local midnight | Calendar day (always 00:00 local) |
| Q39 | Expire at same clock time vs end of day? | **End of anniversary day** = next local calendar day at **00:00:00**. Earn 26 Aug 2026 14:14:32 + 1 year → **27 Aug 2027 00:00:00** | End of day (00:00 next day) |
| Q15 | Timezone? | `Asia/Manila` (in program settings JSON) | Asia/Manila |
| Q16 | Interval change rewrite existing lots? | **No.** Snapshotted at earn time | No |
| Q17 | Member-level expiration override? | No | No |
| Q18 | Create Activity from the members list? | Only on the member history page | History page |
| Q19 | History row types? | Earn + redeem + cancel + cancel redeem + expire | Earn / Redeem / Cancel / Cancel redeem / Expire |
| Q20 | Soft-delete members? | Deactivate | Deactivate |
| Q21 | Timezone if admin travels? | Always app timezone from program settings | App timezone |
| Q22 | Feb 29 / month-end? | Application calendar arithmetic (§8.2) | Clip to last valid day |
| Q23 | Persistence stack? | Next.js + TypeScript + Prisma + SQLite | Prisma + SQLite |
| Q24 | Silver threshold? | **250** | 250 |
| Q25 | What counts toward tier? | Points **earned** in the lookback | Earns in period |
| Q26 | Do redemptions/expirations lower tier metric? | **No** | No |
| Q27 | Gold min? | **501**; Platinum **1000** | Gold 501, Platinum 1000 |
| Q28 | Lookback: rolling vs calendar year? | Rolling 3m / 6m / **1y** | Rolling |
| Q29 | Add / rename / delete tiers? | Edit the four seeded names + mins. Bronze min stays 0 | Four seeded, editable mins |
| Q30 | Manual tier override? | No | No |
| Q31 | When does tier recalculate? | On earn and whenever the member is opened | On earn + open |
| Q32 | Can a regular admin create a superadmin? | **No** | No |
| Q33 | Reset a superadmin password from Admins? | **Never.** Settings only | Never |
| Q34 | Deactivate vs delete admins? | Deactivate. Cannot deactivate last superadmin | Deactivate |
| Q35 | Password rules? | Min 8. Own change needs current password | Min 8 + current |
| Q36 | Forgot password? | No email. Another admin Sets password on an **admin** only | No email; never superadmin |
| Q37 | Who can edit program Settings? | Any signed-in superadmin or admin | Any staff |
| Q38 | Where do expiration + tier rules live? | **JSON file** per environment, not SQLite | JSON file per instance |

---

## 5. Assumptions (used throughout this spec)

1. **Admin-only web app**, desktop-first (tablet OK, no native mobile app).
2. **Single store / single program.**
3. **Global expiration interval** applies to new earns only.
4. Points live in **lots** (one lot per earn). Balance is the sum of **unexpired, unconsumed** remaining amounts.
5. History default window is **last 3 months**, changeable on the page (6 months / 1 year / All).
6. Member has two routes, not tabs-only-in-place:  
   - `/members/:id/history`  
   - `/members/:id/profile`  
   Shared header + subnav so it still feels like “the same member.”
7. Currency is **points**, not pesos. No peso-to-points rate in v1 (admin types points).
8. **Tier is derived**, not assigned by hand. Seeded rules (polish Q24–Q27):

   | Tier | Min points earned in the lookback period |
   |------|------------------------------------------|
   | Bronze | 0 (everyone starts here) |
   | Silver | 250 |
   | Gold | 501 (greater than 500) |
   | Platinum | 1,000 |

   Highest matching tier wins. Members list still shows **names only** — tier appears on the member header and profile.
9. **No self-serve accounts.** Login only. Admins are provisioned on `/admins`. Own password is changed in Settings. **Set password** on Admins is for **admin** accounts only — never a superadmin (confirmed).
10. **Program settings live in a JSON file** (one file per environment). SQLite is not the source of truth for expiration or tiers.
11. **Two deployed instances:** production and staging (separate DBs, separate settings files, two public URLs).
12. **Earn and redeem cancellation are feature-flagged** via `ENABLE_CANCEL_EARN` and `ENABLE_CANCEL_REDEEM`.

---

## 6. Information architecture

```
/login                            Email + password. No sign-up
/members                          Members list + Create member
/members/:id/history              Points history (default landing after opening a member)
/members/:id/profile              Name, contact, tier, next expiration
/admins                           Admin accounts (create, set password)
/settings                         Own password + program settings (writes this env’s JSON file)
GET /api/meta                     Public JSON: version/tag + program settings (no login)
```

Unauthenticated HTML visits redirect to `/login`.  
`GET /api/meta` is the **only** public API (no session).  
Opening a member **always lands on history**. Profile is the second page.

---

## 7. Screens

### 7.1 Login

Centered card. App name **Points Engine**.

| Field | Required |
|-------|----------|
| Email | Yes |
| Password | Yes |

Primary: **Sign in**.

- **No** Sign up, Create account, or Forgot password links.
- Wrong email/password: generic `Email or password is incorrect.` (do not reveal which).
- Inactive admin: same generic error (do not confirm the account exists).
- Success: session cookie, redirect `/members`.
- Already signed in + visit `/login`: redirect `/members`.

Nav after login: **Members · Admins · Settings** (plus Sign out in Settings).

### 7.2 Members list

**Purpose:** Find a member or create one.

- **Names only.** No contact number, points, **tier**, expiration, or last-activity on this screen. Contact number is **Profile only**. Points, tier, and expiration live on the member pages.
- A plain clickable list (not a data table). Each row is the member’s name; click opens history.
- Search: as-you-type, debounce ~300ms, **name** (phone still unique on create/profile; do not show it here).
- Primary action: **Create member**
- Sort: name A–Z **[Assumed]**

**Empty:** “No members yet” + Create member.  
**Search miss:** “No members match.”

#### Create member (modal or page)

| Field | Required | Notes |
|-------|----------|--------|
| Full name | Yes | Trim; 2–80 chars |
| Contact number | Yes | Unique; validate format per Q4 |

On success: open that member’s history.

### 7.3 Member chrome (shared)

Shown on both member pages, stacked on the **left** (not a top-right metric):

- Back to Members
- Member name + **current tier** (read-only pill, e.g. Gold)
- **Available points** directly under the name (e.g. `1,240 available`)
- **Breakdown** immediately under available, **all-time** (not the history date filter):

  | | Points |
  |---|---|
  | Earned | 2,140 |
  | Redeemed | −500 |
  | Expired | −400 |
  | **Available** | **1,240** |

  Identity: `available = earned − redeemed − cancelled − expired`. Caption: `All-time · does not follow the history filter.`
- Subnav: **Points history** · **Profile**
- Actions on history page: **Create Activity** (primary), **Redeem** — these stay as page actions, not in the header corner

**Do not show contact number** in this chrome (or anywhere on history). Phone is **Profile only**.

### 7.4 Page 1 — Points history

**Default filter:** Last 3 months.

Filter chips: `Last 3 months` (default) · `Last 6 months` · `Last 1 year` · `All`

Helper text, e.g. `Showing 26 May 2026 – 26 Aug 2026`.

**Table** (newest first):

| When | Type | Description | Points | Expires |
|------|------|-------------|--------|---------|
| datetime | Earn / Redeem / Cancel / Expire | Activity name or reason | +200 / −80 | Earn rows: expiry datetime. Others: — |

**[Assumed]** Filter applies to `occurred_at` of the ledger row (when the earn/redeem/expire happened), not to the lot’s future expiry date.

**Empty window:** “No history in this period.” Offer widening the range, not a fake row.

### 7.5 Create Activity (modal, from history)

| Field | Required | Notes |
|-------|----------|--------|
| Member | — | Locked to current member |
| Activity type | Yes | From catalog (Q6) |
| Points | Yes | Integer ≥ 1 |
| Occurred at | Yes | Default now; timezone = Settings |
| Note | No | Free text |

**Live preview (required):**  
`These {n} points will expire on {date} at 00:00`  
(the morning after the anniversary calendar day — e.g. earn 26 Aug 2026 → expire **27 Aug 2027 00:00**).  

Computed from `occurred_at`’s **date** in the program timezone + interval, then **start of the following local day** (§8.2). Time of day of the earn is ignored for expiry.

Submit:

1. Insert `activities` row.
2. Insert ledger `EARN`.
3. Insert `point_lots` with `expires_at` = end-of-anniversary-day midnight (§8.2).

Cannot submit if points < 1 or activity type missing.

### 7.6 Redeem (modal, from history)

| Field | Required | Notes |
|-------|----------|--------|
| Amount | Yes | Integer, 1 … available balance |
| Occurred at | Yes | Default now |
| Note | No | e.g. “Free drink” |

Show **Available: N**. Disable submit if amount > available.

Submit consumes lots **FEFO** (Q10) and writes `REDEEM` + consumption rows.

If available is 0: hide Redeem or show it disabled with “No points to redeem.”

### 7.7 Page 2 — Profile

**Attributes**

- Full name (editable)
- Contact number (editable, unique)
- **Tier** (read-only): current name, qualifying points in the lookback, period label  
  Example: `Gold · 800 points earned in the last 3 months`  
  If not top tier: `200 more to Platinum`
- Member since (`created_at`)
- Status: Active / Inactive (if Q20 = yes)

**Next expiration** (only if available points > 0)

- **When:** datetime of the next expiry event (see Q14)
- **How much:** points that expire on that **calendar day** (Q14 default)
- Short copy: `200 points expire on 27 Aug 2027 at 00:00`

If balance is 0: `No points on file — nothing will expire.`

**[Open]** Show a list of later expiry buckets (e.g. next 3 dates)? Useful, not required for v1. Spec default: **next event only**.

Save changes on this page (name/phone). Expiration and **tier** are read-only (derived).

### 7.8 Settings

Three sections on one page. **Your account** is separate from program save.

#### Your account

Own password only — not other admins (that is the Admins page).

| Field | Required |
|-------|----------|
| Current password | Yes |
| New password | Yes, min 8 |
| Confirm new password | Yes, must match |

Primary: **Update password**. Wrong current password: `Current password is incorrect.`  
Success: stay signed in; show a short confirmation.

**Sign out** (ghost): clears session, goes to `/login`.

#### Points expiration

- **Points expire after:** `6 months` · `1 year` (radio)
- **Timezone:** IANA name, default `Asia/Manila`
- Helper: `New activities use this interval. Existing points keep the expiry they were given when earned.`

#### Tiers

- **Lookback period:** `3 months` · `6 months` · `1 year` (default **1 year**, rolling, same calendar arithmetic rules as expiration)
- Helper: `Tier uses points earned in this period, not the available balance. Redeeming or expiry does not lower the count; older earns falling out of the window can.`
- Rules table (highest min wins):

  | Tier | Min points earned in period |
  |------|-----------------------------|
  | Bronze | 0 (locked) |
  | Silver | 250 (editable) |
  | Gold | 501 (editable) |
  | Platinum | 1,000 (editable) |

- Validation on save: Bronze min is 0; every other min is an integer ≥ 1; mins are **strictly increasing** in display order; names unique and non-empty.
- Live example on the page: `800 earned in 3 months → Gold. 1,000+ → Platinum.`
- Changing rules applies immediately on next member open / next earn. No rewrite of past ledger rows.
- Program save: **Save settings** writes this environment’s JSON file (§8.9). Own-password save does not.

### 7.9 Admins

**Purpose:** Provision staff. There is no other way to get an account.

Nav: **Admins**. Any signed-in **superadmin** or **admin** can open this page.

List columns: Name, Email, Role (Superadmin / Admin). Optional: Active.

Primary: **Create admin**

Row action: **Set password** — only on **admin** rows that are not you.
- Hidden/disabled on **your own** row (use Settings).
- **Never** shown on a **superadmin** row. Confirmed: nobody resets a superadmin password from this page.

#### Create admin

| Field | Required | Notes |
|-------|----------|--------|
| Name | Yes | |
| Email | Yes | Unique, used to sign in |
| Role | Yes | Default **Admin**. **Superadmin** option only if the actor is a superadmin |
| Password | Yes | Min 8; shown/set here, not emailed |
| Confirm password | Yes | Must match |

No invitation email in v1. Tell the new person the email + password out of band.

On success: back to the list. They can Sign in immediately.

#### Set password (other admin)

| Field | Required |
|-------|----------|
| New password | Yes, min 8 |
| Confirm | Yes |

Does **not** ask for the target’s current password. This is a reset.

**API / UI must reject** if the target’s role is `superadmin` (403), including when the actor is a superadmin.

**Cannot:** remove the last active superadmin; an admin promoting themselves to superadmin (only a superadmin assigns that role).

---

## 8. Business rules

### 8.0 Auth

- Passwords stored with bcrypt (or equivalent). Never log plaintext.
- Session cookie, httpOnly, SameSite=Lax, Secure in production.
- **Create admin** and **Set password** hash the new password before write.
- **Set password** is allowed only when the **target role is `admin`**. If the target is `superadmin`, reject with 403 — including when the actor is a superadmin. Superadmins change password only in Settings.
- **Update password** (Settings): verify `current` against hash, then replace. This is the only in-app way to change a superadmin password.
- Seed exactly one superadmin if the table is empty (deploy env `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD`, then unset the password env).
- Inactive admins cannot sign in.

### 8.1 Available balance

```
available = SUM(lot.remaining_amount)
            WHERE remaining_amount > 0
              AND expires_at > now()
```

Expired remaining amounts are **not** spendable even if the expire job has not written the `EXPIRE` row yet (lazy rule). The job still writes `EXPIRE` rows so history is complete.

### 8.1.1 All-time breakdown (header)

Shown under available points on every member page:

```
earned    = SUM(ledger.amount) WHERE type = 'EARN'
redeemed  = SUM(ledger.amount) WHERE type = 'REDEEM'
cancelled = SUM(ledger.amount) WHERE type = 'CANCEL'
expired   = SUM(ledger.amount) WHERE type = 'EXPIRE'
          + SUM(lot.remaining_amount) WHERE remaining_amount > 0
            AND expires_at <= now()   -- unposted yet, so the identity still holds
available = earned − redeemed − cancelled − expired     -- must equal §8.1
```

This is **lifetime**, not the Points history range (Last 3 months, etc.). Changing that filter must not change these four numbers.

Sample (Elena): earned 2,140 · redeemed 500 · expired 400 · available 1,240.

### 8.2 Expiration timestamp

Let `interval` be the **global program setting at earn time**. Ignore the earn’s clock time. Work in the program timezone (default `Asia/Manila`).

```
earn_date      = calendar date of occurred_at in app timezone
anniversary    = calendar-add(earn_date, 6 months)       -- or 1 year
expires_at     = anniversary + 1 day, at 00:00:00.000 in app timezone
               (store UTC equivalent as a Prisma DateTime)
```

Points are spendable for the **entire anniversary calendar day**. They become unspendable at **00:00:00 the next local morning**.

- Worked example: earn `2026-08-26 14:14:32` + **1 year** → `expires_at` = **`2027-08-27 00:00:00`** (not 2027-08-26 14:14:32).
- Worked example: same earn + **6 months** → **`2027-02-27 00:00:00`**.
- Two earns on the same local date share the same `expires_at` (both 00:00 after the anniversary).

**Calendar arithmetic on the date part (then +1 day):**

- Earn date `2026-08-31` + 6 months → anniversary `2027-02-28` → expire **`2027-03-01 00:00:00`**.
- Earn date `2024-02-29` + 1 year → anniversary `2025-02-28` → expire **`2025-03-01 00:00:00`**.

Do **not** use `23:59:59` as the expiry instant. Use exclusive midnight: `expires_at <= now()` means expired.

### 8.3 Changing the interval

- Updates this environment’s program-settings JSON file only.
- **Does not** rewrite `point_lots.expires_at`.
- Next Create Activity uses the new interval.

### 8.4 Redemption (FEFO)

1. Reject if `amount > available` or `amount < 1`.
2. Select lots: `remaining_amount > 0 AND expires_at > now()` ordered by `expires_at ASC`, then `id ASC`.
3. Consume until `amount` is fully allocated.
4. Persist consumption rows in **one DB transaction**.

Never allow a negative lot remaining.

### 8.5 Expiration posting

A scheduled job (every 1 minute is enough; expiry instants are local midnight):

- Find lots with `remaining_amount > 0 AND expires_at <= now()`.
- For each lot (or batched per member+timestamp): write `EXPIRE` for `remaining_amount`, set remaining to 0.

Idempotent: skip lots already at 0.

**Balance truth** always uses §8.1 so a delayed job cannot let someone redeem expired points.

### 8.6 Earn cancellation

`ENABLE_CANCEL_EARN` is an instance env var (unset defaults to `true`). When `false`, no Cancel action is rendered on earns and the cancellation API is unavailable.

- An admin may fully cancel an earn's remaining points or partially cancel an integer amount.
- Cancellation applies only to the selected earn's lot; it is not FEFO.
- Expired points and points already redeemed cannot be cancelled.
- If an earn was partially redeemed, only its remaining unexpired points can be cancelled.
- Full cancellation reduces the lot to zero. Partial cancellation reduces its remaining amount by the cancelled amount.
- Record an append-only `CANCEL` ledger entry and a lot consumption.

### 8.6.1 Redeem cancellation

`ENABLE_CANCEL_REDEEM` is an instance env var (unset defaults to `true`). When `false`, no Cancel action is rendered on redemptions.

- An admin may fully or partially cancel a redemption while the lots it consumed are still unexpired.
- Restoration is applied back onto those lots (reverse of the original consumption).
- Record an append-only `CANCEL_REDEEM` ledger entry.

### 8.7 Concurrency

SQLite serializes writes. Earn/redeem/cancel/expire operations keep their ledger and lot updates inside one Prisma interactive transaction. This is appropriate for the two small demo instances; a production multi-replica deployment would require a server database with explicit row locking.

### 8.8 Tiers

**Qualifying points** (not the same as available balance):

```
qualifying = SUM(ledger.amount)
             WHERE type = 'EARN'
               AND occurred_at >= calendar-subtract(now(), {n} months)
```

`n` is 3, 6, or 12 from program settings (`tiers.lookbackPeriod`).

**Current tier** = the rule with the greatest `min_points` such that `qualifying >= min_points`.  
If none match (should not happen; Bronze is 0), treat as Bronze.

**Worked example** (Elena, as of 26 Aug 2026):

Earns in the last 3 months: 200 + 100 + 350 + 150 = **800** (the −500 redeem is ignored).  
800 ≥ 501 and 800 < 1,000 → **Gold**.  
Same member, last 1 year, if an extra +400 earn on 4 Mar 2026 is in window → **1,200 → Platinum**.

**Not used for tier:** available balance, redemptions, expired remaining lots, activity history filter on the UI.

**Recalc:** when an earn is logged, and whenever GET member runs (§8 / Q31). Opening a member a month later can demote them if earns aged out of the window.

**Settings change:** new mins/period apply on next recalc after the JSON file is saved. No backdated “tier change” ledger in v1.

### 8.9 Program settings (JSON file)

**Source of truth:** one JSON file per environment on that instance’s filesystem. Not a SQLite `settings` / `tiers` table.

| Env | Example path |
|-----|-------------|
| Localhost | `.data/local/program-settings.json` |
| Production | `.data/production/program-settings.json` |
| Staging | `.data/staging/program-settings.json` |

Override with `SETTINGS_FILE` if both Cloudera Applications share a project and you need a custom path. Same schema everywhere. Do **not** store program settings in SQLite.

Guardrails:

- `APP_ENV=development` uses `.data/local/program-settings.json`
- **Never** point local env at `production/` or `staging/` files
- `GET http://localhost:3000/api/meta` returns `settings` from that local file (`environment`: `development`)

The Settings UI reads the file on load and writes it on **Save settings**. Optional short in-memory cache; the file remains canonical. Saving own password does **not** write the file.

If the file is missing at boot, seed this document then write it:

```json
{
  "schemaVersion": 1,
  "expiration": {
    "interval": "1_year",
    "timezone": "Asia/Manila"
  },
  "tiers": {
    "lookbackPeriod": "1_year",
    "rules": [
      { "name": "Bronze", "minPoints": 0, "isBase": true },
      { "name": "Silver", "minPoints": 250, "isBase": false },
      { "name": "Gold", "minPoints": 501, "isBase": false },
      { "name": "Platinum", "minPoints": 1000, "isBase": false }
    ]
  }
}
```

`expiration.interval`: `6_months` | `1_year`.  
`tiers.lookbackPeriod`: `3_months` | `6_months` | `1_year`.  
Validate §7.8 before writing. Changing `interval` does **not** rewrite existing lots.

**ClouderaAI must not read the settings file.** The app reads the file; clients (including ClouderaAI) call `GET /api/meta` (§10.1).

---

## 9. Data model (SQLite)

Use one SQLite file per environment through Prisma. IDs are autoincrementing integers represented as JavaScript `number` values by the Prisma client. Store datetimes as UTC through Prisma and convert to the Settings timezone in the UI.

### `admins`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| email | VARCHAR(255) UNIQUE | login id |
| password_hash | VARCHAR(255) | bcrypt |
| name | VARCHAR(120) | |
| role | ENUM('superadmin','admin') | |
| status | ENUM('active','inactive') | default `active` |
| created_at | DATETIME(3) | |
| updated_at | DATETIME(3) | |

Do **not** store expiration interval, timezone, or tier rules in SQLite. Those live in the program-settings JSON file (§8.9).

### `members`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| name | VARCHAR(80) NOT NULL | |
| contact_number | VARCHAR(20) NOT NULL UNIQUE | E.164 |
| status | ENUM('active','inactive') | default `active` |
| created_at | DATETIME(3) | |
| updated_at | DATETIME(3) | |

Tier is **not** a column on `members`. Compute on read (§8.8) using program-settings tier rules.

### `activity_types`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| name | VARCHAR(80) UNIQUE | e.g. In-store purchase |
| is_active | TINYINT(1) | |
| sort_order | INT | |

Seed: `In-store purchase`, `Bonus`, `Other`.

### `activities`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| member_id | FK members | |
| activity_type_id | FK activity_types | |
| points | INT | > 0 |
| occurred_at | DATETIME(3) | earn timestamp (expiry base) |
| note | VARCHAR(500) NULL | |
| created_by_admin_id | FK admins | |
| created_at | DATETIME(3) | when logged |

### `point_lots`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| member_id | FK members | |
| activity_id | FK activities | |
| original_amount | INT | |
| remaining_amount | INT | 0 when depleted or expired |
| earned_at | DATETIME(3) | = activity.occurred_at |
| expires_at | DATETIME(3) | start of local day after anniversary (§8.2) |
| expiration_interval | ENUM('6_months','1_year') | snapshot |
| created_at | DATETIME(3) | |

Indexes:

- `(member_id, expires_at)` for next-expiry + FEFO
- `(expires_at, remaining_amount)` for the expire job

### `ledger_entries` (immutable)

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| member_id | FK | |
| type | ENUM('EARN','REDEEM','EXPIRE') | |
| amount | INT | always **positive**; sign implied by type |
| occurred_at | DATETIME(3) | |
| activity_id | FK NULL | EARN only |
| note | VARCHAR(500) NULL | |
| created_by_admin_id | FK NULL | null for EXPIRE job |
| created_at | DATETIME(3) | |

### `lot_consumptions`

| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| lot_id | FK point_lots | |
| ledger_entry_id | FK ledger_entries | REDEEM or EXPIRE |
| amount | INT | > 0 |

```
members 1──* activities 1──1 point_lots
members 1──* ledger_entries
point_lots 1──* lot_consumptions
ledger_entries 1──* lot_consumptions
```

**Derived (not stored, or stored as cache with care):**

- Available points → §8.1  
- All-time earned / redeemed / expired → §8.1.1  
- Next expiration → min `expires_at` among spendable lots; amount → sum remaining whose calendar **date** in the program timezone equals that min’s date (convert in the app)
- Current tier + qualifying points → §8.8 using program-settings `tiers`

If you cache balances on `members`, update them in the same transaction as lot changes **or** do not cache.

---

## 10. API sketch

REST JSON. Session cookie required **except** `POST /api/auth/login` and **`GET /api/meta`**.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/meta` | **Public.** Version/tag + program settings JSON (see §10.1). No cookie |
| POST | `/api/auth/login` | email + password → session |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` (self) |
| GET | `/api/admins` | list |
| POST | `/api/admins` | create; body includes plaintext password once |
| POST | `/api/admins/:id/password` | reset another **admin’s** password (403 if target is superadmin) |
| GET | `/api/settings` | current program-settings document |
| PUT | `/api/settings` | validate §7.8, write this env’s JSON file, return saved JSON |
| GET | `/api/members?q=` | names only (id + name); `q` matches name |
| POST | `/api/members` | create |
| GET | `/api/members/:id` | header: name, tier, available, `earned_total`, `redeemed_total`, `cancelled_total`, `expired_total`; profile fields + qualifying |
| POST | `/api/members/:id/activities/:activityId/cancel` | Fully or partially cancel the selected earn's remaining points when enabled |
| POST | `/api/members/:id/redemptions/:ledgerId/cancel` | Fully or partially cancel a redemption when enabled |
| PATCH | `/api/members/:id` | name, phone, status |
| GET | `/api/members/:id/history?range=3m\|6m\|1y\|all` | ledger rows |
| GET | `/api/members/:id/expiration` | next when + amount (profile) |
| POST | `/api/members/:id/expire` | post `EXPIRE` ledger rows for this member’s due lots |
| POST | `/api/members/:id/activities` | Create Activity |
| POST | `/api/members/:id/redemptions` | Redeem |
| GET | `/api/activity-types` | catalog |

**History range:** `3m` default. Server applies `occurred_at >= now - interval`.

**Errors:** `400` validation, `401` bad login / missing session, `403` not allowed (admin creating a superadmin, or anyone resetting a superadmin password), `404` unknown member, `409` duplicate phone or admin email, `422` redeem over available.

### 10.1 `GET /api/meta` (required)

Unauthenticated. `Cache-Control: no-store`. CORS allow `GET` from `*`. Same shape on production and staging.

ClouderaAI (and any other agent) calls **`GET {productionUrl}/api/meta`**. It does **not** read the settings file. `gitTag` / `version` / `gitSha` come from **deploy-time env** (`GIT_TAG`, `APP_VERSION`, `GIT_SHA`), not from GitHub at request time. `settings` is the **exact** JSON this instance is using.

```json
{
  "app": "points-engine",
  "environment": "production",
  "version": "1.0.0",
  "gitTag": "v1.0.0",
  "gitSha": "abc1234",
  "deployedAt": "2026-08-26T13:00:00.000Z",
  "publicUrl": "https://points-engine-prod.example.com",
  "settingsSource": "file://.data/production/program-settings.json",
  "settings": {}
}
```

| Field | Source |
|-------|--------|
| `environment` | `APP_ENV`: `production` \| `staging` |
| `version` / `gitTag` / `gitSha` | Env at deploy. If unset, JSON `null` (honest) |
| `publicUrl` | `APP_PUBLIC_URL` |
| `settings` | Current program-settings JSON |
| `settingsSource` | File path string |

Optional: `GET /api/meta/health` → `{ "ok": true, "environment": "staging" }` (also public).

---

## 11. Background work

| Job | Cadence | Work |
|-----|---------|------|
| `expire-lots` | every 1 min | Post `EXPIRE` for due lots (§8.5) |

Run via cron, systemd timer, or a worker (`node-cron` is fine for v1 on one box).

---

## 12. Edge cases

| Case | Behavior |
|------|----------|
| Redeem at 00:00:00 on expiry instant | Lot with `expires_at <= now` is not spendable (e.g. 27 Aug 2027 00:00) |
| Two lots expire the same local midnight | Profile **amount** sums that event (Q14); typical when both were earned on the same calendar date |
| Interval changed after earn | Lot expiry unchanged |
| Duplicate Create Activity click | Idempotency key optional; at least disable the button while in flight |
| Search by last 4 digits of phone | Out of v1 — list is names only; phone lives on Profile |
| Inactive member | Not in default list; URL still works; Create Activity blocked **[Assumed]** |
| Qualifying 500 exactly | Bronze/Silver only unless Gold min is set to 500. Seeded Gold is 501 |
| Qualifying 1000 | Platinum |
| Admin raises Platinum to 2000 | Members between 1000–1999 drop to Gold on next open |
| Member list | Still names only — no tier on the list |
| History filter Last 3 months | Breakdown under available stays all-time; table rows are filtered |
| Login page Sign up | Must not exist |
| Admin creates superadmin | 403; only superadmin can |
| Set password on a superadmin | **Never.** Hide the action; API 403 even if called. Superadmin uses Settings only |
| Last superadmin deactivated | Rejected |
| Settings password without current | Rejected |
| `GET /api/meta` without cookie | **200** + JSON; never 401 |
| ClouderaAI → settings file | Out of scope. Use `/api/meta` |
| Save settings | Updates this env’s JSON file; next `/api/meta` matches |

---

## 13. Stack and deploy

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript |
| Members / ledger / admins | **SQLite**, one database file per environment |
| Program settings | JSON file per environment (§8.9) |
| ORM | Prisma (`provider = "sqlite"`) |
| Auth | Session cookie + bcrypt |
| Public metadata | `GET /api/meta` (§10.1) |
| Expire job | ~1 min (`node-cron` on the web process is OK) |

### Environments

| | Localhost | Production | Staging |
|--|-----------|------------|---------|
| URL | `http://localhost:3000` | `APP_PUBLIC_URL` | different public URL |
| SQLite | `.data/local/points-engine.db` | `.data/production/points-engine.db` | `.data/staging/points-engine.db` |
| Settings file | `.data/local/program-settings.json` | `.data/production/program-settings.json` | `.data/staging/program-settings.json` |
| Demo members | Optional | No (superadmin only) | Yes if `SEED_DEMO_DATA=true` |

**Cloudera AI Workbench:** two Applications (two public subdomains / URLs), two SQLite files in the shared project filesystem, and two settings files. No external database server is required.

`GIT_TAG` / `GIT_SHA` / `APP_VERSION` are set **at deploy** (e.g. GitHub Action when pushing tag `v1.0.0`). `/api/meta` returns those values.

---

## 14. Acceptance criteria

1. Admin can create a member with name + contact number and open them.
2. Duplicate contact number is rejected with a clear error.
3. On the member, **Create Activity** awards N points and history shows `+N` with expiry = **end of anniversary day** (§8.2).
4. With interval **1 year**, earn at `2026-08-26 14:14:32` expires **`2027-08-27 00:00:00`** (app timezone), not `2027-08-26 14:14:32`.
5. Switching Settings to 6 months does **not** change that lot’s expiry; a **new** earn uses 6 months.
6. Redeem 80 from a 200 lot leaves 120 remaining on the same expiry.
7. Redeem cannot exceed available; expired lots cannot be redeemed.
8. After expiry time, available drops; history gains an Expire row (once the job runs). Profile next-expiration updates.
9. History **defaults** to last 3 months; older rows appear only after changing the filter.
10. Contact number is **Profile only**. History chrome shows name, tier, available points, and the earn/redeem/expire breakdown — never phone. Profile still shows name, contact, current tier + qualifying points, and next expiration.
11. Members list shows **names only** (no phone, points, tier, or other attributes). Clicking a name opens history. Search matches by name.
12. Settings can change lookback period and tier mins; Bronze stays at 0. A member with 800 earned in 3 months is **Gold**; 1,200 in 1 year is **Platinum** under the seeded rules.
13. Redeeming points does **not** by itself change qualifying points or tier.
14. Under available points, all-time **Earned / Redeemed / Cancelled / Expired** are shown and satisfy `earned − redeemed − cancelled − expired = available`. Changing the history date filter does not change those totals.
15. Unauthenticated HTML users only see **Login**. There is no sign-up. `GET /api/meta` remains public.
16. A superadmin or an admin can create another **admin** on Admins and set that password. Only a superadmin can create a superadmin.
17. Settings **Update password** changes the signed-in user’s password and requires the current password. **Set password** on Admins works for **admin** accounts only — never for a superadmin (403).
18. **Save settings** writes this environment’s program-settings JSON file. SQLite is not the source of truth for expiration or tiers.
19. `curl -sS $APP_PUBLIC_URL/api/meta` with **no cookie** returns `environment`, `gitTag`/`version`/`gitSha` (or JSON `null` if unset), and `settings` equal to the current file.
20. Production and staging are two public URLs with different DBs and settings files.

---

## 15. Glossary

| Term | Meaning |
|------|---------|
| Activity | Admin-logged event that **earns** points |
| Lot | Bucket of points from one earn, with its own `expires_at` |
| Ledger | Append-only earn / redeem / cancel / expire records |
| Available | Spendable points now (§8.1) = earned − redeemed − cancelled − expired |
| Earned / Redeemed / Cancelled / Expired | All-time ledger totals shown under available (§8.1.1) |
| FEFO | First-expiring lot consumed first |
| Interval | Global 6 months or 1 year. Expiry = next local 00:00 after the anniversary date (§8.2) |
| Program settings | JSON file: expiration + timezone + tier rules |
| `/api/meta` | Public JSON: env, git tag/version, copy of program settings |
| Qualifying points | Sum of **earns** in the lookback period |
| Superadmin / Admin | Staff roles. Superadmin passwords are never reset from Admins; both roles can reset **admin** passwords |
| Sign-up | Does not exist. Accounts are created on Admins |

---

## 16. What to polish in this file

Chat-locked items are already in §4 **Your decision**. Remaining optional polish:

1. Q6 catalog names / default points.
2. Extra expiry buckets on Profile (v1 = next event only).
3. Exact Cloudera Application subdomains.

Wireframes: Login, Admins, Create member, Redeem, range filters, change password — canvas beside chat if present.
