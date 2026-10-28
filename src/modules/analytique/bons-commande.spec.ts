import { BadRequestException, ConflictException } from '@nestjs/common';
import { BonsCommandeService, ttcDeLaFacture } from './bons-commande.service';
import { EngagementService, refuserSiNeDUnBon } from './engagement.service';
import { engageParSection, enCentimesExacts, montantHTEnCentimes, motifRefusParts, referenceEngagement, resteParSection } from './bon-commande';
import { PrismaService } from '../../common/prisma.service';

/**
 * BON DE COMMANDE FOURNISSEUR (ligne microfina-m2, idée 2).
 *
 * SYCEBNL, Guide d'application, ch. 7, Application 22, règle (d) · « bons de
 * commande de biens et services REMIS aux fournisseurs au cours de l'exercice
 * budgétaire, NON EXÉCUTÉS ». Ce que ces tests gèlent casserait en silence ·
 * le tableau d'exécution boucle toujours (Réalisation = (2) + (3)), seul le
 * crédit disponible serait faux.
 */

describe('règles pures du bon de commande', () => {
  it('le HT se calcule au centime, sans flottant (3 × 0,1 = 0,30, jamais 0,30000000000000004)', () => {
    expect(montantHTEnCentimes(3, 0.1)).toBe(30);
    expect(montantHTEnCentimes(1.5, 33.33)).toBe(5000); // 49,995 · le demi-centime loin de zéro
    expect(montantHTEnCentimes(12, 25000)).toBe(30_000_000);
  });

  it('un montant hors centime est refusé, pas arrondi en silence', () => {
    expect(enCentimesExacts(1250.5)).toBe(125050);
    expect(enCentimesExacts(10.005)).toBeNull();
    expect(enCentimesExacts(Number.NaN)).toBeNull();
  });

  it("l'engagement de chaque ligne budgétaire est le TTC PRÉVU (fiche du compte 40 · le 40 reçoit le montant des factures)", () => {
    const engage = engageParSection([
      { sectionId: 'A', montantHTCentimes: 100_000, montantTvaCentimes: 16_000 },
      { sectionId: 'B', montantHTCentimes: 50_000, montantTvaCentimes: 0 },
      { sectionId: 'A', montantHTCentimes: 20_000, montantTvaCentimes: 3_200 },
    ]);
    expect(engage.get('A')).toBe(139_200);
    expect(engage.get('B')).toBe(50_000);
  });

  it('le reste à facturer retranche les parts déclarées, ligne par ligne, jamais en dessous de zéro', () => {
    const reste = resteParSection(new Map([['A', 139_200], ['B', 50_000]]), [
      { sectionId: 'A', montantCentimes: 100_000 },
      { sectionId: 'A', montantCentimes: 39_200 },
    ]);
    expect(reste.get('A')).toBe(0);
    expect(reste.get('B')).toBe(50_000);
  });

  it('les parts sont DÉCLARÉES · une ligne absente du bon, une part en double ou au-delà du reste est refusée', () => {
    const reste = new Map([['A', 1000], ['B', 500]]);
    const code = (s: string) => s;
    expect(motifRefusParts([], reste, code)).toMatch(/au moins une part/);
    expect(motifRefusParts([{ sectionId: 'C', montantCentimes: 10 }], reste, code)).toMatch(/ne figure pas/);
    expect(motifRefusParts([{ sectionId: 'A', montantCentimes: 10 }, { sectionId: 'A', montantCentimes: 10 }], reste, code)).toMatch(/deux fois/);
    expect(motifRefusParts([{ sectionId: 'B', montantCentimes: 501 }], reste, code)).toMatch(/dépasse ce qui reste à facturer/);
    expect(motifRefusParts([{ sectionId: 'A', montantCentimes: Number.NaN }], reste, code)).toMatch(/positif, au centime/);
    expect(motifRefusParts([{ sectionId: 'A', montantCentimes: 1000 }, { sectionId: 'B', montantCentimes: 1 }], reste, code)).toBeNull();
  });

  it("la référence de l'engagement nomme le bon et la ligne · unique sous la clé du registre", () => {
    expect(referenceEngagement(7, '611')).toBe('BC 7 · 611');
  });

  it('le TTC de la facture compte les autres impôts déclarés, et null pour zéro', () => {
    const f = { lignes: [{ montantHT: 1000, montantTva: 160 }], autresImpotsEtTaxes: null };
    expect(ttcDeLaFacture(f)).toBe(116_000);
    expect(ttcDeLaFacture({ ...f, autresImpotsEtTaxes: 40 })).toBe(120_000);
  });
});

