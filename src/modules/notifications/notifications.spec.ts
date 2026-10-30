import { readFileSync } from 'fs';
import { join } from 'path';
import { RoleUtilisateur, TypeNotification } from '@prisma/client';
import { notifier, notifierSansEchec } from './notifications';
import { PreferencesService } from './preferences.service';
import { lireLesRacines } from '../etats-personnalises/moteur-etat-personnalise';

describe("les notifications dans l'interface · aux seuls qu'elles concernent", () => {
  const base = (utilisateurs: Array<{ id: string; preferences: { notificationsCoupees: TypeNotification[] } | null }>) => {
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const findMany = jest.fn().mockResolvedValue(utilisateurs);
    return { db: { user: { findMany }, notificationUtilisateur: { createMany } } as never, createMany, findMany };
  };

  it("ni à l'auteur de l'acte, ni à qui a coupé l'événement", async () => {
    const { db, createMany, findMany } = base([
      { id: 'a', preferences: null },
      { id: 'b', preferences: { notificationsCoupees: [TypeNotification.EXERCICE_CLOTURE] } },
      { id: 'c', preferences: { notificationsCoupees: [] } },
    ]);
    const n = await notifier(db, 't1', TypeNotification.EXERCICE_CLOTURE, { titre: 'Exercice 2026 clôturé', lien: '/exercice' }, { sauf: 'a' });
    expect(n).toBe(1);
    expect(createMany.mock.calls[0][0].data).toEqual([
      { tenantId: 't1', destinataireId: 'c', type: TypeNotification.EXERCICE_CLOTURE, titre: 'Exercice 2026 clôturé', lien: '/exercice' },
    ]);
    // Les utilisateurs actifs du dossier, et lui seul.
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', estActif: true });
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
  });

  it('au-delà d’une tranche, les destinataires suivants sont lus, jamais tus', async () => {
    const premiers = Array.from({ length: 500 }, (_, i) => ({ id: `u${String(i).padStart(4, '0')}`, preferences: null }));
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const findMany = jest.fn().mockResolvedValueOnce(premiers).mockResolvedValueOnce([{ id: 'u9999', preferences: null }]);
    const db = { user: { findMany }, notificationUtilisateur: { createMany } } as never;
    expect(await notifier(db, 't1', TypeNotification.EXERCICE_CLOTURE, { titre: 'x' }, {})).toBe(501);
    expect(findMany.mock.calls[1][0].where.AND).toEqual([{ id: { gt: 'u0499' } }]);
  });

  it('les rôles et les destinataires nommés bornent la lecture', async () => {
    const { db, findMany } = base([]);
    await notifier(db, 't1', TypeNotification.ECRITURES_RECUES, { titre: 'x' }, { roles: [RoleUtilisateur.COMPTABLE], userIds: ['u'] });
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', estActif: true, id: { in: ['u'] }, role: { in: [RoleUtilisateur.COMPTABLE] } });
  });

  it("un échec ne défait jamais l'acte · rendu nul, consigné", async () => {
    const db = { user: { findMany: jest.fn().mockRejectedValue(new Error('base')) }, notificationUtilisateur: { createMany: jest.fn() } } as never;
    await expect(notifierSansEchec(db, 't1', TypeNotification.MESSAGE_RECU, { titre: 'x' }, {})).resolves.toBe(0);
  });

  it("la lecture qui compose le contenu tombe sous la même garde · un acte fait ne rend jamais d'erreur", async () => {
    const createMany = jest.fn();
    const db = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'b', preferences: null }]) }, notificationUtilisateur: { createMany } } as never;
    await expect(
      notifierSansEchec(db, 't1', TypeNotification.EXERCICE_CLOTURE, async () => Promise.reject(new Error('lecture')), {}),
    ).resolves.toBe(0);
    // Rien à dire (l'exercice introuvable) · aucune notification, aucune lecture des destinataires.
    await expect(notifierSansEchec(db, 't1', TypeNotification.EXERCICE_CLOTURE, async () => null, {})).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('les trois actes disent leur événement après coup', () => {
    const lire = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
    expect(lire('messagerie/messagerie.service.ts')).toMatch(/notifierSansEchec\([\s\S]*TypeNotification\.MESSAGE_RECU/);
    expect(lire('exports/echange/echange-ecritures.service.ts')).toMatch(/notifierSansEchec\([\s\S]*TypeNotification\.ECRITURES_RECUES/);
    expect(lire('exercice/exercice.controller.ts')).toMatch(/notifierSansEchec\([\s\S]*TypeNotification\.EXERCICE_CLOTURE/);
  });
});

describe('les préférences · les siennes seules', () => {
  it('sans ligne, les défauts · français, rien de coupé', async () => {
    const prisma = { preferenceUtilisateur: { findFirst: jest.fn().mockResolvedValue(null) } };
    const r = await new PreferencesService(prisma as never).lire('t1', 'u1');
    expect(r).toMatchObject({ langue: 'FR', notificationsCoupees: [] });
    expect(prisma.preferenceUtilisateur.findFirst.mock.calls[0][0].where).toEqual({ tenantId: 't1', userId: 'u1' });
  });

  it("l'anglais est refusé tant que le contrat dit le français seul · refusé, pas seulement masqué", async () => {
    const prisma = { preferenceUtilisateur: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() } };
    await expect(new PreferencesService(prisma as never).regler('t1', 'u1', { langue: 'EN' as never })).rejects.toThrow(/seule langue proposée/);
    expect(prisma.preferenceUtilisateur.update).not.toHaveBeenCalled();
    expect(prisma.preferenceUtilisateur.create).not.toHaveBeenCalled();
    // La phrase du contrat qui le fonde est bien celle du texte servi.
    const contrat = readFileSync(join(__dirname, '..', 'conditions-licence', 'conditions-de-licence.ts'), 'utf8');
    expect(contrat).toContain('L’interface d’OmegaX, ses documents et le présent contrat sont en français, seule langue proposée.');
  });

  it('ce qui n’est pas envoyé ne change pas', async () => {
    const prisma = {
      preferenceUtilisateur: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 'p' }).mockResolvedValue({ langue: 'EN', notificationsCoupees: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    await new PreferencesService(prisma as never).regler('t1', 'u1', { notificationsCoupees: ['MESSAGE_RECU', 'MESSAGE_RECU'] as never });
    expect(prisma.preferenceUtilisateur.update).toHaveBeenCalledWith({ where: { id: 'p', tenantId: 't1' }, data: { notificationsCoupees: ['MESSAGE_RECU'] } });
  });
});

describe("l'aide à la formule · la règle du calcul, rien de plus", () => {
  const plan = ['70110000', '70120000', '70900000', '70910000', '71100000', '60100000'];
  it('dit ce que la rubrique additionne et ce que le moins écarte', () => {
    const r = lireLesRacines('70 71 -709', plan);
    expect(r.motif).toBeNull();
    expect(r.inclus).toEqual(['70110000', '70120000', '71100000']);
    expect(r.exclus).toEqual(['70900000', '70910000']);
    expect(r.racinesSansCompte).toEqual([]);
  });
  it('nomme la racine qui ne trouve aucun compte', () => {
    expect(lireLesRacines('70 79', plan).racinesSansCompte).toEqual(['79']);
  });
  it('refuse une formule que le moteur refuse, avec son motif', () => {
    expect(lireLesRacines('-709', plan).motif).toMatch(/au moins une racine incluse/);
    expect(lireLesRacines('70 70', plan).motif).toMatch(/citée deux fois/);
  });
});
