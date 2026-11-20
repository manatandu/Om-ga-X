import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { base32, codeHotp, depuisBase32, pasDe } from './double-authentification';
import {
  CODES_FAUX_PAR_PERIODE_DE_VERROU,
  codeJugeableSousVerrou,
  codesFauxDeLaPeriode,
  MOTIF_IDENTIFIANTS_INVALIDES,
  SEUIL_VERROUILLAGE,
} from './verrouillage';
import {
  envoiPeutEtreParti,
  MOTIF_LIEN_DEVERROUILLAGE_INVALIDE,
  motifSansLienDeDeverrouillage,
  ORIGINE_DEVERROUILLAGE_COMPTE,
} from './deverrouillage';
import { empreinteDuJeton } from './compte-de-connexion';
import {
  appareilReconnu,
  auDelaDeLaLimite,
  empreinteAdresse,
  jetonAppareil,
  JOURS_JETON_APPAREIL,
  LIMITE_ESSAIS_PAR_ADRESSE,
  MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE,
  secretDeSession,
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

async function monde(etat: Record<string, unknown> = {}, options: { messagerie?: boolean; essais?: number; relu?: Record<string, unknown> } = {}) {
  const u: Record<string, unknown> = {
    id: 'u1', tenantId: 't1', email: 'titulaire@exemple.cd', estActif: true, estOperateurPlateforme: false,
    motDePasse: await bcrypt.hash('bon-mot-de-passe', 4),
    tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null,
    secretDoubleAuth: null, doubleAuthActiveDepuis: null, dernierPasDoubleAuth: null, codesSecoursDoubleAuth: [],
    empreinteDeverrouillage: null, deverrouillageExpireLe: null, deverrouillageEnvoyePour: null,
    sessionsFermees: [],
    ...etat,
  };
  const limite = { essais: options.essais ?? 1, requetes: 0, insertions: 0 };
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
        if (texte.includes('INSERT')) limite.insertions += 1;
        return [{ n: limite.essais }];
      }
      // La relecture sous verrou peut voir un état que la lecture du début de
      // la requête ne voyait pas (requêtes simultanées, décision B).
      if (texte.includes('FOR UPDATE') && options.relu) Object.assign(u, options.relu);
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
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!correspond(where)) return { count: 0 };
        ecritures.push(data);
        Object.assign(u, data);
        return { count: 1 };
      }),
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
  return { s, u, envoyes, ecritures, limite, courrier, client };
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

