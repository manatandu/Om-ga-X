-- Ligne A7 bis, partie 2 · la récupération de la TVA d'une créance
-- réellement et définitivement irrécouvrable (O.-L. n° 10/001, art. 52 ;
-- décret n° 011/42, art. 126 et 127). Une ligne par geste, son écriture
-- RETENUE (RESTRICT), annulée par marque, jamais supprimée.
CREATE TABLE "recuperations_tva_creances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creanceId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "montantTva" DECIMAL(18,2) NOT NULL,
    "montantHt" DECIMAL(18,2) NOT NULL,
    "detail" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "pieces" JSONB NOT NULL,
    "ecritureId" TEXT,
    "annuleeLe" TIMESTAMP(3),
    "annuleePar" TEXT,
    "motifAnnulation" TEXT,
    "annulation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "recuperations_tva_creances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recuperations_tva_creances_ecritureId_key" ON "recuperations_tva_creances"("ecritureId");
CREATE INDEX "recuperations_tva_creances_tenantId_idx" ON "recuperations_tva_creances"("tenantId");
CREATE INDEX "recuperations_tva_creances_creanceId_idx" ON "recuperations_tva_creances"("creanceId");
CREATE INDEX "recuperations_tva_creances_exerciceId_idx" ON "recuperations_tva_creances"("exerciceId");

ALTER TABLE "recuperations_tva_creances" ADD CONSTRAINT "recuperations_tva_creances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recuperations_tva_creances" ADD CONSTRAINT "recuperations_tva_creances_creanceId_fkey" FOREIGN KEY ("creanceId") REFERENCES "creances_douteuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recuperations_tva_creances" ADD CONSTRAINT "recuperations_tva_creances_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recuperations_tva_creances" ADD CONSTRAINT "recuperations_tva_creances_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
