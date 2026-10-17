import { Prisma } from '@prisma/client';

/**
 * LE MOTEUR DE PURGE · supprime TOUTES les lignes d'un dossier, puis le dossier
 * (suppression d'un dossier d'essai échu, décision de Manasse du 2026-10-17).
 *
 * LA LISTE DES TABLES EST LUE DANS LE SCHÉMA (DMMF), JAMAIS ÉCRITE À LA MAIN ·
 * une liste écrite vieillit : une table ajoutée demain serait oubliée, le dossier
 * resterait à moitié là, et la clé étrangère refuserait la suppression du dossier
 * lui-même (panne bruyante) ou, pire, une table sans clé étrangère garderait les
 * données d'un client supprimé (panne silencieuse). `purger-dossier.spec.ts` fait
 * tomber le test si un modèle du schéma n'est ni purgé ni exclu AVEC SON MOTIF.
 *
 * POURQUOI DU SQL BORNÉ ET PAS LE CLIENT PRISMA. Le client de l'application est
 * entouré d'extensions · le cloisonnement refuserait de toucher les lignes d'un
 * autre dossier que celui de la session (l'opérateur est connecté au sien), le
 * journal d'audit écrirait un maillon par ligne supprimée DANS LA CHAÎNE EN
 * COURS DE DESTRUCTION (une écriture sur un dossier qui disparaît, des millions de
 * maillons pour un dossier chargé), et `deleteMany` enverrait une requête par
 * modèle sans ordre des clés étrangères. La voie la plus étroite est la requête
 * brute de la transaction (`$executeRawUnsafe`), que ces extensions n'interceptent
 * pas, avec une borne écrite DANS chaque requête · `WHERE "tenantId" = $1`, ou la
 * sous-requête de son parent pour les tables que leur parent porte. Les noms de
 * tables et de colonnes viennent du schéma (jamais d'une entrée), la valeur du
 * dossier est un paramètre lié, jamais concaténée.
 *
 * L'ORDRE EST CELUI DES CLÉS ÉTRANGÈRES, FEUILLES D'ABORD · une table n'est
 * vidée qu'une fois vidées toutes celles qui la visent. Les cycles (un compte
 * qui pointe son collectif, un taux de TVA et le compte qu'il solde, une
 * écriture et celle qu'elle corrige, un bien et son composant remplacé…) se
 * dénouent en ANNULANT d'abord la clé nullable qui les ferme, sur les seules
 * lignes du dossier · un cycle dont une clé serait obligatoire est refusé à la
 * construction du plan, jamais à la suppression.
 */

/** Ce qui n'est JAMAIS purgé par ce moteur, et pourquoi · liste fermée, motif obligatoire. */
export const MODELES_EXCLUS_DE_LA_PURGE: Readonly<Record<string, string>> = {
  Tenant: 'le dossier lui-même, supprimé en dernier, après toutes ses lignes',
  LicenceSurSiteEmise: 'registre de l’éditeur, hors dossier · aucune ligne n’appartient à un dossier hébergé',
  FormuleAbonnement: 'grille de l’éditeur, hors dossier',
  AbonnementCabinet:
    'abonnement tenu par l’éditeur · un dossier qui en a un n’est jamais supprimable (la suppression est refusée avant toute purge)',
  OptionAbonnement: 'portée par un abonnement de l’éditeur · même refus que l’abonnement',
  FactureAbonnement: 'lien vers une facture du dossier de l’éditeur · même refus que l’abonnement',
  RappelSuppressionEssai:
    'suivi de l’éditeur, porté par le dossier (clé étrangère en cascade) · il part avec lui, et la trace durable est DossierEssaiSupprime',
  DossierEssaiSupprime: 'la trace de la suppression, hors dossier et sans clé étrangère · elle survit au dossier par construction',
};

export type EtapeDePurge =
  | { type: 'DETACHER'; modele: string; table: string; colonne: string; sql: string }
  | { type: 'SUPPRIMER'; modele: string; table: string; sql: string };

interface ChampRelation {
  name: string;
  type: string;
  kind: string;
  isRequired: boolean;
  relationFromFields?: readonly string[];
  relationToFields?: readonly string[];
}

interface Modele {
  name: string;
  dbName: string | null;
  fields: readonly (ChampRelation & { dbName?: string | null })[];
}

const guillemets = (identifiant: string) => `"${identifiant.replace(/"/g, '""')}"`;

const tableDe = (m: Modele) => guillemets(m.dbName ?? m.name);

