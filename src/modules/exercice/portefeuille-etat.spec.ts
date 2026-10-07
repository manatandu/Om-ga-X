import { BadRequestException } from '@nestjs/common';
import { FormeJuridiqueSyscohada, Referentiel, RoleUtilisateur } from '@prisma/client';
import { appliquerPortefeuilleEtat, FaitsPortefeuille, JalonServi, observationDuFait } from './portefeuille-etat';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { REFERENTIELS_KEY } from '../../common/decorators/referentiels.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

/**
 * ENTREPRISE DU PORTEFEUILLE DE L'ÉTAT · O.-L. n° 13/003, art. 112 et 113
 * (décision par la loi du 2026-10-04, point 1) · AUSCGIE art. 140, 269, 288,
 * 306 et 345 et AUDCIF art. 71 pour les délais qui se comptent de
 * l'assemblée, forme par forme (relecture 2).
 */
const jalon = (etape: number, debut: string, echeance: string): JalonServi => ({
  etape,
  libelle: `Jalon ${etape}`,
  detail: 'Détail.',
  nature: 'LEGALE',
  source: 'Source',
  sanction: null,
  debut: new Date(debut),
  echeance: new Date(echeance),
  enRetard: false,
});
const iso = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
const BASE = [
  jalon(13, '2027-03-01', '2027-04-30'),
  jalon(15, '2027-03-01', '2027-04-30'),
  jalon(16, '2027-03-01', '2027-04-30'),
  jalon(17, '2027-03-15', '2027-05-15'),
  jalon(18, '2027-03-01', '2027-05-15'),
  jalon(21, '2027-04-01', '2027-06-30'),
  jalon(23, '2027-04-01', '2027-06-30'),
  jalon(24, '2027-07-01', '2027-07-31'),
  jalon(26, '2027-06-01', '2027-08-31'),
];
const AUJOURDHUI = new Date(Date.UTC(2027, 0, 10));
const FAITS: FaitsPortefeuille = {
  dateFin: new Date(Date.UTC(2026, 11, 31)),
  forme: FormeJuridiqueSyscohada.SOCIETE_ANONYME,
  commissaireDesigne: null,
  exerciceClos: false,
  dateAssembleeGenerale: null,
  dateDepotEtatsPortefeuille: null,
  dateTransmissionPvPortefeuille: null,
  dateDecisionAffectation: null,
};
const par = (r: JalonServi[], etape: number) => r.find((j) => j.etape === etape)!;
const pvDe = (r: JalonServi[]) => r.find((j) => j.libelle.startsWith('Procès-verbal'))!;
const affectationDe = (r: JalonServi[]) => r.find((j) => j.libelle.startsWith('Affectation des résultats'))!;

