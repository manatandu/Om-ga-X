import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatutEcriture } from '@prisma/client';
import { RevueEcrituresService } from './revue-ecritures.service';
import { filtreRecherche, lireCriteres } from './recherche-ecritures';
import { estUneRecherche } from '../journaux/impressions-journal';

/**
 * Ligne gl-saisie, fonction 64 · la revue des écritures par le cabinet. Une
 * marque à côté de l'écriture validée, jamais en elle ; le brouillard est
 * écarté et nommé ; le filtre « revues / à revoir » n'est pas le journal.
 */
describe('revue des écritures · le service', () => {
  function service(ecritures: { id: string; statut: StatutEcriture; numeroPiece?: number; revue?: { id: string } | null }[]) {
    const crees: unknown[] = [];
    const supprimees: unknown[] = [];
    const tx = {
      ecriture: {
        findMany: jest.fn(async ({ where }: { where: { tenantId: string; id: { in: string[] }; statut: unknown } }) =>
          ecritures
            .filter((e) => where.id.in.includes(e.id))
            .filter((e) =>
              where.statut === StatutEcriture.VALIDEE ? e.statut === StatutEcriture.VALIDEE : e.statut !== StatutEcriture.VALIDEE,
            )
            .map((e) => ({ id: e.id, numeroPiece: e.numeroPiece ?? null, statut: e.statut, revue: e.revue ?? null })),
        ),
      },
      revueEcriture: {
        create: jest.fn(async (a: unknown) => crees.push(a)),
        findFirst: jest.fn(async ({ where }: { where: { ecritureId: string } }) => (where.ecritureId === 'revue' ? { id: 'r1' } : null)),
        delete: jest.fn(async (a: unknown) => supprimees.push(a)),
      },
    };
    const prisma = { $transaction: jest.fn(async (f: (t: unknown) => unknown) => f(tx)) };
    return { svc: new RevueEcrituresService(prisma as never), tx, crees, supprimees };
  }

  it('revoit les validées, une création par écriture, écarte le brouillard et la situation en les nommant, garde la première revue', async () => {
    const { svc, tx, crees } = service([
      { id: 'v1', statut: StatutEcriture.VALIDEE },
      { id: 'v2', statut: StatutEcriture.VALIDEE, revue: { id: 'deja' } },
      { id: 'b1', statut: StatutEcriture.BROUILLARD, numeroPiece: 7 },
      { id: 's1', statut: StatutEcriture.SITUATION, numeroPiece: 3 },
    ]);
    const b = await svc.marquer('t1', 'u1', ['v1', 'v2', 'b1', 's1', 'v1'], '  relu contre la facture  ');
    expect(b.revues).toBe(1);
    expect(b.dejaRevues).toBe(1);
    expect(b.ecartees.map((e) => [e.numeroPiece, e.motif.split(' ·')[0]])).toEqual([
      [7, 'au brouillard'],
      [3, 'écriture de situation'],
    ]);
    expect(crees).toEqual([{ data: { tenantId: 't1', ecritureId: 'v1', revuePar: 'u1', commentaire: 'relu contre la facture' } }]);
    // Chaque lecture porte le dossier et son statut.
    for (const [{ where }] of tx.ecriture.findMany.mock.calls) {
      expect(where.tenantId).toBe('t1');
      expect(where.statut).toBeDefined();
    }
  });

  it('une écriture d’un autre dossier fait refuser le lot entier, rien n’est marqué', async () => {
    const { svc, crees } = service([{ id: 'v1', statut: StatutEcriture.VALIDEE }]);
    await expect(svc.marquer('t1', 'u1', ['v1', 'ailleurs'])).rejects.toThrow(NotFoundException);
    expect(crees).toEqual([]);
  });

  it('borne le lot et le commentaire', async () => {
    const { svc } = service([]);
    await expect(svc.marquer('t1', 'u1', Array.from({ length: 501 }, (_, i) => `e${i}`))).rejects.toThrow(BadRequestException);
    await expect(svc.marquer('t1', 'u1', ['e1'], 'x'.repeat(501))).rejects.toThrow(BadRequestException);
  });

  it('retire par l’identifiant, et dit ce qui n’est pas revu', async () => {
    const { svc, supprimees } = service([]);
    await expect(svc.retirer('t1', 'revue')).resolves.toEqual({ retiree: true });
    expect(supprimees).toEqual([{ where: { id: 'r1' } }]);
    await expect(svc.retirer('t1', 'autre')).rejects.toThrow(NotFoundException);
  });
});

describe('revue des écritures · le filtre du journal', () => {
  it('« oui » les revues, « non » celles à revoir, illisible refusé', () => {
    const oui = lireCriteres({ revue: 'oui' });
    const non = lireCriteres({ revue: 'non' });
    expect('criteres' in oui && filtreRecherche(oui.criteres)).toEqual({ AND: [{ revue: { isNot: null } }] });
    expect('criteres' in non && filtreRecherche(non.criteres)).toEqual({ AND: [{ revue: { is: null } }] });
    expect(lireCriteres({ revue: 'peut-etre' })).toHaveProperty('motif');
    expect(lireCriteres({ revue: '' })).toEqual({ criteres: {} });
  });

  it('un journal filtré sur la revue n’est pas le journal · il ne s’enregistre pas comme imprimé', () => {
    expect(estUneRecherche({ revue: false })).toBe(true);
    expect(estUneRecherche({})).toBe(false);
  });

  it('la fenêtre et son export lisent le même filtre', () => {
    const fenetre = readFileSync(join(__dirname, 'ecriture.controller.ts'), 'utf8');
    const exportJ = readFileSync(join(__dirname, '..', 'exports', 'export.controller.ts'), 'utf8');
    for (const s of [fenetre, exportJ]) expect(s).toContain('criteresOuRefus({ compte, montant, montantMax, numeroPiece, reference, revue })');
  });
});
