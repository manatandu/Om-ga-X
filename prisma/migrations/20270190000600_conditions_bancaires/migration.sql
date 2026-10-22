-- Ligne sage-l3, fonction 46 · conditions bancaires par RIB (versionnées par
-- date d'effet), autorisations de financement (engagements de la banque, hors
-- bilan) et unions de comptes bancaires (vue de trésorerie, sans compensation
-- au bilan). Décision D15 (architecture.md). Un RIB qui les porte ne se
-- retire pas · RESTRICT, et le service le refuse nommé avant la base.

-- CreateTable
CREATE TABLE "conditions_bancaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ribId" TEXT NOT NULL,
    "dateEffet" DATE NOT NULL,
    "typePalier" VARCHAR(10),
    "paliers" JSONB NOT NULL DEFAULT '[]',
    "tauxInteretsCrediteurs" DECIMAL(9,6),
    "tauxCommissionMouvement" DECIMAL(9,6),
    "tauxCommissionPlusFortDecouvert" DECIMAL(9,6),
    "fraisTenueCompte" DECIMAL(18,2),
    "periodiciteFrais" VARCHAR(13),
    "baseCalcul" INTEGER,
    "referenceConvention" VARCHAR(100) NOT NULL,
    "dateConvention" DATE NOT NULL,
    "commentaire" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "conditions_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autorisations_financement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ribId" TEXT NOT NULL,
    "nature" VARCHAR(20) NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE,
    "irrevocable" BOOLEAN NOT NULL,
    "referenceConvention" VARCHAR(100) NOT NULL,
    "dateConvention" DATE NOT NULL,
    "commentaire" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "autorisations_financement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unions_comptes_bancaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "intitule" VARCHAR(60) NOT NULL,
    "fusionEchelles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unions_comptes_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elements_unions_comptes_bancaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unionId" TEXT NOT NULL,
    "ribId" TEXT NOT NULL,
    "rang" INTEGER NOT NULL,

    CONSTRAINT "elements_unions_comptes_bancaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conditions_bancaires_tenantId_ribId_idx" ON "conditions_bancaires"("tenantId", "ribId");

-- CreateIndex
CREATE UNIQUE INDEX "conditions_bancaires_ribId_dateEffet_key" ON "conditions_bancaires"("ribId", "dateEffet");

-- CreateIndex
CREATE INDEX "autorisations_financement_tenantId_ribId_idx" ON "autorisations_financement"("tenantId", "ribId");

-- CreateIndex
CREATE UNIQUE INDEX "unions_comptes_bancaires_tenantId_code_key" ON "unions_comptes_bancaires"("tenantId", "code");

-- CreateIndex
CREATE INDEX "elements_unions_comptes_bancaires_tenantId_unionId_idx" ON "elements_unions_comptes_bancaires"("tenantId", "unionId");

-- CreateIndex
CREATE INDEX "elements_unions_comptes_bancaires_ribId_idx" ON "elements_unions_comptes_bancaires"("ribId");

-- CreateIndex
CREATE UNIQUE INDEX "elements_unions_comptes_bancaires_unionId_ribId_key" ON "elements_unions_comptes_bancaires"("unionId", "ribId");

-- CreateIndex
CREATE UNIQUE INDEX "elements_unions_comptes_bancaires_unionId_rang_key" ON "elements_unions_comptes_bancaires"("unionId", "rang");

-- AddForeignKey
ALTER TABLE "conditions_bancaires" ADD CONSTRAINT "conditions_bancaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions_bancaires" ADD CONSTRAINT "conditions_bancaires_ribId_fkey" FOREIGN KEY ("ribId") REFERENCES "ribs_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorisations_financement" ADD CONSTRAINT "autorisations_financement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorisations_financement" ADD CONSTRAINT "autorisations_financement_ribId_fkey" FOREIGN KEY ("ribId") REFERENCES "ribs_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions_comptes_bancaires" ADD CONSTRAINT "unions_comptes_bancaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements_unions_comptes_bancaires" ADD CONSTRAINT "elements_unions_comptes_bancaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements_unions_comptes_bancaires" ADD CONSTRAINT "elements_unions_comptes_bancaires_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "unions_comptes_bancaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements_unions_comptes_bancaires" ADD CONSTRAINT "elements_unions_comptes_bancaires_ribId_fkey" FOREIGN KEY ("ribId") REFERENCES "ribs_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