describe('Entreprise du portefeuille de l’État · O.-L. n° 13/003', () => {
  it('exercice clos au 31 décembre · assemblée au 31 mars, 45 jours avant (étapes 17 ET 18) · 14 février, RCCM 30 avril', () => {
    const r = appliquerPortefeuilleEtat(BASE, FAITS, AUJOURDHUI);
    expect(iso(par(r, 21).echeance)).toBe('2027-03-31');
    expect(iso(par(r, 23).echeance)).toBe('2027-03-31');
    expect(par(r, 21).source).toContain('art. 112');
    expect(iso(par(r, 17).echeance)).toBe('2027-02-14');
    expect(iso(par(r, 18).echeance)).toBe('2027-02-14');
    expect(iso(par(r, 24).echeance)).toBe('2027-04-30');
    // Les états (13) et le rapport de gestion (16) partent aux commissaires avant l'assemblée · bornés.
    expect(iso(par(r, 13).echeance)).toBe('2027-02-14');
    expect(iso(par(r, 16).echeance)).toBe('2027-02-14');
    expect(par(r, 16).detail).toContain('quarante-cinq');
    // La déclaration fiscale (15) n'est pas touchée.
    expect(iso(par(r, 15).echeance)).toBe('2027-04-30');
    // UN DÉBUT NE SUIT JAMAIS SON ÉCHÉANCE.
    for (const j of r) {
      if (j.debut && j.echeance) expect({ etape: j.etape, ok: j.debut.getTime() <= j.echeance.getTime() }).toEqual({ etape: j.etape, ok: true });
    }
    // PV · au plus tard dix jours après le 31 mars, faute de date d'assemblée, et dit.
    expect(iso(pvDe(r).echeance)).toBe('2027-04-10');
    expect(pvDe(r).detail).toContain('Au plus tard, faute de date d’assemblée déclarée');
    // Affectation · pendant l'exercice, le dépôt ne peut pas exister · EN
    // ATTENTE, hors du compte des échéances non calculées.
    expect(affectationDe(r).echeance).toBeNull();
    expect(affectationDe(r).enAttente).toBe('En attente du dépôt');
  });

  it('affectation · non calculée dès que le dépôt est possible (exercice clôturé, ou 31 mars passé)', () => {
    const clos = appliquerPortefeuilleEtat(BASE, { ...FAITS, exerciceClos: true }, AUJOURDHUI);
    expect(affectationDe(clos).enAttente).toBeUndefined();
    expect(affectationDe(clos).echeance).toBeNull();
    expect(affectationDe(clos).detail).toContain('Échéance non calculée');
    const avril = appliquerPortefeuilleEtat(BASE, FAITS, new Date(Date.UTC(2027, 3, 1)));
    expect(affectationDe(avril).enAttente).toBeUndefined();
    const trenteEtUn = appliquerPortefeuilleEtat(BASE, FAITS, new Date(Date.UTC(2027, 2, 31)));
    expect(affectationDe(trenteEtUn).enAttente).toBe('En attente du dépôt');
  });

  it('année bissextile · 15 février ; dix jours calendaires de l’assemblée, soixante du dépôt', () => {
    const r = appliquerPortefeuilleEtat(
      BASE.map((j) => ({ ...j, debut: new Date(j.debut!.getTime() + 365 * 86_400_000), echeance: new Date(j.echeance!.getTime() + 366 * 86_400_000) })),
      { ...FAITS, dateFin: new Date(Date.UTC(2027, 11, 31)), dateDepotEtatsPortefeuille: new Date(Date.UTC(2028, 2, 1)) },
      AUJOURDHUI,
    );
    expect(iso(par(r, 17).echeance)).toBe('2028-02-15');
    expect(iso(affectationDe(r).echeance)).toBe('2028-04-30');
  });

  it('assemblée DÉCLARÉE le 20 mars · étapes 21 et 23 levées (jamais rouges), PV au 30 mars, 45 jours avant le 3 février', () => {
    const apres = new Date(Date.UTC(2027, 3, 15));
    const r = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)) }, apres);
    for (const e of [21, 23]) {
      expect(par(r, e).observation).toEqual({ libelle: 'Assemblée tenue le 20/03/2027', satisfait: true });
      expect(par(r, e).enRetard).toBe(false);
    }
    expect(iso(pvDe(r).echeance)).toBe('2027-03-30');
    expect(pvDe(r).enRetard).toBe(true);
    expect(iso(par(r, 17).echeance)).toBe('2027-02-03');
    // Assemblée tenue APRÈS le 31 mars · elle lève le jalon, et le dit, en
    // ambre (une assemblée tenue restait rouge à vie).
    const tard = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 3, 5)) }, apres);
    expect(par(tard, 21).observation).toEqual({
      libelle: 'Assemblée tenue le 05/04/2027, après l’échéance du 31/03/2027',
      satisfait: true,
      horsDelai: true,
    });
    expect(par(tard, 21).enRetard).toBe(false);
  });

  it('assemblée FUTURE · admise pour les délais à rebours, « prévue », elle ne lève rien', () => {
    const mars = new Date(Date.UTC(2027, 2, 1));
    const r = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)) }, mars);
    expect(par(r, 21).observation).toEqual({ libelle: 'Assemblée prévue le 20/03/2027', satisfait: false });
    expect(iso(par(r, 17).echeance)).toBe('2027-02-03');
    expect(par(r, 17).detail).toContain('l’assemblée prévue');
    // Le 31 mars passé, une assemblée encore future laisse le jalon rouge.
    const avril = new Date(Date.UTC(2027, 3, 5));
    const tard = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 3, 20)) }, avril);
    expect(par(tard, 21).observation?.satisfait).toBe(false);
    expect(par(tard, 21).enRetard).toBe(true);
  });

  it('un fait déclaré · la même règle pour tous (tenu, après l’échéance, prévu)', () => {
    const f = { passe: 'Fait tenu', prevu: 'Fait prévu' };
    const ech = new Date(Date.UTC(2027, 2, 31));
    const auj = new Date(Date.UTC(2027, 5, 1));
    expect(observationDuFait(f, null, ech, auj)).toBeUndefined();
    expect(observationDuFait(f, new Date(Date.UTC(2027, 2, 31)), ech, auj)).toEqual({ libelle: 'Fait tenu le 31/03/2027', satisfait: true });
    expect(observationDuFait(f, new Date(Date.UTC(2027, 3, 1)), ech, auj)).toEqual({
      libelle: 'Fait tenu le 01/04/2027, après l’échéance du 31/03/2027',
      satisfait: true,
      horsDelai: true,
    });
    // Le jour même se déclare · daté d'aujourd'hui, il lève.
    expect(observationDuFait(f, auj, null, auj)?.satisfait).toBe(true);
    expect(observationDuFait(f, new Date(Date.UTC(2027, 5, 2)), ech, auj)).toEqual({ libelle: 'Fait prévu le 02/06/2027', satisfait: false });
  });

  it('délais forme par forme · l’art. 140 ne vise que SA, SAS et SARL « le cas échéant » ; SNC et SCS · quinze jours (art. 288, 306)', () => {
    const avecAg = { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 31)) };
    // SARL sans commissaire enregistré · rien de fabriqué pour 17 et 18,
    // documents bornés aux quinze jours du droit de communication (art. 345).
    const sarl = appliquerPortefeuilleEtat(BASE, { ...avecAg, forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE }, AUJOURDHUI);
    for (const e of [17, 18]) {
      expect(par(sarl, e).echeance).toBeNull();
      expect(par(sarl, e).enAttente).toBe('Sans commissaire enregistré');
      expect(par(sarl, e).enRetard).toBe(false);
    }
    expect(iso(par(sarl, 13).echeance)).toBe('2027-03-16');
    expect(par(sarl, 13).source).toContain('art. 345');
    // SARL avec commissaire · les quarante-cinq jours de l'art. 140.
    const sarlCac = appliquerPortefeuilleEtat(
      BASE,
      { ...avecAg, forme: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, commissaireDesigne: true },
      AUJOURDHUI,
    );
    expect(iso(par(sarlCac, 17).echeance)).toBe('2027-02-14');
    expect(iso(par(sarlCac, 13).echeance)).toBe('2027-02-14');
    // SNC sans commissaire · quinze jours de l'art. 288, rien à rebours du commissaire.
    const snc = appliquerPortefeuilleEtat(BASE, { ...avecAg, forme: FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF }, AUJOURDHUI);
    expect(par(snc, 18).enAttente).toBe('Sans commissaire enregistré');
    expect(iso(par(snc, 13).echeance)).toBe('2027-03-16');
    expect(iso(par(snc, 16).echeance)).toBe('2027-03-16');
    expect(par(snc, 16).source).toContain('art. 288 et 306');
    expect(par(snc, 16).source).not.toContain('art. 140');
    // SCS avec commissaire · l'AUDCIF art. 71 (« s'ils existent »), jamais l'art. 140.
    const scs = appliquerPortefeuilleEtat(
      BASE,
      { ...avecAg, forme: FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE, commissaireDesigne: true },
      AUJOURDHUI,
    );
    expect(iso(par(scs, 18).echeance)).toBe('2027-02-14');
    expect(par(scs, 18).source).toContain('AUDCIF, art. 71');
    expect(par(scs, 13).source).not.toContain('AUSCGIE, art. 140');
    // Quelle que soit la forme, l'assemblée est au 31 mars.
    for (const r of [sarl, snc, scs]) expect(iso(par(r, 21).echeance)).toBe('2027-03-31');
  });

  it('JAMAIS UN ROUGE QU’AUCUN GESTE NE LÈVE · PV levé par sa communication déclarée, affectation par la décision enregistrée', () => {
    const tres = new Date(Date.UTC(2027, 11, 1));
    const faits = {
      ...FAITS,
      dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
      dateDepotEtatsPortefeuille: new Date(Date.UTC(2027, 3, 5)),
    };
    const rouge = appliquerPortefeuilleEtat(BASE, faits, tres);
    expect(pvDe(rouge).enRetard).toBe(true);
    expect(affectationDe(rouge).enRetard).toBe(true);
    const leve = appliquerPortefeuilleEtat(
      BASE,
      {
        ...faits,
        dateTransmissionPvPortefeuille: new Date(Date.UTC(2027, 2, 25)),
        dateDecisionAffectation: new Date(Date.UTC(2027, 4, 20)),
      },
      tres,
    );
    expect(pvDe(leve).observation).toEqual({ libelle: 'Procès-verbal communiqué le 25/03/2027', satisfait: true });
    expect(pvDe(leve).enRetard).toBe(false);
    expect(affectationDe(leve).observation).toEqual({ libelle: 'Affectation décidée le 20/05/2027', satisfait: true });
    expect(affectationDe(leve).enRetard).toBe(false);
    // Tardifs · levés aussi, et dits (le procès-verbal passait au vert sans un mot).
    const tardifs = appliquerPortefeuilleEtat(
      BASE,
      {
        ...faits,
        dateTransmissionPvPortefeuille: new Date(Date.UTC(2027, 3, 8)),
        dateDecisionAffectation: new Date(Date.UTC(2027, 6, 1)),
      },
      tres,
    );
    expect(pvDe(tardifs).observation).toEqual({
      libelle: 'Procès-verbal communiqué le 08/04/2027, après l’échéance du 30/03/2027',
      satisfait: true,
      horsDelai: true,
    });
    expect(affectationDe(tardifs).observation?.horsDelai).toBe(true);
    expect(affectationDe(tardifs).enRetard).toBe(false);
  });

  it('autre clôture · rien n’est calculé, et le jalon le dit ; les six mois restent', () => {
    const r = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateFin: new Date(Date.UTC(2027, 5, 30)) }, AUJOURDHUI);
    expect(iso(par(r, 21).echeance)).toBe('2027-06-30');
    const dit = r.find((j) => j.libelle.startsWith('Assemblée générale · entreprise du portefeuille'))!;
    expect(dit.echeance).toBeNull();
    // Le texte se tait · « aucun délai », jamais « non calculée » à vie.
    expect(dit.sansDelai).toBe(true);
    expect(dit.detail).toContain('Aucune échéance n’est calculée');
    expect(pvDe(r).echeance).toBeNull();
  });

  it('exercice clos avant le 27 février 2013 (art. 115) · planning inchangé', () => {
    const r = appliquerPortefeuilleEtat(BASE, { ...FAITS, dateFin: new Date(Date.UTC(2012, 11, 31)) }, AUJOURDHUI);
    expect(r).toBe(BASE);
  });

  it('les dates · route cloisonnée au SYSCOHADA et réservée à l’administrateur, comme l’arrêté des comptes', () => {
    expect(Reflect.getMetadata(REFERENTIELS_KEY, ExerciceController.prototype.declarerDatesPortefeuille)).toEqual([
      Referentiel.SYSCOHADA,
    ]);
    const roles = (m: keyof ExerciceController) => Reflect.getMetadata(ROLES_KEY, ExerciceController.prototype[m]);
    expect(roles('declarerDatesPortefeuille')).toEqual(roles('arreterComptes'));
    expect(roles('declarerFicheR2')).toEqual(roles('arreterComptes'));
    expect(roles('arreterComptes')).toEqual([RoleUtilisateur.ADMIN_CABINET]);
  });

  it('les dates · un JOUR lu par la règle commune · avant la clôture, hors calendrier, illisible, avec heure refusés', async () => {
    const prisma = {
      exercice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'e1',
          tenantId: 't1',
          dateFin: new Date(Date.UTC(2026, 11, 31)),
          dateAssembleeGenerale: null,
          dateTransmissionPvPortefeuille: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const s = new ExerciceService(prisma as never, {} as never);
    await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2026-12-15' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2027-02-30' })).rejects.toThrow(
      'absente du calendrier',
    );
    await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '20270101' })).rejects.toThrow(
      BadRequestException,
    );
    // Sur un exercice passé, la communication déclarée avant l'assemblée.
    const passe = new ExerciceService(
      {
        exercice: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'e0',
            tenantId: 't1',
            dateFin: new Date(Date.UTC(2024, 11, 31)),
            dateAssembleeGenerale: null,
            dateTransmissionPvPortefeuille: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as never,
      {} as never,
    );
    await expect(
      passe.declarerDatesPortefeuille('t1', 'e0', { dateAssembleeGenerale: '2025-03-20', dateTransmissionPvPortefeuille: '2025-03-19' }),
    ).rejects.toThrow('ne peut pas précéder celle de l’assemblée');
    // Un dépôt ou une communication À VENIR ne se déclare pas · l'assemblée future, si.
    await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateDepotEtatsPortefeuille: '2099-01-10' })).rejects.toThrow(
      'à venir ne se déclare pas',
    );
    await expect(
      s.declarerDatesPortefeuille('t1', 'e1', { dateTransmissionPvPortefeuille: '2099-01-10' }),
    ).rejects.toThrow('à venir ne se déclare pas');
    await s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2099-03-20' });
    // Un jour s'écrit AAAA-MM-JJ · une heure à fuseau est refusée, nommée
    // (« 2026-10-06T23:30:00Z » est déjà le 7 à Kinshasa).
    for (const heure of ['2027-03-20T23:30:00-05:00', '2026-10-06T23:30:00Z']) {
      await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: heure })).rejects.toThrow('format AAAA-MM-JJ');
    }
    await s.declarerDatesPortefeuille('t1', 'e1', {
      dateAssembleeGenerale: '2027-03-20',
      dateDepotEtatsPortefeuille: null,
      dateTransmissionPvPortefeuille: '',
    });
    expect(prisma.exercice.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: {
        dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
        dateDepotEtatsPortefeuille: null,
        dateTransmissionPvPortefeuille: null,
      },
    });
  });

  it('le planning ne l’applique que sur « oui » déclaré, aux sociétés commerciales du SYSCOHADA ; « pas encore dit » invite à le déclarer', async () => {
    const exercice = {
      id: 'e1',
      tenantId: 't1',
      dateDebut: new Date(Date.UTC(2026, 0, 1)),
      dateFin: new Date(Date.UTC(2026, 11, 31)),
      statut: 'OUVERT',
      dateAssembleeGenerale: null,
      dateDepotEtatsPortefeuille: null,
      dateTransmissionPvPortefeuille: null,
    };
    const planning = async (
      referentiel: Referentiel,
      entreprisePortefeuilleEtat: boolean | null,
      forme = 'SOCIETE_ANONYME',
      mandats: Array<{ premierExercice: number; nombreExercices: number; refusDeProrogation: boolean }> = [],
    ) => {
      const prisma = {
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue(mandats) },
        exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
        tenant: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            referentiel,
            formeJuridique: 'ASSOCIATION',
            formeJuridiqueSyscohada: forme,
            droitEtranger: false,
            associeUniqueSas: null,
            entreprisePortefeuilleEtat,
          }),
        },
        affectationResultat: { findFirst: jest.fn().mockResolvedValue(null) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
        rapportActivite: { count: jest.fn().mockResolvedValue(0) },
        donation: { findMany: jest.fn().mockResolvedValue([]) },
      };
      return new ExerciceService(prisma as never, {} as never).planningCloture('t1', 'e1');
    };
    const pv = (p: { jalons: Array<{ libelle: string }> }) =>
      p.jalons.some((j) => j.libelle.startsWith('Procès-verbal à l’Administration des recettes non fiscales'));
    expect(pv(await planning(Referentiel.SYSCOHADA, true))).toBe(true);
    expect(pv(await planning(Referentiel.SYSCOHADA, false))).toBe(false);
    expect(pv(await planning(Referentiel.SYCEBNL, true))).toBe(false);
    // Hors des cinq sociétés commerciales, même un « oui » resté en base ne sert rien.
    expect(pv(await planning(Referentiel.SYSCOHADA, true, 'ENTREPRENANT'))).toBe(false);
    const nonDit = await planning(Referentiel.SYSCOHADA, null);
    expect(pv(nonDit)).toBe(false);
    const etape23 = nonDit.jalons.find((j: { etape: number }) => j.etape === 23)!;
    expect(etape23.detail).toContain('PORTEFEUILLE DE L’ÉTAT NON DÉCLARÉ');
    // LE COMMISSAIRE SE LIT SUR LA TABLE DES MANDATS · SARL sans mandat, l'étape
    // 17 attend ; avec un mandat qui couvre 2026, quarante-cinq jours.
    const etape17 = (p: { jalons: Array<{ etape: number; echeance: Date | null; enAttente?: string }> }) =>
      p.jalons.find((j) => j.etape === 17)!;
    const sansMandat = await planning(Referentiel.SYSCOHADA, true, 'SOCIETE_RESPONSABILITE_LIMITEE');
    expect(etape17(sansMandat).enAttente).toBe('Sans commissaire enregistré');
    const avecMandat = await planning(Referentiel.SYSCOHADA, true, 'SOCIETE_RESPONSABILITE_LIMITEE', [
      { premierExercice: 2025, nombreExercices: 3, refusDeProrogation: false },
    ]);
    expect(iso(etape17(avecMandat).echeance)).toBe('2027-02-14');
  });
});
