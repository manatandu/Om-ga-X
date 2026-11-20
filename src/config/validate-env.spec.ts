import { LONGUEUR_MINIMALE_JWT_SECRET, motifSecretFaible, validateEnv, VALEURS_CONNUES_JWT_SECRET } from './validate-env';

/**
 * UN SECRET DE SESSION FAIBLE NE DÉMARRE PAS EN PRODUCTION (audit de sécurité
 * du 2026-11-19, constat `omegax-auth-secret-jwt-faible-seulement-averti`).
 * Jusque-là, `change-me` ou un secret de dix caractères démarraient avec un
 * simple avertissement · quiconque le devinait signait une session pour
 * n'importe quel utilisateur de n'importe quel dossier.
 */
describe('validate-env · le secret de session', () => {
  const fort = 'x'.repeat(LONGUEUR_MINIMALE_JWT_SECRET);
  let avertir: jest.SpyInstance;
  beforeEach(() => {
    avertir = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => avertir.mockRestore());

  it.each([
    ['court', 'abc'.repeat(5)],
    ['connu', 'change-me'],
    ['connu (développement)', 'dev-secret-change-me'],
    ['à un caractère du seuil', 'y'.repeat(LONGUEUR_MINIMALE_JWT_SECRET - 1)],
  ])('refuse en production un secret %s, sans jamais citer la valeur', (_cas, secret) => {
    let message = '';
    try {
      validateEnv({ JWT_SECRET: secret, NODE_ENV: 'production' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/JWT_SECRET refusé en production/);
    // Les valeurs connues sont publiques et la règle les nomme ; un secret
    // quelconque, lui, ne paraît jamais.
    if (!VALEURS_CONNUES_JWT_SECRET.includes(secret)) expect(message).not.toContain(secret);
    // Ni la longueur exacte · un indice sur la valeur reste un indice.
    expect(message).not.toContain(String(secret.length));
  });

  it('refuse un secret absent, en production comme ailleurs', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/obligatoire/);
    expect(() => validateEnv({ JWT_SECRET: '   ' })).toThrow(/obligatoire/);
  });

  it('admet un secret de trente-deux caractères ou plus en production', () => {
    expect(() => validateEnv({ JWT_SECRET: fort, NODE_ENV: 'production' })).not.toThrow();
    expect(avertir).not.toHaveBeenCalled();
  });

  it('hors production, un secret faible ne fait qu’avertir (postes de développement, tests)', () => {
    expect(() => validateEnv({ JWT_SECRET: 'change-me' })).not.toThrow();
    expect(() => validateEnv({ JWT_SECRET: 'court', NODE_ENV: 'test' })).not.toThrow();
    expect(avertir).toHaveBeenCalledTimes(2);
  });

  it('nomme le motif sans la valeur', () => {
    expect(motifSecretFaible(undefined)).toBe('absent');
    expect(motifSecretFaible('change-me')).toBe('valeur de développement connue');
    expect(motifSecretFaible('court')).toBe(`moins de ${LONGUEUR_MINIMALE_JWT_SECRET} caractères`);
    expect(motifSecretFaible(fort)).toBeNull();
    expect(VALEURS_CONNUES_JWT_SECRET).toEqual(['change-me', 'dev-secret-change-me']);
  });
});
