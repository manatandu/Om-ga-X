-- Ligne paie-lot · les paramètres de paie du dossier, déclarés une fois.
-- Nullables sans défaut · null = « pas encore dit », jamais présumé. Aucun
-- dossier existant ne reçoit de valeur.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "paieNatureEmployeurInpp" TEXT,
ADD COLUMN     "paieRegimeSalarial" TEXT,
ADD COLUMN     "paieEffectifInpp" INTEGER,
ADD COLUMN     "paieJoursPayes" INTEGER;

-- Bornes tenues aussi par la base · les mêmes que le DTO.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_nature_inpp_check"
  CHECK ("paieNatureEmployeurInpp" IS NULL OR "paieNatureEmployeurInpp" IN ('PUBLIC', 'PRIVE'));
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_regime_salarial_check"
  CHECK ("paieRegimeSalarial" IS NULL OR "paieRegimeSalarial" IN ('BAREME_ARTICLE_118', 'FORFAIT_PERSONNEL_DOMESTIQUE', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE'));
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_effectif_inpp_check"
  CHECK ("paieEffectifInpp" IS NULL OR ("paieEffectifInpp" >= 0 AND "paieEffectifInpp" <= 1000000));
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_jours_payes_check"
  CHECK ("paieJoursPayes" IS NULL OR ("paieJoursPayes" >= 1 AND "paieJoursPayes" <= 26));
