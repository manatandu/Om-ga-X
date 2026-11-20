import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { MOTIF_MOT_DE_PASSE_ACTUEL_INCORRECT, SEUIL_VERROUILLAGE } from './verrouillage';

/**
 * LE MOT DE PASSE ACTUEL COMPTE SES ÉCHECS (audit de sécurité du 2026-11-19,
 * constat `omegax-auth-mot-de-passe-actuel-hors-verrou`). Le porteur d'une
 * session volée devinait le mot de passe actuel à vingt essais par minute
 * sans jamais armer le verrou, puis changeait le mot de passe et fermait les
 * sessions du titulaire. Les six gestes qui l'exigent passent par le MÊME
 * compteur que la connexion ; un compte fermé refuse le geste, et le dit.
 */
const MAINTENANT = new Date('2026-11-20T10:00:00Z');

async function monde(etat: Record<string, unknown> = {}, relu: Record<string, unknown> | null = null) {
  const u: Record<string, unknown> = {
    id: 'u1', tenantId: 't1', email: 'titulaire@exemple.cd', estActif: true, estOperateurPlateforme: false,
    motDePasse: await bcrypt.hash('bon-mot-de-passe', 4),
    tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null,
    secretDoubleAuth: null, doubleAuthActiveDepuis: null, dernierPasDoubleAuth: null, codesSecoursDoubleAuth: [],
    sessionsFermees: [],
    ...etat,
  };
  const client: Record<string, unknown> = {
    $executeRaw: async () => 1,
    // La relecture sous verrou rend la ligne TELLE QU'ELLE EST, compteur compris.
    // `relu` · ce que des requêtes simultanées ont écrit entre la lecture du
    // début de la requête et la relecture sous verrou (décision B).
    $queryRaw: async () => [{ ...u, ...(relu ?? {}) }],
    user: {
      findUnique: async () => ({ ...u }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(u, data);
        return {};
      },
    },
  };
  client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);
  const none = undefined as never;
  const s = new AuthService(client as never, { sign: () => 'jeton' } as never, none, none, none, none, none, none, none, none);
  return { s, u };
}

const gestes: [string, (s: AuthService, mot: string) => Promise<unknown>][] = [
  ['changer le mot de passe', (s, mot) => s.changerMotDePasse('u1', mot, 'nouveau-mot-de-passe-long')],
  ['changer l’adresse', (s, mot) => s.changerAdresse('u1', mot, 'nouvelle@exemple.cd', null, true)],
  ['déconnecter les autres appareils', (s, mot) => s.deconnecterAutresAppareils('u1', mot, null, MAINTENANT)],
];

describe('le mot de passe actuel passe par le verrou de connexion', () => {
  it.each(gestes)('%s · un mot de passe faux compte un échec', async (_nom, geste) => {
    const m = await monde();
    await expect(geste(m.s, 'faux')).rejects.toThrow(MOTIF_MOT_DE_PASSE_ACTUEL_INCORRECT);
    expect(m.u.tentativesEchouees).toBe(1);
  });

  it.each(gestes)('%s · le cinquième échec ferme le compte, et le message le dit sans éjecter la session', async (_nom, geste) => {
    const m = await monde({ tentativesEchouees: SEUIL_VERROUILLAGE - 1, dernierEchecLe: new Date(Date.now() - 60_000) });
    await expect(geste(m.s, 'faux')).rejects.toThrow(/compte est fermé.*session en cours reste ouverte/);
    expect(m.u.verrouilleJusqua).toBeInstanceOf(Date);
  });

  it.each(gestes)('%s · compte fermé, le BON mot de passe est refusé, sans prolonger le verrou', async (_nom, geste) => {
    const jusqua = new Date(Date.now() + 10 * 60_000);
    const m = await monde({ tentativesEchouees: SEUIL_VERROUILLAGE, verrouilleJusqua: jusqua, dernierEchecLe: new Date() });
    await expect(geste(m.s, 'bon-mot-de-passe')).rejects.toThrow(/compte est fermé/);
    expect(m.u.tentativesEchouees).toBe(SEUIL_VERROUILLAGE);
    expect(m.u.verrouilleJusqua).toBe(jusqua);
  });

  it('retirer la double authentification · un code faux compte aussi', async () => {
    const m = await monde({ secretDoubleAuth: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', doubleAuthActiveDepuis: MAINTENANT });
    await expect(m.s.desactiverDoubleAuth('u1', 'bon-mot-de-passe', '000000', MAINTENANT)).rejects.toThrow(/Code de vérification invalide/);
    expect(m.u.tentativesEchouees).toBe(1);
  });

  // DÉCISION B (relecture du 2026-11-20) · la ligne lue au début de la requête
  // disait « ouvert » pendant que des requêtes simultanées, mots de passe
  // faux, fermaient le compte · le bon mot de passe, arrivé dans la rafale,
  // passait. Le verrou se relit sous `FOR UPDATE` avant d'accepter.
  it.each(gestes)('%s · lu ouvert, FERMÉ à la relecture sous verrou · le bon mot de passe est refusé', async (_nom, geste) => {
    const jusqua = new Date(Date.now() + 10 * 60_000);
    const m = await monde({}, { tentativesEchouees: SEUIL_VERROUILLAGE, verrouilleJusqua: jusqua, dernierEchecLe: new Date() });
    await expect(geste(m.s, 'bon-mot-de-passe')).rejects.toThrow(/compte est fermé/);
  });
});
