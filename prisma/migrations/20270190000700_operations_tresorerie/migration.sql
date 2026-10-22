-- Ligne sage-l3, fonction 47 · financements et placements de trésorerie
-- (décision D16). Taux de référence et leurs cours déclarés avec leur
-- source, opérations au 561 ou au 525 / 2784, un acte par pièce, chaque
-- pièce et son négatif retenus (RESTRICT), comme les actes des effets.

-- CreateEnum
CREATE TYPE "TypeOperationTresorerie" AS ENUM ('FINANCEMENT', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "ModeInteretsTresorerie" AS ENUM ('POST_COMPTES', 'PRECOMPTES');

-- CreateEnum
CREATE TYPE "StatutOperationTresorerie" AS ENUM ('EN_COURS', 'ECHUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "NatureActeTresorerie" AS ENUM ('MISE_EN_PLACE', 'REGULARISATION', 'CONTRE_PASSATION', 'ECHEANCE');

-- CreateTable
CREATE TABLE "taux_reference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "intitule" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taux_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours_taux_reference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tauxReferenceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "valeur" DECIMAL(9,6) NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cours_taux_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_tresorerie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "TypeOperationTresorerie" NOT NULL,
    "reference" VARCHAR(60) NOT NULL,
    "journalBanqueId" TEXT NOT NULL,
    "journalOdId" TEXT NOT NULL,
    "comptePrincipalId" TEXT NOT NULL,
    "compteInteretsId" TEXT NOT NULL,
    "compteCourusId" TEXT,
    "compteFraisId" TEXT,
    "dateMiseEnPlace" DATE NOT NULL,
    "dateEcheance" DATE NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "tauxFixe" DECIMAL(9,6),
    "tauxReferenceId" TEXT,
    "marge" DECIMAL(9,6),
    "coursRetenuId" TEXT,
    "tauxApplique" DECIMAL(9,6) NOT NULL,
    "baseCalcul" INTEGER NOT NULL,
    "modeInterets" "ModeInteretsTresorerie" NOT NULL,
    "frais" DECIMAL(18,2),
    "deblocableAToutMoment" BOOLEAN,
    "referenceConvention" VARCHAR(100) NOT NULL,
    "dateConvention" DATE NOT NULL,
    "statut" "StatutOperationTresorerie" NOT NULL DEFAULT 'EN_COURS',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_tresorerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actes_operation_tresorerie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "nature" "NatureActeTresorerie" NOT NULL,
    "date" DATE NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "montantInterets" DECIMAL(18,2) NOT NULL,
    "interetsProposes" DECIMAL(18,2),
    "regularisationId" TEXT,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actes_operation_tresorerie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "taux_reference_tenantId_code_key" ON "taux_reference"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cours_taux_reference_tenantId_tauxReferenceId_idx" ON "cours_taux_reference"("tenantId", "tauxReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "cours_taux_reference_tauxReferenceId_date_key" ON "cours_taux_reference"("tauxReferenceId", "date");

-- CreateIndex
CREATE INDEX "operations_tresorerie_tenantId_statut_idx" ON "operations_tresorerie"("tenantId", "statut");

-- CreateIndex
CREATE INDEX "operations_tresorerie_tenantId_dateEcheance_idx" ON "operations_tresorerie"("tenantId", "dateEcheance");

-- CreateIndex
CREATE UNIQUE INDEX "actes_operation_tresorerie_ecritureId_key" ON "actes_operation_tresorerie"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "actes_operation_tresorerie_ecritureNegatifId_key" ON "actes_operation_tresorerie"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "actes_operation_tresorerie_tenantId_operationId_idx" ON "actes_operation_tresorerie"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "actes_operation_tresorerie_tenantId_exerciceId_idx" ON "actes_operation_tresorerie"("tenantId", "exerciceId");

-- AddForeignKey
ALTER TABLE "taux_reference" ADD CONSTRAINT "taux_reference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours_taux_reference" ADD CONSTRAINT "cours_taux_reference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours_taux_reference" ADD CONSTRAINT "cours_taux_reference_tauxReferenceId_fkey" FOREIGN KEY ("tauxReferenceId") REFERENCES "taux_reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_journalBanqueId_fkey" FOREIGN KEY ("journalBanqueId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_journalOdId_fkey" FOREIGN KEY ("journalOdId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_comptePrincipalId_fkey" FOREIGN KEY ("comptePrincipalId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_compteInteretsId_fkey" FOREIGN KEY ("compteInteretsId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_compteCourusId_fkey" FOREIGN KEY ("compteCourusId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_compteFraisId_fkey" FOREIGN KEY ("compteFraisId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_tauxReferenceId_fkey" FOREIGN KEY ("tauxReferenceId") REFERENCES "taux_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations_tresorerie" ADD CONSTRAINT "operations_tresorerie_coursRetenuId_fkey" FOREIGN KEY ("coursRetenuId") REFERENCES "cours_taux_reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations_tresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_regularisationId_fkey" FOREIGN KEY ("regularisationId") REFERENCES "actes_operation_tresorerie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_operation_tresorerie" ADD CONSTRAINT "actes_operation_tresorerie_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

