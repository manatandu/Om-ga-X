import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EcritureService } from '../comptabilite/ecriture.service';
import { ExerciceService } from '../exercice/exercice.service';
import {
  AucunPlanABudgetsException,
  EtatsFinanciersProjetBudgetService,
} from '../etats-financiers/etats-financiers-projet-budget.service';
import { EtatsFinanciersService } from '../etats-financiers/etats-financiers.service';
import { PrismaService } from '../../common/prisma.service';
import { NoteAnnexeService } from './note-annexe.service';
import { NOTES_ASSOCIATIONS } from './correspondance-notes-associations';
import { NOTES_PROJETS } from './correspondance-notes-projets';
import { RANG_FORMAT_ANTERIEUR } from './effectifs-seize-colonnes';
import { NoteAnnexeController } from './note-annexe.controller';
import { RetirerFormatAnterieurDto, SaisirNoteDto } from './dto/saisie-note.dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

function serviceAvec(saisies: Array<Record<string, unknown>>) {
  const ecriture = {
    balance: jest.fn(() => Promise.resolve({ lignes: [], totaux: { debit: 0, credit: 0 } })),
    virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
    mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
    mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
  } as unknown as EcritureService;
  const exercice = {
    lister: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z') }]),
  } as unknown as ExerciceService;
  const prisma = {
    rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
    provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
    saisieNote: { findMany: jest.fn().mockResolvedValue(saisies) },
    exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateFin: new Date('2026-12-31T00:00:00Z') }) },
    ecriture: { findMany: jest.fn().mockResolvedValue([]) },
    ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const budget = {
    executionBudgetaire: jest.fn().mockRejectedValue(new AucunPlanABudgetsException('aucun plan à budgets')),
  } as unknown as EtatsFinanciersProjetBudgetService;
  return new NoteAnnexeService(ecriture, exercice, prisma, budget, new EtatsFinanciersService(ecriture, exercice));
}

/**
 * NOTES 20B ET 29B · SEIZE COLONNES VENTILÉES M / F (SYCEBNL, Partie 4 ch. 2
 * et ch. 3 ; décision par la loi du 2026-10-04, point 3).
 */
