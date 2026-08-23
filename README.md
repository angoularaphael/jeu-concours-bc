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
| `ADMIN_TOKEN` | Accès `/admin` (jeton) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Mêmes identifiants que l’admin boutique |
| `CRON_SECRET` | Relance WhatsApp (bot 24h/24 + cron Vercel quotidien) |

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

## Tracking — ce que tu dois faire

Le compteur interne est déjà en place (`/api/track` + colonne Source dans `/admin`).
**Toi, tu n’as qu’à coller `?src=…` sur chaque lien de campagne.**

| Canal | Lien à utiliser |
|---|---|
| Stories Instagram / Snap | `https://concours.boxingcenter.fr/?src=story` |
| Pub Meta (Facebook / Instagram) | `https://concours.boxingcenter.fr/?src=meta` |
| Vidéo (Reels, TikTok, YouTube) | `https://concours.boxingcenter.fr/?src=video` |
| WhatsApp club / coaches | `https://concours.boxingcenter.fr/?src=wa` |
| Autres pubs | `https://concours.boxingcenter.fr/?src=ads` |
| QR salle | `https://concours.boxingcenter.fr/?src=qr` |

Tu peux aussi coller les UTM Meta tels quels (`utm_source`, `utm_medium`, `utm_campaign`) : ils sont enregistrés. Le paramètre `src` reste le plus simple pour lire le tableau admin.

Les invitations ami(e)s ajoutent toutes seules `/?inv=TOKEN` : ne pas y toucher.

Pixel Meta / GA4 : pas obligatoire pour le suivi interne. Si une pub Meta a besoin d’un pixel, on pourra l’ajouter plus tard avec l’ID du compte pub.

## Relance WhatsApp 24h/24

Le cron Vercel Hobby ne tourne qu’une fois par jour. La relance minute passe par le bot BotHosting :

Dans le `.env` du **boutique-bot** (celui déjà branché au concours) :

```
CONCOURS_CRON_URL=https://concours.boxingcenter.fr/api/cron-wa
CONCOURS_CRON_SECRET=<même valeur que CRON_SECRET du concours>
```

Puis redémarrer le bot. Sans ça, les WhatsApp ratés ne sont repris que le matin.
