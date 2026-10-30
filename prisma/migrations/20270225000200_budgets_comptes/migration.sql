-- Ligne analytique, fonction n° 51 · le budget d'un compte général sur un
-- exercice, annuel (mois nul) et mensuel. RESTRICT vers le compte et
-- l'exercice · un budget ne se perd pas en dénouant le lien.

-- CreateTable
CREATE TABLE "budgets_compte" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "mois" INTEGER,
    "montant" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "budgets_compte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_compte_tenantId_exerciceId_idx" ON "budgets_compte"("tenantId", "exerciceId");

-- CreateIndex
CREATE INDEX "budgets_compte_exerciceId_idx" ON "budgets_compte"("exerciceId");

-- CreateIndex
-- Deux NULL sont égaux · un seul annuel par compte et par exercice (comme
-- `budgets_section`, migration 20261123000000).
CREATE UNIQUE INDEX "budgets_compte_compteId_exerciceId_mois_key" ON "budgets_compte"("compteId", "exerciceId", "mois") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "budgets_compte" ADD CONSTRAINT "budgets_compte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets_compte" ADD CONSTRAINT "budgets_compte_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets_compte" ADD CONSTRAINT "budgets_compte_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

