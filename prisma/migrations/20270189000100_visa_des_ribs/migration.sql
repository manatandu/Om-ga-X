-- Visa des RIB par un second utilisateur (décision de Manasse du 2026-10-21) ·
-- une option du dossier, désactivée par défaut, et sur chaque RIB (tiers et
-- salariés) l'auteur de la dernière saisie des coordonnées et son visa. Les RIB
-- existants restent sans auteur connu et sans visa · rien n'est présumé visé.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "visaRibs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ribs_tiers" ADD COLUMN "saisiPar" TEXT,
ADD COLUMN "saisiLe" TIMESTAMP(3),
ADD COLUMN "visePar" TEXT,
ADD COLUMN "viseLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ribs_salaries" ADD COLUMN "saisiPar" TEXT,
ADD COLUMN "saisiLe" TIMESTAMP(3),
ADD COLUMN "visePar" TEXT,
ADD COLUMN "viseLe" TIMESTAMP(3);
