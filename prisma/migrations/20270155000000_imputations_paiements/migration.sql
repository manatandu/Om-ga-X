-- Décision par la loi du 2026-10-07, point 4 · l'imputation DÉCLARÉE d'un
-- paiement (Code civil, Livre III, art. 151 et 153), qui prime sur l'imputation
-- légale de l'art. 154 dans le moteur de la TVA à l'encaissement (O.-L.
-- n° 10/001, art. 25, 2° ; décret n° 011/42, art. 57).
CREATE TYPE "FondementImputationPaiement" AS ENUM ('DECLARATION_DU_DEBITEUR', 'QUITTANCE_ACCEPTEE');

CREATE TABLE "imputations_paiements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ligneReglementId" TEXT NOT NULL,
    "ligneFactureId" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "fondement" "FondementImputationPaiement" NOT NULL,
    "pieceReference" TEXT NOT NULL,
    "pieceDate" DATE,
    "retireeLe" TIMESTAMP(3),
    "retireePar" TEXT,
    "motifRetrait" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "imputations_paiements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "imputations_paiements_tenantId_idx" ON "imputations_paiements"("tenantId");
CREATE INDEX "imputations_paiements_ligneReglementId_idx" ON "imputations_paiements"("ligneReglementId");
CREATE INDEX "imputations_paiements_ligneFactureId_idx" ON "imputations_paiements"("ligneFactureId");

ALTER TABLE "imputations_paiements" ADD CONSTRAINT "imputations_paiements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "imputations_paiements" ADD CONSTRAINT "imputations_paiements_ligneReglementId_fkey" FOREIGN KEY ("ligneReglementId") REFERENCES "lignes_ecriture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "imputations_paiements" ADD CONSTRAINT "imputations_paiements_ligneFactureId_fkey" FOREIGN KEY ("ligneFactureId") REFERENCES "lignes_ecriture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
