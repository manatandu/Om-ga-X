-- LIGNE PAIE-DECLARATIONS, POINT 3 (gel levé par Manasse le 2026-11-01) ·
-- L'AVANCE DE MISSION ET SA RÉGULARISATION, LA RÉPARTITION DES FRAIS PAR PROJET.
--
-- L'avance versée avant le départ (D 4211 / C trésorerie, fiche du compte 42
-- des deux plans), la régularisation au retour (D 6384 des frais justifiés,
-- C 4211 de l'avance, l'écart par la trésorerie ou retenu sur la paie comme
-- une avance du registre, Code du travail, art. 112, c), et la répartition
-- des frais d'une mission entre sections analytiques. Une seule avance et une
-- seule régularisation NON ANNULÉES · les deux index uniques sont NULLS NOT
-- DISTINCT (deux annuleLe nuls se heurtent, un annuleLe daté libère).

-- CreateEnum
CREATE TYPE "IssueRegularisationMission" AS ENUM ('SOLDEE', 'COMPLEMENT_PAYE', 'TROP_VERSE_RENDU', 'TROP_VERSE_RETENU');

-- CreateTable
CREATE TABLE "avances_mission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "montantFc" DECIMAL(18,2) NOT NULL,
    "pieceJustificative" VARCHAR(190) NOT NULL,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "piecePassee" VARCHAR(60) NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),

    CONSTRAINT "avances_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regularisations_mission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "avanceId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "justifieFc" DECIMAL(18,2) NOT NULL,
    "avanceFc" DECIMAL(18,2) NOT NULL,
    "ecartFc" DECIMAL(18,2) NOT NULL,
    "issue" "IssueRegularisationMission" NOT NULL,
    "pieceJustificative" VARCHAR(190) NOT NULL,
    "ecritureId" TEXT,
    "ecritureNegatifId" TEXT,
    "piecePassee" VARCHAR(60),
    "avanceSalaireId" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),

    CONSTRAINT "regularisations_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartitions_mission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "pourcentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repartitions_mission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avances_mission_ecritureId_key" ON "avances_mission"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "avances_mission_ecritureNegatifId_key" ON "avances_mission"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "avances_mission_tenantId_missionId_idx" ON "avances_mission"("tenantId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "avances_mission_missionId_annuleLe_key" ON "avances_mission"("missionId", "annuleLe") NULLS NOT DISTINCT;

-- CreateIndex
CREATE UNIQUE INDEX "regularisations_mission_ecritureId_key" ON "regularisations_mission"("ecritureId");

-- CreateIndex
CREATE UNIQUE INDEX "regularisations_mission_ecritureNegatifId_key" ON "regularisations_mission"("ecritureNegatifId");

-- CreateIndex
CREATE UNIQUE INDEX "regularisations_mission_avanceSalaireId_key" ON "regularisations_mission"("avanceSalaireId");

-- CreateIndex
CREATE INDEX "regularisations_mission_tenantId_avanceId_idx" ON "regularisations_mission"("tenantId", "avanceId");

-- CreateIndex
CREATE UNIQUE INDEX "regularisations_mission_avanceId_annuleLe_key" ON "regularisations_mission"("avanceId", "annuleLe") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "repartitions_mission_tenantId_missionId_idx" ON "repartitions_mission"("tenantId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "repartitions_mission_missionId_sectionId_key" ON "repartitions_mission"("missionId", "sectionId");

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions_salarie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_mission" ADD CONSTRAINT "avances_mission_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_avanceId_fkey" FOREIGN KEY ("avanceId") REFERENCES "avances_mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularisations_mission" ADD CONSTRAINT "regularisations_mission_avanceSalaireId_fkey" FOREIGN KEY ("avanceSalaireId") REFERENCES "avances_salaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_mission" ADD CONSTRAINT "repartitions_mission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_mission" ADD CONSTRAINT "repartitions_mission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions_salarie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_mission" ADD CONSTRAINT "repartitions_mission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartitions_mission" ADD CONSTRAINT "repartitions_mission_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_analytiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

