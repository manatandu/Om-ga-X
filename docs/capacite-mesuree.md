# Capacité réelle d'OmegaX · mesures du 3 septembre 2026

Jusqu'ici la capacité du logiciel était une estimation. Elle est maintenant
mesurée. Ce document dit comment, avec quels chiffres, et ce qui en découle.

## Le banc d'essai

- PostgreSQL 16 local, base neuve, les 58 migrations appliquées.
- Un dossier SYCEBNL, plan de comptes complet, **500 000 écritures** et
  **1 000 000 de lignes**, réparties sur 365 jours et 400 comptes d'imputation.
- Le serveur lancé avec `--max-old-space-size=460`, soit **la taille de tas
  d'un conteneur Cloud Run à 512 Mio**, celle de la production. Mesurer sur une
  machine de développement à 8 Gio n'aurait rien prouvé.
- Mesures par requêtes HTTP réelles, session ouverte, sérialisation comprise.

## Ce que pèse un dossier

| | |
|---|---|
| 500 000 écritures + 1 000 000 de lignes | **504 Mo** de base |
| dont données | 288 Mo |
| dont index | 205 Mo |
| par écriture (2 lignes, tout compris) | **~1 Ko** |

Un dossier d'ASBL ordinaire (disons 20 000 écritures par exercice) pèse donc
environ **20 Mo par exercice**. Le stockage n'est pas le sujet.

## Ce qui tient, et ce qui tombait

| Fenêtre | Temps | Verdict |
|---|---|---|
| Balance, tous comptes | 0,52 s | tient |
| Bilan | 0,52 s | tient |
| Compte de résultat | 0,50 s | tient |
| Tableau des flux de trésorerie | 0,51 s | tient |
| Grand livre d'UN compte (2 500 lignes) | 0,59 s | tient |
| Balance âgée | 6,7 s | lent, mais tient |
| Journal, 15 jours (41 000 lignes) | 6,2 s, 44 Mo de JSON | à la limite |
| Journal, 45 jours (123 000 lignes) | · | **serveur mort** |
| Grand livre complet | · | **serveur mort** |
| Liasse complète Excel | 61 s | **serveur mort** |

« Mort » se lit littéralement : `JavaScript heap out of memory`, le processus
s'arrête, et il emporte tous les autres dossiers servis par la même instance.
Cloud Run redémarre, mais toute requête en cours est perdue.

## Ce que la mesure enseigne

**Le plafond n'est pas le volume du dossier, c'est le nombre de lignes qu'UNE
fenêtre réclame d'un coup.** Les états financiers sont agrégés par la base
(`groupBy`) : un million de lignes leur coûte une demi-seconde, et dix
millions leur en coûteraient à peine plus. Ce sont les écrans qui rapatrient
des lignes une à une qui tombent.

Aucun test ne pouvait le voir : une doublure Prisma rend dix lignes. C'est le
même angle mort que celui du 2026-09-02 (voir `CLAUDE.md` §5) · ce que le
logiciel fait pour de vrai ne se déduit pas de ce qu'il fait en test.

## Ce qui a été posé

- `PLAFOND_ECRITURES_PAR_FENETRE = 2000` · la fenêtre Journal ne rend jamais
  plus, même si personne ne demande de limite, et elle **dit** qu'elle tronque
  (`tronque`, `total`). Les totaux, eux, restent ceux du journal ENTIER, pris
  par un agrégat SQL · c'est aussi ce qu'affiche Sage en pied de fenêtre.
- `PLAFOND_LIGNES_GRAND_LIVRE = 20000` · au-delà, le grand livre complet est
  **refusé**, pas tronqué. Un écran de travail peut ne montrer qu'une tranche ;
  un livre obligatoire amputé en silence est un document faux (AUDCIF art. 22,
  6° · reconstitution du chemin de révision).

Vérifié sur le même banc après correction : journal sur l'exercice entier,
2,0 s, 2 000 écritures sur 500 000 annoncées comme telles, totaux justes,
serveur vivant à 223 Mo de RSS.

## La liasse complète · le coupable n'était pas celui qu'on croyait

La première hypothèse était ExcelJS, qui construit tout le classeur en
mémoire avant de l'envoyer. Elle était fausse : le classeur produit ne pèse
que 148 Ko.

Les vrais coupables étaient DEUX calculs de notes annexes, qui chargeaient en
mémoire l'exercice entier :

- `chargerVentilationParNature` · toutes les écritures avec toutes leurs
  lignes, pour ventiler les provisions au prorata des contreparties ;
- `chargerEcheances` · toutes les lignes non lettrées, pour les répartir en
  « à un an », « à deux ans », « au-delà ». Sur un dossier dont rien n'est
  encore lettré, ce filtre ne retire RIEN.

Les deux lisent désormais par tranches de 5 000, curseur sur l'identifiant.
L'algorithme n'a pas bougé · seul le chemin de lecture. Sur le même banc,
après correction :

| | avant | après |
|---|---|---|
| Notes annexes | serveur mort | **200 en 43 s**, RSS 292 Mo |
| Liasse complète Excel | serveur mort à 61 s | **200 en 48 s**, RSS 335 Mo, 148 Ko |

Quarante-huit secondes pour une liasse annuelle d'un million de lignes est
long mais tenable. Le temps restant est celui de la lecture ligne à ligne ;
il tomberait en poussant la ventilation des échéances dans un agrégat SQL,
ce qui n'a pas été fait ce soir pour ne pas risquer de changer un montant
sans son propre test.

## Le journal et le grand livre en flux (banc du 2026-09-12)

Les deux derniers exports bâtis entièrement en mémoire sont passés au
`WorkbookWriter`. Même machine, même tas de 460 Mio, même jeu de lignes :

