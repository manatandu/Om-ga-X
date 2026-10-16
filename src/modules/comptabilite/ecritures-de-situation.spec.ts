import { BadRequestException } from '@nestjs/common';
import { GranulariteCloture, NumerotationPiece, StatutEcriture, TypeJournal } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HORS_SITUATION,
  avecStatut,
  filtreDuStatut,
  libelleDuStatut,
  motifSituationNeSeValidePas,
  statutDeNaissance,
} from './ecritures-de-situation';
import {
  MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL,
  garderJournalDeSituation,
  motifEcartJournalDeSituation,
} from '../../common/journal-de-situation/extension-journal-de-situation';
import { dansContexteAudit, journaliserDansTransaction } from '../../common/audit/contexte-audit';
import { filtresDesTroisColonnes } from './balance-trois-colonnes';
import { motifLigneFigee } from '../exercice/gel-cloture';
import { grilleJournauxSaisie } from '../journaux/etat-journaux-saisie';
import { journauxDeLaSequenceDuFichier, modeEffectif, prochainNumeroPiece } from '../journaux/numerotation-piece';
import { EcritureService } from './ecriture.service';
import { PrismaService } from '../../common/prisma.service';
import { JournalService } from '../journaux/journal.service';
import { ExerciceService } from '../exercice/exercice.service';
import { AnalytiqueService } from '../analytique/analytique.service';

/**
 * LE JOURNAL DE SITUATION (ligne sage-l1, fonction 12 · « un journal de type
 * Situation ne peut pas être clôturé ni compacté », Sage 100 i7).
 *
 * Décision par la loi (voir `ecritures-de-situation.ts`) · le livre-journal
 * reçoit les mouvements de l'exercice (AUDCIF art. 19), la validation les y
 * fait entrer de façon irréversible (art. 22, 2°), la clôture informatique
 * porte sur la chronologie des opérations (art. 22, 3°). Une écriture de
 * situation n'enregistre aucune opération · elle n'entre jamais au
 * livre-journal, ni à la balance, ni à la clôture, ni au report à-nouveau.
 *
 * CE QUE CES TESTS PROTÈGENT, dans l'ordre de ce qui casserait en silence :
 *  1. la clôture annuelle ne reporte jamais une simulation (le report
 *     à-nouveau de N+1 serait faux, la balance bouclée) ;
 *  2. la balance de travail et le grand livre ne la lisent pas ;
 *  3. elle ne se valide pas, et elle naît au statut SITUATION, jamais au
 *     brouillard (que la clôture refuse, ce qui enfermait l'exercice) ;
 *  4. l'invariant « statut SITUATION si et seulement si journal de
 *     situation », tenu sur le client Prisma ;
 *  5. une clôture de période ne fige pas son journal, et sa numérotation ne
 *     prend jamais un numéro de la séquence du fichier.
 */

const SOURCE = (chemin: string) => readFileSync(join(__dirname, '..', '..', '..', chemin), 'utf8');

describe('les filtres partagés', () => {
  it('la balance avec brouillard écarte la situation, le livre-journal seul ne lit que le validé', () => {
    expect(filtreDuStatut(true)).toEqual({ statut: { not: StatutEcriture.SITUATION } });
    expect(filtreDuStatut(false)).toEqual({ statut: StatutEcriture.VALIDEE });
  });

  it('une écriture née dans un journal de situation porte le statut SITUATION, ailleurs le brouillard', () => {
    expect(statutDeNaissance({ type: TypeJournal.SITUATION })).toBe(StatutEcriture.SITUATION);
    expect(statutDeNaissance({ type: TypeJournal.GENERAL })).toBe(StatutEcriture.BROUILLARD);
    expect(statutDeNaissance({ type: TypeJournal.TRESORERIE })).toBe(StatutEcriture.BROUILLARD);
  });

  it('un livre imprime « Situation », jamais « Brouillard », pour une simulation', () => {
    expect(libelleDuStatut(StatutEcriture.SITUATION)).toBe('Situation');
    expect(libelleDuStatut(StatutEcriture.VALIDEE)).toBe('Validée');
    expect(libelleDuStatut(StatutEcriture.BROUILLARD)).toBe('Brouillard');
  });

  it('le filtre d’un appelant garde le statut qu’il pose, et écarte la situation sinon · la valeur, pas la clé (second tour, e)', () => {
    expect(avecStatut({ tenantId: 't1', statut: StatutEcriture.VALIDEE })).toEqual({ tenantId: 't1', statut: StatutEcriture.VALIDEE });
    expect(avecStatut({ tenantId: 't1' })).toEqual({ tenantId: 't1', ...HORS_SITUATION });
    // Un champ facultatif relayé tel quel · Prisma ignorerait `undefined`.
    expect(avecStatut({ tenantId: 't1', statut: undefined })).toEqual({ tenantId: 't1', ...HORS_SITUATION });
  });

  it('les trois colonnes de la balance écartent la situation quand le filtre ne fixe pas de statut', () => {
    const f = filtresDesTroisColonnes({ tenantId: 't1', exerciceId: 'e1' });
    for (const colonne of [f.reports, f.mouvements, f.clotures]) {
      expect(JSON.stringify(colonne)).toContain('"statut":{"not":"SITUATION"}');
    }
    // Un filtre qui fixe le livre-journal le garde tel quel.
    const v = filtresDesTroisColonnes({ tenantId: 't1', exerciceId: 'e1', statut: StatutEcriture.VALIDEE });
    expect(JSON.stringify(v.mouvements)).toContain('"statut":"VALIDEE"');
    expect(JSON.stringify(v.mouvements)).not.toContain('SITUATION');
  });
});

