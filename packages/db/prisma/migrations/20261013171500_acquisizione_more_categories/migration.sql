-- Data: nuove categorie di sistema per il gruppo ACQUISIZIONE ("Acquisto e spese")
INSERT INTO "cost_categories" ("id", "tenantId", "group", "name", "order")
SELECT gen_random_uuid()::text, NULL, 'ACQUISIZIONE', 'Notaio', 5
WHERE NOT EXISTS (SELECT 1 FROM "cost_categories" WHERE "tenantId" IS NULL AND "name" = 'Notaio');

INSERT INTO "cost_categories" ("id", "tenantId", "group", "name", "order")
SELECT gen_random_uuid()::text, NULL, 'ACQUISIZIONE', 'Geometra', 6
WHERE NOT EXISTS (SELECT 1 FROM "cost_categories" WHERE "tenantId" IS NULL AND "name" = 'Geometra');

INSERT INTO "cost_categories" ("id", "tenantId", "group", "name", "order")
SELECT gen_random_uuid()::text, NULL, 'ACQUISIZIONE', 'Ingegnere', 7
WHERE NOT EXISTS (SELECT 1 FROM "cost_categories" WHERE "tenantId" IS NULL AND "name" = 'Ingegnere');

INSERT INTO "cost_categories" ("id", "tenantId", "group", "name", "order")
SELECT gen_random_uuid()::text, NULL, 'ACQUISIZIONE', 'Costi comunali', 8
WHERE NOT EXISTS (SELECT 1 FROM "cost_categories" WHERE "tenantId" IS NULL AND "name" = 'Costi comunali');

INSERT INTO "cost_categories" ("id", "tenantId", "group", "name", "order")
SELECT gen_random_uuid()::text, NULL, 'ACQUISIZIONE', 'Costi per mutuo', 9
WHERE NOT EXISTS (SELECT 1 FROM "cost_categories" WHERE "tenantId" IS NULL AND "name" = 'Costi per mutuo');