describe("l'engagement né d'un bon se tient par son bon", () => {
  it('le registre refuse de le retoucher à la main', () => {
    expect(() => refuserSiNeDUnBon({ bonCommandeId: 'bc1' })).toThrow(/né d'un bon de commande/);
    expect(() => refuserSiNeDUnBon({ bonCommandeId: null })).not.toThrow();
  });

  it('supprimer, clore, rouvrir et rattacher le refusent', async () => {
    const eng = { id: 'e1', statut: 'OUVERT', bonCommandeId: 'bc1', exercice: { statut: 'OUVERT' }, _count: { executions: 0 }, executions: [] };
    const prisma = {
      engagementDepense: { findFirst: jest.fn().mockResolvedValue(eng), delete: jest.fn(), update: jest.fn() },
      executionEngagement: { findFirst: jest.fn().mockResolvedValue({ id: 'x', engagement: eng }), delete: jest.fn() },
    };
    const s = new EngagementService(prisma as unknown as PrismaService);
    await expect(s.supprimer('t1', 'e1')).rejects.toThrow(/né d'un bon/);
    await expect(s.clore('t1', 'e1', { motif: 'annulée' })).rejects.toThrow(/né d'un bon/);
    await expect(s.rouvrir('t1', 'e1')).rejects.toThrow(/né d'un bon/);
    await expect(s.rattacherExecution('t1', 'u1', 'e1', { ecritureId: 'ec', montant: 10 })).rejects.toThrow(/né d'un bon/);
    await expect(s.detacherExecution('t1', 'e1', 'x')).rejects.toThrow(/né d'un bon/);
    expect(prisma.engagementDepense.delete).not.toHaveBeenCalled();
    expect(prisma.executionEngagement.delete).not.toHaveBeenCalled();
  });
});

/** Un faux client · la transaction se joue sur lui-même, les créations sont relevées. */
function faux(etat: { bon: Record<string, unknown>; facture?: Record<string, unknown>; aggregatNumero?: number | null; doublon?: unknown }) {
  const crees: Record<string, unknown[]> = { engagementDepense: [], executionEngagement: [], executionBonCommande: [] };
  const prisma: Record<string, unknown> = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    bonCommandeFournisseur: {
      findFirst: jest.fn().mockResolvedValue(etat.bon),
      aggregate: jest.fn().mockResolvedValue({ _max: { numero: etat.aggregatNumero ?? null } }),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data)),
    },
    engagementDepense: {
      findFirst: jest.fn().mockResolvedValue(etat.doublon ?? null),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => {
        crees.engagementDepense.push(data);
        return Promise.resolve({ id: `eng${crees.engagementDepense.length}` });
      }),
      update: jest.fn(),
    },
    facture: { findFirst: jest.fn().mockResolvedValue(etat.facture ?? null) },
    executionEngagement: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 0 } }),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => {
        crees.executionEngagement.push(data);
        return Promise.resolve({ id: `exe${crees.executionEngagement.length}` });
      }),
    },
    ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _sum: { debit: 1_000_000 } }) },
    executionBonCommande: {
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => {
        crees.executionBonCommande.push(data);
        return Promise.resolve({ id: 'ebc' });
      }),
    },
  };
  prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { service: new BonsCommandeService(prisma as unknown as PrismaService), crees };
}

const EXERCICE = { id: 'ex1', statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };

function bonBrouillon() {
  return {
    id: 'bc1',
    statut: 'BROUILLON',
    exerciceId: 'ex1',
    objet: 'Fournitures de formation',
    tiersId: 'f1',
    tiers: { nom: 'Papeterie du Centre', type: 'FOURNISSEUR', estActif: true },
    exercice: EXERCICE,
    lignes: [
      { sectionId: 'sA', designation: 'Cahiers', montantHT: 100_000, montantTva: 16_000, section: { code: 'A1', type: 'DETAIL', estActive: true, plan: { gererBudgets: true, estActif: true } } },
      { sectionId: 'sB', designation: 'Stylos', montantHT: 50_000, montantTva: 0, section: { code: 'B2', type: 'DETAIL', estActive: true, plan: { gererBudgets: true, estActif: true } } },
    ],
  };
}

