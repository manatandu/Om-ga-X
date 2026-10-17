import {
  ajouterJours,
  dateDeSuppression,
  etatDeLEssai,
  FaitsDossierEssai,
  JOURS_CONSERVATION_ESSAI,
  JOURS_FENETRE_RAPPEL,
  JOURS_RAPPEL_AVANT_SUPPRESSION,
  joursEntre,
  premiereDateDeSuppression,
} from './essais-echus';

/**
 * LE CALENDRIER D'UN DOSSIER D'ESSAI NON SOUSCRIT (décision de Manasse du
 * 2026-10-17) · ce qui casserait en silence : un jour de plus ou de moins de
 * conservation, un fuseau lu en UTC, un rappel compté depuis la création au lieu
 * de l'envoi, un dossier souscrit pris pour un essai.
 *
 * Un essai ouvert le 1er janvier 2026 à 10 h UTC finit le 31 janvier 2026 à
 * 10 h UTC (11 h à Kinshasa), trente jours plus tard. Terme = 31 janvier ·
 * conservé jusqu'au 30 juillet inclus (31 janvier + 180 jours), supprimable dès
 * le 31 juillet · six mois calendaires auraient donné le 31 juillet comme dernier
 * jour, c'est la différence que le premier test garde.
 */
const DEBUT = new Date('2026-01-01T10:00:00Z');
const FIN = new Date('2026-01-31T10:00:00Z');
const jour = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const faits = (surcharge: Partial<FaitsDossierEssai> = {}): FaitsDossierEssai => ({
  licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: FIN },
  estDemonstration: false,
  toucheUnGroupe: false,
  aUnAbonnement: false,
  inscritParEssai: true,
  rappel: null,
  ...surcharge,
});

describe('les nombres de la décision', () => {
  it('cent quatre-vingts jours de conservation, trente jours de préavis', () => {
    expect(JOURS_CONSERVATION_ESSAI).toBe(180);
    expect(JOURS_RAPPEL_AVANT_SUPPRESSION).toBe(30);
    expect(JOURS_FENETRE_RAPPEL).toBe(30);
  });

  it('180 JOURS, PAS SIX MOIS · 31 janvier + 180 jours est le 30 juillet, non le 31', () => {
    const v = etatDeLEssai(faits(), new Date('2026-03-01T00:00:00Z'));
    expect(iso(v.termeLe)).toBe('2026-01-31');
    expect(iso(v.conserveJusquAu)).toBe('2026-07-30');
    expect(iso(premiereDateDeSuppression(jour('2026-01-31')))).toBe('2026-07-31');
  });

  it('les aides au calcul de jours sont exactes', () => {
    expect(iso(ajouterJours(jour('2026-02-27'), 3))).toBe('2026-03-02');
    expect(joursEntre(jour('2026-01-01'), jour('2026-01-31'))).toBe(30);
  });
});

