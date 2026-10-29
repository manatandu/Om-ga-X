import {
  datesDuBilanSocial,
  formulaireBilanSocial,
  LIGNES_BILAN_SOCIAL,
  motifRefusSaisie,
  normaliserSaisie,
} from './bilan-social';

// Aucun import de « vitest » (globales) · convention du dépôt.

const identite = { nom: 'Rejeu SARL', numeroAffiliationCnssEmployeur: 'CNSS-1', activite: 'Commerce', formeJuridique: 'Société à responsabilité limitée' };
const remplir = (saisie: Parameters<typeof formulaireBilanSocial>[0]['saisie'], proposition: string | null = null) =>
  formulaireBilanSocial({ exercice: 2025, identite, effectifActif: 7, remunerationsProposees: proposition, saisie, enregistreLe: null, enregistrePar: null });

describe('bilan social de l’ONEM', () => {
  it('reprend les vingt et une lignes du formulaire, dans son ordre', () => {
    expect(LIGNES_BILAN_SOCIAL).toHaveLength(21);
    expect(LIGNES_BILAN_SOCIAL[0]).toEqual({ numero: 1, libelle: 'Frais scolaire enfants des travailleurs' });
    expect(LIGNES_BILAN_SOCIAL[9].libelle).toBe('Rémunération annuelles');
    expect(LIGNES_BILAN_SOCIAL[20]).toEqual({ numero: 21, libelle: 'Imprévus et non budgétises' });
  });

  it("l'exercice E se dépose au plus tard le 31 janvier E+1 (art. 3)", () => {
    expect(datesDuBilanSocial(2025)).toEqual({ du: '2025-01-01', au: '2025-12-31', dateLimite: '2026-01-31' });
  });

  it('refuse un montant sans monnaie, une ligne hors du formulaire, un doublon, un montant illisible', () => {
    expect(motifRefusSaisie({ lignes: [{ numero: 1, budgete: '100.00' }], commentaire: null })).toMatch(/exige sa monnaie/);
    expect(motifRefusSaisie({ lignes: [{ numero: 22 }] })).toMatch(/hors du formulaire/);
    expect(motifRefusSaisie({ lignes: [{ numero: 2 }, { numero: 2 }] })).toMatch(/deux fois/);
    expect(motifRefusSaisie({ lignes: [{ numero: 3, realise: '1,5', devise: 'CDF' }] })).toMatch(/deux décimales/);
    expect(motifRefusSaisie({ lignes: [{ numero: 3, realise: '10', devise: 'EUR' }] })).toMatch(/CDF ou USD/);
    expect(motifRefusSaisie({ lignes: [{ numero: 3, nombre: -1 }] })).toMatch(/entier positif/);
    expect(motifRefusSaisie({ lignes: [{ numero: 3, nombre: 4, budgete: '10.5', devise: 'USD' }], commentaire: 'ok', lu: null })).toBeNull();
    expect(motifRefusSaisie({ lignes: [], intrus: 1 })).toMatch(/Champ inconnu/);
  });

  it('le solde est le budgétisé moins le réalisé, au centime, et le total ne mêle jamais les monnaies', () => {
    const f = remplir({
      lignes: [
        { numero: 1, nombre: 12, budgete: '1000.10', realise: '900.05', devise: 'CDF' },
        { numero: 2, nombre: null, budgete: '50', realise: '75.5', devise: 'USD' },
        { numero: 8, nombre: null, budgete: '0.20', realise: null, devise: 'CDF' },
      ],
      commentaire: null,
    });
    expect(f.lignes[0].solde).toBe('100.05');
    expect(f.lignes[1].solde).toBe('-25.50');
    expect(f.lignes[7].solde).toBeNull();
    expect(f.total).toEqual([
      { devise: 'CDF', budgete: '1000.30', realise: '900.05', solde: null, incomplet: true },
      { devise: 'USD', budgete: '50.00', realise: '75.50', solde: '-25.50', incomplet: false },
    ]);
  });

  it('la ligne 10 reçoit une proposition, jamais substituée à la saisie', () => {
    const f = remplir(null, '12345678.90');
    expect(f.lignes[9].realise).toBeNull();
    expect(f.lignes[9].proposition).toMatchObject({ realise: '12345678.90', devise: 'CDF' });
    expect(f.lignes.filter((l) => l.proposition !== null)).toHaveLength(1);
  });

  it("l'identification dit l'effectif actif au 31 décembre et laisse l'ONEM et l'INPP en blanc", () => {
    const f = remplir(null);
    expect(f.identification.find((c) => c.libelle === 'Effectif actif')!.valeur).toBe('7');
    expect(f.effectifActifAu).toBe('2025-12-31');
    expect(f.identification.find((c) => c.libelle === 'N° Aff. ONEM')!.valeur).toBeNull();
  });

  it('la saisie gardée retire les lignes vides et la monnaie sans montant', () => {
    const s = normaliserSaisie({ lignes: [{ numero: 5, nombre: null, budgete: null, realise: null, devise: 'CDF' }, { numero: 2, nombre: 3, budgete: null, realise: null, devise: 'USD' }], commentaire: '  ' });
    expect(s).toEqual({ lignes: [{ numero: 2, nombre: 3, budgete: null, realise: null, devise: null }], commentaire: null });
  });
});
