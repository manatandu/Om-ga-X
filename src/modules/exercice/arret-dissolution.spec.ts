import { FormeJuridiqueSyscohada, RegimeLiquidation, RoleUtilisateur } from '@prisma/client';
import { ExerciceService } from './exercice.service';
import { ExerciceController } from './exercice.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ACTES_DE_LA_PERIODE, ACTES_QUI_SUIVENT_LEUR_ECRITURE, issueActeDeLaPeriode, motifRefusArret } from './arret-dissolution';

/**
 * L'ARRÊT À LA DISSOLUTION, SON ANNULATION, ET L'EXERCICE DE LIQUIDATION DU
 * DOSSIER REPRIS (décision par la loi du 2026-10-07, quatrième lot, point 1 ;
 * constats 1, 2, 3, 6, 7, 11, 13 et 15 de la relecture).
 *
 * La doublure HONORE la requête (CLAUDE.md § 10 bis) · un monde en mémoire,
 * où chaque `where` se lit, et chaque `update` se voit.
 */
const jour = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const DISSOLUTION = jour(2026, 6, 30);

type Ligne = Record<string, unknown> & { id: string };

function correspond(ligne: Ligne, where: Record<string, unknown> | undefined, monde: Monde): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, attendu]) => {
    if (attendu === undefined) return true;
    if (cle === 'OR') return (attendu as Record<string, unknown>[]).some((w) => correspond(ligne, w, monde));
    if (cle === 'AND') return (attendu as Record<string, unknown>[]).every((w) => correspond(ligne, w, monde));
    if (cle === 'ecriture' && typeof attendu === 'object' && 'ecritureId' in ligne) {
      const e = monde.tables.ecriture?.find((x) => x.id === ligne.ecritureId);
      return !!e && correspond(e, attendu as Record<string, unknown>, monde);
    }
    if (cle === 'exercice' && typeof attendu === 'object') {
      const ex = monde.tables.exercice.find((e) => e.id === ligne.exerciceId);
      return !!ex && correspond(ex, attendu as Record<string, unknown>, monde);
    }
    // Les relations de bornage (bien, journal, lignes) ne filtrent pas ici.
    if (['immobilisation', 'journal', 'lignes', 'corrigeEcriture', 'compte'].includes(cle)) return true;
    // Paquet 1, A8 · la contre-passation d'une réévaluation, liée, sort du
    // périmètre de l'ouverture · `is: null` honoré sur la relation absente.
    if (cle === 'reevaluationExtourne') return (attendu as { is?: unknown }).is === null ? !ligne[cle] : true;
    const valeur = ligne[cle];
    if (attendu instanceof Date) return valeur instanceof Date && valeur.getTime() === attendu.getTime();
    if (attendu !== null && typeof attendu === 'object') {
      const o = attendu as Record<string, unknown>;
      const t = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
      if ('in' in o) return (o.in as unknown[]).includes(valeur);
      if ('notIn' in o) return !(o.notIn as unknown[]).includes(valeur);
      if ('not' in o) return valeur !== o.not;
      if (valeur === null || valeur === undefined) return false;
      if ('gt' in o && !(t(valeur) > t(o.gt))) return false;
      if ('gte' in o && !(t(valeur) >= t(o.gte))) return false;
      if ('lt' in o && !(t(valeur) < t(o.lt))) return false;
      if ('lte' in o && !(t(valeur) <= t(o.lte))) return false;
      return true;
    }
    return valeur === attendu;
  });
}

