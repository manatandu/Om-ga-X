import { ACTES_DE_LA_PERIODE } from './arret-dissolution';
import { FormeJuridiqueSyscohada, Referentiel, RegimeLiquidation, RoleUtilisateur } from '@prisma/client';
import { ExerciceService, refuserSuivantCivilApresDissolution } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { TenantService } from '../tenant/tenant.service';
import {
  cotisationsSpeciales,
  estExerciceDeLiquidation,
  exercicePorteurSecondeCotisation,
  jalonsLiquidation,
  situationsAnnuelles,
  TOTALISATION_ARTICLE_12_AL_4,
} from './liquidation-societe';

/**
 * LA DISSOLUTION D'UNE SOCIÉTÉ · exercice ARRÊTÉ à la dissolution, puis UN
 * exercice de liquidation, et les deux cotisations spéciales (décision par la
 * loi du 2026-10-07, point 2 · AUDCIF art. 7 al. 4 et Titre VIII ch. 40
 * § 2.1 ; loi n° 23/053, art. 12 et 13 ; LPF art. 16).
 */
const jour = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));
const iso = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
const DISSOLUTION = jour(2026, 6, 30);

// L'arrêt lui-même, son annulation et le dossier repris · `arret-dissolution.spec.ts`
// (décision par la loi du 2026-10-07, quatrième lot, point 1).

describe('la fin de l’exercice de liquidation se reporte tant qu’il est ouvert', () => {
  function service(exercice: Record<string, unknown>, chevauche: unknown = null, ecrituresApres = 0) {
    const ex = { id: 'e2', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31), statut: 'OUVERT', ...exercice };
    const capture: { data?: Record<string, unknown> } = {};
    const tx = {
      exercice: {
        findFirst: jest.fn().mockResolvedValue(chevauche),
        update: jest.fn(async (a: { data: Record<string, unknown> }) => {
          capture.data = a.data;
          return a;
        }),
      },
      ecriture: { count: jest.fn().mockResolvedValue(ecrituresApres) },
    };
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue(ex) },
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ dateDissolution: DISSOLUTION }) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { svc: new ExerciceService(prisma as never, {} as never), capture };
  }

  it('l’exercice de liquidation voit sa fin reportée, sans plafond', async () => {
    const { svc, capture } = service({});
    await svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2028-09-30' });
    expect(iso(capture.data!.dateFin as Date)).toBe('2028-09-30');
  });

  it('refus · un exercice ordinaire, une fin avant le début, un chevauchement, une écriture au-delà, une heure', async () => {
    await expect(service({ dateDebut: jour(2026, 1, 1) }).svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2027-06-30' })).rejects.toThrow(
      'Seul l’exercice de liquidation',
    );
    await expect(service({}).svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2026-06-01' })).rejects.toThrow('précéder son début');
    await expect(
      service({}, { dateDebut: jour(2028, 1, 1), dateFin: jour(2028, 12, 31) }).svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2028-06-30' }),
    ).rejects.toThrow('un seul exercice');
    await expect(service({}, null, 3).svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2026-12-31' })).rejects.toThrow('3 écriture(s)');
    await expect(service({}).svc.modifierFinDeLiquidation('t1', 'e2', { dateFin: '2027-06-30T00:00:00Z' })).rejects.toThrow('AAAA-MM-JJ');
  });
});

describe('après l’exercice arrêté, le suivant est l’exercice de liquidation, jamais une année civile d’office', () => {
  it('clôture et report provisoire sans exercice suivant · refus nommé, l’issue dite', () => {
    expect(() => refuserSuivantCivilApresDissolution({ dateFin: DISSOLUTION }, { dateDissolution: DISSOLUTION })).toThrow(
      "Créez-le d'abord dans la fenêtre Exercices",
    );
    // Un exercice qui ne s'arrête pas à la dissolution · rien.
    expect(() => refuserSuivantCivilApresDissolution({ dateFin: jour(2026, 12, 31) }, { dateDissolution: DISSOLUTION })).not.toThrow();
    // Associé unique personne morale hors procédure collective · aucune liquidation, rien n'est refusé.
    expect(() =>
      refuserSuivantCivilApresDissolution({ dateFin: DISSOLUTION }, { dateDissolution: DISSOLUTION, associeUniquePersonneMorale: true }),
    ).not.toThrow();
    expect(() =>
      refuserSuivantCivilApresDissolution(
        { dateFin: DISSOLUTION },
        { dateDissolution: DISSOLUTION, associeUniquePersonneMorale: true, regimeLiquidation: 'PROCEDURE_COLLECTIVE' },
      ),
    ).toThrow('exercice de liquidation');
  });

  it('l’exercice de liquidation se reconnaît à son premier jour, le lendemain de la dissolution', () => {
    expect(estExerciceDeLiquidation({ dateDebut: jour(2026, 7, 1) }, DISSOLUTION)).toBe(true);
    expect(estExerciceDeLiquidation({ dateDebut: jour(2027, 1, 1) }, DISSOLUTION)).toBe(false);
    expect(estExerciceDeLiquidation({ dateDebut: jour(2026, 7, 1) }, null)).toBe(false);
  });
});

