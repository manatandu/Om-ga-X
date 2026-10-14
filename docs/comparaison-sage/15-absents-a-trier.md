# Absences à trier · liste consolidée des quatorze manuels

Liste demandée par Manasse le 2026-10-14. Elle reprend les 279 lignes
classées ABSENT dans les manuels 1 à 14 de cette comparaison, et les ramène
à 103 fonctions : une fonction absente que plusieurs manuels décrivent n'a
qu'une ligne ici, avec tous ses renvois. Un script a vérifié que chacune des
279 lignes est citée une fois, et une seule.

Les fonctions sont rangées par thème. La colonne « Aujourd'hui » dit en
quelques mots ce qu'OmegaX fait à la place, d'après la ligne d'origine, qui
donne le détail et la source.

**Tri de Manasse du 2026-10-14.** La colonne « Décision » porte les cases
qu'il a cochées sur la page de tri : 41 « À faire », 1 « Écarté » (la ligne
77) ; les 61 autres sont « Plus tard », qu'il les ait cochées ainsi ou
laissées vides (« garde ce que je n'ai coché pour plus tard »). Sa demande
« Execute ce que j'ai coché » lève le gel pour les 41 seules (CLAUDE.md, § 5 ;
`docs/plan-version-1.md`, § 9). Leur reproduction est conduite dans
`reproduction/`, une fonction à sa place, sans rien mélanger.

La colonne « Conseil du 2026-10-14 » garde l'avis donné le même jour avant
son tri, pour s'y retrouver plus tard. Il ne décide rien : là où le tri s'en
écarte, c'est le tri qui vaut.

Plusieurs absences tiennent à des règles ou normes françaises que nul texte
lu ne rend applicables en RDC (plus-values à court ou long terme, taxes
foncière et professionnelle, remise Dailly, SEPA, ETEBAC, AFB). Elles sont
gardées dans la liste pour être écartées en connaissance de cause.

« M4 A-18 » renvoie à la ligne 18 de la partie A du manuel 4, « M5-8 » à la
ligne 8 du manuel 5.

