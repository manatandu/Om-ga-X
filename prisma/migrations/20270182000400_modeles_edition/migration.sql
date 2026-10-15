-- Ligne sage-l7, fonction 59 · les modèles d'édition et les sauts.
--
-- Les colonnes facultatives gardées d'une édition de travail (plan comptable,
-- plan des tiers, plan analytique) et le saut entre ses groupes · jamais un
-- état financier ni un livre obligatoire (décision L7-1 · AUDCIF Titre IX
-- ch. 2, art. 19, 20 al. 1 et 22, 1°).

-- CreateEnum
CREATE TYPE "EditionModele" AS ENUM ('PLAN_COMPTABLE', 'PLAN_TIERS', 'PLAN_ANALYTIQUE');

-- CreateEnum
CREATE TYPE "SautEdition" AS ENUM ('AUCUN', 'LIGNE', 'PAGE');

-- CreateTable
CREATE TABLE "modeles_edition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "edition" "EditionModele" NOT NULL,
    "nom" TEXT NOT NULL,
    "colonnes" TEXT[],
    "saut" "SautEdition" NOT NULL DEFAULT 'AUCUN',
    "creePar" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modeles_edition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modeles_edition_tenantId_edition_nom_key" ON "modeles_edition"("tenantId", "edition", "nom");

-- AddForeignKey
ALTER TABLE "modeles_edition" ADD CONSTRAINT "modeles_edition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

