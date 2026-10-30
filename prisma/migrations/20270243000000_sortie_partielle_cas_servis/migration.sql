-- Ligne restes-immos-budgets, point 4 · deux sorties partielles du même lot
-- dans le même exercice reprennent chacune la part de dépréciation de leurs
-- unités (fiche du compte 81, exclusions · « les dépréciations afférentes aux
-- éléments d'actif immobilisé cédés → 29 » ; AUDCIF Titre VIII ch. 12). La
-- clé « un mouvement par bien, par exercice et par nature » (ligne A22 bis)
-- reste UNIQUE pour toute autre nature · le test de la clôture (CLOTURE) et
-- les deux mouvements du transfert à la mise en service. Prisma ne sait pas
-- dire un index partiel · le schéma déclare l'index simple, et l'unicité vit
-- ici, comme l'index des détentions ouvertes (20270198000100).

-- DropIndex
DROP INDEX "depreciations_immobilisation_immobilisationId_exerciceId_na_key";

-- CreateIndex
CREATE INDEX "depreciations_immobilisation_immobilisationId_exerciceId_na_idx" ON "depreciations_immobilisation"("immobilisationId", "exerciceId", "nature");

-- CreateIndex
CREATE UNIQUE INDEX "depreciations_immobilisation_un_mouvement_par_nature_key" ON "depreciations_immobilisation"("immobilisationId", "exerciceId", "nature")
  WHERE "nature" <> 'CESSION_PARTIELLE';
