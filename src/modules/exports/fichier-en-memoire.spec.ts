import { produireEnMemoire } from './fichier-en-memoire';

/**
 * UN FICHIER PRODUIT POUR ÊTRE GARDÉ (ligne sage-l7) · tout ou rien. Relecture
 * « échecs silencieux », m1 et m2 · une archive que le moteur n'a pas terminée
 * ne se range pas, et un tuyau en erreur ne laisse aucun rejet non traité.
 */
describe('produireEnMemoire · tout ou rien', () => {
  it('rend le fichier écrit et fermé par le moteur, sous le nom qu’il a donné', async () => {
    const r = await produireEnMemoire(async (ouvrir) => {
      const s = ouvrir('livre.xlsx');
      s.write(Buffer.from('abc'));
      s.end(Buffer.from('def'));
    });
    expect(r).toEqual({ nomFichier: 'livre.xlsx', contenu: Buffer.from('abcdef') });
  });

  it('un moteur qui rend la main sans fermer son fichier est une PANNE, jamais une archive rangée (m1)', async () => {
    await expect(
      produireEnMemoire(async (ouvrir) => {
        ouvrir('livre.xlsx').write(Buffer.from('moitié de classeur'));
      }),
    ).rejects.toThrow(/sans terminer son fichier · rien n'est rangé/);
  });

  it('un tuyau en erreur et un moteur qui lève · l’erreur du moteur remonte, aucun rejet non traité (m2)', async () => {
    const rejets: unknown[] = [];
    const ecouter = (r: unknown) => rejets.push(r);
    process.on('unhandledRejection', ecouter);
    try {
      await expect(
        produireEnMemoire(async (ouvrir) => {
          const s = ouvrir('livre.xlsx');
          s.destroy(new Error('tuyau rompu'));
          throw new Error('moteur tombé');
        }),
      ).rejects.toThrow('moteur tombé');
      // Laisse passer les microtâches où un rejet non traité serait signalé.
      await new Promise((r) => setTimeout(r, 20));
      expect(rejets).toEqual([]);
    } finally {
      process.off('unhandledRejection', ecouter);
    }
  });

  it('un moteur qui n’ouvre aucun fichier n’a rien produit', async () => {
    await expect(produireEnMemoire(async () => undefined)).rejects.toThrow(/sans terminer son fichier|aucun fichier/);
  });
});
