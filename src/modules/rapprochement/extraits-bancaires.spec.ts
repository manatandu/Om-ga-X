import {
  COLONNES_EXTRAIT_FPM,
  ENTETES_EXTRAIT_FPM,
  MENTION_EXTRAIT,
  bornesDeLExtrait,
  lireSelection,
  motifRefusSelection,
  nomDeFeuilleExtrait,
  ordonnerExtraits,
  soldesProgressifs,
  totauxExtrait,
  type LigneExtrait,
} from './extraits-bancaires';

/**
 * LES RÈGLES PURES DES EXTRAITS BANCAIRES (ligne sage-l3, fonction 45,
 * décision D14) · ce qui casserait en silence est un solde progressif faux
 * (sens de la banque inversé, zéro présumé sans solde de départ), un ordre
 * d'édition qui ne suit pas la banque, deux feuilles au même nom (Excel
 * refuserait le classeur, ou l'une écraserait l'autre).
 */

const ligne = (rang: number, jour: string, debit: number, credit: number, rapprochee = false): LigneExtrait => ({
  rang,
  date: new Date(`${jour}T00:00:00.000Z`),
  libelle: `Ligne ${rang}`,
  reference: null,
  debit,
  credit,
  rapprochee,
});

describe('soldesProgressifs · le sens de la banque', () => {
  it('ajoute les crédits et retranche les débits depuis le solde de départ, arrondi au centime', () => {
    const lignes = [ligne(1, '2026-03-02', 0, 1000.1), ligne(2, '2026-03-03', 250.05, 0), ligne(3, '2026-03-04', 0, 0.2)];
    expect(soldesProgressifs(100, lignes)).toEqual([1100.1, 850.05, 850.25]);
  });

  it('sans solde de départ, aucune colonne de solde · un zéro présumé ferait lire un solde faux', () => {
    expect(soldesProgressifs(null, [ligne(1, '2026-03-02', 0, 10)])).toEqual([null]);
  });

  it('un solde de départ nul est un solde, pas une absence', () => {
    expect(soldesProgressifs(0, [ligne(1, '2026-03-02', 5, 0)])).toEqual([-5]);
  });
});

describe('totauxExtrait et bornesDeLExtrait', () => {
  it('totalise débits et crédits sur les lignes arrondies et rend le net vu du compte', () => {
    expect(totauxExtrait([ligne(1, '2026-03-02', 0.1, 0), ligne(2, '2026-03-03', 0.2, 0), ligne(3, '2026-03-04', 0, 1)])).toEqual({ debit: 0.3, credit: 1, net: 0.7 });
  });

  it('borne la période au premier et au dernier jour des lignes, la date du relevé comprise', () => {
    const tete = { dateReleve: new Date('2026-03-31T00:00:00.000Z') };
    expect(bornesDeLExtrait(tete, [ligne(1, '2026-03-05', 0, 1), ligne(2, '2026-03-02', 1, 0)])).toEqual({
      debut: new Date('2026-03-02T00:00:00.000Z'),
      fin: new Date('2026-03-31T00:00:00.000Z'),
    });
    expect(bornesDeLExtrait(tete, [])).toEqual({ debut: tete.dateReleve, fin: tete.dateReleve });
  });
});

describe('nomDeFeuilleExtrait · un nom par feuille, borné à 31 caractères', () => {
  it('numéro du compte et date du relevé, puis un suffixe quand le nom est pris', () => {
    const pris = new Set<string>(['Sommaire']);
    const d = new Date('2026-03-31T00:00:00.000Z');
    expect(nomDeFeuilleExtrait('52110001', d, pris)).toBe('52110001 2026-03-31');
    expect(nomDeFeuilleExtrait('52110001', d, pris)).toBe('52110001 2026-03-31 (2)');
    expect(nomDeFeuilleExtrait('52110001', d, pris)).toBe('52110001 2026-03-31 (3)');
    expect(pris.size).toBe(4);
  });

  it('un numéro long reste sous 31 caractères, suffixe compris', () => {
    const pris = new Set<string>();
    const d = new Date('2026-03-31T00:00:00.000Z');
    const premier = nomDeFeuilleExtrait('5211000100000000000000000', d, pris);
    const second = nomDeFeuilleExtrait('5211000100000000000000000', d, pris);
    expect(premier.length).toBeLessThanOrEqual(31);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second).not.toBe(premier);
    expect(second.endsWith(' (2)')).toBe(true);
  });
});