| lignes | classeur en mémoire | en flux |
|---|---|---|
| 50 000 | 12,1 s · 693 Mo | 2,3 s · 137 Mo |
| 200 000 | mort (dépassement de tas) | 8,0 s · 246 Mo |
| 500 000 | mort | 19,6 s · 450 Mo |
| 1 000 000 | mort | 81 s · 784 Mo |

Deux options du `WorkbookWriter` ont été mesurées à part, à 500 000 lignes, et
elles ne se tranchent pas pareil :

- `useSharedStrings: true` fait passer la mémoire de 450 Mo à **1 195 Mo**. La
  table des chaînes partagées vit en mémoire jusqu'à la fin du classeur, ce qui
  défait exactement le bénéfice du flux. Elle reste à FAUX ;
- `useStyles: true` coûte du TEMPS (37,6 s contre 19,6 s) et presque rien en
  mémoire (443 Mo contre 450). Elle reste à VRAI, et ce n'est pas un confort :
  en flux, une ligne est scellée dès qu'elle est écrite, si bien qu'un `numFmt`
  posé après coup n'a aucun effet. Sans elle, les dates sortent en numéros de
  série et les montants sans séparateur.

`MAX_LIGNES_EXPORT` passe donc de 50 000 à **200 000**, dernière mesure qui
laisse la moitié du tas libre. La mesure porte sur UN export à la fois : deux
exports simultanés de cette taille sur une même instance ne sont couverts par
aucun chiffre de ce document.

## Les exports de la présentation du cabinet (banc du 2026-10-04, ligne FPM)

Une balance de **2 000 comptes** avec la feuille de chacun (son grand livre),
mesurée contre le grand livre à plat de `main`, sur les MÊMES lignes. Base
PostgreSQL jetable, serveur compilé lancé avec `--max-old-space-size=460`,
requêtes HTTP réelles, une à la fois, serveur redémarré avant chaque mesure.
Pic du tas V8 relevé par `--trace-gc`, pic de mémoire du processus par
`VmHWM`. Machine de développement à quatre cœurs PARTAGÉE avec d'autres
sessions (charge 3 à 4) · les durées sont gonflées, les mémoires non.

| export | lignes | durée | pic du tas V8 | pic du processus (RSS) |
|---|---|---|---|---|
| balance seule, 2 000 comptes | 2 000 | 0,4 s | · | 218 Mo |
| grand livre à plat (`main`) | 100 000 | 84 s | 107 Mo | 812 Mo |
| balance + 2 000 feuilles | 100 000 | 96 s | 117 Mo | 810 Mo |
| grand livre à plat (`main`) | 200 000 | 269 s | 105 Mo | 1 717 Mo |
| balance + 2 000 feuilles | 197 000 | 319 s | 126 Mo | 1 593 Mo |
| grand livre FPM, une feuille | 197 000 | 309 s | 104 Mo | 1 636 Mo |
| balance + feuilles, 202 000 lignes | · | 0,3 s | 83 Mo | refus 413 avant le premier octet |

Ce que la mesure dit :

- **Le nombre de feuilles ne pèse pas.** À lignes égales, deux mille feuilles
  coûtent ce que coûte une seule (810 contre 812 Mo, 1 593 contre 1 636 Mo). Un
  plafond sur le NOMBRE DE FEUILLES ne retirerait rien · il n'a pas été posé.
  Le plafond reste celui des LIGNES, `MAX_LIGNES_EXPORT`, compté balance
  comprise et refusé avant le premier octet, avec la « Balance seule » pour
  chemin de rechange.
- **Le tas V8 reste sous la moitié des 460 Mio** à 200 000 lignes (126 Mo au
  plus) · la marge du § 8 bis, telle qu'elle a été posée le 2026-09-12, tient.
- **LA MÉMOIRE DU PROCESSUS, ELLE, NE TIENT PAS, ET CE N'EST PAS NOUVEAU.** Le
  grand livre à plat de `main` monte à 812 Mo dès 100 000 lignes et à 1,7 Go à
  200 000, hors du tas (tampons de l'écrivain en flux et du moteur Prisma),
  quand le tableau du 2026-09-12 écrit 246 Mo à 200 000. Ce chiffre-là ne se
  retrouve pas sur ce banc · il mesurait vraisemblablement le tas seul. Sur un
  conteneur à 512 Mio, un export de 100 000 lignes dépasserait donc la mémoire
  du conteneur. Relevé ouvert, à trancher hors de la ligne FPM (mesure dans un
  conteneur borné à 512 Mio, puis plafond de lignes ou d'export concurrent
  revu) · la ligne FPM n'aggrave rien, elle hérite.

## Ce qui reste

Deux exports d'UN compte construisent encore leur classeur en mémoire · le
grand livre d'un compte et le justificatif de solde. Ils sont refusés au-delà
de 50 000 lignes, la dernière mesure qu'un classeur en mémoire a tenue (audit
final F101), et le refus renvoie au grand livre complet, écrit en flux. Ce qui
n'est pas mesuré, et qui le sera le jour où un dossier réel s'en approchera : le
comportement à plusieurs exports CONCURRENTS sur une même instance Cloud Run
(`--concurrency 80`), le seul cas où le plafond ci-dessus peut être franchi
sans que personne n'ait exporté 200 000 lignes.

## Refaire la mesure

Le banc se remonte en une dizaine de minutes : un PostgreSQL local, les
migrations, un dossier semé, puis les lignes engendrées par `generate_series`.
Il n'a pas été gardé dans le dépôt · un jeu d'un million de lignes n'a rien à
faire dans les tests, qui doivent rester rapides. À refaire avant toute reprise
d'un dossier volumineux, et après tout changement des écrans Journal, Grand
livre ou Exports.
