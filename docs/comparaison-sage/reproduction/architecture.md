# Architecture de la reproduction · chaque fonction à sa place

Deuxième pièce de la reproduction (la première est `recon.md`). Manasse a
coché 41 absences « À faire » le 2026-10-14 et demandé : « Execute ce que
j'ai coché », puis « utilise le skill de duplication pour reproduire ces
fonctions. Mets chaque chose à sa place, ne mélange pas de choses ». La
méthode est celle du paquet replica (recon, architecture, build, test,
diff), ramenée à OmegaX : l'« original » est Sage 100 i7 tel que ses
manuels le décrivent, la carte est `recon.md`, la matrice `features.csv`, le
journal `build-log.md`.

## Les règles

1. **Pièce propre.** Tout s'écrit ici, à neuf, depuis les manuels lus et
   les fiches de la comparaison. Aucun écran, texte, icône ni code de Sage
   n'est recopié ; les libellés sont les nôtres. Égaler ce que fait un
   bouton est la parité ; recopier sa phrase serait une copie.
2. **Chaque chose à sa place.** Une fonction vit dans le module qui porte
   son objet (le mode de règlement avec les règlements, le document d'un
   bien avec le bien) et entre au menu là où Sage la range, quand OmegaX a
   la même branche (Fichier, Structure, Traitement, État). Une ligne ne
   touche pas aux fichiers d'une autre. Un mécanisme partagé (les pièces
   jointes) s'écrit une fois dans `src/common/` et chaque objet l'emploie
   chez lui.
3. **La charte seule.** Jetons et primitives de `docs/charte-omegax.md` et
   de `client/src/components/`, aucune couleur ni taille écrite en dur.
4. **Le droit tranche** (CLAUDE.md, § 1). Les décisions ci-dessous ont été
   prises par la loi, article lu, avant tout code. Un numéro de compte ne
   s'écrit qu'après lecture de sa fiche dans la compétence du référentiel,
   à l'instant, par la ligne qui le code.
5. **Définition de fini, par fonction.** Bloc du § 3 des deux côtés, le test
   qui aurait attrapé le défaut, chaque état de l'écran (vide, chargement,
   rempli, échec dit, refus, droits, 390 et 1440 px, clavier), un parcours
   navigateur (`e2e/`), un scénario sur vraie base qui traverse une clôture
   quand la fonction touche une écriture (§ 10), `features.csv` et
   `build-log.md` à jour, un commit par fonction finie.

## Décisions par la loi, prises avant de coder

- **D1 · Virement depuis un compte en devise (ligne 37).** Loi n° 23/053,
  art. 141, 1° : « de tenir leur comptabilité en français [...] Cette
  comptabilité est exprimée en Franc congolais ». Le texte vise la
  comptabilité, pas la monnaie du compte bancaire. Un ordre de virement
  peut donc partir d'un RIB en devise : il porte les montants en devise
  des lignes réglées (F49), et les pièces restent tenues en francs. Le
  refus `motifRefusDeviseDonneur` est levé pour ce seul cas : une facture
  d'une autre devise que le RIB reste refusée. Cette décision revient sur
  une règle posée le 2026-09-26, à réécrire au § 6 de CLAUDE.md.
- **D2 · Langue de l'application (ligne 96).** AUDCIF art. 17, 1° : « la
  tenue de la comptabilité dans la langue officielle » ; Constitution,
  art. 1er : « Sa langue officielle est le français » ; loi n° 23/053,
  art. 141, 1° : « tenir leur comptabilité en français ». La langue de
  l'INTERFACE se choisit par utilisateur. Tout ce qui fait la comptabilité
  reste en français, quelle que soit la langue de l'écran : livres, états
  financiers et notes, pièces émises, libellés d'écriture, intitulés du
  plan de comptes, citations des textes.
- **D3 · Journal marqué imprimé (ligne 60).** AUDCIF art. 22, 3° : une
  « clôture informatique » au moins trimestrielle, « mise en œuvre au plus
  tard à la fin du trimestre qui suit ». Refuser de clôturer un journal non
  imprimé n'enferme pas le dossier, puisque l'issue est immédiate :
  imprimer le journal, geste que le serveur enregistre. Le refus est une
  OPTION du dossier, désactivée par défaut, comme le double regard (§ 10
  ter) ; le contrôle de la ligne A13 continue de signaler la période sans
  clôture.
