-- Ligne sage-l5 · fonction 88 · la ventilation analytique de la paie.
-- La répartition d'un salarié entre les sections d'un plan, à partir d'un
-- mois de paie, que la passation du mois applique aux lignes de l'écriture
-- de paie. Une version ne se modifie pas · elle se retire avec son motif, et
-- l'index unique ne compte que les versions non retirées (NULLS NOT DISTINCT,
-- PostgreSQL 15 et suivants, comme les autres index de cette forme).

-- CreateTable
CREATE TABLE "repartitions_analytiques_paie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "moisEffet" VARCHAR(7) NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retireLe" TIMESTAMP(3),
    "retirePar" TEXT,
    "motifRetrait" VARCHAR(500),

    CONSTRAINT "repartitions_analytiques_paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_repartitions_analytiques_paie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "repartitionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "pourcentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "lignes_repartitions_analytiques_paie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repartitions_analytiques_paie_tenantId_salarieId_idx" ON "repartitions_analytiques_paie"("tenantId", "salarieId");

-- CreateIndex
CREATE INDEX "repartitions_analytiques_paie_planId_idx" ON "repartitions_analytiques_paie"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "repartitions_analytiques_paie_salarieId_planId_moisEffet_re_key" ON "repartitions_analytiques_paie"("salarieId", "planId", "moisEffet", "retireLe") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "lignes_repartitions_analytiques_paie_tenantId_repartitionId_idx" ON "lignes_repartitions_analytiques_paie"("tenantId", "repartitionId");

-- CreateIndex
CREATE INDEX "lignes_repartitions_analytiques_paie_repartitionId_idx" ON "lignes_repartitions_analytiques_paie"("repartitionId");

-- CreateIndex
CREATE INDEX "lignes_repartitions_analytiques_paie_sectionId_idx" ON "lignes_repartitions_analytiques_paie"("sectionId");

-- AddForeignKey
ALTER TABLE "repartitions_analytiques_paie" ADD CONSTRAINT "repartitions_analytiques_paie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_analytiques_paie" ADD CONSTRAINT "repartitions_analytiques_paie_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_analytiques_paie" ADD CONSTRAINT "repartitions_analytiques_paie_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_repartitions_analytiques_paie" ADD CONSTRAINT "lignes_repartitions_analytiques_paie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_repartitions_analytiques_paie" ADD CONSTRAINT "lignes_repartitions_analytiques_paie_repartitionId_fkey" FOREIGN KEY ("repartitionId") REFERENCES "repartitions_analytiques_paie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_repartitions_analytiques_paie" ADD CONSTRAINT "lignes_repartitions_analytiques_paie_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Une part est strictement positive et au plus 100 · la somme à 100 se juge
-- au service, sur la version entière.
ALTER TABLE "lignes_repartitions_analytiques_paie" ADD CONSTRAINT "lignes_repartitions_analytiques_paie_pourcentage" CHECK ("pourcentage" > 0 AND "pourcentage" <= 100);
