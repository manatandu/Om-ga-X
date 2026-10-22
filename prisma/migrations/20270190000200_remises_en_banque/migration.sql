-- Ligne sage-l3, fonction 40 · remises de chèques et de cartes. Fiche du
-- compte 51 des deux plans (AUDCIF Titre VII · SYCEBNL Partie 2 ch. 3) · 513
-- chèques reçus non transmis, 514 chèques à l'encaissement (transmis, non
-- crédités), 515 cartes de crédit à encaisser jusqu'à l'avis de crédit, les
-- commissions en services bancaires ; débité à la réception par le crédit du
-- tiers, crédité pour solde par le débit de la trésorerie. Un type de remise
-- par nature et par banque de remise ; une valeur reçue par chèque ou par
-- transaction ; un bordereau numéroté par dossier. Chaque écriture retenue
-- (RESTRICT), les annulations inscrites en négatif (AUDCIF art. 20, al. 2).

-- CreateEnum
CREATE TYPE "NatureRemise" AS ENUM ('CHEQUES', 'CARTES');

-- CreateEnum
CREATE TYPE "StatutValeurRecue" AS ENUM ('RECUE', 'REMISE', 'CREDITEE', 'IMPAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutRemiseEnBanque" AS ENUM ('REMISE', 'CREDITEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "types_remise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "intitule" VARCHAR(60) NOT NULL,
    "nature" "NatureRemise" NOT NULL,
    "journalBanqueId" TEXT NOT NULL,
    "journalOperationsId" TEXT NOT NULL,
    "compteReceptionId" TEXT NOT NULL,
    "compteTransitId" TEXT,
    "compteCommissionId" TEXT,
    "modeleBordereau" VARCHAR(4000),
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "types_remise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valeurs_recues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "typeRemiseId" TEXT NOT NULL,
    "compteTiersId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "reference" VARCHAR(60) NOT NULL,
    "banqueTiree" VARCHAR(120),
    "titulaire" VARCHAR(120),
    "statut" "StatutValeurRecue" NOT NULL DEFAULT 'RECUE',
    "ecritureReceptionId" TEXT,
    "remiseId" TEXT,
    "dateImpaye" DATE,
    "ecritureImpayeId" TEXT,
    "ecritureNegatifImpayeId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "ecritureNegatifReceptionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valeurs_recues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remises_en_banque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "typeRemiseId" TEXT NOT NULL,
    "journalBanqueId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "nombre" INTEGER NOT NULL,
    "statut" "StatutRemiseEnBanque" NOT NULL DEFAULT 'REMISE',
    "ecritureRemiseId" TEXT,
    "ecritureNegatifRemiseId" TEXT,
    "dateCredit" DATE,
    "commission" DECIMAL(18,2),
    "referenceAvis" VARCHAR(100),
    "ecritureCreditId" TEXT,
    "ecritureNegatifCreditId" TEXT,
    "premiereImpressionLe" TIMESTAMP(3),
    "premiereImpressionPar" TEXT,
    "nombreImpressions" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annulePar" TEXT,
    "motifAnnulation" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remises_en_banque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "types_remise_tenantId_nature_idx" ON "types_remise"("tenantId", "nature");

-- CreateIndex
CREATE UNIQUE INDEX "types_remise_tenantId_code_key" ON "types_remise"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "valeurs_recues_ecritureReceptionId_key" ON "valeurs_recues"("ecritureReceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "valeurs_recues_ecritureImpayeId_key" ON "valeurs_recues"("ecritureImpayeId");

-- CreateIndex
CREATE UNIQUE INDEX "valeurs_recues_ecritureNegatifImpayeId_key" ON "valeurs_recues"("ecritureNegatifImpayeId");

-- CreateIndex
CREATE UNIQUE INDEX "valeurs_recues_ecritureNegatifReceptionId_key" ON "valeurs_recues"("ecritureNegatifReceptionId");

-- CreateIndex
CREATE INDEX "valeurs_recues_tenantId_exerciceId_statut_idx" ON "valeurs_recues"("tenantId", "exerciceId", "statut");

-- CreateIndex
CREATE INDEX "valeurs_recues_tenantId_remiseId_idx" ON "valeurs_recues"("tenantId", "remiseId");

-- CreateIndex
CREATE UNIQUE INDEX "remises_en_banque_ecritureRemiseId_key" ON "remises_en_banque"("ecritureRemiseId");

-- CreateIndex
CREATE UNIQUE INDEX "remises_en_banque_ecritureNegatifRemiseId_key" ON "remises_en_banque"("ecritureNegatifRemiseId");

-- CreateIndex
CREATE UNIQUE INDEX "remises_en_banque_ecritureCreditId_key" ON "remises_en_banque"("ecritureCreditId");

-- CreateIndex
CREATE UNIQUE INDEX "remises_en_banque_ecritureNegatifCreditId_key" ON "remises_en_banque"("ecritureNegatifCreditId");

-- CreateIndex
CREATE INDEX "remises_en_banque_tenantId_exerciceId_date_idx" ON "remises_en_banque"("tenantId", "exerciceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "remises_en_banque_tenantId_numero_key" ON "remises_en_banque"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_journalBanqueId_fkey" FOREIGN KEY ("journalBanqueId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_journalOperationsId_fkey" FOREIGN KEY ("journalOperationsId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_compteReceptionId_fkey" FOREIGN KEY ("compteReceptionId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_compteTransitId_fkey" FOREIGN KEY ("compteTransitId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_remise" ADD CONSTRAINT "types_remise_compteCommissionId_fkey" FOREIGN KEY ("compteCommissionId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_typeRemiseId_fkey" FOREIGN KEY ("typeRemiseId") REFERENCES "types_remise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_compteTiersId_fkey" FOREIGN KEY ("compteTiersId") REFERENCES "comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_ecritureReceptionId_fkey" FOREIGN KEY ("ecritureReceptionId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_remiseId_fkey" FOREIGN KEY ("remiseId") REFERENCES "remises_en_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_ecritureImpayeId_fkey" FOREIGN KEY ("ecritureImpayeId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_ecritureNegatifImpayeId_fkey" FOREIGN KEY ("ecritureNegatifImpayeId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_recues" ADD CONSTRAINT "valeurs_recues_ecritureNegatifReceptionId_fkey" FOREIGN KEY ("ecritureNegatifReceptionId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_typeRemiseId_fkey" FOREIGN KEY ("typeRemiseId") REFERENCES "types_remise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_journalBanqueId_fkey" FOREIGN KEY ("journalBanqueId") REFERENCES "journaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_ecritureRemiseId_fkey" FOREIGN KEY ("ecritureRemiseId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_ecritureNegatifRemiseId_fkey" FOREIGN KEY ("ecritureNegatifRemiseId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_ecritureCreditId_fkey" FOREIGN KEY ("ecritureCreditId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remises_en_banque" ADD CONSTRAINT "remises_en_banque_ecritureNegatifCreditId_fkey" FOREIGN KEY ("ecritureNegatifCreditId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