function colonneDe(m: Modele, nomChamp: string): string {
  const champ = m.fields.find((f) => f.name === nomChamp);
  if (!champ) throw new Error(`Purge · ${m.name}.${nomChamp} introuvable dans le schéma.`);
  return guillemets(champ.dbName ?? champ.name);
}

/**
 * Le prédicat SQL qui désigne les lignes du dossier dans une table, paramètre
 * `$1` = l'identifiant du dossier. Une table qui porte `tenantId` se borne
 * directement ; une table que son parent porte se borne par la sous-requête du
 * parent (relation obligatoire, donc toute ligne a un parent).
 */
function predicat(m: Modele, parNom: Map<string, Modele>, purges: Set<string>, enCours: Set<string>): string {
  if (m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar')) return `${colonneDe(m, 'tenantId')} = $1`;
  if (enCours.has(m.name)) throw new Error(`Purge · boucle de parents sur ${m.name}.`);
  enCours.add(m.name);
  try {
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.isRequired) continue;
      const de = f.relationFromFields ?? [];
      const vers = f.relationToFields ?? [];
      if (de.length !== 1 || vers.length !== 1 || f.type === m.name || !purges.has(f.type)) continue;
      const parent = parNom.get(f.type) as Modele;
      let interne: string;
      try {
        interne = predicat(parent, parNom, purges, enCours);
      } catch {
        continue;
      }
      return `${colonneDe(m, de[0])} IN (SELECT ${colonneDe(parent, vers[0])} FROM ${tableDe(parent)} WHERE ${interne})`;
    }
  } finally {
    enCours.delete(m.name);
  }
  throw new Error(
    `Purge · ${m.name} ne porte pas de tenantId et n’a aucun parent obligatoire qui en porte un · ` +
      'la table ne peut pas être bornée au dossier. La classer dans MODELES_EXCLUS_DE_LA_PURGE avec son motif, ou lui donner un parent.',
  );
}

/**
 * Le plan de purge, tiré du schéma · pur, sans base. `modeles` est injectable pour
 * que les tests éprouvent les cas limites (cycle obligatoire) sur un schéma de
 * poche ; en service, c'est le DMMF de Prisma.
 */
