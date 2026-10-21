import { Prisma } from '@prisma/client';
import { MODELES_EXCLUS_DE_LA_PURGE, planDePurge, purgerDossier, RELATIONS_ENTRE_DOSSIERS, tableDuDossier } from './purger-dossier';

/**
 * LE MOTEUR DE PURGE, LU CONTRE LE SCHÉMA · ce qui casserait en silence : un
 * modèle ajouté au schéma et oublié par la purge (le dossier supprimé garderait
 * des lignes, ou la clé étrangère refuserait tout), une table vidée avant celle
 * qui la vise, un cycle dénoué sur une clé obligatoire.
 *
 * Le rejeu sur vraie base (`scripts/rejouer-suppression-essais.cjs`) prouve que
 * les requêtes s'exécutent ; ce spec garde la STRUCTURE du plan, sans base.
 */
const MODELES = Prisma.dmmf.datamodel.models;

describe('le plan de purge couvre le schéma, sans trou ni surplus', () => {
  const plan = planDePurge();
  const supprimes = plan.filter((e) => e.type === 'SUPPRIMER').map((e) => e.modele);

  it('le schéma porte bien des modèles (un recensement vide ne prouverait rien)', () => {
    expect(MODELES.length).toBeGreaterThan(150);
  });

  it('chaque modèle est PURGÉ ou EXCLU avec son motif, jamais les deux, jamais aucun', () => {
    for (const m of MODELES) {
      const purge = supprimes.includes(m.name);
      const exclu = Object.prototype.hasOwnProperty.call(MODELES_EXCLUS_DE_LA_PURGE, m.name);
      expect([m.name, purge !== exclu]).toEqual([m.name, true]);
    }
  });

  it('aucune exclusion ne nomme un modèle que le schéma ne porte plus, et chacune a son motif', () => {
    const connus = new Set(MODELES.map((m) => m.name));
    for (const [nom, motif] of Object.entries(MODELES_EXCLUS_DE_LA_PURGE)) {
      expect([nom, connus.has(nom)]).toEqual([nom, true]);
      expect([nom, motif.trim().length > 20]).toEqual([nom, true]);
    }
  });

  it('un modèle n’est supprimé qu’une fois', () => {
    expect(new Set(supprimes).size).toBe(supprimes.length);
  });

  it('les exclusions sont les tables de l’éditeur, hors dossier · pas une seule table du client', () => {
    const portentTenantId = MODELES.filter((m) => m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name);
    expect(portentTenantId.filter((n) => n in MODELES_EXCLUS_DE_LA_PURGE)).toEqual([]);
  });
});