- **D4 · Pièces commerciales et caisse de comptoir (ligne 90).** Décret
  n° 23/10, art. 3, 7° (un système de facturation n'émet une facture
  normalisée qu'« homologué et relié » à un module de contrôle) et art. 20
  à 22. OmegaX n'est pas homologué : aucun ticket, bon, facture ni pièce
  qu'il imprime n'est une facture normalisée, et chacun le dit, comme la
  facture le dit déjà. Aucun « bientôt disponible ».
- **D5 · Périmètre commercial (ligne 90).** Loi n° 004/2001, art. 1er :
  l'association « ne se livre pas à des opérations industrielles ou
  commerciales, si ce n'est à titre accessoire ». Articles, tarifs et
  caisse s'ouvrent aux deux référentiels (une ASBL qui vend à titre
  accessoire en a besoin, et la facturation n'est pas cloisonnée) ; devis et
  commandes restent au SYSCOHADA (AUDCG art. 234, cloisonnement existant).
- **D6 · Annuler un traitement d'immobilisation (ligne 67).** AUDCIF
  art. 20, al. 2 : au brouillard l'écriture se supprime, validée elle
  s'inscrit en négatif ; refus dans un exercice clos. Même modèle que les
  annulations existantes (réévaluation des devises, revue des créances).
- **D7 · Modifier ou supprimer une fiche de bien (ligne 66).** AUDCIF
  art. 20 et 22, 2° : ce qui a produit une écriture validée ne se retouche
  pas. Les champs sans effet comptable se modifient librement ; ceux qui en
  ont (valeur, compte, dates, plan) seulement tant qu'aucune écriture du
  bien n'est validée, sinon par les gestes qui existent (reclassement,
  révision du plan). Suppression seulement sans écriture retenue.
- **D8 · Heures supplémentaires et absences (ligne 78).** Code du travail,
  art. 119 (« donnent droit à une majoration de salaire ») et art. 124
  (travail de nuit majoré) ; les « modalités de rémunération des heures
  supplémentaires » relèvent d'arrêtés (art. 120, e). Le taux se cherche au
  corpus ; à défaut, le cabinet déclare le taux avec sa source, jamais un
  taux deviné.
- **D9 · Congés acquis chaque mois (ligne 79).** Code du travail, art. 141
  et 142 ; règles de la décision T6 (CLAUDE.md, P4) reprises telles
  quelles.
- **D10 · Confidentialité (lignes 95, 101, 102).** CLAUDE.md, § 8, « VMG ne
  voit jamais les informations d'un client ». L'organisation en niveaux,
  les échanges d'écritures, la messagerie et la liste des utilisateurs
  connectés restent à l'intérieur d'un cabinet client et de ses dossiers ;
  l'éditeur n'y accède jamais.
- **D11 · Normes françaises.** LCR, BOR, CFONB, ETEBAC et SEPA ne sont pas
  reproduits (aucun texte lu ne les rend applicables en RDC) : la ligne 39
  reproduit le circuit comptable des effets (portefeuille, remise à
  l'encaissement ou à l'escompte, échéance, impayé), pas les fichiers
  bancaires français.
- **D12 · Remises de chèques et de cartes par le 51, impayé au 413
  (ligne 40).** Fiche du compte 51 des deux plans (AUDCIF Titre VII ;
  SYCEBNL Partie 2 ch. 3) · 513 chèques reçus non remis, 514 remis non
  crédités, 515 cartes « jusqu'à l'avis de crédit », « débité lors de la
  réception, par le crédit des comptes de tiers concernés », « crédité pour
  solde, par le débit des comptes de trésorerie concernés » ; « en cours
  d'exercice, les entités ne sont pas tenues d'utiliser le compte 51 »,
  obligatoire à la clôture · le module le tient toujours. Les cartes n'ont
  aucun transit. Commission « en services bancaires », 6315 (fiche du 63).
  Impayé · fiche du compte 41 des deux plans, « les chèques, effets à payer
  et autres valeurs revenus impayés doivent être enregistrés au compte
  413 » · un numéro, deux sens · nature au SYSCOHADA (4131 chèques, 4133
  cartes), débiteur et nature au SYCEBNL (4131 et 4133 adhérents, 4132 et
  4138 clients-usagers), racine déduite du compte du tiers, tout autre
  compte refusé.