describe('la remise engage, ligne budgétaire par ligne budgétaire', () => {
  it('numérote le bon et fait naître un engagement TTC prévu par section, nature BON_DE_COMMANDE', async () => {
    const { service, crees } = faux({ bon: bonBrouillon(), aggregatNumero: 4 });
    const r = await service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-03-10' });
    expect(r.numero).toBe(5);
    expect(crees.engagementDepense).toEqual([
      expect.objectContaining({ sectionId: 'sA', nature: 'BON_DE_COMMANDE', reference: 'BC 5 · A1', bonCommandeId: 'bc1', beneficiaire: 'Papeterie du Centre' }),
      expect.objectContaining({ sectionId: 'sB', reference: 'BC 5 · B2' }),
    ]);
    expect(String((crees.engagementDepense[0] as { montant: unknown }).montant)).toBe('116000');
    expect(String((crees.engagementDepense[1] as { montant: unknown }).montant)).toBe('50000');
  });

  it("refuse une remise hors de l'exercice · « au cours de l'exercice budgétaire »", async () => {
    const { service } = faux({ bon: bonBrouillon() });
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2025-12-31' })).rejects.toThrow(/hors de l'exercice/);
  });

  it('refuse une ligne dont la section a cessé d’être une ligne budgétaire active', async () => {
    const bon = bonBrouillon();
    bon.lignes[1].section.estActive = false;
    const { service, crees } = faux({ bon });
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-03-10' })).rejects.toThrow(/plus une ligne budgétaire active/);
    expect(crees.engagementDepense).toHaveLength(0);
  });

  it('nomme le conflit avec un engagement saisi à la main sous la même référence', async () => {
    const { service } = faux({ bon: bonBrouillon(), doublon: { id: 'x' } });
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-03-10' })).rejects.toBeInstanceOf(ConflictException);
  });
});

function bonRemis() {
  return {
    id: 'bc1',
    statut: 'REMIS',
    exerciceId: 'ex1',
    tiersId: 'f1',
    dateRemise: new Date('2026-03-10'),
    exercice: EXERCICE,
    lignes: [
      { sectionId: 'sA', montantHT: 100_000, montantTva: 16_000, section: { code: 'A1' } },
      { sectionId: 'sB', montantHT: 50_000, montantTva: 0, section: { code: 'B2' } },
    ],
    executions: [],
    engagements: [
      { id: 'eA', sectionId: 'sA', statut: 'OUVERT', montant: 116_000, executions: [] },
      { id: 'eB', sectionId: 'sB', statut: 'OUVERT', montant: 50_000, executions: [] },
    ],
  };
}

function factureAchat(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'fa1',
    sens: 'ACHAT',
    nature: 'FACTURE',
    tiersId: 'f1',
    numeroSerie: 'F-0042',
    dateFacture: new Date('2026-04-02'),
    autresImpotsEtTaxes: null,
    noteDeCredit: null,
    lignes: [{ montantHT: 100_000, montantTva: 16_000 }],
    executionsBonCommande: [],
    ecriture: { id: 'ec1', statut: 'VALIDEE', exerciceId: 'ex1', numeroPiece: 12, exercice: { dateDebut: EXERCICE.dateDebut } },
    ...surcharge,
  };
}

