# Parité · les 41 absences de Sage cochées « À faire »

Mesuré le 2026-10-15 sur `main` (`a503f49`), après l'intégration des lignes
sage-l4, sage-l5 et sage-l1, puis recompté à l'intégration de sage-l2 (même
barème, même fichier), par l'outil de la compétence de réplication
(`parity.py`, pondération must 3, should 2, could 1, partiel compté pour
moitié) sur `features.csv` · colonnes relues sous les noms qu'il attend
(ligne en domaine, fonction, priorité, clone, note), rien d'autre changé.

## Le score

**Parité fonctionnelle · 58,6 sur 100.** 41 fonctions comptées, **10 des 14
« must » faites** (39,2 et 7 avant sage-l2).

| Ligne | Fonctions | Score | État |
|---|---|---|---|
| L1 · saisie | 6 | 100 | intégrée le 2026-10-15 |
| L4 · immobilisations | 4 | 90,9 | intégrée le 2026-10-14 (fusion d'un autre dossier non servie, n° 73) |
| L5 · paie | 5 | 89,3 | intégrée le 2026-10-15 (feuilles de temps et compteurs libres non repris, n° 78) |
| L1 L2 L4 · mode assistant (n° 18) | 1 | 100 | compte, journal, bien et règlement guidés |
| L2 · tiers et règlements | 7 | 100 | intégrée le 2026-10-15 (monnaie électronique, prélèvement et effet de commerce face à l'art. 59 bis, question posée) |
| L3 · banque et trésorerie | 6 | 0 | non commencée |
| L6 · documents et analytique | 2 | 0 | non commencée |
| L7 · éditions et exports | 2 | 0 | non commencée |
| L8 · gestion commerciale | 3 | 0 | non commencée |
| L9 · cabinet et plateforme | 5 | 0 | non commencée |

Les quatre lignes faites sont à 89 à 100 % chacune ; tout l'écart tient aux
cinq lignes que la décision du 2026-10-15 (« finir les trois lignes en cours
puis s'arrêter ») a laissées en attente.

**Disposition des écrans · non mesurée.** La comparaison par carte des bords
demande deux captures dans le même état, à la même taille. Celles de Sage
sont des pages de manuels scannés, pas des écrans du logiciel en marche, et
la disposition d'OmegaX suit le rendu de Sage Active aux couleurs de la
charte (CLAUDE.md § 9 ter) · un score fabriqué sur ces images ne dirait
rien. La parité qui compte ici est la fonction.

## Ce qui reste, dans l'ordre de construction

Les « must » d'abord.

1. L3 · n° 37, virements internationaux, ordre depuis un compte en devise.
2. L6 · n° 22, documents rattachés aux écritures, sections, biens, salariés.
3. L6 · n° 50, longueur fixe des codes de section.
4. L5 · n° 78, reste partiel (feuilles de temps, compteurs libres · aucun texte ne les régit).

Puis les « should » · L3 (39, 40, 45, 46, 47), L7 (59, 99), L8 (91, 94), L9
(95, 101, 102) et la fusion du n° 73 ; enfin les « could » · L8 (90), L9
(96, 100).

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

## Défauts ouverts

Aucun S1 ni S2. **B-PAR-01 (S3)** · deux lettrages envoyés en même temps
sur un même compte, le second rend une 500 (`bugs.md`), défaut antérieur
aux lignes, noté au suivi sous le gel.

## Verdict

**Pas encore à parité.** Au barème de la compétence, quatre « must »
manquent · trois dans les lignes en attente (L3, L6) et le reste partiel du
n° 78. Les quatre lignes construites tiennent leurs fonctions, éprouvées sur
vraie base, sans défaut S1 ni S2.

Les suivantes à construire, si la reprise est décidée · L3 n° 37, puis L6
n° 22 et n° 50.
