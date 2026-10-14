import { BadRequestException } from '@nestjs/common';
import { StatutEcriture } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  estUneRecherche,
  jourCouvert,
  joursNonImprimes,
  moisNonImprimes,
  motifClotureNonImprimee,
  periodeCouverte,
  type ImpressionLue,
} from './impressions-journal';
import { grilleJournauxSaisie, moisDeLExercice } from './etat-journaux-saisie';
import { ImpressionsJournalService } from './impressions-journal.service';
import { PLAFOND_ECRITURES_PAR_FENETRE } from '../comptabilite/ecriture.service';

/**
 * LE JOURNAL MARQUÉ « IMPRIMÉ » (ligne sage-l1, fonction 60 · décision D3,
 * AUDCIF art. 22, 1°, 3° et 7°). Ce que ces tests protègent, dans l'ordre de
 * ce qui casserait en silence :
 *  1. une écriture validée APRÈS l'impression rend son jour non imprimé · le
 *     papier ne la porte pas ;
 *  2. une impression d'un AUTRE journal ne couvre rien, celle de TOUS les
 *     journaux couvre chacun ;
 *  3. une recherche n'est pas le journal, une fenêtre tronquée non plus ;
 *  4. le refus de la clôture n'existe que si le dossier l'a demandé, et il
 *     nomme les journaux et les mois, avec l'issue.
 */

const J = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const H = (iso: string) => new Date(iso);

const impressionVte: ImpressionLue = { journalId: 'VTE', dateDebut: J('2026-03-01'), dateFin: J('2026-03-31'), imprimeAt: H('2026-04-02T10:00:00Z') };
const impressionTous: ImpressionLue = { journalId: null, dateDebut: J('2026-01-01'), dateFin: J('2026-12-31'), imprimeAt: H('2026-05-01T08:00:00Z') };

describe('un jour est couvert par une impression postérieure à sa dernière validation', () => {
  it('l’impression du journal, sur sa période, après la validation, couvre le jour', () => {
    expect(jourCouvert({ journalId: 'VTE', date: J('2026-03-15'), derniereValidation: H('2026-04-01T09:00:00Z') }, [impressionVte])).toBe(true);
  });

  it('une validation APRÈS l’impression rend le jour non imprimé', () => {
    expect(jourCouvert({ journalId: 'VTE', date: J('2026-03-15'), derniereValidation: H('2026-04-02T11:00:00Z') }, [impressionVte])).toBe(false);
  });

  it('un autre journal ne couvre rien ; l’impression de tous les journaux couvre chacun', () => {
    const ach = { journalId: 'ACH', date: J('2026-03-15'), derniereValidation: H('2026-04-01T09:00:00Z') };
    expect(jourCouvert(ach, [impressionVte])).toBe(false);
    expect(jourCouvert(ach, [impressionVte, impressionTous])).toBe(true);
  });

  it('un jour hors de la période imprimée n’est pas couvert', () => {
    expect(jourCouvert({ journalId: 'VTE', date: J('2026-04-01'), derniereValidation: H('2026-04-01T09:00:00Z') }, [impressionVte])).toBe(false);
  });

  it('les jours manquants sont nommés, les autres non', () => {
    const jours = [
      { journalId: 'VTE', date: J('2026-03-10'), derniereValidation: H('2026-03-31T09:00:00Z') },
      { journalId: 'VTE', date: J('2026-03-20'), derniereValidation: H('2026-04-03T09:00:00Z') },
    ];
    expect(joursNonImprimes(jours, [impressionVte]).map((j) => j.date.toISOString().slice(0, 10))).toEqual(['2026-03-20']);
  });
});

