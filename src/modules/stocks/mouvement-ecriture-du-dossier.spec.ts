import { BadRequestException } from '@nestjs/common';
import { MagasinService } from './magasin.service';
import { PrismaService } from '../../common/prisma.service';

/**
 * UN MOUVEMENT DE MAGASIN NE SE LIE QU'À UNE ÉCRITURE DU MÊME DOSSIER.
 * Audit du serveur du 2026-09-27, F5.
 */

function monter(
  ecritureDuDossier: boolean,
  statut = 'BROUILLARD',
  lignesSurLeCompte: Array<{ debit: number; credit: number }> = [{ debit: 100, credit: 0 }],
  dejaLies: Array<{ articleId: string; ordre: number; cout: number | null }> = [],
  existants: Array<{ ordre: number; date: Date; sens: string; quantite: number; cout: number | null; piece: string }> = [],
) {
  const create = jest.fn().mockResolvedValue({ id: 'm1' });
  const findFirstEcriture = jest.fn().mockResolvedValue(ecritureDuDossier ? { id: 'e1', statut, numeroPiece: 4 } : null);
  const verrous: string[] = [];
  const prisma: Record<string, unknown> = {
    // Relevé MAG-LIEN, point 5 · le lien se juge sous le verrou de l'écriture.
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: jest.fn(async (morceaux: TemplateStringsArray) => {
      verrous.push(morceaux.join('?'));
      return [];
    }),
    // Le verrou du dossier, pris d'abord (`common/ordre-des-verrous.spec.ts`).
    $executeRaw: jest.fn(async (morceaux: TemplateStringsArray | { sql: string }) => {
      verrous.push('raw' in morceaux ? morceaux.join('?') : (morceaux as { sql: string }).sql);
      return 0;
    }),
    tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
    // Le plan du dossier · le 31100000 semé, ouvert dessous en 31100001, et le
    // 31200000, autre compte du plan.
    compte: {
      findMany: jest.fn(async ({ where }: { where: { numero: { startsWith: string } } }) =>
        [
          { id: 'c31', numero: '31110000' },
          { id: 'c31-1', numero: '31110001' },
          { id: 'c312', numero: '31120000' },
        ].filter((c) => c.numero.startsWith(where.numero.startsWith)),
      ),
    },
    articleStock: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'a1', actif: true, code: 'ART1', compteId: 'c31', methodeValorisation: 'PEPS', compte: { numero: '31110000' } }),
    },
    ecriture: { findFirst: findFirstEcriture },
    // Relevé MAG-LIEN · les lignes de l'écriture liée sur le compte de l'article.
    ligneEcriture: {
      findMany: jest.fn(async ({ where }: { where: { compteId: { in: string[] } } }) =>
        where.compteId.in.includes('c31') ? lignesSurLeCompte : [],
      ),
    },
    // Magasin vide · aucune sortie à servir, l'entrée passe (audit final F133).
    mouvementStock: {
      aggregate: jest.fn().mockResolvedValue({ _max: { ordre: 3 } }),
      findMany: jest.fn(async ({ where }: { where: { ecritureId?: string } }) => (where.ecritureId ? dejaLies : existants)),
      create,
    },
  };
  const service = new MagasinService(prisma as unknown as PrismaService, {} as never);
  return { service, create, findFirstEcriture, prisma, verrous };
}

const DTO = { date: '2026-03-01', sens: 'ENTREE', quantite: 5, cout: 100, piece: 'BL-1', ecritureId: 'e1' };

