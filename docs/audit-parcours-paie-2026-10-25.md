# Audit du parcours de la paie · 2026-10-25

Demande de Manasse : « la paie n'est pas vraiment bien exploitée ». Cet audit
dit pourquoi, de façon vérifiable. Aucun fichier de `src/` ni de `client/src/`
n'est modifié.

**Méthode.** Audit en deux temps. (1) Lecture du code (contrôleurs, DTO,
écrans, menus). (2) Parcours REJOUÉ par l'API sur le serveur compilé
(`dist/main.js`) contre une base PostgreSQL 16 jetable (le portillon et la
production tournent en 17 et 18, voir réserve en fin de document), pour un
dossier SYSCOHADA et un dossier SYCEBNL, puis avec un utilisateur
`GESTIONNAIRE_PAIE`. Les refus cités ci-dessous sont les réponses réelles du
serveur, recopiées. L'interface n'a pas été pilotée dans un navigateur : ce
qui est dit de l'écran vient de la lecture de `AppShell.tsx`,
`PersonnelPage.tsx`, `BulletinsPaie.tsx`, `PaieDuMois.tsx` et des composants
de `client/src/components/paie/`.

## (a) Verdict en cinq lignes

1. Le MOTEUR est sérieux et juste (calcul, assiettes, passation en trois
   temps, paiement, congés, absences, décompte final) : un bulletin se
   calcule, s'émet, se passe au journal et se paie sur les deux référentiels.
2. Ce qui manque est LA SORTIE : aucun bulletin PDF au modèle de l'arrêté de
   2008, aucun état de déclaration CNSS (Mod. DC), INPP, ONEM ou IRPPDR1,
   aucun export Excel de la paie, aucun import du personnel. Le client calcule
   dans OmegaX, puis retape ailleurs.
3. La SAISIE est lourde : le salaire du contrat n'est pas repris au bulletin,
   la nature de l'employeur (INPP), le régime de retenue, l'effectif et les
   personnes à charge sont ressaisis à CHAQUE simulation (état d'écran, jamais
   enregistré), et rien ne traite tout le personnel d'un mois d'un seul geste.
4. Le module est INVISIBLE au départ : un dossier neuf n'a pas la Paie, seul
   l'administrateur peut la cocher dans Paramètres du dossier, et le
   démarrage guidé n'en parle pas.
