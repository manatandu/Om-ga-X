import {
  contratEnCoursA,
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
          id: 'd-1', immobilisationId: 'b-1', dateDebut: j('2026-03-01'), dateFin: null, observation: null,
          salarie: { id: 's-1', nom: 'KABILA', postNom: null, prenoms: 'Jean', matricule: null }, lieu: null,
          immobilisation: { id: 'b-1', designation: 'Ordinateur', numeroInventaire: null, statut: 'EN_SERVICE', dateSortie: null },
          recuDebut: { id: 'r-4', numero: 4, nature: 'AFFECTATION', dateActe: j('2026-03-01'), signataires: null, dateSignature: null, signatureDeclareeLe: null, signatureDeclareePar: null },
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
    expect(tx.detentionBien.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't-1', salarieId: 's-1', recuDebutId: 'r-4' }) }));
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
