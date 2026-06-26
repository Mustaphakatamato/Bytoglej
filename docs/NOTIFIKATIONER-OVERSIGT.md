# Notifikationer — oversigt og kanaler (C1)

Tre kanaler:
- **Klokke** = række i `notifications` (vises i klokke-ikon + `/notifikationer`)
- **E-mail** = via Resend
- **Push** = web-push til institutionens auth-bruger(e) via `lib/push.js`

## Rodårsag (klokken var tom hos institutioner)

RLS-hardeningen `20260616_security_rls_hardening.sql` begrænsede SELECT/UPDATE på
`notifications` til `institution_id IN (...)`, men klienten (klokke + `/notifikationer`)
læser med `.eq('institution_name', ...)`. Rækker uden `institution_id` (bl.a.
auto-match-søges) blev derfor filtreret væk af RLS og kunne aldrig vises.

**Fix:** `20260626_notifications_rls_name_or_id.sql` gør policyen tolerant for BEGGE
nøgler (id ELLER navn). Ny samlet helper `lib/notify.js` sætter altid begge nøgler og
rammer alle tre kanaler i ét kald.

## Samlet helper: `lib/notify.js`

```js
import { notify } from '@/lib/notify';
await notify(supa, {                 // supa = service-role klient
  institutionId, institutionName,    // mindst én
  type, title, body, data,
  url: '/beskeder',                  // hvor push/klik fører hen
  sendEmail: false,                  // valgfrit: spring email over (fx hvis sendt separat)
});
```

Push mapper institution → auth-bruger via **email** (institutions.email +
institution_members.email → `auth.users`), da `institutions` ikke har `user_id`.

## Event × kanal-matrix

| Begivenhed | Kilde | Klokke | E-mail | Push | Status |
|---|---|:--:|:--:|:--:|---|
| Nyt bytteforslag | `swaps/create` | ✅ | ✅ | ✅ | **Migreret til `notify()`** |
| Opslag godkendt | `admin/review-listing` | ✅ | ✅ | ✅ | **Migreret** |
| Opslag afvist | `admin/review-listing` | ✅ | ✅ | ✅ | **Migreret** |
| Opslag deaktiveret/aktiveret/fjernet | `admin/report-action` | ✅ | ✅¹ | ✅ | **Migreret** (¹email via egen skabelon) |
| Det er din tur at betale (bytte) | `webhooks/stripe` | ✅ | ✅ | ✅ | **Migreret** (push tilføjet) |
| Vare ledig igen (følg) | `follow-notify` | ✅ | ✅ | ✅ | **Via `notify()`** (A4) |
| Ny besked / modbud | `notify-message` | ✅ | ✅ | ✅ | **Klokke tilføjet** |
| Auto-match (søges/opslag) | `auto-match-soges` | ✅¹ | ⬜ | ⬜ | ¹Bevidst kun klokke (lavt signal — undgå e-mail/push-spam) |
| Køb gennemført (til sælger) | `webhooks/stripe` | ⬜ | ✅ | ⬜ | Email (sælgerordre); klokke+push kan tilføjes |
| Ordre bekræftet (til køber) | `webhooks/stripe` | ⬜ | ✅ | ⬜ | Email; klokke+push kan tilføjes |

## Designvalg

- **Auto-match** holdes bevidst som klokke-kun: auto-match er lavt-signal og kan ramme
  mange institutioner pr. nyt opslag — e-mail/push på hver match ville være spam.
- **Køb/ordre-bekræftelser** sendes i dag som e-mail. Klokke+push kan tilføjes ved at
  lade webhookens `finalizePurchase` kalde `notify(..., sendEmail:false)` til køber+sælger.
