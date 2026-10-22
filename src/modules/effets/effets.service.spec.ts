import { BadRequestException } from '@nestjs/common';
import { EffetsService } from './effets.service';

/**
 * LE SERVICE DES EFFETS SUR DOUBLURES (ligne sage-l3, fonction 39) · ce qui
 * casserait en silence. (1) L'acceptation pose l'ÉCHÉANCE sur sa pièce, dans
 * la transaction · sans elle, la TVA d'une prestation payée par traite
 * devenait exigible au jour de l'effet. (2) Un lettrage refusé retire la
 * pièce, l'acte ET l'effet, l'erreur d'origine remonte. (3) Le SYCEBNL n'ouvre
 * pas l'effet à recevoir · refus nommé avant toute pièce. (4) L'impayé d'un
 * effet escompté et décompté reprend le nominal sur la banque, au journal de
 * la banque. (5) L'annulation va à rebours, et le statut se rejoue.
 */
const COMPTES: Record<string, { id: string; numero: string; intitule: string; typeCompte: string; estActif: boolean }> = {
  c411: { id: 'c411', numero: '41110001', intitule: 'Client Traite', typeCompte: 'DETAIL', estActif: true },
  c412: { id: 'c412', numero: '41210000', intitule: 'Effets en portefeuille', typeCompte: 'DETAIL', estActif: true },
  c413: { id: 'c413', numero: '41320000', intitule: 'Effets impayés', typeCompte: 'DETAIL', estActif: true },
  c415: { id: 'c415', numero: '41500000', intitule: 'Effets escomptés non échus', typeCompte: 'DETAIL', estActif: true },
  c512: { id: 'c512', numero: '51200000', intitule: "Effets à l'encaissement", typeCompte: 'DETAIL', estActif: true },
  c565: { id: 'c565', numero: '56500000', intitule: 'Escompte', typeCompte: 'DETAIL', estActif: true },
  c675: { id: 'c675', numero: '67500000', intitule: 'Escomptes des effets', typeCompte: 'DETAIL', estActif: true },
  c601: { id: 'c601', numero: '60110000', intitule: 'Achats', typeCompte: 'DETAIL', estActif: true },
};
const BQ = { id: 'jbq', code: 'BQ', type: 'TRESORERIE', estActif: true, compteTresorerie: { id: 'c52', numero: '52110001' } };
const OD = { id: 'jod', code: 'OD', type: 'GENERAL', estActif: true, compteTresorerie: null };

type Acte = { id: string; nature: string; date: Date; montant: number; detail: unknown; annuleLe: Date | null; compte: { id: string; numero: string; intitule: string } | null; ecriture: { id: string; numeroPiece: number; statut: string } | null; ecritureNegatif: null };