class Monde {
  tables: Record<string, Ligne[]> = {};
  journal: string[] = [];
  constructor(initial: Record<string, Ligne[]>) {
    for (const [t, lignes] of Object.entries(initial)) this.tables[t] = lignes.map((l) => ({ ...l }));
  }
  table(nom: string) {
    this.tables[nom] ??= [];
    const lignes = () => this.tables[nom];
    const self = this;
    return {
      findMany: async (a?: { where?: Record<string, unknown>; orderBy?: unknown }) =>
        lignes()
          .filter((l) => correspond(l, a?.where, self))
          .sort((x, y) => {
            const ob = Array.isArray(a?.orderBy) ? a?.orderBy[0] : a?.orderBy;
            const k = ob ? Object.keys(ob as object)[0] : null;
            if (!k) return 0;
            const vx = x[k] instanceof Date ? (x[k] as Date).getTime() : (x[k] as number);
            const vy = y[k] instanceof Date ? (y[k] as Date).getTime() : (y[k] as number);
            return (ob as Record<string, string>)[k] === 'desc' ? vy - vx : vx - vy;
          })
          .map((l) => ({ ...l, journal: { code: (l.journalCode as string) ?? 'OD' } })),
      findFirst: async (a?: { where?: Record<string, unknown> }) => {
        const l = lignes().find((x) => correspond(x, a?.where, self));
        return l ? { ...l, journal: { code: (l.journalCode as string) ?? 'OD' }, lignes: [] } : null;
      },
      findFirstOrThrow: async (a?: { where?: Record<string, unknown> }) => {
        const l = lignes().find((x) => correspond(x, a?.where, self));
        if (!l) throw new Error(`${nom} introuvable`);
        return { ...l };
      },
      count: async (a?: { where?: Record<string, unknown> }) => lignes().filter((l) => correspond(l, a?.where, self)).length,
      // La clôture somme par compte · un monde sans ligne n'a aucun groupe.
      groupBy: async () => [],
      fields: { credit: 'credit', debit: 'debit' },
      create: async (a: { data: Record<string, unknown> }) => {
        const l = { id: `${nom}-${lignes().length + 1}`, statut: 'OUVERT', ...a.data } as Ligne;
        lignes().push(l);
        self.journal.push(`${nom}.create`);
        return { ...l };
      },
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const l = lignes().find((x) => x.id === a.where.id);
        if (!l) throw new Error(`${nom} ${a.where.id} introuvable`);
        Object.assign(l, a.data);
        self.journal.push(`${nom}.update:${a.where.id}`);
        return { ...l };
      },
      delete: async (a: { where: { id: string } }) => {
        this.tables[nom] = lignes().filter((x) => x.id !== a.where.id);
        self.journal.push(`${nom}.delete:${a.where.id}`);
        return {};
      },
      deleteMany: async (a: { where?: Record<string, unknown> }) => {
        const avant = lignes().length;
        this.tables[nom] = lignes().filter((l) => !correspond(l, a.where, self));
        return { count: avant - this.tables[nom].length };
      },
    };
  }
  client(tenant: Record<string, unknown>): Record<string, unknown> {
    const modeles = ['exercice', 'ecriture', 'ligneEcriture', 'cloture', ...ACTES_QUI_SUIVENT_LEUR_ECRITURE.map((a) => a.modele)];
    const c: Record<string, unknown> = Object.fromEntries(modeles.map((m) => [m, this.table(m)]));
    c.tenant = {
      findUniqueOrThrow: async () => tenant,
      findUnique: async () => tenant,
    };
    c.$executeRaw = async () => 0;
    c.$queryRaw = async () => [];
    // `referencesVers` compte chaque relation vers l'exercice · la doublure
    // tient les tables qu'elle connaît, les autres sont vides.
    const proxy = new Proxy(c, {
      get: (cible, cle: string) => (cle in cible ? cible[cle] : this.table(cle)),
    });
    c.$transaction = async (fn: (tx: unknown) => unknown) => fn(proxy);
    return proxy;
  }
}

const SARL = {
  referentiel: 'SYSCOHADA',
  formeJuridiqueSyscohada: FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
  dateDissolution: DISSOLUTION,
  dateClotureLiquidation: null,
  regimeLiquidation: RegimeLiquidation.AMIABLE_STATUTAIRE,
  associeUniquePersonneMorale: null,
};
const N = { id: 'n', tenantId: 't1', dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' };
const ecriture = (id: string, date: Date, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: 't1',
  exerciceId: 'n',
  date,
  numeroPiece: Number(id.replace(/\D/g, '')) || 1,
  statut: 'VALIDEE',
  journalCode: 'VT',
  estANouveauProvisoire: false,
  ...extra,
});

function service(monde: Monde, tenant: Record<string, unknown> = SARL) {
  return new ExerciceService(monde.client(tenant) as never, { prochainNumeroPiece: async () => 99 } as never);
}

