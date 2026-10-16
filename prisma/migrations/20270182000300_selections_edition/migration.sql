-- Ligne sage-l7, fonction 59 · les sélections enregistrées.
--
-- Les critères d'une édition gardés sous un nom, au dossier · ils nomment
-- des objets du dossier, qui se travaille à plusieurs et sur plusieurs postes.
-- Jamais l'exercice · une sélection se rappelle sur l'exercice choisi.

-- CreateEnum
CREATE TYPE "EditionSelection" AS ENUM ('JOURNAL', 'IMPRESSION_DIFFEREE');

-- CreateTable
CREATE TABLE "selections_edition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "edition" "EditionSelection" NOT NULL,
    "nom" TEXT NOT NULL,
    "criteres" JSONB NOT NULL,
    "creePar" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selections_edition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "selections_edition_tenantId_edition_nom_key" ON "selections_edition"("tenantId", "edition", "nom");

-- AddForeignKey
ALTER TABLE "selections_edition" ADD CONSTRAINT "selections_edition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

