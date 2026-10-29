import { corpsModification, saisieDepuis, type ValeursFiche } from './fiche-immobilisation';

/**
 * LE CORPS DE LA MODIFICATION D'UNE FICHE (ligne sage-l4, n° 66) · seuls les
 * champs changés partent. Ce qui casserait en silence · la fiche renvoyée
 * entière, que le serveur lirait comme une modification à effet et refuserait
 * sur une écriture validée alors que seule la désignation a changé ; un
 * montant illisible envoyé comme zéro.
 */
const valeurs: ValeursFiche = {
  designation: 'Camion',
  numeroInventaire: 'INV-1',
  natureFiscaleCle: null,
  numeroSerie: 'SN-001',
  sectionAnalytiqueId: null,
  quantite: 1,
  compteImmobilisationId: 'c1',
  compteContrepartieId: 'c521',
  dateAcquisition: '2026-01-01',
  dateMiseEnService: '2026-01-01',
  valeurOrigine: 12_000_000,
  valeurResiduelle: 0,
  dureeAmortissementAns: 4,
  modeAmortissement: 'LINEAIRE',
  unitesOeuvrePrevues: null,
  uniteOeuvreLibelle: null,
  amortissementAnterieur: 0,
  repris: false,
};

describe('le corps de la modification', () => {
  it('rien n’a changé · corps vide', () => {
    expect(corpsModification(valeurs, saisieDepuis(valeurs))).toEqual({ corps: {}, illisibles: [] });
  });

  it('la seule désignation change · un seul champ part, libre', () => {
    const s = { ...saisieDepuis(valeurs), designation: ' Camion benne ' };
    expect(corpsModification(valeurs, s).corps).toEqual({ designation: 'Camion benne' });
  });

  it('un champ vidé s’efface par null, jamais par une chaîne vide', () => {
    const s = { ...saisieDepuis(valeurs), numeroInventaire: '', dateMiseEnService: '' };
    expect(corpsModification(valeurs, s).corps).toEqual({ numeroInventaire: null, dateMiseEnService: null });
  });

  it('la valeur se lit à la virgule et au centime · 12 000 000,00 inchangée ne part pas', () => {
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), valeurOrigine: '12 000 000,00' }).corps).toEqual({});
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), valeurOrigine: '15000000,5' }).corps).toEqual({ valeurOrigine: 15_000_000.5 });
  });

  it('un montant illisible est nommé, jamais envoyé ni lu comme zéro', () => {
    const r = corpsModification(valeurs, { ...saisieDepuis(valeurs), valeurOrigine: 'douze', dureeAmortissementAns: '5' });
    expect(r.illisibles).toEqual(['Valeur d’origine']);
    expect(r.corps).not.toHaveProperty('valeurOrigine');
  });

  it('le numéro de série (n° 71) est un champ libre · changé il part seul, vidé il part en null', () => {
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), numeroSerie: ' SN-002 ' }).corps).toEqual({ numeroSerie: 'SN-002' });
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), numeroSerie: '' }).corps).toEqual({ numeroSerie: null });
  });

  it('la quantité (n° 65) part en entier, champ libre · zéro ou une fraction est nommée, jamais envoyée', () => {
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), quantite: '20' }).corps).toEqual({ quantite: 20 });
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), quantite: '0' })).toEqual({ corps: {}, illisibles: ['Quantité'] });
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), quantite: '2,5' }).illisibles).toEqual(['Quantité']);
  });

  it('la section analytique (n° 70) se pose et se retire seule, champ libre', () => {
    expect(corpsModification(valeurs, { ...saisieDepuis(valeurs), sectionAnalytiqueId: 's1' }).corps).toEqual({ sectionAnalytiqueId: 's1' });
    const posee = { ...valeurs, sectionAnalytiqueId: 's1' };
    expect(corpsModification(posee, { ...saisieDepuis(posee), sectionAnalytiqueId: '' }).corps).toEqual({ sectionAnalytiqueId: null });
  });

  it('la contrepartie d’un bien repris ne part jamais · il n’a pas d’écriture', () => {
    const repris = { ...valeurs, repris: true, compteContrepartieId: null };
    expect(corpsModification(repris, { ...saisieDepuis(repris), compteContrepartieId: 'c999' }).corps).toEqual({});
  });
});
