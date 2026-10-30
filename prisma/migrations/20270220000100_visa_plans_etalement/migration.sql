-- Ligne paie-suite · le visa d'un plan d'étalement par un second utilisateur,
-- option du dossier désactivée par défaut (personnel/visa-plan-etalement.ts).
ALTER TABLE "tenants" ADD COLUMN "visaPlansEtalement" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "avances_salaire" ADD COLUMN "planSaisiPar" TEXT;
ALTER TABLE "avances_salaire" ADD COLUMN "planSaisiLe" TIMESTAMP(3);
ALTER TABLE "avances_salaire" ADD COLUMN "planVisePar" TEXT;
ALTER TABLE "avances_salaire" ADD COLUMN "planViseLe" TIMESTAMP(3);
