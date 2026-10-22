-- Ligne sage-l3, fonction 39 · les effets de commerce (AUDCIF Titre VII,
-- fiches des comptes 40, 41, 51, 56 et 67) et l'échéance de l'effet lue par
-- le moteur de la TVA comme date du règlement (décret n° 011/42, art. 57 et 96).

CREATE TYPE "SensEffet" AS ENUM ('A_RECEVOIR', 'A_PAYER');
CREATE TYPE "StatutEffet" AS ENUM ('EN_PORTEFEUILLE', 'REMIS_A_L_ENCAISSEMENT', 'ESCOMPTE', 'ENCAISSE', 'IMPAYE', 'BON_A_PAYER', 'PAYE', 'ANNULE');
CREATE TYPE "NatureActeEffet" AS ENUM ('ACCEPTATION', 'REMISE_ENCAISSEMENT', 'REMISE_ESCOMPTE', 'DECOMPTE_ESCOMPTE', 'ENCAISSEMENT', 'DENOUEMENT_ESCOMPTE', 'IMPAYE', 'BON_A_PAYER', 'PAIEMENT');

ALTER TABLE "ecritures" ADD COLUMN "dateEncaissementEffet" DATE;

CREATE TABLE "effets_de_commerce" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "exerciceId" TEXT NOT NULL,
  "sens" "SensEffet" NOT NULL,
  "journalId" TEXT NOT NULL,
  "compteTiersId" TEXT NOT NULL,
  "compteEffetId" TEXT NOT NULL,
  "montant" DECIMAL(18,2) NOT NULL,
  "reference" VARCHAR(60) NOT NULL,
  "tire" VARCHAR(120),
  "dateCreation" DATE NOT NULL,
  "dateEcheance" DATE NOT NULL,
  "statut" "StatutEffet" NOT NULL DEFAULT 'EN_PORTEFEUILLE',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "effets_de_commerce_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "effets_de_commerce_tenantId_exerciceId_sens_statut_idx" ON "effets_de_commerce"("tenantId", "exerciceId", "sens", "statut");
CREATE INDEX "effets_de_commerce_tenantId_compteTiersId_idx" ON "effets_de_commerce"("tenantId", "compteTiersId");

ALTER TABLE "effets_de_commerce" ADD CONSTRAINT "effets_de_commerce_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "effets_de_commerce" ADD CONSTRAINT "effets_de_commerce_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "effets_de_commerce" ADD CONSTRAINT "effets_de_commerce_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "effets_de_commerce" ADD CONSTRAINT "effets_de_commerce_compteTiersId_fkey" FOREIGN KEY ("compteTiersId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "effets_de_commerce" ADD CONSTRAINT "effets_de_commerce_compteEffetId_fkey" FOREIGN KEY ("compteEffetId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "actes_effet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "effetId" TEXT NOT NULL,
  "nature" "NatureActeEffet" NOT NULL,
  "date" DATE NOT NULL,
  "compteId" TEXT,
  "montant" DECIMAL(18,2) NOT NULL,
  "detail" JSONB,
  "ecritureId" TEXT,
  "ecritureNegatifId" TEXT,
  "annuleLe" TIMESTAMP(3),
  "annulePar" TEXT,
  "motifAnnulation" VARCHAR(500),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "actes_effet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "actes_effet_ecritureId_key" ON "actes_effet"("ecritureId");
CREATE UNIQUE INDEX "actes_effet_ecritureNegatifId_key" ON "actes_effet"("ecritureNegatifId");
CREATE INDEX "actes_effet_tenantId_effetId_idx" ON "actes_effet"("tenantId", "effetId");

ALTER TABLE "actes_effet" ADD CONSTRAINT "actes_effet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_effet" ADD CONSTRAINT "actes_effet_effetId_fkey" FOREIGN KEY ("effetId") REFERENCES "effets_de_commerce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_effet" ADD CONSTRAINT "actes_effet_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_effet" ADD CONSTRAINT "actes_effet_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "actes_effet" ADD CONSTRAINT "actes_effet_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
