import {
  FONDEMENT_TITRE_CONGE,
  RESERVE_DECLARATION_MAIN_OEUVRE,
  DESTINATAIRES_DECLARATION_MAIN_OEUVRE,
  dateLimiteDeclarationMainOeuvre,
  REGLE_MOUVEMENTS_MAIN_OEUVRE,
  echeancesDuContrat,
  finEssaiOpposable,
  motifRefusDecision,
  motifRefusDemandeConge,
  motifRefusFormation,
  motifRefusRealisation,
  suiviFormation,
  type ContratPourEcheancier,
} from './suivi-personnel';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * LIGNE MICROFINA-M3, LOT 2 · ce qui casserait en silence · un accord donné
 * par celui qui a saisi la demande, une fin d'essai comptée en jours de trente
 * au lieu de date à date, un CDD pour emploi permanent dit sans l'art. 42, un
 * coût de formation inconnu lu comme zéro, un titre de congé qui citerait un
 * autre article que ceux du congé.
 */
describe('Demande de congé (art. 140, al. 4)', () => {
  it('dates lisibles, fin après le début', () => {
    expect(motifRefusDemandeConge({ du: '2027-02-10', au: '2027-02-01', demandeLe: '2027-01-15' })).toMatch(/finir avant/);
    expect(motifRefusDemandeConge({ du: '2027-02-01', au: '2027-02-10', demandeLe: '2027-01-15' })).toBeNull();
  });
  it("l'auteur ne décide pas sa propre demande, et une décision se prend une fois", () => {
    expect(motifRefusDecision({ statut: 'DEMANDEE', saisiePar: 'a@x.cd' }, 'A@X.cd')?.statut).toBe(403);
    expect(motifRefusDecision({ statut: 'DEMANDEE', saisiePar: 'a@x.cd' }, 'b@x.cd')).toBeNull();
    expect(motifRefusDecision({ statut: 'ACCORDEE', saisiePar: 'a@x.cd' }, 'b@x.cd')?.statut).toBe(409);
  });
  it('le titre cite les articles du congé, jamais le 158', () => {
    expect(FONDEMENT_TITRE_CONGE).toMatch(/art\. 140/);
    expect(FONDEMENT_TITRE_CONGE).toMatch(/art\. 141/);
    expect(FONDEMENT_TITRE_CONGE.includes('158')).toBe(false);
  });
});

describe('Échéancier des contrats (art. 42, 43 al. 4, 69)', () => {
  const base: ContratPourEcheancier = {
    id: 'c',
    salarieId: 's',
    type: 'DUREE_INDETERMINEE',
    dateEntreeEnVigueur: d('2027-03-15'),
    dateFin: null,
    dateFinPrevue: null,
    emploiPermanent: false,
    clauseEssai: true,
    essaiDureeJours: null,
    manoeuvreSansSpecialite: false,
  };
  it("le plafond de l'essai se compte de date à date · six mois du 15 mars au 14 septembre inclus", () => {
    expect(finEssaiOpposable(base)?.echeance.toISOString().slice(0, 10)).toBe('2027-09-14');
    expect(finEssaiOpposable({ ...base, manoeuvreSansSpecialite: true })?.echeance.toISOString().slice(0, 10)).toBe('2027-04-14');
  });
  it('la durée stipulée prime si elle est plus courte, le plafond sinon', () => {
    expect(finEssaiOpposable({ ...base, essaiDureeJours: 30 })).toEqual({ echeance: d('2027-04-13'), parLePlafond: false });
    expect(finEssaiOpposable({ ...base, essaiDureeJours: 400 })?.parLePlafond).toBe(true);
  });
  it("l'échéance dans l'horizon se dit, dépassée aussi · au-delà, rien", () => {
    const e = echeancesDuContrat({ ...base, essaiDureeJours: 30 }, d('2027-04-01'));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ objet: 'FIN_ESSAI', echeance: '2027-04-13', joursRestants: 12, depassee: false });
    expect(e[0].consequence).toMatch(/confirmation du contrat/);
    expect(echeancesDuContrat({ ...base, essaiDureeJours: 30 }, d('2027-04-20'))[0].depassee).toBe(true);
    expect(echeancesDuContrat({ ...base, essaiDureeJours: 30 }, d('2026-12-01'))).toEqual([]);
    // Passé depuis plus que l'horizon · le contrat est confirmé (art. 43, al. 4), rien à annoncer.
    expect(echeancesDuContrat({ ...base, essaiDureeJours: 30 }, d('2027-07-01'))).toEqual([]);
  });
  it('un terme de CDD passé reste nommé tant que le contrat court', () => {
    const cdd = { ...base, type: 'DUREE_DETERMINEE', clauseEssai: false, dateFinPrevue: d('2027-05-31'), emploiPermanent: false };
    const e = echeancesDuContrat(cdd, d('2027-06-10'))[0];
    expect(e).toMatchObject({ objet: 'FIN_CDD', depassee: true, article: 'art. 69 et 41, al. 3' });
    // Art. 41, al. 3 · la continuation de service vaut de plein droit CDI,
    // dit avec sa formule, sans requalifier en base.
    expect(e.consequence).toMatch(/de plein droit/);
    expect(e.consequence).toMatch(/art\. 41, al\. 2/);
  });
  it("le CDD pour emploi permanent rappelle l'art. 42 · un contrat terminé ne figure plus", () => {
    const cdd = { ...base, type: 'DUREE_DETERMINEE', clauseEssai: false, dateFinPrevue: d('2027-05-31'), emploiPermanent: true };
    const e = echeancesDuContrat(cdd, d('2027-05-01'));
    expect(e[0]).toMatchObject({ objet: 'FIN_CDD', article: 'art. 69' });
    expect(e[0].consequence).toMatch(/art\. 42/);
    expect(echeancesDuContrat({ ...cdd, dateFin: d('2027-05-31') }, d('2027-05-01'))).toEqual([]);
  });
});

