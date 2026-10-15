import { corpsCreationBien, etapesDe, ETAPES, lireMontant, manqueDeLEtape, saisieEnchainee, saisieVierge } from './assistant-bien';

/**
 * L'ASSISTANT DE CRÉATION D'UN BIEN (ligne sage-l4, n° 18). Ce qui
 * casserait en silence · un corps différent de celui du formulaire (deux
 * chemins, deux règles), une durée vide envoyée à zéro, un bien repris envoyé
 * avec un financement (une écriture d'acquisition qui doublerait le brut
 * d'un bien déjà au bilan d'ouverture), une série enchaînée qui garderait la
 * valeur du bien précédent.
 */
const base = () => ({
  ...saisieVierge('2026-03-01'),
  designation: ' Camion ',
  compteImmobilisationId: 'c-2451',
  valeurOrigine: '12000000',
  compteContrepartieId: 'c-4812',
  journalId: 'j-od',
});

describe('les étapes', () => {
  it('huit étapes, le financement sauté pour un bien repris', () => {
    expect(ETAPES).toHaveLength(8);
    expect(etapesDe({ repris: false })).toHaveLength(8);
    expect(etapesDe({ repris: true })).not.toContain('financement');
  });

  it('chaque étape dit ce qui lui manque, et seulement cela', () => {
    const vierge = saisieVierge('2026-03-01');
    expect(manqueDeLEtape('designation', vierge)).toMatch(/désignation/);
    expect(manqueDeLEtape('compte', vierge)).toMatch(/compte du bien/);
    expect(manqueDeLEtape('dates', { ...vierge, dateMiseEnService: '' })).toMatch(/Pas encore mis en service/);
    expect(manqueDeLEtape('dates', { ...vierge, dateMiseEnService: '', pasEncoreEnService: true })).toBeNull();
    expect(manqueDeLEtape('valeur', { ...vierge, valeurOrigine: '0' })).toMatch(/positive/);
    expect(manqueDeLEtape('financement', vierge)).toMatch(/financement/);
    expect(manqueDeLEtape('financement', { ...vierge, repris: true })).toBeNull();
    expect(manqueDeLEtape('plan', { ...vierge, modeAmortissement: 'UNITES_DOEUVRE' })).toMatch(/unités prévues/);
    expect(manqueDeLEtape('plan', { ...vierge, dureeAmortissementAns: '2,5' })).toMatch(/entier/);
  });
});

describe('le corps envoyé', () => {
  it('celui du formulaire · financement et journal, mise en service datée', () => {
    expect(corpsCreationBien({ ...base(), dureeAmortissementAns: '4' }, 'ex-n')).toEqual({
      compteImmobilisationId: 'c-2451',
      designation: 'Camion',
      dateAcquisition: '2026-03-01',
      dateMiseEnService: '2026-03-01',
      valeurOrigine: 12_000_000,
      dureeAmortissementAns: 4,
      modeAmortissement: 'LINEAIRE',
      compteContrepartieId: 'c-4812',
      journalId: 'j-od',
      exerciceId: 'ex-n',
    });
  });

  it('un bien repris part sans financement ni journal, avec son amortissement antérieur', () => {
    const corps = corpsCreationBien({ ...base(), repris: true, amortissementAnterieur: '3000000' }, 'ex-n');
    expect(corps).toMatchObject({ repris: true, amortissementAnterieur: 3_000_000 });
    expect(corps).not.toHaveProperty('compteContrepartieId');
    expect(corps).not.toHaveProperty('journalId');
  });

  it('pas encore en service · aucune date ; durée vide · rien, jamais zéro', () => {
    const corps = corpsCreationBien({ ...base(), pasEncoreEnService: true }, 'ex-n');
    expect(corps).not.toHaveProperty('dateMiseEnService');
    expect(corps).not.toHaveProperty('dureeAmortissementAns');
  });
});

describe('un montant tapé avec ses espaces', () => {
  it('se lit · espace, espace insécable et espace fine, virgule décimale', () => {
    expect(lireMontant('8 000 000')).toBe(8_000_000);
    expect(lireMontant('1\u00a0200\u00a0000,50')).toBe(1_200_000.5);
    expect(lireMontant('2\u202f500')).toBe(2_500);
    expect(lireMontant('  ')).toBeNull();
  });

  it('fait avancer l’étape et part juste dans le corps, jamais NaN', () => {
    const s = { ...base(), valeurOrigine: '12 000 000', valeurResiduelle: '1\u00a0000' };
    expect(manqueDeLEtape('valeur', s)).toBeNull();
    expect(corpsCreationBien(s, 'ex-n')).toMatchObject({ valeurOrigine: 12_000_000, valeurResiduelle: 1_000 });
    const repris = corpsCreationBien({ ...base(), repris: true, amortissementAnterieur: '3 000 000' }, 'ex-n');
    expect(repris).toMatchObject({ amortissementAnterieur: 3_000_000 });
  });

  it('un montant illisible arrête l’étape', () => {
    expect(manqueDeLEtape('valeur', { ...base(), valeurOrigine: '12 000 abc' })).toMatch(/valeur d'origine/);
    expect(manqueDeLEtape('valeur', { ...base(), repris: true, amortissementAnterieur: 'trois' })).toMatch(/déjà pratiqué/);
  });
});

describe('la création enchaînée', () => {
  it('garde la série, vide ce qui est propre au bien', () => {
    const suite = saisieEnchainee({ ...base(), numeroInventaire: 'V-01', valeurResiduelle: '100' });
    expect(suite).toMatchObject({ compteImmobilisationId: 'c-2451', compteContrepartieId: 'c-4812', journalId: 'j-od', dateAcquisition: '2026-03-01' });
    expect(suite).toMatchObject({ designation: '', numeroInventaire: '', valeurOrigine: '', valeurResiduelle: '' });
  });
});