describe("la facture d'achat exécute le bon", () => {
  it("dans l'exercice du bon, elle pose le rattachement de l'engagement · la dépense quitte la colonne Engagement en entrant au 40", async () => {
    const { service, crees } = faux({ bon: bonRemis(), facture: factureAchat() });
    await service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 116_000 }] });
    expect(crees.executionEngagement).toEqual([expect.objectContaining({ engagementId: 'eA', ecritureId: 'ec1' })]);
    expect(crees.executionBonCommande).toEqual([expect.objectContaining({ sectionId: 'sA', executionEngagementId: 'exe1' })]);
  });

  it("dans un exercice POSTÉRIEUR, elle réduit le reste à facturer sans toucher l'engagement de l'exercice du bon", async () => {
    const f = factureAchat({ ecriture: { id: 'ec9', statut: 'VALIDEE', exerciceId: 'ex2', numeroPiece: 3, exercice: { dateDebut: new Date('2027-01-01') } } });
    const { service, crees } = faux({ bon: bonRemis(), facture: f });
    const r = await service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 116_000 }] });
    expect(crees.executionEngagement).toHaveLength(0);
    expect(crees.executionBonCommande).toEqual([expect.objectContaining({ executionEngagementId: null })]);
    expect(r.avertissements.join(' ')).toMatch(/exercice postérieur/);
  });

  it('refuse une facture au brouillard · seul le livre-journal entre au tableau', async () => {
    const f = factureAchat({ ecriture: { id: 'ec1', statut: 'BROUILLARD', exerciceId: 'ex1', numeroPiece: 12, exercice: { dateDebut: EXERCICE.dateDebut } } });
    const { service, crees } = faux({ bon: bonRemis(), facture: f });
    await expect(service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 1 }] })).rejects.toThrow(/validée/);
    expect(crees.executionBonCommande).toHaveLength(0);
  });

  it("refuse la facture d'un autre fournisseur, une facture de vente et une facture barrée", async () => {
    for (const [surcharge, motif] of [
      [{ tiersId: 'autre' }, /fournisseur du bon/],
      [{ sens: 'VENTE' }, /ACHAT/],
      [{ noteDeCredit: { id: 'nc' } }, /note de crédit/],
    ] as const) {
      const { service } = faux({ bon: bonRemis(), facture: factureAchat(surcharge as Record<string, unknown>) });
      await expect(service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 1 }] })).rejects.toThrow(motif);
    }
  });

  it('refuse de servir la facture au-delà de son total toutes taxes', async () => {
    const { service } = faux({ bon: bonRemis(), facture: factureAchat({ lignes: [{ montantHT: 50_000, montantTva: 0 }] }) });
    await expect(
      service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 60_000 }] }),
    ).rejects.toThrow(/au-delà d'elle-même/);
  });

  it('refuse un bon au brouillon · il n’engage rien', async () => {
    const { service } = faux({ bon: { ...bonRemis(), statut: 'BROUILLON' }, facture: factureAchat() });
    await expect(service.executer('t1', 'u1', 'bc1', { factureId: 'fa1', parts: [{ sectionId: 'sA', montant: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('relecture · remise, brouillon et clôture du bon', () => {
  it("m1 · refuse un jour qui n'existe pas (« 2026-02-31 » devenait le 3 mars)", async () => {
    const { service, crees } = faux({ bon: bonBrouillon() });
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-02-31' })).rejects.toThrow(/pas un jour du calendrier/);
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-13-45' })).rejects.toThrow(/pas un jour du calendrier/);
    expect(crees.engagementDepense).toHaveLength(0);
  });

  it('m3 · relit le fournisseur à la remise · en sommeil depuis le brouillon, refusé', async () => {
    const bon = bonBrouillon();
    bon.tiers.estActif = false;
    const { service, crees } = faux({ bon });
    await expect(service.remettre('t1', 'u1', 'bc1', { dateRemise: '2026-03-10' })).rejects.toThrow(/en sommeil/);
    expect(crees.engagementDepense).toHaveLength(0);
  });

  it("m2 · un brouillon d'un exercice clôturé ne se modifie plus", async () => {
    const { service } = faux({ bon: { id: 'bc1', statut: 'BROUILLON', exercice: { statut: 'CLOTURE' } } });
    const p = (service as unknown as { prisma: Record<string, unknown> }).prisma;
    p.tiers = { findFirst: jest.fn().mockResolvedValue({ id: 'f1', nom: 'Papeterie', type: 'FOURNISSEUR', estActif: true }) };
    p.sectionAnalytique = {
      findMany: jest.fn().mockResolvedValue([{ id: 'sA', code: 'A1', type: 'DETAIL', estActive: true, plan: { code: 'P', gererBudgets: true, estActif: true } }]),
    };
    await expect(
      service.modifier('t1', 'bc1', { tiersId: 'f1', objet: 'Fournitures', lignes: [{ sectionId: 'sA', designation: 'Cahiers', quantite: 1, prixUnitaire: 100, montantTva: 0 }] }),
    ).rejects.toThrow(/supprimez-le/);
  });

  it("M5 · refuse de clore un bon qu'une facture d'un exercice postérieur exécute, tant que l'exercice du bon est ouvert", async () => {
    const bon = { id: 'bc1', statut: 'REMIS', exercice: { statut: 'OUVERT' }, engagements: [{ id: 'eA', statut: 'OUVERT' }], executions: [{ facture: { numeroSerie: 'F-2027-1' } }] };
    const { service } = faux({ bon });
    const update = (service as unknown as { prisma: { engagementDepense: { update: jest.Mock } } }).prisma.engagementDepense.update;
    await expect(service.clore('t1', 'u1', 'bc1', { motif: 'Solde de la commande' })).rejects.toThrow(/F-2027-1.*Clôturez d'abord l'exercice du bon/);
    expect(update).not.toHaveBeenCalled();
  });

  it("M5 · l'exercice du bon clôturé, le bon se clôt seul et ses engagements restent", async () => {
    const bon = { id: 'bc1', statut: 'REMIS', exercice: { statut: 'CLOTURE' }, engagements: [{ id: 'eA', statut: 'OUVERT' }], executions: [{ facture: { numeroSerie: 'F-2027-1' } }] };
    const { service } = faux({ bon });
    const update = (service as unknown as { prisma: { engagementDepense: { update: jest.Mock } } }).prisma.engagementDepense.update;
    await expect(service.clore('t1', 'u1', 'bc1', { motif: 'Solde de la commande' })).resolves.toEqual({ clos: true, engagementsClos: false });
    expect(update).not.toHaveBeenCalled();
  });
});