## Tenue courante : saisie, plan comptable, journaux

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 1 | Mode de règlement (chèque, virement, espèces) sur le tiers et en saisie ; codes interbancaires | M5-8, M6-19, M10-44, M13-31 | Le journal de trésorerie et la référence de la pièce en tiennent lieu ; rien n'est enregistré comme mode. | À faire | À faire. O.-L. n° 10/001, art. 59 bis : paiement par chèque, virement ou carte dès 1 000 000 FC entre assujettis, sinon perte du droit à déduction (art. 74 bis). Le texte demande un contrôle ; le compte de trésorerie (57, espèces) en dit déjà l'essentiel. |
| 2 | Échéance et mode de règlement obligatoires sur une ligne | M1-22 | L'échéance d'une ligne reste facultative. | Plus tard | Plus tard. |
| 3 | Échéance calculée d'office par le modèle de règlement du tiers ; fenêtre multi-échéance ; validation automatique des règlements | M3-14, M1-89, M1-46 | Le modèle de règlement se simule, aucune saisie ne l'applique ; l'échéance se saisit ligne par ligne. | À faire | À faire. La balance âgée, les relances et la NOTE 7 lisent l'échéance ; saisie à la main, elle manque ou se trompe sans bruit. |
| 4 | Statut « réglé » posé sur les écritures | M1-86, M11-37 | Une facture se dit réglée par son lettrage. | Plus tard | Écarter. Le lettrage dit déjà qu'une facture est réglée. |
| 5 | Abrégé, classement et raccourci des comptes, des tiers et des sections | M1-12, M1-34, M1-44, M1-64 | Aucun de ces champs. | Plus tard | Écarter. Confort sans enjeu comptable. |
| 6 | Date de création du compte | M1-6 | Le compte n'a pas de date de création. | Plus tard | Écarter. Confort sans enjeu comptable. |
| 7 | Compte reporting, plan reporting | M1-16, M2-9, M6-44 | Déjà noté faute de source le 2026-09-25. | Plus tard | Plus tard. |
| 8 | Message quand la nature du compte est inhabituelle pour le journal | M1-14 | Aucun contrôle. | Plus tard | Plus tard. |
| 9 | Curseur placé au débit ou au crédit selon la nature du compte | M1-76 | Aucun. | Plus tard | Plus tard. |
| 10 | Protection du numéro de pièce | M1-80 | Aucune. | Plus tard | Plus tard. |
| 11 | Masquer les totaux d'un journal | M1-82 | Les totaux s'affichent toujours. | À faire | Écarter. Confort sans enjeu comptable. |
| 12 | Journal de situation ni clôturable ni compactable | M1-77, M2-70 | Le type existe ; aucune règle ne l'écarte de la clôture. | À faire | À faire. À vérifier d'abord : si ses écritures passent à la clôture ou aux états, c'est un défaut silencieux, corrigeable même sous le gel. |
| 13 | Clic droit sur un compte ; interroger le compte depuis la saisie (double-clic) | M1-4, M1-95 | Aucun menu contextuel ; le double-clic n'existe que sur la grille des journaux. | Plus tard | Plus tard. |
| 14 | Créer un compte pendant la saisie | M10-17 | La grille renvoie au Plan comptable (comptes personnalisés). | À faire | Écarter. Contraire à la décision du 2026-10-09 : les comptes se personnalisent dans le Plan comptable. |
| 15 | Créer un modèle de saisie depuis la pièce en cours | M10-97 | Les modèles se créent dans leur propre fenêtre. | Plus tard | Plus tard. |
| 16 | Changer à la main la prochaine lettre de lettrage | M3-19 | La lettre est attribuée par le programme. | À faire | Écarter. Confort sans enjeu comptable. |
| 17 | Choisir les colonnes des listes et de la saisie | M3-34, M6-18, M10-15, M14-33 | Colonnes fixes. | Plus tard | Plus tard. |
| 18 | Mode assistant : création guidée d'un compte, d'un journal, d'un bien, d'un règlement ; création enchaînée | M2-8, M3-5, M4 B-42, M5-17, M14-13 | Un formulaire par objet. | À faire | Écarter. Confort sans enjeu comptable. |
| 19 | Séquences de saisie | M6-142 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 20 | Motifs de rectification en table | M6-77 | Aucune table ; les gestes qui corrigent exigent leur motif écrit. | Plus tard | Écarter. Le motif écrit exigé suffit. |

## Champs libres, bloc-notes et documents

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 21 | Bloc-notes et informations libres (texte, montant, date, table) des comptes, sections, tiers, biens et salariés ; champs statistiques ; leur recalcul | M1-18, M1-57, M1-72, M4 B-14, M4 B-36, M6-17, M6-40, M6-71, M6-111, M6-118, M6-150, M7-39, M13-30, M13-42, M13-50 | Aucun champ libre ni statistique. | Plus tard | Plus tard. |
| 22 | Documents rattachés aux écritures, aux sections, aux biens et aux salariés | M6-74, M10-98, M6-76, M4 B-48, M7-37 | Seuls les tiers et les virements de fonds portent une pièce jointe. | À faire | À faire. AUDCIF art. 17, 3° exige des pièces classées et référencées, pas leur scan ; forte demande pratique. |

## Tiers, recouvrement et relances

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 23 | Contacts du tiers en nombre illimité | M1-40 | Un contact en texte. | Plus tard | Plus tard. |
| 24 | Qualité du tiers (société, indépendant…) | M1-36 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 25 | Devise et langue du tiers | M1-41, M1-42 | La devise se porte par ligne d'écriture. | Plus tard | Plus tard. |
| 26 | Volet Complément : représentant, tiers payeur ou encaisseur, non soumis aux pénalités | M1-51, M10-101 | Le tiers porte type, nom, adresse, contact, exclusion des relances et modèle de règlement. | Plus tard | Plus tard. |
| 27 | Modèles d'impression propres au tiers (extrait, règlement, rappel) | M1-55, M6-46 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |
| 28 | Cumuls mensuels sur la fiche du tiers | M1-56 | La balance auxiliaire et l'évolution des soldes existent ailleurs. | Plus tard | Écarter. La balance auxiliaire donne les cumuls. |
| 29 | Statistiques des tiers : chiffre d'affaires, croissance, délai moyen de règlement | M1-140, M10-59 | Aucune. | Plus tard | Plus tard. |
| 30 | Codes risque, encours maximum, assurance crédit, solvabilité et surveillance du client | M6-27, M10-102, M13-47, M14-27 | Les échus se lisent à la balance âgée ; ni encours ni code risque. | Plus tard | Plus tard. |
| 31 | Lieux de livraison des clients | M6-52 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |
| 32 | Duplication d'un tiers | M13-49 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 33 | Recouvrement : pénalités de retard, frais d'impayés, décalage d'échéance, exclusion d'une seule écriture, dossiers et scénarios, état des dossiers | M1-113, M1-116, M1-156, M6-15, M6-35, M10-51, M10-54, M10-61 | Relances par niveau ; l'exclusion porte sur le tiers entier. | Plus tard | Plus tard. |
| 34 | Alertes sur les échéances proches des tiers | M13-7 | Le tableau de bord n'annonce que les échéances fiscales et sociales. | Plus tard | Plus tard. |
| 35 | Avis de règlement adressés aux tiers ; règlements transmis par messagerie | M5-41, M1-121 | Le courrier ne sert qu'aux relances. | Plus tard | Plus tard. |

