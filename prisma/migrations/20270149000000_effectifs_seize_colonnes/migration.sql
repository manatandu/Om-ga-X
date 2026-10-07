-- Notes 20B (projets) et 29B (associations), 1. Personnel propre · de huit
-- colonnes « (M / F) » à seize colonnes ventilées M / F (SYCEBNL, Partie 4
-- ch. 2 et ch. 3 ; décision par la loi du 2026-10-04, point 3).
--
-- Une saisie ancienne n'est JAMAIS scindée entre M et F · la répartir
-- reviendrait à deviner. L'ancien rang k est porté au rang 100 + k, hors de
-- la contexture : aucune cellule nouvelle ne le lit, la note le montre à part
-- (`effectifs-seize-colonnes.ts`, RANG_FORMAT_ANTERIEUR). Rien n'est supprimé.
UPDATE "saisies_notes"
SET "colonne" = "colonne" + 100
WHERE "colonne" BETWEEN 0 AND 7
  AND (
    ("jeu" = 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' AND "codeNote" = '29B')
    OR ("jeu" = 'PROJETS_DEVELOPPEMENT' AND "codeNote" = '20B')
  )
  AND "cleRubrique" IN (
    'ya-1-cadres-superieurs',
    'yb-2-techniciens-superieurs-et-cadres-moyens',
    'yc-3-techniciens-agents-de-maitrise-et-ouvriers',
    'yd-4-employes-man-uvres-ouvriers-et-apprentis',
    'ye-total-1',
    'yf-permanents',
    'yg-saisonniers'
  );
