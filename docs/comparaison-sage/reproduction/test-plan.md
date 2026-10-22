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
| F40-H1 | Remises de chèques | nominal | type CHQ, deux chèques reçus (l'un lettré), bordereau imprimé, avis avec commission | 513 puis 514 soldés, 6315 à la commission, 52 au net, bordereau n° 1 | e2e `sage-l3-remises` | passé |
| F40-H2 | | clôture traversée | chèque de décembre remis en N, avis de crédit en janvier de N+1 | 514 reporté puis soldé dans N+1, aucun refus | e2e `sage-l3-remises` | passé |
| F40-H3 | | impayé | valeur créditée revenue impayée, puis annulation | 4131 débité puis rendu, statut rendu | e2e `sage-l3-remises`, unit `remises.service.spec` | passé |
| F40-N1 | | refus · cartes avec transit | type de cartes à compte de transit | refus nommé (515 jusqu'à l'avis) | e2e `sage-l3-remises`, unit `remise-en-banque.spec` | passé |
| F40-N2 | | refus · annulation après avis | annuler un bordereau crédité | refus nommé (annuler d'abord l'avis) | e2e `sage-l3-remises` | passé |
| F40-N3 | | refus · impayé hors 413 | compte d'impayé hors de la racine prescrite | refus nommé par référentiel | unit `remise-en-banque.spec` | passé |
| F40-E1 | | bord · arrondis | deux valeurs à demi-centime sur un bordereau | total = somme des lignes arrondies = écriture | unit `remises.service.spec` | passé |
| F40-N4 | | refus · impayé avant l'avis | valeur revenue impayée, puis avis de crédit du bordereau | refus nommé (annuler l'impayé, passer l'avis, redéclarer) | e2e `sage-l3-remises`, unit `remises.service.spec` | passé |
| F40-H4 | | clôture traversée · non remis | chèque reçu en décembre, non remis, N clôturé | proposé au bordereau de janvier avec son exercice d'origine, 513 reporté soldé | e2e `sage-l3-remises` | passé |
| F40-H5 | | clôture traversée · avis annulé | avis de janvier d'un bordereau de décembre, N clôturé | annulation admise (exercice de l'avis), 514 rendu, avis repassé | e2e `sage-l3-remises` | passé |
| F39-H1 | Effets de commerce | nominal · à recevoir | prestation de 1 000 000 HT, traite acceptée le 1er mars à échéance du 31 mai, lettrée | 412 à 1 160 000, client soldé ; TVA de mars nulle, de mai à 160 000 (échéance = règlement, décret art. 57 al. 2) | e2e `sage-l3-effets`, unit `tva-echeance-effet.spec` | passé |
| F39-H2 | | remise et encaissement | remise au 512, avis de crédit avec commission de 5 000 | 512 soldé, 6312 à 5 000, 52 au net | e2e `sage-l3-effets` | passé |
| F39-H3 | | escompte à travers la clôture | escompte en novembre, décompte (frais 20 000, commission 2 000), N clôturé, dénouement le 31 janvier de N+1 | 415 et 565 reportés puis soldés dans N+1, 675 et 6312 aux frais, TVA de janvier N+1 à 80 000 | e2e `sage-l3-effets` | passé |
| F39-H4 | | impayé avec reprise de banque | effet escompté dénoué puis dénouement annulé, impayé | 4132 débité, 415 et 565 soldés, 52 rendu de 580 000 | e2e `sage-l3-effets` | passé |
| F39-H5 | | annulation à rebours | dénouement validé annulé (négatif), impayé au brouillard annulé (retrait) | statut rendu à chaque pas, lien dénoué avant le retrait | e2e `sage-l3-effets`, unit `effets.service.spec` | passé |
| F39-H6 | | nominal · à payer (SYCEBNL) | facture d'achat de 900 000, effet au 402 lettré, bon à payer, paiement par la banque | 402 à 900 000 puis soldé, 52 à moins 900 000 ; paiement puis bon à payer annulés à rebours | e2e `sage-l3-effets` | passé |
| F39-N1 | | refus · SYCEBNL à recevoir | rôle PORTEFEUILLE sens À recevoir, puis acceptation | racines nulles avec le motif (Clients-usagers), 400 à l'acceptation | e2e `sage-l3-effets`, unit `effet-commerce.spec` | passé |
| F39-N2 | | refus · hors statut, hors ordre | encaisser un effet en portefeuille ; dénouer avant le décompte ou avant l'échéance ; annuler un acte qui n'est pas le dernier | refus nommés (acte, date, « annulez d'abord ») | e2e `sage-l3-effets`, unit `effet-commerce.spec` | passé |
| F39-N3 | | refus · frais sans compte | décompte avec frais et sans compte 675 | refus nommé avant toute pièce | e2e `sage-l3-effets`, unit `effet-commerce.spec` | passé |
| F39-N4 | | refus · remise d'un effet à payer | remettre un effet au 402 | refus nommé (« se paie (D 402 / C 52) ») | e2e `sage-l3-effets`, unit `effet-commerce.spec` | passé |
| F45-H1 | Extraits bancaires | liste par compte | relevé de mars importé (deux lignes, l'une rapprochée à l'écriture de frais, l'autre au virement), rapprochement clos | un extrait, 2 lignes, 2 rapprochées, mouvements 150 000, solde de départ 0, écart nul, fichier et instant de l'import | e2e `sage-l3-extraits`, unit `extraits-bancaires.service.spec` | passé |
| F45-H2 | | clôture traversée, départ ancré | N clôturé, second relevé importé en N+1 sur le même compte | deux extraits du plus ancien au plus récent ; le second part du solde imprimé du premier (150 000) | e2e `sage-l3-extraits` | passé |
| F45-H3 | | édition chaînée | classeur de tous les extraits du compte | feuilles Sommaire, `<compte> N-03-31`, `<compte> N+1-01-31` ; solde progressif au sens de la banque, totaux, solde imprimé, mention du fichier importé, lignes rapprochées comptées | e2e `sage-l3-extraits`, unit `extraits-bancaires.service.spec` (classeur relu) | passé |
| F45-E1 | | bornes sur la date du relevé | `du` = 1er janvier N+1 | une seule feuille d'extrait ; un compte choisi sans extrait dit au sommaire | e2e `sage-l3-extraits`, unit | passé |
| F45-N1 | | refus avant le premier octet | bornes inversées, compte d'un autre dossier, sélection vide, liste tronquée au-delà de 200 | 400 et 404 nommés, aucun flux ouvert | e2e `sage-l3-extraits`, unit | passé |
| F40-N5 | | refus · plus que le dû | chèque supérieur au dû des lignes cochées | refus nommé avant toute pièce | unit `remises.service.spec` | passé |
| F40-N6 | | refus · impayé antidaté | impayé daté avant le bordereau | refus nommé | unit `remises.service.spec` | passé |
| F40-H6 | | clôture traversée · avis validé puis annulé | avis de janvier validé par période, annulé (négatif), repassé | annulation à l'historique, remise libre, 514 rendu puis soldé | e2e `sage-l3-remises`, unit `remises.service.spec` | passé |
| F40-H7 | | impayé validé, annulé, redéclaré | impayé validé, annulé en négatif, redéclaré, annulé au brouillard | trois annulations gardées, 4131 à 300 000 puis 0, aucun impayé en cours | e2e `sage-l3-remises`, unit `remises.service.spec` | passé |
| F40-N7 | | refus · ligne tenue à la réception | ligne cochée déjà lettrée, pointée ou d'à-nouveau provisoire | refus nommé avant toute pièce | unit `remises.service.spec` | passé |
| F40-N8 | | refus · impression d'une remise annulée | remise annulée entre la lecture et le décompte | 409 nommé, rien compté | unit `remises.service.spec` | passé |
| TOUS-N1 | toutes routes d'écriture | refus · rôle | POST, PUT, PATCH, DELETE sans `@Roles` | aucune | structure `ecritures-reservees.spec`, `roles-cantonnes.spec` | passé |
| TOUS-N2 | toutes tables nouvelles | refus · dossier | lecture sans borne de dossier | refusée par la garde | structure `lecture-bornee.spec`, `index-du-dossier.spec` | passé |
| TOUS-E1 | toutes fenêtres | bord · rechargement | recharger une fenêtre qui lit | aucune exception (WebKit) | e2e, `rechargerAuRepos` | passé |
