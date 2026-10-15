/**
 * LIRE PAR TRANCHES · la mémoire ne dépend plus de la taille du dossier.
 *
 * Le banc d'un million de lignes (`docs/capacite-mesuree.md`) l'a établi · ce
 * n'est pas le volume du dossier qui tue l'instance, c'est le nombre de lignes
 * qu'UNE fenêtre réclame d'un coup. Toute route de travail qui parcourt les
 * écritures d'un exercice les lit donc par lots, curseur sur l'identifiant, et
 * ne garde que ce qu'elle rend (audit final F185).
 *
 * DEUX PIÈGES, et chacun rend un chiffre FAUX sans lever d'erreur :
 *
 *  · sans `skip: 1` chez l'appelant, Prisma rend de nouveau la ligne du
 *    curseur à chaque tranche · son montant est compté deux fois ;
 *  · s'arrêter sur un lot VIDE plutôt que sur un lot INCOMPLET fait une
 *    requête de plus à chaque appel, pour rien.
 *
 * L'arrêt se fait donc sur un lot plus court que la taille demandée, et le
 * curseur avance sur le DERNIER élément rendu. `pageApres` écrit les deux
 * arguments de pagination d'une seule façon, pour qu'aucun appelant n'oublie
 * le `skip`.
 */

/**
 * Taille d'un lot de lecture. Cinq mille éléments pèsent quelques mégaoctets
 * et tiennent dans n'importe quel conteneur · l'intérêt n'est pas la vitesse,
 * c'est que la mémoire ne dépende PLUS de la taille du dossier.
 */
export const LOT_LECTURE = 5000;

/**
 * Lot des lectures qui ramènent une écriture AVEC ses lignes · cinq cents
 * écritures, même ordre de grandeur que l'export du journal en flux.
 */
export const LOT_ECRITURES = 500;

export async function lireParLots<T extends { id: string }>(
  charger: (curseur: string | undefined) => Promise<T[]>,
  traiter: (element: T) => void,
  taille = LOT_LECTURE,
): Promise<void> {
  let curseur: string | undefined;
  for (;;) {
    const lot = await charger(curseur);
    for (const element of lot) traiter(element);
    if (lot.length < taille) return;
    curseur = lot[lot.length - 1].id;
  }
}

/**
 * Les arguments Prisma d'une tranche · ordre par identifiant, curseur exclu.
 *
 * LE CURSEUR DE PRISMA RELIT LA LIGNE-CURSEUR EN BASE · supprimée pendant le
 * parcours, la tranche suivante revient VIDE et la boucle s'arrête comme sur
 * la dernière tranche. Pour une lecture de travail qui se relance, c'est un
 * écran incomplet ; pour un LIVRE (journal, grand livre, export remis), c'est
 * un document amputé en silence (CLAUDE.md § 8 bis) · ceux-là paginent par la
 * CLÉ (`idApres`, `apresLaCle`), jamais par ce curseur.
 */
export function pageApres(curseur: string | undefined, taille: number) {
  return {
    orderBy: { id: 'asc' as const },
    take: taille,
    ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
  };
}

/**
 * PAGINER PAR LA CLÉ (relecture « échecs silencieux » de la ligne sage-l7,
 * M6) · la tranche suivante part des VALEURS de la dernière ligne rendue, que
 * le parcours tient en main, et non d'une ligne qu'il faudrait relire en base.
 * Un brouillard retiré, une entrée de registre remplacée pendant le parcours
 * n'arrêtent plus rien · ce qui reste à lire est lu.
 *
 * `idApres` sert l'ordre par identifiant seul ; `apresLaCle` un ordre
 * croissant sur plusieurs champs du modèle lu, l'identifiant en DERNIER (il
 * rend l'ordre total). Les deux se posent DANS le `where` (sous un `AND`),
 * jamais à côté.
 */
export function idApres(curseur: string | undefined): { id?: { gt: string } } {
  return curseur ? { id: { gt: curseur } } : {};
}

