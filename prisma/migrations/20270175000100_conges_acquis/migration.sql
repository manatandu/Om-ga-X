-- LIGNE SAGE-L5, FONCTION 79 · LES CONGÉS ACQUIS CHAQUE MOIS (décision D9 de la
-- reproduction des fonctions de Sage, Code du travail, art. 140 à 145). La
-- reprise des congés acquis avant OmegaX, déclarée avec sa source, et les
-- congés pris ou posés, dont le bulletin du départ porte l'allocation. Les
-- jours acquis ne se stockent pas · ils se lisent sur les bulletins émis
-- (`src/modules/personnel/conges-acquis.ts`).

-- CreateTable
CREATE TABLE "reprises_conges_salaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "arreteAu" DATE NOT NULL,
    "joursNesNonPris" DECIMAL(6,1) NOT NULL,
    "moisEnCoursAccomplis" INTEGER NOT NULL,
    "source" VARCHAR(300) NOT NULL,
    "declarePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reprises_conges_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conges_salaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "du" DATE NOT NULL,
    "au" DATE NOT NULL,
    "joursVoyage" INTEGER NOT NULL DEFAULT 0,
    "moisDePaie" VARCHAR(7) NOT NULL,
    "deviseAllocation" VARCHAR(3),
    "remunerationJournaliere" DECIMAL(18,2),
    "moyenneMensuelleArticle142" DECIMAL(18,2),
    "auDelaDuSolde" BOOLEAN NOT NULL DEFAULT false,
    "motifAuDelaDuSolde" VARCHAR(500),
    "bulletinId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conges_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reprises_conges_salaries_salarieId_key" ON "reprises_conges_salaries"("salarieId");

-- CreateIndex
CREATE UNIQUE INDEX "reprises_conges_salaries_tenantId_salarieId_key" ON "reprises_conges_salaries"("tenantId", "salarieId");

-- CreateIndex
CREATE INDEX "conges_salaries_tenantId_salarieId_du_idx" ON "conges_salaries"("tenantId", "salarieId", "du");

-- CreateIndex
CREATE INDEX "conges_salaries_tenantId_bulletinId_idx" ON "conges_salaries"("tenantId", "bulletinId");

-- AddForeignKey
ALTER TABLE "reprises_conges_salaries" ADD CONSTRAINT "reprises_conges_salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reprises_conges_salaries" ADD CONSTRAINT "reprises_conges_salaries_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conges_salaries" ADD CONSTRAINT "conges_salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conges_salaries" ADD CONSTRAINT "conges_salaries_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conges_salaries" ADD CONSTRAINT "conges_salaries_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "bulletins_paie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

