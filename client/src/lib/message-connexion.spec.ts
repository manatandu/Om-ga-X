import { readFileSync } from 'fs';
import { join } from 'path';
import { estRefusDIdentifiants, messageConnexion } from './message-connexion';

describe('le message d’une connexion qui échoue', () => {
  it('rend la cause, y compris celle d’une Error ordinaire', () => {
    expect(messageConnexion(new Error('Session ouverte mais aussitôt perdue · cookies tiers'))).toContain('cookies tiers');
    expect(messageConnexion(new TypeError('Load failed'))).toContain('ne répond pas');
    expect(messageConnexion('bizarre')).toBe('Une erreur est survenue');
  });
});

/**
 * LE CODE AJOUTÉ PAR LA PERSONNE (relecture du 2026-11-20, E2) · offert après
 * un refus d'identifiants seulement, retirable, et facultatif.
 */
describe('le code de double authentification ajouté après un refus', () => {
  it('un refus d’identifiants est un 401 ou un 429, jamais une panne réseau ni un 5xx', () => {
    const refus = (status: number) => Object.assign(new Error('refus'), { status });
    expect(estRefusDIdentifiants(refus(401))).toBe(true);
    expect(estRefusDIdentifiants(refus(429))).toBe(true);
    expect(estRefusDIdentifiants(refus(503))).toBe(false);
    expect(estRefusDIdentifiants(new TypeError('Load failed'))).toBe(false);
    expect(estRefusDIdentifiants(null)).toBe(false);
  });

  it('l’écran l’offre après un refus d’identifiants, le rend retirable, et ne l’exige que demandé par le serveur', () => {
    const page = readFileSync(join(__dirname, '..', 'pages', 'AuthPage.tsx'), 'utf8');
    expect(page).toContain('setRefusIdentifiants(estRefusDIdentifiants(err));');
    expect(page).toContain('{refusIdentifiants && !codeRequis && !codeAjoute && (');
    expect(page).not.toMatch(/\{erreur && !codeRequis && \(/);
    expect(page).toContain('Retirer le code');
    expect(page).toContain('required={codeRequis}');
  });
});