## Règlements, banque et trésorerie

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 36 | Écart de règlement passé en charge ou en produit sous un seuil ; escompte financier | M10-84, M13-18, M6-135, M13-21, M13-77 | Un paiement inférieur au dû reste partiel, un paiement supérieur est refusé. | À faire | À faire. La fiche du compte 40 nomme l'escompte obtenu (crédit du 773) ; le seuil d'écart est une convention du cabinet. |
| 37 | Virements internationaux, ordre de virement depuis un compte en devise | M5-42, M13-72 | L'ordre ne s'émet que depuis un compte en francs. | À faire | À faire. Revient sur un refus posé : la loi n° 23/053, art. 141, 1° fixe l'unité de la comptabilité, pas la monnaie du compte bancaire. La plupart des ONG paient en USD. |
| 38 | Prélèvements (lots, émetteur, SEPA) | M5-7, M5-26, M5-44, M13-1, M13-27, M13-66 | Aucun prélèvement. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |
| 39 | Effets de commerce : LCR, effets à vue, bons à payer et leur circuit ; journaux d'escompte et d'encaissement | M5-24, M5-47, M13-6, M13-12, M13-67, M14-19, M6-38, M6-128 | Aucun effet de commerce. | À faire | À Manasse : choix commercial, aucun texte ne tranche. |
| 40 | Remises de chèques et de cartes bancaires, types de remise, modèles de bordereaux | M5-43, M5-46, M13-62, M5-21 | Le chèque reçu se saisit au journal ; la seule remise est l'ordre de virement imprimé. | À faire | À Manasse : choix commercial, aucun texte ne tranche. |
| 41 | Communication avec les banques : fichiers de remise, ETEBAC, EBICS, Internet, AFB, téléchargement, Telbac, journal des communications, multi-sociétés | M5-11, M5-12, M5-13, M5-22, M5-32, M5-33, M5-34, M5-36, M5-37, M6-25, M6-132, M13-3, M13-13, M13-41, M13-54, M13-55, M13-75, M13-87, M13-88, M13-92 | OmegaX ne communique pas avec les banques ; le relevé s'importe en CSV ou XLSX. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |
| 42 | Délais et heures limites de remise, calendrier bancaire, virement urgent | M5-49, M5-50, M13-36 | Aucune date de remise n'est calculée. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |
| 43 | Remise Dailly (cession de créances de droit français) | M13-74 | Non lue pour la RDC. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |
| 44 | Enrichissement automatique des données bancaires des tiers | M13-4 | RIB saisis un à un par l'administrateur. | Plus tard | Écarter. Les RIB restent à l'administrateur seul, contre la fraude. |
| 45 | Édition chaînée des extraits | M13-10 | Pas de liste des extraits. | À faire | Écarter. Confort sans enjeu comptable. |
| 46 | Conditions bancaires par RIB, autorisations de financement, unions de comptes | M6-58, M6-136 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 47 | Trésorerie : taux de référence, financements, placements, OPCVM | M6-129, M6-137, M6-139 | Les intérêts courus d'un emprunt se déclarent sans taux. | À faire | Écarter. Confort sans enjeu comptable. |

