-- Ligne commercial-l8, fonctions 94 et 91 · modes d'arrondi du prix proposé
-- (Sage, P_ARRONDI) et collaborateurs avec leurs rôles commerciaux (Sage,
-- F_COLLABORATEUR), le représentant d'un tiers choisi parmi eux. Clés RESTRICT ·
-- un mode qu'un article porte, un collaborateur qui représente un tiers, ne
-- partent pas en silence.

-- CreateEnum
CREATE TYPE "MethodeArrondi" AS ENUM ('PROCHE', 'SUPERIEUR', 'INFERIEUR');

-- AlterTable
ALTER TABLE "articles_commerciaux" ADD COLUMN     "modeArrondiId" TEXT;

-- AlterTable
ALTER TABLE "tiers" ADD COLUMN     "representantId" TEXT;

-- CreateTable
CREATE TABLE "modes_arrondi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "intitule" VARCHAR(35) NOT NULL,
    "methode" "MethodeArrondi" NOT NULL,
    "pas" DECIMAL(18,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modes_arrondi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborateurs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" VARCHAR(35) NOT NULL,
    "prenom" VARCHAR(35),
    "fonction" VARCHAR(35),
    "telephone" VARCHAR(30),
    "email" VARCHAR(120),
    "vendeur" BOOLEAN NOT NULL DEFAULT false,
    "caissier" BOOLEAN NOT NULL DEFAULT false,
    "acheteur" BOOLEAN NOT NULL DEFAULT false,
    "controleur" BOOLEAN NOT NULL DEFAULT false,
    "financier" BOOLEAN NOT NULL DEFAULT false,
    "recouvrement" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborateurs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modes_arrondi_tenantId_intitule_key" ON "modes_arrondi"("tenantId", "intitule");

-- CreateIndex
CREATE INDEX "collaborateurs_tenantId_actif_idx" ON "collaborateurs"("tenantId", "actif");

-- CreateIndex
CREATE INDEX "articles_commerciaux_modeArrondiId_idx" ON "articles_commerciaux"("modeArrondiId");

-- CreateIndex
CREATE INDEX "tiers_representantId_idx" ON "tiers"("representantId");

-- AddForeignKey
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_representantId_fkey" FOREIGN KEY ("representantId") REFERENCES "collaborateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_modeArrondiId_fkey" FOREIGN KEY ("modeArrondiId") REFERENCES "modes_arrondi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modes_arrondi" ADD CONSTRAINT "modes_arrondi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborateurs" ADD CONSTRAINT "collaborateurs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

