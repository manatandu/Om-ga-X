-- Ligne tva-decisions, relectures du 2026-10-08 · une liquidation passée sous
-- la règle des lignes tardives et des négatifs de factures, et l'instant de la
-- lecture de sa déclaration. Les liquidations existantes restent hors de la
-- règle (faux) · leurs moteurs écartaient négatifs et lignes tardives.
ALTER TABLE "liquidations_tva" ADD COLUMN "regleTardifs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "liquidations_tva" ADD COLUMN "instantLecture" TIMESTAMP(3);
