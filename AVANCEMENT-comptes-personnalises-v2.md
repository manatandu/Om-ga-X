# Avancement · comptes personnalisés v2

Branche de sauvegarde `travail/comptes-personnalises-v2`. Fiche retirée à
l'intégration sur `main`.

## Décisions (Manasse, 2026-10-09, quatre réponses)

- Personnaliser = adopter le compte du plan tel quel, ou ouvrir un sous-compte sous lui.
- Écritures automatiques (modules, clôture, imports) = adoption d'office, dite au Plan comptable.
- Tiers et banque = deux voies · compte ouvert depuis la fiche, ou compte existant déjà personnalisé.
- Dossiers existants = les comptes utilisés restent personnalisés, d'office.
- Aucun texte n'impose la règle · AUDCIF art. 18, al. 3 (faculté d'ouvrir des subdivisions). Règle d'organisation d'OmegaX.

## Fait

- Serveur · `comptesNonPersonnalises`, `motifComptesNonPersonnalises` (comptes-proposes.ts) ;
  `EcritureService.verifierComptesPersonnalises` au contrôleur (saisie, modification,
  réimputation, cible de fusion) ; refus au rattachement d'un tiers et au compte existant
  d'un journal ; héritage des réglages du compte du plan à la création d'un sous-compte ;
  `GET /comptes/:id/sous-compte-propose` ; « ne garder que les utilisés » borné au plan officiel.
- Migration `20270164000000_comptes_personnalises` · dossiers au plan entier retenu par défaut.
- Client · Plan comptable (option « Comptes personnalisés seulement » gardée par dossier,
  colonne Personnalisé, boîte Personnaliser), saisie (numéro non personnalisé nommé, jamais
  pris), libellés « personnalisez-le dans Plan comptable ».
- Tests · `comptes-personnalises.spec.ts` (19), doublures complétées, e2e
  `comptes-personnalises.e2e.ts` (parcours à travers une clôture), `appelApi` adopte les
  comptes saisis comme le cabinet le ferait.
- CLAUDE.md § 6, paragraphe « Comptes retenus ».

## Reste

- Relectures (échecs silencieux, TypeScript, React) et leurs corrections.
- Tests navigateur locaux, puis suite entière.
- Intégration sur `main`, bloc § 3, déploiement vérifié.

## Vérification

```bash
npx tsc --noEmit && npx jest
cd client && npx tsc --noEmit && npx vitest run
/tmp/claude-0/e2e-v2.sh   # base jetable, serveur compilé, client relayé
```