## Analytique et budgets

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 48 | Grille analytique rattachée au compte (modèles de grille) | M1-19, M13-60 | Les clés de répartition répartissent une section sur d'autres. | Plus tard | Plus tard. |
| 49 | Niveaux d'analyse ; report à-nouveau des sections | M1-65, M1-69 | Seuls les budgets des sections se reportent. | Plus tard | Plus tard. |
| 50 | Longueur fixe des codes de section | M14-5 | Codes de longueur libre. | À faire | À faire. « 1 » absorbe « 10 » dans les rubriques budgétaires, en silence. |
| 51 | Budget par compte général ; postes budgétaires ; prévision faible ou forte ; comparaison avec N-1 ; devise d'édition | M1-29, M10-79, M2-54, M2-57, M2-59 | Budgets par section analytique seulement. | Plus tard | Plus tard. |
| 52 | Journal analytique ; grand livre analytique avec les écritures non ventilées ; quantités et prix moyen | M1-141, M2-46, M2-51, M2-49 | Balance, grand livre par section, contrôle des cumuls. | Plus tard | Plus tard. |
| 53 | Filtres de la balance analytique (mouvementées, non soldées) | M2-48 | Plan, exercice et dates seulement. | Plus tard | Plus tard. |

## États et éditions

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 54 | Journal centralisé | M1-137, M10-106 | Le journal s'exporte pièce par pièce. | Plus tard | Écarter. AUDCIF art. 19 n'exige la centralisation que si le livre-journal ne reçoit que des totaux ; chez OmegaX il reçoit chaque écriture. |
| 55 | Journal général : synthèse par journal et par période | M2-28 | Aucune. | Plus tard | Écarter. AUDCIF art. 19, même raison que la ligne 54. |
| 56 | Grand livre en devise, paramétrable, avec ou sans les écritures lettrées, regroupé par mois | M2-31, M2-33, M2-35, M1-28 | Présentation du cabinet fixe ou livre à plat. | Plus tard | Plus tard. |
| 57 | Filtres de la balance des tiers (mouvementés, soldés, non soldés) | M2-45 | Aucun. | Plus tard | Plus tard. |
| 58 | Filtres du rapprochement (rapprochées ou non) | M2-60 | Aucun. | Plus tard | Plus tard. |
| 59 | Modèles d'édition, sauts de ligne ou de page, impression différée, sélections enregistrées | M2-34, M1-27, M1-50, M1-68, M10-62, M1-132, M8-57 | On imprime la fenêtre ; seul le choix de l'exercice est retenu. | À faire | Écarter. Confort sans enjeu comptable. |
| 60 | Journal marqué « imprimé » ; refus de clôturer un journal non imprimé | M2-67, M3-29 | L'impression n'est pas tracée. | À faire | Écarter. « Non imprimé » n'est pas servi (décision antérieure). |
| 61 | État de clôture | M10-70 | Aucun. | Plus tard | Plus tard. |
| 62 | Graphiques des données comptables | M11-1 | L'onglet Indicateurs rend des chiffres. | Plus tard | Plus tard. |
| 63 | Catalogue d'états par métier, filtres, indicateurs personnalisables, alertes d'évolution, requêteur, statistiques | M9-4, M9-5, M9-11, M9-12, M9-26, M9-28, M8-59, M8-60 | États rangés dans les menus ; indicateurs en liste fixe. | Plus tard | Écarter. Les états personnalisés existent. |

## Révision

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 64 | Registre de révision par écriture, filtres de révision | M6-23, M6-29, M10-93 | La révision passe par le questionnaire et le dossier de révision. | Plus tard | Plus tard. |