describe('mouvement de magasin et écriture liée', () => {
  it('refuse une écriture absente du dossier, sans rien créer', async () => {
    const m = monter(false);
    await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never)).rejects.toThrow(BadRequestException);
    expect(m.create).not.toHaveBeenCalled();
    // La recherche porte la borne du dossier.
    expect(m.findFirstEcriture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1', tenantId: 't1' } }));
  });

  it('accepte l’écriture du dossier', async () => {
    const m = monter(true);
    await m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ecritureId: 'e1' }) }));
  });

  it('refuse une écriture de situation, qui ne fait entrer aucun bien (ligne sage-l1, relecture B3)', async () => {
    // Liée, la simulation retenait le mouvement et le mouvement elle · un
    // stock entrait au magasin sur une pièce qui n'enregistre rien.
    const m = monter(true, 'SITUATION');
    await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never)).rejects.toThrow(/écriture de situation/);
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe('relevé MAG-LIEN · l’écriture liée porte le mouvement, sur le compte de l’article et pour sa valeur', () => {
  it('refuse une écriture qui ne débite pas le compte de stock de l’article', async () => {
    const m = monter(true, 'BROUILLARD', [{ debit: 0, credit: 100 }]);
    await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never)).rejects.toThrow(/ne porte pas le compte 31110000/);
    expect(m.create).not.toHaveBeenCalled();
  });

  it('refuse une entrée au-delà de ce que l’écriture porte, mouvements déjà liés compris', async () => {
    // L'écriture débite 150 au 31 · un mouvement de 80 y est déjà lié, celui-ci en vaut 100.
    const m = monter(true, 'BROUILLARD', [{ debit: 150, credit: 0 }], [{ articleId: 'a2', ordre: 1, cout: 80 }]);
    await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never)).rejects.toThrow(/en valent 80,00/);
    expect(m.create).not.toHaveBeenCalled();
  });

  it('admet plusieurs articles d’un même compte sur une écriture qui les porte tous', async () => {
    const m = monter(true, 'BROUILLARD', [{ debit: 180, credit: 0 }], [{ articleId: 'a2', ordre: 1, cout: 80 }]);
    await m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never);
    expect(m.create).toHaveBeenCalled();
  });

  it('une sortie se juge sur la valeur que la méthode calcule, jamais saisie', async () => {
    // 10 unités entrées pour 1 000 · une sortie de 5 vaut 500 (P.E.P.S.).
    const stock = [{ ordre: 1, date: new Date('2026-02-01'), sens: 'ENTREE', quantite: 10, cout: 1000, piece: 'BL-0' }];
    const sortie = { date: '2026-03-01', sens: 'SORTIE', quantite: 5, piece: 'BS-1', ecritureId: 'e1' };
    const courte = monter(true, 'BROUILLARD', [{ debit: 0, credit: 400 }], [], stock);
    await expect(courte.service.enregistrerMouvement('t1', 'u', 'a1', sortie as never)).rejects.toThrow(/celui-ci 500,00/);
    const juste = monter(true, 'BROUILLARD', [{ debit: 0, credit: 500 }], [], stock);
    await juste.service.enregistrerMouvement('t1', 'u', 'a1', sortie as never);
    expect(juste.create).toHaveBeenCalled();
  });

  it('relecture point 1 · une écriture portée au sous-compte ouvert sous le compte semé de l’article admet le lien', async () => {
    const m = monter(true);
    const lignes = (m.prisma.ligneEcriture as { findMany: jest.Mock }).findMany;
    lignes.mockImplementation(async ({ where }: { where: { compteId: { in: string[] } } }) =>
      where.compteId.in.includes('c31-1') ? [{ debit: 100, credit: 0 }] : [],
    );
    await m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never);
    expect(m.create).toHaveBeenCalled();
    // Le 31120000, autre compte du plan, n'est pas un sous-compte de l'article.
    expect(lignes.mock.calls[0][0].where.compteId.in).not.toContain('c312');
  });

  it('relecture point 5 · le lien se juge sous le verrou de l’écriture, avant la création', async () => {
    const m = monter(true);
    await m.service.enregistrerMouvement('t1', 'u', 'a1', DTO as never);
    const ligne = m.verrous.findIndex((v) => /FROM "ecritures" .*FOR UPDATE/.test(v));
    const dossier = m.verrous.findIndex((v) => /pg_advisory_xact_lock/.test(v));
    expect(ligne).toBeGreaterThan(-1);
    // Le dossier, puis la ligne.
    expect(dossier).toBeGreaterThan(-1);
    expect(dossier).toBeLessThan(ligne);
  });

  it('relecture point 5 · une sortie que la méthode ne valorise pas est refusée nommément, jamais comptée nulle', async () => {
    // Aucune entrée · la sortie ne se valorise pas.
    const sortie = { date: '2026-03-01', sens: 'SORTIE', quantite: 5, piece: 'BS-1', ecritureId: 'e1' };
    const m = monter(true, 'BROUILLARD', [{ debit: 0, credit: 400 }]);
    // Le contrôle du magasin vide passe (fiche déjà fausse) · on juge le lien seul.
    (m.service as unknown as { nouvellesSortiesImpossibles: () => Promise<null> }).nouvellesSortiesImpossibles = async () => null;
    await expect(m.service.enregistrerMouvement('t1', 'u', 'a1', sortie as never)).rejects.toThrow(/ne se calcule pas/);
    expect(m.create).not.toHaveBeenCalled();
  });
});
