import type { TypeTiers } from '@prisma/client';

/**
 * LIEUX DE LIVRAISON D'UN CLIENT (ligne sage-l2, fonction 31 · Sage 100,
 * F_LIVRAISON, « lieux de livraison des clients »). Règles pures, sans Prisma.
 *
 * UNE ADRESSE DE LIVRAISON, JAMAIS L'ADRESSE DU CLIENT · la fiche garde
 * l'adresse où partent factures, relances et relevés ; le lieu dit où les
 * marchandises se remettent (Sage la rattache au client, et la gestion
 * commerciale la propose sur ses documents). Aucun effet comptable.
 *
 * DÉFINITION D'OMEGAX, ET DITE · Sage n'en donne que la table · un CLIENT
 * seulement (le fournisseur livre, il ne se fait pas livrer chez lui) ; un
 * intitulé par lieu, unique chez le client sans égard à la casse (deux
 * « Entrepôt » ne se distinguent plus sur un bon) ; UN SEUL PRINCIPAL, le
 * premier d'office (le seul lieu ne doit pas manquer à un document parce
 * que personne n'a coché la case), jamais un lieu en sommeil ; mis en
 * sommeil, il perd la marque, et le client reste sans principal tant que le
 * cabinet n'en désigne pas un autre · en désigner un d'office choisirait où
 * livrer, et c'est une décision (même règle que le RIB principal).
 */

export const LONGUEUR_INTITULE_LIEU = 35;

/** Les lieux servis par client · au-delà, la liste le dit (`tronque`), convention d'OmegaX. */
export const LIEUX_SERVIS_PAR_CLIENT = 200;

export function motifRefusTypeLieu(type: TypeTiers): string | null {
  return type === 'CLIENT'
    ? null
    : 'Un lieu de livraison se rattache à un client · un fournisseur, un salarié ou un autre tiers garde son adresse sur sa fiche.';
}

/** L'intitulé tel qu'il s'enregistre · blancs de bord retirés, blancs intérieurs réduits à un. */
export function intituleDuLieu(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

export function motifRefusIntitule(intitule: string, autres: ReadonlyArray<{ id: string; intitule: string }>, idCourant: string | null): string | null {
  if (intitule === '') return "L'intitulé du lieu de livraison est obligatoire · il le nomme sur les documents.";
  if (intitule.length > LONGUEUR_INTITULE_LIEU) return `L'intitulé du lieu compte au plus ${LONGUEUR_INTITULE_LIEU} caractères.`;
  const pris = autres.find((a) => a.id !== idCourant && a.intitule.toLocaleLowerCase('fr') === intitule.toLocaleLowerCase('fr'));
  return pris ? `Ce client a déjà un lieu « ${pris.intitule} » · deux lieux de même nom ne se distinguent plus sur un document.` : null;
}

/**
 * La marque principale qui résulte d'un geste · d'office pour le premier
 * lieu actif, jamais pour un lieu en sommeil (mis en sommeil, il la perd).
 * Rend le motif quand le geste demande l'impossible.
 */
export function principalApres(p: {
  demande: boolean | undefined;
  actuel: boolean;
  actifApres: boolean;
  autresLieuxActifs: number;
}): { estPrincipal: boolean } | { motif: string } {
  if (p.demande === true && !p.actifApres) {
    return { motif: 'Un lieu en sommeil ne peut pas être le lieu principal · réactivez-le d’abord.' };
  }
  if (!p.actifApres) return { estPrincipal: false };
  if (p.demande !== undefined) return { estPrincipal: p.demande };
  // Création · le premier lieu actif l'est d'office ; modification · inchangé.
  return { estPrincipal: p.actuel || p.autresLieuxActifs === 0 };
}

/**
 * L'intitulé d'un lieu du doublon qui en rencontre un de même nom à la fusion
 * · suivi du code du doublon, borné à la colonne en gardant le code entier.
 */
export function intituleRenomme(intitule: string, codeDoublon: string): string {
  const suffixe = ` · ${codeDoublon}`;
  return `${intitule.slice(0, Math.max(1, LONGUEUR_INTITULE_LIEU - suffixe.length)).trimEnd()}${suffixe}`.slice(0, LONGUEUR_INTITULE_LIEU);
}

/**
 * LES LIEUX DU DOUBLON À LA FUSION, sans collision (second tour de relecture,
 * m5) · un lieu renommé « Entrepôt · CLI-02 » pouvait rencontrer un lieu de ce
 * nom chez l'un ou l'autre client. Rend, pour chaque lieu du doublon qui doit
 * changer de nom, son nouvel intitulé · le code du doublon, puis un rang
 * (« CLI-02-2 », « CLI-02-3 »…) jusqu'à un nom libre chez le client conservé.
 */
export function renommagesALaFusion(
  conserves: readonly string[],
  duDoublon: ReadonlyArray<{ id: string; intitule: string }>,
  codeDoublon: string,
): Map<string, string> {
  const cle = (x: string) => x.toLocaleLowerCase('fr');
  const intitulesConserves = new Set(conserves.map(cle));
  const enCollision = duDoublon.filter((l) => intitulesConserves.has(cle(l.intitule)));
  // Sont pris · les lieux conservés, et ceux du doublon qui gardent leur nom.
  const pris = new Set([...intitulesConserves, ...duDoublon.filter((l) => !intitulesConserves.has(cle(l.intitule))).map((l) => cle(l.intitule))]);
  const renommes = new Map<string, string>();
  for (const l of enCollision) {
    let rang = 1;
    let nom = intituleRenomme(l.intitule, codeDoublon);
    while (pris.has(cle(nom))) {
      rang += 1;
      nom = intituleRenomme(l.intitule, `${codeDoublon}-${rang}`);
    }
    pris.add(cle(nom));
    renommes.set(l.id, nom);
  }
  return renommes;
}
