# FlipPlan — House to Home

Applicazione web SaaS per investitori immobiliari "buy-renovate-resell": preventivatore di ristrutturazione/analisi
di deal + generatore di business plan (quest'ultimo arriverà in Fase 3).

Questa è la **Fase 1**: schema dati multi-tenant, CRUD completo di un deal, motore di calcolo finanziario (con
fiscalità italiana IVA/IRES/IRAP/plusvalenza, quota capitale/interessi sui finanziamenti, tracciamento pagamenti,
fonti e impieghi) e dashboard risultati.

> **Vuoi un link pubblico per usare l'app dal browser?** Vedi [DEPLOYMENT.md](./DEPLOYMENT.md) per la guida al
> deploy su Railway (API+DB) e Vercel (frontend) — richiede un tuo account su questi servizi.

## Stack tecnico

| Livello | Scelta |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, componenti UI custom, Recharts, React Router |
| Backend | Node.js + Fastify + tRPC (type-safety end-to-end con il frontend) |
| Database | PostgreSQL + Prisma ORM |
| Motore di calcolo | `packages/shared` — funzioni pure TypeScript, usate sia da backend che (in futuro) da frontend per anteprime live. Aritmetica interna con `decimal.js` per evitare errori di arrotondamento |
| Auth | Sessioni custom (cookie httpOnly + hash token in DB), predisposta per aggiungere OAuth in futuro |
| Test | Vitest (motore di calcolo: 28 test con numeri verificati a mano) |

## Struttura del repository

```
flipplan/
├── apps/
│   ├── web/        # Frontend React
│   └── api/        # Backend Fastify + tRPC
├── packages/
│   ├── shared/      # Motore di calcolo finanziario + schemi Zod condivisi
│   └── db/          # Schema Prisma, migration, seed
```

## Prerequisiti

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` se non già disponibile)
- PostgreSQL ≥ 14 in esecuzione in locale (o accessibile via `DATABASE_URL`)

## Setup locale

1. **Installa le dipendenze** (dalla root del repo):
   ```bash
   pnpm install
   ```

2. **Crea il database** (se non esiste già):
   ```bash
   createuser flipplan --pwprompt   # oppure via psql: CREATE USER flipplan WITH PASSWORD '...' CREATEDB;
   createdb flipplan -O flipplan
   ```

3. **Configura le variabili d'ambiente.** Copia i file `.env.example` in `.env` in:
   - `packages/db/.env` (`DATABASE_URL`)
   - `apps/api/.env` (`DATABASE_URL`, `PORT`, `WEB_ORIGIN`, ...)
   - `apps/web/.env` (`VITE_API_URL`)

   I default puntano a `postgresql://flipplan:flipplan_dev_pw@localhost:5432/flipplan` e alle porte 4000 (API) / 5173
   (web) — vanno bene per lo sviluppo locale così come sono, se il tuo Postgres locale è configurato allo stesso modo.

4. **Esegui la migration e il seed di sistema** (categorie di costo e template di business plan predefiniti — dati
   di sistema, non demo, sicuri anche in produzione):
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **(Opzionale) Seed demo**, per avere un deal di esempio con cui esplorare l'app (chiaramente separato dai dati
   reali, `isDemo: true`, da eseguire SOLO in locale/staging):
   ```bash
   pnpm db:seed:demo
   # login demo: demo@flipplan.local / demo1234
   ```

6. **Avvia backend e frontend** (in due terminali, o con `pnpm dev` per entrambi via Turborepo):
   ```bash
   pnpm dev:api   # http://localhost:4000
   pnpm dev:web   # http://localhost:5173
   ```

Apri http://localhost:5173, registra un account (o usa le credenziali demo) e crea un deal.

## Script disponibili

| Comando | Descrizione |
|---|---|
| `pnpm dev` | Avvia API e web in parallelo (Turborepo) |
| `pnpm build` | Build di produzione di tutti i pacchetti/app |
| `pnpm typecheck` | Type-check dell'intero monorepo |
| `pnpm test` | Esegue i test (motore di calcolo finanziario) |
| `pnpm db:migrate` | Applica le migration Prisma in dev |
| `pnpm db:seed` | Seed di sistema (categorie di costo, template) — safe per produzione |
| `pnpm db:seed:demo` | Seed demo (un deal di esempio) — SOLO locale/staging |
| `pnpm db:studio` | Apre Prisma Studio per ispezionare il database |

