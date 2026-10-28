import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Aucun import de « vitest » · convention du dépôt (les specs du client tournent aussi sous Jest).
import { lignesPourLaSimulation, lireHeures, natureAffichee } from './feuilles-temps';
import { heuresPourLeBulletin } from './heures-majorees';

/**
 * LIGNE SAGE-L5, FONCTION 78, RESTE · la reprise des heures des feuilles de
 * temps à la simulation ne remplace jamais ce que le cabinet a tapé, ne
 * devine jamais le taux horaire, et une heure tapée à la française se lit.
 */
describe('la reprise des heures à la simulation', () => {
  const proposees = [
    { nature: 'HEURES_SUPPLEMENTAIRES' as const, libelle: 'Heures supplémentaires', heures: 5.5, minimum: false, samedi: false, majorationId: 'm-hs', majorations: 1 },
    { nature: 'TRAVAIL_DE_NUIT' as const, libelle: 'Heures de nuit', heures: 2, minimum: false, samedi: false, majorationId: null, majorations: 2 },
  ];

  it('ajoute aux lignes tapées, jette les lignes vides, laisse le taux horaire à taper', () => {
    const deja = [
      { majorationId: 'm-x', heures: '3', tauxHoraire: '1500' },
      { majorationId: '', heures: '', tauxHoraire: '' },
    ];
    expect(lignesPourLaSimulation(proposees, deja)).toEqual([
      { majorationId: 'm-x', heures: '3', tauxHoraire: '1500' },
      { majorationId: 'm-hs', heures: '5,5', tauxHoraire: '', origine: 'feuilles' },
      { majorationId: '', heures: '2', tauxHoraire: '', origine: 'feuilles' },
    ]);
  });

  it('une seconde reprise REMPLACE la première, jamais ne double les heures · le taux tapé sur une ligne reprise se garde', () => {
    const deja = [{ majorationId: 'm-x', heures: '3', tauxHoraire: '1500' }];
    const une = lignesPourLaSimulation(proposees, deja);
    const tape = une.map((l) => (l.majorationId === 'm-hs' ? { ...l, tauxHoraire: '2000' } : l));
    const deux = lignesPourLaSimulation(proposees, tape);
    expect(deux).toHaveLength(3);
    expect(deux.filter((l) => l.origine === 'feuilles').map((l) => [l.majorationId, l.heures, l.tauxHoraire])).toEqual([
      ['m-hs', '5,5', '2000'],
      ['', '2', ''],
    ]);
    // Rien de l'origine ne part au serveur.
    expect(heuresPourLeBulletin(deux).lignes.every((l) => !('origine' in l))).toBe(true);
  });

  it('une ligne reprise sans taux horaire ne part pas au serveur · elle est dite incomplète', () => {
    const r = heuresPourLeBulletin(lignesPourLaSimulation(proposees, []));
    expect(r.lignes).toEqual([]);
    expect(r.incompletes).toBe(2);
  });
});

describe('la saisie d’une heure', () => {
  it('lit la virgule, le point et les espaces ; une case vide vaut zéro ; un texte illisible est refusé', () => {
    expect(lireHeures('7,5')).toBe(7.5);
    expect(lireHeures(' 8.25 ')).toBe(8.25);
    expect(lireHeures('')).toBe(0);
    expect(lireHeures('huit')).toBeNull();
    expect(lireHeures('-2')).toBeNull();
  });

  it('nomme le dimanche, le férié et le samedi, rien pour un jour ouvrable', () => {
    expect(natureAffichee({ nature: 'DIMANCHE', samedi: false })).toBe('Dimanche');
    expect(natureAffichee({ nature: 'FERIE', samedi: false })).toBe('Férié');
    expect(natureAffichee({ nature: 'OUVRABLE', samedi: true })).toBe('Samedi');
    expect(natureAffichee({ nature: 'OUVRABLE', samedi: false })).toBe('');
  });
});

describe('l’onglet des feuilles de temps (gelé, relecture du 2026-10-28)', () => {
  const ecran = readFileSync(join(__dirname, '..', 'components', 'paie', 'FeuillesTempsPaie.tsx'), 'utf8');
  const page = readFileSync(join(__dirname, '..', 'pages', 'PersonnelPage.tsx'), 'utf8');

  it('le salarié ne change pas pendant l’envoi, et la réponse ne relit que le salarié de l’envoi', () => {
    expect(ecran).toContain('disabled={envoi}');
    expect(ecran).toContain('if (salarieCourant.current !== salarieDeLEnvoi) return;');
    expect(ecran).toContain('chargerRef.current();');
  });

  it('une saisie non enregistrée se confirme avant de changer de salarié, et la garde tombe dès la réponse', () => {
    expect(ecran).toContain('if (modifiee && !window.confirm(');
    const reponse = ecran.slice(ecran.indexOf('(r) => {\n        setEnvoi(false);'), ecran.indexOf('if (salarieCourant.current !== salarieDeLEnvoi)'));
    expect(reponse).toContain('setModifiee(false);');
  });

  it('les champs restent fermés pendant la relecture · une heure retapée n’est pas écrasée en silence', () => {
    expect(ecran).toContain('!detail.annuleLe && !relecture');
  });

  it('un jour devenu absence garde son champ tant qu’il porte des heures · pour les vider', () => {
    expect(ecran).toContain('const aVider = !!j.occupation && (j.heures > 0 || j.heuresNuit > 0);');
  });

  it('la désactivation d’un compteur se confirme et ne part qu’une fois', () => {
    const d = ecran.slice(ecran.indexOf('const desactiverCompteur'), ecran.indexOf('const total ='));
    expect(d).toContain('if (desactivation) return;');
    expect(d).toContain('window.confirm(');
  });

  it('la feuille ouverte annulée se relit', () => {
    expect(ecran).toContain('if (detail?.id === annulee) void ouvrir(annulee);');
  });

  it('les heures du mois se vident dès que salarié ou mois changent · aucune reprise des heures d’un autre mois', () => {
    const effet = page.slice(page.indexOf('feuilles-temps/mois/') - 600, page.indexOf('feuilles-temps/mois/'));
    expect(effet).toContain('setHeuresDuMois(null);\n    if (onglet');
  });
});
