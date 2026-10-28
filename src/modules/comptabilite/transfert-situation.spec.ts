import { BadRequestException, ConflictException } from '@nestjs/common';
import { NumerotationPiece, StatutEcriture, StatutExercice, TypeJournal } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ISSUE_TRANSFERT,
  motifArriveeDeSituation,
  motifBrouillardHeriteNeSeValidePas,
  motifTransfertSansObjet,
} from './ecritures-de-situation';
import { EcritureService } from './ecriture.service';
import { PrismaService } from '../../common/prisma.service';
import { JournalService } from '../journaux/journal.service';
import { ExerciceService } from '../exercice/exercice.service';
import { AnalytiqueService } from '../analytique/analytique.service';
import { motifEcartJournalDeSituation } from '../../common/journal-de-situation/extension-journal-de-situation';

/**
 * LE BROUILLARD HÉRITÉ D'UN JOURNAL DE SITUATION SE TRANSFÈRE (relecture du
 * second tour de la ligne sage-l1, BLOQUANT).
 *
 * La reprise des écritures tenues les laisse au brouillard dans leur journal
 * de situation · elles ne s'y valident pas, délettrer ou dépointer est parfois
 * impossible, et la clôture annuelle refuse tout brouillard · le dossier était
 * enfermé. Le geste qui l'en sort change le JOURNAL, le NUMÉRO et, sur
 * demande, la DATE (AUDCIF art. 22, 4°), jamais les LIGNES · lettrage,
 * pointage et liens des modules suivent la pièce.
 *
 * CE QUI CASSERAIT EN SILENCE · un transfert qui toucherait aux lignes (le
 * lettrage de la facture se dénouerait), qui prendrait le numéro du journal
 * d'origine (doublon dans le journal d'arrivée), ou qui passerait par-dessus
 * une période close du journal d'arrivée (insertion intercalaire, art. 22,
 * 3°) ; et une validation par période qui refuserait le mois entier pour une
 * seule pièce héritée.
 */

const SOURCE = (chemin: string) => readFileSync(join(__dirname, '..', '..', '..', chemin), 'utf8');

const EXERCICE = { id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: StatutExercice.OUVERT };
const OD = { id: 'jOD', code: 'OD', type: TypeJournal.GENERAL, numerotation: NumerotationPiece.CONTINUE_JOURNAL, estActif: true };

function heritee(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    statut: StatutEcriture.BROUILLARD,
    exerciceId: 'ex1',
    journalId: 'jSIT',
    numeroPiece: 7,
    date: new Date('2026-04-10'),
    dateValeur: null,
    journal: { code: 'SIT', type: TypeJournal.SITUATION },
    ...surcharge,
  };
}

function monter(ecriture: Record<string, unknown> | null, arrivee: Record<string, unknown> = OD, relue?: Record<string, unknown> | null) {
  const update = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'e1', ...data, journal: { code: arrivee.code } }),
  );
  const ligneEcriture = { deleteMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() };
  const tx = {
    ecriture: {
      findFirst: jest.fn().mockResolvedValue(
        relue === undefined ? (ecriture ? { statut: ecriture.statut, journalId: ecriture.journalId, exerciceId: 'ex1' } : null) : relue,
      ),
      update,
    },
    exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
    ligneEcriture,
    // Les pièces jointes (ligne sage-l6) · aucune, sauf quand le cas en pose.
    pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
  };
  const prisma = {
    ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture) },
    $transaction: jest.fn().mockImplementation((f: (t: unknown) => unknown) => f(tx)),
  };
  const journalService = {
    trouver: jest.fn().mockResolvedValue(arrivee),
    prochainNumeroPiece: jest.fn().mockResolvedValue(42),
  };
  const service = new EcritureService(
    prisma as unknown as PrismaService,
    journalService as unknown as JournalService,
    {} as unknown as ExerciceService,
    {} as AnalytiqueService,
  );
  return { service, update, journalService, ligneEcriture, prisma, tx };
}

