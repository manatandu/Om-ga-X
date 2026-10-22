-- Ligne sage-l3, fonction 47 · titres de placement et OPCVM (décision D16).
-- Un titre au 50 (hors 506 et 5021), ses mouvements (acquisition, cession
-- au coût P.E.P.S.) et sa revue de clôture (dépréciation au 590), chaque
-- pièce et son négatif retenus (RESTRICT), comme les opérations de
-- trésorerie.

-- CreateEnum
CREATE TYPE "NatureMouvementTitre" AS ENUM ('ACQUISITION', 'CESSION');

-- CreateEnum
CREATE TYPE "NatureValeurTitre" AS ENUM ('COURS_MOYEN_DERNIER_MOIS', 'VALEUR_PROBABLE_NEGOCIATION');

-- CreateTable
CREATE TABLE "titres_placement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "intitule" VARCHAR(100) NOT NULL,
    "compteTitreId" TEXT NOT NULL,
    "compteFraisId" TEXT,
    "cote" BOOLEAN NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "titres_placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_titre" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titreId" TEXT NOT NULL,
    "nature" "NatureMouvementTitre" NOT NULL,
    "date" DATE NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "quantite" DECIMAL(18,6) NOT NULL,
    "prix" DECIMAL(18,2) NOT NULL,
    "frais" DECIMAL(18,2) NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "coutPrixSorti" DECIMAL(18,2),
    "coutFraisSorti" DECIMAL(18,2),
    "resultat" DECIMAL(18,2),
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_titre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_titre" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titreId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "valeurUnitaire" DECIMAL(18,6) NOT NULL,
    "nature" "NatureValeurTitre" NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "quantite" DECIMAL(18,6) NOT NULL,
    "cout" DECIMAL(18,2) NOT NULL,
    "depreciationNecessaire" DECIMAL(18,2) NOT NULL,
    "depreciationEnPlace" DECIMAL(18,2) NOT NULL,
    "journalId" TEXT NOT NULL,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_titre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "titres_placement_tenantId_code_key" ON "titres_placement"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_titre_ecritureId_key" ON "mouvements_titre"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_titre_ecritureNegatifId_key" ON "mouvements_titre"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "mouvements_titre_tenantId_titreId_idx" ON "mouvements_titre"("tenantId", "titreId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_titre_ecritureId_key" ON "evaluations_titre"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_titre_ecritureNegatifId_key" ON "evaluations_titre"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "evaluations_titre_tenantId_titreId_idx" ON "evaluations_titre"("tenantId", "titreId");

-- CreateIndex
-- Une revue non annulée par titre et par exercice · NULLS NOT DISTINCT, sans
-- quoi deux revues vivantes (annuleLe nul) passaient l'une à côté de
-- l'autre ; les revues annulées, datées, s'y ajoutent sans la rompre.
CREATE UNIQUE INDEX "evaluations_titre_titreId_exerciceId_annuleLe_key"
  ON "evaluations_titre"("titreId", "exerciceId", "annuleLe") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "titres_placement" ADD CONSTRAINT "titres_placement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titres_placement" ADD CONSTRAINT "titres_placement_compteTitreId_fkey" FOREIGN KEY ("compteTitreId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titres_placement" ADD CONSTRAINT "titres_placement_compteFraisId_fkey" FOREIGN KEY ("compteFraisId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_titreId_fkey" FOREIGN KEY ("titreId") REFERENCES "titres_placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_titre" ADD CONSTRAINT "mouvements_titre_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_titreId_fkey" FOREIGN KEY ("titreId") REFERENCES "titres_placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_titre" ADD CONSTRAINT "evaluations_titre_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