describe('situations annuelles provisoires · à chaque 31 décembre que l’exercice de liquidation traverse', () => {
  it('chaque 31 décembre STRICTEMENT entre la dissolution et la clôture (quatrième lot, point 6)', () => {
    const liq = { dateDebut: jour(2026, 7, 1), dateFin: jour(2028, 12, 31) };
    // Clôture non déclarée · la fin de l'exercice est provisoire, son
    // 31 décembre reste une situation tant que la clôture n'y est pas.
    expect(situationsAnnuelles(DISSOLUTION, liq, null).map(iso)).toEqual(['2026-12-31', '2027-12-31', '2028-12-31']);
    expect(situationsAnnuelles(DISSOLUTION, liq, jour(2028, 12, 31)).map(iso)).toEqual(['2026-12-31', '2027-12-31']);
    expect(situationsAnnuelles(DISSOLUTION, liq, jour(2027, 5, 15)).map(iso)).toEqual(['2026-12-31']);
    // Exercice tenu à l'année civile pendant la liquidation · son 31 décembre
    // est une situation, sauf s'il est la clôture déclarée (comptes définitifs).
    const civil2027 = { dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31) };
    expect(situationsAnnuelles(DISSOLUTION, civil2027, null).map(iso)).toEqual(['2027-12-31']);
    expect(situationsAnnuelles(DISSOLUTION, civil2027, jour(2027, 12, 31))).toEqual([]);
    // L'exercice arrêté à la dissolution n'en porte aucune.
    expect(situationsAnnuelles(DISSOLUTION, { dateDebut: jour(2026, 1, 1), dateFin: DISSOLUTION }, null)).toEqual([]);
  });

  it('art. 223 · états et assemblée comptés de CHAQUE situation, l’exercice de liquidation en porte plusieurs', () => {
    const j = jalonsLiquidation(
      {
        forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateDissolution: DISSOLUTION,
        dateNominationLiquidateur: jour(2026, 7, 10),
        regimeLiquidation: RegimeLiquidation.ARTICLE_223_1,
      },
      { dateDebut: jour(2026, 7, 1), dateFin: jour(2028, 3, 31) },
      jour(2026, 10, 7),
    );
    const etats = j.filter((x) => x.libelle === 'États financiers annuels et rapport écrit du liquidateur');
    expect(etats.map((x) => iso(x.echeance))).toEqual(['2027-03-31', '2028-03-31']);
    expect(etats[0].detail).toContain('Situation au 31/12/2026');
    const assemblees = j.filter((x) => x.libelle === 'Assemblée des associés sur les états annuels de liquidation');
    expect(assemblees.map((x) => iso(x.echeance))).toEqual(['2027-06-30', '2028-06-30']);
    // Le bilan avant liquidation est celui de l'exercice arrêté, pas de celui-ci.
    expect(j.some((x) => x.libelle === 'Bilan avant liquidation')).toBe(false);
  });

  it('un jalon dont l’échéance suit la clôture déclarée n’est plus servi (point 6)', () => {
    const j = jalonsLiquidation(
      {
        forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateDissolution: DISSOLUTION,
        dateNominationLiquidateur: jour(2026, 7, 10),
        regimeLiquidation: RegimeLiquidation.ARTICLE_223_1,
        dateClotureLiquidation: jour(2027, 4, 30),
      },
      { dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 4, 30) },
      jour(2026, 10, 7),
    );
    // Situation au 31/12/2026 · états au 31/03/2027 (avant la clôture), assemblée au 30/06/2027 (après) · retirée.
    expect(j.filter((x) => x.libelle === 'États financiers annuels et rapport écrit du liquidateur').map((x) => iso(x.echeance))).toEqual([
      '2027-03-31',
    ]);
    expect(j.filter((x) => x.libelle === 'Assemblée des associés sur les états annuels de liquidation')).toEqual([]);
  });

  it('la coopérative · par l’AUSCOOP, art. 196 seulement, sans sanction pénale de l’AUSCGIE (points 6 et 7)', () => {
    const coop = {
      forme: FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
      dateDissolution: DISSOLUTION,
      dateNominationLiquidateur: jour(2026, 7, 10),
      regimeLiquidation: RegimeLiquidation.ARTICLE_223_1,
    };
    const j = jalonsLiquidation(coop, { dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31) }, jour(2026, 7, 10));
    expect(j.find((x) => x.libelle === 'Clôture de la liquidation')!.source).toBe('AUSCOOP, art. 191');
    expect(j.find((x) => x.libelle.startsWith('Comptes définitifs'))!.sanction).toBeNull();
    expect(j.some((x) => x.libelle === 'Publication de la nomination du liquidateur')).toBe(false);
    expect(j.find((x) => x.libelle === 'Rapport du liquidateur à l’assemblée des associés')!.source).toContain('AUSCOOP, art. 196');
    // Selon ses statuts · aucun article de l'AUSCGIE, la seule situation annuelle.
    const statuts = jalonsLiquidation(
      { ...coop, regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE },
      { dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31) },
      jour(2026, 10, 7),
    );
    expect(statuts.some((x) => x.libelle === 'États financiers annuels et rapport écrit du liquidateur')).toBe(false);
    expect(statuts.find((x) => x.libelle === 'Situation annuelle provisoire de liquidation')!.detail).toContain('203 à 241');
  });

  it('la clôture DÉCLARÉE lève le jalon des trois ans', () => {
    const j = jalonsLiquidation(
      {
        forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateDissolution: DISSOLUTION,
        dateNominationLiquidateur: jour(2026, 7, 10),
        regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE,
        dateClotureLiquidation: jour(2027, 3, 31),
      },
      { dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31) },
      jour(2027, 5, 1),
    );
    const cloture = j.find((x) => x.libelle === 'Clôture de la liquidation')!;
    expect(cloture.observation).toEqual({ libelle: 'Liquidation clôturée le 31/03/2027', satisfait: true });
    expect(cloture.enRetard).toBe(false);
  });
});

