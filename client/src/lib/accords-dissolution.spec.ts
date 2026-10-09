import { readFileSync } from 'fs';
import { join } from 'path';
import { ACCORDS_DISSOLUTION, envoyerAvecAccords } from './accords-dissolution';

/**
 * SECOND TOUR DE RELECTURE DU PAQUET 1, BLOQUANT 2 · l'arrêt à la dissolution
 * refusait une ouverture déjà inscrite en négatif · le serveur dit désormais
 * l'accord qui le lève, et l'écran le demande sous le refus, puis relance.
 */
class Refus extends Error {}
const refus = (message: string) => new Refus(message);
const messageDe = (err: unknown) => (err instanceof Refus ? err.message : null);

describe('le geste se relance avec l’accord du cabinet, jamais sans', () => {
  it('ouverture annulée hors du premier jour · accord demandé sous le refus, puis relance avec le champ', async () => {
    const corpsVus: Record<string, unknown>[] = [];
    const questions: string[] = [];
    const r = await envoyerAvecAccords(
      async (corps) => {
        corpsVus.push({ ...corps });
        if (!corps.ouvertureAnnuleeNonRessaisie) throw refus('… relancez le geste en confirmant que l’ouverture annulée n’est pas ressaisie.');
        return 'fait';
      },
      {},
      (m) => (questions.push(m), true),
      messageDe,
    );
    expect(r).toBe('fait');
    expect(corpsVus).toEqual([{}, { ouvertureAnnuleeNonRessaisie: true }]);
    expect(questions[0]).toMatch(/n’est pas ressaisie\.\n\nConfirmer que l'ouverture annulée n'a pas été ressaisie, et relancer \?$/);
  });

  it('les deux accords, l’un après l’autre, l’accord déjà donné gardé', async () => {
    const corpsVus: Record<string, unknown>[] = [];
    await envoyerAvecAccords(
      async (corps) => {
        corpsVus.push({ ...corps });
        if (!corps.retirerActesDeLaPeriode) throw refus('… en acceptant de retirer les actes de la période (…)');
        if (!corps.ouvertureAnnuleeNonRessaisie) throw refus('… en confirmant que l’ouverture annulée n’est pas ressaisie.');
        return null;
      },
      {},
      () => true,
      messageDe,
    );
    expect(corpsVus.at(-1)).toEqual({ retirerActesDeLaPeriode: true, ouvertureAnnuleeNonRessaisie: true });
    expect(corpsVus).toHaveLength(3);
  });

  it('accord refusé, refus sans marqueur, ou marqueur d’un accord déjà donné · le refus remonte tel quel', async () => {
    const toujours = (m: string) => async () => {
      throw refus(m);
    };
    await expect(envoyerAvecAccords(toujours('… n’est pas ressaisie.'), {}, () => false, messageDe)).rejects.toThrow('n’est pas ressaisie');
    await expect(envoyerAvecAccords(toujours('Aucune dissolution déclarée.'), {}, () => true, messageDe)).rejects.toThrow('Aucune dissolution');
    await expect(
      envoyerAvecAccords(toujours('… en acceptant de retirer les actes de la période'), { retirerActesDeLaPeriode: true }, () => true, messageDe),
    ).rejects.toThrow('retirer les actes');
  });

  it('les marqueurs sont ceux que le serveur écrit, mot pour mot', () => {
    const serveur =
      readFileSync(join(__dirname, '../../../src/modules/exercice/exercice.service.ts'), 'utf8') +
      readFileSync(join(__dirname, '../../../src/modules/exercice/arret-dissolution.ts'), 'utf8');
    for (const a of ACCORDS_DISSOLUTION) expect(serveur).toContain(a.marqueur);
    const dto = readFileSync(join(__dirname, '../../../src/modules/exercice/dto/geste-dissolution.dto.ts'), 'utf8');
    for (const a of ACCORDS_DISSOLUTION) expect(dto).toMatch(new RegExp(`${a.champ}\\?: boolean`));
  });

  it('l’écran passe par cette relance pour les trois gestes', () => {
    const page = readFileSync(join(__dirname, '../pages/ExercicePage.tsx'), 'utf8');
    expect(page.match(/envoyerAvecAccords\(/g)?.length).toBe(2);
    expect(page).toMatch(/`\/exercices\/\$\{pour\}\/arreter-a-la-dissolution`, corps\)/);
    expect(page).toMatch(/`\/exercices\/\$\{pour\}\/\$\{route\}`, corps\)/);
  });
});
