import { Prisma } from '@prisma/client';
import { MODELES_CLOISONNES } from './modeles-cloisonnes';

/**
 * F · LES CLÉS ÉTRANGÈRES D'UNE ÉCRITURE SE JUGENT DANS LE DOSSIER (audit de
 * sécurité du 2026-10-25, zone différée 1 et piste 6).
 *
 * Les règles A à E de la garde bornent la ligne écrite ; rien ne bornait les
 * lignes qu'elle DÉSIGNE. Environ 270 écritures recopient un identifiant reçu
 * du client (`compteId: dto.compteId`, `tiersId: dto.tiersId`…) · un
 * identifiant d'un autre dossier passait, la clé étrangère de la base ne
 * connaissant pas les dossiers, et une lecture avec `include` rendait ensuite
 * le code et le nom de la ligne voisine (piste 6, circularisation). Corriger
 * chaque service un à un en aurait oublié · la règle est posée UNE fois, au
 * moteur, lue dans le schéma (DMMF), sans liste écrite à la main.
 *
 * Ce qui est lu · toute clé scalaire vers un modèle cloisonné, à la racine de
 * `data` et dans les créations et liaisons imbriquées (`create`, `createMany`,
 * `connect`, `connectOrCreate`, `set`, et les `update` imbriqués). Une seule
 * requête par écriture, quelle que soit la profondeur, et aucune quand
 * l'écriture ne désigne rien · le chemin chaud ne paie que ce qu'il porte.
 * Un identifiant introuvable n'est pas jugé ici · la clé étrangère de la base
 * le refuse avec l'erreur que le code appelant sait déjà traiter.
 */

interface Cle {
  /** Champ scalaire porteur de la clé (`compteId`). */
  champ: string;
  cible: string;
}

interface Relation {
  nom: string;
  cible: string;
  /** La relation pointe vers l'identifiant de sa cible, et elle seule se juge par `connect: { id }`. */
  parIdentifiant: boolean;
}

type ModeleDmmf = {
  name: string;
  dbName: string | null;
  fields: readonly {
    name: string;
    kind: string;
    type: string;
    dbName?: string | null;
    relationFromFields?: readonly string[];
    relationToFields?: readonly string[];
  }[];
};

const modeles = new Map<string, ModeleDmmf>((Prisma.dmmf.datamodel.models as unknown as ModeleDmmf[]).map((m) => [m.name, m]));

const versLIdentifiant = (to: readonly string[] | undefined) => !to || to.length === 0 || (to.length === 1 && to[0] === 'id');

/** Clés scalaires et relations de chaque modèle, lues une fois. */
const CLES = new Map<string, Cle[]>();
const RELATIONS = new Map<string, Map<string, Relation>>();
for (const m of modeles.values()) {
  const cles: Cle[] = [];
  const relations = new Map<string, Relation>();
  for (const f of m.fields) {
    if (f.kind !== 'object') continue;
    const parIdentifiant = versLIdentifiant(f.relationToFields);
    relations.set(f.name, { nom: f.name, cible: f.type, parIdentifiant });
    if (MODELES_CLOISONNES.has(f.type) && f.relationFromFields?.length === 1 && parIdentifiant) {
      cles.push({ champ: f.relationFromFields[0], cible: f.type });
    }
  }
  CLES.set(m.name, cles);
  RELATIONS.set(m.name, relations);
}

/** Les identifiants désignés, par modèle cible. */
export type Designes = Map<string, Set<string>>;

function ajouter(acc: Designes, cible: string, valeur: unknown) {
  if (!MODELES_CLOISONNES.has(cible)) return;
  const v = valeur && typeof valeur === 'object' && 'set' in (valeur as object) ? (valeur as { set: unknown }).set : valeur;
  if (typeof v !== 'string' || v === '') return;
  let s = acc.get(cible);
  if (!s) acc.set(cible, (s = new Set()));
  s.add(v);
}

