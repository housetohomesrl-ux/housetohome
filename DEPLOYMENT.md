# Deploy in produzione

Guida per mettere online FlipPlan con **Railway** (API + PostgreSQL) e **Vercel** (frontend). Sono entrambi
servizi con piano gratuito sufficiente per iniziare. Non ho accesso ai tuoi account: questi passaggi vanno
eseguiti da te nelle rispettive dashboard (o chiedimi di scriverti comandi/config più specifici se preferisci
la CLI).

## 0. Prerequisito

Il codice deve essere sul branch che vuoi deployare (`claude/flipplan-saas-architecture-8h7sb4` oppure, meglio,
apri prima una Pull Request e mergiala su `main` — così i servizi di hosting puntano al branch stabile).

## 1. Backend + Database su Railway

1. Vai su [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → seleziona
   `housetohomesrl-ux/housetohome`.
2. Nel progetto, **+ New → Database → PostgreSQL** per aggiungere il database (Railway crea automaticamente la
   variabile `DATABASE_URL` per quel servizio).
3. Sul servizio creato dal repo (quello dell'API), apri **Settings**:
   - **Root Directory**: lascialo vuoto/`.` (repo root) — è un monorepo pnpm, la build deve partire dalla root.
   - **Build Command**:
     ```
     pnpm install --frozen-lockfile && pnpm --filter @flipplan/db generate
     ```
   - **Start Command**:
     ```
     pnpm --filter @flipplan/db migrate:deploy && pnpm --filter @flipplan/api start
     ```
4. Vai su **Variables** e aggiungi:
   - `DATABASE_URL` → clicca "Add Reference" e seleziona la variabile `DATABASE_URL` del servizio Postgres (così
     restano sincronizzate automaticamente)
   - `NODE_ENV` = `production`
   - `SESSION_COOKIE_NAME` = `flipplan_session`
   - `SESSION_TTL_DAYS` = `30`
   - `WEB_ORIGIN` = per ora mettici un placeholder tipo `https://placeholder.vercel.app` (lo aggiorni al punto 3
     qui sotto, dopo aver creato il frontend su Vercel)
   - `PORT`: non impostarla — Railway la inietta automaticamente e il server è già configurato per rispettarla.
5. Deploya. Poi vai su **Settings → Networking → Generate Domain** per ottenere l'URL pubblico dell'API (es.
   `https://flipplan-api-production.up.railway.app`). Tienilo a portata di mano.
6. **Seed di sistema** (categorie di costo e template — va fatto una volta sola): dalla dashboard Railway apri il
   servizio → **⋮ → Run Command** (o via CLI `railway run pnpm --filter @flipplan/db seed`) ed esegui:
   ```
   pnpm --filter @flipplan/db seed
   ```
   Non eseguire `db:seed:demo` in produzione — crea dati fittizi.

## 2. Frontend su Vercel

1. Vai su [vercel.com](https://vercel.com) → **Add New → Project** → importa lo stesso repo GitHub.
2. Vercel rileva il monorepo. Configura:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Vite (dovrebbe essere auto-rilevato)
   - Build/Install command: lascia i default (Vercel usa pnpm e installa dalla root del monorepo automaticamente
     grazie al `pnpm-lock.yaml` in root)
3. **Environment Variables**:
   - `VITE_API_URL` = l'URL Railway ottenuto al passo 1.5 (es. `https://flipplan-api-production.up.railway.app`)
4. Deploya. Vercel ti dà un URL tipo `https://housetohome-flipplan.vercel.app` — **questo è il link dell'app**.

## 3. Ultimo giro: collega i due URL

1. Torna su Railway → Variables del servizio API → aggiorna `WEB_ORIGIN` con l'URL Vercel reale del punto 2.4
   (senza slash finale).
2. Railway ri-deploya automaticamente il servizio con la variabile aggiornata.
3. Apri l'URL Vercel nel browser, registra un account e verifica che login/creazione deal funzionino.

## Note importanti

- **Cookie di sessione cross-dominio**: frontend e backend sono su domini diversi (Vercel/Railway), quindi il
  cookie di sessione è configurato per `sameSite=none; secure` in produzione (richiede HTTPS, che entrambe le
  piattaforme forniscono di default) — già gestito nel codice, non serve toccare nulla.
- **Storage allegati** (preventivi, loghi): non ancora implementato in Fase 1 — al momento è solo un campo URL
  testuale. Prima di usarlo in produzione andrà collegato a uno storage vero (es. Cloudflare R2/S3).
- **Costi**: entrambi i piani gratuiti hanno limiti (Railway: crediti mensili gratuiti poi a consumo; Vercel:
  generoso per progetti personali). Per un uso continuativo/commerciale valuta i piani a pagamento.
- **Dominio personalizzato**: sia Railway sia Vercel permettono di collegare un dominio tuo (es.
  `app.housetohome.it`) dalle rispettive impostazioni "Domains", una volta pronto.
