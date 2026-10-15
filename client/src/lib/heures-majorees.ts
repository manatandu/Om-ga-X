/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · ce que l'écran des heures majorées
 * lit du serveur et envoie au bulletin. Aucune règle ici · le montant est
 * rejoué au serveur sur la majoration déclarée du dossier.
 */

export interface MajorationLue {
  id: string;
  nature: string;
  libelle: string;
  tauxPourCent: number;
  source: string;
  dateEffet: string;
  actif: boolean;
}

export interface ListeMajorations {
  natures: { cle: string; libelle: string; fondement: string; heureEntiere: boolean }[];
  majorations: MajorationLue[];
  tronque: boolean;
}

/** Une ligne saisie à l'onglet Simulation · trois champs, tels que tapés. */
export type LigneHeures = { majorationId: string; heures: string; tauxHoraire: string };

export const LIGNE_HEURES_VIERGE: LigneHeures = { majorationId: '', heures: '', tauxHoraire: '' };

const nombre = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() === '' || Number.isNaN(n) ? undefined : n;
};

/**
 * LES LIGNES QUI PARTENT AU SERVEUR · une ligne vide n'emporte rien ; une
 * ligne commencée et incomplète est dite, jamais envoyée à moitié.
 */
export function heuresPourLeBulletin(lignes: readonly LigneHeures[]): { lignes: { majorationId: string; heures: number; tauxHoraire: number }[]; incompletes: number } {
  const sortie: { majorationId: string; heures: number; tauxHoraire: number }[] = [];
  let incompletes = 0;
  for (const l of lignes) {
    const vide = !l.majorationId && !l.heures.trim() && !l.tauxHoraire.trim();
    if (vide) continue;
    const heures = nombre(l.heures);
    const taux = nombre(l.tauxHoraire);
    if (!l.majorationId || heures === undefined || taux === undefined || heures <= 0 || taux <= 0) {
      incompletes += 1;
      continue;
    }
    sortie.push({ majorationId: l.majorationId, heures, tauxHoraire: taux });
  }
  return { lignes: sortie, incompletes };
}
