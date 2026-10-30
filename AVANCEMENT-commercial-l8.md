# Avancement · ligne commercial-l8 (Sage L8)

Branche de sauvegarde `travail/commercial-l8`. Fonctions 90, 91, 94, 25 et 30
de `docs/comparaison-sage/15-absents-a-trier.md`, levées par
`docs/plan-gel-leve-2026-10-29.md` (§ 4). Le bon de commande au SYSCOHADA est
ÉCARTÉ (même plan).

## Fait

- Étape a (sauvegarde du prédécesseur, relue et compilée) · articles
  commerciaux et tarifs par client (`src/modules/commercial/articles*.ts`,
  fenêtre Structure > Gestion commerciale > Articles et tarifs). Migration
  renumérotée `20270230000001_articles_commerciaux` (bloc de la ligne).
  Retiré · la garde `GestionCommercialeGuard`, qui REFUSAIT l'écriture d'un
  dossier sans le module · contraire à la règle « masquer n'est pas refuser »
  (`tenant/modules-optionnels.ts`, décision de Manasse du 2026-09-28) ; le
  menu masque, la route reste ouverte comme celles des devis et du magasin.
  Retirée aussi la promesse « la livraison sort la quantité du magasin » ·
  aucune pièce commerciale ne mouvemente le magasin (§ 4, pas de fonction
  annoncée qui n'existe pas). Fusion de tiers · tarif en double retiré ligne
  par ligne (journal d'audit), jamais par `deleteMany`.

- Étapes b, c, d (un commit) ·
  - 94 · modes d'arrondi (`commercial/arrondi.ts`, `ModeArrondi`, fenêtre
    Structure > Gestion commerciale > Modes d'arrondi) · le PRIX NET proposé
    (prix moins la remise) s'arrondit au pas du mode de l'article, sinon au
    centime, en centimes entiers ; jamais la taxe ni un total.
  - 91 · collaborateurs et leurs six rôles (`Collaborateur`, fenêtre
    Collaborateurs), représentant d'un tiers (`Tiers.representantId`) ·
    vendeur pour un client ou un adhérent, acheteur pour un fournisseur ;
    retrait du rôle ou mise en sommeil refusés tant qu'il représente.
  - 25 · devise habituelle du tiers (`Tiers.deviseId`) · proposée sur la
    ligne de saisie d'un de ses comptes (`GET /tiers/devises-des-comptes`),
    rappelée à la facture, jamais convertie.
  - 30 · encours maximum du client (`Tiers.encoursMaximum`,
    `commercial/encours-client*.ts`, `GET /commercial/encours/:tiersId`) ·
    solde de ses comptes à la date (remontée sur l'exercice précédent ouvert
    sans ouverture) + factures de vente non passées + vente en préparation ;
    AVERTI à l'écran de facturation et dans la réponse d'enregistrement,
    jamais refusé ; illisible, « non calculé ».
  - 90 · la ligne de facture prend l'article (`LigneFacture.articleId`,
    RESTRICT) et la remise (`remisePourcent`), imprimée sur la pièce ;
    l'écran propose désignation, prix, remise, taux et montant HT net.
- Migrations `20270230000002` à `20270230000004`, contrôlées par
  `prisma migrate diff` sur base jetable (aucune différence).

- Rejeu sur base PostgreSQL 16 jetable locale, serveur compilé, à travers la
  clôture de 2026 (`scripts/rejouer-commercial-l8.cjs`) · encours lu en 2027
  avant la clôture (remontée) puis après (à-nouveau), 80 000 les deux fois ;
  prix net 26 300 (30 000 moins 12,5 %, cent francs supérieur) ; facture de
  78 900 avertie (158 900 pour 150 000), ligne qui garde article et remise,
  article facturé non supprimable ; retrait du rôle de vendeur refusé en 409.
  Tout conforme.
- Relecture adverse des échecs silencieux · (1) remise portée sans être
  déduite du montant HT · avertie à l'enregistrement (`avertissementsLignes`) ;
  (2) devise proposée en saisie qui suivait un autre compte · retirée quand le
  compte change ; (3) fusion de tiers · représentant et devise comblent le
  vide, l'ENCOURS MAXIMUM du doublon jamais (il ouvrirait un crédit que
  personne n'a consenti) ; (4) lecture de l'encours qui échoue à la facture ·
  dite, la facture reste enregistrée.

- Relecture indépendante (aucun BLOQUANT, quatre MAJEURS, neuf mineurs),
  corrigée après fusion de `origin/main` ·
  - M1 · la taxe de la ligne se repropose (taux × HT au centime) à chaque
    changement d'article, de HT, de taux ou d'exonération, vide sans taux ou
    non imposable (`taxeProposee`) ; le serveur avertit une ligne non
    imposable qui porte une taxe.
  - M2 · le serveur avertit une taxe qui s'écarte de taux × HT de plus d'un
    centime (taxe calculée sur le brut avant remise).
  - M3 · l'encours et la devise proposée écartent un collectif qui porte des
    comptes individuels ; le seul collectif rattaché rend « non calculé ».
  - M4 · la modification d'un article ne rejuge que les liens qu'elle change.
  - Mineurs · note de crédit et facture non passées comptées chacune ; pièces
    datées au plus tard du jour lu ; arrondi au-dessus du brut ou à zéro dit ;
    taux et mode en sommeil non proposés et dits, mode en sommeil porté dit ;
    jeton de réponse périmée, tarif relu au changement de client, taxe de
    l'article précédent jamais héritée ; panne de l'encours au journal du
    serveur, motif fixe à l'écran ; comptage par type en base ; date stricte ;
    compte des articles proposé au passage de la facture au journal.
  - Rejeu étendu (taxe sur le brut, taxe juste, ligne exonérée taxée, tiers
    hérité sur le collectif) · conforme.

## Reste

- Deux tours de relecture et tests navigateur avant l'intégration sur
  `main` (non lancés ici).
- La jambe PostgreSQL 18 et 17 du portillon n'a pas été rejouée localement
  (seul PostgreSQL 16 est installé dans ce conteneur).

## Écarté de la fonction 90, avec son motif

Gammes, caisse de comptoir (décret n° 23/10, art. 3, 7° et 20 à 22 · OmegaX
n'est pas homologué, aucun ticket ne vaut facture), site marchand, agenda,
codes-barres, glossaires, catalogue, commissions, fabrication et affaires,
abonnements commerciaux (les abonnements d'écriture existent), livraisons
et documents internes avec mouvement de stock (le magasin garde seul ses
mouvements · une sortie par la facture doublerait la valorisation). Le bon
de commande au SYSCOHADA est écarté par le plan.

## Étapes

1. (a) articles et tarifs · relu, compilé, bloc § 3.
2. (b) 94 modes d'arrondi et 91 collaborateurs (représentant du client).
3. (c) 25 devise du tiers et 30 encours maximum du client.
4. (d) la ligne de facture prend l'article · prix proposé, remise portée sur
   la facture.
5. Relecture adverse des échecs silencieux, rejeu sur base jetable.

## Décisions prises, avec leur texte

- D1 · le compte de vente est un compte de la classe 7, celui d'achat de la
  classe 6 hors 603 (AUDCIF Titre VII, compte 70, « crédité du montant des
  facturations hors taxes » ; compte 60, « Achats (sauf 603) » ; SYCEBNL
  Partie 2 ch. 3, classe 7, même phrase). Seule la classe est jugée, aucun
  numéro écrit.
- D2 · le prix d'un article et le tarif d'un client sont PROPOSÉS, jamais
  imposés · « l'acheteur est tenu de payer le prix convenu. Le prix exprimé
  dans le contrat est présumé convenu hors taxes » (AUDCG art. 263).
- D3 · la remise se porte SUR LA FACTURE · AUDCIF Titre VII, compte 70 (prix
  « déductions faites des rabais et remises lorsqu'ils sont déduits sur la
  facture elle-même ») ; O.-L. n° 10/001, art. 29, et décret n° 011/42,
  art. 79 (remises exclues de la base « figurant sur facture initiale ou
  rectificative »).
- D5 · arrondi · aucun texte lu ne fixe l'arrondi d'un prix (AUDCG art. 263,
  prix convenu) · convention du dossier, sur le prix net PROPOSÉ seulement ;
  la taxe se calcule sur le montant HT qui figure (O.-L. n° 10/001, art. 29).
- D6 · encours · aucun texte lu n'impose ni ne borne le crédit client · on
  AVERTIT, jamais on ne refuse (la facture est due pour chaque transaction,
  loi de procédures fiscales, art. 23). En francs (loi n° 23/053, art. 141,
  1°), lignes en devise pour leur contrevaleur historique, dit.
- D7 · devise du tiers · la monnaie de tenue n'est pas une devise (loi
  n° 23/053, art. 141, 1° ; refus du franc comme la ligne en devise, F49) ;
  aucun texte lu ne régit la monnaie d'une facture · la facture OmegaX reste
  en francs, la devise y est rappelée.
- D8 · collaborateurs · aucun texte ne régit cette structure ; un rôle ne
  donne aucun droit (les droits restent ceux du rôle d'utilisateur).
- D4 · articles et tarifs ouverts aux deux référentiels · l'association
  vend « à titre accessoire » (loi n° 004/2001, art. 1er ;
  `docs/comparaison-sage/reproduction/architecture.md`, D5).

## Commandes de vérification

```bash
npx prisma generate && npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
