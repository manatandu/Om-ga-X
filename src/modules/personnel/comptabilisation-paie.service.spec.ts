import { DETENTEUR_PAIE_DU_MOIS, EcritureService } from '../comptabilite/ecriture.service';
import { ComptabilisationPaieService } from './comptabilisation-paie.service';
import { propositionPaieDuMois, type BulletinAComptabiliser } from './comptabilisation-paie';

/**
 * P9 · LE CÂBLAGE. La règle vit dans `comptabilisation-paie.ts` ; ici on
 * vérifie que le service POSTE ce qu'elle propose, LIE les bulletins, et ne
 * laisse jamais un salaire passé deux fois ni un bulletin se dire passé sans
 * écriture.
 */

const bulletin = (numero: number, ecritureId: string | null = null) => ({
  id: `b${numero}`,
  numero,
  nomComplet: `SALARIE ${numero}`,
  statut: 'EMIS',
  ecritureId,
  netAPayerFc: 1_250_000,
  entree: {
    elements: [
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 1_000_000 },
      { nature: 'LOGEMENT_OU_SON_INDEMNITE', libelle: 'Logement', montantFc: 400_000 },
    ],
  },
  calcul: {
    cotisations: {
      lignes: [
        { cle: 'cnss-pf', charge: 'EMPLOYEUR', montantFc: 65_000 },
        { cle: 'cnss-pension-employeur', charge: 'EMPLOYEUR', montantFc: 50_000 },
        { cle: 'cnss-pension-travailleur', charge: 'TRAVAILLEUR', montantFc: 50_000 },
        { cle: 'cnss-rp', charge: 'EMPLOYEUR', montantFc: 15_000 },
        { cle: 'inpp', charge: 'EMPLOYEUR', montantFc: 35_000 },
        { cle: 'onem', charge: 'EMPLOYEUR', montantFc: 5_000 },
      ],
      abstentions: [],
    },
    retenue: { retenueFc: 100_000 },
    net: { netAPayerFc: 1_250_000 },
  },
});

/**
 * RELECTURE M3 · l'écriture qui a passé un bulletin annulé, telle qu'au
 * journal · ici celle qui a passé le seul bulletin n° 1, à la règle du jour.
 */
const lignesOrigine = propositionPaieDuMois('2026-03', 'SYSCOHADA', [bulletin(1) as BulletinAComptabiliser]).lignes.map((l) => ({
  debit: l.sens === 'DEBIT' ? l.montantFc : 0,
  credit: l.sens === 'CREDIT' ? l.montantFc : 0,
  compte: { numero: l.compte, intitule: l.intitule },
}));

function monter(
  opts: { bulletins?: unknown[]; lies?: number; ecriture?: Record<string, unknown> | null; porte?: number; pieces?: unknown[] } = {},
) {
  const bulletins = opts.bulletins ?? [bulletin(1), bulletin(2)];
  const tx = {
    bulletinPaie: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ecriture: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    bulletinPaie: {
      findMany: jest.fn().mockResolvedValue(bulletins),
      updateMany: jest.fn().mockResolvedValue({ count: opts.lies ?? bulletins.length }),
      count: jest.fn().mockResolvedValue(opts.porte ?? 2),
    },
    journal: { findFirst: jest.fn().mockResolvedValue({ id: 'j-od' }) },
    exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2026-01-01T00:00:00.000Z') }) },
    compte: {
      findMany: jest.fn(async ({ where }: { where: { numero: { in: string[] } } }) =>
        where.numero.in.map((numero) => ({ id: `c-${numero}`, numero, typeCompte: 'DETAIL' })),
      ),
    },
    ecriture: {
      // Deux lectures · l'écriture d'origine des bulletins annulés (avec ses
      // lignes, M3), puis les pièces déjà passées (avec leur date).
      findMany: jest.fn(async (args: { where: { id: { in: string[] } }; select: { lignes?: unknown } }) =>
        args.select.lignes ? args.where.id.in.map((id) => ({ id, numeroPiece: 4, lignes: lignesOrigine })) : (opts.pieces ?? []),
      ),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(
        opts.ecriture === undefined
          ? { id: 'e1', statut: 'BROUILLARD', numeroPiece: 12, exercice: { statut: 'OUVERT' }, lignes: [] }
          : opts.ecriture,
      ),
    },
    $transaction: jest.fn(async (f: (t: typeof tx) => Promise<unknown>) => f(tx)),
  };
  // Les deux gestes du journal que la paie appelle (audit final F107) · la
  // doublure joue `liberer` dans la transaction, comme le service réel.
  const ecritures = {
    creer: jest.fn().mockResolvedValue({ id: 'e-paie', numeroPiece: 7 }),
    supprimer: jest.fn(async (_t: string, _id: string, pour: { liberer: (x: typeof tx) => Promise<unknown> }) => {
      await pour.liberer(tx);
      return { supprime: true };
    }),
    retirerCompensation: jest.fn(async (_t: string, _id: string, liberer?: (x: typeof tx) => Promise<unknown>) => {
      if (liberer) await liberer(tx);
    }),
  };
  const service = new ComptabilisationPaieService(prisma as never, ecritures as never);
  return { service, prisma, ecritures, tx };
}