export function planDePurge(modeles: readonly Modele[] = Prisma.dmmf.datamodel.models as unknown as Modele[]): EtapeDePurge[] {
  const parNom = new Map(modeles.map((m) => [m.name, m]));
  const purges = new Set(modeles.map((m) => m.name).filter((n) => !(n in MODELES_EXCLUS_DE_LA_PURGE)));

  // Arêtes enfant -> parent entre modèles purgés (clé étrangère d'un seul champ ·
  // le schéma n'en a pas de composite, un test le garde).
  interface Arete {
    de: string;
    vers: string;
    colonne: string;
    obligatoire: boolean;
  }
  const aretes: Arete[] = [];
  for (const m of modeles) {
    if (!purges.has(m.name)) continue;
    for (const f of m.fields) {
      if (f.kind !== 'object') continue;
      const de = f.relationFromFields ?? [];
      if (de.length === 0) continue;
      if (de.length !== 1) throw new Error(`Purge · clé étrangère composite sur ${m.name}.${f.name}, non gérée.`);
      if (!purges.has(f.type)) continue;
      aretes.push({ de: m.name, vers: f.type, colonne: de[0], obligatoire: f.isRequired });
    }
  }

  // Composantes fortement connexes (Tarjan) · un cycle se dénoue en un seul bloc.
  const sortants = new Map<string, string[]>();
  for (const n of purges) sortants.set(n, []);
  for (const a of aretes) (sortants.get(a.de) as string[]).push(a.vers);
  let compteur = 0;
  const pile: string[] = [];
  const surPile = new Set<string>();
  const indice = new Map<string, number>();
  const bas = new Map<string, number>();
  const composantes: string[][] = [];
  const visiter = (v: string) => {
    indice.set(v, compteur);
    bas.set(v, compteur);
    compteur += 1;
    pile.push(v);
    surPile.add(v);
    for (const w of sortants.get(v) as string[]) {
      if (!indice.has(w)) {
        visiter(w);
        bas.set(v, Math.min(bas.get(v) as number, bas.get(w) as number));
      } else if (surPile.has(w)) {
        bas.set(v, Math.min(bas.get(v) as number, indice.get(w) as number));
      }
    }
    if (bas.get(v) === indice.get(v)) {
      const composante: string[] = [];
      let w: string;
      do {
        w = pile.pop() as string;
        surPile.delete(w);
        composante.push(w);
      } while (w !== v);
      composantes.push(composante);
    }
  };
  for (const n of purges) if (!indice.has(n)) visiter(n);

  const composanteDe = new Map<string, number>();
  composantes.forEach((c, i) => c.forEach((n) => composanteDe.set(n, i)));

  // Kahn sur les composantes · une composante est vidée quand plus aucune autre
  // (non encore vidée) ne la vise. `visees[c]` = nombre de composantes distinctes
  // qui la visent, `parents[c]` = celles qu'elle vise.
  const parents: Set<number>[] = composantes.map(() => new Set<number>());
  const visees: Set<number>[] = composantes.map(() => new Set<number>());
  for (const a of aretes) {
    const c = composanteDe.get(a.de) as number;
    const p = composanteDe.get(a.vers) as number;
    if (c === p) continue;
    parents[c].add(p);
    visees[p].add(c);
  }
  const restant = visees.map((s) => s.size);
  const file: number[] = [];
  restant.forEach((r, i) => {
    if (r === 0) file.push(i);
  });
  const ordre: number[] = [];
  while (file.length > 0) {
    const c = file.shift() as number;
    ordre.push(c);
    for (const p of parents[c]) {
      restant[p] -= 1;
      if (restant[p] === 0) file.push(p);
    }
  }
  if (ordre.length !== composantes.length) throw new Error('Purge · ordre des clés étrangères introuvable (cycle entre composantes).');

  const etapes: EtapeDePurge[] = [];
  for (const c of ordre) {
    const membres = composantes[c];
    const internes = aretes.filter((a) => composanteDe.get(a.de) === c && composanteDe.get(a.vers) === c);
    for (const a of internes) {
      const m = parNom.get(a.de) as Modele;
      if (a.obligatoire) {
        throw new Error(
          `Purge · cycle de clés étrangères OBLIGATOIRES sur ${a.de}.${a.colonne} · aucune ligne ne peut être supprimée avant l’autre.`,
        );
      }
      const col = colonneDe(m, a.colonne);
      etapes.push({
        type: 'DETACHER',
        modele: a.de,
        table: tableDe(m).replace(/"/g, ''),
        colonne: a.colonne,
        sql: `UPDATE ${tableDe(m)} SET ${col} = NULL WHERE ${col} IS NOT NULL AND (${predicat(m, parNom, purges, new Set())})`,
      });
    }
    for (const nom of [...membres].sort()) {
      const m = parNom.get(nom) as Modele;
      etapes.push({
        type: 'SUPPRIMER',
        modele: nom,
        table: tableDe(m).replace(/"/g, ''),
        sql: `DELETE FROM ${tableDe(m)} WHERE ${predicat(m, parNom, purges, new Set())}`,
      });
    }
  }
  return etapes;
}

/** La table du dossier lui-même, pour la dernière instruction. */
export function tableDuDossier(): string {
  const t = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Tenant');
  return guillemets(t?.dbName ?? 'Tenant');
}

export interface ClientBrut {
  $executeRawUnsafe(requete: string, ...valeurs: unknown[]): Promise<number>;
}

export interface BilanDePurge {
  /** Lignes supprimées par modèle, les modèles à zéro écartés · des NOMBRES seulement. */
  lignesParModele: Record<string, number>;
  total: number;
}

/**
 * Exécute le plan DANS la transaction de l'appelant (`tx`), puis supprime le
 * dossier. Rien n'est attrapé ici · toute erreur remonte et fait annuler la
 * transaction entière, jamais un dossier à moitié vidé. La suppression du
 * dossier lui-même est l'ultime contrôle · une seule ligne laissée par un modèle
 * oublié ferait lever la clé étrangère et annuler le tout.
 */
export async function purgerDossier(tx: ClientBrut, tenantId: string, plan: EtapeDePurge[] = planDePurge()): Promise<BilanDePurge> {
  const lignesParModele: Record<string, number> = {};
  let total = 0;
  for (const etape of plan) {
    const n = await tx.$executeRawUnsafe(etape.sql, tenantId);
    if (etape.type === 'SUPPRIMER' && n > 0) {
      lignesParModele[etape.modele] = n;
      total += n;
    }
  }
  const dernier = await tx.$executeRawUnsafe(`DELETE FROM ${tableDuDossier()} WHERE "id" = $1`, tenantId);
  if (dernier !== 1) {
    throw new Error(`Purge · le dossier ${tenantId} n’a pas été supprimé (${dernier} ligne), la transaction est annulée.`);
  }
  return { lignesParModele, total };
}
