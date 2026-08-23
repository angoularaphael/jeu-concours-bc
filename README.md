# Jeu concours 10 ans — Boxing Center

Landing isolée : inscription + 2 ami(e)s + WhatsApp + admin.

Page prévue : `https://concours.boxingcenter.fr/`  
Admin : `/admin`  
Règlement : `/reglement.html`

Hors WordPress, boutique et menus publics (`robots.txt` = `Disallow: /`).

## Production (Vercel)

Importer [github.com/angoularaphael/jeu-concours-bc](https://github.com/angoularaphael/jeu-concours-bc) dans Vercel.

Fichier local déjà généré (gitignoré) : `.env.production`.  
Dans Vercel : **Settings → Environment Variables → Import .env** et coller ce fichier, environnement **Production** uniquement. Ne pas cocher `DRY_RUN`.

Variables **Production** (pas de `DRY_RUN`) :

| Variable | Rôle |
|---|---|
| `WHATSAPP_BOT_URL` | Bot Baileys (`/api/send-message`) |
| `WHATSAPP_BOT_SECRET` | Header `x-api-secret` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Persistance + sync CRM |
| `PUBLIC_URL` | `https://concours.boxingcenter.fr` |
| `ADMIN_TOKEN` | Accès `/admin` |
| `CRON_SECRET` | Cron file WhatsApp |

DNS : CNAME `concours` → `cname.vercel-dns.com`.  
SQL : `supabase/001_concours.sql` avant le 1er trafic.

En production, `?test=1` **n’empêche plus** l’envoi WhatsApp. Le dry-run n’existe qu’avec `DRY_RUN=1` (local).

## Local

```bash
copy .env.example .env
npm install
npm run dev
```

http://127.0.0.1:5620 — mettre `DRY_RUN=1` dans `.env`.

```bash
npm test
npm run test:e2e
npm run build
```

## Tracking

`?src=story|meta|video|wa|ads` (ou `utm_source`). Lien ami : `/?inv=TOKEN`.
