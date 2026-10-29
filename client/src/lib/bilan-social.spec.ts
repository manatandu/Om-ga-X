import { lireMontantSaisi, saisieAEnvoyer } from './bilan-social';

describe('bilan social · saisie', () => {
  it('lit un montant tapé avec ses espaces et sa virgule, jamais un illisible en zéro', () => {
    expect(lireMontantSaisi('1 250 000,5')).toEqual({ valeur: '1250000.5' });
    expect(lireMontantSaisi('  ')).toEqual({ valeur: null });
    expect('erreur' in lireMontantSaisi('12,345')).toBe(true);
    expect('erreur' in lireMontantSaisi('-3')).toBe(true);
  });

  it('retire les lignes vides, garde la monnaie, nomme la ligne illisible', () => {
    const l = (numero: number, p: Partial<{ nombre: string; budgete: string; realise: string; devise: 'CDF' | 'USD' | '' }>) => ({ numero, nombre: '', budgete: '', realise: '', devise: '' as const, ...p });
    expect(saisieAEnvoyer([l(1, {}), l(2, { nombre: '3', budgete: '10', devise: 'USD' })], ' note ')).toEqual({
      corps: { lignes: [{ numero: 2, nombre: 3, budgete: '10', realise: null, devise: 'USD' }], commentaire: 'note' },
    });
    expect(saisieAEnvoyer([l(4, { realise: 'abc' })], '')).toEqual({ erreur: expect.stringContaining('Ligne 4') });
  });
});
