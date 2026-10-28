-- Ligne microfina-m3, idée 8 · le plan et le suivi de la formation (Code du
-- travail, art. 8).
CREATE TYPE "StatutFormation" AS ENUM ('PREVUE', 'REALISEE', 'ANNULEE');

CREATE TABLE "formations_personnel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "organisme" TEXT,
    "interne" BOOLEAN NOT NULL DEFAULT false,
    "lieu" TEXT,
    "financement" TEXT,
    "prevueDu" DATE NOT NULL,
    "prevueAu" DATE NOT NULL,
    "coutPrevuFc" DECIMAL(18,2),
    "statut" "StatutFormation" NOT NULL DEFAULT 'PREVUE',
    "realiseeDu" DATE,
    "realiseeAu" DATE,
    "coutReelFc" DECIMAL(18,2),
    "motifAnnulation" VARCHAR(500),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "formations_personnel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "formations_personnel_tenantId_prevueDu_idx" ON "formations_personnel"("tenantId", "prevueDu");
ALTER TABLE "formations_personnel" ADD CONSTRAINT "formations_personnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "participants_formation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "present" BOOLEAN,
    CONSTRAINT "participants_formation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "participants_formation_formationId_salarieId_key" ON "participants_formation"("formationId", "salarieId");
CREATE INDEX "participants_formation_tenantId_salarieId_idx" ON "participants_formation"("tenantId", "salarieId");
ALTER TABLE "participants_formation" ADD CONSTRAINT "participants_formation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "participants_formation" ADD CONSTRAINT "participants_formation_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "formations_personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "participants_formation" ADD CONSTRAINT "participants_formation_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