const dto = { exerciceId: 'ex1', journalId: 'j-od', date: '2026-03-31' };

describe('passer la paie du mois', () => {
  it("poste UNE écriture, avec les lignes de la proposition, et le mois en libellé", async () => {
    const { service, ecritures } = monter();
    await service.comptabiliser('t1', 'u1', '2026-03', dto);
    expect(ecritures.creer).toHaveBeenCalledTimes(1);
    const [, , corps] = ecritures.creer.mock.calls[0];
    expect(corps.libelle).toBe('Paie du mois 2026-03');
    expect(corps.reference).toContain('1, 2');
    const debit = corps.lignes.reduce((n: number, l: { debit?: number }) => n + (l.debit ?? 0), 0);
    const credit = corps.lignes.reduce((n: number, l: { credit?: number }) => n + (l.credit ?? 0), 0);
    expect(debit).toBe(3_440_000);
    expect(credit).toBe(3_440_000);
    expect(corps.lignes[0].compteId).toMatch(/^c-66/);
  });

  it('lie les seuls bulletins encore libres, dans le dossier de la session', async () => {
    const { service, prisma } = monter();
    await service.comptabiliser('t1', 'u1', '2026-03', dto);
    expect(prisma.bulletinPaie.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', id: { in: ['b1', 'b2'] }, ecritureId: null, statut: 'EMIS' },
      data: { ecritureId: 'e-paie' },
    });
  });

  it("retire son écriture quand un autre clic a lié les bulletins entre-temps", async () => {
    const { service, tx, ecritures } = monter({ lies: 1 });
    await expect(service.comptabiliser('t1', 'u1', '2026-03', dto)).rejects.toThrow(/a changé pendant la passation/);
    // Par la compensation du journal, jamais réécrite ici (audit final F107).
    expect(ecritures.retirerCompensation).toHaveBeenCalledWith('t1', 'e-paie', expect.any(Function));
    expect(tx.bulletinPaie.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', ecritureId: 'e-paie' },
      data: { ecritureId: null },
    });
  });

  it("ne poste rien quand tout est déjà passé", async () => {
    const { service, ecritures } = monter({ bulletins: [bulletin(1, 'e0')] });
    await expect(service.comptabiliser('t1', 'u1', '2026-03', dto)).rejects.toThrow(/Aucun bulletin/);
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('refuse un compte non ouvert en imputation, et le nomme', async () => {
    const { service, prisma, ecritures } = monter();
    prisma.compte.findMany.mockImplementation(async ({ where }: { where: { numero: { in: string[] } } }) =>
      where.numero.in.map((numero) => ({ id: `c-${numero}`, numero, typeCompte: numero === '44720000' ? 'TOTAL' : 'DETAIL' })),
    );
    await expect(service.comptabiliser('t1', 'u1', '2026-03', dto)).rejects.toThrow(/44720000/);
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  // C2 · la reprise en négatif d'un bulletin annulé après passation.
  const annule = (numero: number, ecritureId: string, ecritureNegatifId: string | null = null) => ({
    ...bulletin(numero, ecritureId),
    statut: 'ANNULE',
    ecritureNegatifId,
  });

  it('C2 · exige que le cabinet CONFIRME la reprise en négatif · elle a pu être inscrite à la main', async () => {
    const { service, ecritures } = monter({ bulletins: [annule(1, 'e-ancienne'), bulletin(2)] });
    await expect(service.comptabiliser('t1', 'u1', '2026-03', dto)).rejects.toThrow(/confirmez la reprise[\s\S]*contre-passez d'abord/);
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('C2 · confirmée, la reprise se lie au bulletin annulé, sur les seuls bulletins encore non repris', async () => {
    const { service, prisma, ecritures } = monter({ bulletins: [annule(1, 'e-ancienne'), bulletin(2)] });
    prisma.bulletinPaie.updateMany.mockResolvedValue({ count: 1 });
    await service.comptabiliser('t1', 'u1', '2026-03', { ...dto, inscrireNegatifs: true });
    const [, , corps] = ecritures.creer.mock.calls[0];
    // Le réémis et l'ancien s'annulent exactement · seules les lignes restent,
    // chacune de son côté, le 422 à zéro.
    expect(corps.lignes.some((l: { debit?: number }) => (l.debit ?? 0) < 0)).toBe(true);
    expect(prisma.bulletinPaie.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', id: { in: ['b1'] }, statut: 'ANNULE', ecritureNegatifId: null },
      data: { ecritureNegatifId: 'e-paie' },
    });
    // Mois et exercice concordent · aucune date de valeur.
    expect(prisma.ecriture.update).not.toHaveBeenCalled();
    // M3 · l'écriture d'origine se lit dans le dossier, avec ses lignes, et la
    // reprise recopie ses comptes (aucun 6415 négatif né d'un rejeu).
    expect(prisma.ecriture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', id: { in: ['e-ancienne'] } } }),
    );
    expect(corps.lignes.some((l: { libelle: string }) => l.libelle.includes('pièce n° 4'))).toBe(true);
  });

  it("C2 · un mois d'un exercice antérieur passé dans celui-ci porte sa date de valeur (AUDCIF art. 22, 4°)", async () => {
    const { service, prisma } = monter({ bulletins: [bulletin(2)] });
    prisma.exercice.findFirst.mockResolvedValue({ dateDebut: new Date('2027-01-01T00:00:00.000Z') });
    await service.comptabiliser('t1', 'u1', '2026-12', { ...dto, date: '2027-01-01' });
    expect(prisma.ecriture.update).toHaveBeenCalledWith({
      where: { id: 'e-paie' },
      data: { dateValeur: new Date('2026-12-31T00:00:00.000Z') },
    });
  });

  it("C2 · une date de valeur manquée retire l'écriture, délie tout, et l'erreur d'origine remonte", async () => {
    const { service, prisma, ecritures, tx } = monter({ bulletins: [bulletin(2)] });
    prisma.exercice.findFirst.mockResolvedValue({ dateDebut: new Date('2027-01-01T00:00:00.000Z') });
    prisma.ecriture.update.mockRejectedValueOnce(new Error('panne de la base'));
    await expect(service.comptabiliser('t1', 'u1', '2026-12', { ...dto, date: '2027-01-01' })).rejects.toThrow(/panne de la base/);
    expect(ecritures.retirerCompensation).toHaveBeenCalledWith('t1', 'e-paie', expect.any(Function));
    expect(tx.bulletinPaie.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', ecritureNegatifId: 'e-paie' },
      data: { ecritureNegatifId: null },
    });
  });

  it("C2 · refuse une reprise datée AVANT l'écriture qui a passé le bulletin annulé", async () => {
    const { service, ecritures } = monter({
      bulletins: [annule(1, 'e-ancienne'), bulletin(2)],
      pieces: [{ id: 'e-ancienne', numeroPiece: 4, date: new Date('2026-04-30T00:00:00.000Z'), statut: 'VALIDEE' }],
    });
    await expect(service.comptabiliser('t1', 'u1', '2026-03', { ...dto, inscrireNegatifs: true })).rejects.toThrow(/ne peut précéder/);
    expect(ecritures.creer).not.toHaveBeenCalled();
  });

  it('refuse un mois illisible', async () => {
    const { service } = monter();
    await expect(service.proposition('t1', '2026-3')).rejects.toThrow(/AAAA-MM/);
  });
});

describe('défaire la passation', () => {
  it("passe par la suppression du journal, en se nommant détenteur, et délie les bulletins dans sa transaction", async () => {
    const { service, tx, ecritures } = monter();
    await expect(service.annulerComptabilisation('t1', 'e1')).resolves.toEqual({ annule: true, bulletinsLiberes: 2 });
    expect(ecritures.supprimer).toHaveBeenCalledWith('t1', 'e1', expect.objectContaining({ detenteur: DETENTEUR_PAIE_DU_MOIS }));
    expect(tx.bulletinPaie.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't1', ecritureId: 'e1' }, data: { ecritureId: null } });
    // C2 · une reprise en négatif portée par l'écriture se délie avec elle.
    expect(tx.bulletinPaie.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', ecritureNegatifId: 'e1' },
      data: { ecritureNegatifId: null },
    });
  });

  it('un refus du journal remonte, et aucun bulletin n’est délié', async () => {
    const { service, tx, ecritures } = monter();
    ecritures.supprimer.mockRejectedValueOnce(new Error("L'écriture n° 12 est validée"));
    await expect(service.annulerComptabilisation('t1', 'e1')).rejects.toThrow(/validée/);
    expect(tx.bulletinPaie.updateMany).not.toHaveBeenCalled();
  });

  // AUDIT FINAL F107 · les gardes recopiées à la main avaient oublié le
  // POINTAGE. Avec le vrai service du journal, une ligne pointée refuse.
  it('une ligne pointée refuse, par les gardes du journal lui-même', async () => {
    const { prisma, tx } = monter({
      ecriture: {
        id: 'e1',
        tenantId: 't1',
        statut: 'BROUILLARD',
        numeroPiece: 12,
        exerciceId: 'ex1',
        estGenereeParCloture: false,
        exercice: { statut: 'OUVERT' },
        lignes: [{ lettre: null, lettrageId: null, rapprochementId: 'r1' }],
      },
    });
    const journal = new EcritureService(prisma as never, {} as never, {} as never, {} as never);
    const service = new ComptabilisationPaieService(prisma as never, journal);
    await expect(service.annulerComptabilisation('t1', 'e1')).rejects.toThrow(/pointée/);
    expect(tx.bulletinPaie.updateMany).not.toHaveBeenCalled();
    expect(tx.ecriture.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse une écriture qui ne passe aucun bulletin · ce chemin n'efface pas le journal", async () => {
    const { service, ecritures } = monter({ porte: 0 });
    await expect(service.annulerComptabilisation('t1', 'e1')).rejects.toThrow(/aucun bulletin/);
    expect(ecritures.supprimer).not.toHaveBeenCalled();
  });
});
