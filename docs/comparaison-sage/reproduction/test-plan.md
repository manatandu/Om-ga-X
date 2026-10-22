# Plan d'essais · les fonctions reproduites des lignes sage-l1, sage-l4, sage-l5

Construction : `main` à `a503f49` (les trois lignes intégrées et déployées) ·
Date : 2026-10-15 · Banc : base PostgreSQL jetable, serveur compilé, client
servi en relayant `/api` (CLAUDE.md § 10), Chromium ; WebKit par le
portillon `tests-navigateur.yml` de `main`.

Les flux sont les fonctions de la carte (`recon.md`), numérotées comme elle ·
F11, F12… Un cas porte le flux, son type (H parcours nominal, E cas limite,
N refus) et son rang. La colonne « essai » dit ce qui l'éprouve ·
`e2e` un test navigateur de `e2e/tests/`, `unit` une suite Jest ou Vitest,
`sonde` les essais de bords de `sage-parite-bords.e2e.ts`, `structure` un
spec qui relit le dépôt entier (il vaut pour toute route nouvelle).

## Ce qui a tourné

| Jeu | Cas | Réussis | Échoués |
|---|---|---|---|
| Tests navigateur des trois lignes (`sage-l1-*`, `sage-l4-*`, `sage-l5-*`), Chromium et WebKit, run de `a503f49` | 21 tests × 2 moteurs | 42 | 0 |
| Suite navigateur entière, même run | 226 | 226 | 0 |
| Suites unitaires NOUVELLES des trois lignes (30 serveur, 13 client) | 408 | 408 | 0 |
| Suite serveur entière (six tranches, avant la poussée de L1) | 12 834 | 12 832 | 2 (`double-regard.spec`, doublure sans `ecriture.count`) · corrigée, le fichier rejoué 14 sur 14 avant la poussée |
| Sonde des bords (`sage-parite-bords.e2e.ts`, Chromium) | 3 tests · 10 gestes croisés, 7 saisies aux bornes, 3 doubles envois, 3 refus de simulation | 23 | 0 |
| Sonde jetable du double lettrage (retirée, voir B-PAR-01) | 3 envois concurrents | 3 premiers | 3 en 500 |

Non joués, et dit · le balayage d'accessibilité axe (`@axe-core/playwright`
n'est pas une dépendance de `e2e/`, l'ajouter est une construction) ; le
réseau lent ou coupé ; deux onglets ouverts sur le même geste (le double
envoi l'approche par l'API) ; la largeur de téléphone des fenêtres
NOUVELLES (`chrome-etroit.spec.ts` ne tient que les menus).

## Les cas

