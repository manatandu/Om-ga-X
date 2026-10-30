# Avancement · ligne dossier-l9 (Sage L9 · fonctions 95, 96, 100, 101, 102)

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Branche de sauvegarde `travail/dossier-l9`, partie de `origin/main`
(`c942b8605`). Rien n'est intégré sur `main` par cette ligne.

## Fait

### 102 · Échange d'écritures (Fichier > Échanger des écritures)

- `src/modules/exports/echange/` · règles pures (`echange-ecritures.ts`),
  service, contrôleur `/echanges-ecritures`, spec.
- Tables `receptions_echange` et `ecritures_recues`
  (migration `20270220000101_echange_ecritures`).
- Le dossier qui reçoit relit l'export des modifications d'un AUTRE dossier ·
  chaque écriture par son identifiant d'origine · jamais reçue, elle naît au
  brouillard ; changée, elle est remplacée EN PLACE au brouillard (même
  numéro, `modifierPieceDuModule`), ou retirée puis recréée si elle change
  d'exercice, de journal ou de mois d'un journal mensuel ; retirée chez
  l'expéditeur, retirée ici. Jamais deux fois · registre unique par
  identifiant, empreinte du fichier unique, envoi plus ancien sans effet.
- Jugée par les règles de l'import des écritures (`controlesDEntree`,
  ventilation non exigée, comptes et journaux du dossier, exercice ouvert qui
  couvre la date).
- Tant qu'elle est TENUE, l'écriture reçue est RETENUE (`detenteurs-ecriture.ts`,
  `DETENTEUR_ECHANGE`) · « Détacher » la reprend au compte du dossier.
- Une écriture reçue ne repart pas par l'export des modifications du dossier
  qui la reçoit (anti-jointure sur `ecritures_recues`).
- Écran `EchangeEcrituresPage` (aperçu puis réception, écritures reçues par
  état, réceptions).
- Rejeu sur vraie base · `scripts/rejouer-echange-ecritures.cjs`, deux
  dossiers SYSCOHADA, quatre envois, clôture de 2026 chez celui qui reçoit ·
  conforme.

### 95 · Utilisateurs connectés et messagerie interne

- `src/modules/messagerie/` · `presence.ts` (écrite par `JwtStrategy`, au
  plus une fois par minute et par session, jamais bloquante), messagerie
  (`/messages`), utilisateurs connectés (`/utilisateurs-connectes`, à
  l'administrateur seul). Tables `presences_sessions`, `messages_internes`,
  `destinataires_messages` (migration `20270220000102_presence_et_messagerie`).
- La session se nomme par l'empreinte de son jeton CSRF, jamais rendue ;
  appareil résumé (navigateur et système), ni IP ni chaîne du navigateur ;
  retirée trente et un jours après sa dernière activité ; la déconnexion la
  retire de la liste dans la transaction de sa trace.
- Messages entre utilisateurs ACTIFS du même dossier, relus par le serveur ;
  lus par l'expéditeur et les destinataires seuls (l'administrateur non) ;
  objet et corps hors du journal d'audit ; chacun retire de sa boîte, retiré
  par tous il est supprimé. Ouverts au gestionnaire de paie route par route
  (`roles-cantonnes.spec.ts`).
- Écrans `UtilisateursConnectesPage` (Fichier > Utilisateurs connectés) et
  `MessagesPage` (Fichier > Messages).
- Rejeu sur vraie base · `scripts/rejouer-dossier-l9.cjs` · conforme.

### 100 · Notifications, préférences, aide à la formule

- `src/modules/notifications/` · préférences de chacun (`/preferences`, les
  siennes seules) et notifications dans l'interface (`/notifications`,
  marquer lue, tout lu, compte des non lues). Tables
  `preferences_utilisateurs` et `notifications_utilisateurs` (migration
  `20270220000103_preferences_et_notifications`).
- Trois événements · message reçu (ses destinataires), écritures reçues d'un
  autre dossier (administrateur et comptable), exercice clôturé (tous) ;
  jamais l'auteur de l'acte, jamais un utilisateur inactif, jamais celui qui
  a coupé l'événement. Posées APRÈS l'acte par `notifierSansEchec`, qui ne
  lève jamais · la lecture qui compose le contenu (expéditeur, exercice) est
  sous la même garde, sans quoi un acte fait rendait une erreur 500.
