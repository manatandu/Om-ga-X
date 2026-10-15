-- Ligne sage-l7, fonction 59 · l'impression différée.
--
-- Une édition demandée maintenant, produite ensuite par le moteur de l'export
-- du même livre, retrouvée plus tard (AUDCIF art. 22, 7° · états numérotés et
-- datés). La demande ne se supprime pas ; son fichier peut se retirer. Aucune
-- clé vers l'exercice · les critères le nomment.

-- CreateEnum
CREATE TYPE "NatureImpressionDifferee" AS ENUM ('JOURNAL', 'GRAND_LIVRE', 'BALANCE');

-- CreateEnum
CREATE TYPE "EtatImpressionDifferee" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'PRETE', 'ECHOUEE');

-- CreateTable
CREATE TABLE "impressions_differees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nature" "NatureImpressionDifferee" NOT NULL,
    "criteres" JSONB NOT NULL,
    "libelle" TEXT NOT NULL,
    "etat" "EtatImpressionDifferee" NOT NULL DEFAULT 'EN_ATTENTE',
    "demandeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demandePar" TEXT NOT NULL,
    "commenceLe" TIMESTAMP(3),
    "produitLe" TIMESTAMP(3),
    "motifEchec" TEXT,
    "nomFichier" TEXT,
    "taille" INTEGER,
    "empreinte" TEXT,
    "contenu" BYTEA,
    "fichierRetireLe" TIMESTAMP(3),

    CONSTRAINT "impressions_differees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impressions_differees_tenantId_etat_demandeLe_idx" ON "impressions_differees"("tenantId", "etat", "demandeLe");

-- CreateIndex
CREATE UNIQUE INDEX "impressions_differees_tenantId_numero_key" ON "impressions_differees"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "impressions_differees" ADD CONSTRAINT "impressions_differees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