| cas | flux | type | ce qui est fait | attendu | essai | résultat |
|---|---|---|---|---|---|---|
| F11-H1 | Masquer les totaux | nominal | cocher « Masquer les totaux » dans la saisie, recharger | totaux masqués, équilibre de la pièce visible, choix retenu par le poste | e2e `sage-l1-totaux` | passé |
| F11-E1 | | bord · rechargement | recharger au milieu de la saisie | la préférence revient | e2e `sage-l1-totaux` | passé |
| F12-H1 | Journal de situation | nominal | saisir dans un journal SITUATION | statut SITUATION, hors balance, montré « S » à l'état des journaux | e2e `sage-l1-situation` | passé |
| F12-N1 | | refus · valider | valider une simulation | refus nommé | e2e `sage-l1-situation` | passé |
| F12-N2 | | refus · clôturer | clôture totale du journal de situation | « ne se clôture pas » | e2e `sage-l1-situation` | passé |
| F12-N3 | | refus · lettrer par l'API | lettrer deux lignes de simulation | 400 | sonde | passé |
| F12-N4 | | refus · faire naître un bien | créer un bien depuis une ligne de simulation | absente de la liste, 4xx | sonde | passé |
| F12-N5 | | refus · transfert entrant | transférer une écriture ordinaire DANS le journal de situation | 4xx | sonde | passé |
| F12-E1 | | bord · toute lecture | chaque lecture des écritures pose un statut | filet sur tout `src/` | structure `lectures-hors-situation.spec` | passé |
| F12-E2 | | bord · hérité | brouillard d'avant la règle, transfert dans un journal ordinaire | validable après transfert, lettrage gardé | unit `transfert-situation`, e2e écran | passé |
| F14-H1 | Compte créé en saisie | nominal | option ouverte, numéro inconnu tapé | proposé en sous-compte, créé personnalisé | e2e `sage-l1-compte-en-saisie` | passé |
| F14-N1 | | refus · option fermée | même numéro sans l'option | rien n'est proposé | e2e `sage-l1-compte-en-saisie` | passé |
| F14-N2 | | refus · hors plan, sous un collectif | numéro sans racine, sous un collectif de tiers | refus nommés | unit `compte-en-saisie` | passé |
| F16-H1 | Lettre choisie | nominal | taper « k » au lettrage | groupe K, suivante proposée L | e2e `sage-l1-lettre` | passé |
| F16-N1 | | refus · déjà prise | reprendre K sur un autre couple | refus qui nomme la lettre | e2e `sage-l1-lettre` | passé |
| F16-E1 | | bord · format | « é », « ABCDE », « 1 », « A B » | 400 chacun | sonde | passé |
| F16-E2 | | bord · double envoi | deux lettrages à la fois, même lettre ou lettre proposée | un posé, l'autre refusé et nommé | sonde jetable | **échoué · B-PAR-01** |
| F18-H1 | Mode assistant (compte, journal) | nominal | un compte puis deux journaux, création enchaînée | créés, la boîte reste ouverte | e2e `sage-l1-assistant` | passé |
| F18-H2 | Mode assistant (bien) | nominal | huit étapes, puis un second enchaîné | deux fiches, série gardée | e2e `sage-l4-assistant` | passé |
| F18-E1 | | bord · clavier | Entrée avance, le focus suit l'étape, montant tapé avec espaces | lu | unit `assistant-bien`, `assistant-creation` | passé |
| F19-H1 | Séquences de saisie | nominal | une séquence range un modèle | la saisie propose par séquence | e2e `sage-l1-sequences` | passé |
| F19-E1 | | bord · longueur et accents | 35 « é », 36 « é », blanc seul | 200, 400, 400 | sonde | passé |
| F19-E2 | | bord · double envoi | trois créations à la fois | trois rangs distincts | sonde | passé |
| F19-N1 | | refus · autre dossier | renommer, retirer la séquence d'un autre dossier | 4xx, rien ne bouge | sonde | passé |
| F60-H1 | Journal imprimé | nominal | option de refus, impression, clôture | clôture attend l'impression, impression numérotée | e2e `sage-l1-impression` | passé |
| F60-E1 | | bord · double envoi | deux impressions à la fois | numéros 1 et 2 | sonde | passé |
| F60-N1 | | refus · autre dossier | imprimer un journal ou un exercice d'un autre dossier | 4xx | sonde | passé |
| F66-H1 | Fiche · modifier, dupliquer, supprimer | nominal | au brouillard, puis validée | retouche en place, puis figée | e2e `sage-l4-fiche` | passé |
| F66-N1 | | refus · autre dossier | lire la duplication, modifier, supprimer un bien d'un autre dossier | 404, le bien garde sa désignation | sonde | passé |
| F67-H1 | Annuler un traitement | nominal | annuler la dotation au brouillard | écriture retirée | e2e `sage-l4-annulation` | passé |
| F67-N1 | | refus · lu par plus récent | annuler la dotation qu'une dépréciation a lue | refus « à partir du plus récent » | e2e `sage-l4-annulation` | passé |
| F67-N2 | | refus · autre dossier | lire les traitements d'un bien d'un autre dossier | 404 | sonde | passé |
| F68-H1 | Créer les biens depuis les écritures | nominal | ligne validée, fiche sans écriture | brut inchangé, se retire en laissant l'écriture | e2e `sage-l4-depuis-ecritures` | passé |
| F68-E1 | | bord · premier jour | pièce OD du premier jour de l'exercice | confirmation exigée (bien repris ?) | unit, constaté par la sonde | passé |
| F68-E2 | | bord · double envoi | la même ligne deux fois à la fois | un bien, l'autre 4xx | sonde | passé |
| F68-N1 | | refus · autre dossier | ligne d'un autre dossier | 4xx, absente de la liste | sonde | passé |
| F73-H1 | Renumérotation, maintenance | nominal | aperçu, renumérotation, maintenance | écart du registre nommé, numéros suivis | e2e `sage-l4-maintenance` | passé |
| F75-H1 | Paiement des salaires | nominal | RIB et mode, virement et espèces, annulation en négatif | 422 soldé, négatif inscrit | e2e `sage-l5-paiement` (deux référentiels) | passé |
| F78-H1 | Absences, arrêts, heures | nominal | absences, indemnité de la Caisse, majorations | proposition du mois reprise au bulletin | e2e `sage-l5-absences`, `-arrets`, `-heures` | passé |
| F79-H1 | Congés acquis | nominal | acquis par bulletin, posés, portés, libérés | compteur juste | e2e `sage-l5-conges` | passé |
| F85-H1 | Questionnaire | nominal | réponses écrites, valeur gardée | rien de deviné, rien d'effacé | e2e `sage-l5-questionnaire` | passé |
| F88-H1 | Ventilation analytique | nominal | répartition par salarié, à travers la clôture | parts au centime | e2e `sage-l5-ventilation` | passé |
| F37-H1 | Ordre de virement en devise | nominal | RIB du journal en USD, facture en USD réglée en USD, clôture, second ordre en N+1 | ordre en USD, contrevaleur en francs, numéro suivi, avis en USD | e2e `sage-l3-virement-devise` | passé |
| F37-N1 | | refus · RIB sans devise | ligne en USD sur un RIB sans devise | refus avant toute pièce, issue nommée (devise du RIB) | e2e `sage-l3-virement-devise`, unit `ribs-tiers.spec` | passé |
| F37-N2 | | refus · francs sur RIB en devise | facture en francs réglée depuis un RIB en USD | refus nommé, règle d'avant la ligne | e2e `sage-l3-virement-devise` | passé |
| F37-N3 | | refus · salaires | ordre de paiement des salaires depuis un RIB en USD | refus nommé (`motifRefusDeviseDonneur`) | unit `ribs-tiers.spec`, `ordres-virement.spec` | passé |
| TOUS-N1 | toutes routes d'écriture | refus · rôle | POST, PUT, PATCH, DELETE sans `@Roles` | aucune | structure `ecritures-reservees.spec`, `roles-cantonnes.spec` | passé |
| TOUS-N2 | toutes tables nouvelles | refus · dossier | lecture sans borne de dossier | refusée par la garde | structure `lecture-bornee.spec`, `index-du-dossier.spec` | passé |
| TOUS-E1 | toutes fenêtres | bord · rechargement | recharger une fenêtre qui lit | aucune exception (WebKit) | e2e, `rechargerAuRepos` | passé |
