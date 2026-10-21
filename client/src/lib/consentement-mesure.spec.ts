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
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('consentement à la mesure', () => {
  it('sans réponse, rien · null n’est pas un accord', () => {
    const s = memoire();
    expect(lireConsentement(() => s)).toBeNull();
    expect(mesureAutorisee(null, 'v')).toBe(false);
    expect(bandeauAMontrer(true, null, 'v')).toBe(true);
    expect(bandeauAMontrer(false, null, 'v')).toBe(false);
  });

  it('l’accord se lit, daté et rattaché à la version de la politique ; le refus ferme', () => {
    const s = memoire();
    expect(enregistrerConsentement(() => s, 'accepte', '17 octobre 2026', new Date('2026-10-17T10:00:00Z'))).toBe(true);
    const c = lireConsentement(() => s);
    expect(c).toEqual({ choix: 'accepte', le: '2026-10-17T10:00:00.000Z', politique: '17 octobre 2026' });
    expect(mesureAutorisee(c, '17 octobre 2026')).toBe(true);
    expect(bandeauAMontrer(true, c, '17 octobre 2026')).toBe(false);
    // Une politique nouvelle repose la question, et l'ancien accord ne vaut plus (relecture, m1).
    expect(mesureAutorisee(c, '1er décembre 2026')).toBe(false);
    expect(bandeauAMontrer(true, c, '1er décembre 2026')).toBe(true);
    enregistrerConsentement(() => s, 'refuse', '17 octobre 2026', new Date());
    expect(mesureAutorisee(lireConsentement(() => s), 'x')).toBe(false);
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

  it('un refus que le stockage ne peut écrire ne laisse jamais l’ancien accord (relecture, M2)', () => {
    const s = memoire();
    enregistrerConsentement(() => s, 'accepte', 'x', new Date());
    const plein = { ...s, setItem: () => { throw new Error('quota'); } };
    expect(enregistrerConsentement(() => plein, 'refuse', 'x', new Date())).toBe(false);
    expect(mesureAutorisee(lireConsentement(() => s), 'x')).toBe(false);
  });

  it('le démarrage de la télémétrie de l’interface exige l’accord, et les vues ne s’accumulent pas avant lui', () => {
    const t = readFileSync(join(__dirname, 'telemetrie.ts'), 'utf8');
    expect(t).toContain('if (refusEnMemoire || !mesureAutorisee(lireConsentement(() => window.localStorage), DATE_DE_MISE_A_JOUR)) return;');
    expect(t).toContain('if (!regimes.posthog.actif || !demarree) return;');
  });

  it('le bandeau est monté à la racine, refuser et accepter ont le même poids, et le lien des préférences le rouvre', () => {
    const b = readFileSync(join(__dirname, '..', 'components', 'BandeauConsentementMesure.tsx'), 'utf8');
    const t = readFileSync(join(__dirname, 'telemetrie.ts'), 'utf8');
    expect(readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')).toContain('<BandeauConsentementMesure />');
    const boutons = [...b.matchAll(/onClick=\{\(\) => choisir\('(accepte|refuse)'\)\}\s+className="([^"]+)"/g)];
    expect(boutons.map(([, c]) => c).sort()).toEqual(['accepte', 'refuse']);
    expect(boutons[0][2]).toBe(boutons[1][2]);
    expect(b).toContain('window.dispatchEvent(new Event(EVENEMENT_PREFERENCES_MESURE))');
    expect(readFileSync(join(__dirname, '..', 'pages', 'AuthPage.tsx'), 'utf8')).toContain('<LienPreferencesMesure />');
    // Relecture · aucun vol de focus à l'ouverture, autres onglets suivis, page non recouverte.
    expect(b).toContain('if (ouvert && rouvertParPreference.current) premier.current?.focus');
    expect(b).toContain("window.addEventListener('storage', autreOnglet);");
    // Relecture « échecs silencieux », M1 et M2 · un refus arrête les SDK sur place, jamais un rechargement.
    expect(b).not.toContain('location.reload');
    expect(b).toContain('arreterTelemetrieInterface();');
    expect(t).toContain('posthog.opt_out_capturing();');
    expect(t).toContain('void sdkSentry.close();');
    expect(b).toContain('document.body.style.paddingBottom');
  });
});
