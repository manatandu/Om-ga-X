import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  acteAAnnuler,
  bienDecrit,
  contratEnCoursA,
  motifRefusEntreeApresDetention,
  motifRefusMotifAnnulation,
  jourDepuisIso,
  motifRefusLiberation,
  motifRefusRemise,
  motifRefusSignature,
  nomDuSalarie,
  numeroSuivant,
  texteDuRecu,
  touchePeriode,
  type BienADetenir,
} from './detention-bien';
import { DetentionBienService } from './detention-bien.service';
import { detacherLesDetentionsAnnulees, detentionsQuiRetiennentLaFiche } from './detentions-de-la-fiche';
import { motifRefusSuppression, motifRefusEntreeSousLesDetentions, type EtatDeLaFiche } from './fiche-immobilisation';

const j = (s: string) => jourDepuisIso(s)!;
const bien: BienADetenir = { designation: 'Ordinateur portable', statut: 'EN_SERVICE', dateAcquisition: j('2026-01-10'), dateEntreeGroupe: null, dateSortie: null };
const contrat = [{ dateEntreeEnVigueur: j('2025-06-01'), dateFin: null }];
const base = {
  bien,
  jour: j('2026-03-01'),
  aujourdhui: j('2026-10-28'),
  detentions: [],
  nature: 'AFFECTATION' as const,
  contratsDuDetenteur: contrat,
  nomDuDetenteur: 'KABILA Jean',
};