describe('l’état d’un essai, du premier au dernier jour', () => {
  it('EN_COURS tant que l’instant d’échéance n’est pas atteint, ECHU_CONSERVE à l’instant même', () => {
    expect(etatDeLEssai(faits(), new Date(FIN.getTime() - 1)).etat).toBe('EN_COURS');
    expect(etatDeLEssai(faits(), FIN).etat).toBe('ECHU_CONSERVE');
  });

  it('le rappel n’est dû que soixante jours avant la première date de suppression, au jour de Kinshasa', () => {
    // Première date de suppression 31 juillet · rappel dû dès le 1er juin à Kinshasa (UTC+1).
    const veille = new Date('2026-05-31T22:59:59Z'); // 23 h 59 min 59 s le 31 mai à Kinshasa
    const jourJ = new Date('2026-05-31T23:00:00Z'); // minuit le 1er juin à Kinshasa
    expect(etatDeLEssai(faits(), veille).etat).toBe('ECHU_CONSERVE');
    const v = etatDeLEssai(faits(), jourJ);
    expect(v.etat).toBe('RAPPEL_A_ENVOYER');
    expect(iso(v.rappelDepuisLe)).toBe('2026-06-01');
  });

  it('RAPPEL_A_ENVOYER reste le même état jusqu’à ce que le rappel soit parti, même après la première date', () => {
    expect(etatDeLEssai(faits(), new Date('2026-09-15T08:00:00Z')).etat).toBe('RAPPEL_A_ENVOYER');
  });

  it('SANS rappel parti, jamais SUPPRIMABLE · l’heure du calendrier ne suffit pas', () => {
    for (const quand of ['2026-07-31T12:00:00Z', '2027-01-01T12:00:00Z', '2030-01-01T00:00:00Z']) {
      expect(etatDeLEssai(faits(), new Date(quand)).etat).not.toBe('SUPPRIMABLE');
    }
  });

  it('un rappel mis en file mais pas parti (envoyeLe nul) ne vaut pas préavis', () => {
    const v = etatDeLEssai(faits({ rappel: { envoyeLe: null } }), new Date('2027-01-01T00:00:00Z'));
    expect(v.etat).toBe('RAPPEL_A_ENVOYER');
  });

  it('rappel parti à temps · SUPPRIMABLE le 31 juillet à Kinshasa, pas la veille', () => {
    const rappel = { envoyeLe: new Date('2026-06-10T12:00:00Z') }; // + 30 jours = 10 juillet, avant la première date
    const veille = etatDeLEssai(faits({ rappel }), new Date('2026-07-30T22:59:59Z'));
    const jourJ = etatDeLEssai(faits({ rappel }), new Date('2026-07-30T23:00:00Z'));
    expect(veille.etat).toBe('ECHU_CONSERVE');
    expect(jourJ.etat).toBe('SUPPRIMABLE');
    expect(iso(jourJ.supprimableLe)).toBe('2026-07-31');
  });

  it('rappel parti TARD · le préavis de trente jours repousse la suppression, il ne se raccourcit jamais', () => {
    const rappel = { envoyeLe: new Date('2026-07-20T09:00:00Z') }; // + 30 jours = 19 août
    expect(iso(dateDeSuppression(jour('2026-01-31'), rappel.envoyeLe))).toBe('2026-08-19');
    expect(etatDeLEssai(faits({ rappel }), new Date('2026-08-18T12:00:00Z')).etat).toBe('ECHU_CONSERVE');
    expect(etatDeLEssai(faits({ rappel }), new Date('2026-08-19T12:00:00Z')).etat).toBe('SUPPRIMABLE');
  });

  it('le préavis se compte en jours de Kinshasa depuis l’envoi · 29 jours non, 30 jours oui', () => {
    // Rappel le 10 août à 23 h 30 UTC = le 11 août à 0 h 30 à Kinshasa · jour K = 11 août, + 30 = 10 septembre.
    const rappel = { envoyeLe: new Date('2026-08-10T23:30:00Z') };
    expect(etatDeLEssai(faits({ rappel }), new Date('2026-09-09T12:00:00Z')).etat).toBe('ECHU_CONSERVE');
    expect(etatDeLEssai(faits({ rappel }), new Date('2026-09-10T12:00:00Z')).etat).toBe('SUPPRIMABLE');
  });
});

describe('un dossier n’est JAMAIS concerné · en cas de doute, non concerné', () => {
  const apres = new Date('2027-06-01T00:00:00Z');
  const cas: [string, Partial<FaitsDossierEssai>][] = [
    ['licence illisible (null)', { licence: null }],
    ['dossier de l’éditeur', { licence: { type: 'PROPRIETAIRE', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: null } }],
    ['licence perpétuelle', { licence: { type: 'PERPETUEL_SAAS', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: null } }],
    ['licence sur site', { licence: { type: 'PERPETUEL_ONPREMISE', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: null } }],
    ['licence suspendue', { licence: { type: 'ABONNEMENT', statut: 'SUSPENDUE', dateDebut: DEBUT, dateExpiration: FIN } }],
    ['abonnement prolongé par un paiement (plus de trente jours)', { licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: new Date('2026-04-30T10:00:00Z') } }],
    ['abonnement d’un an', { licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: new Date('2027-01-01T10:00:00Z') } }],
    ['abonnement sans échéance', { licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: null } }],
    ['dossier de démonstration', { estDemonstration: true }],
    ['mère ou cellule d’un groupe', { toucheUnGroupe: true }],
    ['abonnement enregistré à son nom (factures d’abonnement)', { aUnAbonnement: true }],
    ['dossier né de la console, non de l’inscription en libre-service', { inscritParEssai: false }],
  ];

  it.each(cas)('%s', (_nom, surcharge) => {
    const v = etatDeLEssai(faits(surcharge), apres);
    expect(v.etat).toBe('NON_CONCERNE');
    expect(v.motif && v.motif.length).toBeGreaterThan(10);
    expect(v.supprimableLe).toBeNull();
  });

  it('même avec un rappel parti depuis longtemps, un dossier non concerné ne devient jamais SUPPRIMABLE', () => {
    const rappel = { envoyeLe: new Date('2026-06-10T12:00:00Z') };
    for (const [, surcharge] of cas) {
      expect(etatDeLEssai(faits({ ...surcharge, rappel }), apres).etat).not.toBe('SUPPRIMABLE');
    }
  });

  it('la durée de trente jours est jugée à la minute près (tolérance de la règle d’inscription)', () => {
    const presqueTrente = new Date(FIN.getTime() + 30_000);
    const v = etatDeLEssai(faits({ licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: presqueTrente } }), apres);
    expect(v.etat).not.toBe('NON_CONCERNE');
    const troisMinutes = new Date(FIN.getTime() + 180_000);
    expect(etatDeLEssai(faits({ licence: { type: 'ABONNEMENT', statut: 'ACTIVE', dateDebut: DEBUT, dateExpiration: troisMinutes } }), apres).etat).toBe('NON_CONCERNE');
  });
});
