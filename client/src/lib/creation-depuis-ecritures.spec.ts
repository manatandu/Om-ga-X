import { corpsDepuisEcriture, saisieDepuisLigne, type LigneATransformer } from './creation-depuis-ecritures';

/**
 * CRÉER LES BIENS DEPUIS LES ÉCRITURES (ligne sage-l4, n° 68) · ce que
 * l'écran envoie. Ce qui casserait en silence · une durée vide envoyée à
 * zéro, une mise en service posée sans que le cabinet l'ait vue, une valeur
 * ou un compte envoyés par l'écran alors que la ligne les porte.
 */
const ligne: LigneATransformer = {
  ligneId: 'l-1',
  ecritureId: 'e-1',
  numeroPiece: 7,
  journal: 'ACH',
  date: '2026-03-15',
  libelle: 'Camion benne',
  compte: { numero: '24510000', intitule: 'Matériel automobile' },
  montant: 12_000_000,
  motifRefus: null,
};

describe('la fiche née d’une ligne', () => {
  it('propose la désignation et la date de la pièce, visibles', () => {
    expect(saisieDepuisLigne(ligne)).toMatchObject({ designation: 'Camion benne', dateMiseEnService: '2026-03-15', pasEncoreEnService: false });
  });

  it('n’envoie ni compte, ni valeur, ni date d’acquisition · le serveur les lit sur la ligne', () => {
    const corps = corpsDepuisEcriture('l-1', saisieDepuisLigne(ligne));
    expect(corps).toEqual({ ligneId: 'l-1', designation: 'Camion benne', dateMiseEnService: '2026-03-15' });
  });

  it('un champ vide n’est pas envoyé, jamais zéro', () => {
    const corps = corpsDepuisEcriture('l-1', { ...saisieDepuisLigne(ligne), dureeAmortissementAns: ' ' });
    expect(corps).not.toHaveProperty('dureeAmortissementAns');
  });

  it('pas encore mis en service · la date part à null', () => {
    const corps = corpsDepuisEcriture('l-1', { ...saisieDepuisLigne(ligne), pasEncoreEnService: true });
    expect(corps.dateMiseEnService).toBeNull();
  });

  it('les unités d’œuvre ne partent qu’avec leur mode', () => {
    const base = { ...saisieDepuisLigne(ligne), unitesOeuvrePrevues: '90000', uniteOeuvreLibelle: 'km', dureeAmortissementAns: '5' };
    expect(corpsDepuisEcriture('l-1', base)).not.toHaveProperty('unitesOeuvrePrevues');
    expect(corpsDepuisEcriture('l-1', { ...base, modeAmortissement: 'UNITES_DOEUVRE' })).toMatchObject({
      modeAmortissement: 'UNITES_DOEUVRE',
      unitesOeuvrePrevues: 90000,
      uniteOeuvreLibelle: 'km',
      dureeAmortissementAns: 5,
    });
  });
});
