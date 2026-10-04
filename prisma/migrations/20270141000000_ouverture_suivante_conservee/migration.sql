-- AU2 · motif déclaré quand la clôture conserve le bilan d'ouverture importé
-- de l'exercice suivant, différent du bilan de clôture (AUDCIF art. 34 ;
-- SYCEBNL art. 16, 4)). Null par défaut · aucune déclaration.
ALTER TABLE "exercices" ADD COLUMN "motifOuvertureSuivanteConservee" TEXT;
ALTER TABLE "exercices" ADD COLUMN "ecartsOuvertureSuivanteConservee" JSONB;
