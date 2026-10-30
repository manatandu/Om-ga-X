-- Ligne restes-immos-budgets, point 3 · l'annulation d'une sortie
-- d'immobilisation (AUDCIF art. 20, al. 2 ; art. 22, 2°). La sortie garde
-- désormais ce que son annulation doit retirer · la dotation complémentaire
-- (liaison RETENUE, RESTRICT), la part de chaque ligne de réévaluation soldée,
-- et, sur la fiche des unités sorties d'un lot, la reprise de leur part de
-- dépréciation passée sur le lot. Les sorties d'avant la ligne n'ont rien de
-- tout cela · nullable, sans défaut, l'annulation le dit. La reprise sur le
-- lot est nommée SANS clé étrangère · elle vise déjà le lot par une clé
-- obligatoire, et un cycle de clés dont l'une est obligatoire ne se purge pas.

-- AlterEnum
ALTER TYPE "NatureTraitementImmobilisation" ADD VALUE 'SORTIE';

-- AlterTable
ALTER TABLE "immobilisations" ADD COLUMN "ecritureComplementSortieId" TEXT,
ADD COLUMN "passesEcartSortie" JSONB,
ADD COLUMN "repriseDepreciationLotId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "immobilisations_ecritureComplementSortieId_key" ON "immobilisations"("ecritureComplementSortieId");

-- CreateIndex
CREATE UNIQUE INDEX "immobilisations_repriseDepreciationLotId_key" ON "immobilisations"("repriseDepreciationLotId");

-- AddForeignKey
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_ecritureComplementSortieId_fkey" FOREIGN KEY ("ecritureComplementSortieId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