describe('Formation (art. 8)', () => {
  it('refus de la prévision et de la réalisation', () => {
    expect(motifRefusFormation({ intitule: '', prevueDu: '2027-03-01', prevueAu: '2027-03-02' })).toMatch(/intitulé/);
    expect(motifRefusFormation({ intitule: 'Excel', prevueDu: '2027-03-01', prevueAu: '2027-03-02' })).toBeNull();
    expect(motifRefusRealisation({ statut: 'PREVUE' }, { realiseeDu: '2027-03-01', realiseeAu: '2027-03-02', presents: 0 })).toMatch(/annulez/);
    expect(motifRefusRealisation({ statut: 'REALISEE' }, { realiseeDu: '2027-03-01', realiseeAu: '2027-03-02', presents: 1 })).toMatch(/déjà/);
  });
  it('prévu contre réalisé · un coût inconnu est dit, jamais lu comme zéro', () => {
    const s = suiviFormation([
      { statut: 'REALISEE', coutPrevuFc: 500_000, coutReelFc: 450_000.1, inscrits: 3, presents: 2 },
      { statut: 'PREVUE', coutPrevuFc: null, coutReelFc: null, inscrits: 4, presents: 0 },
      { statut: 'ANNULEE', coutPrevuFc: 90_000, coutReelFc: null, inscrits: 1, presents: 0 },
    ]);
    expect(s).toMatchObject({ prevues: 2, realisees: 1, annulees: 1, coutPrevuFc: 500_000, coutPrevuIncomplet: true, coutReelFc: 450_000.1, coutReelIncomplet: false, inscrits: 7, presents: 2 });
  });
});

describe("Déclaration de la main-d'œuvre (art. 218, 219 ; arrêté n° 005/CAB/PVPM/ETPS/2010)", () => {
  it("nomme l'arrêté de l'art. 219 et dit ce que le formulaire demande en plus des chiffres", () => {
    expect(RESERVE_DECLARATION_MAIN_OEUVRE).toContain('n° 005/CAB/PVPM/ETPS/2010 du 1er avril 2010');
    expect(RESERVE_DECLARATION_MAIN_OEUVRE).toMatch(/bilan social/);
    expect(RESERVE_DECLARATION_MAIN_OEUVRE).toMatch(/masse salariale/);
  });
  it("au plus tard le 31 janvier de l'année qui suit, sans report au jour ouvrable (art. 1er)", () => {
    expect(dateLimiteDeclarationMainOeuvre(2026)).toBe('2027-01-31');
    // 31 janvier 2027 · un dimanche, que l'arrêté ne reporte pas.
    expect(new Date(Date.UTC(2027, 0, 31)).getUTCDay()).toBe(0);
  });
  it("quatre exemplaires · deux à l'Inspection, un à l'ONEM, l'article primant sur le NB du formulaire (art. 2)", () => {
    expect(DESTINATAIRES_DECLARATION_MAIN_OEUVRE).toContain("deux à l'Inspecteur du travail du ressort");
    expect(DESTINATAIRES_DECLARATION_MAIN_OEUVRE).toContain("un au Bureau provincial de l'Office national de l'emploi");
    expect(DESTINATAIRES_DECLARATION_MAIN_OEUVRE).toContain('art. 321');
  });
  it("rappelle la déclaration d'embauche et de départ dans les quinze jours de la loi, qui prime sur l'arrêté (art. 217 ; arrêté n° 006, art. 4)", () => {
    expect(REGLE_MOUVEMENTS_MAIN_OEUVRE).toContain('dans les quinze jours');
    expect(REGLE_MOUVEMENTS_MAIN_OEUVRE).toContain('loi n° 16/010 du 15 juillet 2016');
    expect(REGLE_MOUVEMENTS_MAIN_OEUVRE).toContain('vingt-deux journées de travail sur deux mois');
  });
});
