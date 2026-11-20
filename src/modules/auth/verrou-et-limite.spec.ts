import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { base32, codeHotp, depuisBase32, pasDe } from './double-authentification';
import { MOTIF_IDENTIFIANTS_INVALIDES, SEUIL_VERROUILLAGE } from './verrouillage';
import { MOTIF_LIEN_DEVERROUILLAGE_INVALIDE, ORIGINE_DEVERROUILLAGE_COMPTE } from './deverrouillage';
import { empreinteDuJeton } from './compte-de-connexion';
import {
  appareilReconnu,
  auDelaDeLaLimite,
  empreinteAdresse,
  jetonAppareil,
  JOURS_JETON_APPAREIL,
  LIMITE_ESSAIS_PAR_ADRESSE,
  MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE,
} from './limite-par-adresse';

/**
 * AUDIT DE SÉCURITÉ DU 2026-11-19 · deux constats MAJEURS.
 *
 * (1) `omegax-auth-verrou-entretenu-par-un-tiers` · un inconnu tenait un compte
 *     fermé sans fin, bon mot de passe compris. Le titulaire entre avec son
 *     second facteur, ou rouvre par un lien reçu à son adresse ; la RÉPONSE
 *     reste celle d'un mot de passe faux, mot pour mot.
 * (2) `omegax-auth-limitation-debit-contournable` · la limite par IP se
 *     contourne · une limite par adresse e-mail, en base, la même pour une
 *     adresse inconnue, et l'appareil reconnu du titulaire n'est pas freiné.
 */
const SECRET_TOTP = base32(Buffer.from('12345678901234567890'));
const codeA = (d: Date) => codeHotp(depuisBase32(SECRET_TOTP), pasDe(d.getTime()));
const enAttente = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));

beforeAll(() => {
  process.env.JWT_SECRET ??= 'secret-de-test-assez-long-0123456789abcdef';
});

async function monde(etat: Record<string, unknown> = {}, options: { messagerie?: boolean; essais?: number } = {}) {
  const u: Record<string, unknown> = {
    id: 'u1', tenantId: 't1', email: 'titulaire@exemple.cd', estActif: true, estOperateurPlateforme: false,
    motDePasse: await bcrypt.hash('bon-mot-de-passe', 4),
    tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null,
    secretDoubleAuth: null, doubleAuthActiveDepuis: null, dernierPasDoubleAuth: null, codesSecoursDoubleAuth: [],
    empreinteDeverrouillage: null, deverrouillageExpireLe: null, deverrouillageEnvoyePour: null,
    sessionsFermees: [],
    ...etat,
  };
  const limite = { essais: options.essais ?? 1, requetes: 0 };
  const ecritures: Record<string, unknown>[] = [];
  const correspond = (where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'tenantId' || k === 'id') return u[k] === v;
      if (k === 'OR') return (v as Record<string, unknown>[]).some((w) => correspond(w));
      if (v && typeof v === 'object' && 'not' in (v as object)) return (u[k] as Date | null)?.getTime() !== ((v as { not: Date }).not).getTime();
      if (v && typeof v === 'object' && 'gt' in (v as object)) return (u[k] as Date) > (v as { gt: Date }).gt;
      if (v instanceof Date) return (u[k] as Date | null)?.getTime() === v.getTime();
      return u[k] === v;
    });
  const client: Record<string, unknown> = {
    $executeRaw: async () => 1,
    $queryRaw: async (q: { sql?: string } | TemplateStringsArray) => {
      const texte = Array.isArray(q) ? q.join('?') : String((q as { sql?: string }).sql ?? '');
      if (texte.includes('essais_connexion_adresse')) {
        limite.requetes += 1;
        return [{ n: limite.essais }];
      }
      return [{ ...u }];
    },
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        if ('empreinteDeverrouillage' in where) return u.empreinteDeverrouillage === where.empreinteDeverrouillage ? { ...u } : null;
        return { ...u };
      },
      findMany: async () => [{ ...u }],
      count: async () => 1,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ecritures.push(data);
        Object.assign(u, data);
        return {};
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!correspond(where)) return { count: 0 };
        ecritures.push(data);
        Object.assign(u, data);
        return { count: 1 };
      },
    },
  };
  client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
  const envoyes: { destinataire: string; corps: string; origine: string; corpsGarde: string }[] = [];
  const courrier = {
    etatDuTransport: () => ({ configure: options.messagerie !== false }),
    envoyerUnSecret: jest.fn(async (_t: string, m: { destinataire: string; corps: string; origine: string }, corpsGarde: string) => {
      envoyes.push({ ...m, corpsGarde });
      return { id: 'm1', statut: 'ENVOYE', erreur: null };
    }),
    mettreEnFile: jest.fn(),
  };
  const none = undefined as never;
  const s = new AuthService(client as never, { sign: () => 'jeton' } as never, none, none, none, none, none, none, none, none, none, courrier as never);
  return { s, u, envoyes, ecritures, limite, courrier };
}