describe('arrêter l’exercice à la dissolution · les écritures suivent leur date (quatrième lot, point 1)', () => {
  it('crée l’exercice de liquidation et y rattache les écritures, validées ou au brouillard, sans rien changer d’elles', async () => {
    const monde = new Monde({
      exercice: [N],
      ecriture: [
        ecriture('e1', jour(2026, 3, 10)),
        ecriture('e2', jour(2026, 7, 2)),
        ecriture('e3', jour(2026, 11, 20), { statut: 'BROUILLARD' }),
      ],
      depreciationImmobilisation: [{ id: 'd1', exerciceId: 'n', ecritureId: 'e3', immobilisationId: 'i1', nature: 'DOTATION' }],
      cloture: [
        { id: 'c1', tenantId: 't1', exerciceId: 'n', dateLimite: jour(2026, 5, 31) },
        { id: 'c2', tenantId: 't1', exerciceId: 'n', dateLimite: jour(2026, 9, 30) },
      ],
    });
    const r = await service(monde).arreterALaDissolution('t1', 'n');
    const exercices = monde.tables.exercice;
    expect(iso(exercices.find((e) => e.id === 'n')!.dateFin as Date)).toBe('2026-06-30');
    const liq = exercices.find((e) => e.id !== 'n')!;
    expect(iso(liq.dateDebut as Date)).toBe('2026-07-01');
    // Fin provisoire · la fin d'origine, reportable ensuite.
    expect(iso(liq.dateFin as Date)).toBe('2026-12-31');
    const ecr = monde.tables.ecriture;
    expect(ecr.find((e) => e.id === 'e1')!.exerciceId).toBe('n');
    for (const id of ['e2', 'e3']) {
      const e = ecr.find((x) => x.id === id)!;
      expect(e.exerciceId).toBe(liq.id);
    }
    // Ni date, ni numéro, ni statut ne bougent.
    expect(iso(ecr.find((e) => e.id === 'e2')!.date as Date)).toBe('2026-07-02');
    expect(ecr.find((e) => e.id === 'e3')!.statut).toBe('BROUILLARD');
    expect(ecr.find((e) => e.id === 'e3')!.numeroPiece).toBe(3);
    // L'acte suit son écriture, la clôture posée après la dissolution suit sa date.
    expect(monde.tables.depreciationImmobilisation[0].exerciceId).toBe(liq.id);
    expect(monde.tables.cloture.find((c) => c.id === 'c1')!.exerciceId).toBe('n');
    expect(monde.tables.cloture.find((c) => c.id === 'c2')!.exerciceId).toBe(liq.id);
    expect(r).toMatchObject({ ecrituresRattachees: 2, actesRattaches: 1, cloturesRattachees: 1 });
    // Mises à jour UNITAIRES · chaque écriture rattachée entre au journal d'audit.
    expect(monde.journal).toEqual(expect.arrayContaining(['ecriture.update:e2', 'ecriture.update:e3']));
  });

  it('la fin provisoire de l’exercice de liquidation ne laisse aucune écriture dehors, et prend la clôture déclarée', async () => {
    const monde = new Monde({ exercice: [{ ...N, dateFin: jour(2026, 12, 31) }], ecriture: [ecriture('e1', jour(2026, 12, 31))] });
    await service(monde, { ...SARL, dateClotureLiquidation: jour(2027, 3, 31) }).arreterALaDissolution('t1', 'n');
    expect(iso(monde.tables.exercice.find((e) => e.id !== 'n')!.dateFin as Date)).toBe('2027-03-31');
  });

  it('l’exercice qui suit déjà devient l’exercice de liquidation · son à-nouveau provisoire se retire', async () => {
    const monde = new Monde({
      exercice: [N, { id: 'n1', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      ecriture: [
        ecriture('e2', jour(2026, 8, 1)),
        ecriture('an9', jour(2027, 1, 1), { exerciceId: 'n1', estANouveauProvisoire: true, statut: 'BROUILLARD' }),
      ],
    });
    await service(monde).arreterALaDissolution('t1', 'n');
    expect(monde.tables.exercice).toHaveLength(2);
    const n1 = monde.tables.exercice.find((e) => e.id === 'n1')!;
    expect(iso(n1.dateDebut as Date)).toBe('2026-07-01');
    expect(iso(n1.dateFin as Date)).toBe('2027-12-31');
    expect(monde.tables.ecriture.find((e) => e.id === 'e2')!.exerciceId).toBe('n1');
    expect(monde.tables.ecriture.find((e) => e.id === 'an9')).toBeUndefined();
  });

  it('refus nommés, chacun avec son issue · la règle de l’écran est celle du serveur (constat 15)', async () => {
    const deux = new Monde({
      exercice: [
        N,
        { id: 'n1', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' },
        { id: 'n2', tenantId: 't1', dateDebut: jour(2028, 1, 1), dateFin: jour(2028, 12, 31), statut: 'OUVERT' },
      ],
    });
    await expect(service(deux).arreterALaDissolution('t1', 'n')).rejects.toThrow('un seul d’entre eux peut le devenir');
    await expect(service(new Monde({ exercice: [N] }), { ...SARL, dateDissolution: null }).arreterALaDissolution('t1', 'n')).rejects.toThrow(
      'Aucune dissolution',
    );
    // Sans liquidation (associé unique personne morale) · les opérations d'après passent chez l'associé.
    const pm = { ...SARL, associeUniquePersonneMorale: true, regimeLiquidation: null };
    await expect(
      service(new Monde({ exercice: [N], ecriture: [ecriture('e2', jour(2026, 8, 1))] }), pm).arreterALaDissolution('t1', 'n'),
    ).rejects.toThrow('associé unique personne morale');
    const sansEcriture = new Monde({ exercice: [N] });
    await service(sansEcriture, pm).arreterALaDissolution('t1', 'n');
    expect(sansEcriture.tables.exercice).toHaveLength(1);
    expect(iso(sansEcriture.tables.exercice[0].dateFin as Date)).toBe('2026-06-30');
    // La même fonction tranche pour l'écran.
    expect(
      motifRefusArret({
        exercice: { dateDebut: N.dateDebut, dateFin: N.dateFin, clos: false },
        dissolution: DISSOLUTION,
        posterieurs: [],
        sansLiquidation: false,
        ecrituresApres: 12,
        actesDeLaPeriode: [],
      }),
    ).toBeNull();
  });

  it('un acte que l’exercice de liquidation porte déjà ne suit pas · nommé avec son issue', async () => {
    const monde = new Monde({
      exercice: [N, { id: 'n1', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      ecriture: [ecriture('e5', jour(2026, 12, 31))],
      depreciationImmobilisation: [
        { id: 'd1', exerciceId: 'n', ecritureId: 'e5', immobilisationId: 'i1', nature: 'DOTATION' },
        { id: 'd2', exerciceId: 'n1', ecritureId: 'autre', immobilisationId: 'i1', nature: 'DOTATION' },
      ],
    });
    await expect(service(monde).arreterALaDissolution('t1', 'n')).rejects.toThrow('dépréciation d’immobilisation de la pièce VT n° 5');
  });
});

describe('annuler l’arrêt · une dissolution mal datée n’enferme plus le dossier (constat 2)', () => {
  const arrete = { ...N, dateFin: DISSOLUTION };
  it('liquidation dans l’année · les écritures reviennent, l’exercice de liquidation disparaît', async () => {
    const monde = new Monde({
      exercice: [arrete, { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' }],
      ecriture: [ecriture('e2', jour(2026, 8, 1), { exerciceId: 'l' })],
      cloture: [{ id: 'c2', tenantId: 't1', exerciceId: 'l', dateLimite: jour(2026, 9, 30) }],
    });
    await service(monde).annulerArretDissolution('t1', 'n');
    expect(monde.tables.exercice.map((e) => e.id)).toEqual(['n']);
    expect(iso(monde.tables.exercice[0].dateFin as Date)).toBe('2026-12-31');
    expect(monde.tables.ecriture[0].exerciceId).toBe('n');
    expect(monde.tables.cloture[0].exerciceId).toBe('n');
  });

  it('liquidation au-delà · l’exercice de liquidation redevient l’année civile suivante', async () => {
    const monde = new Monde({
      exercice: [arrete, { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      ecriture: [ecriture('e2', jour(2026, 8, 1), { exerciceId: 'l' }), ecriture('e7', jour(2027, 2, 1), { exerciceId: 'l' })],
    });
    await service(monde).annulerArretDissolution('t1', 'n');
    const l = monde.tables.exercice.find((e) => e.id === 'l')!;
    expect(iso(l.dateDebut as Date)).toBe('2027-01-01');
    expect(monde.tables.ecriture.find((e) => e.id === 'e2')!.exerciceId).toBe('n');
    expect(monde.tables.ecriture.find((e) => e.id === 'e7')!.exerciceId).toBe('l');
  });

  it('une fin qui n’est pas un 31 décembre se ramène d’abord · issue dite', async () => {
    const monde = new Monde({
      exercice: [arrete, { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2027, 3, 31), statut: 'OUVERT' }],
    });
    await expect(service(monde).annulerArretDissolution('t1', 'n')).rejects.toThrow('Portez d’abord sa fin');
  });

  it('routes réservées à l’administrateur', () => {
    for (const route of ['arreterALaDissolution', 'annulerArretDissolution', 'rattacherALaLiquidation', 'modifierFinDeLiquidation'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, ExerciceController.prototype[route])).toEqual([RoleUtilisateur.ADMIN_CABINET]);
    }
  });
});

describe('dossier repris en liquidation · l’exercice ouvert devient l’exercice de liquidation (constat 13)', () => {
  it('commence au lendemain de la dissolution, sans qu’aucune écriture ne bouge', async () => {
    const monde = new Monde({
      exercice: [{ id: 'r', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      ecriture: [ecriture('e1', jour(2027, 1, 1), { exerciceId: 'r' })],
    });
    await service(monde, { ...SARL, dateDissolution: jour(2025, 6, 30) }).rattacherALaLiquidation('t1', 'r');
    expect(iso(monde.tables.exercice[0].dateDebut as Date)).toBe('2025-07-01');
    expect(monde.tables.ecriture[0].exerciceId).toBe('r');
  });

  it('refus · un exercice qui contient la dissolution (l’arrêt est le geste), un autre exercice ouvert', async () => {
    await expect(service(new Monde({ exercice: [N] })).rattacherALaLiquidation('t1', 'n')).rejects.toThrow('arrêtez-le');
    const monde = new Monde({
      exercice: [
        { id: 'a', tenantId: 't1', dateDebut: jour(2024, 1, 1), dateFin: jour(2024, 12, 31), statut: 'OUVERT' },
        { id: 'r', tenantId: 't1', dateDebut: jour(2026, 1, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' },
      ],
    });
    await expect(service(monde, { ...SARL, dateDissolution: jour(2025, 6, 30) }).rattacherALaLiquidation('t1', 'r')).rejects.toThrow(
      'clôturez-le d’abord',
    );
  });
});

describe('après la dissolution · aucun exercice civil, et l’exercice de liquidation se clôture à la clôture de la liquidation', () => {
  it('créer une année civile après la dissolution est refusé (constats 3 et 6)', async () => {
    const monde = new Monde({ exercice: [{ ...N, dateFin: DISSOLUTION }] });
    await expect(service(monde).creer('t1', { dateDebut: '2027-01-01', dateFin: '2027-12-31' } as never)).rejects.toThrow(
      'aucun exercice civil ne s’ouvre après',
    );
  });

  it('l’exercice de liquidation ne se clôture qu’à la clôture déclarée de la liquidation (constat 7)', async () => {
    const liq = { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' };
    await expect(service(new Monde({ exercice: [liq] })).cloturer('t1', 'l', 'u1')).rejects.toThrow(
      'sans clôture de la liquidation déclarée',
    );
    await expect(
      service(new Monde({ exercice: [liq] }), { ...SARL, dateClotureLiquidation: jour(2027, 2, 28) }).cloturer('t1', 'l', 'u1'),
    ).rejects.toThrow('est déclarée au 28/02/2027');
  });

  it('l’exercice de liquidation n’a pas de report à-nouveau provisoire (constat 6)', async () => {
    const liq = { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' };
    await expect(service(new Monde({ exercice: [liq] })).genererANouveauxProvisoires('t1', 'l', 'u1')).rejects.toThrow(
      'n’a pas d’exercice suivant',
    );
  });
});

describe('les actes calculés sur la période ne suivent pas · nommés, refusés, retirés à la demande (relecture du 2026-10-07, bloquant 1)', () => {
  // Le scénario du doublement · dotation 2026 de 1 200 000 passée au 31/12,
  // dissolution du 30/06 déclarée ensuite. Déplacée dans l'exercice de
  // liquidation, elle s'ajoutait à la dotation au prorata de l'exercice
  // arrêté (600 000) · 1 800 000 sur l'année, sans un signal.
  const dotation2026 = () =>
    new Monde({
      exercice: [N],
      ecriture: [ecriture('e9', jour(2026, 12, 31), { statut: 'BROUILLARD', journalCode: 'OD' })],
      dotationAmortissement: [{ id: 'd1', exerciceId: 'n', ecritureId: 'e9', immobilisationId: 'i1' }],
      immobilisation: [{ id: 'i1', tenantId: 't1', statut: 'EN_SERVICE' }],
    });

  it('sans accord, l’arrêt NOMME la dotation avec son issue et ne touche à rien', async () => {
    const monde = dotation2026();
    await expect(service(monde).arreterALaDissolution('t1', 'n')).rejects.toThrow(
      /dotation aux amortissements \(OD n° 9, exercice 2026\).*AUDCIF art\. 59|AUDCIF art\. 59.*dotation aux amortissements \(OD n° 9, exercice 2026\)/,
    );
    // Rien n'a bougé · ni l'exercice, ni la dotation, ni son écriture.
    expect(monde.tables.exercice).toHaveLength(1);
    expect(iso(monde.tables.exercice[0].dateFin as Date)).toBe('2026-12-31');
    expect(monde.tables.dotationAmortissement[0].exerciceId).toBe('n');
    expect(monde.tables.ecriture[0].exerciceId).toBe('n');
  });

  it('avec l’accord, la dotation au brouillard part avec son écriture · aucune ne passe dans l’exercice de liquidation', async () => {
    const monde = dotation2026();
    const r = (await service(monde).arreterALaDissolution('t1', 'n', { retirerActesDeLaPeriode: true })) as { actesRetires: string[] };
    expect(monde.tables.dotationAmortissement).toHaveLength(0);
    expect(monde.tables.ecriture).toHaveLength(0);
    expect(r.actesRetires).toEqual(['dotation aux amortissements (OD n° 9) retirée avec son écriture au brouillard']);
    expect(iso(monde.tables.exercice.find((e) => e.id === 'n')!.dateFin as Date)).toBe('2026-06-30');
  });

  it('validée, elle s’inscrit en négatif à sa date · l’origine et le négatif passent ensemble dans la liquidation, la dotation n’existe plus', async () => {
    const monde = dotation2026();
    monde.tables.ecriture[0].statut = 'VALIDEE';
    await service(monde).arreterALaDissolution('t1', 'n', { retirerActesDeLaPeriode: true, userId: 'u1' });
    expect(monde.tables.dotationAmortissement).toHaveLength(0);
    const negatif = monde.tables.ecriture.find((e) => e.corrigeEcritureId === 'e9')!;
    expect(negatif).toMatchObject({ statut: 'VALIDEE', numeroPiece: 99, createdBy: 'u1' });
    expect(iso(negatif.date as Date)).toBe('2026-12-31');
    const liq = monde.tables.exercice.find((e) => e.id !== 'n')!;
    expect(monde.tables.ecriture.map((e) => e.exerciceId)).toEqual([liq.id, liq.id]);
  });

  it('un bien sorti garde sa dotation · refus nommé, sans retrait possible', async () => {
    const monde = dotation2026();
    monde.tables.immobilisation[0].statut = 'CEDEE';
    await expect(service(monde).arreterALaDissolution('t1', 'n', { retirerActesDeLaPeriode: true })).rejects.toThrow('le bien est sorti');
    expect(monde.tables.dotationAmortissement).toHaveLength(1);
  });

  it('l’acte de l’exercice qui suit, dont le début recule, est nommé aussi ; un acte annulé ne compte plus', async () => {
    const monde = new Monde({
      exercice: [N, { id: 'n1', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      constatImpotResultat: [
        { id: 'c1', tenantId: 't1', exerciceId: 'n1', ecritureId: null, annuleeLe: null },
        { id: 'c0', tenantId: 't1', exerciceId: 'n', ecritureId: null, annuleeLe: jour(2026, 5, 1) },
      ],
    });
    await expect(service(monde).arreterALaDissolution('t1', 'n')).rejects.toThrow(
      'constat de l’impôt sur le résultat (sans écriture, exercice 2027) · annulez le constat',
    );
  });

  it('l’annulation de l’arrêt et le rattachement du dossier repris nomment aussi les actes de la période', async () => {
    const arrete = { ...N, dateFin: DISSOLUTION };
    const liq = { id: 'l', tenantId: 't1', dateDebut: jour(2026, 7, 1), dateFin: jour(2026, 12, 31), statut: 'OUVERT' };
    const monde = new Monde({
      exercice: [arrete, liq],
      reevaluationBilan: [{ id: 'rb', tenantId: 't1', exerciceId: 'l', ecritureId: 'x' }],
    });
    await expect(service(monde).annulerArretDissolution('t1', 'n')).rejects.toThrow(
      'réévaluation des immobilisations (sans écriture, exercice du 01/07/2026 au 31/12/2026) · aucun geste d’OmegaX ne l’annule encore',
    );
    const repris = new Monde({
      exercice: [{ id: 'r', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      amortissementDerogatoire: [{ id: 'ad', tenantId: 't1', exerciceId: 'r', ecritureId: null }],
    });
    const autre = { ...SARL, dateDissolution: jour(2025, 6, 30) };
    await expect(service(repris, autre).rattacherALaLiquidation('t1', 'r')).rejects.toThrow('amortissement dérogatoire (sans écriture, exercice 2027)');
    const r = (await service(repris, autre).rattacherALaLiquidation('t1', 'r', { retirerActesDeLaPeriode: true })) as { actesRetires: string[] };
    expect(r.actesRetires).toEqual(['amortissement dérogatoire (sans écriture) retirée']);
    expect(iso(repris.tables.exercice[0].dateDebut as Date)).toBe('2025-07-01');
  });

  it('le refus porte le marqueur que l’écran lit pour demander l’accord, et la liste n’oublie aucun des actes de la période', () => {
    const dotation = ACTES_DE_LA_PERIODE.find((a) => a.modele === 'dotationAmortissement')!;
    expect(issueActeDeLaPeriode(dotation, { auBrouillard: true, bienSorti: false })).toContain('en acceptant de retirer les actes de la période');
    expect(ACTES_DE_LA_PERIODE.map((a) => a.modele).sort()).toEqual(
      [
        'amortissementDerogatoire',
        'constatImpotResultat',
        'dotationAmortissement',
        'mouvementDemantelement',
        'reevaluation',
        'reevaluationBilan',
        'repriseProvisionReevaluation',
        'repriseSubventionImmobilisation',
      ].sort(),
    );
    // Aucun acte de la période ne suit son écriture.
    const suivent = new Set(ACTES_QUI_SUIVENT_LEUR_ECRITURE.map((a) => a.modele));
    expect(ACTES_DE_LA_PERIODE.filter((a) => suivent.has(a.modele))).toEqual([]);
    expect(suivent.has('affectationResultat')).toBe(false);
  });
});

describe('les actes datés sans écriture suivent leur date ; le relevé d’unités d’œuvre est nommé (mineur 3)', () => {
  it('OD analytique et engagement suivent leur date, le relevé se dit à ressaisir', async () => {
    const monde = new Monde({
      exercice: [N],
      odAnalytique: [
        { id: 'o1', tenantId: 't1', exerciceId: 'n', date: jour(2026, 3, 1) },
        { id: 'o2', tenantId: 't1', exerciceId: 'n', date: jour(2026, 9, 1) },
      ],
      engagementDepense: [{ id: 'g1', tenantId: 't1', exerciceId: 'n', date: jour(2026, 8, 1), nature: 'BON_DE_COMMANDE', reference: 'BC1' }],
      consommationUniteOeuvre: [
        { id: 'u1', tenantId: 't1', exerciceId: 'n', unitesConsommees: 9000, immobilisation: { designation: 'Camion' }, exercice: { dateDebut: N.dateDebut, dateFin: N.dateFin } },
      ],
    });
    const r = (await service(monde).arreterALaDissolution('t1', 'n')) as { relevesARevoir: string[]; actesRattaches: number };
    const liq = monde.tables.exercice.find((e) => e.id !== 'n')!;
    expect(monde.tables.odAnalytique.map((o) => o.exerciceId)).toEqual(['n', liq.id]);
    expect(monde.tables.engagementDepense[0].exerciceId).toBe(liq.id);
    expect(r.actesRattaches).toBe(2);
    expect(r.relevesARevoir).toEqual(["Camion · 9000 unités relevées sur l'exercice 2026, à ressaisir pour sa période nouvelle"]);
  });
});

describe('dissolution sans liquidation · rien ne suit l’exercice arrêté (relecture du 2026-10-07, majeur 2)', () => {
  const pm = { ...SARL, associeUniquePersonneMorale: true, regimeLiquidation: null };
  const n1 = { id: 'n1', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' };

  it('un exercice postérieur vide est retiré, son report provisoire avec lui', async () => {
    const monde = new Monde({
      exercice: [N, n1],
      ecriture: [ecriture('p1', jour(2027, 1, 1), { exerciceId: 'n1', estANouveauProvisoire: true })],
    });
    const r = (await service(monde, pm).arreterALaDissolution('t1', 'n')) as { exercicesRetires: string[] };
    expect(monde.tables.exercice.map((e) => e.id)).toEqual(['n']);
    expect(r.exercicesRetires).toEqual(['2027']);
    expect(monde.tables.ecriture).toHaveLength(0);
  });

  it('un exercice postérieur occupé est NOMMÉ, et l’arrêt refuse', async () => {
    const monde = new Monde({ exercice: [N, n1], ecriture: [ecriture('v1', jour(2027, 2, 1), { exerciceId: 'n1' })] });
    await expect(service(monde, pm).arreterALaDissolution('t1', 'n')).rejects.toThrow(
      /L'exercice du 01\/01\/2027 au 31\/12\/2027 suit celui-ci · sans liquidation.*Il porte/,
    );
    expect(monde.tables.exercice).toHaveLength(2);
  });

  it('l’exercice arrêté n’a ni report à-nouveau provisoire ni exercice suivant', async () => {
    const monde = new Monde({ exercice: [{ ...N, dateFin: DISSOLUTION }] });
    await expect(service(monde, pm).genererANouveauxProvisoires('t1', 'n', 'u1' as never)).rejects.toThrow('dernier de la société');
  });
});

describe('le dossier repris ne déplace pas une ouverture passée (relecture du 2026-10-07, mineur 5)', () => {
  it('une ouverture passée au premier jour refuse le rattachement, comme l’arrêt', async () => {
    const monde = new Monde({
      exercice: [{ id: 'r', tenantId: 't1', dateDebut: jour(2027, 1, 1), dateFin: jour(2027, 12, 31), statut: 'OUVERT' }],
      ecriture: [ecriture('o1', jour(2027, 1, 1), { exerciceId: 'r', journalCode: 'AN', estSoldeDesComptesDeGestion: false })],
      ligneEcriture: [{ id: 'l1', ecritureId: 'o1', compteId: 'c', compte: { numero: '52110000' }, debit: 100, credit: 0 }],
    });
    await expect(service(monde, { ...SARL, dateDissolution: jour(2025, 6, 30) }).rattacherALaLiquidation('t1', 'r')).rejects.toThrow(
      'ne serait plus celle du premier jour de l\'exercice de liquidation',
    );
    expect(iso(monde.tables.exercice[0].dateDebut as Date)).toBe('2027-01-01');
  });
});

describe('clôture de l’exercice arrêté sans liquidation · branche de fin (majeur 2)', () => {
  it('aucun exercice créé, aucun report, la fin dite', async () => {
    const pm = { ...SARL, associeUniquePersonneMorale: true, regimeLiquidation: null };
    const monde = new Monde({ exercice: [{ ...N, dateFin: DISSOLUTION }], journal: [{ id: 'od', tenantId: 't1', code: 'OD', type: 'GENERAL' }] });
    const r = (await service(monde, pm).cloturer('t1', 'n', 'u1')) as { issueOuverture: string[]; statut: string };
    expect(monde.tables.exercice).toHaveLength(1);
    expect(r.statut).toBe('CLOTURE');
    expect(r.issueOuverture[0]).toContain('Dernier exercice de la société, dissoute sans liquidation le 30/06/2026');
    expect(r.issueOuverture[0]).toContain('AUSCGIE art. 201 al. 4');
  });
});