describe('les deux cotisations spéciales · un mois après la dissolution, un mois après la clôture', () => {
  const faits = {
    forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    dateDissolution: DISSOLUTION,
    dateNominationLiquidateur: null,
    regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE,
  };
  const ARRETE = { dateDebut: jour(2026, 1, 1), dateFin: DISSOLUTION, clos: false };
  const LIQ = { dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31), clos: false };

  it('période d’activité · un mois DATE À DATE de la dissolution, « avant que le dirigeant ne quitte la RDC », totalisation dite', () => {
    const [c] = cotisationsSpeciales(faits, ARRETE, jour(2026, 7, 10));
    expect(c.etape).toBe(15);
    expect(c.libelle).toBe('Déclaration de la cotisation spéciale (période d’activité)');
    expect(iso(c.echeance)).toBe('2026-07-30');
    expect(c.detail).toContain('avant que le dirigeant ne quitte la République démocratique du Congo');
    expect(c.detail).toContain(TOTALISATION_ARTICLE_12_AL_4);
    expect(c.detail).toContain('L’exercice est arrêté à la date de dissolution');
    expect(c.source).toContain('loi de procédures fiscales, art. 16');
    expect(c.enRetard).toBe(false);
    expect(cotisationsSpeciales(faits, ARRETE, jour(2026, 7, 31))[0].enRetard).toBe(true);
    // La déclaration déclarée lève le jalon.
    const levee = cotisationsSpeciales({ ...faits, dateDeclarationCotisationActivite: jour(2026, 7, 20) }, ARRETE, jour(2026, 8, 31))[0];
    expect(levee.observation).toEqual({ libelle: 'Déclarée le 20/07/2026', satisfait: true });
    expect(levee.enRetard).toBe(false);
  });

  it('« dans le mois » de date à date · la lecture de quantième à veille de quantième est dite (point 5)', () => {
    const [c] = cotisationsSpeciales(faits, ARRETE, jour(2026, 7, 10));
    expect(c.detail).toContain('le mois finirait le 31/07/2026');
    // Un quantième qui existe le mois suivant · les deux lectures coïncident, rien n'est dit.
    const quinze = jour(2026, 6, 15);
    const [d] = cotisationsSpeciales({ ...faits, dateDissolution: quinze }, { ...ARRETE, dateFin: quinze }, jour(2026, 6, 20));
    expect(iso(d.echeance)).toBe('2026-07-15');
    expect(d.detail).not.toContain('le mois finirait');
  });

  it('le mois tombe un jour férié · reporté au premier jour ouvrable (LPF art. 110 bis)', () => {
    // 31 mai plus un mois · le 30 juin, jour férié (ordonnance n° 23-042, art. 1er) · reporté au 1er juillet.
    const [c] = cotisationsSpeciales({ ...faits, dateDissolution: jour(2026, 5, 31) }, { ...ARRETE, dateFin: jour(2026, 5, 31) }, jour(2026, 6, 1));
    expect(iso(c.echeance)).toBe('2026-07-01');
  });

  it('dernier bilan de liquidation · EN ATTENTE sans clôture déclarée, un mois après la clôture déclarée', () => {
    const [attente] = cotisationsSpeciales(faits, LIQ, jour(2026, 10, 7));
    expect(attente.libelle).toBe('Déclaration de la cotisation spéciale (dernier bilan de liquidation)');
    expect(attente.echeance).toBeNull();
    expect(attente.enAttente).toBe('En attente de la clôture de la liquidation');
    // L'exercice échu sans clôture déclarée · non calculée, jamais en attente.
    const [manque] = cotisationsSpeciales(faits, LIQ, jour(2027, 4, 10));
    expect(manque.echeance).toBeNull();
    expect(manque.enAttente).toBeUndefined();
    // Clôture déclarée le 31 mars 2027 · le 30 avril 2027 est un vendredi.
    const [due] = cotisationsSpeciales({ ...faits, dateClotureLiquidation: jour(2027, 3, 31) }, LIQ, jour(2027, 4, 10));
    expect(iso(due.echeance)).toBe('2027-04-30');
    expect(due.detail).toContain('clôture déclarée le 31/03/2027');
  });

  it('périmètre · procédure collective et coopérative comprises ; associé unique personne morale · la première seule (point 7)', () => {
    expect(
      cotisationsSpeciales({ ...faits, regimeLiquidation: RegimeLiquidation.PROCEDURE_COLLECTIVE }, ARRETE, jour(2026, 7, 10)).map((c) => c.libelle),
    ).toEqual(['Déclaration de la cotisation spéciale (période d’activité)']);
    expect(cotisationsSpeciales({ ...faits, regimeLiquidation: RegimeLiquidation.PROCEDURE_COLLECTIVE }, LIQ, jour(2026, 10, 7))).toHaveLength(1);
    const [coop] = cotisationsSpeciales({ ...faits, forme: FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE }, ARRETE, jour(2026, 7, 10));
    expect(coop.detail).toContain('forme civile');
    expect(cotisationsSpeciales({ ...faits, forme: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE }, ARRETE, jour(2026, 7, 10))).toEqual([]);
    const pm = { ...faits, regimeLiquidation: null, associeUniquePersonneMorale: true };
    expect(cotisationsSpeciales(pm, ARRETE, jour(2026, 7, 10))).toHaveLength(1);
    expect(cotisationsSpeciales(pm, LIQ, jour(2026, 10, 7))).toEqual([]);
    // Exercice antérieur à la dissolution · rien.
    expect(cotisationsSpeciales(faits, { dateDebut: jour(2025, 1, 1), dateFin: jour(2025, 12, 31), clos: true }, jour(2026, 7, 10))).toEqual([]);
  });

  it('la seconde ne disparaît plus (constat 8) · exercice non arrêté qui porte la dissolution et la clôture, clôture hors de l’exercice', () => {
    const avecCloture = { ...faits, dateClotureLiquidation: jour(2026, 10, 31) };
    const civil = { dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31), clos: false };
    const exercices = [{ id: 'civil', ...civil }];
    expect(exercicePorteurSecondeCotisation(exercices, avecCloture)).toBe('civil');
    expect(cotisationsSpeciales(avecCloture, civil, jour(2026, 11, 10), { porteurSeconde: true }).map((c) => c.libelle)).toEqual([
      'Déclaration de la cotisation spéciale (période d’activité)',
      'Déclaration de la cotisation spéciale (dernier bilan de liquidation)',
    ]);
    // Clôture déclarée au-delà de l'exercice de liquidation · servie sur lui, l'issue dite.
    const tard = { ...faits, dateClotureLiquidation: jour(2027, 6, 30) };
    const porteur = exercicePorteurSecondeCotisation([{ id: 'a', ...ARRETE }, { id: 'l', ...LIQ }], tard);
    expect(porteur).toBe('l');
    const [s] = cotisationsSpeciales(tard, LIQ, jour(2027, 7, 1), { porteurSeconde: true });
    expect(s.detail).toContain('tombe hors de l’exercice');
    expect(iso(s.echeance)).toBe('2027-07-30');
  });
});

