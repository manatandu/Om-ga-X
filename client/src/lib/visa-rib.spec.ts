import { corpsDuVisa, etatDuVisa, peutViser, type VisaRibLu } from './visa-rib';

const base: VisaRibLu = {
  exige: true,
  vise: false,
  visePar: null,
  viseLe: null,
  saisiPar: 'a@cabinet.cd',
  saisiLe: '2026-10-21T08:00:00.000Z',
  saisiParVous: false,
};

describe('visa des RIB · ce que l’écran montre', () => {
  it("dit l'état, et le visa exigé quand il manque", () => {
    expect(etatDuVisa(base)).toBe('Non visé · exigé pour les virements');
    expect(etatDuVisa({ ...base, exige: false })).toBe('Non visé');
    expect(etatDuVisa({ ...base, vise: true, visePar: 'b@cabinet.cd', viseLe: '2026-10-21T09:00:00.000Z' })).toMatch(/^Visé par b@cabinet\.cd le /);
  });

  it("un RIB saisi avant la règle, une fois visé, garde dit que son auteur est inconnu", () => {
    expect(etatDuVisa({ ...base, saisiPar: null, saisiLe: null, vise: true, visePar: 'b@cabinet.cd', viseLe: null })).toBe(
      'Visé par b@cabinet.cd · auteur de la saisie inconnu',
    );
  });

  it("n'offre « Viser » ni à l'auteur, ni sur un RIB visé, ni à qui ne valide pas", () => {
    expect(peutViser(base, true)).toBe(true);
    expect(peutViser({ ...base, saisiParVous: true }, true)).toBe(false);
    expect(peutViser({ ...base, vise: true }, true)).toBe(false);
    expect(peutViser(base, false)).toBe(false);
    // Une réponse sans visa (serveur d'avant) n'offre rien plutôt que de planter.
    expect(peutViser(undefined, true)).toBe(false);
  });

  it("renvoie l'instant de la saisie montrée, tel que le serveur l'a servi", () => {
    expect(corpsDuVisa(base)).toEqual({ saisiLeLu: '2026-10-21T08:00:00.000Z' });
    expect(corpsDuVisa({ ...base, saisiPar: null, saisiLe: null })).toEqual({ saisiLeLu: null });
  });
});
