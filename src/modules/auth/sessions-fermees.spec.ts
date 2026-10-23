import * as fs from 'fs';
import * as path from 'path';
import {
  ajouterSessionFermee,
  empreinteSession,
  estSessionFermee,
  finDeVie,
  lireSessionsFermees,
  PLAFOND_SESSIONS_FERMEES,
} from './sessions-fermees';
import { DUREE_MAXIMALE_SESSION_LONGUE_S } from './session-longue';
import { AuthController } from './auth.controller';
import { COOKIE_SESSION } from './session.constants';

/**
 * « Se déconnecter » ferme la session sur le serveur (relevé de sécurité du
 * 2026-10-23) · sondé sur une instance jetable, `/auth/me` répondait 200 avec
 * le cookie d'avant la déconnexion.
 */
describe('sessions fermées · le module pur', () => {
  const T = 1_800_000_000;

  it('ferme la session de CE jeton CSRF, pas une autre', () => {
    const { liste } = ajouterSessionFermee([], { e: empreinteSession('csrf-bureau'), f: T + 3600 }, T);
    expect(estSessionFermee(liste, 'csrf-bureau', T)).toBe(true);
    expect(estSessionFermee(liste, 'csrf-telephone', T)).toBe(false);
  });

  it("garde l'empreinte, jamais le jeton CSRF lui-même", () => {
    const { liste } = ajouterSessionFermee([], { e: empreinteSession('csrf-secret'), f: T + 1 }, T);
    expect(JSON.stringify(liste)).not.toContain('csrf-secret');
  });

  it("couvre la vie entière d'une session longue · une copie prolongée après la déconnexion reste fermée", () => {
    // Jeton présenté à la déconnexion · échéance dans sept jours. La copie
    // volée se prolonge à l'usage, jusqu'aux trente jours de l'origine.
    const origine = T;
    const f = finDeVie(origine, T + 7 * 86_400, true);
    expect(f).toBe(origine + DUREE_MAXIMALE_SESSION_LONGUE_S);
    const { liste } = ajouterSessionFermee([], { e: empreinteSession('c'), f }, T);
    expect(estSessionFermee(liste, 'c', T + 20 * 86_400)).toBe(true);
  });

  it('une session courte ne se prolonge pas · sa trace tombe à son échéance', () => {
    expect(finDeVie(T, T + 8 * 3600, false)).toBe(T + 8 * 3600);
  });

  it('une trace échue tombe à la prochaine écriture, un doublon ne se réécrit pas', () => {
    let { liste } = ajouterSessionFermee([], { e: 'a', f: T + 10 }, T);
    ({ liste } = ajouterSessionFermee(liste, { e: 'b', f: T + 100 }, T + 20));
    expect(liste.map((s) => s.e)).toEqual(['b']);
    ({ liste } = ajouterSessionFermee(liste, { e: 'b', f: T + 200 }, T + 20));
    expect(liste).toEqual([{ e: 'b', f: T + 200 }]);
  });

  it('au-delà du plafond, déborde · l’appelant ferme tout le compte', () => {
    const pleine = Array.from({ length: PLAFOND_SESSIONS_FERMEES }, (_, i) => ({ e: `e${i}`, f: T + 1000 }));
    const r = ajouterSessionFermee(pleine, { e: 'neuve', f: T + 1000 }, T);
    expect(r).toEqual({ liste: [{ e: 'neuve', f: T + 1000 }], debordement: true });
  });

  it('une colonne illisible ne ferme rien et ne casse rien', () => {
    expect(lireSessionsFermees(null)).toEqual([]);
    expect(lireSessionsFermees([{ e: 1 }, 'x', { e: 'ok', f: 5 }])).toEqual([{ e: 'ok', f: 5 }]);
    expect(estSessionFermee('nimporte', 'c', T)).toBe(false);
    expect(estSessionFermee([], undefined, T)).toBe(false);
  });
});

describe('la déconnexion appelle la fermeture, et dit son échec', () => {
  const reponse = () => {
    const appels: string[] = [];
    return { appels, res: { cookie: () => undefined, clearCookie: (n: string) => appels.push(n) } as never };
  };

  it('relit le jeton du cookie et rend sessionFermee', async () => {
    let jetonRecu: string | null = null;
    const controleur = new AuthController(
      { fermerLaSession: async (j: string | null) => ((jetonRecu = j), { fermee: true }) } as never,
      { get: () => undefined } as never,
    );
    const { appels, res } = reponse();
    const r = await controleur.logout(res, { cookies: { [COOKIE_SESSION]: 'jeton-du-poste' }, headers: {} } as never);
    expect(jetonRecu).toBe('jeton-du-poste');
    expect(r).toEqual({ deconnecte: true, sessionFermee: true });
    expect(appels).toContain(COOKIE_SESSION);
  });

  it("une base en panne n'empêche pas d'effacer le cookie, et la réponse ne prétend pas la session close", async () => {
    const controleur = new AuthController(
      {
        fermerLaSession: async () => {
          throw new Error('base injoignable');
        },
      } as never,
      { get: () => undefined } as never,
    );
    const { appels, res } = reponse();
    const r = await controleur.logout(res, { cookies: { [COOKIE_SESSION]: 'j' }, headers: {} } as never);
    expect(r).toEqual({ deconnecte: true, sessionFermee: false });
    expect(appels).toContain(COOKIE_SESSION);
  });
});

describe('JwtStrategy lit la liste sur le compte déjà chargé', () => {
  // Structure, pas distance (CLAUDE.md § 10) · le contrôle est dans `validate`,
  // après la révocation de tout le compte, et ne lance aucune requête de plus.
  const source = fs.readFileSync(path.join(__dirname, 'jwt.strategy.ts'), 'utf8');
  const corps = source.slice(source.indexOf('async validate('), source.indexOf('return {', source.indexOf('async validate(')));

  it('confronte le jeton CSRF du jeton à la liste du compte', () => {
    expect(corps).toContain('estSessionFermee(user.sessionsFermees, payload.csrf');
    expect(corps.match(/this\.prisma\./g)?.length).toBe(1);
  });
});
