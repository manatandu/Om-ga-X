import {
  datesDeLExercice,
  formulaireSituationMainOeuvre,
  identificationDasmo,
  ligneDeLaClasse,
  LIGNES_DASMO,
  type ContratAuPremierJanvier,
  type IdentiteDasmo,
} from './situation-main-oeuvre';

// Aucun import de « vitest » (globales) · convention du dépôt.

const identite: IdentiteDasmo = {
  nom: 'Société Essai',
  adresse: '12, avenue du Commerce',
  ville: 'Kinshasa',
  telephone: '+243 800 000 000',
  email: null,
  formeJuridique: 'Société à responsabilité limitée',
  rccm: 'CD/KNG/RCCM/24-B-00001',
  numeroImpot: 'A1234567B',
  activite: 'Commerce',
  idNat: '01-1234-N12345A',
  numeroAffiliationCnssEmployeur: '123456',
};

const c = (p: Partial<ContratAuPremierJanvier>): ContratAuPremierJanvier => ({
  salarie: 'X',
  sexe: 'MASCULIN',
  nationalite: 'Congolaise',
  type: 'DUREE_INDETERMINEE',
  classeProfessionnelle: 1,
  ...p,
});

describe('déclaration annuelle de la situation de la main-d’œuvre (modèle annexé à l’arrêté du 24 février 2023)', () => {
  it('les neuf lignes de catégorie du formulaire, dans son ordre (rubriques 21 à 29)', () => {
    expect(LIGNES_DASMO.map((l) => l.libelle)).toEqual([
      'Catégorie I', 'Catégorie II', 'Catégorie III', 'Catégorie IV', 'Catégorie V',
      'Agent de maîtrise', 'Cadres de collaboration', 'Cadre de direction', 'Hors cadres',
    ]);
  });

  it('chaque classe du décret n° 25/22 tombe sur la ligne de sa catégorie, et rien sur direction ni hors cadres', () => {
    expect([1, 2, 3, 4, 6, 7, 8, 9, 10, 13, 14, 17].map(ligneDeLaClasse)).toEqual([
      'I', 'I', 'II', 'III', 'III', 'IV', 'IV', 'V', 'MAITRISE', 'MAITRISE', 'COLLABORATION', 'COLLABORATION',
    ]);
    expect([null, 0, 18].map(ligneDeLaClasse)).toEqual([null, null, null]);
  });

  it("l'exercice E se lit au 1er janvier E et se dépose au plus tard le 31 janvier E (art. 3)", () => {
    expect(datesDeLExercice(2024)).toEqual({ au: '2024-01-01', dateLimite: '2024-01-31', anneePrecedente: '2023-01-01', anneeAnterieure: '2022-01-01' });
  });

  it('identification · ce que le dossier ne tient pas reste vide et numéroté comme le formulaire', () => {
    const champs = identificationDasmo(identite);
    expect(champs.map((x) => x.numero)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(champs.filter((x) => x.valeur === null).map((x) => x.numero)).toEqual([2, 4, 5, 7, 9, 14, 17, 18, 19]);
  });

  it('compte les permanents (durée indéterminée) par ligne, nationalité et sexe, les autres à part', () => {
    const f = formulaireSituationMainOeuvre({
      exercice: 2025,
      identite,
      auPremierJanvier: [
        c({ salarie: 'A', classeProfessionnelle: 1 }),
        c({ salarie: 'B', classeProfessionnelle: 2, sexe: 'FEMININ' }),
        c({ salarie: 'C', classeProfessionnelle: 15, nationalite: 'Belge' }),
        c({ salarie: 'D', classeProfessionnelle: null }),
        c({ salarie: 'E', type: 'DUREE_DETERMINEE', classeProfessionnelle: 1 }),
        c({ salarie: 'F', type: 'JOUR_LE_JOUR' }),
        c({ salarie: 'G', type: 'APPRENTISSAGE' }),
      ],
      permanentsPrecedents: { anneePrecedente: 3, anneeAnterieure: 2 },
    });
    const ligne = (cle: string) => f.effectifs.lignes.find((l) => l.cle === cle)!.cellules;
    expect(ligne('I')).toEqual({ congolais: { h: 1, f: 1, total: 2 }, etrangers: { h: 0, f: 0, total: 0 }, totaux: { h: 1, f: 1, total: 2 } });
    expect(ligne('COLLABORATION')?.etrangers).toEqual({ h: 1, f: 0, total: 1 });
    expect(ligne('DIRECTION')).toBeNull();
    expect(ligne('HORS_CADRES')).toBeNull();
    expect(f.effectifs.totaux.totaux).toEqual({ h: 3, f: 1, total: 4 });
    expect(f.effectifs.sansClasse).toEqual(['D']);
    expect(f.permanents).toEqual({ annee: 4, anneePrecedente: 3, anneeAnterieure: 2 });
    expect(f.nonPermanents).toMatchObject({ journaliers: 1, temporaires: 1, apprentis: 1 });
    expect(f.manquants.join(' ')).toContain('1 permanent(s) sans classe');
  });

  it('une nationalité absente rend la répartition non calculée, jamais devinée', () => {
    const f = formulaireSituationMainOeuvre({
      exercice: 2025,
      identite,
      auPremierJanvier: [c({ salarie: 'A' }), c({ salarie: 'B', nationalite: null })],
      permanentsPrecedents: { anneePrecedente: 0, anneeAnterieure: 0 },
    });
    const i = f.effectifs.lignes.find((l) => l.cle === 'I')!.cellules!;
    expect(i.congolais).toBeNull();
    expect(i.etrangers).toBeNull();
    expect(i.totaux.total).toBe(2);
    expect(f.manquants.join(' ')).toContain('sans nationalité');
  });

  it('nomme les rubriques laissées au cabinet, masse salariale comprise', () => {
    const f = formulaireSituationMainOeuvre({ exercice: 2025, identite, auPremierJanvier: [], permanentsPrecedents: { anneePrecedente: 0, anneeAnterieure: 0 } });
    expect(f.nonRemplies.join(' ')).toMatch(/Masse salariale.*34 à 44/);
    expect(f.nonRemplies.join(' ')).toMatch(/Besoins en main-d’œuvre \(47 à 61\)/);
    expect(f.fondement).toContain('087/02/2023 du 24 février 2023');
    expect(f.fondement).toContain('n° 10 du 15 mai 2023');
  });
});