describe('une recherche n’est pas le journal', () => {
  it('un critère de contenu fait une recherche ; le périmètre seul, non', () => {
    expect(estUneRecherche({})).toBe(false);
    expect(estUneRecherche({ recherche: '  ' })).toBe(false);
    expect(estUneRecherche({ compte: '401' })).toBe(true);
    expect(estUneRecherche({ montantMin: 100 })).toBe(true);
    expect(estUneRecherche({ numeroPiece: 4 })).toBe(true);
    expect(estUneRecherche({ reference: 'FAC' })).toBe(true);
    expect(estUneRecherche({ recherche: 'loyer' })).toBe(true);
  });

  it('la période imprimée est bornée à l’exercice, et une période à l’envers est refusée', () => {
    const ex = { dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') };
    expect(periodeCouverte(ex, {})).toEqual({ dateDebut: ex.dateDebut, dateFin: ex.dateFin });
    expect(periodeCouverte(ex, { dateDebut: '2025-11-01', dateFin: '2026-02-28' })).toEqual({ dateDebut: ex.dateDebut, dateFin: J('2026-02-28') });
    expect(() => periodeCouverte(ex, { dateDebut: '2026-05-01', dateFin: '2026-04-01' })).toThrow(BadRequestException);
  });
});

describe('les mois non imprimés, lus en base', () => {
  function lecteur(jours: Array<{ journalId: string; date: Date; _max: { valideeAt: Date | null } }>, impressions: ImpressionLue[]) {
    const groupBy = jest.fn().mockResolvedValue(jours);
    return {
      groupBy,
      prisma: {
        ecriture: { groupBy },
        impressionJournal: { findMany: jest.fn().mockResolvedValue(impressions) },
        journal: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'VTE', code: 'VTE' },
            { id: 'ACH', code: 'ACH' },
          ]),
        },
      },
    };
  }

  it('le livre-journal seul, hors journal de situation, jusqu’à la date', async () => {
    const { prisma, groupBy } = lecteur([], []);
    await moisNonImprimes(prisma as never, { tenantId: 't', exerciceId: 'e', journalId: null, jusquau: J('2026-06-30') });
    const where = groupBy.mock.calls[0][0].where;
    expect(where.statut).toBe(StatutEcriture.VALIDEE);
    expect(where.journal).toEqual({ type: { not: 'SITUATION' } });
    expect(where.date).toEqual({ lte: J('2026-06-30') });
    expect(where.journalId).toBeUndefined();
  });

  it('nomme journal et mois une seule fois, triés, et le refus dit l’issue', async () => {
    const { prisma } = lecteur(
      [
        { journalId: 'VTE', date: J('2026-03-20'), _max: { valideeAt: H('2026-04-03T09:00:00Z') } },
        { journalId: 'VTE', date: J('2026-03-21'), _max: { valideeAt: H('2026-04-03T09:00:00Z') } },
        { journalId: 'ACH', date: J('2026-02-05'), _max: { valideeAt: H('2026-02-28T09:00:00Z') } },
        { journalId: 'VTE', date: J('2026-03-02'), _max: { valideeAt: H('2026-03-31T09:00:00Z') } },
      ],
      [impressionVte],
    );
    const r = await moisNonImprimes(prisma as never, { tenantId: 't', exerciceId: 'e', journalId: null, jusquau: J('2026-12-31') });
    expect(r).toEqual({ mois: [{ journal: 'ACH', mois: '2026-02' }, { journal: 'VTE', mois: '2026-03' }], total: 2 });
    const motif = motifClotureNonImprimee(r);
    expect(motif).toContain('ACH 02/2026, VTE 03/2026');
    expect(motif).toContain('Imprimez ou exportez le journal');
    expect(motif).toContain('AUDCIF art. 22, 1°');
  });
});

