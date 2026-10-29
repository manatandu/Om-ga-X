-- Ligne immos, fonction n° 65 · la quantité d'un bien (un lot d'unités
-- identiques) et la fiche du lot dont des unités ont été sorties.
-- Toute fiche existante porte une unité, ce qu'elle était.
ALTER TYPE "NatureMouvementDepreciation" ADD VALUE 'CESSION_PARTIELLE';
ALTER TABLE "immobilisations" ADD COLUMN "quantite" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "immobilisations" ADD COLUMN "fractionDeId" TEXT;
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_quantite_positive" CHECK ("quantite" >= 1);
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_fractionDeId_fkey" FOREIGN KEY ("fractionDeId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
