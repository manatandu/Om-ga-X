import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LA BALANCE ÂGÉE N'EST PAS LA BALANCE AUXILIAIRE.
 *
 * Le logiciel produisait la première et se croyait couvert sur la seconde.
 * Elles répondent à deux questions différentes : l'âgée ventile un solde par
 * tranche de retard (risque de non-recouvrement), l'auxiliaire porte les
 * MOUVEMENTS de la période tiers par tiers et le solde qui en résulte (base
 * de circularisation et rapprochement avec la balance générale). Tout dossier
 * de révision réel porte les deux.
 *
 * Ce spec lit le source plutôt que le classeur produit : ce qu'il verrouille
 * est la présentation relevée sur les balances auxiliaires du dossier ouvert
 * sur le Drive, et le fait qu'un compte de tiers orphelin ne disparaisse pas.
 */

// La balance auxiliaire EXPORTÉE est désormais la balance des tiers de la
// présentation du cabinet (ligne FPM, `export-fpm.service.ts`) · son classeur
// est relu cellule par cellule dans `export-fpm.spec.ts`. Ce spec garde ce qui
// tient au CALCUL, que l'écran et l'export partagent.
const service = readFileSync(join(__dirname, 'export-fpm.service.ts'), 'utf8');
const ecriture = readFileSync(
  join(__dirname, '..', 'comptabilite', 'ecriture.service.ts'),
  'utf8',
);

describe('balance auxiliaire · l’état qui manquait', () => {
  it('existe, et ne se confond pas avec la balance âgée', () => {
    expect(ecriture).toContain('async balanceAuxiliaire(');
    expect(ecriture).toContain('async balanceAgee(');
    expect(service).toContain('async balanceTiersEnFlux(');
  });

  it('n’écarte pas un compte de tiers sans tiers rattaché', () => {
    // C'est la ligne la plus utile de l'état : un 411 mouvementé que personne
    // ne réclame échappera à la circularisation. Le filtrer pour « faire
    // propre » supprimerait précisément l'anomalie que l'état doit révéler.
    expect(ecriture).toContain('sansTiers: !tiers');
    expect(ecriture).not.toContain('.filter((l) => parCompte.has(l.compteId))');
    expect(service).toContain('aucun tiers rattaché');
  });

  it('porte les deux colonnes de solde qui s’excluent', () => {
    expect(ecriture).toContain('soldeDebit: solde > 0 ? solde : 0');
    expect(ecriture).toContain('soldeCredit: solde < 0 ? -solde : 0');
  });
});
