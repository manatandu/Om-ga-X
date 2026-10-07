// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RELECTURE DU 2026-10-07, MINEURS ÉCRAN · la déclaration de TVA dit à part
 * la part déclarée non retenue, et le droit de l'imputation vit dans la
 * bulle ; le calcul de l'IS tait une ligne que le serveur ne sert pas, et
 * reçoit le chiffre d'affaires de la période déclaré avec son bénéfice (C09).
 */
const tva = readFileSync(join(__dirname, 'DeclarationTvaPage.tsx'), 'utf8');
const fiscalite = readFileSync(join(__dirname, 'FiscalitePage.tsx'), 'utf8');

describe('la déclaration de TVA · imputation des paiements', () => {
  it('la part déclarée non retenue est un avertissement à part, la facture et la somme dites', () => {
    const i = tva.indexOf('Imputation déclarée non retenue');
    expect(i).toBeGreaterThan(0);
    const bloc = tva.slice(tva.lastIndexOf('<div', i), i);
    expect(bloc).toContain('role="alert"');
    expect(tva).toContain('.filter((g) => (g.declareNonRetenu ?? 0) > 0)');
  });

  it('second tour, M-b · la déclaration qu’un groupe lu en bloc n’a pas lue est un avertissement, avec le motif du serveur', () => {
    const i = tva.indexOf('Imputation déclarée non lue');
    expect(i).toBeGreaterThan(0);
    const bloc = tva.slice(tva.lastIndexOf('<div', i), i);
    expect(bloc).toContain('role="alert"');
    expect(tva).toContain('.filter((g) => (g.declarationsNonLues ?? 0) > 0)');
    expect(tva).toContain('(${g.motif})');
  });

  it('le droit de l’imputation est dans la bulle, avec sa source', () => {
    const i = tva.indexOf('titre="Imputation des paiements"');
    expect(i).toBeGreaterThan(0);
    expect(tva.slice(i, tva.indexOf('/>', i))).toContain('source="Code civil, Livre III, art. 151 à 154');
  });
});

describe('le calcul de l’IS · période de création', () => {
  it('la ligne du chiffre d’affaires du minimum se tait quand le serveur ne la sert pas', () => {
    expect(fiscalite).toContain('{resultat.chiffreAffairesMinimum !== undefined && (');
  });

  it('le chiffre d’affaires de la période se déclare avec son bénéfice, jamais seul', () => {
    expect(fiscalite).toContain("{peutEcrire && resultat.periodeCreation.source === 'DECLARE' && resultat.periodeCreation.sourceChiffreAffaires !== undefined && (");
    expect(fiscalite).toContain('modifierDossier({ chiffreAffairesPeriodeCreationSaisi: n });');
  });
});