## Immobilisations

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 65 | Quantité d'un bien, fractionnement, cession d'une partie des unités | M4 A-18, M4 A-19, M4 A-24, M4 B-59 | Le bien est une unité ; il sort en entier. | Plus tard | Plus tard. |
| 66 | Modifier, supprimer ou dupliquer une fiche | M4 B-41 | Seuls le lieu, la mise en service et la réserve de propriété se posent après la création. | À faire | À faire. Une faute de frappe sur une fiche ne se corrige pas aujourd'hui. |
| 67 | Annuler une dotation ou un traitement (inventaire, révision, réévaluation, dérogatoire) | M4 B-54, M4 B-56 | Chaque geste retient son écriture ; aucune route ne le retire. | À faire | À faire. AUDCIF art. 20, inscription en négatif ; une dotation fausse n'a aujourd'hui aucune issue. |
| 68 | Créer les biens à partir des écritures déjà passées | M4 B-58 | Le bien naît dans le module ; ce qui est passé hors module est signalé. | À faire | À faire. Cas courant de la reprise d'un dossier. |
| 69 | Sortie globale de plusieurs biens | M4 B-65 | Bien par bien. | Plus tard | Plus tard. |
| 70 | Analytique des biens | M4 B-16, M4 B-81, M6-119 | Ni famille ni fiche ne portent de section. | Plus tard | Plus tard. |
| 71 | Codes-barres, numéros de série, étiquettes | M4 B-46, M4 B-87, M6-127 | Aucun. | Plus tard | Plus tard. |
| 72 | Simulation des dotations futures | M4 B-85 | Seul le plan fiscal dégressif se montre en entier. | Plus tard | Plus tard. |
| 73 | Fusion de fichiers d'immobilisations, renumérotation, maintenance | M4 B-35 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 74 | Règles françaises : IR ou IS et plus-values à court ou long terme, taxe professionnelle, taxe foncière, taxe sur les véhicules, TVA à reverser à la sortie d'un immeuble | M4 B-19, M4 B-20, M4 B-61 | Non lues pour la RDC. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |

