-- Ligne sage-l4, relecture M3 · la révision prospective qu'une réévaluation
-- libre (méthode 2, AUDCIF Titre VIII ch. 28 § 4.3.2) pose se reconnaît à sa
-- LIAISON, jamais à sa date · une révision du cabinet datée de la même
-- clôture partait avec la réévaluation, sans acte, et la durée restait
-- fausse. RESTRICT · la réévaluation ne quitte sa table qu'après elle.

-- AlterTable
ALTER TABLE "revisions_plans_amortissement" ADD COLUMN     "reevaluationBilanId" TEXT;

-- CreateIndex
CREATE INDEX "revisions_plans_amortissement_reevaluationBilanId_idx" ON "revisions_plans_amortissement"("reevaluationBilanId");

-- AddForeignKey
ALTER TABLE "revisions_plans_amortissement" ADD CONSTRAINT "revisions_plans_amortissement_reevaluationBilanId_fkey" FOREIGN KEY ("reevaluationBilanId") REFERENCES "reevaluations_bilan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Les révisions déjà posées par une réévaluation sont liées par ce que le
-- SERVEUR seul écrit · son motif, mot pour mot en tête, le même dossier, le
-- même bien et le même exercice, la date de décision égale à la date de la
-- réévaluation, aucune écriture, une ligne de réévaluation par élimination
-- du bien, et une création qui ne précède pas l'opération. Une révision du
-- cabinet qui ne réunit pas tout reste la sienne.
UPDATE "revisions_plans_amortissement" r
SET "reevaluationBilanId" = rb."id"
FROM "reevaluations_bilan" rb, "lignes_reevaluation_bilan" l
WHERE r."reevaluationBilanId" IS NULL
  AND r."nature" = 'PROSPECTIVE'
  AND r."ecritureId" IS NULL
  AND r."motif" LIKE 'Réévaluation libre, méthode 2 (AUDCIF Titre VIII ch. 28 § 4.3.1 et § 4.3.2)%'
  AND rb."tenantId" = r."tenantId"
  AND rb."exerciceId" = r."exerciceId"
  AND rb."methodeLibre" = 'ELIMINATION'
  AND rb."dateReevaluation" = r."dateDecision"::date
  AND r."createdAt" >= rb."createdAt"
  AND l."reevaluationId" = rb."id"
  AND l."immobilisationId" = r."immobilisationId"
  AND l."amortissementsApres" = 0;
