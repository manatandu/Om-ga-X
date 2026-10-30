import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * MOT DE PASSE PROVISOIRE · deux garanties. Le changement exige le mot de
 * passe ACTUEL (un poste laissé ouvert ne permet pas d'évincer le
 * titulaire), et il efface doitChangerMotDePasse · c'est le geste qui clôt
 * la période où un tiers (console de l'éditeur, siège d'un groupe, admin du dossier)
 * connaissait le mot de passe.
 */
describe('AuthService · changement de mot de passe', () => {
  const service = (capture: { data?: Record<string, unknown> }, motDePasseStocke: string) => {
    // L'acte passe dans une transaction · verrou du dossier, ligne du compte
    // relue sous verrou, puis la mise à jour (`revoquerEtFermerLaSession`).
    const client: Record<string, unknown> = {
      $executeRaw: async () => 1,
      $queryRaw: async () => [{ sessionsFermees: [] }],
      user: {
        findUnique: async () => ({ id: 'u1', tenantId: 't1', motDePasse: motDePasseStocke }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          capture.data = data;
          return {};
        },
      },
    };
    client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
    return new AuthService(
      client as never,
      // Le changement RESIGNE une session · il révoque toutes les sessions du
      // compte, celle du titulaire comprise.
      { sign: () => 'jeton-neuf' } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
  };

  it('refuse sans le mot de passe actuel correct, et ne touche à rien', async () => {
    const capture: { data?: Record<string, unknown> } = {};
    const hash = await bcrypt.hash('bon-mot-de-passe', 4);
    await expect(service(capture, hash).changerMotDePasse('u1', 'mauvais', 'nouveau-tres-long')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(capture.data).toBeUndefined();
  });

  it('hache le nouveau mot de passe et efface le drapeau de première connexion', async () => {
    const capture: { data?: Record<string, unknown> } = {};
    const hash = await bcrypt.hash('bon-mot-de-passe', 4);
    await service(capture, hash).changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long');
    expect(capture.data!.doitChangerMotDePasse).toBe(false);
    // Jamais stocké en clair, et vérifiable par bcrypt.
    expect(capture.data!.motDePasse).not.toBe('nouveau-tres-long');
    expect(await bcrypt.compare('nouveau-tres-long', capture.data!.motDePasse as string)).toBe(true);
  });

  it('RÉVOQUE les sessions ouvertes · un mot de passe change souvent parce qu’il a fuité', async () => {
    // Sans cette révocation, celui qui détenait le mot de passe gardait sa
    // session jusqu'à huit heures, et le changement ne servait à rien pendant
    // la seule période où il aurait servi.
    const capture: { data?: Record<string, unknown> } = {};
    const hash = await bcrypt.hash('bon-mot-de-passe', 4);
    const resultat = await service(capture, hash).changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long');

    expect(capture.data!.sessionsInvalidesAvant).toBeInstanceOf(Date);
    // Le verrou de force brute tombe aussi · le titulaire vient de prouver
    // qui il est en donnant l'ancien mot de passe.
    expect(capture.data!.tentativesEchouees).toBe(0);
    expect(capture.data!.verrouilleJusqua).toBeNull();
    // Et le délai d'oubli repart de rien · un mot de passe changé efface
    // l'historique des échecs (verrouillage.ts).
    expect(capture.data!.dernierEchecLe).toBeNull();
    // Une session neuve est rendue, sans quoi le titulaire serait éjecté par
    // son propre geste.
    expect(resultat).toMatchObject({ change: true, accessToken: 'jeton-neuf' });
  });

  it('ferme la session qui présentait le changement · authentifiée dans la même seconde, la révocation à la seconde ne la tenait pas pour antérieure', async () => {
    // Reproduit sur vraie base (`scripts/rejouer-dossier-l9.cjs`, un passage
    // sur cinq) · connexion au mot de passe provisoire puis changement dans la
    // même seconde, la session provisoire restait valable et « connectée ».
    const capture: { data?: Record<string, unknown> } = {};
    const hash = await bcrypt.hash('bon-mot-de-passe', 4);
    const session = { longue: false, origine: 1_800_000_000, iat: 1_800_000_000, exp: 1_800_028_800, csrf: 'csrf-provisoire' };
    await service(capture, hash).changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long', session);
    const { empreinteSession } = await import('./sessions-fermees');
    expect(capture.data!.sessionsFermees).toEqual([{ e: empreinteSession('csrf-provisoire'), f: 1_800_028_800 }]);
  });

  it('sous un dossier tenu par une clôture, l’attente est BORNÉE · 409 DOSSIER_OCCUPE nommé, jamais une transaction expirée en 500, rien écrit (relecture M2)', async () => {
    const capture: { data?: Record<string, unknown> } = {};
    const hash = await bcrypt.hash('bon-mot-de-passe', 4);
    const { Prisma } = await import('@prisma/client');
    const sqls: string[] = [];
    const client: Record<string, unknown> = {
      // La borne posée, puis le verrou du dossier qui expire (55P03), comme PostgreSQL sous une clôture longue.
      $executeRaw: async (t: TemplateStringsArray | { sql: string }) => {
        const sql = Array.isArray(t) ? (t as TemplateStringsArray).join('?') : (t as { sql: string }).sql;
        sqls.push(sql);
        if (/pg_advisory_xact_lock/.test(sql)) {
          throw new Prisma.PrismaClientKnownRequestError('canceling statement due to lock timeout 55P03', { code: 'P2010', clientVersion: 'x', meta: { code: '55P03' } });
        }
        return 1;
      },
      $queryRaw: async () => [{ sessionsFermees: [] }],
      user: {
        findUnique: async () => ({ id: 'u1', tenantId: 't1', motDePasse: hash }),
        update: async ({ data }: { data: Record<string, unknown> }) => ((capture.data = data), {}),
      },
    };
    client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
    const s = new AuthService(client as never, { sign: () => 'jeton' } as never, ...([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined] as [never, never, never, never, never, never, never, never]));
    const e = await s.changerMotDePasse('u1', 'bon-mot-de-passe', 'nouveau-tres-long').catch((x: unknown) => x);
    expect((e as { getResponse?: () => unknown }).getResponse?.()).toMatchObject({ code: 'DOSSIER_OCCUPE' });
    expect(sqls[0]).toMatch(/SET LOCAL lock_timeout = \d+/);
    expect(capture.data).toBeUndefined();
  });
});
