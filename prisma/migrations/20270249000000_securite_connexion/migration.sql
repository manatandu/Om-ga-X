-- SÉCURITÉ DE LA CONNEXION (audit de sécurité du 2026-11-19).
-- (1) Le titulaire rouvre son compte fermé par un lien reçu à son adresse ·
--     empreinte du jeton, échéance, et le verrou pour lequel il est parti.
ALTER TABLE "users" ADD COLUMN "empreinteDeverrouillage" TEXT;
ALTER TABLE "users" ADD COLUMN "deverrouillageExpireLe" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deverrouillageEnvoyePour" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_empreinteDeverrouillage_key" ON "users"("empreinteDeverrouillage");
-- Les codes faux de la double authentification pendant le verrou, au plus
-- cinq par période de verrou (relecture du 2026-11-20).
ALTER TABLE "users" ADD COLUMN "codesFauxSousVerrou" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "codesFauxSousVerrouPour" TIMESTAMP(3);

-- (2) La limite d'essais par adresse e-mail, partagée entre les instances.
CREATE TABLE "essais_connexion_adresse" (
    "empreinte" TEXT NOT NULL,
    "instants" TIMESTAMP(3)[],
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "essais_connexion_adresse_pkey" PRIMARY KEY ("empreinte")
);
CREATE INDEX "essais_connexion_adresse_majLe_idx" ON "essais_connexion_adresse"("majLe");
