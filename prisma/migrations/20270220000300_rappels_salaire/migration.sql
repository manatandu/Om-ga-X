-- Ligne paie-suite, fonction 87 · le rappel de salaires · arriérés d'une hausse de
-- la base à effet passé, calculés sur les bulletins émis et figés, portés par le
-- bulletin du mois où ils sont payés (personnel/rappel-salaire.ts).
CREATE TABLE "rappels_salaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "moisDebut" VARCHAR(7) NOT NULL,
    "moisFin" VARCHAR(7) NOT NULL,
    "nouvelleBase" DECIMAL(18,2) NOT NULL,
    "periodicite" VARCHAR(10) NOT NULL,
    "deviseBase" VARCHAR(3) NOT NULL,
    "motif" VARCHAR(200) NOT NULL,
    "pieceJustificative" VARCHAR(300) NOT NULL,
    "lignes" JSONB NOT NULL,
    "exclus" JSONB NOT NULL,
    "totalFc" DECIMAL(18,2) NOT NULL,
    "bulletinId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rappels_salaire_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rappels_salaire_tenantId_salarieId_idx" ON "rappels_salaire"("tenantId", "salarieId");

CREATE INDEX "rappels_salaire_bulletinId_idx" ON "rappels_salaire"("bulletinId");

ALTER TABLE "rappels_salaire" ADD CONSTRAINT "rappels_salaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappels_salaire" ADD CONSTRAINT "rappels_salaire_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappels_salaire" ADD CONSTRAINT "rappels_salaire_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "bulletins_paie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

