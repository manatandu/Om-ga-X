import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { garderCloisonnement, MOTIF_LIGNE_DESIGNEE_INTROUVABLE } from './extension-cloisonnement';
import { lignesDesignees, parentQuiPorte, requeteDesDossiers } from './cles-etrangeres';
import { MODELES_CLOISONNES, MODELES_PORTES_PAR_LEUR_PARENT } from './modeles-cloisonnes';
import { journaliserDansTransaction } from '../audit/contexte-audit';
import { CloisonnementViole, horsCloisonnement, perimetreDeGroupe } from './contexte-cloisonnement';
import { dansContexteAudit } from '../audit/contexte-audit';

/**
 * F · LES CLÉS ÉTRANGÈRES D'UNE ÉCRITURE SE JUGENT DANS LE DOSSIER (audit de
 * sécurité du 2026-10-25, zone différée 1 et piste 6). L'identifiant d'une
 * ligne voisine, recopié d'un formulaire, passait la garde · la base ne
 * connaît pas les dossiers.
 */

const D = 'd-1';
const AUTRE = 'd-2';
const dansDossier = <T,>(tenantId: string, f: () => Promise<T>) => dansContexteAudit({ acteurEmail: 'x@y.cd', tenantId }, f);

/** Une base dont la requête des dossiers rend ce qu'on lui donne, et garde ses appels. */
const base = (lus: { dossier: string | null; modele: string }[]) => {
  const appels: { sql: string; parametres: unknown[] }[] = [];
  return {
    appels,
    client: {
      $queryRawUnsafe: jest.fn(async (sql: string, ...parametres: unknown[]) => {
        appels.push({ sql, parametres });
        return lus;
      }),
    } as any,
  };
};

describe('les lignes désignées, lues dans le schéma', () => {
  it('à la racine et dans les créations imbriquées · une écriture et ses lignes', () => {
    const d = lignesDesignees('Ecriture', {
      tenantId: D,
      journalId: 'j-1',
      exerciceId: 'e-1',
      lignes: { create: [{ compteId: 'c-1', debit: 10 }, { compteId: 'c-2', credit: 10 }] },
    });
    expect(d.get('Journal')).toEqual(new Set(['j-1']));
    expect(d.get('Exercice')).toEqual(new Set(['e-1']));
    expect(d.get('Compte')).toEqual(new Set(['c-1', 'c-2']));
  });

  it('createMany, connect et set · tous lus', () => {
    const d = lignesDesignees('Ecriture', {
      journal: { connect: { id: 'j-9' } },
      lignes: { createMany: { data: [{ compteId: 'c-7' }] } },
    });
    expect(d.get('Journal')).toEqual(new Set(['j-9']));
    expect(d.get('Compte')).toEqual(new Set(['c-7']));
  });

  it('une clé nulle ou absente ne désigne rien, et rien ne part', () => {
    expect(requeteDesDossiers(lignesDesignees('LigneEcriture', { debit: 1, tiersId: null }))).toBeNull();
  });

  it('UNE requête pour toutes les tables, identifiants en paramètres', () => {
    const r = requeteDesDossiers(lignesDesignees('Ecriture', { journalId: 'j-1', lignes: { create: [{ compteId: 'c-1' }] } }))!;
    expect(r.sql.split('UNION ALL')).toHaveLength(2);
    expect(r.sql).not.toContain('j-1');
    expect(r.parametres).toEqual(expect.arrayContaining([['j-1'], ['c-1']]));
  });
});

