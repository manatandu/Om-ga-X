-- Ligne gl-saisie, fonction 33 · exclure UNE ligne de la relance, décaler
-- son échéance.
--
-- La décision vit à côté de la ligne validée, jamais en elle (AUDCIF
-- art. 22, 2°) · seule la relance la lit (relances/decision-relance-ligne.ts).

-- CreateTable
CREATE TABLE "decisions_relance_lignes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ligneEcritureId" TEXT NOT NULL,
    "exclue" BOOLEAN NOT NULL DEFAULT false,
    "motifExclusion" TEXT,
    "exclueLe" TIMESTAMP(3),
    "exclueePar" TEXT,
    "echeanceAccordee" TIMESTAMP(3),
    "motifEcheance" TEXT,
    "accordeeLe" TIMESTAMP(3),
    "accordeePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_relance_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decisions_relance_lignes_ligneEcritureId_key" ON "decisions_relance_lignes"("ligneEcritureId");

-- CreateIndex
CREATE INDEX "decisions_relance_lignes_tenantId_idx" ON "decisions_relance_lignes"("tenantId");

-- AddForeignKey
ALTER TABLE "decisions_relance_lignes" ADD CONSTRAINT "decisions_relance_lignes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions_relance_lignes" ADD CONSTRAINT "decisions_relance_lignes_ligneEcritureId_fkey" FOREIGN KEY ("ligneEcritureId") REFERENCES "lignes_ecriture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