describe('l’invariant tenu sur le client Prisma', () => {
  it('la règle pure, dans les deux sens', () => {
    expect(motifEcartJournalDeSituation({ situation: true, code: 'SIT' }, 'SITUATION')).toBeNull();
    expect(motifEcartJournalDeSituation({ situation: false, code: 'OD' }, 'BROUILLARD')).toBeNull();
    expect(motifEcartJournalDeSituation({ situation: true, code: 'SIT' }, 'BROUILLARD')).toContain('SIT');
    expect(motifEcartJournalDeSituation({ situation: true, code: 'SIT' }, 'VALIDEE')).toContain('journal de situation');
    expect(motifEcartJournalDeSituation({ situation: false, code: 'OD' }, 'SITUATION')).toBe(
      MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL,
    );
  });

  function base(groupes: Array<{ journalId: string; statut: string }> = []) {
    const journaux = [
      { id: 'jSit', code: 'SIT', type: 'SITUATION' },
      { id: 'jOd', code: 'OD', type: 'GENERAL' },
    ];
    const findMany = jest.fn(async (a: { where: { id: { in: string[] } } }) => journaux.filter((j) => a.where.id.in.includes(j.id)));
    const groupBy = jest.fn().mockResolvedValue(groupes);
    // `update` et `upsert` visent UNE écriture · relue par une lecture unitaire.
    const findFirst = jest.fn().mockResolvedValue(groupes[0] ?? null);
    return { base: { journal: { findMany }, ecriture: { groupBy, findFirst } } as never, findMany, groupBy, findFirst };
  }
  /** Un client de base qui tombe s'il est lu · la lecture doit passer par la transaction. */
  const baseInterdite = () => {
    const tombe = jest.fn(async () => {
      throw new Error('seconde connexion · lu hors de la transaction en cours');
    });
    return { journal: { findMany: tombe }, ecriture: { groupBy: tombe, findFirst: tombe } } as never;
  };
  const query = jest.fn().mockResolvedValue('fait');
  const appeler = (b: never, operation: string, args: unknown) =>
    garderJournalDeSituation(b, { model: 'Ecriture', operation, args, query });

  it('refuse qu’un module passe une écriture au brouillard dans un journal de situation', async () => {
    const { base: b } = base();
    // Sans statut, la base pose BROUILLARD · c'est le chemin de tout module.
    await expect(appeler(b, 'create', { data: { journalId: 'jSit' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(appeler(b, 'create', { data: { journal: { connect: { id: 'jSit' } }, statut: 'VALIDEE' } })).rejects.toThrow('SIT');
    await expect(appeler(b, 'createMany', { data: [{ journalId: 'jOd' }, { journalId: 'jSit' }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse une écriture de situation dans un journal ordinaire, admet la saisie dans son journal', async () => {
    const { base: b } = base();
    await expect(appeler(b, 'create', { data: { journalId: 'jOd', statut: 'SITUATION' } })).rejects.toThrow(
      MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL,
    );
    await expect(appeler(b, 'create', { data: { journalId: 'jSit', statut: 'SITUATION' } })).resolves.toBe('fait');
    await expect(appeler(b, 'create', { data: { journalId: 'jOd' } })).resolves.toBe('fait');
  });

  it('refuse de valider une écriture de situation, même par un updateMany de lot', async () => {
    const { base: b } = base([
      { journalId: 'jOd', statut: 'BROUILLARD' },
      { journalId: 'jSit', statut: 'SITUATION' },
    ]);
    await expect(appeler(b, 'updateMany', { where: { id: { in: ['a', 'b'] } }, data: { statut: 'VALIDEE' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse de déplacer une simulation dans un journal ordinaire', async () => {
    const { base: b } = base([{ journalId: 'jSit', statut: 'SITUATION' }]);
    await expect(appeler(b, 'update', { where: { id: 'a' }, data: { journalId: 'jOd' } })).rejects.toThrow(
      MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL,
    );
  });

  it('dans une transaction, lit par elle et borne chaque lecture au dossier de l’écriture (relecture M2)', async () => {
    // Lue sur le client de base, la lecture prenait une seconde connexion
    // pendant que la transaction tenait la première (P2024 sous charge), et
    // ne voyait pas l'écriture que la transaction venait de créer.
    const { base: tx, findMany, groupBy, findFirst } = base([{ journalId: 'jSit', statut: 'SITUATION', tenantId: 't1' } as never]);
    const dansLaTransaction = (operation: string, args: unknown) =>
      dansContexteAudit({ acteurEmail: 'a@b.c', tenantId: 't1' }, () =>
        journaliserDansTransaction(tx, () => appeler(baseInterdite(), operation, args)),
      );
    await expect(dansLaTransaction('create', { data: { tenantId: 't1', journalId: 'jSit' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', id: { in: ['jSit'] } } }),
    );
    await expect(dansLaTransaction('update', { where: { id: 'a' }, data: { statut: 'VALIDEE' } })).rejects.toThrow('SIT');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'a' },
      select: { journalId: true, statut: true, tenantId: true },
    });
    await expect(
      dansLaTransaction('updateMany', { where: { tenantId: 't1', id: { in: ['a'] } }, data: { statut: 'VALIDEE' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['journalId', 'statut', 'tenantId'],
      where: { tenantId: 't1', id: { in: ['a'] } },
    });
  });

  it('hors de toute transaction, ou sans dossier au contexte, la lecture reste sur le client de base', async () => {
    const { base: b, findMany } = base();
    await expect(appeler(b, 'create', { data: { tenantId: 't1', journalId: 'jSit' } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    // Sans dossier ni sortie déclarée, la garde de cloisonnement refuserait
    // toute collection lue par la transaction · la création qu'on juge passe,
    // elle, sans borne · on lit donc comme elle.
    const { base: tx, findMany: luParTx } = base();
    const { base: b2, findMany: luParBase } = base();
    await expect(
      journaliserDansTransaction(tx, () => appeler(b2, 'create', { data: { tenantId: 't1', journalId: 'jSit' } })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(luParTx).not.toHaveBeenCalled();
    expect(luParBase).toHaveBeenCalledTimes(1);
  });

  it('une modification qui ne touche ni statut ni journal ne lit rien de plus', async () => {
    const { base: b, groupBy, findMany } = base();
    await expect(appeler(b, 'update', { where: { id: 'a' }, data: { libelle: 'Nouveau' } })).resolves.toBe('fait');
    expect(groupBy).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('l’extension est posée sur le client Prisma, entre le périmètre des journaux et le journal d’audit', () => {
    const src = SOURCE('src/common/prisma.service.ts');
    const perimetre = src.indexOf('.$extends(extensionPerimetreJournaux(this))');
    const situation = src.indexOf('.$extends(extensionJournalDeSituation(this))');
    const audit = src.indexOf('.$extends(extensionAudit(this))');
    expect(perimetre).toBeGreaterThan(-1);
    expect(situation).toBeGreaterThan(perimetre);
    expect(audit).toBeGreaterThan(situation);
  });
});

describe('une écriture de situation ne se valide pas', () => {
  it('refuse le lot en la nommant, au lieu de l’écarter sans un mot', async () => {
    const updateMany = jest.fn();
    const prisma = {
      ecriture: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            statut: 'SITUATION',
            numeroPiece: 4,
            createdBy: 'u',
            exercice: { statut: 'OUVERT' },
            journal: { code: 'SIT' },
            lignes: [],
          },
        ]),
        updateMany,
      },
    };
    const service = new EcritureService(
      prisma as unknown as PrismaService,
      {} as JournalService,
      {} as unknown as ExerciceService,
      {} as AnalytiqueService,
    );
    await expect(service.valider('t1', 'u', ['s1'])).rejects.toThrow(motifSituationNeSeValidePas(['SIT n° 4']));
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('la clôture et le report à-nouveau ne lisent pas la situation', () => {
  const exercice = SOURCE('src/modules/exercice/exercice.service.ts');

  it('chaque report de clôture tiré de l’exercice l’écarte, ou ne lit que le livre-journal', () => {
    // Chaque appel de `lireComptesDuReport` · son filtre d'écritures est le
    // troisième argument. Ancré sur l'appel, jamais sur une distance.
    const appels = [...exercice.matchAll(/lireComptesDuReport\(tx, tenantId, (\{[^}]*\})/g)].map((m) => m[1]);
    expect(appels.length).toBeGreaterThanOrEqual(3);
    for (const filtre of appels) {
      expect(filtre.includes('...HORS_SITUATION') || filtre.includes('StatutEcriture.VALIDEE')).toBe(true);
    }
  });

  it('les clôtures partielle et totale refusent un journal de situation', () => {
    for (const methode of ['async clorePartielle(', 'async cloreTotale(']) {
      const debut = exercice.indexOf(methode);
      expect(debut).toBeGreaterThan(-1);
      const corps = exercice.slice(debut, exercice.indexOf('\n  }\n', debut));
      expect(corps).toContain('estJournalDeSituation(');
      expect(corps).toContain('motifJournalDeSituationNonCloturable(');
    }
  });
});

describe('le gel de période et l’état des journaux de saisie', () => {
  const cloturePeriode = { journalId: null, granularite: GranulariteCloture.PERIODE, dateLimite: new Date('2026-03-31T00:00:00Z') };
  const clotureTotale = { journalId: 'jSit', granularite: GranulariteCloture.TOTALE, dateLimite: new Date('2026-12-31T00:00:00Z') };

  it('une clôture de période ne fige pas un journal de situation, l’exercice clôturé si', () => {
    const date = new Date('2026-02-10T00:00:00Z');
    expect(motifLigneFigee({ journalId: 'jOd', date, exerciceClos: false }, [cloturePeriode])).not.toBeNull();
    expect(motifLigneFigee({ journalId: 'jSit', date, exerciceClos: false, journalSituation: true }, [cloturePeriode])).toBeNull();
    expect(motifLigneFigee({ journalId: 'jSit', date, exerciceClos: true, journalSituation: true }, [])).not.toBeNull();
  });

  it('le mois d’un journal de situation porte l’état SITUATION, jamais « Brouillard » ni « Clôturé » par une période', () => {
    const mois = [{ debut: '2026-02-01', fin: '2026-02-28' }];
    const comptages = [{ journalId: 'jSit', date: new Date('2026-02-10T00:00:00Z'), statut: StatutEcriture.SITUATION, estANouveauProvisoire: false, nombre: 3 }];
    const [ligne] = grilleJournauxSaisie([{ id: 'jSit', type: 'SITUATION' }], mois, comptages, [cloturePeriode], false);
    expect(ligne.cases[0].etat).toBe('SITUATION');
    expect(ligne.cases[0].enBrouillard).toBe(0);
    expect(ligne.cases[0].figeJusquau).toBeNull();
    // Une clôture totale ne vise pas un journal de situation (refusée au
    // serveur) · si elle existait d'avant la règle, elle le fige.
    const [fige] = grilleJournauxSaisie([{ id: 'jSit', type: 'SITUATION' }], mois, comptages, [clotureTotale], false);
    expect(fige.cases[0].etat).toBe('CLOTURE');
  });
});

describe('la numérotation · jamais la séquence du fichier', () => {
  const sit = { id: 'jSit', numerotation: NumerotationPiece.CONTINUE_FICHIER, type: TypeJournal.SITUATION };
  const ach = { id: 'jAch', numerotation: NumerotationPiece.CONTINUE_FICHIER, type: TypeJournal.ACHATS };

  it('un journal de situation posé en numérotation du fichier numérote sur lui seul', () => {
    expect(modeEffectif(sit)).toBe(NumerotationPiece.CONTINUE_JOURNAL);
    expect(modeEffectif(ach)).toBe(NumerotationPiece.CONTINUE_FICHIER);
    expect(journauxDeLaSequenceDuFichier([sit, ach]).map((j) => j.id)).toEqual(['jAch']);
  });

  it('la séquence du fichier ne lit jamais le maximum d’un journal de situation', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _max: { numeroPiece: 7 } });
    const tx = { ecriture: { aggregate } } as never;
    await expect(prochainNumeroPiece(tx, 't1', ach, 'e1', new Date('2026-02-10T00:00:00Z'))).resolves.toBe(8);
    expect(JSON.stringify(aggregate.mock.calls[0][0].where)).toContain('"type":{"not":"SITUATION"}');
  });
});

describe('le contrôle nomme les écritures validées dans un journal de situation', () => {
  it('le parcours des écritures les relève, sans seconde lecture, et l’analyse les nomme', () => {
    const src = SOURCE('src/modules/controles/controles.service.ts');
    const debut = src.indexOf('private async parcourirEcrituresControlees(');
    expect(debut).toBeGreaterThan(-1);
    const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
    expect(corps).toContain('where: { tenantId, exerciceId, ...HORS_SITUATION }');
    expect(corps).toMatch(/e\.statut === StatutEcriture\.VALIDEE && e\.journal\.type === TypeJournal\.SITUATION\) valideesEnSituation\.ajouter\(e\)/);
    expect(src).toContain("code: 'JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL'");
  });

  it('celles restées au brouillard par la reprise (tenues) sont nommées, et la clôture dit leur issue (relecture M3)', () => {
    const src = SOURCE('src/modules/controles/controles.service.ts');
    const debut = src.indexOf('private async parcourirEcrituresControlees(');
    const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
    expect(corps).toMatch(
      /e\.statut === StatutEcriture\.BROUILLARD && e\.journal\.type === TypeJournal\.SITUATION\) brouillardEnSituation\.ajouter\(e\)/,
    );
    expect(src).toContain("code: 'JOURNAL_DE_SITUATION_AU_BROUILLARD'");
    const exercice = SOURCE('src/modules/exercice/exercice.service.ts');
    const cloturer = exercice.slice(exercice.indexOf('  async cloturer('));
    const corpsCloture = cloturer.slice(0, cloturer.indexOf('\n  }\n'));
    expect(corpsCloture).toContain('statut: StatutEcriture.BROUILLARD, journal: { type: TypeJournal.SITUATION }');
    // La reprise qui les y laisse · lettrées, pointées ou tenues par une clé
    // étrangère, remises au brouillard.
    const migration = SOURCE('prisma/migrations/20270171040000_ecritures_de_situation_tenues/migration.sql');
    expect(migration).toContain('UPDATE "ecritures" SET "statut" = \'BROUILLARD\' WHERE "id" = ANY (tenues);');
    expect(migration).toMatch(/"lettrageId" IS NOT NULL OR l\."lettre" IS NOT NULL OR l\."rapprochementId" IS NOT NULL/);
    // Les clés lues dans `pg_constraint`, qui ne filtre pas par les droits du
    // rôle, et une lecture vide qui arrête tout (second tour, f).
    expect(migration).toContain("c.confrelid = '\"ecritures\"'::regclass");
    expect(migration).toContain('FROM pg_constraint c');
    expect(migration).toMatch(/IF cles = 0 THEN\s+RAISE EXCEPTION/);
  });
});

describe('les lectures de travail écartent la situation', () => {
  it('le grand livre, le justificatif et le périmètre du journal le disent dans leur filtre', () => {
    const src = SOURCE('src/modules/comptabilite/ecriture.service.ts');
    // Le grand livre porte le filtre sur le périmètre de l'EXERCICE, que la
    // période d'un extrait ne fait que restreindre (ligne export-periode).
    const perimetres = [...src.matchAll(/const perimetreExercice = \{[^;]*\};/g)].map((m) => m[0]);
    expect(perimetres.length).toBeGreaterThanOrEqual(2);
    for (const p of perimetres) expect(p).toContain('...HORS_SITUATION');
    expect(HORS_SITUATION).toEqual({ statut: { not: StatutEcriture.SITUATION } });
  });
});
