# Site du cabinet VMG Consulting

Pages statiques (aucune construction) : `index.html`, `cabinet.css`, `cabinet.js`.

## Mise en ligne (Cloudflare Pages)

1. Créer un projet Pages relié à ce dépôt.
2. Commande de construction : aucune. Dossier de sortie : `docs/site-vitrine/cabinet`.
3. Rattacher le domaine `vmgconsulting.net` au projet.

## Avant la mise en ligne, à fournir par le cabinet

- Un numéro de téléphone de contact (aucun n'est écrit dans la page).
- Les mentions légales (identité, immatriculation, directeur de la publication).
- La liste réelle des services du cabinet (seul le logiciel OmegaX est présenté).

## Formulaire

Le formulaire ouvre le client de courriel du visiteur (`mailto:` vers
admin@vmgconsulting.net) : rien n'est envoyé par le site lui-même, et la page le dit.

## Photos

Quatre photos d illustration (générées par ordinateur) sont posées dans `photos/` : `cabinet.jpg`, `equipe-1.jpg`, `equipe-2.jpg`, `equipe-3.jpg`.
Pour poser une photo : déposer le fichier dans ce dossier, puis dans la `<figure>` remplacer
`<span></span>` par `<img src="photo.jpg" alt="description de l'image">` et retirer
`aria-hidden="true"` de la figure (et de `.photos` pour les trois du bas).

## Périmètre des missions

Le site ne présente que des activités qui ne sont pas réservées aux experts-comptables inscrits
(loi n° 15/002, art. 43 et 71 : tenue de la comptabilité de tiers, organisation comptable,
conseil fiscal, certification, révision). Formation, études économiques et statistiques,
indicateurs de projet et solutions logicielles sont hors de cette liste. Ne pas ajouter de
mission de l'art. 43 avant l'inscription au tableau de l'Ordre.

## Logo

Logo retenu : le cachet (proposition 1). Fichiers dans `logo/` : `logo-clair.svg`, `logo-sombre.svg`, `icone-clair.svg`, `icone-sombre.svg`, `favicon.svg`. Le nom écrit en toutes lettres utilise une police du système : à convertir en tracés pour un usage imprimé.