describe('le transfert d’un brouillard hérité dans un journal ordinaire', () => {
  it('change le journal et le numéro, garde la date et ne touche à aucune ligne', async () => {
    const { service, update, journalService, ligneEcriture } = monter(heritee());
    const controles = jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
      exercice: EXERCICE,
      journal: OD,
      date: new Date('2026-04-10'),
      dateValeur: null,
      sectionsParId: new Map(),
    } as never);

    const r = await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' });

    // Les contrôles d'en-tête de la saisie, sur le journal d'ARRIVÉE, sans
    // lignes (elles ne sont pas ressaisies) et sans admettre un journal de
    // situation.
    const piece = controles.mock.calls[0][1];
    expect(piece).toMatchObject({ exerciceId: 'ex1', journalId: 'jOD', reporterAuPremierJourOuvert: false });
    expect(piece.lignes).toBeUndefined();
    expect(piece.journalDeSituationAdmis).toBeUndefined();
    // Le numéro suivant du journal d'arrivée.
    expect(journalService.prochainNumeroPiece).toHaveBeenCalledWith('t1', OD, 'ex1', new Date('2026-04-10'), expect.anything());
    expect(update).toHaveBeenCalledTimes(1);
    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: 'e1' });
    // Le journal et le numéro sont du contenu · le transfert nomme son auteur
    // (ici aucun, il est INCONNU) et fait tomber le visa (ligne microfina-m1).
    expect(data).toEqual({
      journalId: 'jOD',
      numeroPiece: 42,
      date: new Date('2026-04-10'),
      contenuPar: null,
      contenuLe: expect.any(Date),
      viseePar: null,
      viseeLe: null,
      viseeEmpreinte: null,
    });
    expect(Object.keys(data)).not.toContain('lignes');
    expect(Object.keys(data)).not.toContain('statut');
    for (const f of Object.values(ligneEcriture)) expect(f).not.toHaveBeenCalled();
    expect(r).toMatchObject({ numeroPiece: 42, journal: { code: 'OD' } });
  });

  it('ses pièces jointes disent le nouveau journal et le nouveau numéro (relecture sage-l6, mineur 2)', async () => {
    const { service, tx } = monter(heritee());
    jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
      exercice: EXERCICE,
      journal: OD,
      date: new Date('2026-04-10'),
      dateValeur: null,
      sectionsParId: new Map(),
    } as never);
    // La relecture du brouillard, puis l'écriture transférée telle que la description la lit.
    tx.ecriture.findFirst
      .mockResolvedValueOnce({ statut: 'BROUILLARD', journalId: heritee().journalId, exerciceId: 'ex1' })
      .mockResolvedValueOnce({
        statut: 'BROUILLARD', estANouveauProvisoire: false, numeroPiece: 42, date: new Date('2026-04-10'),
        libelle: 'Loyer', journalId: 'jOD', journal: { code: 'OD' },
      });
    tx.pieceJointeEcriture.count.mockResolvedValue(1);
    tx.pieceJointeEcriture.findMany.mockResolvedValueOnce([{ id: 'pj-1' }]).mockResolvedValue([]);
    await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' });
    // Seules les pièces dont la description a changé, une à une.
    expect(tx.pieceJointeEcriture.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 't1',
      ecritureId: 'e1',
      NOT: { ecritureDecrite: 'OD n° 42 du 10/04/2026 · Loyer' },
    });
    expect(tx.pieceJointeEcriture.update).toHaveBeenCalledWith({
      where: { id: 'pj-1' },
      data: { ecritureDecrite: 'OD n° 42 du 10/04/2026 · Loyer' },
      select: { id: true, ecritureId: true, ecritureDecrite: true },
    });
  });

  it('reportée au premier jour non clôturé, elle garde sa date d’origine en date de valeur (art. 22, 4°)', async () => {
    const { service, update } = monter(heritee({ date: new Date('2026-02-15') }));
    jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
      exercice: EXERCICE,
      journal: OD,
      date: new Date('2026-04-01'),
      dateValeur: new Date('2026-02-15'),
      sectionsParId: new Map(),
    } as never);
    await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD', reporterAuPremierJourOuvert: true });
    expect(update.mock.calls[0][0].data).toMatchObject({
      journalId: 'jOD',
      numeroPiece: 42,
      date: new Date('2026-04-01'),
      dateValeur: new Date('2026-02-15'),
    });
  });

  it('une date de valeur déjà portée prime sur la date d’origine', async () => {
    const { service, update } = monter(heritee({ date: new Date('2026-02-01'), dateValeur: new Date('2026-01-20') }));
    jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
      exercice: EXERCICE,
      journal: OD,
      date: new Date('2026-04-01'),
      dateValeur: new Date('2026-02-01'),
      sectionsParId: new Map(),
    } as never);
    await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD', reporterAuPremierJourOuvert: true });
    expect(update.mock.calls[0][0].data.dateValeur).toEqual(new Date('2026-01-20'));
  });

  it('refuse un journal d’arrivée de situation, en le nommant, avant toute écriture', async () => {
    const { service, update } = monter(heritee(), { ...OD, id: 'jSIT2', code: 'SIT2', type: TypeJournal.SITUATION });
    await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jSIT2' })).rejects.toThrow(
      motifArriveeDeSituation('SIT2'),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('refuse ce qui n’est pas un brouillard hérité · simulation, pièce validée, journal ordinaire', async () => {
    for (const [surcharge, attendu] of [
      [{ statut: StatutEcriture.SITUATION }, motifTransfertSansObjet('SIT n° 7', StatutEcriture.SITUATION, true)],
      [{ statut: StatutEcriture.VALIDEE }, motifTransfertSansObjet('SIT n° 7', StatutEcriture.VALIDEE, true)],
      [
        { journal: { code: 'VT', type: TypeJournal.VENTES }, journalId: 'jVT' },
        motifTransfertSansObjet('VT n° 7', StatutEcriture.BROUILLARD, false),
      ],
    ] as const) {
      const { service, update } = monter(heritee(surcharge));
      await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(attendu as string);
      expect(update).not.toHaveBeenCalled();
    }
    expect(motifTransfertSansObjet('SIT n° 7', StatutEcriture.BROUILLARD, true)).toBeNull();
  });

  it('relue changée dans la transaction (validée, transférée par un autre poste), elle n’est pas transférée deux fois', async () => {
    const { service, update } = monter(heritee(), OD, { statut: StatutEcriture.BROUILLARD, journalId: 'jOD', exerciceId: 'ex1' });
    jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
      exercice: EXERCICE,
      journal: OD,
      date: new Date('2026-04-10'),
      dateValeur: null,
      sectionsParId: new Map(),
    } as never);
    await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('l’invariant de l’extension admet le transfert · un brouillard dans un journal ordinaire', () => {
    expect(motifEcartJournalDeSituation({ situation: false, code: 'OD' }, StatutEcriture.BROUILLARD)).toBeNull();
    // Et refuse toujours de valider sur place.
    expect(motifEcartJournalDeSituation({ situation: true, code: 'SIT' }, StatutEcriture.VALIDEE)).not.toBeNull();
  });
});

