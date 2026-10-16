-- Ligne sage-l2, fonction 31 · les lieux de livraison d'un client (Sage,
-- F_LIVRAISON). Partie de la fiche du tiers, supprimés avec lui, un seul
-- principal par client (tenu par le service). Aucun lieu n'existe avant.

-- CreateTable
CREATE TABLE "lieux_livraison" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tiersId" TEXT NOT NULL,
    "intitule" VARCHAR(35) NOT NULL,
    "adresse" TEXT,
    "complement" TEXT,
    "boitePostale" TEXT,
    "ville" TEXT,
    "pays" TEXT,
    "contact" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "estPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lieux_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lieux_livraison_tenantId_tiersId_idx" ON "lieux_livraison"("tenantId", "tiersId");

-- AddForeignKey
ALTER TABLE "lieux_livraison" ADD CONSTRAINT "lieux_livraison_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lieux_livraison" ADD CONSTRAINT "lieux_livraison_tiersId_fkey" FOREIGN KEY ("tiersId") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
