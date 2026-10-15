import { ecrituresDuQuestionnaire, motifReponse, QUESTIONS_PAIE, REPONSES_VIDES, type ReponsesPaie } from './questionnaire-paie';

const q = (cle: string) => QUESTIONS_PAIE.find((x) => x.cle === cle)!;

describe('le questionnaire de paie', () => {
  it("pose chaque question une fois, sans valeur par défaut", () => {
    const cles = QUESTIONS_PAIE.map((x) => x.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(Object.values(REPONSES_VIDES).every((v) => v === '')).toBe(true);
    expect(Object.keys(REPONSES_VIDES).sort()).toEqual([...cles].sort());
  });

  it('refuse une réponse hors des choix, une classe hors de la grille, un nombre illisible · « pas encore dit » passe', () => {
    expect(motifReponse(q('natureInpp'), 'MIXTE')).toMatch(/hors des choix/);
    expect(motifReponse(q('classePro'), '18')).toMatch(/dix-sept classes/);
    expect(motifReponse(q('classePro'), '0')).toMatch(/dix-sept classes/);
    expect(motifReponse(q('effectifInpp'), '0')).toMatch(/au moins une personne/);
    expect(motifReponse(q('personnesACharge'), '2,5')).toMatch(/entier/);
    expect(motifReponse(q('effectifPermanent'), '0')).toBeNull();
    expect(motifReponse(q('natureInpp'), '')).toBeNull();
  });

  it("n'écrit que ce qui change, par la route qui le tient", () => {
    const initial: ReponsesPaie = { ...REPONSES_VIDES, effectifPermanent: '12', modePaiement: 'VIREMENT', natureInpp: 'PRIVE' };
    const reponses: ReponsesPaie = {
      ...initial,
      effectifPermanent: '14',
      numeroAffiliationCnssEmployeur: 'CNSS-001',
      deviseRemuneration: 'CDF',
      classePro: '5',
    };
    expect(ecrituresDuQuestionnaire(initial, reponses, QUESTIONS_PAIE)).toEqual({
      dossier: { effectifPermanent: 14, numeroAffiliationCnssEmployeur: 'CNSS-001' },
      modePaiement: null,
      deviseRemuneration: 'CDF',
      simulation: { classePro: '5' },
      gardees: [],
    });
  });

  it("n'efface jamais une valeur enregistrée · « pas encore dit » la garde et le dit ; la simulation, elle, se vide", () => {
    const initial: ReponsesPaie = { ...REPONSES_VIDES, effectifPermanent: '12', modePaiement: 'ESPECES', natureInpp: 'PUBLIC' };
    const reponses: ReponsesPaie = { ...initial, effectifPermanent: '', modePaiement: '', natureInpp: '' };
    expect(ecrituresDuQuestionnaire(initial, reponses, QUESTIONS_PAIE)).toEqual({
      dossier: null,
      modePaiement: null,
      deviseRemuneration: null,
      simulation: { natureInpp: '' },
      gardees: ['effectifPermanent', 'modePaiement'],
    });
  });
});