describe('la validation du brouillard hérité', () => {
  function service(findMany: jest.Mock, count?: jest.Mock, updateMany = jest.fn()) {
    const prisma = {
      ecriture: { findMany, count: count ?? jest.fn().mockResolvedValue(0), updateMany },
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex1' }) },
      journal: { findFirst: jest.fn().mockResolvedValue({ id: 'jOD' }) },
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ doubleRegardValidation: false, referentiel: 'SYSCOHADA' }) },
      // La validation se fait par tranches, chacune dans sa transaction sous
      // verrou (relecture M5) · la doublure sert la transaction et le verrou.
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((f: (t: unknown) => unknown) => f(prisma));
    return new EcritureService(prisma as unknown as PrismaService, {} as JournalService, {} as unknown as ExerciceService, {} as AnalytiqueService);
  }

  it('une sélection qui le contient est refusée en le nommant, avec l’issue du transfert', async () => {
    const updateMany = jest.fn();
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'e1',
        statut: StatutEcriture.BROUILLARD,
        numeroPiece: 7,
        createdBy: 'u',
        estANouveauProvisoire: false,
        exercice: { statut: StatutExercice.OUVERT },
        journal: { code: 'SIT', type: TypeJournal.SITUATION },
        lignes: [],
      },
    ]);
    await expect(service(findMany, undefined, updateMany).valider('t1', 'u', ['e1'])).rejects.toThrow(
      motifBrouillardHeriteNeSeValidePas(['SIT n° 7']),
    );
    expect(motifBrouillardHeriteNeSeValidePas(['SIT n° 7'])).toContain('« Transférer »');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('la validation par période l’écarte en le comptant, et valide le reste', async () => {
    const updateMany = jest.fn();
    const e2 = {
      id: 'e2',
      statut: StatutEcriture.BROUILLARD,
      numeroPiece: 3,
      createdBy: 'u',
      estANouveauProvisoire: false,
      estGenereeParCloture: false,
      exercice: { statut: StatutExercice.OUVERT },
      journal: { code: 'OD', type: TypeJournal.GENERAL },
      lignes: [
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ],
    };
    const findMany = jest
      .fn()
      // Le lot · hors journal de situation.
      .mockResolvedValueOnce([{ id: 'e2' }])
      // Les écritures du lot relues par `valider`, puis sous verrou par la tranche.
      .mockResolvedValueOnce([e2])
      .mockResolvedValueOnce([e2]);
    const count = jest.fn().mockResolvedValue(2);
    const r = await service(findMany, count, updateMany).validerJusqua('t1', 'u', { exerciceId: 'ex1', dateLimite: '2026-04-30' });
    const lot = findMany.mock.calls[0][0].where;
    expect(lot.journal).toEqual({ type: { not: TypeJournal.SITUATION } });
    expect(count.mock.calls[0][0].where.journal).toEqual({ type: TypeJournal.SITUATION });
    expect(r.validees).toBe(1);
    expect(r.ecarteesJournalDeSituation).toBe(2);
    expect(r.motifEcarteesJournalDeSituation).toContain(ISSUE_TRANSFERT);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('rien d’autre à valider, le compteur est servi quand même', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const r = await service(findMany, jest.fn().mockResolvedValue(1)).validerJusqua('t1', 'u', { exerciceId: 'ex1', dateLimite: '2026-04-30' });
    expect(r).toMatchObject({ validees: 0, ecarteesJournalDeSituation: 1 });
    expect(r.motifEcarteesJournalDeSituation).toContain('journal de situation');
  });
});

