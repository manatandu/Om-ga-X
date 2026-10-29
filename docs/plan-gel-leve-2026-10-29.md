# Gel levé le 2026-10-29 · Sage restant et petits points Microfina

Demande de Manasse du 2026-10-29 · « Lève le gel pour 1 et 3 uniquement et
traite le tous en cascade. Écarte cette histoire de bon de commande. […] pour
les fonctions que vous avez classées « Plus tard », trie et écarte tout ce
qui n'est pas important ou nécessaire au logiciel. »

Le point 1 est la comparaison avec Sage (lignes L8 et L9 jamais commencées,
et les « Plus tard » triés ci-dessous). Le point 3 est le reste des idées de
Microfina++ · visa d'un plan d'étalement, départements et directions. Le bon
de commande au SYSCOHADA est ÉCARTÉ. Rien d'autre n'entre (le point 2, paie,
et le point 4, commercial et site, restent sous le gel).

## 1. Tri des « Plus tard » de `comparaison-sage/15-absents-a-trier.md`

Critère · une fonction est GARDÉE si elle sert une obligation, évite une
erreur que le logiciel laisse passer, ou épargne un travail répété à chaque
période. Elle est ÉCARTÉE si elle est de pur confort, déjà couverte
autrement, ou propre à une norme française sans équivalent lu en RDC.

### Gardées (27)

| # | Fonction | Raison |
|---|---|---|
| 2 | Échéance obligatoire sur une ligne de tiers, en OPTION du dossier | balance âgée, relances et notes par échéance lisent l'échéance ; absente, la date de pièce la remplace en silence |
| 13 | Interroger le compte depuis la saisie (solde, dernières lignes) | contrôle courant pendant la saisie |
| 15 | Créer un modèle de saisie depuis la pièce en cours | travail répété |
| 25 | Devise du tiers (proposée à la saisie et à la vente) | sert la gestion commerciale levée avec L8 ; la langue est écartée |
| 30 | Encours maximum du client, averti à la vente | sert la gestion commerciale ; code risque et assurance crédit écartés |
| 33 | Recouvrement · exclure UNE écriture de la relance, décaler une échéance | l'exclusion porte aujourd'hui sur le tiers entier ; pénalités, frais d'impayés et scénarios écartés (aucun taux au corpus) |
| 34 | Alertes sur les échéances proches des tiers | le tableau de bord ne voit que le fiscal |
| 35 | Avis de règlement envoyé au tiers par la messagerie | l'avis existe en impression seule |
| 48 | Grille analytique rattachée au compte | ventilation par défaut, travail répété (ONG, bailleurs) |
| 51 | Budget par compte général, comparaison avec N-1 | les sociétés budgètent par compte, pas par section |
| 52 | Journal analytique ; grand livre analytique avec les non ventilées | révision analytique, rapports aux bailleurs |
| 53 | Filtres de la balance analytique (mouvementées, non soldées) | lecture courante |
| 56 | Grand livre avec ou sans les écritures lettrées | révision des tiers ; devise et regroupement par mois écartés |
| 57 | Filtres de la balance des tiers (mouvementés, soldés, non soldés) | lecture courante |
| 58 | Filtres du rapprochement (rapprochées ou non) | lecture courante |
| 64 | Révision par écriture (marquer revue, filtrer) | travail du cabinet sur le journal |
| 65 | Quantité d'un bien, cession d'une partie des unités | lots de mobilier, de matériel |
| 69 | Sortie globale de plusieurs biens | rebut ou vol d'un lot |
| 70 | Analytique des biens (section sur la fiche, dotation ventilée) | dotations par projet ou bailleur |
| 71 | Numéro de série du bien | inventaire physique ; codes-barres et étiquettes écartés |
| 72 | Simulation des dotations futures | budget, plan prévisionnel |
| 76 | Compte individuel du salarié sous le 422 | net dû et avances lus par salarié |
| 81 | Alertes datées · fin d'essai, fin de CDD | requalification de plein droit (Code du travail, art. 40 à 45) |
| 82 | Import du personnel depuis Excel | reprise d'un dossier ; purge et multi-sociétés écartés |
| 87 | Rappel de salaires | arriérés d'une hausse rétroactive |
| 89 | Fiche individuelle et cumuls annuels par rubrique, en Excel | attestations, contrôle de l'IRPP annuel |
| 97 | Aller à une fonction par son nom | menu de plus de deux cents commandes |

### Écartées (34)

4, 5, 6, 7, 8, 9, 10 (le numéro est déjà imposé par le journal), 17, 20,
21, 23, 26, 28, 29, 38, 41, 42, 43, 44, 49, 54, 55, 61 (couvert par le
planning et les refus de clôture), 62, 63, 74, 80 (prime d'ancienneté ·
barème conventionnel hors corpus, une rubrique suffit), 83, 84, 86, 92
(facture électronique · homologation, choix commercial), 93, 98, 103.

## 2. Départements et directions · comment on les définit

Aucun texte lu ne fixe l'organisation interne d'une entité (le Code du
travail, art. 212, ne demande au registre que l'emploi occupé) · chaque
entreprise a la sienne. OmegaX ne pose donc AUCUNE liste ni aucun niveau ·

- le dossier décrit son ORGANIGRAMME en arbre libre · une unité a un code, un
  intitulé et une unité parente ; il nomme lui-même ses niveaux (« Direction »,
  « Département », « Service », ou ce qu'il veut), sans limite de profondeur ;
- un salarié est RATTACHÉ à une unité avec une DATE D'EFFET, l'historique
  gardé (une mutation n'efface rien) ;
- une unité peut renvoyer à une section analytique, que la ventilation de la
  paie PROPOSE alors, jamais imposée ;
- une unité qui porte un rattachement ne se supprime pas, elle se met en
  sommeil.

## 3. Visa d'un plan d'étalement

Même modèle que le visa des RIB · OPTION du dossier, désactivée par défaut
(aucun texte ne l'impose, AUDCIF art. 69). Activée, un plan d'étalement saisi
ou modifié attend le visa d'un AUTRE utilisateur ; tant qu'il n'est pas visé,
le bulletin ne le PROPOSE pas et le dit. Un plan d'avant la règle n'a pas
d'auteur connu, il se vise, et c'est dit.

## 4. Lignes de travail, en cascade

| Ligne | Contenu | Famille |
|---|---|---|
| gl-saisie | 2, 13, 15, 33, 34, 35, 56, 57, 58, 64, 97 | saisie, tiers, éditions |
| analytique | 48, 51, 52, 53 | analytique, budgets |
| immos | 65, 69, 70, 71, 72 | immobilisations |
| paie-suite | 76, 81, 82, 87, 89, départements et directions, visa du plan d'étalement | personnel |
| dossier-l9 | 95, 96, 100, 101, 102 (Sage L9) | dossier et interface |
| commercial-l8 | 90, 91, 94, 25, 30 (Sage L8) | gestion commerciale |

Chaque ligne · décision par la loi avant le code, commit à chaque étape et
branche `travail/<ligne>`, deux tours de relecture, bloc § 3 des deux côtés,
rejeu sur vraie base à travers une clôture quand une écriture est touchée,
intégration sur `main` l'une après l'autre, déploiement relu.
