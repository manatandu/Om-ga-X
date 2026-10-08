/**
 * LA DEVISE D'UNE LIGNE D'À-NOUVEAU, DÉCLARÉE (ligne AU3) · ce que l'écran
 * prépare avant l'envoi. Le serveur rejoue toutes les règles
 * (`declaration-devise-a-nouveau.ts`) · ici, seulement lire les champs saisis
 * et dire tôt ce qui manque, sans rien décider à sa place.
 */

/** Une ligne d'à-nouveau qui reste à déclarer, telle que le serveur la sert. */
export interface LigneADeclarer {
  ligneId: string;
  exerciceId: string;
  exercice: string;
  date: string;
  piece: number | null;
  origine: 'IMPORT' | 'REPORT';
  statut: 'BROUILLARD' | 'VALIDEE';
  compteNumero: string;
  compteIntitule: string;
  montant: number;
  motifRefus: string | null;
}

/**
 * Une ligne importée non déclarée dont le report ne se retrouve pas à
 * l'exercice suivant (report au solde, lignes identiques en nombre différent) ·
 * nommée par le serveur, jamais devinée.
 */
export interface ReportNonRetrouve {
  exercice: string;
  exerciceSuivant: string;
  compteNumero: string;
  montant: number;
  motif: 'NON_RETROUVE' | 'AMBIGU';
}

export interface ReponseADeclarer {
  sansDeviseEtrangere: boolean;
  lignes: LigneADeclarer[];
  total: number;
  tronque: boolean;
  nonRetrouvees: ReportNonRetrouve[];
}

/** Une part telle qu'elle est saisie · des textes. */
export interface PartSaisie {
  deviseId: string;
  montantDevise: string;
  cours: string;
  montant: string;
}

export interface PartEnvoyee {
  deviseId: string;
  montantDevise: number;
  coursApplique?: number;
  montant: number;
}

/** Lit un nombre au format francophone (espaces de milliers, virgule décimale). */
export function lireNombre(texte: string): number | null {
  const t = texte.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Les parts prêtes à envoyer, ou le motif qui les arrête à l'écran. Une part
 * vide (rien saisi) est ignorée · aucune part du tout déclare la ligne
 * entièrement en francs. Le cours est facultatif · le serveur le déduit des
 * deux montants (AUDCIF art. 52).
 */
export function partsAEnvoyer(parts: PartSaisie[], montantLigne: number): { parts: PartEnvoyee[] } | { motif: string } {
  const sortie: PartEnvoyee[] = [];
  for (const [i, p] of parts.entries()) {
    const vide = !p.deviseId && !p.montantDevise.trim() && !p.cours.trim() && !p.montant.trim();
    if (vide) continue;
    if (!p.deviseId) return { motif: `Part ${i + 1} · choisissez la devise.` };
    const montantDevise = lireNombre(p.montantDevise);
    const montant = lireNombre(p.montant);
    const cours = p.cours.trim() ? lireNombre(p.cours) : null;
    if (montantDevise === null || montantDevise <= 0) return { motif: `Part ${i + 1} · montant en devise positif attendu.` };
    if (montant === null || montant <= 0) return { motif: `Part ${i + 1} · part en francs positive attendue.` };
    if (p.cours.trim() && (cours === null || cours <= 0)) return { motif: `Part ${i + 1} · cours illisible.` };
    sortie.push({ deviseId: p.deviseId, montantDevise, montant, ...(cours !== null ? { coursApplique: cours } : {}) });
  }
  const somme = sortie.reduce((s, p) => s + p.montant, 0);
  if (somme > Math.abs(montantLigne) + 0.005) {
    return { motif: 'Les parts dépassent le montant de la ligne · le reste en francs ne peut pas être négatif.' };
  }
  return { parts: sortie };
}

/** Le reste en francs, dit à l'écran pendant la saisie. */
export function resteEnFrancs(parts: PartSaisie[], montantLigne: number): number {
  const somme = parts.reduce((s, p) => s + (lireNombre(p.montant) ?? 0), 0);
  return Math.round((Math.abs(montantLigne) - somme) * 100) / 100;
}