describe('le contrôle et la clôture proposent le transfert', () => {
  it('l’action du contrôle et le refus de clôture nomment le geste', () => {
    const controles = SOURCE('src/modules/controles/controles.service.ts');
    const debut = controles.indexOf("code: 'JOURNAL_DE_SITUATION_AU_BROUILLARD'");
    const bloc = controles.slice(debut, controles.indexOf('occurrences:', debut));
    expect(bloc).toContain('${ISSUE_TRANSFERT}');
    expect(ISSUE_TRANSFERT).toContain('« Transférer »');
    const exercice = SOURCE('src/modules/exercice/exercice.service.ts');
    const cloturer = exercice.slice(exercice.indexOf('  async cloturer('));
    const corps = cloturer.slice(0, cloturer.indexOf('\n  }\n'));
    expect(corps).toContain('transférez-les dans');
    expect(corps).toContain('« Transférer »');
  });

  it('la route du transfert porte ses rôles, comme la modification du brouillard', () => {
    const src = SOURCE('src/modules/comptabilite/ecriture.controller.ts');
    const debut = src.indexOf("@Post(':id/transfert')");
    expect(debut).toBeGreaterThan(-1);
    const entete = src.slice(debut, src.indexOf('async transferer(', debut));
    expect(entete).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)');
  });

  it('un refus de transfert ne laisse rien à moitié · BadRequest avant la transaction', async () => {
    const { service, prisma } = monter(null);
    await expect(service.transfererDansUnJournalOrdinaire('t1', 'absente', { journalId: 'jOD' })).rejects.toThrow(
      'Écriture introuvable pour ce dossier.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const autre = monter(heritee({ statut: StatutEcriture.VALIDEE }));
    await expect(autre.service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(BadRequestException);
    expect(autre.prisma.$transaction).not.toHaveBeenCalled();
  });
});
