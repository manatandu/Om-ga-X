-- LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · les taux de majoration des heures,
-- déclarés par le cabinet avec leur source (Code du travail, art. 119, 120, e)
-- et 124 ; arrêté du 8 août 2008, mentions 8 à 11). Aucun taux n'est livré.

-- CreateEnum
CREATE TYPE "NatureMajorationHeures" AS ENUM ('HEURES_SUPPLEMENTAIRES', 'TRAVAIL_DE_NUIT', 'TRAVAIL_REPOS_OU_FERIE');

-- CreateTable
CREATE TABLE "majorations_heures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nature" "NatureMajorationHeures" NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "tauxPourCent" DECIMAL(7,2) NOT NULL,
    "source" VARCHAR(300) NOT NULL,
    "dateEffet" DATE NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "desactiveLe" TIMESTAMP(3),
    "desactivePar" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "majorations_heures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "majorations_heures_tenantId_nature_idx" ON "majorations_heures"("tenantId", "nature");

-- AddForeignKey
ALTER TABLE "majorations_heures" ADD CONSTRAINT "majorations_heures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

