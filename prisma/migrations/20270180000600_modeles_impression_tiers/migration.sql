-- Ligne sage-l2, fonction 27 · les modèles d'impression propres au tiers
-- (Sage, volet « Modèles d'impression » de la fiche, F_COMPTETMODELE) · un
-- modèle par document (extrait de compte, avis de règlement, rappel), tenu
-- par le dossier et choisi sur la fiche du tiers. Aucun modèle n'existe
-- avant, aucun tiers n'en porte · les documents partent comme avant.

-- CreateEnum
CREATE TYPE "NatureModeleImpression" AS ENUM ('EXTRAIT', 'REGLEMENT', 'RAPPEL');

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "modeleImpressionExtraitId" TEXT,
ADD COLUMN     "modeleImpressionRappelId" TEXT,
ADD COLUMN     "modeleImpressionReglementId" TEXT;

-- CreateTable
CREATE TABLE "modeles_impression_tiers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nature" "NatureModeleImpression" NOT NULL,
    "intitule" VARCHAR(35) NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "modeles_impression_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modeles_impression_tiers_tenantId_nature_intitule_key" ON "modeles_impression_tiers"("tenantId", "nature", "intitule");

-- CreateIndex · le retrait d'un modèle compte les tiers qui le portent, et la
-- clé étrangère RESTRICT les relit (second tour de relecture, m8).
CREATE INDEX "tiers_modeleImpressionExtraitId_idx" ON "tiers"("modeleImpressionExtraitId");

-- CreateIndex
CREATE INDEX "tiers_modeleImpressionReglementId_idx" ON "tiers"("modeleImpressionReglementId");

-- CreateIndex
CREATE INDEX "tiers_modeleImpressionRappelId_idx" ON "tiers"("modeleImpressionRappelId");

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_modeleImpressionExtraitId_fkey" FOREIGN KEY ("modeleImpressionExtraitId") REFERENCES "modeles_impression_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_modeleImpressionReglementId_fkey" FOREIGN KEY ("modeleImpressionReglementId") REFERENCES "modeles_impression_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_modeleImpressionRappelId_fkey" FOREIGN KEY ("modeleImpressionRappelId") REFERENCES "modeles_impression_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_impression_tiers" ADD CONSTRAINT "modeles_impression_tiers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

