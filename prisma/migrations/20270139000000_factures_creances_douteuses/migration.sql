-- Ligne A7 bis, partie 1 · les factures qu'une créance douteuse reprend, désignées
-- par le cabinet, pour que le recouvrement du module soit lu comme l'encaissement
-- de ces factures (O.-L. n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57).
CREATE TABLE "factures_creances_douteuses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creanceId" TEXT NOT NULL,
    "ligneEcritureId" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "factures_creances_douteuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "factures_creances_douteuses_tenantId_idx" ON "factures_creances_douteuses"("tenantId");
CREATE INDEX "factures_creances_douteuses_ligneEcritureId_idx" ON "factures_creances_douteuses"("ligneEcritureId");
CREATE UNIQUE INDEX "factures_creances_douteuses_creanceId_ligneEcritureId_key" ON "factures_creances_douteuses"("creanceId", "ligneEcritureId");

ALTER TABLE "factures_creances_douteuses" ADD CONSTRAINT "factures_creances_douteuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "factures_creances_douteuses" ADD CONSTRAINT "factures_creances_douteuses_creanceId_fkey" FOREIGN KEY ("creanceId") REFERENCES "creances_douteuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "factures_creances_douteuses" ADD CONSTRAINT "factures_creances_douteuses_ligneEcritureId_fkey" FOREIGN KEY ("ligneEcritureId") REFERENCES "lignes_ecriture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
