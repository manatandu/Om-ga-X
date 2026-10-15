-- LIGNE SAGE-L5, FONCTION 78, ÉTAPE 1 · les absences du salarié (Code du
-- travail, art. 57, 93, 105, 106, 130 et 146). Une absence s'annule avec son
-- motif, jamais supprimée ; les jours se comptent par `personnel/absences.ts`.

-- CreateEnum
CREATE TYPE "NatureAbsenceSalarie" AS ENUM ('MALADIE_OU_ACCIDENT', 'ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE', 'MATERNITE', 'CONGE_DE_CIRCONSTANCE', 'EMPECHEMENT_DU_FAIT_DE_L_EMPLOYEUR', 'ABSENCE_NON_AUTORISEE', 'MISE_A_PIED', 'OBLIGATIONS_MILITAIRES', 'REQUISITION', 'MANDAT_PUBLIC', 'GREVE_OU_LOCK_OUT', 'INCARCERATION', 'FORCE_MAJEURE');

-- CreateTable
CREATE TABLE "absences_salaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "nature" "NatureAbsenceSalarie" NOT NULL,
    "du" DATE NOT NULL,
    "au" DATE NOT NULL,
    "demiJourneeDebut" BOOLEAN NOT NULL DEFAULT false,
    "demiJourneeFin" BOOLEAN NOT NULL DEFAULT false,
    "evenement" VARCHAR(60),
    "piece" VARCHAR(300),
    "observation" VARCHAR(500),
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absences_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absences_salaries_tenantId_salarieId_du_idx" ON "absences_salaries"("tenantId", "salarieId", "du");

-- AddForeignKey
ALTER TABLE "absences_salaries" ADD CONSTRAINT "absences_salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences_salaries" ADD CONSTRAINT "absences_salaries_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