5. Le gestionnaire de paie, le rôle fait pour ce travail, ne peut ni lire le
   registre des retenues (donc ne voit pas ce qu'il faut déclarer et verser),
   ni saisir le RIB d'un salarié, ni passer la paie au journal : il dépend du
   comptable et de l'administrateur à trois endroits du parcours.

## (b) Parcours d'un utilisateur, étape par étape

Légende : **OK** · fonctionne ; **FRICTION** · fonctionne, au prix d'un effort
ou d'un silence ; **IMPASSE** · refus sans issue dite ou sans issue
raisonnable ; **ABSENT** · rien n'existe.

| # | Étape | Écran et accès | État | Preuve |
|---|---|---|---|---|
| 1 | Activer la Paie sur un dossier neuf | Paramètres du dossier > Modules du dossier, case « Paie et personnel », administrateur seul. `modulesActives` vaut `[]` à la naissance (rejoué : `modulesActives à la naissance: []`). Tant qu'elle n'est pas cochée, ni « Registre du personnel » ni « Paie du mois » ne figurent au menu (`cheminAuMenu` dans `client/src/lib/profil-dossier.ts`, `MODULES`). | **FRICTION** | `prisma/schema.prisma` l. 715 (`@default([])`) ; `client/src/pages/ParametresDossier*.tsx` l. 1825-1845 ; `client/src/lib/demarrage-guide.ts` ne cite pas la paie (grep vide). Un comptable qui cherche la paie ne trouve rien et rien ne lui dit où elle s'active. |
| 2 | Créer un salarié (registre, enfants) | Structure > Registre du personnel. Comptable et administrateur écrivent ; lecture seule lit ; aide-comptable exclu (données nominatives). Seuls `nom` et `sexe` sont obligatoires. Rejoué : `POST /personnel/salaries` sans `sexe` : 400 `sexe must be one of the following values: MASCULIN, FEMININ`. | **OK** | `personnel.controller.ts` l. 39-62 ; `dto/personnel.dto.ts` l. 55-145. |
| 3 | Créer le contrat | Onglet Registre, fiche du salarié. Contrat minimal accepté (type et date d'entrée) ; l'onglet « confrontation » liste ensuite les points de l'art. 212 non renseignés avec « où le corriger ». Un second contrat se crée sans clore le premier (rejoué : deux contrats `en cours` acceptés pour le même salarié). | **FRICTION** | `GET /personnel/confrontation` rejoué : `mentionsManquantes[…].ou = "Personnel > fiche du salarié"`. Le chevauchement de contrats n'est ni refusé ni signalé à la création : à vérifier avant qu'il fausse « contrat en cours » (`contratCouvrantLeMois`). |
| 4 | Rubriques, barèmes | Onglets Rubriques et Barèmes. Barèmes CNSS, INPP, ONEM, SMIG livrés (`GET /personnel/baremes` rejoué : quatre barèmes livrés). Rubriques à créer par le cabinet. | **OK** | `baremes-paie.controller.ts` ; `personnel/baremes-dossier.ts`. |
| 5 | Saisir le mois (éléments du bulletin) | Onglet Simulation. Il faut TAPER le salaire (nature `SALAIRE_OU_TRAITEMENT`, libellé, montant) : le `remunerationBase` du contrat n'est pas repris. Seul un « bulletin modèle » pré-remplit, et à condition d'en avoir créé un. Rejoué : simulation sans élément = assiette CNSS 0 FC, abstention « ASSIETTE SOUS LE PLANCHER · 0 FC contre 559000 FC ». | **FRICTION** | `PersonnelPage.tsx` : `remunerationBase` n'apparaît que dans la fiche contrat (l. 1362, 1994) et pas dans l'onglet Simulation ; `modeles-bulletin.ts` l. 1-40. |
| 6 | Paramètres de calcul du mois | Nature de l'employeur (INPP, public/privé), effectif, régime de retenue, classe, personnes à charge, enfants bénéficiaires, jours payés : tous champs d'écran, vides au départ, jamais enregistrés (`useState('')` l. 648-766). Rejoué : émission sans nature INPP : 400 `Bulletin non émis · 1 montant(s) non calculé(s)… INPP · le taux dépend d'abord de la NATURE de l'employeur, public ou privé. Elle n'est pas renseignée, et OmegaX ne la présume pas.` Le refus dit quoi remplir, mais la nature d'un employeur ne change pas d'un mois à l'autre. | **FRICTION** | `PersonnelPage.tsx` l. 740 (`natureInpp`), l. 741, 766, 656, 727 ; `Tenant` ne porte que `effectifPermanent` (`schema.prisma` l. 740). |
| 7 | Simuler puis émettre un bulletin | Onglet Simulation puis Bulletins. Rejoué avec paramètres complets : brut 800 000, CNSS travailleur 40 000, IRPP 92 700, net 667 300 ; patronal 136 000. Deux salariés = deux saisies complètes (aucun traitement en lot). | **OK** pour un salarié, **FRICTION** pour N | `POST /personnel/salaries/:id/bulletins` ; aucun endpoint « tous les salariés du mois » dans `personnel.controller.ts`. |
| 8 | Imprimer le bulletin | Bouton « Imprimer » = `window.print()` de l'écran (`BulletinsPaie.tsx` l. 383). Pas de PDF serveur, pas d'en-tête employeur (aucun `EnteteImpression`, aucune mention de l'employeur dans le fichier), 12 mentions sur 33 portées (`enonciationsDuBulletin` : rangs 1 à 6, 21, 25, 27, 29, 31, 32). Rejoué : `enonciations.nonPortees = [7..20, 22, 23, 24, 26, 28, 30, 33]`. | **FRICTION** | `bulletin-paie.ts` l. 109-146. La réserve affichée dit que le bulletin n'est pas certifié conforme au modèle. Pas d'impression groupée du mois. |
| 9 | Passer la paie au journal | Traitement > Paie du mois (ou onglet Bulletins). Comptable et administrateur seuls (`@ReserveAuComptable`). Rejoué : une écriture au BROUILLARD (OD, bulletins 1 et 2), équilibrée ; les comptes de paie sont adoptés d'office (« les écritures automatiques adoptent d'office »). Sans journal de paie dédié, tombe en OD. | **OK** | `POST /personnel/paie-du-mois/2026-03/comptabilisation` : 201. |
| 10 | La paie alimente le registre des retenues | Ne le fait QU'APRÈS VALIDATION de la pièce. Rejoué : registre lu juste après la passation = CNSS, IRPP, INPP/ONEM tous à `retenu: 0`, `comptes: []` ; après `POST /ecritures/valider` : IRPP 157 400, CNSS 252 000 (91 000 + 21 000 + 140 000), ONEM 7 000 (échéance 15/04), INPP 49 000 (échéance 30/04). Aucune mention à l'écran de Retenues ne dit que du brouillard existe (aucune occurrence de « brouillard » dans `RetenuesPage.tsx`) : zéro lu comme « rien à verser ». | **FRICTION (zéro silencieux)** | `retenues.service.ts` l. 155, 170, 334 (`statut: VALIDEE` seul). Comparer à la TVA qui nomme `tvaAuBrouillard` (CLAUDE.md § 6, audit F25). |
| 11 | Payer les salaires | Bulletins, bloc « Paiement ». Comptable/admin. Chaîne de prérequis : mode de paiement par salarié, journal de trésorerie, et pour un virement un RIB sur le journal (Structure > Banques) ET un RIB par salarié (administrateur seul). Rejoués, dans l'ordre : (a) `Paiement refusé · n° 1 · MUKENDI TEST · son mode de paiement n'est pas encore dit (Registre du personnel)` ; (b) `Aucun RIB n'est rattaché au journal BQ (Structure > Banques) · l'ordre de virement n'aurait pas de compte à débiter.` ; (c) espèces dans un journal de banque : `Un paiement en espèces sort d'une caisse (compte 57…) · le journal BQ porte le compte 52110000.` ; (d) espèces sur caisse vide : `La caisse 57110000… deviendrait créditrice… il manque 505 300,00… approvisionnez d'abord la caisse (virement de fonds…), payez par la banque, ou datez la sortie après l'entrée.` | **FRICTION** (chaque refus nomme l'issue, mais quatre refus de suite) | `paiement-salaires.service.ts` ; `PaiementSalaires.tsx`. Le virement est un ordre « à imprimer » dans Règlement des tiers, pas un fichier de banque. |
| 12 | Déclarer CNSS (Mod. DC ou déclaration mensuelle unique) | Aucun écran. Le registre donne les soldes et les dates (15 du mois suivant). La déclaration elle-même n'est pas produite. | **ABSENT** | voir (c), ligne 1. |
| 13 | Déclarer l'IRPP retenu (IRPPDR1) | Aucun écran. Le code de l'imprimé est affiché (`imprime: "IRPPDR1"`), l'imprimé n'est pas rempli. | **ABSENT** | `correspondance-retenues.ts` ; `imprimes-dgi.spec.ts`. |
| 14 | Déclarer INPP et ONEM | Aucun écran de déclaration. Échéancier juste (ONEM le 15 du mois suivant, INPP trimestriel, 30/04 rejoué). | **ABSENT** (échéances OK) | `inpp-trimestriel.ts`. |
| 15 | Congés | Onglet Congés. Compteur par période annuelle, droit né à l'expiration de l'année (art. 140 al. 3), allocation de l'art. 142. Rejoué : dossier en cours d'année sans historique, congé de 11 jours : 400 `Le congé compte 11 jour(s) et le solde des droits nés au 2026-06-01 est de 0 · le droit naît à l'expiration de l'année de services (article 140, alinéa 3). Cochez « Au-delà du solde » et dites pourquoi`. L'issue réelle pour un PME qui démarre est la REPRISE du solde (`PUT …/conges/reprise`, quatre champs dont une source), que le message ne nomme pas. Un seul salarié à la fois, aucun état global des soldes. | **FRICTION** | `conges.controller.ts` ; `dto/conges.dto.ts` l. 8-26 ; `CongesPaie.tsx` l. 35, 98. |
| 16 | Absences | Onglet Absences, treize causes du Code. Rejoué : création OK avec `MALADIE_OU_ACCIDENT` ; avec un libellé libre : 400 qui liste les treize valeurs. | **OK** | `absences.controller.ts` ; `dto/absences.dto.ts`. |
| 17 | Décompte final | Onglet Décompte final, puis émission comme un bulletin. Rejoué : calcul accepté avec `anneesAnciennete`, `moisNonCouvertsParUnConge`, initiative, motif, type. Défaut d'API : sur un motif invalide le 400 dit `motif must be one of the following values: ` (liste VIDE, `@IsEnum([...])` avec un tableau littéral au lieu d'une énumération), même chose pour `ElementPaieDto.nature`. L'écran propose des listes, donc seul un appel direct le voit. | **OK** (défaut mineur de message) | `dto/personnel.dto.ts` l. 328-346, 749-757. |
| 18 | Livre de paie | Onglet Livre : n'est PAS un livre. C'est un contrôle de couverture des 33 énonciations de l'arrêté de 2008, avec l'avertissement « OmegaX ne tient pas votre livre de paie ». Rejoué : `POST /personnel/livre-de-paie` `{}` rend `mentionsPorteesCount: 0` et la liste des 33 manquantes. | **ABSENT comme livre**, OK comme contrôle | `PersonnelPage.tsx` l. 4562-4571 ; `livre-de-paie.ts`. |
| 19 | Exports | Aucun export de paie (ni bulletins, ni état mensuel, ni masse salariale). La restitution du dossier (ZIP de CSV) est une archive, pas un état. | **ABSENT** | `src/modules/exports/` : aucun fichier sur le personnel hors `restitution/`. |
| 20 | Rôle GESTIONNAIRE_PAIE | Menu réduit à Fichier : Registre du personnel, Devises. Rejoué (après changement du mot de passe provisoire, route de sortie seule ouverte avant) : 200 sur salariés, bulletins, paie du mois (lecture), paiement (lecture), mode de paiement, rubriques, barèmes, devises, exercices ; 403 sur `/retenues/registre`, `/journaux`, `/comptes`, `/banques`, passation, RIB salarié (`Rôle insuffisant · requis : ADMIN_CABINET`). | **FRICTION** | `roles-cantonnes.ts` ; `personnel.controller.ts` ; il émet les bulletins mais ne voit pas ce qu'il doit déclarer ni verser, et ne peut ni passer, ni payer, ni saisir un RIB. |

**SYCEBNL.** Le même parcours (émission, passation, brouillard, refus INPP,
paiement) donne les mêmes résultats sur un dossier associations : net
667 300 pour 800 000. Les comptes divergents entre plans (retraite obligatoire
43130000 en SYSCOHADA, 43210000 en SYCEBNL) sont portés par `passation-paie.ts` ;
le rejeu n'a pas relu chaque numéro du SYCEBNL ligne par ligne.

## (c) Écarts avec l'attente d'un marché

| # | Attente d'une PME congolaise | État | Preuve |
|---|---|---|---|
| 1 | Déclaration CNSS prête à déposer (Mod. DC ou « déclaration mensuelle unique ») | **ABSENT**, alors que le TEXTE est au corpus : l'arrêté n° 146/2018, art. 22 et 23, énumère le contenu (employeur, numéro d'affiliation, siège, période, brut total, assiette, cotisations dues, effectif au dernier jour, enfants bénéficiaires, date et mode de paiement) et l'art. 24 exige la copie des feuilles de paie jointes. Toutes ces données existent dans les bulletins émis. | Corpus : compétence `cnss-cotisations-sociales-rdc`, `am-146-2018-…md`, art. 22-24 (lu). Code : `Mod. DC` n'apparaît que dans `src/modules/retenues/correspondance-retenues.ts` et `retenues.spec.ts`, en commentaire de texte, aucun générateur. |
| 2 | Télédéclaration CNSS au-delà de vingt-cinq travailleurs | **ABSENT** (la Caisse fournit sa plateforme ; OmegaX ne produit aucun fichier de dépôt). Le texte dit seulement « selon le modèle retenu par elle » : le gabarit de la Caisse n'est pas au corpus. | AM 146 art. 24 al. suivants (lu) ; aucun export. |
| 3 | IRPP retenu : imprimé IRPPDR1 rempli | **ABSENT**. Code d'imprimé affiché, montants du mois disponibles au registre (une fois la pièce validée). | `imprimes-dgi.spec.ts` ; rejeu du registre : `irppSalaires.imprime = "IRPPDR1"`. |
| 4 | INPP et ONEM : états de déclaration | **ABSENT** pour les états ; **CODÉ** pour taux, nature d'employeur, tranche d'effectif, échéances (ONEM mensuel, INPP trimestriel). | `retenues/inpp-trimestriel.ts` ; rejeu : échéances 15/04 et 30/04. |
| 5 | Bulletin de paie imprimable en PDF au modèle de l'arrêté de 2008 | **PARTIEL** : impression navigateur de l'écran, 12 mentions de 33 portées, aucune identité d'employeur, pas de PDF, pas de lot. Le modèle annexé de l'arrêté de 2008 est une reconstitution (encodage décalé), donc la mise en forme ne peut pas être certifiée (voir (e)). | `BulletinsPaie.tsx` l. 383 ; `bulletin-paie.ts` l. 109-146 ; aucune dépendance PDF dans `package.json` (ni serveur ni client). |
| 6 | Livre de paie tenu | **PARTIEL** : contrôle des 33 énonciations, jamais un livre produit. Le texte admet « le livre de paie ou fichier informatisé » (arrêté de 2008, art. 1er, CLAUDE.md § 6, P6) : une édition du livre à partir des bulletins émis est donc admissible. | `PersonnelPage.tsx` l. 4562-4571. |
| 7 | Virement groupé des salaires | **PARTIEL** : une écriture agrégée D 422 / C trésorerie et un ORDRE DE VIREMENT numéroté, à imprimer (Règlement des tiers). Aucun fichier bancaire (SEPA, ETEBAC, CSV de banque) : écarté par la règle de l'éditeur (`tiers/ribs-tiers.ts`). | `paiement-salaires.service.ts` l. 124-130, 327. |
| 8 | Import du personnel depuis Excel | **ABSENT**. `TypeImport` ne connaît que `PLAN_COMPTES`, `BALANCE`, `ECRITURES`. Saisie une fiche à la fois. | `src/modules/import/dto/*.ts` l. 3-7. |
| 9 | Fiche individuelle du salarié (état civil, contrat, enfants, historique de paie) | **PARTIEL** : fiche à l'écran avec contrat et enfants ; pas d'édition imprimable de l'ensemble, pas d'historique de paie en une page, pièces jointes possibles. | `PersonnelPage.tsx` registre ; `pieces-jointes-salarie.controller.ts`. |
| 10 | État des congés (soldes de tout le personnel) | **PARTIEL** : compteur détaillé par salarié (`GET /personnel/salaries/:id/conges`), aucun tableau de tous les soldes à une date. | `CongesPaie.tsx` l. 35 (un `salarieId` à la fois) ; `conges.controller.ts`. |
| 11 | Solde de tout compte | **CODÉ** : calcul (préavis, congé, indemnités, arriérés), émission comme bulletin de nature `DECOMPTE_FINAL` dans la même numérotation, scénarios des art. 63 à 67, passation au 66140000. | `decompte-final.ts`, `decompte-final-emis.ts` ; rejeu du calcul : 201. |
| 12 | Paie du mois pour tout le personnel en un geste | **ABSENT** : un bulletin par salarié, paramètres ressaisis. | `personnel.controller.ts` : seule route `salaries/:salarieId/bulletins`. |
| 13 | Retenues et avances sur salaire | **CODÉ** : avances, prêts (272), rubriques, retenue par bulletin. | `avances-salaire.ts`, `avances-rubriques.controller.ts`. |
| 14 | Heures supplémentaires et absences au bulletin | **CODÉ** (taux de majoration DÉCLARÉ, aucun au corpus) ; les treize causes d'absence ; indemnité de la Caisse déclarée. | `heures-majorees.ts`, `absences.ts`. |
| 15 | Paie en dollars | **CODÉ** : conversion au cours du jour de mise à disposition ; le gestionnaire cote le cours USD du jour. | `conversion-usd.ts` ; rejeu : gestionnaire `GET /devises` 200. |
| 16 | Ventilation analytique de la paie, paiement par caisse provisionnée | **CODÉ** | `ventilation-analytique-paie.ts` ; refus de caisse rejoué. |
| 17 | Contrôle du minimum légal par classe | **CODÉ** : classe 1 à 17 du décret n° 25/22, SMIG, plancher CNSS. | `bareme-smig.ts`, `regles-contrat-travail.ts`. |
| 18 | État de gestion de la paie pour le dirigeant (masse salariale, coût employeur, par service) | **ABSENT** : aucun état de gestion de la paie ; la masse salariale ne se lit qu'au grand livre (66). | `src/modules/exports/` ; aucun état personnalisé de paie. |

## (d) Les cinq améliorations les plus rentables

Classées par valeur pour un client réel. Toutes sont des FONCTIONS NOUVELLES :
sous le gel de CLAUDE.md § 5, chacune exige que Manasse lève le gel pour elle
(« une demande expresse vaut levée du gel pour elle seule »). Efforts en
jours de développement, relecture et rejeu sur vraie base à travers une
clôture compris. Aucune de ces fonctions ne se ferait sans lire à nouveau le
texte qu'elle porte.

| Rang | Amélioration | Valeur client | Effort | Risque comptable |
|---|---|---|---|---|
| 1 | **Enregistrer les paramètres du dossier et du contrat que la simulation ressaisit** (nature de l'employeur INPP, régime de retenue, effectif déclaré pour l'INPP, classe, jours payés par défaut), et **reprendre le salaire du contrat** comme premier élément du bulletin, modifiable. Chaque paramètre garde sa règle « jamais présumé » : il se DÉCLARE une fois avec sa source au lieu d'un champ vide à chaque mois. | Très forte : supprime l'erreur du premier bulletin (refus INPP) et le travail répété de chaque mois ; c'est le point que le client touche tous les mois. | 3 à 5 j | Faible si chaque paramètre garde le statut « déclaré » et reste figé dans le bulletin (le calcul serveur ne change pas) ; risque : présumer une nature d'employeur, à interdire. |
| 2 | **Paie du mois en lot** : proposer, pour tous les salariés actifs sous contrat, un bulletin pré-rempli (contrat + paramètres + congés/absences du mois), à vérifier salarié par salarié puis à émettre ensemble. | Très forte pour une PME de vingt salariés ou plus. | 5 à 8 j | Moyen : il ne doit jamais émettre sans regard (l'émission reste un geste explicite par lot après revue) ; émission rejouée par le serveur comme aujourd'hui. |
| 3 | **Déclaration CNSS : aperçu Mod. DC et feuilles de paie jointes**, calculé sur les bulletins ÉMIS du mois, avec les dix énonciations de l'art. 23 de l'arrêté n° 146/2018 (et le contenu de la déclaration mensuelle unique, art. 22), export Excel/PDF et mention de la voie (guichet unique ou Caisse) laissée au cabinet. | Très forte : c'est la première obligation mensuelle de tout employeur, aujourd'hui retapée à la main. | 5 à 7 j | Moyen : les montants viennent des bulletins figés (aucun recalcul) ; le gabarit graphique de la Caisse n'est pas au corpus (voir (e)), donc le document se présente comme un état de préparation, pas comme l'imprimé officiel. |
| 4 | **Bulletin de paie PDF** (un par salarié et le mois entier en un fichier) avec identité de l'employeur recopiée à la date du bulletin (comme les pièces de facturation, `mentionsEmetteur`) et les 33 énonciations lisibles, chaque mention non portée dite ; **édition du livre de paie** à partir des bulletins émis. | Forte : le salarié et l'inspecteur du travail veulent un document. | 5 à 8 j | Faible sur les montants ; risque de présentation : ne JAMAIS afficher « conforme au modèle de 2008 » (annexe reconstituée). |
| 5 | **Lever les trois dépendances du gestionnaire de paie** et dire les zéros du registre : (a) lecture du registre des retenues et de l'échéancier pour `GESTIONNAIRE_PAIE`, (b) mention « n pièce(s) de paie au brouillard, non lues » sur Retenues tant que la passation n'est pas validée, (c) amorce « Activer la Paie » dans le démarrage guidé et un message à l'ouverture du module. | Moyenne à forte : corrige le « je ne trouve pas » et le « zéro à verser » faux. | 2 à 3 j | Faible : lecture seule, dans le périmètre du rôle cantonné (liste à rouvrir et à geler route par route dans `roles-cantonnes.spec.ts`). |

Hors classement, à bas coût : import Excel du personnel (3 à 5 j, risque faible,
chaque ligne jugée par les règles de la saisie), état global des soldes de
congés (2 j, lecture seule), message d'erreur des énumérations de paie (0,5 j,
sans conséquence comptable).

## (e) Ce qui ne se code pas faute de texte

Manques RÉELS du droit, nommés tels que le dépôt les tient (CLAUDE.md § 6,
P0, P5, P6, P7) et tels que les relectures de cet audit les confirment :

1. **L'arrêté de l'art. 139 a)** du Code du travail : la valeur maximale de
   remboursement du logement fourni en nature. Absent du corpus ; la quotité
   saisissable (art. 114) reste calculée sans lui, et dite.
2. **L'arrêté de l'art. 64** (préavis par catégorie) et la **convention
   collective** : OmegaX calcule le plancher légal (quatorze jours ouvrables
   plus sept par année) et le dit.
3. **Le modèle annexé à l'arrêté du 8 août 2008** : sa mise en forme est une
   reconstitution (encodage décalé de +29), jamais citable comme lecture
   directe. OmegaX ne peut donc pas certifier un bulletin « conforme au
   modèle » ; il peut porter les trente-trois énonciations, qui sont au texte.
4. **Le gabarit de la télédéclaration de la Caisse** : l'art. 24 de l'arrêté
   n° 146/2018 renvoie à « la plateforme numérique » et à « un modèle retenu
   par elle », hors corpus. Le contenu du Mod. DC (art. 23) et de la
   déclaration mensuelle unique (art. 22) est, lui, au texte et peut être
   porté.
5. **Les deux voies de déclaration ne s'articulent pas dans le texte**
   (guichet unique et déclaration mensuelle unique contre Mod. DC à la
   représentation de la Caisse) : OmegaX ne peut pas choisir pour le dossier.
6. **Le cours de conversion du forfait libératoire** du personnel domestique et
   des micro-entreprises (arrêté n° 019/CAB/MIN/FINANCES/2025) : renvoyé à une
   circulaire absente. Aucune quotité en francs ne se chiffre.
7. **Aucun taux de majoration des heures supplémentaires** au corpus : il
   reste DÉCLARÉ par le cabinet avec sa source.
8. **Le SMIG payé de mai à décembre 2025 comme plancher CNSS** : tranché par
   la loi (décision T4), mais la CNSS doit le confirmer en pratique ; le
   registre le dit.
9. **Le plancher de 2 000 FC de l'IRPP** du livre de cours : dans aucun
   article ; non codé.
10. **L'imprimé IRPPDR1 et la déclaration INPP/ONEM** : le code de l'imprimé
    est connu, la disposition exacte des cases de l'imprimé et du formulaire
    INPP n'ont pas été relues par cet audit ; à lire dans le corpus avant
    toute fonction qui les remplit (règle n° 1).

## Réserves de l'audit

- Base de rejeu en **PostgreSQL 16**, alors que le portillon éprouve 17 et 18.
  Les migrations se sont appliquées sans erreur et le serveur a démarré
  (`/health` : `{"statut":"ok"}`), mais cette version n'est pas celle de la
  production : les constats ci-dessus portent sur le comportement de
  l'application, pas sur la base.
- Les montants du rejeu (IRPP 92 700 pour 800 000, CNSS 40 000, etc.) ne sont
  pas revérifiés ici contre les textes : ils sont tenus par la suite de tests
  du dépôt. Cet audit en prouve le passage de bout en bout, pas l'exactitude
  fiscale.
- L'interface n'a pas été pilotée dans un navigateur (pas de Playwright
  lancé) : les constats d'écran viennent de la lecture du code.
- Aucun jeu de données de production ni `DATABASE_URL` réel n'a été touché ;
  la base jetable (`omx_audit`) est locale.
