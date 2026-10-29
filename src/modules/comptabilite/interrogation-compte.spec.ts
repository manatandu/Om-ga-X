import { NotFoundException } from '@nestjs/common';
import { Prisma, StatutEcriture } from '@prisma/client';
import { DERNIERES_LIGNES, InterrogationCompteService } from './interrogation-compte.service';

/**
 * Ligne gl-saisie, fonction 13 · interroger le compte depuis la saisie. Les
 * trois sommes ne se fondent pas, les simulations et le solde des comptes de
 * gestion n'entrent nulle part, le compte d'un autre dossier est introuvable.
 */
describe('interrogation du compte', () => {
  const dec = (x: number) => new Prisma.Decimal(x);
  function service(options: { compte?: object | null; nombre?: number } = {}) {
    const sommes = new Map<string, { debit: number; credit: number }>([
      ['VALIDEE', { debit: 500000, credit: 120000 }],
      ['BROUILLARD-false', { debit: 0, credit: 30000 }],
      ['BROUILLARD-true', { debit: 75000, credit: 0 }],
    ]);
    const prisma = {
      compte: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options.compte === undefined ? { id: 'c1', numero: '41110001', intitule: 'Client A', typeCompte: 'DETAIL', estActif: true } : options.compte,
          ),
      },
      ligneEcriture: {
        aggregate: jest.fn(async ({ where }: { where: { ecriture: { statut: unknown; estANouveauProvisoire?: boolean } } }) => {
          const cle = where.ecriture.statut === StatutEcriture.VALIDEE ? 'VALIDEE' : `BROUILLARD-${where.ecriture.estANouveauProvisoire}`;
          const s = sommes.get(cle)!;
          return { _sum: { debit: dec(s.debit), credit: dec(s.credit) } };
        }),
        count: jest.fn().mockResolvedValue(options.nombre ?? 2),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'l1',
            libelle: null,
            debit: dec(500000),
            credit: dec(0),
            lettre: null,
            lettrageId: 'g1',
            dateEcheance: new Date('2026-03-31T00:00:00Z'),
            ecriture: {
              date: new Date('2026-03-01T00:00:00Z'),
              numeroPiece: 12,
              reference: 'F-12',
              libelle: 'Facture 12',
              statut: StatutEcriture.VALIDEE,
              estANouveauProvisoire: false,
              journal: { code: 'VT' },
            },
          },
        ]),
      },
    };
    return { svc: new InterrogationCompteService(prisma as never), prisma };
  }

  it('rend le livre-journal, le brouillard et l’à-nouveau provisoire, et leur somme', async () => {
    const { svc } = service();
    const r = await svc.interroger('t1', 'c1', 'x1');
    expect(r.livreJournal).toEqual({ debit: 500000, credit: 120000, solde: 380000 });
    expect(r.brouillard).toEqual({ debit: 0, credit: 30000, solde: -30000 });
    expect(r.aNouveauProvisoire).toEqual({ debit: 75000, credit: 0, solde: 75000 });
    expect(r.soldeAuJour).toBe(425000);
    expect(r.lignes[0]).toMatchObject({ libelle: 'Facture 12', journal: 'VT', lettragePartiel: true, dateEcheance: '2026-03-31' });
  });

  it('chaque lecture écarte les simulations et le solde des comptes de gestion, dans l’exercice et le dossier', async () => {
    const { svc, prisma } = service();
    await svc.interroger('t1', 'c1', 'x1');
    const wheres = [
      ...prisma.ligneEcriture.aggregate.mock.calls.map(([a]) => a.where),
      prisma.ligneEcriture.count.mock.calls[0][0].where,
      prisma.ligneEcriture.findMany.mock.calls[0][0].where,
    ];
    for (const w of wheres) {
      expect(w.compteId).toBe('c1');
      expect(w.ecriture).toMatchObject({ tenantId: 't1', exerciceId: 'x1', estSoldeDesComptesDeGestion: false });
      expect(w.ecriture.statut).not.toBe(StatutEcriture.SITUATION);
    }
    expect(prisma.ligneEcriture.count.mock.calls[0][0].where.ecriture.statut).toEqual({ not: StatutEcriture.SITUATION });
    expect(prisma.ligneEcriture.findMany.mock.calls[0][0].take).toBe(DERNIERES_LIGNES);
  });

  it('dit qu’il ne montre que les plus récentes', async () => {
    const { svc } = service({ nombre: 40 });
    const r = await svc.interroger('t1', 'c1', 'x1');
    expect(r.nombreLignes).toBe(40);
    expect(r.tronque).toBe(true);
  });

  it('le compte d’un autre dossier est introuvable', async () => {
    const { svc, prisma } = service({ compte: null });
    await expect(svc.interroger('t1', 'c9', 'x1')).rejects.toThrow(NotFoundException);
    expect(prisma.compte.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c9', tenantId: 't1' } }));
    expect(prisma.ligneEcriture.aggregate).not.toHaveBeenCalled();
  });
});
