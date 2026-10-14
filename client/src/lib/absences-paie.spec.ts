import { lignesProposees, traitementsOuverts, type PropositionDuMois } from './absences-paie';

// Aucun import de « vitest » · convention du dépôt.

/**
 * LIGNE SAGE-L5, FONCTION 78 · la proposition du mois reprise au bulletin.
 * Ce qui casserait en silence · une indemnité ajoutée deux fois au second
 * clic, un salaire posé quand la proposition ne se chiffre pas.
 */

type Ligne = { nature: string; libelle: string; montantFc: string };
const vierge: Ligne = { nature: 'SALAIRE_OU_TRAITEMENT', libelle: '', montantFc: '' };
const enChamp = (n: number) => n.toFixed(2);
const proposition = (p: Partial<PropositionDuMois> = {}): PropositionDuMois => ({
  joursDeuxTiers: 3,
  joursNonDus: 2,
  joursNonTranches: 0,
  joursPayesAPlein: 21,
  salaireDesJoursDus: 420_000,
  indemniteDeuxTiers: 40_000,
  deductionsCaisse: 0,
  aRecevoirDeLaCaisse: 0,
  motifs: [],
  explication: null,
  ...p,
});

describe('la proposition du mois reprise au bulletin', () => {
  it('remplace le montant de la ligne de salaire et ajoute UNE indemnité, même reprise deux fois', () => {
    const lignes: Ligne[] = [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: '520000' }, { nature: 'PRIME', libelle: 'Prime', montantFc: '10000' }];
    const une = lignesProposees(lignes, proposition(), vierge, enChamp)!;
    const deux = lignesProposees(une, proposition(), vierge, enChamp)!;
    expect(deux.map((l) => [l.nature, l.montantFc])).toEqual([
      ['SALAIRE_OU_TRAITEMENT', '420000.00'],
      ['PRIME', '10000'],
      ['INDEMNITE_INCAPACITE_OU_ACCOUCHEMENT', '40000.00'],
    ]);
    expect(deux[0].libelle).toBe('Salaire');
  });

  it('ne pose rien quand la proposition ne se chiffre pas', () => {
    expect(lignesProposees([vierge], proposition({ salaireDesJoursDus: null }), vierge, enChamp)).toBeNull();
    expect(lignesProposees([vierge], proposition({ indemniteDeuxTiers: null }), vierge, enChamp)).toBeNull();
  });

  it('sans ligne de salaire, en crée une en tête', () => {
    const r = lignesProposees([], proposition({ joursDeuxTiers: 0, indemniteDeuxTiers: 0 }), vierge, enChamp)!;
    expect(r.map((l) => [l.nature, l.libelle, l.montantFc])).toEqual([['SALAIRE_OU_TRAITEMENT', 'Salaire des jours dus', '420000.00']]);
  });
});

describe('les traitements de l’indemnité de la Caisse ouverts à une cause', () => {
  it('la déduction à l’accident du travail, la subrogation partielle à la maternité, rien à la maladie', () => {
    expect(traitementsOuverts('ACCIDENT_DU_TRAVAIL_OU_MALADIE_PROFESSIONNELLE')).toEqual(['DEDUITE', 'SUBROGATION']);
    expect(traitementsOuverts('MATERNITE')).toEqual(['SUBROGATION', 'SUBROGATION_PARTIELLE']);
    expect(traitementsOuverts('MALADIE_OU_ACCIDENT')).toEqual([]);
  });
});
