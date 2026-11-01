-- Ligne paie-lot · les paramètres de paie du dossier, déclarés une fois.
-- Nullables sans défaut · null = « pas encore dit », jamais présumé. Aucun
-- dossier existant ne reçoit de valeur.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "paieNatureEmployeurInpp" TEXT,
ADD COLUMN     "paieEffectifInpp" INTEGER,
ADD COLUMN     "paieInppDepuisMois" TEXT,
ADD COLUMN     "paieRegimeSalarial" TEXT;

-- Bornes tenues aussi par la base · les mêmes que le DTO.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_nature_inpp_check"
  CHECK ("paieNatureEmployeurInpp" IS NULL OR "paieNatureEmployeurInpp" IN ('PUBLIC', 'PRIVE'));
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_effectif_inpp_check"
  CHECK ("paieEffectifInpp" IS NULL OR ("paieEffectifInpp" >= 0 AND "paieEffectifInpp" <= 1000000));
-- Une nature ou un effectif déclaré porte son mois d'effet, et un mois sans
-- déclaration n'en porte pas.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_inpp_depuis_check"
  CHECK (
    ("paieInppDepuisMois" IS NULL AND "paieNatureEmployeurInpp" IS NULL AND "paieEffectifInpp" IS NULL)
    OR ("paieInppDepuisMois" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND ("paieNatureEmployeurInpp" IS NOT NULL OR "paieEffectifInpp" IS NOT NULL))
  );
-- Au dossier, seulement ce qui qualifie l'employeur (art. 121, al. 2) · le
-- personnel domestique se déclare au salarié.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_paie_regime_salarial_check"
  CHECK ("paieRegimeSalarial" IS NULL OR "paieRegimeSalarial" IN ('BAREME_ARTICLE_118', 'FORFAIT_SALARIE_DE_MICRO_ENTREPRISE'));
