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
      join(__dirname, '../../../prisma/migrations/20270144000000_effectifs_seize_colonnes/migration.sql'),
      'utf8',
    );
    expect(RANG_FORMAT_ANTERIEUR).toBe(100);
    expect(sql).toContain('SET "colonne" = "colonne" + 100');
    expect(sql).toContain(`"jeu" = 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' AND "codeNote" = '29B'`);
    expect(sql).toContain(`"jeu" = 'PROJETS_DEVELOPPEMENT' AND "codeNote" = '20B'`);
    expect(sql).not.toMatch(/DELETE/i);
    const cles = NOTES_ASSOCIATIONS.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL PROPRE')!.rubriques.map(
      (r) => r.cle!,
    );
    for (const cle of cles) expect(sql).toContain(`'${cle}'`);
    // Les clés sont les mêmes dans les deux jeux, et seules elles sont visées.
    expect(
      NOTES_PROJETS.find((n) => n.code === '20B' && n.sousTableau === 'PERSONNEL PROPRE')!.rubriques.map((r) => r.cle),
    ).toEqual(cles);
    expect(sql).not.toContain('yh-1');
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
        valeur: '3 / 2',
      },
    ]);
    // Le personnel extérieur ne reçoit rien.
    const exterieur = notes.find((n) => n.code === '29B' && n.sousTableau === 'PERSONNEL EXTERIEUR ET BENEVOLE')!;
    expect(exterieur.saisiesFormatAnterieur).toBeUndefined();
  });
});
