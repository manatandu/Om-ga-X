import type { LigneNoteCalculee } from './types';

/**
 * RUBRIQUES RÉPÉTABLES (une ligne par apporteur, par entité, par produit) ·
 * le serveur rend une ligne par occurrence saisie, avec son `rang`. L'écran
 * ajoute, après la dernière, les lignes vides DEMANDÉES puis le bouton
 * « Ajouter une ligne ». Rien n'est écrit tant qu'aucune cellule n'est
 * remplie ; vider toutes les cellules d'une ligne la retire.
 *
 * LES LIGNES DEMANDÉES SE MÉMORISENT PAR RANG, jamais par un nombre · un rang
 * demandé que le serveur rend ensuite comme ligne réelle (une cellule y a été
 * enregistrée) n'est plus montré vide, et jamais en double. Le rang suivant
 * part du plus grand rang SERVI OU DEMANDÉ, de sorte qu'une ligne vide ne
 * reprend jamais le rang d'une ligne existante.
 */
export type LigneOuAjout = LigneNoteCalculee | { ajouterApres: string; libelle: string };

/** Rangs demandés à l'écran, par clé de rubrique. */
export type RangsDemandes = Record<string, number[]>;

export function lignesAvecAjouts(lignes: LigneNoteCalculee[], nbColonnes: number, demandes: RangsDemandes): LigneOuAjout[] {
  const resultat: LigneOuAjout[] = [];
  lignes.forEach((l, i) => {
    resultat.push(l);
    const repetable = l.cle !== undefined && l.rang !== undefined && l.saisie !== undefined;
    const derniere = repetable && lignes[i + 1]?.cle !== l.cle;
    if (!derniere) return;
    const servis = new Set(lignes.filter((x) => x.cle === l.cle).map((x) => x.rang ?? 0));
    for (const rang of [...(demandes[l.cle!] ?? [])].sort((a, b) => a - b)) {
      if (servis.has(rang)) continue;
      resultat.push({
        ...l,
        rang,
        saisie: Array.from({ length: nbColonnes }, () => null),
        ecartsSaisie: undefined,
      } as LigneNoteCalculee);
    }
    resultat.push({ ajouterApres: l.cle!, libelle: l.libelle });
  });
  return resultat;
}

/** Le rang de la prochaine ligne demandée · après tout rang servi OU demandé. */
export function rangSuivant(lignes: LigneNoteCalculee[], cle: string, demandes: RangsDemandes): number {
  const rangs = [...lignes.filter((x) => x.cle === cle).map((x) => x.rang ?? 0), ...(demandes[cle] ?? [])];
  return rangs.length === 0 ? 0 : Math.max(...rangs) + 1;
}

/**
 * UNE LIGNE DEMANDÉE PUIS ENTIÈREMENT VIDÉE SORT DES LIGNES DEMANDÉES
 * (relecture 2) · le serveur la retire dès que sa dernière cellule est vidée,
 * et la demande gardée la refaisait apparaître vide au même rang. Vrai quand
 * la valeur envoyée est vide et que toutes les AUTRES cellules de la ligne le
 * sont déjà.
 */
export function ligneVideeApres(saisieLigne: (string | number | null)[] | undefined, colonne: number, valeur: string): boolean {
  if (valeur.trim() !== '') return false;
  return (saisieLigne ?? []).every((v, k) => k === colonne || v === null || String(v).trim() === '');
}

/** Les demandes, sans ce rang de cette rubrique. */
export function sansDemande(demandes: RangsDemandes, cle: string, rang: number): RangsDemandes {
  const restants = (demandes[cle] ?? []).filter((r) => r !== rang);
  const autres = Object.fromEntries(Object.entries(demandes).filter(([k]) => k !== cle));
  return restants.length > 0 ? { ...autres, [cle]: restants } : autres;
}