describe('(2) la limite par adresse e-mail · le bon mot de passe passe encore (relecture du 2026-11-20, C)', () => {
  const AU_DELA = { essais: LIMITE_ESSAIS_PAR_ADRESSE + 1 };

  it('au-delà, un mot de passe FAUX · 429 après bcrypt, et l’échec compte au verrou du compte', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    const m = await monde({}, AU_DELA);
    const r = await m.s.login(connexion('faux')).catch((e) => e);
    expect(r.getStatus()).toBe(429);
    expect(r.message).toBe(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
    expect(compare).toHaveBeenCalled();
    expect(m.u.tentativesEchouees).toBe(1);
    compare.mockRestore();
  });

  it('au-delà, une adresse INCONNUE · bcrypt (empreinte factice) puis le même 429', async () => {
    const m = await monde({}, AU_DELA);
    (m.client.user as { findUnique: unknown }).findUnique = async () => null;
    const compare = jest.spyOn(bcrypt, 'compare');
    const r = await m.s.login(connexion('bon-mot-de-passe')).catch((e) => e);
    expect(compare).toHaveBeenCalledTimes(1);
    expect([r.getStatus(), r.message]).toEqual([429, MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE]);
    compare.mockRestore();
  });

  it('au-delà, le BON mot de passe d’un compte ouvert entre, sur un appareil jamais reconnu', async () => {
    const m = await monde({}, AU_DELA);
    await expect(m.s.login(connexion('bon-mot-de-passe'))).resolves.toHaveProperty('accessToken');
  });

  it('au-delà, le BON mot de passe d’un compte FERMÉ reçoit exactement le 429 du faux, et le lien part après la réponse', async () => {
    const m = await monde(FERME(), AU_DELA);
    const bon = await m.s.login(connexion('bon-mot-de-passe')).catch((e) => e);
    // Rien n'est parti pendant la requête.
    expect(m.envoyes).toHaveLength(0);
    const faux = await m.s.login(connexion('faux')).catch((e) => e);
    expect([bon.getStatus(), bon.message]).toEqual([faux.getStatus(), faux.message]);
    expect(bon.getStatus()).toBe(429);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
    // Un essai pendant le verrou ne compte pas, même au-delà de la limite.
    expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE);
  });

  it('au-delà, un compte fermé à double authentification · le code n’est pas jugé, le 429 reste le même', async () => {
    const m = await monde({ ...FERME(), secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') }, AU_DELA);
    const r = await m.s.login(connexion('bon-mot-de-passe', { code: codeA(new Date()) })).catch((e) => e);
    expect([r.getStatus(), r.message]).toEqual([429, MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE]);
    expect(m.u.verrouilleJusqua).not.toBeNull();
  });

  it('l’appareil reconnu passe la limite · le verrou et le mot de passe restent jugés', async () => {
    const m = await monde({}, AU_DELA);
    const appareil = jetonAppareil('u1', process.env.JWT_SECRET!, new Date());
    await expect(m.s.login(connexion('faux', { appareil }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    // Le jeton d'un AUTRE compte ne dispense de rien.
    const autre = jetonAppareil('u2', process.env.JWT_SECRET!, new Date());
    await expect(m.s.login(connexion('faux', { appareil: autre }))).rejects.toThrow(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
  });

  it('un jeton d’appareil émis avant la dernière révocation des sessions ne vaut plus (mot de passe changé, autres appareils)', async () => {
    const emis = new Date(Date.now() - 60_000);
    const appareil = jetonAppareil('u1', process.env.JWT_SECRET!, emis);
    const m = await monde({ sessionsInvalidesAvant: new Date() }, AU_DELA);
    await expect(m.s.login(connexion('faux', { appareil }))).rejects.toThrow(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
    const d = await monde({ sessionsDuCompteInvalidesAvant: new Date() }, AU_DELA);
    await expect(d.s.login(connexion('faux', { appareil }))).rejects.toThrow(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE);
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
    expect(m.limite.insertions).toBe(2);
  });

  it('un compte à double authentification ne consomme qu’UN essai par connexion · l’appel qui porte le code relit sans compter', async () => {
    const m = await monde({ secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') });
    expect(await m.s.login(connexion('bon-mot-de-passe'))).toEqual({ deuxiemeFacteurRequis: true });
    await expect(m.s.login(connexion('bon-mot-de-passe', { code: codeA(new Date()) }))).resolves.toHaveProperty('accessToken');
    expect([m.limite.requetes, m.limite.insertions]).toEqual([2, 1]);
    // Un code joint à un mot de passe FAUX compte · sinon un code au hasard dispenserait de la limite.
    await m.s.login(connexion('faux', { code: '123456' })).catch(() => undefined);
    expect(m.limite.insertions).toBe(2);
  });

  it('second tour (BLOQUANT) · sur un compte FERMÉ, le comptage ne dépend pas du mot de passe · aucun oracle 401 / 429', async () => {
    // L'attaquant amène la fenêtre au seuil, joint un code au candidat, puis
    // envoie un faux connu · bon et faux candidat doivent laisser la MÊME
    // fenêtre, et donc la même réponse suivante.
    const AU_SEUIL = { essais: LIMITE_ESSAIS_PAR_ADRESSE };
    for (const etat of [FERME(), { ...FERME(), secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') }]) {
      const issues: unknown[] = [];
      for (const candidat of ['bon-mot-de-passe', 'autre-faux']) {
        const m = await monde(etat, AU_SEUIL);
        await m.s.login(connexion(candidat, { code: '1' })).catch(() => undefined);
        const suivante = await m.s.login(connexion('faux-connu')).catch((e) => e);
        issues.push([m.limite.insertions, suivante.getStatus(), suivante.message]);
      }
      // Les deux candidats remplissent la fenêtre de la même façon (deux
      // essais comptés), donc la réponse suivante ne peut pas les départager.
      expect(issues[0]).toEqual(issues[1]);
      expect((issues[0] as unknown[])[0]).toBe(2);
    }
  });

  it('le 429 ne promet aucune durée', () => {
    expect(MOTIF_TROP_D_ESSAIS_SUR_L_ADRESSE).not.toMatch(/minutes? avant|patientez/i);
  });
});

describe('(A) le code de double authentification pendant le verrou (relecture du 2026-11-20)', () => {
  const DOUBLE = () => ({ ...FERME(), secretDoubleAuth: SECRET_TOTP, doubleAuthActiveDepuis: new Date('2026-01-01T00:00:00Z') });

  it('un code FAUX avec le bon mot de passe pendant le verrou · le lien de déverrouillage PART bien (réservé avant de compter)', async () => {
    const m = await monde(DOUBLE());
    await expect(m.s.login(connexion('bon-mot-de-passe', { code: '000000' }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    expect(m.envoyes).toHaveLength(0);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
    expect(m.envoyes[0].origine).toBe(ORIGINE_DEVERROUILLAGE_COMPTE);
    // Le code faux a prolongé le verrou · le lien parti reste celui de la période.
    expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE + 1);
    expect((m.u.deverrouillageEnvoyePour as Date).getTime()).toBe((m.u.verrouilleJusqua as Date).getTime());
    // Un second code faux, prolongation comprise · aucun second lien.
    await expect(m.s.login(connexion('bon-mot-de-passe', { code: '000001' }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
  });

  it(`au plus ${CODES_FAUX_PAR_PERIODE_DE_VERROU} codes faux par période · au-delà, même le bon code n’est plus jugé jusqu’à l’échéance`, async () => {
    const m = await monde(DOUBLE());
    for (let i = 0; i < CODES_FAUX_PAR_PERIODE_DE_VERROU; i += 1) {
      await expect(m.s.login(connexion('bon-mot-de-passe', { code: `00000${i}` }))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
      await enAttente();
    }
    expect(m.u.codesFauxSousVerrou).toBe(CODES_FAUX_PAR_PERIODE_DE_VERROU);
    const tentatives = m.u.tentativesEchouees;
    const r = await m.s.login(connexion('bon-mot-de-passe', { code: codeA(new Date()) })).catch((e) => e);
    expect([r.getStatus(), r.message]).toEqual([401, MOTIF_IDENTIFIANTS_INVALIDES]);
    await enAttente();
    // Non jugé, donc non compté · le verrou n'est plus prolongé.
    expect(m.u.tentativesEchouees).toBe(tentatives);
    // L'échéance passée, le bon code ouvre, et tout tombe.
    m.u.verrouilleJusqua = new Date(Date.now() - 1000);
    await expect(m.s.login(connexion('bon-mot-de-passe', { code: codeA(new Date()) }))).resolves.toHaveProperty('accessToken');
    expect(m.u).toMatchObject({ tentativesEchouees: 0, codesFauxSousVerrou: 0, verrouilleJusqua: null, empreinteDeverrouillage: null });
  });

  it('une nouvelle période de verrou repart avec son propre budget', () => {
    const ancien = new Date('2026-11-20T10:00:00Z');
    const u = { verrouilleJusqua: new Date('2026-11-20T11:00:00Z'), codesFauxSousVerrou: 5, codesFauxSousVerrouPour: ancien };
    expect(codesFauxDeLaPeriode(u)).toBe(0);
    expect(codeJugeableSousVerrou(u)).toBe(true);
    expect(codeJugeableSousVerrou({ ...u, codesFauxSousVerrouPour: u.verrouilleJusqua })).toBe(false);
  });
});

describe('(B) le verrou se relit sous verrou avant d’accepter le bon mot de passe', () => {
  it('à la connexion · lu ouvert au début de la requête, fermé à la relecture · la réponse commune, et le lien', async () => {
    const m = await monde({}, { relu: FERME() });
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
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

describe('relecture « échecs silencieux » · le lien de déverrouillage', () => {
  it('un échec APRÈS l’envoi (trace en file) ne libère pas la place · le lien reçu reste valable', async () => {
    const m = await monde(FERME());
    m.courrier.envoyerUnSecret.mockImplementationOnce(async () => {
      throw new Error('écriture de la file impossible');
    });
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
    await enAttente();
    expect(m.u.empreinteDeverrouillage).not.toBeNull();
  });

  it('un transport qui refuse net (connexion refusée) libère la place · la connexion suivante réessaie', async () => {
    const { ServiceUnavailableException } = await import('@nestjs/common');
    const m = await monde(FERME());
    m.courrier.envoyerUnSecret.mockImplementationOnce(async () => {
      throw new ServiceUnavailableException("Le courriel n'est pas parti · Error · connect ECONNREFUSED 127.0.0.1:25.");
    });
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    expect(m.u.empreinteDeverrouillage).toBeNull();
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    expect(m.envoyes).toHaveLength(1);
  });

  it('un délai dépassé qu’on ne sait pas situer GARDE la place · le titulaire a peut-être reçu le lien', async () => {
    const { ServiceUnavailableException } = await import('@nestjs/common');
    const m = await monde(FERME());
    m.courrier.envoyerUnSecret.mockImplementationOnce(async () => {
      throw new ServiceUnavailableException("Le courriel n'est pas parti · Error · Connection timeout.");
    });
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    expect(m.u.empreinteDeverrouillage).not.toBeNull();
  });

  it('le tri des erreurs · avant l’envoi ou refus net, rien n’est parti ; le reste, peut-être', async () => {
    const { BadRequestException, ConflictException, ServiceUnavailableException } = await import('@nestjs/common');
    expect(envoiPeutEtreParti(new BadRequestException('Adresse de destinataire inutilisable'))).toBe(false);
    expect(envoiPeutEtreParti(new ConflictException('Aucune messagerie'))).toBe(false);
    expect(envoiPeutEtreParti(new ServiceUnavailableException('550 5.1.1 recipient rejected'))).toBe(false);
    expect(envoiPeutEtreParti(new ServiceUnavailableException('Invalid login: 535 auth failed'))).toBe(false);
    expect(envoiPeutEtreParti(new ServiceUnavailableException('Greeting never received · ETIMEDOUT'))).toBe(true);
    expect(envoiPeutEtreParti(new Error('P1001 base injoignable'))).toBe(true);
  });

  it('une réservation qui ne trouve rien à faire le dit (journal), sans rien écrire', () => {
    const maintenant = new Date('2026-11-20T10:00:00Z');
    const verrou = new Date('2026-11-20T10:30:00Z');
    expect(motifSansLienDeDeverrouillage(null, maintenant)).toBe('compte introuvable');
    expect(motifSansLienDeDeverrouillage({ verrouilleJusqua: null, deverrouillageEnvoyePour: null }, maintenant)).toMatch(/rouvert/);
    expect(motifSansLienDeDeverrouillage({ verrouilleJusqua: verrou, deverrouillageEnvoyePour: new Date(verrou) }, maintenant)).toMatch(/déjà parti/);
    expect(motifSansLienDeDeverrouillage({ verrouilleJusqua: verrou, deverrouillageEnvoyePour: null }, maintenant)).toBeNull();
  });
});

describe('(D) le lien s’écrit par des mises à jour UNITAIRES, jamais par updateMany', () => {
  it('réservation, levée par le lien · aucun updateMany (le journal d’audit n’en garderait que le filtre)', async () => {
    const m = await monde(FERME());
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    const jeton = decodeURIComponent(/jeton=([^\s]+)/.exec(m.envoyes[0].corps)![1]);
    await m.s.deverrouillerParLien(jeton);
    expect((m.client.user as { updateMany: jest.Mock }).updateMany).not.toHaveBeenCalled();
  });

  it('sur site, aucun lien ne part · l’administrateur déverrouille', async () => {
    const avant = process.env.MODE_INSTALLATION;
    process.env.MODE_INSTALLATION = 'SUR_SITE';
    try {
      const m = await monde(FERME());
      await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow(MOTIF_IDENTIFIANTS_INVALIDES);
      await enAttente();
      expect(m.courrier.envoyerUnSecret).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env.MODE_INSTALLATION;
      else process.env.MODE_INSTALLATION = avant;
    }
  });
});

describe('le secret de session est exigé', () => {
  it('absent, l’empreinte ne se calcule pas · aucune clé vide', () => {
    const avant = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => secretDeSession()).toThrow(/JWT_SECRET absent/);
    } finally {
      process.env.JWT_SECRET = avant;
    }
  });
});

describe('(C2) le compte rouvert repart d’une fenêtre d’essais vide', () => {
  const effacements = (client: { $executeRaw: jest.Mock }) =>
    client.$executeRaw.mock.calls.filter(([q]) => String((q as { sql?: string }).sql ?? q).includes('DELETE FROM "essais_connexion_adresse" WHERE "empreinte"'));

  it('le déverrouillage par l’administrateur vide la fenêtre de l’adresse du compte', async () => {
    const { UtilisateurService } = await import('../utilisateurs/utilisateur.service');
    const client: Record<string, unknown> = {
      $executeRaw: jest.fn(async () => 1),
      $queryRaw: async () => [],
      user: {
        count: async () => 0,
        findFirst: async () => ({ id: 'u2', tenantId: 'd1', email: 'comptable@cabinet.cd', courrielDeConnexion: 'comptable@cabinet.cd', compteDeConnexionId: null }),
        update: async () => ({ id: 'u2' }),
      },
    };
    client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
    await new UtilisateurService(client as never).deverrouiller('d1', 'u2');
    const appels = effacements(client as { $executeRaw: jest.Mock });
    expect(appels).toHaveLength(1);
    expect((appels[0][0] as { values: unknown[] }).values).toEqual([empreinteAdresse('comptable@cabinet.cd', process.env.JWT_SECRET!)]);
  });

  it('le lien du titulaire vide la fenêtre aussi', async () => {
    const m = await monde(FERME());
    m.client.$executeRaw = jest.fn(async () => 1);
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    const jeton = decodeURIComponent(/jeton=([^\s]+)/.exec(m.envoyes[0].corps)![1]);
    await m.s.deverrouillerParLien(jeton);
    expect(effacements(m.client as { $executeRaw: jest.Mock })).toHaveLength(1);
  });

  it('un échec de l’effacement ne dit pas le contraire de ce qui est fait · consigné, le compte reste rouvert', async () => {
    const m = await monde(FERME());
    await expect(m.s.login(connexion('bon-mot-de-passe'))).rejects.toThrow();
    await enAttente();
    m.client.$executeRaw = async (q: { sql?: string }) => {
      if (String(q.sql ?? q).includes('DELETE')) throw new Error('base indisponible');
      return 1;
    };
    const jeton = decodeURIComponent(/jeton=([^\s]+)/.exec(m.envoyes[0].corps)![1]);
    await expect(m.s.deverrouillerParLien(jeton)).resolves.toEqual({ deverrouille: true });
  });
});