describe('la garde refuse une ligne désignée d’un autre dossier', () => {
  const ecrire = (client: unknown, operation: string, args: unknown, query = jest.fn(async () => ({ id: 'x' }))) =>
    garderCloisonnement(client as never, { model: 'DemandeConfirmation', operation, args, query });

  it('LA PISTE 6 · le tiers d’un autre dossier est refusé, sans rien écrire', async () => {
    const { client } = base([{ dossier: AUTRE, modele: 'Tiers' }]);
    const query = jest.fn(async () => ({ id: 'x' }));
    await expect(
      dansDossier(D, () => ecrire(client, 'create', { data: { tenantId: D, campagneId: 'k', compteId: 'c', tiersId: 't-voisin' } }, query)),
    ).rejects.toThrow(MOTIF_LIGNE_DESIGNEE_INTROUVABLE);
    expect(query).not.toHaveBeenCalled();
  });

  it('une mise à jour qui change la clé est jugée de même', async () => {
    const { client } = base([{ dossier: AUTRE, modele: 'Tiers' }]);
    await expect(
      dansDossier(D, () => ecrire(client, 'update', { where: { id: 'x', tenantId: D }, data: { tiersId: 't-voisin' } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('les lignes du dossier passent', async () => {
    const { client } = base([{ dossier: D, modele: 'Tiers' }, { dossier: D, modele: 'Compte' }]);
    const query = jest.fn(async () => ({ id: 'x' }));
    await dansDossier(D, () => ecrire(client, 'create', { data: { tenantId: D, campagneId: 'k', compteId: 'c', tiersId: 't' } }, query));
    expect(query).toHaveBeenCalled();
  });

  it('le périmètre déclaré d’un groupe est admis, hors cloisonnement rien n’est lu', async () => {
    const groupe = base([{ dossier: AUTRE, modele: 'Tiers' }]);
    const q1 = jest.fn(async () => ({ id: 'x' }));
    await dansDossier(D, () =>
      perimetreDeGroupe([AUTRE], () => ecrire(groupe.client, 'create', { data: { tenantId: D, tiersId: 't' } }, q1)),
    );
    expect(q1).toHaveBeenCalled();
    const sortie = base([{ dossier: AUTRE, modele: 'Tiers' }]);
    await dansDossier(D, () => horsCloisonnement('test', () => ecrire(sortie.client, 'create', { data: { tiersId: 't' } })));
    expect(sortie.appels).toEqual([]);
  });

  it('une table portée par son parent est jugée aussi · la ligne d’écriture porte le compte', async () => {
    const { client } = base([{ dossier: AUTRE, modele: 'Compte' }]);
    const query = jest.fn(async () => ({ id: 'l' }));
    await expect(
      dansDossier(D, () =>
        garderCloisonnement(client, { model: 'LigneEcriture', operation: 'update', args: { where: { id: 'l' }, data: { compteId: 'c-voisin' } }, query }),
      ),
    ).rejects.toThrow(MOTIF_LIGNE_DESIGNEE_INTROUVABLE);
    expect(query).not.toHaveBeenCalled();
  });

  it('une écriture qui ne désigne rien ne coûte aucune requête', async () => {
    const { client, appels } = base([]);
    await dansDossier(D, () => ecrire(client, 'update', { where: { id: 'x', tenantId: D }, data: { destinataire: 'Y' } }));
    expect(appels).toEqual([]);
  });
});

describe('seconde relecture (2026-10-29) · ce que la règle laissait passer ou relisait', () => {
  it('une liaison par une clé autre que l’identifiant est refusée, jamais passée', async () => {
    const { client } = base([]);
    await expect(
      dansDossier(D, () =>
        garderCloisonnement(client, {
          model: 'DemandeConfirmation',
          operation: 'update',
          args: { where: { id: 'x', tenantId: D }, data: { compte: { connect: { tenantId_numero: { tenantId: AUTRE, numero: '52110000' } } } } },
          query: jest.fn(),
        }),
      ),
    ).rejects.toThrow(/par une clé autre que son identifiant/);
  });

  it('une clé vers une ligne d’écriture se juge par le dossier de son écriture', () => {
    expect(parentQuiPorte('LigneEcriture')).toEqual({ champ: 'ecritureId', parent: 'Ecriture' });
    const r = requeteDesDossiers(lignesDesignees('VentilationAnalytique', { ligneEcritureId: 'l-1' }))!;
    expect(r.sql).toMatch(/JOIN "ecritures" p ON p\."id" = c\."ecritureId"/);
    expect(r.parametres).toEqual([['l-1']]);
  });

  it('dans une transaction, une ligne déjà vérifiée ou créée ne se relit pas', async () => {
    const { client, appels } = base([{ dossier: D, modele: 'Compte' }]);
    const tx = { ...client };
    await dansDossier(D, () =>
      journaliserDansTransaction(tx as never, async () => {
        const ecrire = (data: unknown) =>
          garderCloisonnement(client, { model: 'DemandeConfirmation', operation: 'update', args: { where: { id: 'x', tenantId: D }, data }, query: jest.fn(async () => ({})) });
        await ecrire({ compteId: 'c-1' });
        await ecrire({ compteId: 'c-1' });
        // Le groupe créé dans la transaction, désigné ensuite · aucune relecture.
        await garderCloisonnement(client, { model: 'Lettrage', operation: 'create', args: { data: { tenantId: D } }, query: jest.fn(async () => ({ id: 'g-1' })) });
        await garderCloisonnement(client, {
          model: 'LigneEcriture',
          operation: 'updateMany',
          args: { where: { id: { in: ['l'] } }, data: { lettrageId: 'g-1' } },
          query: jest.fn(async () => ({ count: 1 })),
        });
      }),
    );
    expect(appels).toHaveLength(1);
  });

  it('LE SCHÉMA RESTE LISIBLE PAR LA RÈGLE · identifiants textuels, aucun uuid natif, chaque modèle porté a son parent', () => {
    const modeles = Prisma.dmmf.datamodel.models;
    for (const m of modeles) {
      if (!MODELES_CLOISONNES.has(m.name) && !MODELES_PORTES_PAR_LEUR_PARENT.has(m.name)) continue;
      const id = m.fields.find((f) => f.name === 'id');
      expect([m.name, id?.type, (id as unknown as { nativeType?: unknown } | undefined)?.nativeType ?? null]).toEqual([m.name, 'String', null]);
      for (const f of m.fields) {
        if (f.kind !== 'object' || !(MODELES_CLOISONNES.has(f.type) || MODELES_PORTES_PAR_LEUR_PARENT.has(f.type))) continue;
        // Une clé composée, ou vers autre chose que l'identifiant, échapperait à la règle.
        if (f.relationFromFields && f.relationFromFields.length > 0) {
          expect([m.name, f.name, f.relationFromFields.length, f.relationToFields]).toEqual([m.name, f.name, 1, ['id']]);
        }
      }
    }
    for (const porte of MODELES_PORTES_PAR_LEUR_PARENT) expect([porte, parentQuiPorte(porte) !== null]).toEqual([porte, true]);
  });
});
