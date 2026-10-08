-- Ligne AU3 · la devise d'une ligne d'à-nouveau importée sans elle,
-- DÉCLARÉE par le cabinet (AUDCIF art. 52, 54 ; art. 20, al. 2). Une
-- déclaration par ligne d'origine ; la pièce de correction d'une ligne
-- validée est RETENUE (RESTRICT).
CREATE TABLE "declarations_devise_a_nouveau" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "ecritureOrigineId" TEXT NOT NULL,
    "ligneOrigineId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "montantLigne" DECIMAL(18,2) NOT NULL,
    "parts" JSONB NOT NULL,
    "resteEnFrancs" DECIMAL(18,2) NOT NULL,
    "source" TEXT NOT NULL,
    "ecritureCorrectionId" TEXT,
    "lignesResultantes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "declarations_devise_a_nouveau_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "declarations_devise_a_nouveau_ligneOrigineId_key" ON "declarations_devise_a_nouveau"("ligneOrigineId");
CREATE UNIQUE INDEX "declarations_devise_a_nouveau_ecritureCorrectionId_key" ON "declarations_devise_a_nouveau"("ecritureCorrectionId");
CREATE INDEX "declarations_devise_a_nouveau_tenantId_exerciceId_idx" ON "declarations_devise_a_nouveau"("tenantId", "exerciceId");

ALTER TABLE "declarations_devise_a_nouveau" ADD CONSTRAINT "declarations_devise_a_nouveau_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "declarations_devise_a_nouveau" ADD CONSTRAINT "declarations_devise_a_nouveau_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "declarations_devise_a_nouveau" ADD CONSTRAINT "declarations_devise_a_nouveau_ecritureCorrectionId_fkey" FOREIGN KEY ("ecritureCorrectionId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