describe('les cotisations spéciales prennent la place de la déclaration annuelle au planning', () => {
  async function planning(
    exercice: Record<string, unknown>,
    tenant: Record<string, unknown> = {},
    autres: Array<Record<string, unknown>> = [],
  ) {
    const ex = {
      id: 'e1',
      tenantId: 't1',
      statut: 'OUVERT',
      dateAssembleeGenerale: null,
      dateDepotEtatsPortefeuille: null,
      dateTransmissionPvPortefeuille: null,
      ...exercice,
    };
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue(ex), findMany: jest.fn().mockResolvedValue([ex, ...autres]) },
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          referentiel: Referentiel.SYSCOHADA,
          formeJuridique: 'ASSOCIATION',
          formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
          droitEtranger: false,
          associeUnique: null,
          entreprisePortefeuilleEtat: false,
          dateDissolution: DISSOLUTION,
          dateNominationLiquidateur: null,
          regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE,
          associeUniquePersonneMorale: null,
          dateClotureLiquidation: null,
          dateDeclarationCotisationActivite: null,
          dateDeclarationCotisationLiquidation: null,
          ...tenant,
        }),
      },
      ecriture: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
      rapportActivite: { count: jest.fn().mockResolvedValue(0) },
      donation: { findMany: jest.fn().mockResolvedValue([]) },
      // Les actes calculés sur la période, lus par l'arrêt (bloquant 1) · aucun ici.
      ...Object.fromEntries(ACTES_DE_LA_PERIODE.map((a) => [a.modele, { findMany: jest.fn().mockResolvedValue([]) }])),
    };
    return new ExerciceService(prisma as never, {} as never).planningCloture('t1', 'e1');
  }

  it('exercice arrêté au 30 juin · la cotisation remplace la déclaration du « 30 avril », à sa place d’étape 15', async () => {
    // L'arrêt crée l'exercice de liquidation · c'est lui qui porte la seconde (constat 8).
    const p = await planning({ dateDebut: jour(2026, 1, 1), dateFin: DISSOLUTION }, {}, [
      { id: 'l', dateDebut: jour(2026, 7, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' },
    ]);
    const etape15 = p.jalons.filter((j) => j.etape === 15).map((j) => j.libelle);
    expect(etape15).toEqual(['Déclaration de la cotisation spéciale (période d’activité)']);
    const i15 = p.jalons.findIndex((j) => j.etape === 15);
    expect(p.jalons.slice(0, i15).every((j) => j.etape <= 15)).toBe(true);
    expect(p.dissolution).toMatchObject({ arretPropose: false, exerciceDeLiquidation: false, annulationProposee: true });
  });

  it('exercice civil qui contient la dissolution · l’arrêt est proposé et la cotisation l’invite', async () => {
    const p = await planning({ dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31) });
    expect(p.dissolution).toMatchObject({ arretPropose: true, motifArret: null, exerciceDeLiquidation: false });
    // La déclaration annuelle de l'IS de l'année de la dissolution n'est plus servie (point 4).
    expect(p.jalons.some((j) => j.libelle === 'Déclarations fiscales annuelles')).toBe(false);
    const c = p.jalons.find((j) => j.libelle === 'Déclaration de la cotisation spéciale (période d’activité)')!;
    expect(c.detail).toContain('n’est pas arrêté à la date de dissolution');
  });

  it('exercice de liquidation · la seconde cotisation, aucune déclaration annuelle', async () => {
    const p = await planning({ dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31) });
    expect(p.dissolution).toMatchObject({ exerciceDeLiquidation: true });
    const etape15 = p.jalons.filter((j) => j.etape === 15).map((j) => j.libelle);
    expect(etape15).toEqual(['Déclaration de la cotisation spéciale (dernier bilan de liquidation)']);
  });

  it('une clôture en cours de mois se compte de date à date (constat 4) · dissolution au 17 septembre', async () => {
    const d = jour(2026, 9, 17);
    const p = await planning({ dateDebut: jour(2026, 1, 1), dateFin: d }, { dateDissolution: d });
    const ag = p.jalons.find((j) => j.libelle === 'Assemblée générale statuant sur les états financiers')!;
    expect(iso(ag.echeance as Date)).toBe('2027-03-17');
  });

  it('société non dissoute · la déclaration annuelle reste, aucune cotisation', async () => {
    const p = await planning({ dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31) }, { dateDissolution: null });
    expect(p.jalons.filter((j) => j.etape === 15).map((j) => j.libelle)).toEqual(['Déclarations fiscales annuelles']);
    expect(p.dissolution).toBeNull();
  });
});

