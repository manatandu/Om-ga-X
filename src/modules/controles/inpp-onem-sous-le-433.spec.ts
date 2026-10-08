import { Referentiel } from '@prisma/client';
import { ControlesService } from './controles.service';
import { PrismaService } from '../../common/prisma.service';
import { anomalieInppOnemSousLe433, estCompteAncienInppOnem, type CompteAncienInppOnem } from './inpp-onem-sous-le-433';

/**
 * CONTRÔLE 36 · DÉCISION T1 DU 2026-10-07. L'INPP et l'ONEM sont des impôts et
 * taxes (fiche du compte 64 des deux textes) · dette au 44280000. Les 4334 et
 * 4335 qu'OmegaX semait ne sont ni supprimés ni réimputés d'office · le
 * contrôle les NOMME, avec l'issue de l'exercice examiné.
 */
const compte = (over: Partial<CompteAncienInppOnem> = {}): CompteAncienInppOnem => ({
  numero: '43340000',
  intitule: 'INPP (formation professionnelle)',
  estActif: true,
  lignesTotal: 0,
  lignesSaisiesExercice: 0,
  lignesReportExercice: 0,
  soldeCrediteurExercice: 0,
  ...over,
});

describe('la règle', () => {
  it('reconnaît les deux racines, et elles seules', () => {
    expect(estCompteAncienInppOnem('43340000')).toBe(true);
    expect(estCompteAncienInppOnem('43351000')).toBe(true);
    expect(estCompteAncienInppOnem('43330000')).toBe(false);
    expect(estCompteAncienInppOnem('44280000')).toBe(false);
  });

  it("exercice ouvert · les lignes saisies sont à réimputer vers le 44280000", () => {
    const a = anomalieInppOnemSousLe433(
      [compte({ lignesTotal: 3, lignesSaisiesExercice: 3, soldeCrediteurExercice: 77_777.78 })],
      false,
    );
    expect(a?.code).toBe('INPP_ONEM_SOUS_LE_433');
    expect(a?.gravite).toBe('INFORMATION');
    expect(a?.occurrences).toHaveLength(1);
    expect(a?.occurrences[0].detail).toContain('à réimputer vers le 44280000');
    expect(a?.occurrences[0].montant).toBe(77_777.78);
  });

  it("exercice clôturé · rien n'est touché, et c'est dit", () => {
    const a = anomalieInppOnemSousLe433([compte({ lignesTotal: 3, lignesSaisiesExercice: 3, soldeCrediteurExercice: 10 })], true);
    expect(a?.occurrences[0].detail).toMatch(/^Exercice clôturé · rien n'y est réimputé/);
  });

  it("report seul · une écriture de report ne se réimpute pas, le solde s'apure à son paiement", () => {
    const a = anomalieInppOnemSousLe433([compte({ lignesTotal: 4, lignesReportExercice: 1, soldeCrediteurExercice: 56_003.5 })], false);
    expect(a?.occurrences[0].detail).toContain('ne se réimpute pas');
  });

  it('jamais mouvementé et actif · à mettre en sommeil ; déjà en sommeil · rien', () => {
    expect(anomalieInppOnemSousLe433([compte()], false)?.occurrences[0].detail).toContain('mettez-le en sommeil');
    expect(anomalieInppOnemSousLe433([compte({ estActif: false })], false)).toBeNull();
  });

  it("mouvementé dans un AUTRE exercice seulement · rien à dire de celui-ci", () => {
    // Pas de sommeil proposé pour un compte qui porte de l'histoire · il se
    // signale dans l'exercice qui le mouvemente.
    expect(anomalieInppOnemSousLe433([compte({ lignesTotal: 2 })], false)).toBeNull();
  });
});

function service(comptes: { id: string; numero: string; intitule: string; estActif: boolean; total: number }[]) {
  const groupes: Record<string, { saisies: number; report: number; credit: number; debit: number }> = {
    c1: { saisies: 2, report: 0, credit: 37_000, debit: 0 },
  };
  const prisma = {
    exercice: {
      // Contrôle 35 bis · la lecture des exercices du dossier · aucun lettrage partiel dans ce jeu.
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'ex',
        statut: 'OUVERT',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
      }),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel: Referentiel.SYSCOHADA }) },
    ecriture: { findMany: jest.fn().mockResolvedValue([]) },
    // LA DOUBLURE HONORE LE FILTRE PAR RACINE · elle ne rend les comptes que
    // si la requête demande 4334 ou 4335, et rend aussi un voisin 43330000,
    // que le service doit écarter lui-même.
    compte: {
      findMany: jest.fn(async ({ where }: { where?: { OR?: { numero?: { startsWith?: string } }[] } }) => {
        const racines = (where?.OR ?? []).map((o) => o.numero?.startsWith).filter(Boolean);
        if (!racines.includes('4334') || !racines.includes('4335')) return [];
        return [
          ...comptes.map((c) => ({ ...c, _count: { lignesEcriture: c.total } })),
          { id: 'voisin', numero: '43330000', intitule: 'Assurances', estActif: true, _count: { lignesEcriture: 9 } },
        ];
      }),
    },
    ligneEcriture: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn(
        async ({ where }: { where: { compteId?: { in?: string[] }; ecriture?: { estGenereeParCloture?: boolean } } }) => {
          const ids = where.compteId?.in;
          if (!ids) return [];
          const report = where.ecriture?.estGenereeParCloture === true;
          return ids
            .filter((id) => groupes[id] && (report ? groupes[id].report : groupes[id].saisies) > 0)
            .map((id) => ({
              compteId: id,
              _count: { _all: report ? groupes[id].report : groupes[id].saisies },
              _sum: { credit: report ? 0 : groupes[id].credit, debit: report ? 0 : groupes[id].debit },
            }));
        },
      ),
    },
    exoneration: { findMany: jest.fn().mockResolvedValue([]) },
    manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
    conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
    mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
    rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
    dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
    depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
    amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
    clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
    immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new ControlesService(prisma);
}

describe('le câblage · le contrôle lit les comptes du dossier et leurs lignes de l’exercice', () => {
  it('nomme le 4334 mouvementé et le 4335 jamais mouvementé, et écarte le voisin 4333', async () => {
    const rapport = await service([
      { id: 'c1', numero: '43340000', intitule: 'INPP (formation professionnelle)', estActif: true, total: 2 },
      { id: 'c2', numero: '43350000', intitule: 'ONEM (emploi)', estActif: true, total: 0 },
    ]).analyser('t', 'ex');
    const a = rapport.anomalies.find((x) => x.code === 'INPP_ONEM_SOUS_LE_433');
    expect(a?.occurrences.map((o) => [o.reference.slice(0, 8), o.montant ?? null])).toEqual([
      ['43340000', 37_000],
      ['43350000', null],
    ]);
  });

  it("se tait sur un dossier semé après la décision · aucun 4334, aucun 4335", async () => {
    const rapport = await service([]).analyser('t', 'ex');
    expect(rapport.anomalies.find((x) => x.code === 'INPP_ONEM_SOUS_LE_433')).toBeUndefined();
  });
});