function monter(options: { referentiel?: string; lettrageEchoue?: boolean; statut?: string; actes?: Acte[]; statutPiece?: string } = {}) {
  const appels: string[] = [];
  const effet = {
    id: 'ef1',
    sens: 'A_RECEVOIR',
    statut: options.statut ?? 'EN_PORTEFEUILLE',
    journalId: 'jod',
    compteTiersId: 'c411',
    compteEffetId: 'c412',
    montant: 1160000,
    reference: 'LCR 12',
    dateCreation: new Date('2026-03-01T00:00:00.000Z'),
    dateEcheance: new Date('2026-05-31T00:00:00.000Z'),
    compteTiers: COMPTES.c411,
    compteEffet: COMPTES.c412,
    actes: options.actes ?? [{ id: 'a1', nature: 'ACCEPTATION', date: new Date('2026-03-01T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c412, ecriture: { id: 'e1', numeroPiece: 1, statut: 'VALIDEE' }, ecritureNegatif: null }],
  };
  const tx = {
    ecriture: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn(async () => ({ statut: options.statutPiece ?? 'VALIDEE' })),
      deleteMany: jest.fn(async () => {
        appels.push('pièce retirée');
        return { count: 1 };
      }),
    },
    ligneEcriture: { findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 2 })) },
    effetCommerce: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        appels.push('effet');
        return { id: 'ef1', ...data };
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
      deleteMany: jest.fn(async () => {
        appels.push('effet retiré');
        return { count: 1 };
      }),
    },
    acteEffet: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        appels.push(`acte ${String(data.nature)}`);
        return { id: 'a9', ...data };
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (data.ecritureId === null && !('ecritureNegatifId' in data)) appels.push('lien dénoué');
        return {};
      }),
      deleteMany: jest.fn(async () => {
        appels.push('actes retirés');
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn(async () => ({ referentiel: options.referentiel ?? 'SYSCOHADA' })) },
    journal: { findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === 'jbq' ? BQ : where.id === 'jod' ? OD : null)) },
    compte: {
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => COMPTES[where.id] ?? null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    exercice: { findFirst: jest.fn(async () => ({ id: 'ex1', statut: 'OUVERT', dateDebut: new Date('2026-01-01T00:00:00.000Z'), dateFin: new Date('2026-12-31T00:00:00.000Z') })) },
    ligneEcriture: {
      findMany: jest.fn(async () => [{ id: 'f1', debit: 1160000, credit: 0, lettrageId: null, rapprochementId: null, ecriture: { statut: 'VALIDEE', estANouveauProvisoire: false, numeroPiece: 7 } }]),
    },
    ecriture: { findFirst: jest.fn(async () => ({ id: 'e1', numeroPiece: 1, statut: 'VALIDEE', exercice: { statut: 'OUVERT' }, lignes: [] })) },
    effetCommerce: { findFirst: jest.fn(async () => effet), findMany: jest.fn(async () => [effet]), count: jest.fn(async () => 1) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const ecritures = {
    creerAvec: jest.fn(async (_t: string, _u: string, dto: { journalId: string; lignes: Array<{ compteId: string; debit: number; credit: number }> }, suite: (t: typeof tx, e: { id: string; lignes: Array<{ id: string; compteId: string }> }) => Promise<unknown>) => {
      appels.push(`écriture ${dto.journalId}`);
      const ecriture = { id: 'e9', lignes: dto.lignes.map((l, i) => ({ id: `l${i}`, compteId: l.compteId })) };
      return { ecriture, suite: await suite(tx, ecriture) };
    }),
    retirerCompensation: jest.fn(async (_t: string, _e: string, liberer?: (t: typeof tx) => Promise<unknown>) => {
      if (liberer) await liberer(tx);
      appels.push('pièce retirée');
    }),
    inscrireEnNegatifPourAnnulation: jest.fn(async () => {
      appels.push('négatif');
      return { id: 'neg1' };
    }),
  };
  const lettrage = {
    lettrerManuel: jest.fn(async () => {
      if (options.lettrageEchoue) throw new BadRequestException('Les lignes ne se lettrent pas · solde non nul.');
      return { lettre: 'AA' };
    }),
  };
  return { service: new EffetsService(prisma as never, ecritures as never, lettrage as never), appels, tx, prisma, ecritures, lettrage };
}

const ACCEPTATION = { exerciceId: 'ex1', sens: 'A_RECEVOIR' as const, journalId: 'jod', compteTiersId: 'c411', compteEffetId: 'c412', montant: 1160000, reference: 'LCR 12', dateCreation: '2026-03-01', dateEcheance: '2026-05-31' };

describe('EffetsService · acceptation', () => {
  it("l'effet naît avec sa pièce, l'échéance posée sur la pièce dans la transaction, lettré avec la facture", async () => {
    const { service, tx, lettrage, appels, ecritures } = monter();
    const r = await service.accepter('t', 'u', { ...ACCEPTATION, ligneIds: ['f1'] });
    expect(r.lettre).toBe('AA');
    expect(tx.ecriture.updateMany).toHaveBeenCalledWith({ where: { id: 'e9', tenantId: 't' }, data: { dateEncaissementEffet: new Date('2026-05-31T00:00:00.000Z') } });
    expect(lettrage.lettrerManuel).toHaveBeenCalledWith('t', 'c411', ['f1', 'l1'], 'u', { autoriserPartiel: true });
    const dto = ecritures.creerAvec.mock.calls[0][2] as { lignes: Array<{ compteId: string; debit: number; credit: number }> };
    expect(dto.lignes.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c412', 1160000, 0], ['c411', 0, 1160000]]);
    expect(appels).toEqual(['écriture jod', 'effet']);
  });

  it("un lettrage refusé retire l'effet, ses actes ET la pièce, et l'erreur d'origine remonte", async () => {
    const { service, appels } = monter({ lettrageEchoue: true });
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, ligneIds: ['f1'] })).rejects.toThrow(/solde non nul/);
    expect(appels).toEqual(['écriture jod', 'effet', 'actes retirés', 'effet retiré', 'pièce retirée']);
  });

  it("le SYCEBNL n'ouvre pas l'effet à recevoir · refusé avant toute pièce, l'effet à payer passe", async () => {
    const { service, ecritures } = monter({ referentiel: 'SYCEBNL' });
    await expect(service.accepter('t', 'u', ACCEPTATION)).rejects.toThrow(/Clients-usagers/);
    expect(ecritures.creerAvec).not.toHaveBeenCalled();
  });

  it('un compte hors 412, un tiers hors 411, un journal de trésorerie ou un nominal au-delà du dû sont refusés avant toute pièce', async () => {
    const { service, ecritures } = monter();
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, compteEffetId: 'c601' })).rejects.toThrow(/compte de portefeuille d'effets \(412/);
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, compteTiersId: 'c412' })).rejects.toThrow(/compte client \(411\)/);
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, journalId: 'jbq' })).rejects.toThrow(/opérations diverses/);
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, montant: 2000000, ligneIds: ['f1'] })).rejects.toThrow(/dépasse le dû/);
    await expect(service.accepter('t', 'u', { ...ACCEPTATION, dateEcheance: '2026-02-01' })).rejects.toThrow(/antérieure à sa création/);
    expect(ecritures.creerAvec).not.toHaveBeenCalled();
  });
});