describe('l’ordre des clés étrangères : feuilles d’abord', () => {
  const plan = planDePurge();
  const rang = new Map<string, number>();
  plan.forEach((e, i) => {
    if (e.type === 'SUPPRIMER') rang.set(e.modele, i);
  });

  it('toute table est vidée AVANT celles qu’elle vise (hors cycles, dénoués par détachement)', () => {
    const fautes: string[] = [];
    for (const m of MODELES) {
      if (!rang.has(m.name)) continue;
      for (const f of m.fields) {
        if (f.kind !== 'object' || !(f.relationFromFields?.length)) continue;
        if (f.type === m.name || !rang.has(f.type)) continue;
        // Une arête dans un cycle (A vise B et B vise A) est dénouée par un détachement · hors de cette règle.
        const retour = MODELES.find((x) => x.name === f.type)?.fields.some((g) => g.kind === 'object' && g.type === m.name && (g.relationFromFields?.length ?? 0) > 0);
        if (retour) continue;
        if ((rang.get(m.name) as number) > (rang.get(f.type) as number)) fautes.push(`${m.name} -> ${f.type}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('un cycle se dénoue en annulant des clés NULLABLES, avant de supprimer ses tables', () => {
    const detachements = plan.filter((e) => e.type === 'DETACHER');
    expect(detachements.length).toBeGreaterThan(5);
    for (const d of detachements) {
      const modele = MODELES.find((m) => m.name === d.modele)!;
      const relation = modele.fields.find((f) => f.kind === 'object' && f.relationFromFields?.includes(d.colonne));
      expect([d.modele, d.colonne, relation?.isRequired]).toEqual([d.modele, d.colonne, false]);
      // Détaché avant de supprimer la table qui le porte.
      const iDetache = plan.indexOf(d);
      const iSupprime = plan.findIndex((e) => e.type === 'SUPPRIMER' && e.modele === d.modele);
      expect(iDetache).toBeLessThan(iSupprime);
    }
  });

  it('les auto-références du schéma (écriture corrigée, facture annulée, composant, collectif…) sont dénouées', () => {
    const detaches = plan.filter((e) => e.type === 'DETACHER').map((e) => `${e.modele}.${(e as { colonne: string }).colonne}`);
    for (const cle of ['Ecriture.corrigeEcritureId', 'Facture.factureAnnuleeId', 'Immobilisation.immobilisationPrincipaleId', 'Compte.collectifId', 'Lettrage.lettrageReconduitId']) {
      expect(detaches).toContain(cle);
    }
  });

  it('le schéma ne porte aucune clé étrangère composite (le moteur n’en gère pas)', () => {
    const composites = MODELES.flatMap((m) => m.fields.filter((f) => (f.relationFromFields?.length ?? 0) > 1).map((f) => `${m.name}.${f.name}`));
    expect(composites).toEqual([]);
  });
});

describe('chaque requête est BORNÉE AU DOSSIER', () => {
  const plan = planDePurge();

  it('toute requête lie le dossier par $1, jamais par concaténation, et nomme la borne', () => {
    for (const e of plan) {
      expect(e.sql).toContain('$1');
      expect(e.sql).toMatch(/\bWHERE\b/);
      // Jamais un identifiant de dossier en clair dans le texte.
      expect(e.sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    }
  });

  it('une table qui porte tenantId se borne directement, une table portée par son parent par la sous-requête du parent', () => {
    const direct = plan.find((e) => e.type === 'SUPPRIMER' && e.modele === 'Ecriture')!;
    expect(direct.sql).toMatch(/WHERE "tenantId" = \$1$/);
    const parParent = plan.find((e) => e.type === 'SUPPRIMER' && e.modele === 'LigneEcriture')!;
    expect(parParent.sql).toMatch(/"ecritureId" IN \(SELECT "id" FROM "ecritures" WHERE "tenantId" = \$1\)/);
    const petitFils = plan.find((e) => e.type === 'SUPPRIMER' && e.modele === 'VentilationAnalytique')!;
    expect(petitFils.sql).toContain('IN (SELECT');
    expect(petitFils.sql).toContain('"tenantId" = $1');
  });

  it('aucune requête ne vise un autre dossier que le paramètre · pas un DELETE sans WHERE', () => {
    expect(plan.filter((e) => !/WHERE/.test(e.sql))).toEqual([]);
  });

  it('la dernière instruction supprime le dossier lui-même, par son identifiant lié', async () => {
    const executer = jest.fn().mockResolvedValue(1);
    await purgerDossier({ $executeRawUnsafe: executer }, 'dossier-1', []);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer.mock.calls[0][0]).toBe(`DELETE FROM ${tableDuDossier()} WHERE "id" = $1`);
    expect(executer.mock.calls[0][1]).toBe('dossier-1');
  });
});

describe('l’exécution', () => {
  it('rejoue le plan dans l’ordre, avec le seul identifiant du dossier, et rend des nombres', async () => {
    const plan = planDePurge();
    const appels: { sql: string; valeurs: unknown[] }[] = [];
    const client = {
      $executeRawUnsafe: jest.fn(async (sql: string, ...valeurs: unknown[]) => {
        appels.push({ sql, valeurs });
        return sql.startsWith('DELETE FROM "ecritures"') ? 12 : sql.startsWith(`DELETE FROM ${tableDuDossier()}`) ? 1 : 0;
      }),
    };
    const bilan = await purgerDossier(client, 'd-9');
    expect(appels).toHaveLength(plan.length + 1);
    expect(appels.every((a) => a.valeurs.length === 1 && a.valeurs[0] === 'd-9')).toBe(true);
    expect(appels.slice(0, plan.length).map((a) => a.sql)).toEqual(plan.map((e) => e.sql));
    expect(bilan).toEqual({ lignesParModele: { Ecriture: 12 }, total: 12 });
  });

  it('le dossier qui ne part pas (ou parti en double) fait ÉCHOUER la purge, jamais un succès muet', async () => {
    await expect(purgerDossier({ $executeRawUnsafe: jest.fn().mockResolvedValue(0) }, 'd-1', [])).rejects.toThrow(/n’a pas été supprimé/);
  });

  it('une erreur de la base remonte telle quelle (la transaction de l’appelant s’annule)', async () => {
    const client = { $executeRawUnsafe: jest.fn().mockRejectedValue(new Error('violation de clé étrangère')) };
    await expect(purgerDossier(client, 'd-1')).rejects.toThrow('violation de clé étrangère');
  });
});

describe('un schéma de poche, pour les cas limites', () => {
  const champ = (name: string, extra: Record<string, unknown> = {}) => ({ name, type: 'String', kind: 'scalar', isRequired: true, ...extra });
  const relation = (name: string, type: string, de: string, obligatoire: boolean) => ({
    name, type, kind: 'object', isRequired: obligatoire, relationFromFields: [de], relationToFields: ['id'],
  });

  it('un cycle de clés OBLIGATOIRES est refusé à la construction du plan, jamais à la suppression', () => {
    const modeles = [
      { name: 'A', dbName: 'a', fields: [champ('id'), champ('tenantId'), champ('bId'), relation('b', 'B', 'bId', true)] },
      { name: 'B', dbName: 'b', fields: [champ('id'), champ('tenantId'), champ('aId'), relation('a', 'A', 'aId', true)] },
    ];
    expect(() => planDePurge(modeles as never)).toThrow(/cycle de clés étrangères OBLIGATOIRES/);
  });

  it('une table sans tenantId et sans parent borné est refusée avec le geste à faire', () => {
    const modeles = [{ name: 'Orpheline', dbName: 'orphelines', fields: [champ('id'), champ('note')] }];
    expect(() => planDePurge(modeles as never)).toThrow(/ne porte pas de tenantId/);
  });

  it('un auto-lien nullable se dénoue par un détachement avant la suppression', () => {
    const modeles = [
      { name: 'Noeud', dbName: 'noeuds', fields: [champ('id'), champ('tenantId'), champ('parentId', { isRequired: false }), relation('parent', 'Noeud', 'parentId', false)] },
    ];
    const plan = planDePurge(modeles as never);
    expect(plan.map((e) => e.type)).toEqual(['DETACHER', 'SUPPRIMER']);
    expect(plan[0].sql).toBe('UPDATE "noeuds" SET "parentId" = NULL WHERE "parentId" IS NOT NULL AND ("tenantId" = $1)');
  });

  it('les noms de tables et de colonnes sont cités (un nom hostile du schéma ne sort pas de ses guillemets)', () => {
    const modeles = [{ name: 'X', dbName: 'a"; DROP TABLE tenants; --', fields: [champ('id'), champ('tenantId')] }];
    const plan = planDePurge(modeles as never);
    expect(plan[0].sql).toBe('DELETE FROM "a""; DROP TABLE tenants; --" WHERE "tenantId" = $1');
  });
});

describe('LA GARDE LATENTE DES CLÉS ÉTRANGÈRES · les relations qui franchissent la frontière d’un dossier', () => {
  // Lu dans le schéma · toute clé vers le dossier par une AUTRE colonne que
  // `tenantId`, et toute clé d'une table HORS dossier (exclue de la purge) vers
  // une table d'un dossier. Une relation nouvelle de cette forme entre deux
  // dossiers ferait tomber la suppression, ou emporterait le voisin en silence.
  const avecTenant = new Set(MODELES.filter((m) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar')).map((m) => m.name));
  const horsDossier = new Set(Object.keys(MODELES_EXCLUS_DE_LA_PURGE).filter((n) => n !== 'Tenant'));
  const trouvees: string[] = [];
  for (const m of MODELES) {
    for (const f of m.fields) {
      const de = (f.relationFromFields ?? []) as readonly string[];
      if (f.kind !== 'object' || de.length === 0) continue;
      const cle = `${m.name}.${de.join(',')}`;
      if (f.type === 'Tenant' && !(de.length === 1 && de[0] === 'tenantId')) trouvees.push(cle);
      else if (horsDossier.has(m.name) && (avecTenant.has(f.type) || f.type === 'Tenant')) trouvees.push(cle);
    }
  }

  it('le recensement trouve encore quelque chose (une liste vide ne prouverait rien)', () => {
    expect(trouvees.length).toBeGreaterThanOrEqual(5);
  });

  it('chaque relation de cette forme est CLASSÉE avec son traitement, et la liste ne nomme rien que le schéma n’a plus', () => {
    expect([...trouvees].sort()).toEqual(Object.keys(RELATIONS_ENTRE_DOSSIERS).sort());
    for (const [cle, motif] of Object.entries(RELATIONS_ENTRE_DOSSIERS)) expect([cle, motif.trim().length > 30]).toEqual([cle, true]);
  });

  it('les cas connus sont là (cellule, combinaison, tiers de cellule, abonnement, rappel)', () => {
    for (const cle of ['Tenant.dossierMereId', 'Tenant.dossierCombinaisonId', 'Tiers.celluleGroupeId', 'AbonnementCabinet.cabinetId', 'RappelSuppressionEssai.cabinetId']) {
      expect(trouvees).toContain(cle);
    }
  });
});
