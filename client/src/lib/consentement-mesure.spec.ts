import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bandeauAMontrer,
  CLE_CONSENTEMENT_MESURE,
  enregistrerConsentement,
  lireConsentement,
  mesureAutorisee,
} from './consentement-mesure';

/**
 * Code du numérique, art. 192 et 196 · la mesure de l'interface ne part que
 * sur un accord lu, se retire aussi simplement qu'elle se donne, et garde sa
 * date. Le globals de vitest (pas d'import) · la suite racine relit aussi ce
 * fichier.
 */

const memoire = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('consentement à la mesure', () => {
  it('sans réponse, rien · null n’est pas un accord', () => {
    const s = memoire();
    expect(lireConsentement(() => s)).toBeNull();
    expect(mesureAutorisee(null)).toBe(false);
    expect(bandeauAMontrer(true, null)).toBe(true);
    expect(bandeauAMontrer(false, null)).toBe(false);
  });

  it('l’accord se lit, daté et rattaché à la version de la politique ; le refus ferme', () => {
    const s = memoire();
    expect(enregistrerConsentement(() => s, 'accepte', '17 octobre 2026', new Date('2026-10-17T10:00:00Z'))).toBe(true);
    const c = lireConsentement(() => s);
    expect(c).toEqual({ choix: 'accepte', le: '2026-10-17T10:00:00.000Z', politique: '17 octobre 2026' });
    expect(mesureAutorisee(c)).toBe(true);
    expect(bandeauAMontrer(true, c)).toBe(false);
    enregistrerConsentement(() => s, 'refuse', '17 octobre 2026', new Date());
    expect(mesureAutorisee(lireConsentement(() => s))).toBe(false);
  });

  it('une valeur illisible ou un stockage qui jette repose la question, sans rien envoyer', () => {
    const s = memoire();
    s.m.set(CLE_CONSENTEMENT_MESURE, '{"choix":"oui"}');
    expect(lireConsentement(() => s)).toBeNull();
    s.m.set(CLE_CONSENTEMENT_MESURE, 'pas du json');
    expect(lireConsentement(() => s)).toBeNull();
    const jette = () => {
      throw new Error('fenêtre privée');
    };
    expect(lireConsentement(jette)).toBeNull();
    expect(enregistrerConsentement(jette, 'accepte', 'x', new Date())).toBe(false);
  });

  it('le démarrage de la télémétrie de l’interface exige l’accord, et les vues ne s’accumulent pas avant lui', () => {
    const t = readFileSync(join(__dirname, 'telemetrie.ts'), 'utf8');
    expect(t).toContain('if (demarree || !mesureAutorisee(lireConsentement(() => window.localStorage))) return;');
    expect(t).toContain('if (!regimes.posthog.actif || !demarree) return;');
  });

  it('le bandeau est monté à la racine, refuser et accepter ont le même poids, et le lien des préférences le rouvre', () => {
    const b = readFileSync(join(__dirname, '..', 'components', 'BandeauConsentementMesure.tsx'), 'utf8');
    expect(readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')).toContain('<BandeauConsentementMesure />');
    const boutons = [...b.matchAll(/onClick=\{\(\) => choisir\('(accepte|refuse)'\)\}\s+className="([^"]+)"/g)];
    expect(boutons.map(([, c]) => c).sort()).toEqual(['accepte', 'refuse']);
    expect(boutons[0][2]).toBe(boutons[1][2]);
    expect(b).toContain('window.dispatchEvent(new Event(EVENEMENT_PREFERENCES_MESURE))');
    expect(readFileSync(join(__dirname, '..', 'pages', 'AuthPage.tsx'), 'utf8')).toContain('<LienPreferencesMesure />');
  });
});
