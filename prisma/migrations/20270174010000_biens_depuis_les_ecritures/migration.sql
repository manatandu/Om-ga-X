-- Ligne sage-l4, fonction n° 68 · créer les biens à partir des écritures
-- déjà passées (Sage, création automatique des biens).
--
-- Une écriture déjà passée qui porte plusieurs biens (une facture de
-- plusieurs biens) fait naître une fiche par LIGNE · l'unicité de
-- l'écriture d'acquisition tombe, celle de la LIGNE la remplace. La ligne
-- validée est indélébile (AUDCIF art. 22, 2°) · RESTRICT, jamais un lien
-- qui se dénoue seul.

-- DropIndex
DROP INDEX "immobilisations_ecritureAcquisitionId_key";

-- AlterTable
ALTER TABLE "immobilisations" ADD COLUMN     "ligneAcquisitionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "immobilisations_ligneAcquisitionId_key" ON "immobilisations"("ligneAcquisitionId");

-- CreateIndex
CREATE INDEX "immobilisations_ecritureAcquisitionId_idx" ON "immobilisations"("ecritureAcquisitionId");

-- AddForeignKey
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_ligneAcquisitionId_fkey" FOREIGN KEY ("ligneAcquisitionId") REFERENCES "lignes_ecriture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
