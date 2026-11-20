import { readFileSync } from 'fs';
import { join } from 'path';
import { MESSAGE_SERVEUR_MUET, rouvrirLeCompte } from '../lib/deverrouillage';

// Pas d'import de « vitest » · convention du dépôt (voir calcul.spec.ts).

/**
 * LE LIEN DE DÉVERROUILLAGE S'OUVRE AU CLIC (relecture du 2026-11-20, E1) ·
 * aucun envoi au chargement (un aperçu de lien consommerait le jeton), un
 * échec dit et le bouton gardé, la demande abandonnée si la page se ferme.
 */
const source = readFileSync(join(__dirname, 'DeverrouillagePage.tsx'), 'utf8');
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('DeverrouillagePage', () => {
  it('aucun envoi au chargement · le seul effet abandonne la demande en route', () => {
    const effets = [...sansCommentaires.matchAll(/useEffect\(([\s\S]*?)\);\n/g)].map((m) => m[1]);
    expect(effets).toHaveLength(1);
    expect(effets[0]).not.toContain('post');
    expect(effets[0]).toContain('abort()');
  });

  it('le bouton « Rouvrir mon compte » envoie la demande, avec le signal d’abandon', () => {
    expect(sansCommentaires).toContain('Rouvrir mon compte');
    expect(sansCommentaires).toMatch(/onClick=\{\(\) => void rouvrir\(\)\}/);
    expect(sansCommentaires).toContain('api.post(chemin, corps, { signal })');
  });

  it('la page a son repère <main>', () => {
    expect(sansCommentaires).toContain('<main');
  });
});

describe('rouvrirLeCompte', () => {
  const signal = () => new AbortController().signal;

  it('rend ROUVERT quand le serveur lève le verrou, sur la bonne route', async () => {
    const appels: unknown[] = [];
    const r = await rouvrirLeCompte('j1', async (chemin, corps) => void appels.push([chemin, corps]), signal());
    expect(r).toEqual({ etat: 'ROUVERT' });
    expect(appels).toEqual([['/auth/deverrouiller', { jeton: 'j1' }]]);
  });

  it('un refus du serveur est dit avec son message, et l’essai peut être refait', async () => {
    let n = 0;
    const poster = async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('Lien de déverrouillage introuvable'), { status: 404 });
    };
    expect(await rouvrirLeCompte('j', poster, signal())).toEqual({ etat: 'ECHEC', message: 'Lien de déverrouillage introuvable' });
    expect(await rouvrirLeCompte('j', poster, signal())).toEqual({ etat: 'ROUVERT' });
  });

  it('une panne réseau se dit sans être prise pour un refus', async () => {
    const r = await rouvrirLeCompte('j', async () => { throw new TypeError('réseau'); }, signal());
    expect(r).toEqual({ etat: 'ECHEC', message: MESSAGE_SERVEUR_MUET });
  });

  it('la page quittée · la demande abandonnée ne dit rien', async () => {
    const c = new AbortController();
    const promesse = rouvrirLeCompte('j', (_ch, _co, s) => new Promise((_ok, ko) => s.addEventListener('abort', () => ko(new DOMException('abandon', 'AbortError')))), c.signal);
    c.abort();
    expect(await promesse).toEqual({ etat: 'ABANDONNE' });
  });
});
