import { Prisma } from '@prisma/client';
import { estConflitDeSerialisation, TENTATIVES_MAX, delaiDeReprise } from './prisma-retry.util';
import { ErreurMaillonDansTransaction } from './audit/extension-audit';

/**
 * CE QUE LA REPRISE TIENT POUR UN CONFLIT (`estConflitDeSerialisation`) ·
 * lu par `transactionDeSaisie`, `transactionSousVerrouDuDossier`, l'acte
 * audité hors transaction et le filtre des pannes. La transaction
 * sérialisable qui le lisait d'abord (`avecRetrySerialisable`) est retirée
 * (ligne saisie-suites, point 2) · plus aucun geste ne l'appelait.
 */
describe('reconnaître un conflit d’écriture ou un interblocage', () => {
  it('un conflit de sérialisation du MAILLON (40001 en requête brute, enveloppé) est un conflit, pas une panne', () => {
    const brut = new Prisma.PrismaClientKnownRequestError('could not serialize access', { code: 'P2010', clientVersion: 'x', meta: { code: '40001' } });
    // La VRAIE erreur de l'extension d'audit · sa cause doit rester lisible.
    expect(estConflitDeSerialisation(new ErreurMaillonDansTransaction('Ecriture', 'create', brut))).toBe(true);
  });

  it('un interblocage (40P01) rendu en erreur INCONNUE est un conflit à rejouer (relecture TypeScript, MAJEUR 2)', () => {
    const tuee = new Prisma.PrismaClientUnknownRequestError(
      'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected" }) })',
      { clientVersion: 'x' },
    );
    expect(estConflitDeSerialisation(tuee)).toBe(true);
    expect(estConflitDeSerialisation(Object.assign(new Error('x'), { cause: tuee }))).toBe(true);
    expect(estConflitDeSerialisation(new Prisma.PrismaClientUnknownRequestError('autre chose', { clientVersion: 'x' }))).toBe(false);
    // Sur une requête BRUTE (le verrou du maillon), Prisma rend P2010 avec l'état SQL en meta.code (second tour, Z2bis).
    const brute = new Prisma.PrismaClientKnownRequestError('Raw query failed. Code: `40P01`. Message: `deadlock detected`', {
      code: 'P2010',
      clientVersion: 'x',
      meta: { code: '40P01', message: 'ERROR: deadlock detected' },
    });
    expect(estConflitDeSerialisation(brute)).toBe(true);
    const autreBrute = new Prisma.PrismaClientKnownRequestError('Raw query failed', { code: 'P2010', clientVersion: 'x', meta: { code: '23505' } });
    expect(estConflitDeSerialisation(autreBrute)).toBe(false);
  });

  it('une autre erreur brute n’est pas prise pour un conflit', () => {
    const autre = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2010', clientVersion: 'x', meta: { code: '23505' } });
    expect(estConflitDeSerialisation(Object.assign(new Error('e'), { cause: autre }))).toBe(false);
  });
});

describe('la reprise après conflit (ligne k6-defauts, test de charge § 4.4)', () => {
  it('huit tentatives, délai croissant et largement aléatoire · deux reprises reparties ensemble se dispersent', () => {
    expect(TENTATIVES_MAX).toBe(8);
    expect(delaiDeReprise(1, () => 0)).toBe(20);
    expect(delaiDeReprise(7, () => 0)).toBe(140);
    expect(delaiDeReprise(1, () => 0.999)).toBeLessThan(60);
    expect(delaiDeReprise(7, () => 0.999)).toBeLessThan(420);
    expect(delaiDeReprise(3, () => 0.5)).not.toBe(delaiDeReprise(3, () => 0.25));
    // Au pire, de l'ordre de deux secondes cumulées avant le 409.
    let cumul = 0;
    for (let t = 1; t < TENTATIVES_MAX; t++) cumul += delaiDeReprise(t, () => 0.999);
    expect(cumul).toBeLessThan(2000);
  });
});
