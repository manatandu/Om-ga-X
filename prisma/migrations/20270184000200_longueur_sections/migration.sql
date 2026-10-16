-- Ligne sage-l6, fonction n° 50 · la longueur fixe des codes de section,
-- par plan analytique. Null = longueur libre, ce que tous les plans existants
-- gardent · aucun code n'est renuméroté, et la longueur ne se pose que sur un
-- plan dont toutes les sections la respectent (`longueur-sections.ts`).
ALTER TABLE "plans_analytiques" ADD COLUMN "longueurSections" INTEGER;

-- Bornes de 2 à 13, convention d'OmegaX · la base refuse le reste.
ALTER TABLE "plans_analytiques" ADD CONSTRAINT "plans_analytiques_longueur_sections"
  CHECK ("longueurSections" IS NULL OR "longueurSections" BETWEEN 2 AND 13);
