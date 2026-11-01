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
-- pointe elle-même et une chaîne (un rattaché qui pointerait un rattaché, ou
-- un compte de connexion qui deviendrait rattaché en gardant les siens).
CREATE FUNCTION "omegax_courriel_de_connexion"() RETURNS trigger AS $fonction$
BEGIN
  IF NEW."compteDeConnexionId" IS NULL THEN
    NEW."courrielDeConnexion" := NEW."email";
  ELSE
    IF NEW."compteDeConnexionId" = NEW."id" THEN
      RAISE EXCEPTION 'Une appartenance ne se rattache pas à elle-même';
    END IF;
    IF EXISTS (SELECT 1 FROM "users" WHERE "id" = NEW."compteDeConnexionId" AND "compteDeConnexionId" IS NOT NULL) THEN
      RAISE EXCEPTION 'Une appartenance se rattache à un compte de connexion, jamais à une autre appartenance';
    END IF;
    IF EXISTS (SELECT 1 FROM "users" WHERE "compteDeConnexionId" = NEW."id") THEN
      RAISE EXCEPTION 'Un compte de connexion qui porte des appartenances ne devient pas lui-même rattaché';
    END IF;
    NEW."courrielDeConnexion" := NULL;
  END IF;
  RETURN NEW;
END;
$fonction$ LANGUAGE plpgsql;

CREATE TRIGGER "users_courriel_de_connexion"
  BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "omegax_courriel_de_connexion"();
