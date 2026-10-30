import { readFileSync } from 'fs';
import { join } from 'path';
import { COLONNES_EXCLUES_PAR_MODELE } from '../../common/audit/champs-audites';
import { empreinteSession } from '../auth/sessions-fermees';
import { motifRefusEnvoi } from './messagerie';
import { MessagerieService } from './messagerie.service';
import { estConnectee, noterPresence, oublierLeRythme, resumeAppareil, sessionEncoreOuverte } from './presence';

describe('la présence · ni jeton, ni empreinte du navigateur (Code du numérique, art. 194)', () => {
  it("résume l'appareil en navigateur et système, jamais la chaîne entière", () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
    expect(resumeAppareil(ua)).toBe('Chrome · Windows');
    expect(resumeAppareil('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
    expect(resumeAppareil(undefined)).toBeNull();
    expect(resumeAppareil('curl/8.0')).toBe('Autre appareil');
  });

  it('connectée en deçà d’un quart d’heure', () => {
    const t = new Date('2026-10-30T10:00:00Z');
    expect(estConnectee(new Date('2026-10-30T09:50:00Z'), t)).toBe(true);
    expect(estConnectee(new Date('2026-10-30T09:40:00Z'), t)).toBe(false);
  });

  const presence = (autres: Partial<Parameters<typeof sessionEncoreOuverte>[0]> = {}) => ({
    empreinteSession: 'abc',
    ouverteLe: new Date('2026-10-30T08:00:00Z'),
    authentifieeLe: new Date('2026-10-30T08:00:00Z'),
    derniereActiviteLe: new Date('2026-10-30T09:55:00Z'),
    fermeeLe: null,
    user: { estActif: true, sessionsInvalidesAvant: null, sessionsFermees: [] },
    ...autres,
  });
  const maintenant = new Date('2026-10-30T10:00:00Z');

  it('une session déconnectée, révoquée ou d’un compte désactivé ne se montre pas', () => {
    expect(sessionEncoreOuverte(presence(), maintenant)).toBe(true);
    expect(sessionEncoreOuverte(presence({ fermeeLe: maintenant }), maintenant)).toBe(false);
    expect(sessionEncoreOuverte(presence({ user: { estActif: false, sessionsInvalidesAvant: null, sessionsFermees: [] } }), maintenant)).toBe(false);
    expect(
      sessionEncoreOuverte(presence({ user: { estActif: true, sessionsInvalidesAvant: new Date('2026-10-30T09:00:00Z'), sessionsFermees: [] } }), maintenant),
    ).toBe(false);
    expect(
      sessionEncoreOuverte(
        presence({ user: { estActif: true, sessionsInvalidesAvant: null, sessionsFermees: [{ e: 'abc', f: maintenant.getTime() / 1000 + 3600 }] } }),
        maintenant,
      ),
    ).toBe(false);
  });

  it("s'écrit au plus une fois par minute, par l'empreinte de la session, et un échec ne lève rien", async () => {
    oublierLeRythme();
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn().mockResolvedValue({});
    const client = { presenceSession: { updateMany, create } } as never;
    const p = { tenantId: 't1', userId: 'u1', csrf: 'jeton-csrf', origineS: 1_700_000_000, authentificationS: 1_700_000_000, longue: false, userAgent: 'Firefox/130 (X11; Linux)' };
    await noterPresence(client, p, 1_000_000);
    expect(noterPresence(client, p, 1_030_000)).toBeNull();
    await noterPresence(client, p, 1_070_000);
    expect(updateMany).toHaveBeenCalledTimes(2);
    const donnees = create.mock.calls[0][0].data;
    expect(donnees.empreinteSession).toBe(empreinteSession('jeton-csrf'));
    expect(JSON.stringify(create.mock.calls)).not.toContain('jeton-csrf');
    expect(donnees.appareil).toBe('Firefox · Linux');
    const enPanne = { presenceSession: { updateMany: jest.fn().mockRejectedValue(new Error('base')), create } } as never;
    await expect(noterPresence(enPanne, { ...p, csrf: 'autre' }, 2_000_000)).resolves.toBeUndefined();
  });

  it('la fenêtre ne rend jamais l’empreinte de la session', () => {
    const source = readFileSync(join(__dirname, 'messagerie.service.ts'), 'utf8');
    const rendu = source.slice(source.indexOf('const sessions = ouvertes'), source.indexOf('return {\n      sessions'));
    expect(rendu).not.toMatch(/empreinte/);
  });
});

describe('la messagerie · un même dossier, une correspondance confidentielle', () => {
  it("refuse l'envoi vide, sans destinataire, ou à soi-même", () => {
    expect(motifRefusEnvoi({ objet: ' ', corps: 'x', destinataireIds: ['b'] }, 'a')).toMatch(/objet/);
    expect(motifRefusEnvoi({ objet: 'o', corps: '', destinataireIds: ['b'] }, 'a')).toMatch(/vide/);
    expect(motifRefusEnvoi({ objet: 'o', corps: 'x', destinataireIds: [] }, 'a')).toMatch(/destinataire/);
    expect(motifRefusEnvoi({ objet: 'o', corps: 'x', destinataireIds: ['a'] }, 'a')).toMatch(/vous-même/);
    expect(motifRefusEnvoi({ objet: 'o', corps: 'x', destinataireIds: ['b', 'b'] }, 'a')).toBeNull();
  });

  it("l'objet et le corps ne passent pas au journal d'audit (art. 193, 2°)", () => {
    expect(COLONNES_EXCLUES_PAR_MODELE.MessageInterne).toEqual(expect.arrayContaining(['objet', 'corps']));
  });

  it('un destinataire hors du dossier, ou désactivé, refuse l’envoi entier', async () => {
    const prisma = { user: { count: jest.fn().mockResolvedValue(1) } };
    const s = new MessagerieService(prisma as never);
    await expect(s.envoyer('t1', 'a', { objet: 'o', corps: 'x', destinataireIds: ['b', 'c'] })).rejects.toThrow(/utilisateur actif de ce dossier/);
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { tenantId: 't1', estActif: true, id: { in: ['b', 'c'] } } });
  });

  it("un message ne se lit que par son expéditeur ou un destinataire · la requête le porte", () => {
    const source = readFileSync(join(__dirname, 'messagerie.service.ts'), 'utf8');
    const lire = source.slice(source.indexOf('async lire('), source.indexOf('async marquerLu('));
    expect(lire).toMatch(/expediteurId: userId/);
    expect(lire).toMatch(/destinataires: \{ some: \{ destinataireId: userId/);
  });
});