## Paie

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 75 | Banques et mode de paiement du salarié ; paiement des salaires (ordres, virements, chèques, billetage) | M7-9, M7-28, M6-151, M7-60 | Le net va au 422 ; son paiement se saisit en trésorerie. | À faire | À faire. Paiement des salaires par virement groupé. |
| 76 | Compte individuel du salarié sous le collectif | M6-171, M7-76 | Le net va au 422 global. | Plus tard | Plus tard. |
| 77 | Adresses du salarié | M6-161 | Aucune. | Écarté | Écarter. Confort ; l'art. 212 du Code du travail n'exige pas l'adresse du salarié. |
| 78 | Temps de travail : heures, absences, arrêts et indemnités journalières, gestion des temps, assistant de préparation | M7-10, M7-49, M7-51, M7-56, M7-77 | Les éléments se saisissent en montant, sous leur nature. | À faire | À faire. Code du travail art. 119 (majoration des heures supplémentaires) et art. 124 (nuit) ; les taux relèvent d'un arrêté (art. 120, e), à chercher au corpus avant de chiffrer. |
| 79 | Congés acquis chaque mois | M7-32 | Le congé n'est calculé qu'au décompte final. | À faire | À faire. Code du travail art. 141 et 142 : l'allocation de congé est due pendant le contrat, pas seulement au décompte final. |
| 80 | Prime d'ancienneté par tranches | M7-52 | Aucune. | Plus tard | Plus tard. |
| 81 | Alertes, calendrier et événements datés (fins d'essai, de CDD, visites médicales…) | M7-13, M7-74, M6-158 | Le contrat est jugé quand on le consulte ; aucune alerte datée. | Plus tard | Plus tard. |
| 82 | Import, purge, réinitialisation ; multi-sociétés | M7-17, M7-18, M7-19 | Chaque dossier tient sa paie. | Plus tard | Plus tard. |
| 83 | Conventions collectives | M7-22, M6-152 | Hors corpus ; catégorie libre à côté de la classe du décret n° 25/22. | Plus tard | Écarter. Hors corpus ; à reprendre si une convention collective est fournie. |
| 84 | Contrats sociaux (prévoyance, mutuelle) | M7-24 | Aucun. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |
| 85 | Questionnaire société et salarié | M7-26 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |
| 86 | Compétences, formation, carrières | M7-34 | Aucune. | Plus tard | Écarter. Confort sans enjeu comptable. |
| 87 | Modification en masse, rappel de salaires | M7-55 | Aucune. | Plus tard | Plus tard. |
| 88 | Ventilation analytique de la paie, pointages | M7-63, M6-149 | Aucune. | À faire | À faire. Salaires imputés aux projets des bailleurs. |
| 89 | Fiche individuelle, cumuls par rubrique, états personnalisés, export Excel | M7-66, M7-72, M7-73 | Le bulletin seul. | Plus tard | Plus tard. |

## Gestion commerciale (absente en bloc)

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 90 | Paramètres commerciaux, statistiques des articles, gammes, tarifs, remises, périodicités et livraisons, agenda, abonnements commerciaux, caisse de comptoir, site marchand, documents internes, codes-barres, fabrication et affaires, fournisseurs des articles, glossaires, catalogue et commissions | M6-78, M6-79, M6-82, M6-83, M6-85, M6-86, M6-88, M6-89, M6-90, M6-91, M6-92, M6-93, M6-94, M6-95, M6-98, M6-99, M6-100 | OmegaX ne tient pas de gestion commerciale ; facturation et devis seulement. | À faire | À Manasse : choix commercial, aucun texte ne tranche. |
| 91 | Collaborateurs et leurs rôles commerciaux | M6-73 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |
| 92 | Facture électronique, échanges électroniques | M6-37 | OmegaX n'est pas homologué (décret n° 23/10, art. 22). | Plus tard | À Manasse : choix commercial, aucun texte ne tranche. |
| 93 | Vue interactive et simulateur commerciaux ; code taxe et taxe non perçue | M9-17, M12-24 | Sans objet sans gestion commerciale. | Plus tard | Écarter. Sans objet sans gestion commerciale. |
| 94 | Modes d'arrondi | M6-81 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |

## Dossier, interface et administration

| # | Fonction absente | Manuels | Aujourd'hui | Décision | Conseil du 2026-10-14 |
|---|---|---|---|---|---|
| 95 | Utilisateurs connectés, messagerie interne, lecture des cumuls du module | M4 B-31, M13-37 | Aucun. | À faire | Écarter. Confort sans enjeu comptable. |
| 96 | Langue de l'application | M8-25 | Français seulement. | À faire | À Manasse : choix commercial, aucun texte ne tranche. |
| 97 | Aller à une fonction par son nom (F7) ; raccourci vers le tiers suivant (Ctrl+J) | M8-7, M12-18 | Aucun. | Plus tard | Plus tard. |
| 98 | Dossier de copie ; remise à zéro d'un dossier de test | M8-19, M8-30 | Une cellule prend le référentiel du siège, pas ses données. | Plus tard | Plus tard. |
| 99 | Export des seules modifications depuis le dernier export | M8-38 | Exports complets. | À faire | Écarter. Confort sans enjeu comptable. |
| 100 | Personnalisation des écrans, éditeur de formules, workflow de notification | M8-40, M8-45, M8-56, M8-61 | Aucune. | À faire | Écarter. Confort sans enjeu comptable. |
| 101 | Organisation du cabinet en niveaux, collaborateurs rattachés | M6-165 | Un dossier est une entité ; l'éditeur voit la liste des cabinets, sans leurs données. | À faire | À Manasse : choix commercial, aucun texte ne tranche. |
| 102 | Écritures échangées avec l'expert-comptable, journaux synchronisés | M10-88 | Aucun échange. | À faire | Écarter. Confort sans enjeu comptable. |
| 103 | Pays en table (zone SEPA, codes ISO) | M6-68, M6-169 | Le pays est un texte libre. | Plus tard | Écarter. Norme ou circuit français sans équivalent lu en RDC. |

## Décompte

103 fonctions absentes, issues de 279 lignes ABSENT. Par thème :

- Tenue courante : saisie, plan comptable, journaux : 20
- Champs libres, bloc-notes et documents : 2
- Tiers, recouvrement et relances : 13
- Règlements, banque et trésorerie : 12
- Analytique et budgets : 6
- États et éditions : 10
- Révision : 1
- Immobilisations : 10
- Paie : 15
- Gestion commerciale (absente en bloc) : 5
- Dossier, interface et administration : 9

## Tri du 2026-10-14

- À faire : 41 (1, 3, 11, 12, 14, 16, 18, 19, 22, 24, 27, 31, 32, 36, 37,
  39, 40, 45, 46, 47, 50, 59, 60, 66, 67, 68, 73, 75, 78, 79, 85, 88, 90,
  91, 94, 95, 96, 99, 100, 101, 102).
- Écarté : 1 (77).
- Plus tard : 61, toutes les autres lignes.
