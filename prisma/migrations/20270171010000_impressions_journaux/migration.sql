-- Ligne sage-l1, fonction 60 · le journal marqué « imprimé ».
--
-- L'impression du journal, enregistrée par le serveur (AUDCIF art. 22, 1° et
-- 7° · données restituées sur papier, états numérotés et datés), et l'option
-- du dossier qui refuse de clôturer un journal non imprimé (décision D3 de la
-- reproduction, désactivée par défaut comme le double regard).

-- CreateEnum
CREATE TYPE "FormeImpressionJournal" AS ENUM ('IMPRESSION', 'EXPORT');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "refusClotureJournalNonImprime" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "impressions_journaux" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "journalId" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "forme" "FormeImpressionJournal" NOT NULL,
    "nombreEcritures" INTEGER NOT NULL,
    "imprimeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imprimePar" TEXT NOT NULL,

    CONSTRAINT "impressions_journaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impressions_journaux_tenantId_numero_key" ON "impressions_journaux"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "impressions_journaux_tenantId_exerciceId_journalId_idx" ON "impressions_journaux"("tenantId", "exerciceId", "journalId");

-- AddForeignKey
ALTER TABLE "impressions_journaux" ADD CONSTRAINT "impressions_journaux_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impressions_journaux" ADD CONSTRAINT "impressions_journaux_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impressions_journaux" ADD CONSTRAINT "impressions_journaux_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