describe('Détenteur d’un bien · règles pures (ligne Microfina M4)', () => {
  it('lit une date AAAA-MM-JJ et refuse une date impossible', () => {
    expect(jourDepuisIso('2026-02-30')).toBeNull();
    expect(jourDepuisIso('2026-2-3')).toBeNull();
    expect(jourDepuisIso(undefined)).toBeNull();
    expect(jourDepuisIso('2026-02-28')!.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('remet un bien en service à un salarié sous contrat', () => {
    expect(motifRefusRemise(base)).toBeNull();
  });

  it('refuse un bien sorti (cédé, au rebut, transféré hors du dossier)', () => {
    for (const statut of ['CEDEE', 'MISE_HORS_SERVICE'] as const) {
      expect(motifRefusRemise({ ...base, bien: { ...bien, statut, dateSortie: j('2026-02-01') } })).toMatch(/sorti du registre le 2026-02-01/);
    }
  });

  it('refuse une date future, et une date avant l’acquisition ou l’entrée dans le groupe', () => {
    expect(motifRefusRemise({ ...base, jour: j('2026-10-29') })).toMatch(/postérieure à aujourd'hui/);
    expect(motifRefusRemise({ ...base, jour: j('2026-01-09') })).toMatch(/depuis le 2026-01-10/);
    expect(motifRefusRemise({ ...base, bien: { ...bien, dateEntreeGroupe: j('2026-02-15') } })).toBeNull();
    expect(motifRefusRemise({ ...base, bien: { ...bien, dateEntreeGroupe: j('2026-04-01') } })).toMatch(/depuis le 2026-04-01/);
  });

  it('une détention à la fois · l’affectation refuse un bien détenu, le transfert l’exige', () => {
    const enCours = [{ dateDebut: j('2026-02-01'), dateFin: null, detenteur: 'MBUYI Anne' }];
    expect(motifRefusRemise({ ...base, detentions: enCours })).toMatch(/détenu par MBUYI Anne depuis le 2026-02-01/);
    expect(motifRefusRemise({ ...base, nature: 'TRANSFERT' })).toMatch(/il s'affecte/);
    expect(motifRefusRemise({ ...base, nature: 'TRANSFERT', detentions: enCours })).toBeNull();
    expect(motifRefusRemise({ ...base, nature: 'TRANSFERT', detentions: enCours, memeDetenteurQueLEnCours: true })).toMatch(/déjà détenu/);
  });

  it('jamais antidatée sous une détention existante · le jour même de la fin est admis', () => {
    const close = [{ dateDebut: j('2026-02-01'), dateFin: j('2026-03-10'), detenteur: 'MBUYI Anne' }];
    expect(motifRefusRemise({ ...base, detentions: close, jour: j('2026-03-09') })).toMatch(/jusqu'au 2026-03-10/);
    expect(motifRefusRemise({ ...base, detentions: close, jour: j('2026-03-10') })).toBeNull();
    const enCours = [{ dateDebut: j('2026-03-05'), dateFin: null, detenteur: 'MBUYI Anne' }];
    expect(motifRefusRemise({ ...base, nature: 'TRANSFERT', detentions: enCours, jour: j('2026-03-04') })).toMatch(/jusqu'au 2026-03-05/);
  });

  it('le détenteur a un contrat en cours à la date, bornes comprises', () => {
    const fini = [{ dateEntreeEnVigueur: j('2025-06-01'), dateFin: j('2026-02-28') }];
    expect(contratEnCoursA(fini, j('2026-02-28'))).toBe(true);
    expect(contratEnCoursA(fini, j('2026-03-01'))).toBe(false);
    expect(motifRefusRemise({ ...base, contratsDuDetenteur: fini })).toMatch(/KABILA Jean n'a pas de contrat de travail en cours le 2026-03-01/);
    expect(motifRefusRemise({ ...base, contratsDuDetenteur: [{ dateEntreeEnVigueur: j('2026-03-02'), dateFin: null }] })).toMatch(/pas de contrat/);
    expect(motifRefusRemise({ ...base, contratsDuDetenteur: [] })).toMatch(/pas de contrat/);
  });

  it('la libération · il faut un détenteur, jamais avant le début ni dans le futur ; un bien sorti se libère', () => {
    const enCours = { dateDebut: j('2026-02-01'), dateFin: null, detenteur: 'MBUYI Anne' };
    expect(motifRefusLiberation({ enCours: null, jour: j('2026-03-01'), aujourdhui: j('2026-10-28') })).toMatch(/rien à libérer/);
    expect(motifRefusLiberation({ enCours, jour: j('2026-01-31'), aujourdhui: j('2026-10-28') })).toMatch(/depuis le 2026-02-01/);
    expect(motifRefusLiberation({ enCours, jour: j('2026-10-29'), aujourdhui: j('2026-10-28') })).toMatch(/à venir/);
    expect(motifRefusLiberation({ enCours, jour: j('2026-02-01'), aujourdhui: j('2026-10-28') })).toBeNull();
  });

  it('la signature se déclare une fois, nommée et datée, jamais avant le reçu', () => {
    const p = { dejaDeclaree: false, signataires: 'Jean Kabila', jour: j('2026-03-02'), dateActe: j('2026-03-01'), aujourdhui: j('2026-10-28') };
    expect(motifRefusSignature(p)).toBeNull();
    expect(motifRefusSignature({ ...p, dejaDeclaree: true })).toMatch(/déjà déclarée/);
    expect(motifRefusSignature({ ...p, signataires: ' ' })).toMatch(/Nommez/);
    expect(motifRefusSignature({ ...p, jour: null })).toMatch(/AAAA-MM-JJ/);
    expect(motifRefusSignature({ ...p, jour: j('2026-02-28') })).toMatch(/pas été signé avant/);
    expect(motifRefusSignature({ ...p, jour: j('2026-10-29') })).toMatch(/à venir/);
  });

  it('le reçu dit la remise, le dossier, son numéro, et qu’il ne vaut que par ses signatures', () => {
    const t = texteDuRecu({
      numero: 7,
      nature: 'TRANSFERT',
      jour: j('2026-03-01'),
      dossier: 'ASBL Exemple',
      bien: { designation: 'Ordinateur', numeroInventaire: 'INV-0001' },
      remisA: 'KABILA Jean',
      rendPar: 'MBUYI Anne',
      lieu: 'DG · Direction',
      observation: null,
    });
    expect(t).toContain('ASBL Exemple');
    expect(t).toContain('N° 7');
    expect(t).toContain('« Ordinateur » (n° d\'inventaire INV-0001), détenu par MBUYI Anne, est remis ce jour à KABILA Jean.');
    expect(t).toContain('ne vaut que par les signatures');
    expect(t).not.toContain('\u2014');
  });

  it('nomme le salarié, la suite des numéros, la période bornes comprises', () => {
    expect(nomDuSalarie({ nom: 'KABILA', postNom: 'MUSAU', prenoms: 'Jean', matricule: 'M-01' })).toBe('KABILA MUSAU Jean (matricule M-01)');
    expect(nomDuSalarie({ nom: 'KABILA', postNom: null, prenoms: null, matricule: ' ' })).toBe('KABILA');
    expect(numeroSuivant(null)).toBe(1);
    expect(numeroSuivant(41)).toBe(42);
    expect(touchePeriode({ dateDebut: j('2026-01-01'), dateFin: j('2026-01-31') }, j('2026-01-31'), j('2026-02-28'))).toBe(true);
    expect(touchePeriode({ dateDebut: j('2026-01-01'), dateFin: j('2026-01-30') }, j('2026-01-31'), j('2026-02-28'))).toBe(false);
    expect(touchePeriode({ dateDebut: j('2026-03-01'), dateFin: null }, j('2026-01-31'), j('2026-02-28'))).toBe(false);
  });
});

describe('Détenteur d’un bien · service (aucune écriture comptable)', () => {
  function service() {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 'b-1' }]),
      $executeRaw: jest.fn(async () => 1),
      immobilisation: {
        findFirst: jest.fn(async () => ({ designation: 'Ordinateur', numeroInventaire: null, statut: 'EN_SERVICE', dateAcquisition: j('2026-01-10'), dateEntreeGroupe: null, dateSortie: null, lieuId: null })),
        update: jest.fn(),
      },
      salarie: { findFirst: jest.fn(async () => ({ id: 's-1', nom: 'KABILA', postNom: null, prenoms: 'Jean', matricule: null, contrats: contrat })) },
      lieuBien: { findFirst: jest.fn() },
      detentionBien: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: 'd-1' })),
        update: jest.fn(),
      },
      recuDetentionBien: { aggregate: jest.fn(async () => ({ _max: { numero: 3 } })), create: jest.fn(async () => ({ id: 'r-4', numero: 4 })) },
      tenant: { findUnique: jest.fn(async () => ({ nom: 'ASBL Exemple' })) },
      ecriture: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)),
      detentionBien: {
        findFirst: jest.fn(async () => ({
          id: 'd-1', immobilisationId: 'b-1', bienDecrit: 'Ordinateur', dateDebut: j('2026-03-01'), dateFin: null, observation: null,
          annuleeLe: null, annuleePar: null, motifAnnulation: null,
          salarie: { id: 's-1', nom: 'KABILA', postNom: null, prenoms: 'Jean', matricule: null, contrats: contrat }, lieu: null,
          immobilisation: { id: 'b-1', designation: 'Ordinateur', numeroInventaire: null, statut: 'EN_SERVICE', dateSortie: null },
          recuDebut: { id: 'r-4', numero: 4, nature: 'AFFECTATION', dateActe: j('2026-03-01'), signataires: null, dateSignature: null, signatureDeclareeLe: null, signatureDeclareePar: null, annuleLe: null, annulePar: null, motifAnnulation: null },
          recuFin: null,
        })),
      },
    };
    return { svc: new DetentionBienService(prisma as never), tx, prisma };
  }

  it('l’affectation verrouille la fiche, numérote le reçu à la suite du dossier, et ne passe aucune écriture', async () => {
    const { svc, tx } = service();
    const r = await svc.affecter('t-1', { userId: 'u-1', email: 'a@b.c' }, 'b-1', { salarieId: 's-1', date: '2026-03-01' });
    expect(String((tx.$queryRaw.mock.calls[0] as unknown[])[0])).toContain('FOR UPDATE');
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.recuDetentionBien.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't-1', numero: 4, nature: 'AFFECTATION' }) }));
    expect(tx.detentionBien.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't-1', salarieId: 's-1', recuDebutId: 'r-4', bienDecrit: 'Ordinateur' }) }));
    expect(tx.ecriture.create).not.toHaveBeenCalled();
    expect(r.recuRemise?.numero).toBe(4);
  });

  it('refuse sans rien écrire quand le salarié n’est pas sous contrat', async () => {
    const { svc, tx } = service();
    tx.salarie.findFirst.mockResolvedValueOnce({ id: 's-1', nom: 'KABILA', postNom: null, prenoms: null, matricule: null, contrats: [] } as never);
    await expect(svc.affecter('t-1', { userId: 'u-1', email: 'a@b.c' }, 'b-1', { salarieId: 's-1', date: '2026-03-01' })).rejects.toThrow(/pas de contrat/);
    expect(tx.recuDetentionBien.create).not.toHaveBeenCalled();
    expect(tx.detentionBien.create).not.toHaveBeenCalled();
  });

  it('le transfert termine la détention en cours par une mise à jour UNITAIRE et pose le même reçu des deux côtés', async () => {
    const { svc, tx } = service();
    tx.detentionBien.findMany.mockResolvedValueOnce([{ id: 'd-0', salarieId: 's-0', dateDebut: j('2026-02-01'), salarie: { id: 's-0', nom: 'MBUYI', postNom: null, prenoms: 'Anne', matricule: null } }] as never);
    await svc.transferer('t-1', { userId: 'u-1', email: 'a@b.c' }, 'b-1', { salarieId: 's-1', date: '2026-03-01' });
    expect(tx.detentionBien.update).toHaveBeenCalledWith({ where: { id: 'd-0' }, data: { dateFin: j('2026-03-01'), recuFinId: 'r-4' } });
    expect(tx.detentionBien.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recuDebutId: 'r-4' }) }));
  });

  it('deux détentions en cours · aucun acte ne passe', async () => {
    const { svc, tx } = service();
    const d = { id: 'x', salarieId: 's-0', dateDebut: j('2026-02-01'), salarie: { id: 's-0', nom: 'A', postNom: null, prenoms: null, matricule: null } };
    tx.detentionBien.findMany.mockResolvedValueOnce([d, { ...d, id: 'y' }] as never);
    await expect(svc.liberer('t-1', { userId: 'u-1', email: 'a@b.c' }, 'b-1', { date: '2026-03-01' })).rejects.toThrow(/incohérent/);
  });
});

