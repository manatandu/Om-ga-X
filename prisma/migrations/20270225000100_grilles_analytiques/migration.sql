-- Ligne analytique, fonction n° 48 · la grille analytique d'un compte
-- général, plan par plan, et ses lignes (section et pourcentage). RESTRICT
-- vers le compte, le plan et la section · une structure qui la porte ne se
-- supprime pas en dénouant le lien ; CASCADE des lignes vers leur grille,
-- réécrites avec elle.

-- CreateTable
CREATE TABLE "grilles_analytiques" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grilles_analytiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_grilles_analytiques" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grilleId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "pourcentage" DECIMAL(5,2) NOT NULL,
    "rang" INTEGER NOT NULL,

    CONSTRAINT "lignes_grilles_analytiques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grilles_analytiques_tenantId_planId_idx" ON "grilles_analytiques"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "grilles_analytiques_planId_idx" ON "grilles_analytiques"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "grilles_analytiques_compteId_planId_key" ON "grilles_analytiques"("compteId", "planId");

-- CreateIndex
CREATE INDEX "lignes_grilles_analytiques_tenantId_grilleId_idx" ON "lignes_grilles_analytiques"("tenantId", "grilleId");

-- CreateIndex
CREATE INDEX "lignes_grilles_analytiques_sectionId_idx" ON "lignes_grilles_analytiques"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "lignes_grilles_analytiques_grilleId_sectionId_key" ON "lignes_grilles_analytiques"("grilleId", "sectionId");

-- AddForeignKey
ALTER TABLE "grilles_analytiques" ADD CONSTRAINT "grilles_analytiques_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grilles_analytiques" ADD CONSTRAINT "grilles_analytiques_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grilles_analytiques" ADD CONSTRAINT "grilles_analytiques_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_grilles_analytiques" ADD CONSTRAINT "lignes_grilles_analytiques_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_grilles_analytiques" ADD CONSTRAINT "lignes_grilles_analytiques_grilleId_fkey" FOREIGN KEY ("grilleId") REFERENCES "grilles_analytiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_grilles_analytiques" ADD CONSTRAINT "lignes_grilles_analytiques_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

