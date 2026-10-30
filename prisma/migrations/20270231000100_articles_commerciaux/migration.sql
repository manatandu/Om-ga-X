-- Ligne commercial-l8, étape (a) · articles commerciaux et tarifs par client.
--
-- L'article nomme ce que le dossier vend ou achète, avec ses comptes de vente
-- (classe 7) et d'achat (classe 6), son taux de taxe et, s'il est stocké,
-- l'article du magasin qu'il mouvemente (une fiche de stock au plus par
-- article commercial, index unique). Toutes les clés sont RESTRICT · un
-- article qui a servi se met en sommeil, il ne se supprime pas, et un compte,
-- un taux ou une fiche de stock qu'un article nomme ne part pas en silence.

-- CreateTable
CREATE TABLE "articles_commerciaux" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" VARCHAR(18) NOT NULL,
    "designation" VARCHAR(120) NOT NULL,
    "unite" VARCHAR(20) NOT NULL,
    "compteVenteId" TEXT,
    "compteAchatId" TEXT,
    "tauxTvaId" TEXT,
    "exonere" BOOLEAN NOT NULL DEFAULT false,
    "prixVenteHT" DECIMAL(18,2),
    "prixAchatHT" DECIMAL(18,2),
    "articleStockId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifs_clients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "tiersId" TEXT NOT NULL,
    "prixHT" DECIMAL(18,2),
    "remisePourcent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifs_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_commerciaux_articleStockId_key" ON "articles_commerciaux"("articleStockId");

-- CreateIndex
CREATE INDEX "articles_commerciaux_tenantId_actif_idx" ON "articles_commerciaux"("tenantId", "actif");

-- CreateIndex
CREATE INDEX "articles_commerciaux_compteVenteId_idx" ON "articles_commerciaux"("compteVenteId");

-- CreateIndex
CREATE INDEX "articles_commerciaux_compteAchatId_idx" ON "articles_commerciaux"("compteAchatId");

-- CreateIndex
CREATE INDEX "articles_commerciaux_tauxTvaId_idx" ON "articles_commerciaux"("tauxTvaId");

-- CreateIndex
CREATE UNIQUE INDEX "articles_commerciaux_tenantId_reference_key" ON "articles_commerciaux"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "tarifs_clients_tenantId_tiersId_idx" ON "tarifs_clients"("tenantId", "tiersId");

-- CreateIndex
CREATE INDEX "tarifs_clients_tiersId_idx" ON "tarifs_clients"("tiersId");

-- CreateIndex
CREATE UNIQUE INDEX "tarifs_clients_articleId_tiersId_key" ON "tarifs_clients"("articleId", "tiersId");

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_compteVenteId_fkey" FOREIGN KEY ("compteVenteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_compteAchatId_fkey" FOREIGN KEY ("compteAchatId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_tauxTvaId_fkey" FOREIGN KEY ("tauxTvaId") REFERENCES "taux_tva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_commerciaux" ADD CONSTRAINT "articles_commerciaux_articleStockId_fkey" FOREIGN KEY ("articleStockId") REFERENCES "articles_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifs_clients" ADD CONSTRAINT "tarifs_clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifs_clients" ADD CONSTRAINT "tarifs_clients_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_commerciaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifs_clients" ADD CONSTRAINT "tarifs_clients_tiersId_fkey" FOREIGN KEY ("tiersId") REFERENCES "tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

