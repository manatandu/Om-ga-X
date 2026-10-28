# Sauvegarde · modèle de site de cabinet

Modèle anonyme du site d'un cabinet qui distribue OmegaX, gardé pour être
repris par le prochain cabinet. Rien ici n'est déployé ni lu par le logiciel.

- `site/` · pages statiques (accueil, mentions légales), feuille de style,
  script du formulaire de demande par courriel, photos d'illustration
  générées par ordinateur. Le logo n'est pas gardé · il était propre à
  l'ancien cabinet, le prochain fournira le sien (`site/logo/`, cinq fichiers
  attendus par les pages · `favicon.svg`, `logo-clair.svg`, `logo-sombre.svg`,
  `icone-clair.svg`, `icone-sombre.svg`).
- `adresse-du-site.ts` · l'aiguillage qui ouvrait la page publique à la racine
  de l'adresse du site du cabinet (à replacer dans `client/src/lib/`).

À compléter avant toute publication · `[Nom du cabinet]`, `[NOM DU CABINET]`,
`[Sigle]`, `[domaine du cabinet]`, `[adresse du logiciel]`, `[courriel du
cabinet]`, `[téléphone]`, `[Nom du responsable]`, le siège et
l'immatriculation des mentions légales.

À remettre aussi, côté logiciel, pour rattacher l'adresse du site · l'origine
`https://[adresse du logiciel]` dans `ORIGINES_SITE` (`src/bootstrap.ts`) et
dans `CORS_ORIGIN` (`.github/workflows/deploy-cloud-run.yml`), et le domaine
dans la console Firebase (site `oomega`, domaines personnalisés). Le contrat de
licence nommera le cabinet dans une version nouvelle (Code du numérique,
art. 52 et 53).