/**
 * Un champ de l'ordre de tri, avec la valeur qu'il a sur la dernière ligne
 * rendue · `C`, les champs du filtre du modèle lu (relecture TypeScript,
 * mineur 7) · un champ mal orthographié, ou d'un autre modèle, ne compile
 * plus, là où Prisma l'aurait refusé à la première tranche seulement.
 */
export interface CleDePage<C extends string = string> {
  champ: C;
  valeur: string | number | Date | null;
  /**
   * Le champ admet le nul · PostgreSQL range les nuls EN DERNIER dans un ordre
   * croissant (Prisma ne pose aucune clause `NULLS`) · après une valeur
   * viennent les valeurs plus grandes PUIS les nuls ; après un nul, à ce rang,
   * plus rien.
   */
  nullable?: boolean;
}

/**
 * « Strictement après la dernière ligne rendue » pour un ordre CROISSANT sur
 * `cles` · une branche par champ, égalité sur ceux qui le précèdent. La
 * dernière clé doit être l'identifiant (jamais nul), sans quoi deux lignes de
 * même clé se perdraient entre deux tranches.
 */
export function apresLaCle<W extends { id?: unknown } = Record<string, unknown>>(
  // L'identifiant en DERNIER, exigé par le type comme à l'exécution.
  cles: readonly [...CleDePage<Extract<keyof NoInfer<W>, string>>[], CleDePage<'id'>],
): { OR: W[] } {
  if (cles.length === 0 || cles[cles.length - 1].champ !== 'id') {
    throw new Error("apresLaCle · l'ordre doit finir par l'identifiant, qui le rend total.");
  }
  const liste = cles as readonly CleDePage[];
  const branches: W[] = [];
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (c.valeur === null) continue;
    const plusGrand = c.nullable
      ? { OR: [{ [c.champ]: { gt: c.valeur } }, { [c.champ]: null }] }
      : { [c.champ]: { gt: c.valeur } };
    // Un filtre bâti sur des champs vérifiés par le type de `cles` · la seule
    // conversion, ici, du littéral construit vers le filtre du modèle.
    branches.push({ AND: [...liste.slice(0, i).map((p) => ({ [p.champ]: p.valeur })), plusGrand] } as unknown as W);
  }
  return { OR: branches };
}

/**
 * Une liste bornée qui COMPTE ce qu'elle ne garde pas · un contrôle qui ne
 * montre que ses deux cents premières occurrences doit dire combien il en a
 * trouvé, sans quoi « 200 » se lit comme le total.
 */
export class Collecte<T> {
  readonly elements: T[] = [];
  nombre = 0;

  constructor(private readonly plafond: number) {}

  ajouter(element: T): void {
    this.nombre++;
    if (this.elements.length < this.plafond) this.elements.push(element);
  }

  get tronquee(): boolean {
    return this.nombre > this.elements.length;
  }
}

/**
 * Les N PREMIERS selon un ordre, gardés au fil d'un parcours par tranches ·
 * un écran qui montre les deux mille échéances les plus proches ne doit pas
 * garder en mémoire les cent mille autres pour les trier à la fin. Le tas
 * est retaillé chaque fois qu'il double, puis une dernière fois à la sortie.
 */
export class PremiersSelon<T> {
  private tas: T[] = [];
  nombre = 0;

  constructor(
    private readonly capacite: number,
    private readonly ordre: (a: T, b: T) => number,
  ) {}

  ajouter(element: T): void {
    this.nombre++;
    this.tas.push(element);
    if (this.tas.length >= 2 * this.capacite) this.retailler();
  }

  private retailler(): void {
    this.tas.sort(this.ordre);
    this.tas.length = Math.min(this.tas.length, this.capacite);
  }

  /** Les premiers, dans l'ordre. */
  elements(): T[] {
    this.retailler();
    return this.tas;
  }

  get tronquee(): boolean {
    return this.nombre > this.capacite;
  }
}