describe('Notes 20B et 29B · personnel propre à seize colonnes', () => {
  it.each([
    ['29B', NOTES_ASSOCIATIONS],
    ['20B', NOTES_PROJETS],
  ] as const)('%s · seize colonnes dans l’ordre du texte, le personnel extérieur garde sa colonne unique', (code, notes) => {
    const propre = notes.find((n) => n.code === code && n.sousTableau === 'PERSONNEL PROPRE')!;
    expect(propre.colonnes.map((c) => c.libelle)).toEqual([
      'EFFECTIFS · Nationaux · M',
      'EFFECTIFS · Nationaux · F',
      'EFFECTIFS · Autres Etats de la Région · M',
      'EFFECTIFS · Autres Etats de la Région · F',
      'EFFECTIFS · Hors Région · M',
      'EFFECTIFS · Hors Région · F',
      'EFFECTIFS · Total · M',
      'EFFECTIFS · Total · F',
      'MASSE SALARIALE · Nationaux · M',
      'MASSE SALARIALE · Nationaux · F',
      'MASSE SALARIALE · Autres Etats de la Région · M',
      'MASSE SALARIALE · Autres Etats de la Région · F',
      'MASSE SALARIALE · Hors Région · M',
      'MASSE SALARIALE · Hors Région · F',
      'MASSE SALARIALE · Total · M',
      'MASSE SALARIALE · Total · F',
    ]);
    expect(propre.colonnes.every((c) => c.type === 'LIBRE')).toBe(true);
    // La transcription ne nomme que « Facturation à l'entité » · rien n'est transposé du 27B SYSCOHADA.
    const exterieur = notes.find((n) => n.code === code && n.sousTableau === 'PERSONNEL EXTERIEUR ET BENEVOLE')!;
    expect(exterieur.colonnes.map((c) => c.libelle)).toEqual(["Facturation à l'entité"]);
  });

  it('la migration porte l’ancien rang k au rang 100 + k, sur les seules rubriques du personnel propre, sans rien supprimer', () => {
    const sql = readFileSync(
      join(__dirname, '../../../prisma/migrations/20270149000000_effectifs_seize_colonnes/migration.sql'),
      'utf8',
    );
    expect(RANG_FORMAT_ANTERIEUR).toBe(100);
    expect(sql).toContain('SET "colonne" = "colonne" + 100');
    expect(sql).toContain(`"jeu" = 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' AND "codeNote" = '29B'`);
    expect(sql).toContain(`"jeu" = 'PROJETS_DEVELOPPEMENT' AND "codeNote" = '20B'`);
    // UNE SEULE INSTRUCTION, et c'est un UPDATE · rien n'est supprimé.
    const instructions = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((x) => x.trim())
      .filter((x) => x !== '');
    expect(instructions).toHaveLength(1);
    expect(instructions[0].startsWith('UPDATE "saisies_notes"')).toBe(true);
    // La liste visée est EXACTEMENT celle des rubriques du personnel propre,
    // la même dans les deux jeux · le personnel extérieur n'y est pas.
    const cles = NOTES_ASSOCIATIONS.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE')!.rubriques.map(
      (r) => r.cle!,
    );
    const liste = /"cleRubrique" IN \(([^)]*)\)/.exec(instructions[0])![1];
    const visees = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(visees).toEqual(cles);
    expect(
      NOTES_PROJETS.find((n) => n.code === '20B' && n.sousTableau === 'PERSONNEL PROPRE')!.rubriques.map((r) => r.cle),
    ).toEqual(cles);
  });

  it('une saisie ancienne n’est JAMAIS scindée · aucune cellule ne la lit, la note la montre à part', async () => {
    const ecriture = {
      balance: jest.fn(() => Promise.resolve({ lignes: [], totaux: { debit: 0, credit: 0 } })),
      virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
      mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
      mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    } as unknown as EcritureService;
    const exercice = {
      lister: jest.fn().mockResolvedValue([{ id: 'e1', dateDebut: new Date('2026-01-01T00:00:00Z') }]),
    } as unknown as ExerciceService;
    const prisma = {
      rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
      provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
      saisieNote: {
        findMany: jest.fn().mockResolvedValue([
          // Ancien rang 0 « EFFECTIFS · Nationaux (M / F) », gardé au rang 100.
          { codeNote: '29B', cleRubrique: 'ya-1-cadres-superieurs', colonne: 100, valeurTexte: '3 / 2', valeurNombre: null },
          // Une saisie au nouveau format, rang 1 (Nationaux · F).
          { codeNote: '29B', cleRubrique: 'yb-2-techniciens-superieurs-et-cadres-moyens', colonne: 1, valeurTexte: '4', valeurNombre: null },
        ]),
      },
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', dateFin: new Date('2026-12-31T00:00:00Z') }) },
      ecriture: { findMany: jest.fn().mockResolvedValue([]) },
      ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const budget = {
      executionBudgetaire: jest.fn().mockRejectedValue(new AucunPlanABudgetsException('aucun plan à budgets')),
    } as unknown as EtatsFinanciersProjetBudgetService;
    const service = new NoteAnnexeService(ecriture, exercice, prisma, budget, new EtatsFinanciersService(ecriture, exercice));

    const { notes } = await service.notesAssociations('t', 'e1');
    const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE')!;
    const ya = propre.lignes.find((l) => l.cle === 'ya-1-cadres-superieurs')!;
    expect(ya.saisie).toHaveLength(16);
    expect(ya.saisie!.every((v) => v === null)).toBe(true);
    expect(propre.lignes.find((l) => l.cle === 'yb-2-techniciens-superieurs-et-cadres-moyens')!.saisie![1]).toBe('4');
    expect(propre.saisiesFormatAnterieur).toEqual([
      {
        cleRubrique: 'ya-1-cadres-superieurs',
        rubrique: 'YA. 1. Cadres supérieurs',
        colonneAnterieure: 'EFFECTIFS · Nationaux (M / F)',
        nature: 'EFFECTIF',
        valeur: '3 / 2',
      },
    ]);
    // La note porte une information non reportée · jamais « NEANT ».
    expect(propre.applicable).toBe(true);
    // Le personnel extérieur ne reçoit rien.
    const exterieur = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL EXTERIEUR ET BENEVOLE')!;
    expect(exterieur.saisiesFormatAnterieur).toBeUndefined();
  });

  it('sans saisie au format antérieur, la note vide n’est plus forcée applicable', async () => {
    const { notes } = await serviceAvec([]).notesAssociations('t', 'e1');
    const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE')!;
    expect(propre.saisiesFormatAnterieur).toBeUndefined();
    expect(propre.applicable).toBe(false);
  });

  it('une ligne gardée dont la rubrique n’existe plus est NOMMÉE par sa clé, jamais tue', async () => {
    const { notes } = await serviceAvec([
      { codeNote: '29B', cleRubrique: 'rubrique-disparue', colonne: 104, valeurTexte: '1 500 000', valeurNombre: null },
    ]).notesAssociations('t', 'e1');
    const propre = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE')!;
    expect(propre.saisiesFormatAnterieur).toEqual([
      {
        cleRubrique: 'rubrique-disparue',
        rubrique: 'Rubrique inconnue · rubrique-disparue',
        colonneAnterieure: 'MASSE SALARIALE · Nationaux (M / F)',
        nature: 'MASSE_SALARIALE',
        valeur: '1 500 000',
      },
    ]);
  });
});

