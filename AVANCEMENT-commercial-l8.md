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

## Reste

Voir la section « Étapes » ci-dessous, tenue à chaque commit.

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
- D4 · articles et tarifs ouverts aux deux référentiels · l'association
  vend « à titre accessoire » (loi n° 004/2001, art. 1er ;
  `docs/comparaison-sage/reproduction/architecture.md`, D5).

## Commandes de vérification

```bash
npx prisma generate && npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