- **D13 · Effets de commerce par les fiches 40, 41, 51, 56, 63 et 67, échéance
  lue par la TVA (ligne 39).** AUDCIF Titre VII · fiche du 41 · 412 « Clients,
  effets à recevoir en portefeuille », 415 « Clients, effets escomptés non
  échus », 4132 « effets impayés » ; fiche du 40 · 402 « Fournisseurs, effets
  à payer » ; fiche du 51 · 512 « effets à l'encaissement », « débité lors de
  la réception de l'effet, par le crédit des comptes de tiers concernés »,
  « crédité du montant des effets, pour solde, par le débit des comptes de
  trésorerie », effets remis à l'escompte → 56 ; fiche du 56 · 564 et 565,
  « la créance ne disparaît pas du bilan » · trois temps, D 415 / C 412,
  D 52 net + D 675 / C 565, puis après l'échéance D 565 / C 415 ; fiche du 67
  · 675 « escomptes des effets de commerce », frais et intérêts du décompte,
  les commissions de service → 631 (6312). UN NUMÉRO, DEUX PLANS · le SYCEBNL
  n'ouvre ni 412 effets (son 412 est « Clients-usagers »), ni 415, ni 512, ni
  564, ni 675 ; il ouvre 402 (4021, 4023) et 565, et sa fiche du 56 ne décrit
  aucun escompte · au SYCEBNL seuls les effets à payer sont servis, l'effet à
  recevoir et l'escompte sont refusés avec leur motif. TVA · décret
  n° 011/42, art. 57, al. 2 · l'encaissement intervient « à la date de
  l'échéance de la traite, même si elle a été remise à l'escompte » ; art. 96
  · le droit à déduction naît quand la taxe devient exigible chez le
  fournisseur · l'acceptation lettrée avec la facture porte l'échéance sur sa
  pièce (`Ecriture.dateEncaissementEffet`), et le moteur de la déclaration
  date tout règlement par elle (`dateDuReglement`), aux deux sens ; sans
  elle, la taxe d'une prestation payée par traite devenait exigible au jour
  de l'acceptation.

## Les fonctions, leur place et leur ligne

« Place » est le chemin du menu d'OmegaX où la fonction se trouve, à
l'image de celui de Sage. Une ligne de travail regroupe des fonctions d'une
même famille, qui touchent les mêmes fichiers et aucun autre.

| # | Fonction | Ligne | Place dans OmegaX | Où dans le code |
|---|---|---|---|---|
| 12 | Journal de situation hors clôture | L1 | Structure > Codes journaux (type Situation) | `journaux/`, clôture |
| 11 | Masquer les totaux de la saisie | L1 | Traitement > Saisie des journaux (préférence du poste) | écran de saisie |
| 60 | Journal marqué imprimé, refus de clôture en option | L1 | État > Livres comptables > Journal ; Paramètres du dossier | `journaux/`, `exercice/` |
| 16 | Prochaine lettre de lettrage choisie | L1 | Traitement > Interrogation et lettrage | `lettrage/` |
| 14 | Créer un compte pendant la saisie | L1 | Traitement > Saisie des journaux (compte inconnu) | `comptes/`, saisie |
| 19 | Séquences de saisie | L1 | Structure > Paramètres de saisie > Séquences de saisie | `modeles-saisie/` |
| 18 | Assistant de création d'un compte, d'un journal | L1 | Structure > Plan comptable ; Codes journaux | écrans de structure |
| 1 | Modes de règlement | L2 | Structure > Paramètres de saisie > Modes de règlement ; fiche du tiers ; règlement | `reglements/`, `tiers/` |
| 3 | Échéances par le modèle de règlement en saisie | L2 | Traitement > Saisie des journaux (ligne de tiers) | modèles de règlement, saisie |
| 36 | Écart de règlement et escompte | L2 | Paramètres du dossier ; Traitement > Règlement des tiers | `reglements/` |
| 24 | Qualité du tiers | L2 | Structure > Plan des tiers (fiche) | `tiers/` |
| 31 | Lieux de livraison | L2 | Structure > Plan des tiers (fiche, clients) | `tiers/` |
| 32 | Dupliquer un tiers | L2 | Structure > Plan des tiers | `tiers/` |
| 27 | Modèles d'impression du tiers | L2 | Structure > Plan des tiers (fiche) ; Rappel et relevé | `tiers/`, `relances/` |
| 18 | Assistant de règlement | L2 | Traitement > Règlement des tiers | `reglements/` |
| 37 | Virement depuis un compte en devise | L3 | Traitement > Règlement des tiers ; ordres de virement | `reglements/ordres-virement` |
| 40 | Remises de chèques et de cartes | L3 | Traitement > Tiers et trésorerie > Remises en banque | nouveau `remises/` |
| 39 | Effets de commerce | L3 | Traitement > Tiers et trésorerie > Effets de commerce | nouveau `effets/` |
| 45 | Édition chaînée des extraits bancaires | L3 | Traitement > Rapprochement bancaire | `rapprochement/` |
| 46 | Conditions bancaires, autorisations, unions | L3 | Structure > Paramètres de saisie > Banques | `banques/` |
| 47 | Taux de référence, financements, placements | L3 | Traitement > Tiers et trésorerie > Financements et placements | nouveau `tresorerie/` |
| 66 | Modifier, supprimer, dupliquer une fiche | L4 | Structure > Immobilisations | `immobilisations/` |
| 67 | Annuler une dotation ou un traitement | L4 | Structure > Immobilisations (traitements) | `immobilisations/` |
| 68 | Créer les biens depuis les écritures | L4 | Structure > Immobilisations | `immobilisations/` |
| 73 | Fusion, renumérotation, maintenance | L4 | Structure > Immobilisations (outils) | `immobilisations/` |
| 18 | Assistant de création d'un bien | L4 | Structure > Immobilisations | écran des immobilisations |
| 79 | Congés acquis chaque mois | L5 | Registre du personnel ; Paie du mois | `personnel/` |
| 78 | Heures, absences, arrêts | L5 | Traitement > Paie du mois (temps et absences) | `personnel/` |
| 75 | Banques du salarié, paiement des salaires | L5 | Registre du personnel ; Paie du mois (paiement) | `personnel/`, ordres de virement |
| 88 | Ventilation analytique de la paie | L5 | Registre du personnel ; passation de la paie | `personnel/`, `analytique/` |
| 85 | Questionnaire société et salarié | L5 | Registre du personnel (assistant) | `personnel/` |
| 22 | Documents des écritures, sections, biens, salariés | L6 | sur chaque objet, chez lui | `common/pieces-jointes/` puis chaque module |
| 50 | Longueur fixe des codes de section | L6 | Structure > Plans analytiques | `analytique/` |
| 59 | Modèles d'édition, sauts, impression différée, sélections | L7 | État (chaque édition) ; Fichier > Impressions différées | `exports/` |
| 99 | Export des seules modifications | L7 | Fichier > Exporter les modifications | `exports/` |
| 91 | Collaborateurs et rôles commerciaux | L8 | Structure > Collaborateurs | nouveau `commercial/` |
| 94 | Modes d'arrondi | L8 | Paramètres du dossier (gestion commerciale) | `commercial/` |
| 90 | Gestion commerciale | L8 | Structure > Articles, Tarifs, Dépôts ; Traitement > Ventes, Achats, Caisse | `commercial/` |
| 95 | Utilisateurs connectés, messagerie interne | L9 | Fichier > Utilisateurs connectés ; Messages | `auth/`, nouveau `messagerie/` |
| 101 | Organisation du cabinet en niveaux | L9 | Fichier > Organisation du cabinet | `plateforme/` côté cabinet |
| 102 | Échanges avec l'expert-comptable | L9 | Fichier > Échanger des écritures | `import/`, `exports/` |
| 100 | Personnalisation, formules, notifications | L9 | Fichier > Personnaliser ; Notifications | nouveau |
| 96 | Langue de l'interface | L9 | Fichier > Mon compte | `client/src/lib/langue` |

