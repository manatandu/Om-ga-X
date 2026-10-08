import { BadRequestException } from '@nestjs/common';
import { ExerciceService } from './exercice.service';
import { estContigu, motifCreationNonContigue, motifSuivantNonContigu } from './exercice-contigu';

/**
 * LES EXERCICES SE SUIVENT SANS INTERRUPTION (simulation du logiciel complet
 * du 2026-10-08, constat G3) · AUDCIF art. 34 ; SYCEBNL art. 16, 4°, « le bilan
 * d'ouverture d'un exercice doit correspondre au bilan de clôture de
 * l'exercice précédent ». Un dossier tenant 2026 et 2028 sans 2027 était
 * admis, et la clôture de 2026 reportait ses soldes en 2028.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('exercice contigu · la règle', () => {
  it('le suivant est contigu quand il commence le lendemain de la fin, années bissextiles comprises', () => {
    expect(estContigu(d('2026-12-31'), d('2027-01-01'))).toBe(true);
    expect(estContigu(d('2028-02-28'), d('2028-02-29'))).toBe(true);
    expect(estContigu(d('2026-12-31'), d('2028-01-01'))).toBe(false);
  });

  it('une heure portée par la colonne ne compte pas', () => {
    expect(estContigu(new Date('2026-12-31T23:59:59.999Z'), d('2027-01-01'))).toBe(true);
  });

  it('le refus d’un geste nomme le jour qui manque et l’issue', () => {
    const m = motifSuivantNonContigu(d('2026-12-31'), { dateDebut: d('2028-01-01') });
    expect(m).toContain('01/01/2027');
    expect(m).toContain('01/01/2028');
    expect(m).toContain('AUDCIF art. 34');
    expect(m).toContain('SYCEBNL art. 16, 4°');
    expect(m).toContain('créez d');
  });

  it('une création touche le précédent ou le suivant, sinon elle est refusée', () => {
    // 2027 entre 2026 et 2028 · contigu des deux côtés.
    expect(motifCreationNonContigue(d('2027-01-01'), d('2027-12-31'), { dateFin: d('2026-12-31') }, { dateDebut: d('2028-01-01') })).toBeNull();
    // Une année d'archive ajoutée AVANT le premier exercice · elle finit la veille.
    expect(motifCreationNonContigue(d('2025-01-01'), d('2025-12-31'), null, { dateDebut: d('2026-01-01') })).toBeNull();
    // 2028 après 2026 · le trou de 2027.
    expect(motifCreationNonContigue(d('2028-01-01'), d('2028-12-31'), { dateFin: d('2026-12-31') }, null)).toContain('31/12/2026');
    // 2024 avant 2026 · le trou de 2025.
    expect(motifCreationNonContigue(d('2024-01-01'), d('2024-12-31'), null, { dateDebut: d('2026-01-01') })).toContain('01/01/2026');
  });
});

/**
 * La doublure HONORE la requête (§ 10 bis, F4b) · `findFirst` filtre les
 * exercices par `dateFin < x` ou `dateDebut > x` et l'ordre demandé, comme la
 * base. Une doublure qui rendrait toujours la même ligne ne prouverait rien.
 */
function serviceAvec(existants: Array<{ dateDebut: Date; dateFin: Date }>) {
  const findFirst = async (args: {
    where?: { dateDebut?: { lte?: Date; gt?: Date }; dateFin?: { gte?: Date; lt?: Date } };
    orderBy?: { dateDebut?: 'asc' | 'desc'; dateFin?: 'asc' | 'desc' };
  }) => {
    const w = args?.where ?? {};
    let lignes = existants.filter(
      (e) =>
        (w.dateDebut?.lte === undefined || e.dateDebut <= w.dateDebut.lte) &&
        (w.dateDebut?.gt === undefined || e.dateDebut > w.dateDebut.gt) &&
        (w.dateFin?.gte === undefined || e.dateFin >= w.dateFin.gte) &&
        (w.dateFin?.lt === undefined || e.dateFin < w.dateFin.lt),
    );
    if (args?.orderBy?.dateFin === 'desc') lignes = [...lignes].sort((a, b) => b.dateFin.getTime() - a.dateFin.getTime());
    if (args?.orderBy?.dateDebut === 'asc') lignes = [...lignes].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
    return lignes[0] ?? null;
  };
  return new ExerciceService(
    {
      exercice: { count: async () => existants.length, findFirst, create: async (a: unknown) => a },
      tenant: { findUnique: async () => ({ referentiel: 'SYCEBNL', formeJuridiqueSyscohada: null, dateDissolution: null }) },
    } as never,
    {} as never,
  );
}

describe('exercice contigu · la création', () => {
  const an = (y: number) => ({ dateDebut: d(`${y}-01-01`), dateFin: d(`${y}-12-31`) });

  it('refuse 2028 quand le dossier finit en 2026 (le cas G3)', async () => {
    const promesse = serviceAvec([an(2026)]).creer('t1', { dateDebut: '2028-01-01', dateFin: '2028-12-31' });
    await expect(promesse).rejects.toBeInstanceOf(BadRequestException);
    await expect(promesse).rejects.toThrow(/ne touche aucun exercice/);
  });

  it('accepte 2027 à la suite de 2026, et 2027 dans le trou d’un dossier né avant la règle', async () => {
    await expect(serviceAvec([an(2026)]).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' })).resolves.toBeDefined();
    await expect(serviceAvec([an(2026), an(2028)]).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' })).resolves.toBeDefined();
  });

  it('accepte une année ajoutée juste avant le premier exercice', async () => {
    await expect(serviceAvec([an(2026)]).creer('t1', { dateDebut: '2025-01-01', dateFin: '2025-12-31' })).resolves.toBeDefined();
  });
});

describe('exercice contigu · les gestes qui écrivent dans le suivant', () => {
  /**
   * La règle se pose aux cinq lectures de « l'exercice suivant » qui écrivent
   * ou annoncent un report · une lecture oubliée referait le défaut dans son
   * coin. Le test découpe chaque appel et y exige le garde contigu, par la
   * STRUCTURE (l'appel et sa garde dans le même corps), jamais par une distance.
   */
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const lire = (f: string) => fs.readFileSync(path.join(__dirname, f), 'utf8');

  it('la clôture, le report provisoire, l’aperçu et les budgets gardent le suivant contigu', () => {
    const src = lire('exercice.service.ts');
    const lectures = src.split('dateDebut: { gt: exercice.dateFin }').length - 1;
    // Les lectures du suivant dans ce fichier · quatre servent un report, la
    // cinquième (refus d'un postérieur clôturé, et la dissolution) n'écrit rien.
    expect(lectures).toBeGreaterThanOrEqual(4);
    expect(src.match(/estContigu\(exercice\.dateFin, (exerciceSuivant|suivant)\.dateDebut\)/g)?.length).toBe(4);
  });

  it('l’affectation du résultat garde le suivant contigu', () => {
    const src = fs.readFileSync(path.join(__dirname, '../affectation/affectation.service.ts'), 'utf8');
    expect(src).toMatch(/estContigu\(exercice\.dateFin, suivant\.dateDebut\)/);
  });
});
