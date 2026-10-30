import { Referentiel, SystemeComptableSyscohada } from '@prisma/client';
import { ImmobilisationService } from './immobilisation.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { motifSectionImpropre, sectionDuBien, ventilationDeLaDotation, type SectionLue } from './analytique-des-biens';

/**
 * L'ANALYTIQUE DES BIENS (ligne immos, fonction n° 70). Ce qui casserait en
 * silence · la famille qui l'emporterait sur la fiche ; une section en
 * sommeil qui ferait REFUSER la dotation (exercice sans charge pour une
 * question d'analytique) ; une dotation partie non ventilée sans que rien ne
 * le dise ; la ventilation posée sur la ligne du 28 au lieu de la charge.
 */

const PROJET: SectionLue = { id: 's1', code: 'P01', type: 'DETAIL', estActive: true, plan: { code: 'PROJ', estActif: true, classesVentilees: '2,6,7,9' } };

describe('la section qui reçoit la dotation', () => {
  it('une section Détail active d’un plan qui ventile la classe 6 convient', () => {
    expect(motifSectionImpropre(PROJET, '6')).toBeNull();
  });

  it('Total, en sommeil, plan en sommeil, classe non ventilée · chaque refus nommé avec son issue', () => {
    expect(motifSectionImpropre({ ...PROJET, type: 'TOTAL' }, '6')).toMatch(/Total/);
    expect(motifSectionImpropre({ ...PROJET, estActive: false }, '6')).toMatch(/en sommeil/);
    expect(motifSectionImpropre({ ...PROJET, plan: { ...PROJET.plan, estActif: false } }, '6')).toMatch(/plan analytique PROJ est en sommeil/);
    expect(motifSectionImpropre({ ...PROJET, plan: { ...PROJET.plan, classesVentilees: '7' } }, '6')).toMatch(/ne ventile pas la classe 6/);
  });

  it('la fiche prime sur la famille ; à défaut, la famille', () => {
    expect(sectionDuBien('a', 'b')).toEqual({ section: 'a', origine: 'FICHE' });
    expect(sectionDuBien(null, 'b')).toEqual({ section: 'b', origine: 'FAMILLE' });
    expect(sectionDuBien(null, null)).toBeNull();
  });

  it('impropre depuis sa pose, la dotation part non ventilée, et la cause est dite', () => {
    const v = ventilationDeLaDotation({ section: { ...PROJET, estActive: false }, origine: 'FAMILLE' }, '6', 1000);
    expect(v.ventilations).toEqual([]);
    expect(v.compteRendu?.nonVentilee).toMatch(/^Dotation passée non ventilée · La section P01 est en sommeil/);
  });

  it('propre, la ligne reçoit la ventilation entière au débit', () => {
    expect(ventilationDeLaDotation({ section: PROJET, origine: 'FICHE' }, '6', 1234.5)).toEqual({
      ventilations: [{ sectionId: 's1', debit: 1234.5 }],
      compteRendu: { section: 'P01', origine: 'FICHE', nonVentilee: null },
    });
  });
});

function passer(opts: { sectionFiche: string | null; sectionFamille: string | null; section: SectionLue | null }) {
  const prisma: Record<string, unknown> = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYCEBNL, systemeComptableSyscohada: null }) },
    immobilisation: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'i1',
        designation: 'Véhicule du projet',
        statut: 'EN_SERVICE',
        valeurOrigine: 1_200_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 4,
        dateMiseEnService: new Date('2026-01-01'),
        amortissementAnterieur: 0,
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        compteImmobilisation: { numero: '24510000' },
        sectionAnalytiqueId: opts.sectionFiche,
        famille: { sectionAnalytiqueId: opts.sectionFamille },
        dotations: [],
        depreciations: [],
      }),
    },
    exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'exN', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }) },
    dotationAmortissement: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'd1', montant: 300_000 }) },
    ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    sectionAnalytique: { findFirst: jest.fn().mockResolvedValue(opts.section) },
    compte: { findFirst: jest.fn().mockResolvedValue({ numero: '68130000' }) },
  };
  prisma.$transaction = jest.fn((f: (tx: unknown) => unknown) => f(prisma));
  prisma.$queryRaw = jest.fn().mockResolvedValue([]);
  prisma.$executeRaw = jest.fn().mockResolvedValue(1);
  const creer = jest.fn().mockResolvedValue({ id: 'e1' });
  const svc = new ImmobilisationService(prisma as unknown as PrismaService, { creer } as unknown as EcritureService);
  return { svc, creer, prisma };
}

describe('la passation ventile la dotation', () => {
  it('sur la section de la fiche, posée sur la ligne de charge seule', async () => {
    const { svc, creer, prisma } = passer({ sectionFiche: 's1', sectionFamille: 's9', section: PROJET });
    const r = await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' } as never);
    const lignes = creer.mock.calls[0][2].lignes;
    expect(lignes[0]).toEqual(expect.objectContaining({ compteId: 'cd', debit: 300_000, ventilations: [{ sectionId: 's1', debit: 300_000 }] }));
    expect(lignes[1]).not.toHaveProperty('ventilations');
    // La fiche l'emporte · la section lue est la sienne, jamais celle de la famille.
    expect((prisma.sectionAnalytique as { findFirst: jest.Mock }).findFirst.mock.calls[0][0].where).toEqual({ id: 's1', tenantId: 't1' });
    expect(r.ventilation).toEqual({ section: 'P01', origine: 'FICHE', nonVentilee: null });
  });

  it('une section devenue impropre ne refuse pas la dotation · elle passe non ventilée, et le dit', async () => {
    const { svc, creer } = passer({ sectionFiche: null, sectionFamille: 's1', section: { ...PROJET, estActive: false } });
    const r = await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' } as never);
    expect(creer.mock.calls[0][2].lignes[0]).not.toHaveProperty('ventilations');
    expect(r.ventilation?.origine).toBe('FAMILLE');
    expect(r.ventilation?.nonVentilee).toMatch(/non ventilée/);
  });

  it('sans section, rien n’est lu ni posé', async () => {
    const { svc, creer, prisma } = passer({ sectionFiche: null, sectionFamille: null, section: null });
    const r = await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' } as never);
    expect(creer.mock.calls[0][2].lignes[0]).not.toHaveProperty('ventilations');
    expect((prisma.sectionAnalytique as { findFirst: jest.Mock }).findFirst).not.toHaveBeenCalled();
    expect(r.ventilation).toBeNull();
  });
});

describe('la pose d’une section', () => {
  it('une section d’un autre dossier est un 404, une section impropre un 400 nommé', async () => {
    const { svc, prisma } = passer({ sectionFiche: null, sectionFamille: null, section: null });
    await expect(svc.verifierSectionDuBien('t1', 's-voisin', 'cd')).rejects.toThrow(/introuvable/);
    (prisma.sectionAnalytique as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce({ ...PROJET, type: 'TOTAL' });
    await expect(svc.verifierSectionDuBien('t1', 's1', 'cd')).rejects.toThrow(/de type Total/);
  });
});
