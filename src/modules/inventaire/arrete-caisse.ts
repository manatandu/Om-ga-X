/**
 * ARRÊTÉ DE CAISSE PAR COUPURES ET PLAFOND D'ENCAISSE · règles pures (ligne
 * microfina-m2, idée 5).
 *
 * Fiche du compte 57 des deux plans (SYCEBNL Partie 2 ch. 3 ; AUDCIF Titre
 * VII) · « le solde du compte caisse doit toujours correspondre exactement à
 * la somme disponible réellement » ; « le solde du compte caisse ne doit être
 * que débiteur ou nul […] un solde créditeur du compte caisse constitue une
 * présomption d'irrégularité de la comptabilité » ; éléments de contrôle ·
 * « procès-verbaux de caisse ; états de reddition de la caisse ; bordereaux
 * de situation journalière ».
 *
 * LE PLAFOND D'ENCAISSE EST UNE CONVENTION DU DOSSIER · aucun texte lu n'en
 * fixe (Microfina++ le nomme « maximum autorisé en caisse »). Il AVERTIT,
 * jamais ne refuse · une règle sans texte ne bloque pas une opération.
 *
 * IL SE COMPARE AU SOLDE DE LA CAISSE, PARTOUT (relecture m5) · l'aperçu le
 * comparait au solde, l'arrêté aux espèces comptées, et les deux pouvaient se
 * contredire le même jour. La fiche du compte 57 veut que « le solde du compte
 * caisse [corresponde] toujours exactement à la somme disponible réellement »
 * · le solde EST l'encaisse que les livres tiennent, la seule que l'aperçu, la
 * situation des caisses et l'arrêté lisent tous trois ; l'écart entre ce
 * solde et les espèces comptées est dit à part (excédent ou manquant).
 *
 * En centimes entiers partout (CLAUDE.md · « un seuil se juge en centimes
 * entiers »).
 */

export interface CoupureSaisie {
  valeurUnitaire: number;
  nombre: number;
}

const auCentime = (x: number) => Number.isFinite(x) && Math.round(x * 100) / 100 === x;

/**
 * LES COUPURES FONT LES ESPÈCES · leur somme est les espèces comptées, calculée
 * ici et jamais reçue (un total saisi à côté contredirait le détail qui le
 * justifie). Refus · valeur non positive ou hors centime, nombre non entier ou
 * négatif, même valeur deux fois (deux lignes de 500 se lisent mal).
 */
export function especesDesCoupures(coupures: readonly CoupureSaisie[]): { centimes: number } | { motif: string } {
  const vues = new Set<number>();
  let total = 0;
  for (const [i, c] of coupures.entries()) {
    if (!auCentime(c.valeurUnitaire) || c.valeurUnitaire <= 0) return { motif: `Coupure ${i + 1} · la valeur faciale doit être positive, au centime.` };
    if (!Number.isInteger(c.nombre) || c.nombre < 0) return { motif: `Coupure ${i + 1} · le nombre doit être un entier positif ou nul.` };
    const v = Math.round(c.valeurUnitaire * 100);
    if (vues.has(v)) return { motif: `La valeur ${(v / 100).toLocaleString('fr-FR')} est saisie deux fois · une ligne par coupure.` };
    vues.add(v);
    total += v * c.nombre;
  }
  if (!Number.isSafeInteger(total)) return { motif: 'Le total des coupures dépasse ce que le logiciel sait compter exactement.' };
  return { centimes: total };
}

export interface VersionPlafond {
  dateEffet: string;
  montantCentimes: number;
  deviseId: string | null;
}

/** Le plafond EN VIGUEUR au jour · la dernière version dont la date d'effet est au plus tard ce jour. */
export function plafondEnVigueur<T extends VersionPlafond>(versions: readonly T[], jour: string): T | null {
  let retenue: T | null = null;
  for (const v of versions) if (v.dateEffet <= jour && (retenue === null || v.dateEffet > retenue.dateEffet)) retenue = v;
  return retenue;
}

/**
 * Le plafond se compare dans SON unité · un plafond en francs ne juge pas une
 * caisse tenue en dollars (« un montant ne se compare pas à un seuil d'une
 * autre monnaie »), et c'est dit plutôt que deviné par un cours.
 */
export function comparaisonAuPlafond(
  montantCentimes: number,
  unite: string | null,
  plafond: VersionPlafond | null,
): { plafondCentimes: number | null; depasse: boolean | null; nonCompare: string | null } {
  if (!plafond) return { plafondCentimes: null, depasse: null, nonCompare: null };
  if ((plafond.deviseId ?? null) !== (unite ?? null)) {
    return { plafondCentimes: null, depasse: null, nonCompare: "Le plafond d'encaisse est fixé dans une autre unité que celle de la caisse · il n'est pas comparé." };
  }
  return { plafondCentimes: plafond.montantCentimes, depasse: montantCentimes > plafond.montantCentimes, nonCompare: null };
}

/** Les mentions qu'un arrêté porte, écrites par le serveur · jamais un refus. */
export function mentionsDeLArrete(a: {
  soldeCentimes: number;
  especesCentimes: number;
  ecrituresAuBrouillard: number;
  brouillardExercicesAnterieurs?: number;
  depassePlafond: boolean | null;
  plafondCentimes: number | null;
  nonCompare: string | null;
}): string[] {
  const m: string[] = [];
  const ecart = a.especesCentimes - a.soldeCentimes;
  if (ecart !== 0) {
    m.push(
      `${ecart > 0 ? 'Excédent' : 'Manquant'} de caisse de ${fr(Math.abs(ecart))} · « le solde du compte caisse doit toujours correspondre exactement ` +
        "à la somme disponible réellement » (fiche du compte 57). Recherchez l'opération non saisie ou mal saisie ; rien n'est passé d'office.",
    );
  }
  if (a.soldeCentimes < 0) {
    m.push('Le solde de la caisse est créditeur · « un solde créditeur du compte caisse constitue une présomption d’irrégularité de la comptabilité » (fiche du compte 57).');
  }
  if (a.ecrituresAuBrouillard > 0) {
    m.push(`Le solde comprend ${a.ecrituresAuBrouillard} écriture(s) au brouillard, que la validation n'a pas encore portées au livre-journal.`);
  }
  if ((a.brouillardExercicesAnterieurs ?? 0) > 0) {
    m.push(
      `Dont ${a.brouillardExercicesAnterieurs} d'un exercice antérieur non clôturé, que le solde remonte faute d'ouverture de la caisse · elles changeront le report si elles changent avant la clôture.`,
    );
  }
  if (a.depassePlafond && a.plafondCentimes !== null) {
    m.push(`Le solde de la caisse dépasse le plafond d'encaisse de ${fr(a.plafondCentimes)} fixé par le dossier · un avertissement, aucun texte n'en fixe.`);
  }
  if (a.nonCompare) m.push(a.nonCompare);
  return m;
}

function fr(centimes: number) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Une heure HH:MM, ou null. */
export function heureValide(h: unknown): string | null {
  return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? h : null;
}