const FERME = () => ({ tentativesEchouees: SEUIL_VERROUILLAGE, verrouilleJusqua: new Date(Date.now() + 10 * 60_000), dernierEchecLe: new Date() });
const connexion = (motDePasse: string, extra: Record<string, unknown> = {}) => ({ email: 'titulaire@exemple.cd', motDePasse, ...extra });

describe('(1) un inconnu ne tient plus un compte fermé', () => {
  it('compte fermé, le BON mot de passe reçoit la réponse d’un mot de passe faux, mot pour mot', async () => {
    const m = await monde(FERME());
    const bon = await m.s.login(connexion('bon-mot-de-passe')).catch((e) => e);
    const faux = await m.s.login(connexion('faux')).catch((e) => e);
    expect(bon.getStatus()).toBe(401);
    expect(faux.getStatus()).toBe(401);
    expect(bon.message).toBe(MOTIF_IDENTIFIANTS_INVALIDES);
    expect(faux.message).toBe(bon.message);
  });

  it('(b) le bon mot de passe pendant le verrou envoie un lien au seul titulaire, APRÈS la réponse, et une seule fois par verrou', async () => {
    const m = await monde(FERME());
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    // Rien n'est parti pendant la requête · la durée de la réponse ne le dit pas.
    expect(m.envoyes).toHaveLength(0);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
    const lien = m.envoyes[0];
    expect(lien.destinataire).toBe('titulaire@exemple.cd');
    expect(lien.origine).toBe(ORIGINE_DEVERROUILLAGE_COMPTE);
    const jeton = decodeURIComponent(/jeton=([^\s]+)/.exec(lien.corps)![1]);
    // L'empreinte seule est gardée, et le corps conservé n'a pas le jeton.
    expect(m.u.empreinteDeverrouillage).toBe(empreinteDuJeton(jeton));
    expect(lien.corpsGarde).not.toContain(jeton);
    // Même verrou, nouvel essai · aucun second lien.
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
  });

  it('un mot de passe faux pendant le verrou n’envoie rien et ne compte rien', async () => {
    const m = await monde(FERME());
    await expect(m.s.login(connexion('faux'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.envoyes).toHaveLength(0);
    expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE);
  });

  it('sans messagerie (sur site), rien ne part, et le verrou attend l’administrateur', async () => {
    const m = await monde(FERME(), { messagerie: false });
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.courrier.envoyerUnSecret).not.toHaveBeenCalled();
    expect(m.u.empreinteDeverrouillage).toBeNull();
  });

  it('le lien rouvre le compte une fois, et une seconde fois il est refusé', async () => {
    const m = await monde(FERME());
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    const jeton = decodeURIComponent(/jeton=([^\s]+)/.exec(m.envoyes[0].corps)![1]);
    await expect(m.s.deverrouillerParLien(jeton)).resolves.toEqual({ deverrouille: true });
    expect(m.u).toMatchObject({ tentativesEchouees: 0, verrouilleJusqua: null, empreinteDeverrouillage: null });
    await expect(m.s.deverrouillerParLien(jeton)).rejects.toThrow(MOTIF_LIEN_DEVERROUILLAGE_INVALIDE);
    // Et le titulaire entre.
    await expect(m.s.login(connexion('bon-mot-de-passe'))).resolves.toHaveProperty('accessToken');
  });

  it('un lien échu ou inconnu reçoit la même phrase', async () => {
    const m = await monde({ empreinteDeverrouillage: empreinteDuJeton('x'.repeat(43)), deverrouillageExpireLe: new Date(Date.now() - 1000) });
    await expect(m.s.deverrouillerParLien('x'.repeat(43))).rejects.toThrow(MOTIF_LIEN_DEVERROUILLAGE_INVALIDE);
    await expect(m.s.deverrouillerParLien('y'.repeat(43))).rejects.toThrow(MOTIF_LIEN_DEVERROUILLAGE_INVALIDE);
  });

  describe('(a) le second facteur ouvre malgré le verrou', () => {
    const DOUBLE = () => ({ ...FERME(), secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') });

    it('bon mot de passe ET code valide · il entre, et le compteur tombe', async () => {
      const m = await monde(DOUBLE());
      await expect(m.s.login(connexion('bon-mot-de-passe', { code: codeA(new Date()) }))).resolves.toHaveProperty('accessToken');
      expect(m.u).toMatchObject({ tentativesEchouees: 0, verrouilleJusqua: null });
    });

    it('sans code, ni demande de code ni session · la réponse commune (elle ne dit pas le mot de passe juste)', async () => {
      const m = await monde(DOUBLE());
      await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    });

    it('code faux · réponse commune, l’échec compté APRÈS la réponse', async () => {
      const m = await monde(DOUBLE());
      await expect(m.s.login(connexion('bon-mot-de-passe', { code: '000000' }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
      expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE);
      await enAttente();
      expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE + 1);
    });

    it('mot de passe faux et code valide · rien', async () => {
      const m = await monde(DOUBLE());
      await expect(m.s.login(connexion('faux', { code: codeA(new Date()) }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
      expect(m.u.verrouilleJusqua).not.toBeNull();
    });
  });
});

describe('(2) la limite par adresse e-mail', () => {
  it('au-delà de la limite, 429 SANS bcrypt', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    const connu = await monde({}, { essais: LIMITE_ESSAIS_PAR_ADRESSE + 1 });
    const r1 = await connu.s.login(connexion('bon-mot-de-passe')).catch((e) => e);
    expect(r1.getStatus()).toBe(429);
    expect(r1.message).toBe(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
    expect(compare).not.toHaveBeenCalled();
    compare.mockRestore();
  });

  it('l’appareil reconnu du titulaire passe la limite · le verrou et le mot de passe restent jugés', async () => {
    const m = await monde({}, { essais: LIMITE_ESSAIS_PAR_ADRESSE + 1 });
    const appareil = jetonAppareil('u1', process.env.JWT_SECRET!, new Date());
    await expect(m.s.login(connexion('bon-mot-de-passe', { appareil }))).resolves.toHaveProperty('accessToken');
    await expect(m.s.login(connexion('faux', { appareil }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    // Le jeton d'un AUTRE compte ne dispense de rien.
    const autre = jetonAppareil('u2', process.env.JWT_SECRET!, new Date());
    await expect(m.s.login(connexion('bon-mot-de-passe', { appareil: autre }))).rejects.toThrow(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
  });

  it('la connexion réussie rend le jeton d’appareil, la demande de code non', async () => {
    const m = await monde();
    const r = (await m.s.login(connexion('bon-mot-de-passe'))) as { appareil?: string };
    expect(appareilReconnu(r.appareil, 'u1', process.env.JWT_SECRET!, new Date())).toBe(true);
    const d = await monde({ secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') });
    expect(await d.s.login(connexion('bon-mot-de-passe'))).toEqual({ deuxiemeFacteurRequis: true });
  });

  it('chaque essai est compté, adresse connue ou non', async () => {
    const m = await monde();
    await m.s.login(connexion('bon-mot-de-passe'));
    await m.s.login(connexion('faux')).catch(() => undefined);
    expect(m.limite.requetes).toBe(2);
  });
});

describe('limite-par-adresse · règles pures', () => {
  const S = 'secret-de-test-assez-long-0123456789abcdef';
  const T = new Date('2026-11-20T10:00:00Z');

  it('l’adresse ne se garde qu’en HMAC, qui change avec le secret', () => {
    expect(empreinteAdresse('a@b.cd', S)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteAdresse('a@b.cd', S)).not.toContain('a@b.cd');
    expect(empreinteAdresse('a@b.cd', S)).not.toBe(empreinteAdresse('a@b.cd', `${S}x`));
  });

  it('dix essais passent, le onzième est freiné', () => {
    expect(auDelaDeLaLimite(LIMITE_ESSAIS_PAR_ADRESSE)).toBe(false);
    expect(auDelaDeLaLimite(LIMITE_ESSAIS_PAR_ADRESSE + 1)).toBe(true);
  });

  it('le jeton d’appareil · compte, signature et âge', () => {
    const j = jetonAppareil('c1', S, T);
    expect(appareilReconnu(j, 'c1', S, T)).toBe(true);
    expect(appareilReconnu(j, 'c2', S, T)).toBe(false);
    expect(appareilReconnu(j, 'c1', `${S}x`, T)).toBe(false);
    expect(appareilReconnu(`${j.slice(0, -2)}AA`, 'c1', S, T)).toBe(false);
    expect(appareilReconnu(j, 'c1', S, new Date(T.getTime() + (JOURS_JETON_APPAREIL + 1) * 86_400_000))).toBe(false);
    expect(appareilReconnu(undefined, 'c1', S, T)).toBe(false);
    expect(appareilReconnu('a.b', 'c1', S, T)).toBe(false);
  });
});