- Écran · Fichier > Notifications, Fichier > Préférences…, bouton du cadre à
  pastille (le compte non lu n'est jamais dit « aucune »).
- Aide à la formule des états personnalisés (`GET
  /etats-personnalises/formule`) · les comptes du plan qu'une rubrique
  additionne et ceux qu'un moins écarte, par la règle du calcul
  (`lireLesRacines`), la racine sans compte nommée ; liste nommée bornée à
  cinquante, le nombre toujours dit ; plan de plus de vingt mille comptes de
  détail refusé plutôt que lu en partie ; une formule donnée deux fois en
  400. Bouton « Comptes » par rubrique.
- La TAILLE DU TEXTE, posée par la sauvegarde d'avant la coupure, est
  RETIRÉE · le zoom du navigateur la couvre déjà (critère du plan du
  2026-10-29, « déjà couverte autrement »), et un zoom posé par le logiciel
  décalait les fenêtres, qui se déplacent au pointeur.

### 96 · Langue de l'interface (mécanisme posé, anglais non proposé)

- `client/src/lib/traduction.ts` (anglais du cadre, clé = texte français),
  `lib/langue.tsx` (langue lue sur les préférences), traduction au RENDU
  dans `MenuBar.tsx`, `Fenetre.tsx` (boutons du titre), `StatusBar.tsx`.
  `traduction.spec.ts` exige l'anglais de chaque libellé écrit du menu.
- L'ANGLAIS N'EST PAS PROPOSÉ · le serveur ne propose que le français
  (`LANGUES_PROPOSEES`) et refuse `EN` en 400 nommé ; l'écran n'offre aucun
  choix tant qu'il n'y en a qu'un.

### 101 · Organisation du cabinet en niveaux · NON CODÉE (question à Manasse)

Voir « Questions pour Manasse ».

## Décisions et fondement


- 102 · AUDCIF art. 22, 7° (ce qui entre par transmission s'appuie sur une
  pièce probante · l'envoi, cité par son numéro et l'empreinte de son
  fichier) ; art. 22, 2° (rien n'entre au livre-journal sans le dossier qui
  reçoit · tout naît au brouillard ; une écriture validée ici ne se remplace
  plus) ; art. 20, al. 2 (la correction d'une validée passe par une
  inscription en négatif).
- 95 · Code du numérique (ordonnance-loi n° 23/10 du 13 mars 2023), art. 194
  (données non excessives · ni IP ni empreinte du navigateur pour la
  présence) ; art. 193, 3° (conservation bornée · trente et un jours pour la
  présence, suppression d'un message retiré par tous) ; art. 193, 2°
  (traitement confidentiel · la correspondance ne se lit que par ses
  correspondants, et son objet et son corps ne passent pas au journal
  d'audit, que d'autres lisent).

- 100 · Code du numérique, art. 193, 3° (conservation bornée · une
  notification lue se retire quatre-vingt-dix jours après sa lecture,
  convention d'OmegaX dans cette borne) ; art. 193, 2° (la notification d'un
  message ne va qu'à ses destinataires). AUDCIF art. 22, 2° (les écritures
  reçues naissent au brouillard · d'où la notification à ceux qui valident).
- 96 · la comptabilité se tient en français · loi n° 23/053, art. 141, 1°
  (« de tenir leur comptabilité en français ») ; AUDCIF art. 17, 1° (« dans
  la langue officielle », non écarté par l'art. 3 du SYCEBNL) ; Constitution,
  art. 1er (« Sa langue officielle est le français »). D'où · plan,
  intitulés, libellés, pièces, livres, états, notes et documents remis
  restent en français ; les MESSAGES DU SERVEUR aussi (un refus cite son
  article mot pour mot, CLAUDE.md § 6). Seul le CADRE se traduirait.
- 96 · LE CONTRAT DIT LE CONTRAIRE DE LA DEMANDE, dit avant de coder · le
  contrat de licence en vigueur (version 3 du 29 octobre 2026), art. 3,
  troisième alinéa · « L'interface d'OmegaX, ses documents et le présent
  contrat sont en français, seule langue proposée. » Proposer l'anglais
  rendrait cette phrase fausse ; une version publiée ne se réécrit pas
  (contrat, art. 15) et une version nouvelle suit les délais du Code du
  numérique, art. 34. Le mécanisme est donc posé, l'anglais refusé au
  serveur (pas seulement masqué, CLAUDE.md § 4) jusqu'à la décision de
  l'éditeur.

## Relecture « échecs silencieux » (deux tours, sur la ligne entière)

- Tour 1 · la lecture qui compose une notification (adresse de
  l'expéditeur, bornes de l'exercice) passe sous la garde de
  `notifierSansEchec` · lue avant, son échec rendait une erreur 500 sur un
  message envoyé ou un exercice clôturé, que l'utilisateur refaisait. Les
  destinataires se lisent par tranches, par la clé · la borne de mille les
  taisait. L'aide à la formule refuse un plan qu'elle ne lirait pas en
  entier (« aucun compte sous 79 » à tort) et une formule donnée deux fois
  (erreur 500).
- Tour 2 · une réponse périmée de l'aide à la formule (deux rubriques
  demandées de suite) est jetée ; la liste des destinataires d'un message,
  bornée, le dit à l'écran. Rien d'autre à reprendre.
- Rejeu · `scripts/rejouer-dossier-l9.cjs` étendu (notifications,
  préférences, clôture notifiée, refus de l'anglais, aide à la formule) ·
  conforme (trente-cinq vérifications), sur PostgreSQL 16 jetable. Une
  exécution sur cinq a rendu un échec dont la sortie a été coupée à
  l'affichage (le motif n'a pas été lu) ; les quatre suivantes, conformes.
  `scripts/rejouer-echange-ecritures.cjs` rejoué · conforme. Dérive de
  migration contrôlée (`prisma migrate diff`) · aucune.

## Relecture indépendante de la ligne (coordinateur), constats corrigés

- B1 · un fichier déjà reçu se RELIT · seule une réception en cours sur un
  autre poste refuse. Le registre laisse ce qui est entré (« déjà reçue par
  cet envoi »), fait naître ce qui n'y est pas, rejoue un remplacement
  refusé ; la reprise est prise par un `updateMany` filtré sur l'état et
  l'instant lus (m2). Les nombres de la réception s'ajoutent. Tests ·
  `decisionPour` (refus, correction, relecture), source du service ; rejeu ·
  journal absent, refusée, journal créé, relue, entrée.
- M1 · le remplacement qui change de journal, d'exercice ou de mois retire
  et recrée DANS LA MÊME TRANSACTION (`ecrireLesPieces(tx, …)` dans le
  `liberer` de `supprimer`). Test de source, rejeu (registre sur la
  remplaçante, l'ancienne retirée, 4452 inchangé).
- M2 · la date de valeur (AUDCIF art. 22, 4°) est lue (« Jour de valeur »),
  entre dans l'empreinte et la cohérence des lignes, est posée à la création
  et au remplacement en place (`modifierPieceDuModule`, champ `dateValeur`).
- M3 · le taux voyage par son code (« Code taxe », DERNIÈRE colonne de
  l'export, entré dans l'empreinte de l'export seulement quand il est présent
  · une pièce du brouillard à taux déjà partie repart une fois « Modifiée »),
  résolu chez celui qui reçoit, refus nommé si le code manque ou dort ; une
  ligne 443 ou 445 reçue sans taux est NOMMÉE au compte rendu. Tests · `juger`
  sur les trois cas ; rejeu (4452 reçue avec TVA16).
- Mineurs · m1 message de la validée (détacher, puis négatif) ; m2 « plus
  récent » faux à numéro égal ; m3 pièce reçue sans numéro dite ; m4
  `connectees` sur toutes les sessions ouvertes (test) ; m5 message de la
  langue ; m6 la panne se dit par sa catégorie au compte rendu, le détail au
  journal du serveur seul (test de source).

## Questions pour Manasse

1. **96 · ouvrir l'anglais.** Faut-il publier une version 4 du contrat de
   licence dont l'art. 3 dise « l'interface est en français ; son cadre
   (menus, boutons des fenêtres, barre d'état) est aussi proposé en anglais,
   la comptabilité, les états et les documents restant en français » ? Ce
   n'est qu'après sa publication et ses délais (Code du numérique, art. 34)
   qu'on ajoute `EN` à `LANGUES_PROPOSEES`. La question des FAQ et « À
   propos » (« seule langue disponible ») suivra le même jour. Choix de
   l'éditeur, qu'aucun texte ne tranche.
2. **101 · organisation du cabinet en niveaux, collaborateurs rattachés**
   (Sage, P_CDOSSIER, P_NIVEAU, F_LIENNIVEAU · manuel de structure, p. 601
   à 615). Aucun texte ne régit l'organisation interne d'un cabinet (lu · le
   plan du 2026-10-29, § 2, dit de même des directions d'une entité ; la
   fiche 15 la classe « choix commercial »). Et le modèle d'OmegaX ne la
   porte pas · un utilisateur appartient à UN dossier (`User.tenantId`) ; un
   collaborateur rattaché à plusieurs dossiers du cabinet suppose un accès
   d'un compte à plusieurs dossiers, que le cloisonnement (§ 8) et la
   révocation des sessions ne connaissent pas. Trois issues · (a) écarter ;
   (b) un ANNUAIRE du cabinet dans la console de l'éditeur seule (niveaux
   nommés librement, dossiers rangés dessous), sans aucun accès nouveau ;
   (c) le vrai rattachement multi-dossiers, chantier d'authentification
   à part. Rien n'est codé en attendant.

## Reste

- À l'intégration · `traduction.spec.ts` exige l'anglais de chaque libellé
  écrit du menu · les commandes entrées sur `main` depuis le départ de la
  ligne (paie-suite, immos, analytique…) devront recevoir le leur.
- Les migrations de la ligne sont renumérotées `20270220000101` à `…103`
  (`main` a pris `20270220000100` à `…400` entre-temps).

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
DATABASE_URL=postgresql://postgres@localhost:5432/<base jetable migrée> node scripts/rejouer-echange-ecritures.cjs
```