Trois fonctions de Sage ont été rangées à part pour ne rien mélanger :
l'assistant de la ligne 18 est réparti entre L1 (compte, journal), L2
(règlement) et L4 (bien) ; les documents de la ligne 22 sont posés par L6
sur les quatre objets avec un seul mécanisme commun. La personnalisation
de la ligne 100 ne reprend pas le choix des colonnes (ligne 17), que
Manasse a laissé à plus tard.

## L'ordre

La ligne virement de fonds entre d'abord sur `main`. Ensuite, au plus trois
lignes à la fois, de familles différentes, chacune dans sa copie et sur sa
branche de sauvegarde `travail/sage-lN`, avec sa fiche
`AVANCEMENT-sage-lN.md` ; intégrées l'une après l'autre (CLAUDE.md, § 5 et
§ 11).

1. Vague 1 : L1 journaux et saisie, L4 immobilisations, L5 paie.
2. Vague 2 : L2 tiers et règlements, L6 pièces jointes et analytique, L7
   éditions et exports.
3. Vague 3 : L3 banque et trésorerie, L9 dossier et interface.
4. Vague 4 : L8 gestion commerciale, la plus grande, qui emploie les lieux
   de livraison de L2.

**Arrêt après la vague 1** (décision de Manasse du 2026-10-14, devant le
coût) · le virement de fonds puis L1, L4 et L5 sont finis et intégrés, puis
le travail s'arrête. Les vagues 2 à 4 attendent son choix.

## Ce qui est plus gros qu'il n'y paraît

- **L8, ligne 90.** Le manuel de structure des fichiers de Sage (M6) range
  sous la gestion commerciale dix-sept familles de tables : articles et
  gammes, tarifs et remises, dépôts, agenda, abonnements commerciaux,
  caisse de comptoir, site marchand, fabrication et affaires, glossaires,
  catalogue et commissions. C'est un second logiciel. L8 avance famille
  par famille, chacune finie avant la suivante, dans l'ordre : articles,
  tarifs et remises, documents de vente et d'achat, dépôts et stocks,
  caisse de comptoir, abonnements commerciaux, puis le reste.
- **L9, ligne 96.** Traduire l'interface touche chaque écran. La ligne pose
  le mécanisme et l'anglais du cadre (menus, boutons communs, messages
  d'erreur du serveur), puis écran par écran.
- **L9, ligne 100.** Personnalisation, éditeur de formules et notifications
  sont trois fonctions de Sage X3. Elles avancent l'une après l'autre.
