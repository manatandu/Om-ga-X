-- Ligne sage-l2, fonction 1 · modes de règlement.
--
-- Sage, P_REGLEMENT · les modes de règlement du dossier (nature, code
-- interbancaire libre, journal de trésorerie proposé), le mode habituel du
-- tiers, celui de chaque échéance d'un modèle de règlement, et celui de la
-- ligne d'écriture (échéance attendue ou paiement fait). Toutes les colonnes
-- ajoutées sont nullables · rien de l'existant ne change de sens.

-- CreateEnum
CREATE TYPE "NatureModeReglement" AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT', 'CARTE_BANCAIRE', 'MONNAIE_ELECTRONIQUE', 'EFFET_DE_COMMERCE', 'PRELEVEMENT', 'AUTRE');

-- AlterTable
ALTER TABLE "echeances_reglement" ADD COLUMN     "modeReglementId" TEXT;

-- AlterTable
ALTER TABLE "lignes_ecriture" ADD COLUMN     "modeReglementId" TEXT;

-- AlterTable
ALTER TABLE "modeles_reglement" ADD COLUMN     "modeReglementId" TEXT;

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "modeReglementId" TEXT;

-- CreateTable
CREATE TABLE "modes_reglement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "nature" "NatureModeReglement" NOT NULL,
    "codeInterbancaire" TEXT,
    "journalId" TEXT,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "modes_reglement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modes_reglement_tenantId_code_key" ON "modes_reglement"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "modes_reglement_tenantId_intitule_key" ON "modes_reglement"("tenantId", "intitule");

-- CreateIndex
CREATE INDEX "lignes_ecriture_modeReglementId_idx" ON "lignes_ecriture"("modeReglementId");

-- CreateIndex · le retrait d'un mode compte ceux qui le portent, et la clé
-- étrangère RESTRICT les relit (second tour de relecture, m8).
CREATE INDEX "tiers_modeReglementId_idx" ON "tiers"("modeReglementId");

-- CreateIndex
CREATE INDEX "modeles_reglement_modeReglementId_idx" ON "modeles_reglement"("modeReglementId");

-- CreateIndex
CREATE INDEX "echeances_reglement_modeReglementId_idx" ON "echeances_reglement"("modeReglementId");

-- AddForeignKey
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_modeReglementId_fkey" FOREIGN KEY ("modeReglementId") REFERENCES "modes_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_reglement" ADD CONSTRAINT "modeles_reglement_modeReglementId_fkey" FOREIGN KEY ("modeReglementId") REFERENCES "modes_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echeances_reglement" ADD CONSTRAINT "echeances_reglement_modeReglementId_fkey" FOREIGN KEY ("modeReglementId") REFERENCES "modes_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_modeReglementId_fkey" FOREIGN KEY ("modeReglementId") REFERENCES "modes_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modes_reglement" ADD CONSTRAINT "modes_reglement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modes_reglement" ADD CONSTRAINT "modes_reglement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