function liaisons(acc: Designes, cible: string, relation: Relation, valeur: unknown) {
  if (!relation.parIdentifiant) return;
  for (const x of Array.isArray(valeur) ? valeur : [valeur]) {
    if (x && typeof x === 'object') ajouter(acc, cible, (x as { id?: unknown }).id);
  }
}

/** Relève, dans `data` d'une écriture sur `modele`, toutes les lignes désignées par une clé. */
export function lignesDesignees(modele: string, data: unknown, acc: Designes = new Map(), profondeur = 0): Designes {
  if (!data || typeof data !== 'object' || profondeur > 8) return acc;
  if (Array.isArray(data)) {
    for (const d of data) lignesDesignees(modele, d, acc, profondeur);
    return acc;
  }
  const d = data as Record<string, unknown>;
  for (const c of CLES.get(modele) ?? []) {
    if (c.champ in d) ajouter(acc, c.cible, d[c.champ]);
  }
  const relations = RELATIONS.get(modele);
  if (!relations) return acc;
  for (const [nom, valeur] of Object.entries(d)) {
    const r = relations.get(nom);
    if (!r || !valeur || typeof valeur !== 'object') continue;
    const v = valeur as Record<string, unknown>;
    if ('create' in v) lignesDesignees(r.cible, v.create, acc, profondeur + 1);
    if ('createMany' in v) lignesDesignees(r.cible, (v.createMany as { data?: unknown })?.data, acc, profondeur + 1);
    if ('connect' in v) liaisons(acc, r.cible, r, v.connect);
    if ('set' in v) liaisons(acc, r.cible, r, v.set);
    if ('connectOrCreate' in v) {
      for (const x of Array.isArray(v.connectOrCreate) ? v.connectOrCreate : [v.connectOrCreate]) {
        const coc = x as { where?: unknown; create?: unknown } | null;
        if (!coc) continue;
        liaisons(acc, r.cible, r, coc.where);
        lignesDesignees(r.cible, coc.create, acc, profondeur + 1);
      }
    }
    if ('update' in v) {
      for (const x of Array.isArray(v.update) ? v.update : [v.update]) {
        const u = x as { data?: unknown } | null;
        lignesDesignees(r.cible, u && typeof u === 'object' && 'data' in u ? u.data : u, acc, profondeur + 1);
      }
    }
    if ('upsert' in v) {
      for (const x of Array.isArray(v.upsert) ? v.upsert : [v.upsert]) {
        const u = x as { create?: unknown; update?: unknown } | null;
        if (!u) continue;
        lignesDesignees(r.cible, u.create, acc, profondeur + 1);
        lignesDesignees(r.cible, u.update, acc, profondeur + 1);
      }
    }
  }
  return acc;
}

const guillemets = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * La requête qui rend les dossiers des lignes désignées · une seule, en
 * `UNION ALL` d'un `SELECT` par table cible, identifiants en paramètres, noms
 * de tables et de colonnes tirés du schéma.
 */
export function requeteDesDossiers(designes: Designes): { sql: string; parametres: string[][] } | null {
  const morceaux: string[] = [];
  const parametres: string[][] = [];
  for (const [cible, ids] of designes) {
    const m = modeles.get(cible);
    if (!m || ids.size === 0) continue;
    const id = m.fields.find((f) => f.name === 'id');
    const tenant = m.fields.find((f) => f.name === 'tenantId');
    if (!id || !tenant || id.type !== 'String') continue;
    parametres.push([...ids]);
    morceaux.push(
      `SELECT ${guillemets(tenant.dbName ?? 'tenantId')}::text AS "dossier", '${cible.replace(/'/g, "''")}'::text AS "modele" FROM ${guillemets(m.dbName ?? m.name)} WHERE ${guillemets(id.dbName ?? 'id')} = ANY($${parametres.length}::text[])`,
    );
  }
  return morceaux.length === 0 ? null : { sql: morceaux.join(' UNION ALL '), parametres };
}