describe('faits déclarés au dossier · clôture de la liquidation et dépôt des deux déclarations', () => {
  function service(tenant: Record<string, unknown>, capture: { data?: Record<string, unknown> } = {}) {
    const t = {
      id: 't1',
      referentiel: Referentiel.SYSCOHADA,
      formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
      dateDissolution: DISSOLUTION,
      ...tenant,
    };
    return new TenantService({
      tenant: {
        findUnique: async () => t,
        findUniqueOrThrow: async () => t,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          capture.data = data;
          return { id: 't1' };
        },
      },
      exercice: { findFirst: async () => null, count: async () => 0 },
      ecriture: { count: async () => 0 },
      compte: { findMany: async () => [] },
    } as never);
  }

  it('clôture puis seconde déclaration, chacune après ce qui la précède ; l’effacement admis', async () => {
    const capture: { data?: Record<string, unknown> } = {};
    await service({}, capture).modifierIdentite('t1', {
      dateDeclarationCotisationActivite: '2026-07-20',
      dateClotureLiquidation: '2026-09-30',
      dateDeclarationCotisationLiquidation: '2026-10-05',
    });
    expect(iso(capture.data!.dateClotureLiquidation as Date)).toBe('2026-09-30');
    expect(iso(capture.data!.dateDeclarationCotisationLiquidation as Date)).toBe('2026-10-05');
    const efface: { data?: Record<string, unknown> } = {};
    await service({ dateClotureLiquidation: jour(2026, 9, 30) }, efface).modifierIdentite('t1', { dateClotureLiquidation: '' });
    expect(efface.data!.dateClotureLiquidation).toBeNull();
  });

  it('refus nommés · avant la dissolution, à venir, sans clôture, sans dissolution, hors société, sans liquidation', async () => {
    await expect(service({}).modifierIdentite('t1', { dateClotureLiquidation: '2026-06-01' })).rejects.toThrow('précéder la dissolution');
    await expect(service({}).modifierIdentite('t1', { dateClotureLiquidation: '2999-01-01' })).rejects.toThrow('à venir');
    await expect(service({}).modifierIdentite('t1', { dateDeclarationCotisationLiquidation: '2026-08-01' })).rejects.toThrow(
      'déclarez d’abord la date de clôture',
    );
    await expect(
      service({ dateClotureLiquidation: jour(2026, 9, 30) }).modifierIdentite('t1', { dateDeclarationCotisationLiquidation: '2026-09-01' }),
    ).rejects.toThrow('après la clôture');
    await expect(service({ dateDissolution: null }).modifierIdentite('t1', { dateDeclarationCotisationActivite: '2026-07-20' })).rejects.toThrow(
      'Déclarez d’abord la date de dissolution',
    );
    await expect(
      service({ formeJuridiqueSyscohada: FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE }).modifierIdentite('t1', {
        dateDeclarationCotisationActivite: '2026-07-20',
      }),
    ).rejects.toThrow('société commerciale');
    await expect(
      service({ associeUniquePersonneMorale: true }).modifierIdentite('t1', { dateClotureLiquidation: '2026-09-30' }),
    ).rejects.toThrow('Sans liquidation');
  });
});
