-- Ligne A22 bis · à la mise en service d'un bien en cours, la dépréciation
-- portée par le 29x9 est reprise puis dotée de nouveau au 29 du bien achevé
-- (décision de Manasse du 2026-10-04). Deux mouvements de plus, le même jour,
-- dans l'exercice de la mise en service · la clé « un mouvement par bien et
-- par exercice » s'élargit à la NATURE du mouvement, et à elle seule. Le test
-- de la clôture reste unique (CLOTURE, valeur des lignes existantes).

CREATE TYPE "NatureMouvementDepreciation" AS ENUM ('CLOTURE', 'TRANSFERT_REPRISE', 'TRANSFERT_DOTATION');

ALTER TABLE "depreciations_immobilisation"
  ADD COLUMN "nature" "NatureMouvementDepreciation" NOT NULL DEFAULT 'CLOTURE';

DROP INDEX "depreciations_immobilisation_immobilisationId_exerciceId_key";

-- Le nom est celui que Prisma attend, tronqué à 63 caractères (limite de
-- PostgreSQL) · `prisma migrate diff` ne détecte alors aucune dérive.
CREATE UNIQUE INDEX "depreciations_immobilisation_immobilisationId_exerciceId_na_key"
  ON "depreciations_immobilisation"("immobilisationId", "exerciceId", "nature");
