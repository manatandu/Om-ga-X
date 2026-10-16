# AVANCEMENT · ligne virement-pieces (2026-10-16)

Demande de Manasse · « pièces justificatives demandé est pour quelle opération ?
Car dans le virement il y a deux opérations (la sortie et l'entrée des fonds).
Retire ces textes de trop « Virement banque vers caisse · compte de passage
58500002 · Virements de fonds · banque vers caisse ». T'es pas obligé de le
mentionner. »

Branche de sauvegarde · `travail/virement-pieces` (partie de `main` d461c28).

## Décision par la loi

- DEUX OPÉRATIONS, DEUX PIÈCES. Le virement passe deux écritures, une dans
  chaque journal auxiliaire (fiche du compte 58 des deux plans · « comptes de
  passage » des « comptabilités organisées sur la base de journaux
  auxiliaires »). Chaque écriture s'appuie sur SA pièce justificative et en
  porte les références (AUDCIF art. 17, 3° et 5° ; art. 22, 7°, « chaque
  enregistrement s'appuie sur une pièce justificative fiable et conservée »).
  La sortie se justifie par la pièce de l'origine (chèque, ordre de virement,
  bon de caisse), l'entrée par celle de la destination (bordereau de
  versement, avis de crédit, pièce de caisse). Rien n'interdit que les deux
  références coïncident quand un seul document justifie les deux côtés.
- CHAQUE ÉCRITURE EST DATÉE PAR SA PIÈCE · « Cette date est celle de
  l'émission par l'entité de la pièce justificative de l'opération, ou celle
  de la réception des pièces d'origine externe » (AUDCIF art. 16, al. 2 ; non
  écarté par l'art. 3 du SYCEBNL). La « date du virement » disparaît · la
  sortie est datée par sa pièce, l'entrée par la sienne.
- L'ENTRÉE N'EST PAS ANTÉRIEURE À LA SORTIE, ET LES DEUX TOMBENT DANS LE MÊME
  EXERCICE · le 585 attend l'entrée entre les deux dates (sa raison d'être),
  et il est « soldé à la fin de l'exercice » (fiche du compte 58, éléments de
  contrôle). Une entrée sur l'exercice suivant laisserait le 585 ouvert à la
  clôture · refus nommé, le virement se passe alors à la main.
- AUCUNE NATURE PAR DÉFAUT · une nature présélectionnée (« Ordre de
  virement ») se retrouvait sur la pièce d'une caisse.
- Le texte de sens et de compte de passage sort de l'écran (demande de
  Manasse) · il reste dans la bulle d'aide, au plan comptable et au journal.

## Fait

- (en cours) schéma, migration, DTO, règles, service, écran, specs, e2e.

## Reste

- Scénario sur vraie base à travers une clôture (sortie et entrée à deux
  dates, entrée le lendemain, entrée refusée sur N+1).
- Relectures (silent-failure-hunter, typescript-reviewer, react-reviewer).
- Bloc § 3, e2e local, intégration sur `main` après l'export par période.

## Vérification

```bash
npx tsc --noEmit && npx jest src/modules/virements-fonds
cd client && npx tsc --noEmit && npx vitest run src/lib/virement-fonds.spec.ts
```