describe('l’état des journaux de saisie dit « non imprimé »', () => {
  const mois = moisDeLExercice(J('2026-01-01'), J('2026-12-31'));
  const compter = (date: string, valideeAt: string) => ({
    journalId: 'VTE',
    date: J(date),
    statut: StatutEcriture.VALIDEE,
    estANouveauProvisoire: false,
    nombre: 2,
    derniereValidation: H(valideeAt),
  });
  const etat = (g: ReturnType<typeof grilleJournauxSaisie>, m: string) => g[0].cases.find((c) => c.mois === m)?.etat;

  it('validé et non imprimé, puis imprimé, puis validé à nouveau après l’impression', () => {
    expect(etat(grilleJournauxSaisie([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false, []), '2026-03')).toBe('NON_IMPRIME');
    expect(etat(grilleJournauxSaisie([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false, [impressionVte]), '2026-03')).toBe('JOURNAL');
    expect(etat(grilleJournauxSaisie([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-05T09:00:00Z')], [], false, [impressionVte]), '2026-03')).toBe('NON_IMPRIME');
  });

  it('sans la liste des impressions, l’état ne se juge pas · le mois validé reste « Journal »', () => {
    expect(etat(grilleJournauxSaisie([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false), '2026-03')).toBe('JOURNAL');
  });
});

describe('l’impression de la fenêtre est enregistrée par le serveur', () => {
  function service(nombre: number) {
    const create = jest.fn(async ({ data }: { data: unknown }) => data);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      impressionJournal: { aggregate: jest.fn().mockResolvedValue({ _max: { numero: 6 } }), create },
      evenementAudit: { findFirst: jest.fn(), create: jest.fn() },
    };
    const prisma = {
      exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') }) },
      journal: { findFirst: jest.fn().mockResolvedValue({ id: 'VTE' }) },
      ecriture: { count: jest.fn().mockResolvedValue(nombre) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    return { s: new ImpressionsJournalService(prisma as never), create, prisma };
  }

  it('numérote à la suite du dossier, avec la période, le nombre de pièces compté et l’auteur', async () => {
    const { s, create } = service(42);
    await s.imprimer('t', 'u', { exerciceId: 'e', journalId: 'VTE', dateDebut: '2026-03-01', dateFin: '2026-03-31' });
    expect(create.mock.calls[0][0].data).toMatchObject({
      tenantId: 't',
      numero: 7,
      exerciceId: 'e',
      journalId: 'VTE',
      dateDebut: J('2026-03-01'),
      dateFin: J('2026-03-31'),
      forme: 'IMPRESSION',
      nombreEcritures: 42,
      imprimePar: 'u',
    });
  });

  it('refuse une fenêtre qui ne montrerait qu’une partie du journal, et dit d’exporter', async () => {
    const { s, create } = service(PLAFOND_ECRITURES_PAR_FENETRE + 1);
    await expect(s.imprimer('t', 'u', { exerciceId: 'e' })).rejects.toThrow(/Exportez-le en Excel/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('l’export du journal entier est une impression, une recherche exportée ne l’est pas', () => {
  it('l’export appelle l’enregistrement après la dernière ligne, et ne casse jamais le classeur remis', () => {
    const src = readFileSync(join(__dirname, '..', 'exports', 'export.service.ts'), 'utf8');
    const debut = src.indexOf('async journalExcelEnFlux(');
    const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
    expect(corps.indexOf('await flux.terminer(derniereDonnee);')).toBeGreaterThan(-1);
    expect(corps.indexOf('await this.marquerJournalImprime(')).toBeGreaterThan(corps.indexOf('await flux.terminer(derniereDonnee);'));
    const marquer = src.slice(src.indexOf('private async marquerJournalImprime('));
    expect(marquer).toContain('estUneRecherche(filtres)');
    expect(marquer).toContain('this.logger.error(');
  });
});

describe('la clôture refuse un journal non imprimé seulement sur l’option du dossier', () => {
  const src = readFileSync(join(__dirname, '..', 'exercice', 'exercice.service.ts'), 'utf8');
  it('les clôtures partielle, totale et de période appellent le refus ; l’annuelle lit l’option avec le dossier', () => {
    for (const methode of ['async clorePartielle(', 'async cloreTotale(', 'async clorePeriode(']) {
      const debut = src.indexOf(methode);
      const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
      expect(corps).toContain('await this.refuserSiNonImprime(');
    }
    const annuelle = src.slice(src.indexOf('  async cloturer('));
    expect(annuelle.slice(0, annuelle.indexOf('\n  }\n'))).toContain('dossier.refusClotureJournalNonImprime === true');
    const refus = src.slice(src.indexOf('private async refuserSiNonImprime('));
    expect(refus.slice(0, refus.indexOf('\n  }\n'))).toContain('refusClotureJournalNonImprime !== true) return;');
  });
});
