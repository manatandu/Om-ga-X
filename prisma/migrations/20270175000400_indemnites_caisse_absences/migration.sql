-- LIGNE SAGE-L5, FONCTION 78, ÉTAPE 3 · les indemnités journalières de la
-- Caisse déclarées sur un arrêt (accident du travail, maternité) · déduites
-- (Code du travail, art. 106, al. 2) ou reçues par subrogation, totale ou
-- dans la limite de la partie versée (arrêté n° 146/2018, art. 139 et 146).
-- Déclarées avec leur pièce, jamais calculées.

-- CreateEnum
CREATE TYPE "TraitementIndemniteCaisse" AS ENUM ('DEDUITE', 'SUBROGATION', 'SUBROGATION_PARTIELLE');

-- CreateTable
CREATE TABLE "indemnites_caisse_absences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "mois" VARCHAR(7) NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "traitement" "TraitementIndemniteCaisse" NOT NULL,
    "piece" VARCHAR(300) NOT NULL,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indemnites_caisse_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indemnites_caisse_absences_tenantId_absenceId_mois_idx" ON "indemnites_caisse_absences"("tenantId", "absenceId", "mois");

-- AddForeignKey
ALTER TABLE "indemnites_caisse_absences" ADD CONSTRAINT "indemnites_caisse_absences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indemnites_caisse_absences" ADD CONSTRAINT "indemnites_caisse_absences_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "absences_salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

