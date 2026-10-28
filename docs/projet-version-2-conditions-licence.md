# Projet de version 2 des conditions de licence

État au 25 octobre 2026. Ce document NE PUBLIE RIEN : la version 1 reste en vigueur, son texte archivé n'est pas touché (`versions/version-1.ts`, empreinte gelée).

## Pourquoi ne pas publier la version 2 tout de suite

1. Toute version après la première est une MODIFICATION (contrat, art. 15 ; Code du numérique, art. 34) : projet communiqué trente jours ouvrables avant l'entrée en vigueur, prise d'effet soixante jours ouvrables plus tard. `versions-publiees.spec.ts` refuse d'ailleurs une seconde version tant que la bascule de N à N+1 n'est pas codée.
2. Il reste des blancs qui ne se remplissent qu'après l'immatriculation (identité de l'éditeur, RCCM, ID.NAT., NIF, capital : art. 52 et 53, 1° du Code du numérique). Publier maintenant, puis encore à l'immatriculation, ferait deux versions et deux délais de trente jours ouvrables.
3. L'acceptation en ligne est fermée tant que ces blancs existent (art. 54, al. 2) : aucun client n'est lié par la version 1, rien ne presse.

Décision de méthode : UNE seule version 2, publiée quand tous les blancs sont connus.

## Les six choix arrêtés par Manasse le 25 octobre 2026

Texte proposé pour chaque blanc de `conditions-de-licence.ts` (à relire une dernière fois avant publication).

| Blanc (article du contrat) | Texte retenu |
|---|---|
| Réclamations, voie et délai (art. 53, 13° et 14°) | Réclamation adressée par courrier électronique à l'éditeur. Accusé de réception sous trois jours ouvrables, réponse motivée sous quinze jours ouvrables. |
| Moyens de paiement (art. 53, 6°) | Virement bancaire et paiement par monnaie mobile, facture en dollars américains. Ne garder que les moyens réellement ouverts au jour de la publication. |
| Données après la fin du contrat (art. 9) | Dossier conservé en lecture seule cent quatre-vingts jours, archive complète disponible pendant ce délai, puis suppression. |
| Prévisions d'interruption (art. 11) | Maintenance planifiée annoncée quarante-huit heures à l'avance par courrier électronique et sur la page publique ; interruption urgente annoncée dès que possible (Code du numérique, art. 29, 4°). |
| Assistance (art. 11) | Par courrier électronique, du lundi au vendredi de 8 h à 17 h, heure de Kinshasa, réponse sous deux jours ouvrables. |
| Raisons d'une modification unilatérale (art. 15) | Évolution de la loi ou de la réglementation, sécurité du service, évolution du service lui-même. Préavis de trente JOURS OUVRABLES (et non trente jours : art. 34). Résiliation sans pénalité si le client refuse. |

Deux points à corriger dans les propositions avant publication :
- Le préavis de l'art. 34 se compte en jours ouvrables ; écrire « jours » tout court raccourcirait le délai légal.
- L'art. 53, 13° exige AUSSI un numéro de téléphone pour les réclamations. Il manque.

## Ce qui reste ouvert (réponses attendues)

- Numéro de téléphone de l'éditeur (art. 53, 13°).
- Identité de l'éditeur : dénomination, forme, capital, siège, RCCM, ID.NAT., NIF (art. 52, 53, 1° ; après immatriculation).
- Plafond de responsabilité (art. 12), résiliation et préavis de chaque partie (art. 14), juridiction compétente (art. 19) : avis d'un juriste.
- Droit de rétractation et garanties légales (art. 53, 16° et 20°) : avis d'un juriste ; l'art. 61 ne vise que les contrats entre professionnel et non-professionnel.

## Ce qu'il faudra coder avec la version 2

1. La bascule : l'acceptation de la version 1 reste valable jusqu'à la prise d'effet de la version 2 (`priseDEffet`), le serveur sert la version applicable à chaque dossier à la date du jour, et `delais-article-34.ts` perd son statut de fichier sans appelant.
2. Archiver le texte de la version 2 dans `versions/version-2.ts`, ajouter sa ligne et son empreinte gelée, lever le test « une seule version ».
3. Écran : afficher la version applicable et le projet en préavis, avec la date d'entrée en vigueur.
