# Ligne commercial-site · avancement

Gel levé par Manasse le 2026-11-01 (« Fais tout le point 1 »). Branche de
sauvegarde `travail/commercial-site`. Hors ligne · le paiement par mobile money
(choix du prestataire par Manasse).

## 1. Refus par le serveur des logiciels non attribués

Fait
- `src/common/logiciels/logiciels-des-routes.ts` · table fermée contrôleur
  → logiciel(s), lectures partagées (`lecture`, `TOUS`), méthodes rangées à
  part, contrôleurs communs avec motif ; `motifRefusLogiciel`.
- `JwtAuthGuard`, étape 3 bis, après le profil de fonctions · 403 nommé.
- `JwtStrategy` porte `restreindreLogiciels` et `logicielsAutorises`.
- `definirLogiciels` ferme les sessions (sauf administrateur, jamais restreint).
- Client · `/impressions-differees` quitte les chemins communs pour les
  tuiles Comptabilité, Tiers et trésorerie, Révision et audit (elle produit
  les livres, que le serveur refuse aux autres).
- `logiciels-des-routes.spec.ts` · table fermée contre les sources, et
  relevé des écrans de chaque tuile (appels `api.*` à chemin littéral,
  imports suivis) · aucun appel refusé à un utilisateur qui n'a que la tuile.
- e2e · `logiciels-refus.e2e.ts` (chaque commande de chaque tuile ouverte
  par un collaborateur restreint, contre-épreuve nommée) ;
  `ecran-logiciels.e2e.ts` mis à jour (l'attribution ferme les sessions).

Décisions
- Lecture d'une structure (comptes, journaux, taxes, devises, tiers, modes
  et modèles de règlement, banques, exercices, paramètres du dossier) ouverte
  à toute tuile · elle alimente les listes de choix de chaque écran.
- Un contrôleur inconnu de la table est refusé à l'utilisateur restreint
  (le spec empêche qu'il en existe un).

Reste · voir la section 2.

## 2. Formulaire de demande sur la page publique

En cours.

## Vérification

```bash
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npm test && npm run build
```