describe('EffetsService · les actes', () => {
  it('la remise à l\'encaissement passe D 512 / C 412 au journal de l\'effet, le statut relu dans la transaction', async () => {
    const { service, tx, ecritures, appels } = monter();
    const r = await service.remettre('t', 'u', 'ef1', { date: '2026-03-10', compteEncaissementId: 'c512' });
    expect(r.acteId).toBe('a9');
    expect(tx.effetCommerce.updateMany).toHaveBeenCalledWith({ where: { id: 'ef1', tenantId: 't', statut: 'EN_PORTEFEUILLE' }, data: { statut: 'REMIS_A_L_ENCAISSEMENT' } });
    const dto = ecritures.creerAvec.mock.calls[0][2] as { journalId: string; lignes: Array<{ compteId: string; debit: number; credit: number }> };
    expect(dto.journalId).toBe('jod');
    expect(dto.lignes.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c512', 1160000, 0], ['c412', 0, 1160000]]);
    expect(appels).toEqual(['écriture jod', 'acte REMISE_ENCAISSEMENT']);
  });

  it('un acte hors statut, un 512 hors racine ou une date antérieure au précédent sont refusés avant toute pièce', async () => {
    const { service, ecritures } = monter({ statut: 'ENCAISSE' });
    await expect(service.remettre('t', 'u', 'ef1', { date: '2026-03-10', compteEncaissementId: 'c512' })).rejects.toThrow(/n'admet pas « Remise à l'encaissement »/);
    const { service: s2, ecritures: e2 } = monter();
    await expect(s2.remettre('t', 'u', 'ef1', { date: '2026-03-10', compteEncaissementId: 'c601' })).rejects.toThrow(/racine 512/);
    await expect(s2.remettre('t', 'u', 'ef1', { date: '2026-02-20', compteEncaissementId: 'c512' })).rejects.toThrow(/avant le précédent/);
    expect(ecritures.creerAvec).not.toHaveBeenCalled();
    expect(e2.creerAvec).not.toHaveBeenCalled();
  });

  it("le décompte crédite le net au journal de la banque et garde sa banque sur l'acte ; frais sans compte refusés", async () => {
    const actes: Acte[] = [
      { id: 'a1', nature: 'ACCEPTATION', date: new Date('2026-03-01T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c412, ecriture: { id: 'e1', numeroPiece: 1, statut: 'VALIDEE' }, ecritureNegatif: null },
      { id: 'a2', nature: 'REMISE_ESCOMPTE', date: new Date('2026-03-10T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c415, ecriture: { id: 'e2', numeroPiece: 2, statut: 'VALIDEE' }, ecritureNegatif: null },
    ];
    const { service, ecritures, tx } = monter({ statut: 'ESCOMPTE', actes });
    await expect(service.decompte('t', 'u', 'ef1', { date: '2026-03-12', journalBanqueId: 'jbq', compteCreditEscompteId: 'c565', frais: 10000, referencePiece: 'Décompte 3' })).rejects.toThrow(/exigent leur compte/);
    await service.decompte('t', 'u', 'ef1', { date: '2026-03-12', journalBanqueId: 'jbq', compteCreditEscompteId: 'c565', frais: 10000, compteFraisId: 'c675', referencePiece: 'Décompte 3' });
    const dto = ecritures.creerAvec.mock.calls[0][2] as { journalId: string; lignes: Array<{ compteId: string; debit: number; credit: number }> };
    expect(dto.journalId).toBe('jbq');
    expect(dto.lignes.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c52', 1150000, 0], ['c675', 10000, 0], ['c565', 0, 1160000]]);
    const acte = tx.acteEffet.create.mock.calls[0][0] as { data: { detail: { compteBanqueId: string; journalBanqueId: string; net: number } } };
    expect(acte.data.detail).toMatchObject({ compteBanqueId: 'c52', journalBanqueId: 'jbq', net: 1150000 });
  });

  it("l'impayé d'un effet escompté et décompté reprend le nominal sur la banque, dans une pièce du journal de la banque", async () => {
    const actes: Acte[] = [
      { id: 'a1', nature: 'ACCEPTATION', date: new Date('2026-03-01T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c412, ecriture: { id: 'e1', numeroPiece: 1, statut: 'VALIDEE' }, ecritureNegatif: null },
      { id: 'a2', nature: 'REMISE_ESCOMPTE', date: new Date('2026-03-10T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c415, ecriture: { id: 'e2', numeroPiece: 2, statut: 'VALIDEE' }, ecritureNegatif: null },
      { id: 'a3', nature: 'DECOMPTE_ESCOMPTE', date: new Date('2026-03-12T00:00:00.000Z'), montant: 1160000, detail: { compteBanqueId: 'c52', journalBanqueId: 'jbq' }, annuleLe: null, compte: COMPTES.c565, ecriture: { id: 'e3', numeroPiece: 3, statut: 'VALIDEE' }, ecritureNegatif: null },
    ];
    const { service, ecritures } = monter({ statut: 'ESCOMPTE', actes });
    await service.impaye('t', 'u', 'ef1', { date: '2026-06-02', compteImpayeId: 'c413' });
    const dto = ecritures.creerAvec.mock.calls[0][2] as { journalId: string; lignes: Array<{ compteId: string; debit: number; credit: number }> };
    expect(dto.journalId).toBe('jbq');
    expect(dto.lignes.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c413', 1160000, 0], ['c415', 0, 1160000], ['c565', 1160000, 0], ['c52', 0, 1160000]]);
  });

  it("le dénouement exige le décompte et l'échéance ; passé, D 565 / C 415 au journal de l'effet", async () => {
    const actes: Acte[] = [
      { id: 'a1', nature: 'ACCEPTATION', date: new Date('2026-03-01T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c412, ecriture: { id: 'e1', numeroPiece: 1, statut: 'VALIDEE' }, ecritureNegatif: null },
      { id: 'a2', nature: 'REMISE_ESCOMPTE', date: new Date('2026-03-10T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c415, ecriture: { id: 'e2', numeroPiece: 2, statut: 'VALIDEE' }, ecritureNegatif: null },
    ];
    const { service } = monter({ statut: 'ESCOMPTE', actes });
    await expect(service.denouer('t', 'u', 'ef1', { date: '2026-06-01' })).rejects.toThrow(/passez d'abord le décompte/);
    const avec = [...actes, { id: 'a3', nature: 'DECOMPTE_ESCOMPTE', date: new Date('2026-03-12T00:00:00.000Z'), montant: 1160000, detail: { compteBanqueId: 'c52', journalBanqueId: 'jbq' }, annuleLe: null, compte: COMPTES.c565, ecriture: { id: 'e3', numeroPiece: 3, statut: 'VALIDEE' }, ecritureNegatif: null }];
    const { service: s2, ecritures } = monter({ statut: 'ESCOMPTE', actes: avec });
    await expect(s2.denouer('t', 'u', 'ef1', { date: '2026-05-30' })).rejects.toThrow(/2026-05-31/);
    await s2.denouer('t', 'u', 'ef1', { date: '2026-05-31' });
    const dto = ecritures.creerAvec.mock.calls[0][2] as { journalId: string; lignes: Array<{ compteId: string; debit: number; credit: number }> };
    expect(dto.journalId).toBe('jod');
    expect(dto.lignes.map((l) => [l.compteId, l.debit, l.credit])).toEqual([['c565', 1160000, 0], ['c415', 0, 1160000]]);
  });
});

describe('EffetsService · annulation à rebours', () => {
  const actes: Acte[] = [
    { id: 'a1', nature: 'ACCEPTATION', date: new Date('2026-03-01T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c412, ecriture: { id: 'e1', numeroPiece: 1, statut: 'VALIDEE' }, ecritureNegatif: null },
    { id: 'a2', nature: 'REMISE_ENCAISSEMENT', date: new Date('2026-03-10T00:00:00.000Z'), montant: 1160000, detail: null, annuleLe: null, compte: COMPTES.c512, ecriture: { id: 'e2', numeroPiece: 2, statut: 'VALIDEE' }, ecritureNegatif: null },
  ];

  it("l'acceptation ne s'annule pas tant qu'un acte postérieur tient · le dernier est nommé", async () => {
    const { service, ecritures } = monter({ statut: 'REMIS_A_L_ENCAISSEMENT', actes });
    await expect(service.annulerActe('t', 'u', 'ef1', 'a1', { motif: 'erreur de saisie' })).rejects.toThrow(/annulez d'abord « Remise à l'encaissement » du 2026-03-10/);
    expect(ecritures.inscrireEnNegatifPourAnnulation).not.toHaveBeenCalled();
  });

  it('le dernier acte validé s\'inscrit en négatif, reste lié, et le statut redevient celui d\'avant', async () => {
    const { service, tx, appels } = monter({ statut: 'REMIS_A_L_ENCAISSEMENT', actes });
    const r = await service.annulerActe('t', 'u', 'ef1', 'a2', { motif: 'remise à la mauvaise banque' });
    expect(r).toMatchObject({ statut: 'EN_PORTEFEUILLE', traitement: 'INSCRITE_EN_NEGATIF', ecritureNegatifId: 'neg1' });
    expect(tx.acteEffet.update).toHaveBeenCalledWith({ where: { id: 'a2', tenantId: 't' }, data: { ecritureId: 'e2', ecritureNegatifId: 'neg1' } });
    expect(tx.effetCommerce.updateMany).toHaveBeenCalledWith({ where: { id: 'ef1', tenantId: 't', statut: 'REMIS_A_L_ENCAISSEMENT' }, data: { statut: 'EN_PORTEFEUILLE' } });
    expect(appels).toEqual(['négatif']);
  });

  it("au brouillard la pièce est retirée (relue dans la transaction) et le lien part ; l'acceptation seule annulée rend l'effet ANNULÉ", async () => {
    const seule: Acte[] = [actes[0]];
    const { service, tx, appels } = monter({ statut: 'EN_PORTEFEUILLE', actes: seule, statutPiece: 'BROUILLARD' });
    const r = await service.annulerActe('t', 'u', 'ef1', 'a1', { motif: 'doublon' });
    expect(r).toMatchObject({ statut: 'ANNULE', traitement: 'SUPPRIMEE', ecritureNegatifId: null });
    // L'acte retient sa pièce (clé étrangère RESTRICT) · le lien se dénoue AVANT le retrait, sinon la base refuse (vu sur vraie base).
    expect(appels).toEqual(['lien dénoué', 'pièce retirée']);
    expect(tx.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', tenantId: 't', statut: 'BROUILLARD' } });
    expect(tx.acteEffet.update).toHaveBeenCalledWith({ where: { id: 'a1', tenantId: 't' }, data: { ecritureId: null, ecritureNegatifId: null } });
  });
});

describe('EffetsService · comptes', () => {
  it("au SYCEBNL, le rôle d'encaissement rend une liste vide avec son motif, jamais une racine du SYSCOHADA", async () => {
    const { service, prisma } = monter({ referentiel: 'SYCEBNL' });
    const r = await service.comptes('t', 'ENCAISSEMENT', 'A_RECEVOIR');
    expect(r.racines).toBeNull();
    expect(r.motif).toMatch(/Clients-usagers/);
    expect(prisma.compte.findMany).not.toHaveBeenCalled();
    await expect(service.comptes('t', 'AUTRE', 'A_RECEVOIR')).rejects.toThrow(/rôle du compte/);
  });
});
