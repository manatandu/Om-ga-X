import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MOTIF_LIGNE_TENUE_ENTRE_TEMPS, retenirLesLignesLibres, retirerLesLignesLibres } from './lignes-libres';

/**
 * Relecture lettrage-verrou, M3 · une ligne lettrée ou pointée PENDANT la
 * suppression, la modification ou la réimputation de son écriture ne part pas
 * en silence · le geste tombe en 409 nommé, et sa transaction défait le reste.
 */
function tx(opts: { total: number; libres: number; retenues?: number }) {
  return {
    ligneEcriture: {
      count: jest.fn().mockResolvedValue(opts.total),
      deleteMany: jest.fn().mockResolvedValue({ count: opts.libres }),
    },
    $executeRaw: jest.fn().mockResolvedValue(opts.retenues ?? 0),
  } as unknown as Prisma.TransactionClient & {
    ligneEcriture: { count: jest.Mock; deleteMany: jest.Mock };
    $executeRaw: jest.Mock;
  };
}

describe('lignes libres · jugées dans la transaction qui les touche', () => {
  it('retire les lignes sous le filtre des lignes libres, borné au dossier et au statut demandé', async () => {
    const t = tx({ total: 2, libres: 2 });
    await retirerLesLignesLibres(t, 't1', 'e1', { statut: 'BROUILLARD' });
    expect(t.ligneEcriture.count).toHaveBeenCalledWith({ where: { ecritureId: 'e1', ecriture: { tenantId: 't1' } } });
    expect(t.ligneEcriture.deleteMany).toHaveBeenCalledWith({
      where: { ecritureId: 'e1', ecriture: { tenantId: 't1', statut: 'BROUILLARD' }, lettrageId: null, lettre: null, rapprochementId: null },
    });
  });

  it("une ligne lettrée entre-temps manque au compte · 409 nommé, jamais un retrait partiel accepté", async () => {
    const t = tx({ total: 2, libres: 1 });
    const p = retirerLesLignesLibres(t, 't1', 'e1');
    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(retirerLesLignesLibres(tx({ total: 2, libres: 1 }), 't1', 'e1')).rejects.toThrow(MOTIF_LIGNE_TENUE_ENTRE_TEMPS);
  });

  it('retient les lignes validées libres, une fois chacune, et refuse si une manque', async () => {
    const t = tx({ total: 0, libres: 0, retenues: 2 });
    await retenirLesLignesLibres(t, 't1', ['a', 'b', 'a']);
    const [texte, ...valeurs] = t.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(valeurs).toEqual(['t1', ['a', 'b', 'a']]);
    const sql = texte.join('?');
    for (const garde of ['"lettrageId" IS NULL', '"lettre" IS NULL', '"rapprochementId" IS NULL', `"statut" = 'VALIDEE'`]) expect(sql).toContain(garde);
    await expect(retenirLesLignesLibres(tx({ total: 0, libres: 0, retenues: 1 }), 't1', ['a', 'b'])).rejects.toBeInstanceOf(ConflictException);
  });

  it("rien à retenir · aucune requête", async () => {
    const t = tx({ total: 0, libres: 0 });
    await retenirLesLignesLibres(t, 't1', []);
    expect(t.$executeRaw).not.toHaveBeenCalled();
  });
});
