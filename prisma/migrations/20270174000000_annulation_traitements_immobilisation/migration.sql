-- Ligne sage-l4, fonction n° 67 · ANNULER UNE DOTATION OU UN TRAITEMENT
-- D'IMMOBILISATION (décision D6 de la reproduction ; AUDCIF art. 20, al. 2 et
-- art. 22, 2°). Le traitement annulé est retiré de sa table ; l'acte
-- d'annulation le garde entier, avec le sort de ses écritures (supprimée au
-- brouillard, ou inscrite en négatif, l'écriture d'origine et son négatif
-- retenus ici).

-- CreateEnum
CREATE TYPE "NatureTraitementImmobilisation" AS ENUM ('DOTATION', 'DEPRECIATION', 'REVISION_PLAN', 'DEROGATOIRE', 'REEVALUATION', 'REPRISE_SUBVENTION', 'REPRISE_PROVISION_REEVALUATION');

-- La valeur résiduelle d'avant la réévaluation, que l'annulation rétablit (D-41).
-- AlterTable
ALTER TABLE "lignes_reevaluation_bilan" ADD COLUMN     "valeurResiduelleAvant" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "annulations_traitements_immobilisation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nature" "NatureTraitementImmobilisation" NOT NULL,
    "immobilisationId" TEXT,
    "exerciceId" TEXT NOT NULL,
    "acteId" TEXT NOT NULL,
    "acte" JSONB NOT NULL,
    "montant" DECIMAL(18,2),
    "motif" TEXT NOT NULL,
    "traitement" TEXT NOT NULL,
    "numeroPieceOrigine" INTEGER,
    "ecritureOrigineId" TEXT,
    "ecritureNegatifId" TEXT,
    "annuleeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleePar" TEXT NOT NULL,

    CONSTRAINT "annulations_traitements_immobilisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annulations_traitements_immobilisation_ecritureOrigineId_key" ON "annulations_traitements_immobilisation"("ecritureOrigineId");

-- CreateIndex
CREATE UNIQUE INDEX "annulations_traitements_immobilisation_ecritureNegatifId_key" ON "annulations_traitements_immobilisation"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "annulations_traitements_immobilisation_tenantId_immobilisat_idx" ON "annulations_traitements_immobilisation"("tenantId", "immobilisationId");

-- CreateIndex
CREATE INDEX "annulations_traitements_immobilisation_exerciceId_idx" ON "annulations_traitements_immobilisation"("exerciceId");

-- AddForeignKey
ALTER TABLE "annulations_traitements_immobilisation" ADD CONSTRAINT "annulations_traitements_immobilisation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_traitements_immobilisation" ADD CONSTRAINT "annulations_traitements_immobilisation_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_traitements_immobilisation" ADD CONSTRAINT "annulations_traitements_immobilisation_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_traitements_immobilisation" ADD CONSTRAINT "annulations_traitements_immobilisation_ecritureOrigineId_fkey" FOREIGN KEY ("ecritureOrigineId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_traitements_immobilisation" ADD CONSTRAINT "annulations_traitements_immobilisation_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

