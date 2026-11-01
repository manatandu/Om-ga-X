-- UNE PERSONNE, PLUSIEURS DOSSIERS (ligne multi-dossiers, 2026-11-01).
-- Chaque utilisateur existant reste son propre compte de connexion et son
-- appartenance à son dossier · aucune ligne déplacée, aucune donnée perdue.

ALTER TABLE "users" ADD COLUMN "compteDeConnexionId" TEXT;
ALTER TABLE "users" ADD COLUMN "courrielDeConnexion" TEXT;

-- L'adresse de connexion de chaque compte existant est son adresse.
UPDATE "users" SET "courrielDeConnexion" = "email";

-- L'unicité sur toute la plateforme passe à l'adresse de CONNEXION ;
-- l'adresse d'une ligne n'est plus unique que dans son dossier.
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_courrielDeConnexion_key" ON "users"("courrielDeConnexion");
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE INDEX "users_compteDeConnexionId_idx" ON "users"("compteDeConnexionId");

ALTER TABLE "users" ADD CONSTRAINT "users_compteDeConnexionId_fkey"
  FOREIGN KEY ("compteDeConnexionId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- L'ADRESSE DE CONNEXION EST POSÉE PAR LA BASE, JAMAIS PAR LE CODE · aucun
-- chemin de création (inscription, console, siège, essai, démonstration, sur
-- site) n'a à s'en souvenir. Le même déclencheur refuse une ligne qui se
-- pointe elle-même, une chaîne (un rattaché qui pointerait un rattaché) et
-- tout changement du lien après la création.
CREATE FUNCTION "omegax_courriel_de_connexion"() RETURNS trigger AS $fonction$
BEGIN
  -- LE LIEN NE CHANGE JAMAIS APRÈS LA CRÉATION · une chaîne ne peut donc
  -- naître que d'une insertion qui pointerait une appartenance, refusée
  -- ci-dessous, et la cible relue ici ne peut pas devenir rattachée pendant
  -- la transaction d'un autre (aucune concurrence à sérialiser).
  IF TG_OP = 'UPDATE' AND NEW."compteDeConnexionId" IS DISTINCT FROM OLD."compteDeConnexionId" THEN
    RAISE EXCEPTION 'Le compte de connexion d''une appartenance ne change pas';
  END IF;
  IF NEW."compteDeConnexionId" IS NULL THEN
    NEW."courrielDeConnexion" := NEW."email";
  ELSE
    IF NEW."compteDeConnexionId" = NEW."id" THEN
      RAISE EXCEPTION 'Une appartenance ne se rattache pas à elle-même';
    END IF;
    IF EXISTS (SELECT 1 FROM "users" WHERE "id" = NEW."compteDeConnexionId" AND "compteDeConnexionId" IS NOT NULL) THEN
      RAISE EXCEPTION 'Une appartenance se rattache à un compte de connexion, jamais à une autre appartenance';
    END IF;
    NEW."courrielDeConnexion" := NULL;
  END IF;
  RETURN NEW;
END;
$fonction$ LANGUAGE plpgsql;

CREATE TRIGGER "users_courriel_de_connexion"
  BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "omegax_courriel_de_connexion"();

-- La révocation de la PERSONNE dans tous ses dossiers, distincte de celle
-- d'un dossier.
ALTER TABLE "users" ADD COLUMN "sessionsDuCompteInvalidesAvant" TIMESTAMP(3);

-- L'invitation d'une personne à un dossier.
CREATE TYPE "StatutInvitationDossier" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'ANNULEE');

CREATE TABLE "invitations_dossier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "empreinteJeton" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "statut" "StatutInvitationDossier" NOT NULL DEFAULT 'EN_ATTENTE',
    "creePar" TEXT NOT NULL,
    "decideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_dossier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invitations_dossier_empreinteJeton_key" ON "invitations_dossier"("empreinteJeton");
CREATE INDEX "invitations_dossier_tenantId_statut_idx" ON "invitations_dossier"("tenantId", "statut");
CREATE INDEX "invitations_dossier_email_idx" ON "invitations_dossier"("email");
ALTER TABLE "invitations_dossier" ADD CONSTRAINT "invitations_dossier_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
