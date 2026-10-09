-- VIREMENTS DE FONDS (demande de Manasse du 2026-10-09). Un virement d'une
-- banque ou d'une caisse vers une autre passe par le 585 « Virements de fonds »
-- (AUDCIF Titre VII et SYCEBNL Partie 2 ch. 3, compte 58 · « comptes de
-- passage », « soldés au terme de leur utilisation ») · le 581 demandé est, au
-- SYSCOHADA, celui des « Régies d'avance », et le SYCEBNL n'en ouvre aucun.
-- Quatre sous-comptes du 585, un par sens, personnalisés par défaut.

-- CreateEnum
CREATE TYPE "SensVirementFonds" AS ENUM ('BANQUE_BANQUE', 'BANQUE_CAISSE', 'CAISSE_BANQUE', 'CAISSE_CAISSE');

-- CreateEnum
CREATE TYPE "NaturePieceVirement" AS ENUM ('BORDEREAU_VERSEMENT', 'CHEQUE', 'ORDRE_VIREMENT', 'AVIS_DEBIT_CREDIT', 'BON_CAISSE', 'AUTRE');

-- CreateTable
CREATE TABLE "comptes_virement_fonds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sens" "SensVirementFonds" NOT NULL,
    "compteId" TEXT NOT NULL,

    CONSTRAINT "comptes_virement_fonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virements_fonds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "sens" "SensVirementFonds" NOT NULL,
    "journalOrigineId" TEXT NOT NULL,
    "journalDestinationId" TEXT NOT NULL,
    "naturePiece" "NaturePieceVirement" NOT NULL,
    "referencePiece" VARCHAR(100) NOT NULL,
    "datePiece" DATE NOT NULL,
    "objet" VARCHAR(200) NOT NULL,
    "porteur" VARCHAR(120),
    "observations" VARCHAR(500),
    "ecritureOrigineId" TEXT,
    "ecritureDestinationId" TEXT,
    "piecesPassees" VARCHAR(200),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "ecritureNegatifOrigineId" TEXT,
    "ecritureNegatifDestinationId" TEXT,

    CONSTRAINT "virements_fonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_virement_fonds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "virementId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "contenu" BYTEA NOT NULL,
    "deposePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_virement_fonds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comptes_virement_fonds_compteId_key" ON "comptes_virement_fonds"("compteId");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_virement_fonds_tenantId_sens_key" ON "comptes_virement_fonds"("tenantId", "sens");

-- CreateIndex
CREATE UNIQUE INDEX "virements_fonds_ecritureOrigineId_key" ON "virements_fonds"("ecritureOrigineId");

-- CreateIndex
CREATE UNIQUE INDEX "virements_fonds_ecritureDestinationId_key" ON "virements_fonds"("ecritureDestinationId");

-- CreateIndex
CREATE UNIQUE INDEX "virements_fonds_ecritureNegatifOrigineId_key" ON "virements_fonds"("ecritureNegatifOrigineId");

-- CreateIndex
CREATE UNIQUE INDEX "virements_fonds_ecritureNegatifDestinationId_key" ON "virements_fonds"("ecritureNegatifDestinationId");

-- CreateIndex
CREATE INDEX "virements_fonds_tenantId_exerciceId_date_idx" ON "virements_fonds"("tenantId", "exerciceId", "date");

-- CreateIndex
CREATE INDEX "pieces_virement_fonds_tenantId_virementId_idx" ON "pieces_virement_fonds"("tenantId", "virementId");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_virement_fonds_virementId_empreinte_key" ON "pieces_virement_fonds"("virementId", "empreinte");

-- AddForeignKey
ALTER TABLE "comptes_virement_fonds" ADD CONSTRAINT "comptes_virement_fonds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_virement_fonds" ADD CONSTRAINT "comptes_virement_fonds_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_journalOrigineId_fkey" FOREIGN KEY ("journalOrigineId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_journalDestinationId_fkey" FOREIGN KEY ("journalDestinationId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_ecritureOrigineId_fkey" FOREIGN KEY ("ecritureOrigineId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_ecritureDestinationId_fkey" FOREIGN KEY ("ecritureDestinationId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_ecritureNegatifOrigineId_fkey" FOREIGN KEY ("ecritureNegatifOrigineId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virements_fonds" ADD CONSTRAINT "virements_fonds_ecritureNegatifDestinationId_fkey" FOREIGN KEY ("ecritureNegatifDestinationId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_virement_fonds" ADD CONSTRAINT "pieces_virement_fonds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_virement_fonds" ADD CONSTRAINT "pieces_virement_fonds_virementId_fkey" FOREIGN KEY ("virementId") REFERENCES "virements_fonds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- LES QUATRE COMPTES DE PASSAGE DES DOSSIERS EXISTANTS · sous le 58500000 que
-- les deux plans sèment, aux numéros 58500001 à 58500004 quand ils sont libres,
-- avec le lettrage et le report du 58500000 (un sous-compte fonctionne comme son
-- compte du plan). Un numéro déjà pris par le cabinet n'est jamais touché · le
-- compte de ce sens s'ouvre au premier virement, au premier numéro libre
-- (VirementsFondsService). Un dossier sans 58500000 n'en reçoit aucun ici.
WITH sens(sens, rang, intitule) AS (VALUES
  ('BANQUE_BANQUE', 1, 'Virements de fonds · banque vers banque'),
  ('BANQUE_CAISSE', 2, 'Virements de fonds · banque vers caisse'),
  ('CAISSE_BANQUE', 3, 'Virements de fonds · caisse vers banque'),
  ('CAISSE_CAISSE', 4, 'Virements de fonds · caisse vers caisse')
),
cibles AS MATERIALIZED (
  SELECT gen_random_uuid()::text AS id, p."tenantId", s.sens, s.intitule, '5850000' || s.rang AS numero,
         p.lettrable, p."modeReportANouveau"
  FROM comptes p
  CROSS JOIN sens s
  WHERE p.numero = '58500000'
    AND NOT EXISTS (SELECT 1 FROM comptes c WHERE c."tenantId" = p."tenantId" AND c.numero = '5850000' || s.rang)
),
inseres AS (
  INSERT INTO comptes (id, "tenantId", numero, intitule, classe, "typeCompte", "estRetenu", lettrable, "modeReportANouveau")
  SELECT id, "tenantId", numero, intitule, 'CLASSE_5'::"ClasseCompte", 'DETAIL'::"TypeCompteDetailTotal", true, lettrable, "modeReportANouveau"
  FROM cibles
  RETURNING id
)
INSERT INTO comptes_virement_fonds (id, "tenantId", sens, "compteId")
SELECT gen_random_uuid()::text, c."tenantId", c.sens::"SensVirementFonds", c.id
FROM cibles c
JOIN inseres i ON i.id = c.id;