## Motore di calcolo finanziario

Tutte le formule (VAT, costi di detenzione, piani di ammortamento, imposte, ROI, cash-on-cash, breakeven,
fonti e impieghi, sensitivity) sono funzioni pure documentate in `packages/shared/src/calc/`, ciascuna con un
commento che riporta la formula esatta usata. Sono coperte da 28 test unitari in cui i numeri attesi sono calcolati
a mano (non solo generati dal codice stesso) — vedi `packages/shared/src/calc/*.test.ts`.

## Assunzioni fatte in Fase 1 (da verificare/correggere)

Queste sono le interpretazioni adottate in assenza di una specifica più stringente — vanno riviste se non
corrispondono al tuo caso reale:

1. **Contingency**: applicata sull'imponibile delle sole categorie LAVORAZIONI + MATERIALI (non su Acquisizione né
   Enti Esterni).
2. **Sensitivity a doppia entrata**: lo sforamento % si applica solo alle righe di categoria LAVORAZIONI (confermato
   in sede di revisione schema).
3. **Base imponibile plusvalenza (persona fisica)**: prezzo di vendita − (prezzo di acquisto + costi netti non-memo
   sostenuti). È esplicitamente una stima — l'esatta deducibilità dei costi incrementativi va verificata con il
   commercialista (avviso mostrato in UI).
4. **IRES/IRAP (società di capitali)**: calcolate sull'utile lordo pre-imposte se positivo, senza modellare
   capitalizzazioni o indeducibilità specifiche — stima esplicitamente segnalata in UI.
5. **Capitale mutuo "residuo alla vendita"**: per un finanziamento la cui durata coincide con la durata di
   detenzione, corrisponde al capitale ancora dovuto prima dell'ultima rata (bullet intero per INTEREST_ONLY, quota
   residua minima per FRENCH).
6. **Cassa netta finale**: calcolata come movimento di cassa diretto all'evento vendita (incasso − costi vendita −
   capitale mutuo residuo − imposte − costi ancora da pagare − saldo IVA), non come identità contabile — per
   restare tracciabile riga per riga.
7. **Prezzo di vendita inserito**: trattato come imponibile (IVA calcolata a parte se "vendita soggetta a IVA" =
   SI), confermato in sede di revisione schema.
8. **Deal di default**: alla creazione di un deal vengono creati automaticamente le sezioni Acquisizione, Fiscale
   (default: persona fisica), Ristrutturazione (contingency 12%), Detenzione (6 mesi) e i 3 scenari di vendita, tutti
   a zero — da compilare.

## Cosa resta da testare/verificare (Fase 1)

- Verifica manuale in browser del flusso completo (login → creazione deal → compilazione di tutte le sezioni →
  dashboard risultati) — è stato validato via chiamate dirette all'API (curl) end-to-end con numeri verificati a
  mano, ma non ancora in un browser reale.
- Revisione delle 8 assunzioni sopra rispetto al tuo caso d'uso reale.
- Caricamento file per i preventivi (`Quote.fileUrl`) — al momento è un campo testo libero per l'URL, senza upload
  vero e proprio: l'integrazione con uno storage (locale in dev, S3-compatibile in produzione) è prevista in una
  fase successiva.

## Prossime fasi (dal piano concordato)

- **Fase 2**: rifinitura UI dell'analisi di sensitività/scenari multipli (i calcoli esistono già lato motore e
  sono esposti in dashboard; da valutare se serve altro).
- **Fase 3**: generatore di business plan (PDF/DOCX).
- **Fase 4**: rifinitura portafoglio multi-deal, libreria prezzi (le basi ci sono già).
- **Fase 5**: rifinitura UI, personalizzazione template, export/import dati.
- **Fase 6 (non pianificata)**: eventuale modulo di billing/abbonamento (Stripe), se prevista la rivendita.
