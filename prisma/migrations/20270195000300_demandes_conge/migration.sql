-- Ligne microfina-m3, idée 7 · la demande de congé et son accord (Code du
-- travail, art. 140, al. 4).
CREATE TYPE "StatutDemandeConge" AS ENUM ('DEMANDEE', 'ACCORDEE', 'REFUSEE', 'RETIREE');

CREATE TABLE "demandes_conge_salarie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "du" DATE NOT NULL,
    "au" DATE NOT NULL,
    "joursVoyage" INTEGER NOT NULL DEFAULT 0,
    "moisDePaie" VARCHAR(7) NOT NULL,
    "demandeLe" DATE NOT NULL,
    "observation" VARCHAR(500),
    "statut" "StatutDemandeConge" NOT NULL DEFAULT 'DEMANDEE',
    "saisiePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionPar" TEXT,
    "decisionLe" TIMESTAMP(3),
    "motifDecision" VARCHAR(500),
    "congeId" TEXT,
    CONSTRAINT "demandes_conge_salarie_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demandes_conge_salarie_congeId_key" ON "demandes_conge_salarie"("congeId");
CREATE INDEX "demandes_conge_salarie_tenantId_salarieId_idx" ON "demandes_conge_salarie"("tenantId", "salarieId");
CREATE INDEX "demandes_conge_salarie_tenantId_statut_idx" ON "demandes_conge_salarie"("tenantId", "statut");
ALTER TABLE "demandes_conge_salarie" ADD CONSTRAINT "demandes_conge_salarie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demandes_conge_salarie" ADD CONSTRAINT "demandes_conge_salarie_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "demandes_conge_salarie" ADD CONSTRAINT "demandes_conge_salarie_congeId_fkey" FOREIGN KEY ("congeId") REFERENCES "conges_salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
