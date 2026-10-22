# Parité · les 41 absences de Sage cochées « À faire »

Mesuré le 2026-10-15 sur `main` (`a503f49`), après l'intégration des lignes
sage-l4, sage-l5 et sage-l1, puis recompté à l'intégration de sage-l2, de
sage-l7 et, le 2026-10-22, de sage-l3 (même barème, même fichier), par l'outil de la compétence de réplication
(`parity.py`, pondération must 3, should 2, could 1, partiel compté pour
moitié) sur `features.csv` · colonnes relues sous les noms qu'il attend
(ligne en domaine, fonction, priorité, clone, note), rien d'autre changé.

## Le score

**Parité fonctionnelle · 83,3 sur 100.** 41 fonctions comptées, **13 des 14
« must » faites** (62,9 avant sage-l3 et la relecture de sage-l6, 58,6 avant
sage-l7, 39,2 et 7 avant sage-l2).

| Ligne | Fonctions | Score | État |
|---|---|---|---|
| L1 · saisie | 6 | 100 | intégrée le 2026-10-15 |
| L4 · immobilisations | 4 | 90,9 | intégrée le 2026-10-14 (fusion d'un autre dossier non servie, n° 73) |
| L5 · paie | 5 | 89,3 | intégrée le 2026-10-15 (feuilles de temps et compteurs libres non repris, n° 78) |
| L1 L2 L4 · mode assistant (n° 18) | 1 | 100 | compte, journal, bien et règlement guidés |
| L2 · tiers et règlements | 7 | 100 | intégrée le 2026-10-15 (monnaie électronique, prélèvement et effet de commerce face à l'art. 59 bis, question posée) |
| L3 · banque et trésorerie | 6 | 100 | intégrée le 2026-10-22 (ni LCR, ni BOR, ni CFONB · circuit comptable seul ; aucun agio calculé) |
| L6 · documents et analytique | 2 | 100 | intégrée (pièces jointes, longueur fixe des codes de section ; question du plan contre le dossier posée) |
| L7 · éditions et exports | 2 | 100 | intégrée le 2026-10-15 (reprise par l'expert-comptable, n° 102, laissée à L9) |
| L8 · gestion commerciale | 3 | 0 | non commencée |
| L9 · cabinet et plateforme | 5 | 0 | non commencée |

Les sept lignes faites sont à 89 à 100 % chacune ; l'écart tient à L8 et
L9, construites ensuite, et aux restes partiels des n° 73 et 78.

**Disposition des écrans · non mesurée.** La comparaison par carte des bords
demande deux captures dans le même état, à la même taille. Celles de Sage
sont des pages de manuels scannés, pas des écrans du logiciel en marche, et
la disposition d'OmegaX suit le rendu de Sage Active aux couleurs de la
charte (CLAUDE.md § 9 ter) · un score fabriqué sur ces images ne dirait
rien. La parité qui compte ici est la fonction.

## Ce qui reste, dans l'ordre de construction

Le seul « must » restant · L5, n° 78, reste partiel (feuilles de temps,
compteurs libres · aucun texte ne les régit).

Puis les « should » · L8 (91, 94), L9 (95, 101, 102) et la fusion du n° 73 ;
enfin les « could » · L8 (90), L9 (96, 100).

## Différences de comportement gardées à dessein

| Fonction | Sage | OmegaX | À corriger ou à garder |
|---|---|---|---|
| 12 · journal de situation | peut entrer dans une balance ou un grand livre de simulation | hors de tout livre et état, lu dans son journal ; ni validé, ni clôturé, ni lettré, ni bien | garder (AUDCIF art. 19, 22) · balance de simulation à part posée en question à Manasse |
| 60 · journal imprimé | marque « imprimé » | l'impression s'enregistre, numérotée, et une validation postérieure rend le jour non imprimé ; le refus de clôture est une option fermée par défaut | garder (art. 22, 1° et 7°) |
| 14 · compte créé en saisie | crée tout compte tapé | sous-compte d'un compte d'imputation du plan seulement, jamais sous un collectif | garder ; qui peut le faire, question posée |
| 16 · lettre choisie | prochaine lettre changée à la main | lettre tapée par lettrage, refusée si déjà employée sur le compte | garder ; double envoi en 500 (B-PAR-01) à corriger |
| 19 · séquences | ranges aussi les rubriques de paie | modèles de saisie seuls | question posée (rubriques de paie) |
| 66 · fiche du bien | modifier propose un virement de poste | la valeur ne se retouche qu'au brouillard ; validée, reclassement ou révision du plan | garder (art. 20, 22, 2°) |
| 73 · fusion de fichiers | fusionne deux fichiers | renumérotation et maintenance ; fusion d'un autre dossier du groupe non servie | question posée (comptes de liaison) |
| 78 · temps de travail | feuilles de temps, compteurs libres | absences, arrêts, heures majorées par leurs textes | garder ; aucun texte pour le reste |
| 79 · congés acquis | alimentés chaque mois | acquis par mois de service sur bulletin émis, droits nés à l'expiration de l'année | garder (Code du travail, art. 140, 141) ; mois avec un jour hors service, question posée |
| 1 · mode de règlement | mode libre sur le tiers et la ligne | un paiement d'au moins 1 000 000 FC hors chèque, virement ou carte est averti, jamais refusé ; les modes que le texte ne nomme pas sous réserve | garder (O.-L. n° 10/001, art. 59 bis, 74 bis) ; monnaie électronique, prélèvement et effet de commerce, question posée |
| 36 · écart de règlement | en charge ou en produit sous le seuil | en charge seulement (remise d'un reste client, renonciation au trop-payé fournisseur) ; trop-perçu d'un client et fournisseur payé en moins refusés | garder (Code civil, Livre III, art. 132, 133, 142, 252) |
| 37 · virement depuis un compte en devise | ordre dans la devise du compte | la devise du RIB du journal est celle de l'ordre, chaque ligne réglée dans cette monnaie, les pièces en francs | garder (loi n° 23/053, art. 141, 1° vise la tenue, D1) ; salaires en francs |
| 39 · effets de commerce | LCR, BOR, fichiers CFONB | circuit comptable seul (acceptation, remise, escompte, impayé, à payer), l'échéance date le règlement pour la TVA ; au SYCEBNL, effets à payer seuls | garder (D11, D13 ; décret n° 011/42, art. 57, al. 2) |
| 40 · remises en banque | bordereau de remise | réception, bordereau, avis de crédit et impayé par le 51, impayé au 413 | garder (fiche du compte 51 des deux plans, D12) |
| 45 · extraits bancaires | relevé intégré et édité | le relevé reçu fait foi, l'édition d'OmegaX est une reconstitution datée, non numérotée | garder (AUDCIF art. 22, 7° ; art. 24, D14) |
| 46 · conditions bancaires | échelle d'intérêts et agios calculés | conditions recopiées de la convention et versionnées, aucun agio calculé ; autorisation lue comme un engagement hors bilan, dépassement dit | garder (le relevé ne porte pas les dates de valeur, D15) |
| 47 · placements et OPCVM | C.U.M.P. et révision des taux | P.E.P.S. en micro-parts, revue à la clôture seule par l'écart avec la dépréciation en place, intérêts régularisés à la clôture et contre-passés | garder (AUDCIF Titre VIII ch. 13, D16) ; C.U.M.P. et révision du taux non servis |
