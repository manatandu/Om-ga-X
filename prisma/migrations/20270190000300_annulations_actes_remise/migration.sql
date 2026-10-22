-- Ligne sage-l3, fonction 40, second tour · BLOQUANT B1. Un avis de crédit ou
-- un impayé VALIDÉ puis annulé gardait son lien d'origine sur la remise ou la
-- valeur (une seule paire de colonnes), et le geste suivant, qui exige le lien
-- vide, était refusé pour toujours · le 514 reporté restait ouvert, le chèque
-- réellement impayé ne revenait jamais au 413. Chaque annulation range désormais
-- sa paire (origine, négatif) dans un historique, toutes deux retenues
-- (RESTRICT), et libère la remise ou la valeur (AUDCIF art. 20, al. 2).

-- CreateEnum
CREATE TYPE "NatureActeRemise" AS ENUM ('AVIS_CREDIT', 'IMPAYE');

-- CreateTable
CREATE TABLE "annulations_actes_remise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nature" "NatureActeRemise" NOT NULL,
    "remiseId" TEXT,
    "valeurId" TEXT,
    "traitement" TEXT NOT NULL,
    "numeroPieceOrigine" INTEGER,
    "ecritureOrigineId" TEXT,
    "ecritureNegatifId" TEXT,
    "motif" VARCHAR(500) NOT NULL,
    "annuleeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleePar" TEXT NOT NULL,

    CONSTRAINT "annulations_actes_remise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annulations_actes_remise_ecritureOrigineId_key" ON "annulations_actes_remise"("ecritureOrigineId");

-- CreateIndex
CREATE UNIQUE INDEX "annulations_actes_remise_ecritureNegatifId_key" ON "annulations_actes_remise"("ecritureNegatifId");

-- CreateIndex
CREATE INDEX "annulations_actes_remise_tenantId_remiseId_idx" ON "annulations_actes_remise"("tenantId", "remiseId");

-- CreateIndex
CREATE INDEX "annulations_actes_remise_tenantId_valeurId_idx" ON "annulations_actes_remise"("tenantId", "valeurId");

-- AddForeignKey
ALTER TABLE "annulations_actes_remise" ADD CONSTRAINT "annulations_actes_remise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_actes_remise" ADD CONSTRAINT "annulations_actes_remise_remiseId_fkey" FOREIGN KEY ("remiseId") REFERENCES "remises_en_banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_actes_remise" ADD CONSTRAINT "annulations_actes_remise_valeurId_fkey" FOREIGN KEY ("valeurId") REFERENCES "valeurs_recues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_actes_remise" ADD CONSTRAINT "annulations_actes_remise_ecritureOrigineId_fkey" FOREIGN KEY ("ecritureOrigineId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annulations_actes_remise" ADD CONSTRAINT "annulations_actes_remise_ecritureNegatifId_fkey" FOREIGN KEY ("ecritureNegatifId") REFERENCES "ecritures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Les paires déjà gardées sur la remise ou la valeur passent dans l'historique
-- (aucune en production · la ligne n'y est pas encore ; une base d'essai en
-- porte), puis le lien d'origine est libéré et les colonnes de négatif retirées.
INSERT INTO "annulations_actes_remise" ("id", "tenantId", "nature", "remiseId", "traitement", "ecritureOrigineId", "ecritureNegatifId", "motif", "annuleePar")
SELECT gen_random_uuid()::text, r."tenantId", 'AVIS_CREDIT', r."id", 'INSCRITE_EN_NEGATIF', r."ecritureCreditId", r."ecritureNegatifCreditId", 'Annulation antérieure à l''historique (migration)', 'migration'
FROM "remises_en_banque" r WHERE r."ecritureNegatifCreditId" IS NOT NULL;

UPDATE "remises_en_banque" SET "ecritureCreditId" = NULL WHERE "ecritureNegatifCreditId" IS NOT NULL;

INSERT INTO "annulations_actes_remise" ("id", "tenantId", "nature", "valeurId", "traitement", "ecritureOrigineId", "ecritureNegatifId", "motif", "annuleePar")
SELECT gen_random_uuid()::text, v."tenantId", 'IMPAYE', v."id", 'INSCRITE_EN_NEGATIF', v."ecritureImpayeId", v."ecritureNegatifImpayeId", 'Annulation antérieure à l''historique (migration)', 'migration'
FROM "valeurs_recues" v WHERE v."ecritureNegatifImpayeId" IS NOT NULL;

UPDATE "valeurs_recues" SET "ecritureImpayeId" = NULL WHERE "ecritureNegatifImpayeId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "remises_en_banque" DROP CONSTRAINT "remises_en_banque_ecritureNegatifCreditId_fkey";

-- DropForeignKey
ALTER TABLE "valeurs_recues" DROP CONSTRAINT "valeurs_recues_ecritureNegatifImpayeId_fkey";

-- DropIndex
DROP INDEX "remises_en_banque_ecritureNegatifCreditId_key";

-- DropIndex
DROP INDEX "valeurs_recues_ecritureNegatifImpayeId_key";

-- AlterTable
ALTER TABLE "remises_en_banque" DROP COLUMN "ecritureNegatifCreditId";

-- AlterTable
ALTER TABLE "valeurs_recues" DROP COLUMN "ecritureNegatifImpayeId";
