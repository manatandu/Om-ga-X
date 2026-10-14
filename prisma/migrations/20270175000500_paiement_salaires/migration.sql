-- LIGNE SAGE-L5, FONCTION 75 · BANQUES DU SALARIÉ ET PAIEMENT DES SALAIRES.
--
-- Le mode de paiement CONVENU du salarié (Code du travail, art. 98, al. 2),
-- ses coordonnées bancaires (une structure, comme les RIB des tiers), le
-- paiement des salaires d'un mois (D 422 / C trésorerie, fiche du compte 42
-- des deux plans) et ses lignes. Une ligne d'ordre de virement paie désormais
-- un tiers OU un salarié · le module des ordres de virement reste le seul.

-- CreateEnum
CREATE TYPE "ModePaiementSalaire" AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES');

-- AlterTable
ALTER TABLE "lignes_ordre_virement" ADD COLUMN     "salarieId" TEXT,
ALTER COLUMN "tiersId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "salaries" ADD COLUMN     "modePaiement" "ModePaiementSalaire";

-- CreateTable
CREATE TABLE "ribs_salaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "banque" VARCHAR(120) NOT NULL,
    "titulaire" VARCHAR(120),
    "codeBanque" VARCHAR(20),
    "codeGuichet" VARCHAR(20),
    "numeroCompte" VARCHAR(34),
    "cle" VARCHAR(4),
    "iban" VARCHAR(42),
    "codeBic" VARCHAR(11),
    "devise" VARCHAR(3),
    "estPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "commentaire" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ribs_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_salaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moisDePaie" VARCHAR(7) NOT NULL,
    "mode" "ModePaiementSalaire" NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "piecePassee" VARCHAR(60) NOT NULL,
    "ordreVirementId" TEXT,
    "billetage" JSONB,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),

    CONSTRAINT "paiements_salaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_paiement_salaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paiementId" TEXT NOT NULL,
    "bulletinId" TEXT NOT NULL,
    "salarieId" TEXT NOT NULL,
    "nomComplet" VARCHAR(200) NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "reference" VARCHAR(60),
    "annuleLe" TIMESTAMP(3),

    CONSTRAINT "lignes_paiement_salaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ribs_salaries_tenantId_salarieId_idx" ON "ribs_salaries"("tenantId", "salarieId");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_salaires_ecritureId_key" ON "paiements_salaires"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_salaires_ecritureNegatifId_key" ON "paiements_salaires"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "paiements_salaires_tenantId_moisDePaie_idx" ON "paiements_salaires"("tenantId", "moisDePaie");

-- CreateIndex
CREATE INDEX "lignes_paiement_salaires_tenantId_salarieId_idx" ON "lignes_paiement_salaires"("tenantId", "salarieId");

-- CreateIndex
CREATE INDEX "lignes_paiement_salaires_paiementId_idx" ON "lignes_paiement_salaires"("paiementId");

-- CreateIndex
-- Un bulletin n'est payé qu'une fois · deux NULL tenus pour ÉGAUX, les
-- lignes d'un paiement annulé, datées, s'y ajoutent sans le rompre (comme le
-- constat de l'impôt et la réévaluation des devises).
CREATE UNIQUE INDEX "lignes_paiement_salaires_bulletinId_annuleLe_key"
  ON "lignes_paiement_salaires"("bulletinId", "annuleLe") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "lignes_ordre_virement_tenantId_salarieId_idx" ON "lignes_ordre_virement"("tenantId", "salarieId");

-- AddForeignKey
ALTER TABLE "lignes_ordre_virement" ADD CONSTRAINT "lignes_ordre_virement_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ribs_salaries" ADD CONSTRAINT "ribs_salaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ribs_salaries" ADD CONSTRAINT "ribs_salaries_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_ordreVirementId_fkey" FOREIGN KEY ("ordreVirementId") REFERENCES "ordres_virement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_paiement_salaires" ADD CONSTRAINT "lignes_paiement_salaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_paiement_salaires" ADD CONSTRAINT "lignes_paiement_salaires_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "paiements_salaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_paiement_salaires" ADD CONSTRAINT "lignes_paiement_salaires_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "bulletins_paie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_paiement_salaires" ADD CONSTRAINT "lignes_paiement_salaires_salarieId_fkey" FOREIGN KEY ("salarieId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une ligne d'ordre paie un tiers OU un salarié, jamais les deux ni aucun ·
-- sans bénéficiaire, l'ordre dirait payer quelqu'un que rien ne nomme.
ALTER TABLE "lignes_ordre_virement" ADD CONSTRAINT "lignes_ordre_virement_un_beneficiaire"
  CHECK (num_nonnulls("tiersId", "salarieId") = 1);
