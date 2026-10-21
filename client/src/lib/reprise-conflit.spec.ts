import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CODES_A_REPRENDRE, delaiDeReprise, estConflitAReprendre, REPRISES_MAX } from './reprise-conflit';

const RACINE = join(__dirname, '..');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(nom) && !/\.spec\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe('reprise automatique d’un conflit de sérialisation (ligne k6-defauts)', () => {
  it('ne reprend que le refus dont le CODE dit qu’il n’a rien écrit · jamais à son texte', () => {
    expect(estConflitAReprendre(409, 'CONFLIT_SERIALISATION')).toBe(true);
    expect(estConflitAReprendre(503, 'SERVEUR_SATURE')).toBe(true);
    expect(estConflitAReprendre(409, 'DOSSIER_OCCUPE')).toBe(true);
    // Un autre 409 dit un état qui ne changera pas en attendant ; un 409 sans
    // code (doublon, geste en cours) n'est jamais rejoué, même avec le texte d'avant.
    expect(estConflitAReprendre(409, null)).toBe(false);
    expect(estConflitAReprendre(409, 'VIREMENT_EN_COURS')).toBe(false);
    expect(estConflitAReprendre(500, 'CONFLIT_SERIALISATION')).toBe(false);
    expect(estConflitAReprendre(400, 'SERVEUR_SATURE')).toBe(false);
    expect([...CODES_A_REPRENDRE]).toEqual(['CONFLIT_SERIALISATION', 'DOSSIER_OCCUPE', 'SERVEUR_SATURE']);
  });

  it('attend un délai croissant et aléatoire, deux reprises au plus', () => {
    expect(REPRISES_MAX).toBe(2);
    expect(delaiDeReprise(1, () => 0)).toBe(300);
    expect(delaiDeReprise(2, () => 0)).toBe(600);
    expect(delaiDeReprise(1, () => 0.999)).toBeLessThan(1000);
    expect(delaiDeReprise(2, () => 0.999)).toBeLessThan(2000);
    // Deux reprises tirées au sort ne se percutent pas à nouveau · l'aléa pèse.
    expect(delaiDeReprise(1, () => 0.5)).not.toBe(delaiDeReprise(1, () => 0.25));
  });

  /**
   * LA REPRISE EST OPT-IN, ET LA LISTE DES APPELS QUI LA DEMANDENT EST FERMÉE
   * (relecture « échecs silencieux », B1). Un 409 de sérialisation garantit
   * que SA transaction n'a rien écrit, pas que la requête n'a rien écrit · le
   * règlement des tiers commet une pièce par tiers, et son rejeu entier
   * paierait deux fois le premier. Seule une route qui tient dans UNE
   * transaction sérialisable se rejoue · ajouter un appel ici, c'est l'avoir
   * vérifié sur le service qu'il appelle.
   */
  it('seuls les appels d’une route à une transaction demandent la reprise, jamais un règlement', () => {
    const demandes = sources(RACINE)
      .flatMap((f) => {
        const texte = readFileSync(f, 'utf8');
        const n = (texte.match(/rejouerConflit: true/g) ?? []).length;
        return n === 0 ? [] : [`${relative(RACINE, f).split('\\').join('/')} × ${n}`];
      })
      .sort();
    expect(demandes).toEqual([
      'pages/BrouillardPage.tsx × 1', // PATCH /ecritures/:id · EcritureService.modifier
      'pages/JournalPage.tsx × 1', // POST /ecritures/:id/correction · corrigerParInscriptionEnNegatif
      'pages/LettragePage.tsx × 2', // POST .../lettrage (lettrer) et .../completer
      'pages/SaisiePage.tsx × 1', // POST /ecritures · EcritureService.creer
    ]);
    for (const f of sources(RACINE)) {
      const texte = readFileSync(f, 'utf8');
      if (!/rejouerConflit: true/.test(texte)) continue;
      // L'appel qui demande la reprise ne vise jamais une route de règlement.
      for (const appel of texte.match(/api\.(post|put|patch)\([^;]*?rejouerConflit: true/gs) ?? []) {
        expect(appel).not.toMatch(/\/reglements/);
      }
    }
  });
});
