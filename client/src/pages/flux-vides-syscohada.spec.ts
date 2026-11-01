import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SECOND TOUR DU PAQUET 1, LIGNE A, MINEUR 3 · l'écran SYSCOHADA écrivait
 * 0,00 sur un poste du tableau des flux que le serveur laisse vide (paquet 1,
 * A7), là où l'écran du SYCEBNL écrit « · ». Les deux passent par la même
 * règle (`montantDuPosteDeFlux`) · on gèle l'appel dans la cellule de la
 * colonne N, découpée dans le corps de `ligneFlux`.
 */
describe('tableau des flux SYSCOHADA · un poste vide ne s’écrit pas 0,00', () => {
  it('la colonne N passe par montantDuPosteDeFlux avec les postes vides servis', () => {
    const source = readFileSync(join(__dirname, 'EtatsFinanciersSyscohadaPage.tsx'), 'utf8');
    const debut = source.indexOf('const ligneFlux = (l: LigneFluxSyscohada)');
    expect(debut).toBeGreaterThan(-1);
    const corps = source.slice(debut, source.indexOf('\n  };\n', debut));
    expect(corps).toContain('montant(montantDuPosteDeFlux(l.ref, l.montant, tft?.postesVides))');
    expect(corps).not.toMatch(/montant\(l\.montant\)/);
  });
});