describe('motifRefusSelection et lireSelection', () => {
  it('refuse une borne qui n’est pas un jour, et un « du » après le « au »', () => {
    expect(motifRefusSelection({ du: '2026-13-01' })).toMatch(/« du »/);
    expect(motifRefusSelection({ au: 'hier' })).toMatch(/« au »/);
    expect(motifRefusSelection({ du: '2026-04-01', au: '2026-03-01' })).toMatch(/postérieure/);
    expect(motifRefusSelection({ du: '2026-03-01', au: '2026-03-01' })).toBeNull();
    expect(motifRefusSelection({})).toBeNull();
    expect(motifRefusSelection({ du: '', au: '' })).toBeNull();
  });

  it('lit les comptes sans doublon ni blanc, et les bornes à minuit UTC', () => {
    expect(lireSelection({ compteIds: ' a, b ,a,, ', du: '2026-03-01', au: '' })).toEqual({
      compteIds: ['a', 'b'],
      du: new Date('2026-03-01T00:00:00.000Z'),
      au: null,
    });
    expect(lireSelection({})).toEqual({ compteIds: [], du: null, au: null });
  });
});

describe('ordonnerExtraits · compte par compte, du plus ancien au plus récent', () => {
  const e = (id: string, compteNumero: string, jour: string) => ({ rapprochementId: id, compteNumero, dateReleve: new Date(`${jour}T00:00:00.000Z`) });
  const tous = [e('r3', '52110002', '2026-01-31'), e('r2', '52110001', '2026-02-28'), e('r1', '52110001', '2026-01-31'), e('r4', '52110002', '2026-03-31')];

  it('suit la chronologie de la banque dans chaque compte', () => {
    expect(ordonnerExtraits(tous, { compteIds: [], du: null, au: null }).map((x) => x.rapprochementId)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('écarte les extraits hors bornes, bornes incluses', () => {
    const s = { compteIds: [], du: new Date('2026-02-28T00:00:00.000Z'), au: new Date('2026-03-31T00:00:00.000Z') };
    expect(ordonnerExtraits(tous, s).map((x) => x.rapprochementId)).toEqual(['r2', 'r4']);
  });

  it('ne modifie pas la liste reçue', () => {
    const copie = [...tous];
    ordonnerExtraits(tous, { compteIds: [], du: null, au: null });
    expect(tous).toEqual(copie);
  });
});

describe('la feuille FPM d’un extrait', () => {
  it('a huit colonnes, chacune son en-tête, le solde et la marque de rapprochement en dernier', () => {
    expect(COLONNES_EXTRAIT_FPM.map((c) => c.cle)).toEqual(['rang', 'date', 'libelle', 'reference', 'debit', 'credit', 'solde', 'rapprochee']);
    expect(ENTETES_EXTRAIT_FPM.map((h) => h.colonne)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ENTETES_EXTRAIT_FPM.map((h) => h.texte)).toEqual(['N°', 'Date', 'Libellé', 'Référence', 'Débit (banque)', 'Crédit (banque)', 'Solde', 'Rapprochée']);
    expect(COLONNES_EXTRAIT_FPM.filter((c) => c.genre === 'montant').map((c) => c.cle)).toEqual(['debit', 'credit', 'solde']);
  });

  it('la mention dit que la pièce probante reste le relevé reçu (AUDCIF art. 22, 7° et art. 24)', () => {
    expect(MENTION_EXTRAIT).toMatch(/pièce probante reste le relevé reçu/);
    expect(MENTION_EXTRAIT).toMatch(/art\. 22, 7°/);
    expect(MENTION_EXTRAIT).toMatch(/art\. 24/);
  });
});
