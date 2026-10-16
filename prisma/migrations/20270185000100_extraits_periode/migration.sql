-- Ligne export-periode · la balance et le grand livre d'une période de
-- l'exercice (gel levé par Manasse le 2026-10-16).
--
-- Chaque extrait remis (fichier Excel, impression de l'écran) prend un numéro
-- de la suite continue du dossier et sa date (AUDCIF art. 22, 7°, « les états
-- périodiques fournis soient numérotés et datés »). Il ne se supprime jamais.
-- Aucune clé vers l'exercice ni le compte · le libellé et les dates figent ce
-- que l'extrait porte.

-- CreateEnum
CREATE TYPE "NatureExtraitPeriode" AS ENUM ('BALANCE', 'GRAND_LIVRE');

-- CreateEnum
CREATE TYPE "FormeExtraitPeriode" AS ENUM ('EXCEL', 'IMPRESSION');

-- CreateTable
CREATE TABLE "extraits_periode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nature" "NatureExtraitPeriode" NOT NULL,
    "forme" "FormeExtraitPeriode" NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "etabliLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etabliPar" TEXT NOT NULL,
    "termineLe" TIMESTAMP(3),
    "motifEchec" TEXT,

    CONSTRAINT "extraits_periode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extraits_periode_tenantId_numero_key" ON "extraits_periode"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "extraits_periode" ADD CONSTRAINT "extraits_periode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