describe('Retirer la saisie au format antérieur (notes 20B et 29B)', () => {
  function prismaRetrait(lignes: Array<{ id: string }>) {
    const appels: string[] = [];
    const tx = {
      saisieNote: {
        update: jest.fn().mockImplementation(({ where, data }) => {
          appels.push(`update ${where.id} ${data.motifRetrait}`);
          return Promise.resolve({});
        }),
        delete: jest.fn().mockImplementation(({ where }) => {
          appels.push(`delete ${where.id}`);
          return Promise.resolve({});
        }),
        deleteMany: jest.fn(),
      },
    };
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', statut: 'CLOTURE' }) },
      saisieNote: { findMany: jest.fn().mockResolvedValue(lignes) },
      $transaction: jest.fn().mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    const service = new NoteAnnexeService({} as never, {} as never, prisma as never, {} as never, {} as never);
    return { service, prisma, tx, appels };
  }

  it('motif écrit par une mise à jour unitaire PUIS suppression par identifiant, dans une transaction · exercice clos compris', async () => {
    const { service, prisma, tx, appels } = prismaRetrait([{ id: 's1' }, { id: 's2' }]);
    const r = await service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', '  Reporté dans les seize colonnes  ');
    expect(r).toEqual({ retirees: 2 });
    expect(appels).toEqual([
      'update s1 Reporté dans les seize colonnes',
      'delete s1',
      'update s2 Reporté dans les seize colonnes',
      'delete s2',
    ]);
    expect(tx.saisieNote.deleteMany).not.toHaveBeenCalled();
    // Ne vise que les lignes gardées hors de la contexture.
    expect(prisma.saisieNote.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 't',
      exerciceId: 'e1',
      jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
      codeNote: '29B',
      colonne: { gte: RANG_FORMAT_ANTERIEUR },
    });
  });

  it('refus nommés · motif trop court, note qui n’en porte pas, plus rien à retirer', async () => {
    const { service } = prismaRetrait([{ id: 's1' }]);
    await expect(
      service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', 'ok'),
    ).rejects.toThrow('de 3 à 500 caractères');
    await expect(
      service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '13', 'Motif valable'),
    ).rejects.toThrow('seules les notes 20B');
    const vide = prismaRetrait([]);
    await expect(
      vide.service.retirerSaisieFormatAnterieur('t', 'u', 'e1', 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', '29B', 'Motif valable'),
    ).rejects.toThrow('ne porte plus de saisie au format antérieur');
  });

  it('la route porte les mêmes rôles que la saisie des notes', () => {
    const roles = (m: keyof NoteAnnexeController) => Reflect.getMetadata(ROLES_KEY, NoteAnnexeController.prototype[m]);
    expect(roles('retirerFormatAnterieur')).toEqual(roles('saisir'));
    expect(roles('saisir')).toBeDefined();
  });

  it('le DTO exige un motif de 3 à 500 caractères, et le rang de ligne n’accepte jamais null', async () => {
    const proprietes = async (cls: new () => object, o: object) =>
      (await validate(plainToInstance(cls, o))).map((e) => [e.property, Object.values(e.constraints ?? {})[0]]);
    const base = { exerciceId: '7c1c7b3e-0a6b-4a7e-9c1e-1d2f3a4b5c6d', jeu: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS', codeNote: '29B' };
    expect((await proprietes(RetirerFormatAnterieurDto, { ...base, motif: 'ab' })).map((x) => x[0])).toEqual(['motif']);
    expect(await proprietes(RetirerFormatAnterieurDto, { ...base, motif: 'Valeurs reportées' })).toEqual([]);
    const saisie = { ...base, cleRubrique: 'ya-1-cadres-superieurs', colonne: 0, valeur: 'x' };
    const refus = await proprietes(SaisirNoteDto, { ...saisie, rang: null });
    expect(refus).toEqual([
      ['rang', 'Le rang de ligne se donne par un entier à partir de 0, ou s’omet pour la ligne unique · jamais null.'],
    ]);
    expect(await proprietes(SaisirNoteDto, saisie)).toEqual([]);
    expect(await proprietes(SaisirNoteDto, { ...saisie, rang: 2 })).toEqual([]);
  });
});