describe('Détenteur d’un bien · l’annulation à rebours (relecture B1)', () => {
  const R = (id: string, nature: 'AFFECTATION' | 'TRANSFERT' | 'LIBERATION') => ({ id, nature, numero: Number(id.slice(2)) });
  const D = (id: string, debut: string, fin: string | null, recuDebut: ReturnType<typeof R>, recuFin: ReturnType<typeof R> | null = null) => ({
    id, dateDebut: j(debut), dateFin: fin ? j(fin) : null, recuDebut, recuFin, detenteur: 'MBUYI Anne',
  });

  it('le dernier acte vivant · la remise d’une détention ouverte, la libération d’une terminée', () => {
    const ouverte = D('d-1', '2026-03-01', null, R('r-1', 'AFFECTATION'));
    expect(acteAAnnuler(ouverte, ouverte)).toEqual({ genre: 'REMISE', recuId: 'r-1', nature: 'AFFECTATION' });
    const transferee = D('d-2', '2026-04-01', null, R('r-2', 'TRANSFERT'));
    expect(acteAAnnuler(transferee, transferee)).toEqual({ genre: 'REMISE', recuId: 'r-2', nature: 'TRANSFERT' });
    const rendue = D('d-1', '2026-03-01', '2026-05-01', R('r-1', 'AFFECTATION'), R('r-3', 'LIBERATION'));
    expect(acteAAnnuler(rendue, rendue)).toEqual({ genre: 'LIBERATION', recuId: 'r-3' });
  });

  it('à rebours · une détention sous une plus récente ne s’annule pas, l’acte plus récent est nommé', () => {
    const ancienne = D('d-1', '2026-03-01', '2026-04-01', R('r-1', 'AFFECTATION'), R('r-2', 'TRANSFERT'));
    const recente = D('d-2', '2026-04-01', null, R('r-2', 'TRANSFERT'));
    expect(acteAAnnuler(ancienne, recente)).toMatch(/à rebours, à partir du plus récent/);
    expect(acteAAnnuler(ancienne, recente)).toMatch(/remise le 2026-04-01/);
    expect(acteAAnnuler(ancienne, null)).toMatch(/à rebours/);
  });

  it('le motif est exigé · trois à cinq cents caractères', () => {
    expect(motifRefusMotifAnnulation('  ')).toMatch(/Dites pourquoi/);
    expect(motifRefusMotifAnnulation(undefined)).toMatch(/Dites pourquoi/);
    expect(motifRefusMotifAnnulation('x'.repeat(501))).toMatch(/Dites pourquoi/);
    expect(motifRefusMotifAnnulation('Saisie sur la mauvaise fiche')).toBeNull();
  });

  it('le bien décrit survit à la fiche, borné à la colonne', () => {
    expect(bienDecrit({ designation: 'Ordinateur', numeroInventaire: 'INV-1' })).toBe("Ordinateur (n° d'inventaire INV-1)");
    expect(bienDecrit({ designation: 'x'.repeat(500), numeroInventaire: null })).toHaveLength(400);
  });

  // Une base de détentions qui HONORE la requête (CLAUDE.md, « la doublure doit
  // honorer la requête ») · `annuleeLe: null` et `{ not: null }` filtrent.
  function registre(lignes: { id: string; immobilisationId: string | null; annuleeLe: Date | null }[], recus: { id: string; immobilisationId: string | null; annuleLe: Date | null }[]) {
    const garde = (champ: 'annuleeLe' | 'annuleLe', w: Record<string, unknown>, l: Record<string, unknown>) =>
      w.immobilisationId === l.immobilisationId &&
      (w[champ] === undefined || (w[champ] === null ? l[champ] === null : l[champ] !== null));
    const updates: string[] = [];
    return {
      updates,
      db: {
        detentionBien: {
          count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => lignes.filter((l) => garde('annuleeLe', where, l)).length),
          findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => lignes.filter((l) => garde('annuleeLe', where, l)).map((l) => ({ id: l.id }))),
          update: jest.fn(async ({ where, data }: { where: { id: string }; data: { immobilisationId: null } }) => {
            updates.push(`D:${where.id}`);
            lignes.find((l) => l.id === where.id)!.immobilisationId = data.immobilisationId;
          }),
        },
        recuDetentionBien: {
          count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => recus.filter((l) => garde('annuleLe', where, l)).length),
          findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => recus.filter((l) => garde('annuleLe', where, l)).map((l) => ({ id: l.id }))),
          update: jest.fn(async ({ where, data }: { where: { id: string }; data: { immobilisationId: null } }) => {
            updates.push(`R:${where.id}`);
            recus.find((l) => l.id === where.id)!.immobilisationId = data.immobilisationId;
          }),
        },
      },
    };
  }

  it('IMPASSE 1 · la fiche doublon affectée puis annulée se supprime · les annulés partent détachés, jamais supprimés', async () => {
    const quand = new Date('2026-03-02T10:00:00Z');
    const { db, updates } = registre(
      [{ id: 'd-1', immobilisationId: 'b-1', annuleeLe: quand }],
      [{ id: 'r-1', immobilisationId: 'b-1', annuleLe: quand }],
    );
    expect(await detentionsQuiRetiennentLaFiche(db as never, 't-1', 'b-1')).toEqual({ detentions: 0, recus: 0, total: 0 });
    const etat = { sortie: false, autresEcritures: [], acquisition: null, motifLignesTenues: null, origineParticuliere: null, neeDUneEcriturePassee: false, usages: [], annulationsRetenant: 0, exerciceClosQuiLaPorte: null, renouvelle: null, detentions: 0, documents: 0 } as unknown as EtatDeLaFiche;
    expect(motifRefusSuppression(etat) ?? '').not.toMatch(/détention/);
    expect(await detacherLesDetentionsAnnulees(db as never, 't-1', 'b-1')).toEqual({ detentions: 1, recus: 1 });
    expect(updates).toEqual(['D:d-1', 'R:r-1']);
  });

  it('une détention VIVANTE retient la fiche, et le refus nomme l’issue', async () => {
    const { db } = registre([{ id: 'd-1', immobilisationId: 'b-1', annuleeLe: null }], [{ id: 'r-1', immobilisationId: 'b-1', annuleLe: null }]);
    const r = await detentionsQuiRetiennentLaFiche(db as never, 't-1', 'b-1');
    expect(r.total).toBe(2);
    const etat = { sortie: false, autresEcritures: [], acquisition: null, motifLignesTenues: null, origineParticuliere: null, neeDUneEcriturePassee: false, usages: [], annulationsRetenant: 0, exerciceClosQuiLaPorte: null, renouvelle: null, detentions: r.total, documents: 0 } as unknown as EtatDeLaFiche;
    expect(motifRefusSuppression(etat)).toMatch(/annulez-les d’abord depuis le volet Détenteur, du plus récent au plus ancien/);
  });

  it('IMPASSE 2 · l’annulation d’un transfert dans le groupe ne compte que les détentions vivantes, et détache les annulées avant de retirer la fiche', () => {
    const src = readFileSync(join(__dirname, 'transfert-groupe.service.ts'), 'utf8');
    const corps = src.slice(src.indexOf('async annuler('));
    const refs = corps.slice(corps.indexOf("referencesVers(tx, 'Immobilisation'"), corps.indexOf(']);', corps.indexOf("referencesVers(tx, 'Immobilisation'")));
    expect(refs).toContain("'DetentionBien.immobilisationId'");
    expect(refs).toContain("'RecuDetentionBien.immobilisationId'");
    expect(corps).toContain('detentionsQuiRetiennentLaFiche(tx, entree.tenantId, fiche.id)');
    const detache = corps.indexOf('detacherLesDetentionsAnnulees(tx, entree.tenantId, fiche.id)');
    expect(detache).toBeGreaterThan(0);
    expect(detache).toBeLessThan(corps.indexOf('tx.immobilisation.delete('));
    const fiche = readFileSync(join(__dirname, 'fiche-immobilisation.service.ts'), 'utf8');
    const sup = fiche.slice(fiche.indexOf('async supprimer('));
    expect(sup.indexOf('detacherLesDetentionsAnnulees(tx, tenantId, id)')).toBeGreaterThan(0);
    expect(sup.indexOf('detacherLesDetentionsAnnulees(tx, tenantId, id)')).toBeLessThan(sup.indexOf('tx.immobilisation.delete('));
  });

  it('m1 · l’acquisition ne se date pas après la première remise vivante', () => {
    expect(motifRefusEntreeApresDetention(j('2026-03-02'), j('2026-03-01'))).toMatch(/remis à un salarié le 2026-03-01/);
    expect(motifRefusEntreeApresDetention(j('2026-03-01'), j('2026-03-01'))).toBeNull();
    expect(motifRefusEntreeApresDetention(j('2026-09-01'), null)).toBeNull();
    const etat = { premiereRemise: '2026-03-01' } as EtatDeLaFiche;
    expect(motifRefusEntreeSousLesDetentions(etat, '2026-04-01')).toMatch(/Annulez d’abord ses détentions/);
    expect(motifRefusEntreeSousLesDetentions(etat, undefined)).toBeNull();
  });

  it('m4 · une seule détention ouverte et vivante par bien, tenue en base par un index unique partiel', () => {
    const sql = readFileSync(join(__dirname, '../../../prisma/migrations/20270198000100_detentions_biens/migration.sql'), 'utf8');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "detentions_biens_ouverte_vivante_key" ON "detentions_biens"\("immobilisationId"\) WHERE "dateFin" IS NULL AND "annuleeLe" IS NULL;/,
    );
  });

  function serviceAnnulation(visee: Record<string, unknown>, plusRecente: Record<string, unknown> | null, precedente: { id: string } | null = { id: 'd-0' }) {
    const ordre: string[] = [];
    const salarie = { id: 's-1', nom: 'KABILA', postNom: null, prenoms: null, matricule: null };
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 'b-1' }]),
      immobilisation: { findFirst: jest.fn(async () => ({ designation: 'Ordinateur', numeroInventaire: null, statut: 'EN_SERVICE', dateAcquisition: j('2026-01-01'), dateEntreeGroupe: null, dateSortie: null, lieuId: null })) },
      detentionBien: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) return visee;
          if (where.recuFinId) return precedente;
          return plusRecente ? { ...plusRecente, salarie } : null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ordre.push(`D:${where.id}:${Object.keys(data).join(',')}`)),
      },
      recuDetentionBien: { update: jest.fn(async ({ where }: { where: { id: string } }) => ordre.push(`R:${where.id}`)) },
    };
    const prisma = {
      $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)),
      detentionBien: { findFirst: jest.fn(async () => ({ immobilisationId: 'b-1', annuleeLe: null })) },
    };
    const svc = new DetentionBienService(prisma as never);
    jest.spyOn(svc, 'historique').mockResolvedValue({} as never);
    return { svc, ordre };
  }

  it('annuler un transfert · la détention annulée sort de l’ouverte AVANT que la précédente ne se rouvre, le reçu marqué', async () => {
    const visee = { id: 'd-2', annuleeLe: null, dateFin: null, recuDebut: { id: 'r-2', nature: 'TRANSFERT' }, recuFin: null };
    const { svc, ordre } = serviceAnnulation(visee, { ...visee, dateDebut: j('2026-04-01'), recuDebut: { id: 'r-2', nature: 'TRANSFERT', numero: 2 } });
    await svc.annuler('t-1', { email: 'a@b.c' }, 'd-2', { recuId: 'r-2', motif: 'Mauvais salarié' });
    expect(ordre).toEqual(['D:d-2:annuleeLe,annuleePar,motifAnnulation', 'R:r-2', 'D:d-0:dateFin,recuFinId']);
  });

  it('annuler une libération · la détention se rouvre, le reçu de retour est marqué', async () => {
    const visee = { id: 'd-1', annuleeLe: null, dateFin: j('2026-05-01'), recuDebut: { id: 'r-1', nature: 'AFFECTATION' }, recuFin: { id: 'r-3', nature: 'LIBERATION' } };
    const { svc, ordre } = serviceAnnulation(visee, { ...visee, dateDebut: j('2026-03-01') });
    await svc.annuler('t-1', { email: 'a@b.c' }, 'd-1', { recuId: 'r-3', motif: 'Rendu par erreur' });
    expect(ordre).toEqual(['R:r-3', 'D:d-1:dateFin,recuFinId']);
  });

  it('refuse un acte autre que celui montré (409), et un acte qui n’est pas le plus récent', async () => {
    const visee = { id: 'd-1', annuleeLe: null, dateFin: null, recuDebut: { id: 'r-1', nature: 'AFFECTATION' }, recuFin: null };
    const a = serviceAnnulation(visee, { ...visee, dateDebut: j('2026-03-01') });
    await expect(a.svc.annuler('t-1', { email: 'a@b.c' }, 'd-1', { recuId: 'r-9', motif: 'Erreur' })).rejects.toThrow(/a changé depuis l'affichage/);
    expect(a.ordre).toEqual([]);
    const b = serviceAnnulation(visee, { id: 'd-5', annuleeLe: null, dateDebut: j('2026-06-01'), dateFin: null, recuDebut: { id: 'r-5', nature: 'TRANSFERT' }, recuFin: null });
    await expect(b.svc.annuler('t-1', { email: 'a@b.c' }, 'd-1', { recuId: 'r-1', motif: 'Erreur' })).rejects.toThrow(/à rebours/);
    expect(b.ordre).toEqual([]);
    await expect(b.svc.annuler('t-1', { email: 'a@b.c' }, 'd-1', { recuId: 'r-1', motif: ' ' })).rejects.toThrow(/Dites pourquoi/);
  });
});
