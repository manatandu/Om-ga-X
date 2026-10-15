/**
 * EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99) · ce que la
 * fenêtre dit d'un export, écrit une fois et tenu par son spec.
 *
 * Les règles vivent au serveur (`src/modules/exports/modifications/`) · numéro
 * continu par dossier, registre des écritures parties, fichier gardé. L'écran
 * ne recompte rien, il nomme ce que le serveur sert, avec les mots du fichier
 * remis (feuille « Export », ligne « Portée »).
 */

export type ModeExportEcritures = 'MODIFICATIONS' | 'COMPLET';

export interface ApercuExport {
  dernierNumero: number | null;
  nouvelles: number;
  modifiees: number;
  supprimees: number;
  lignes: number;
  enAttente: number;
  plafondLignes: number;
}

export interface ExportServi {
  id: string;
  numero: number;
  mode: ModeExportEcritures;
  inclureBrouillard: boolean;
  produitAt: string;
  produitPar: string;
  nombreEcritures: number;
  nombreNouvelles: number;
  nombreModifiees: number;
  nombreSupprimees: number;
  nombreLignes: number;
  nombreEnAttente: number;
  nomFichier: string;
  taille: number;
  empreinte: string;
}

export interface ListeExports {
  exports: ExportServi[];
  total: number;
  tronque: boolean;
}

/**
 * La portée, comme la feuille « Export » du fichier l'écrit · la numérotation
 * est continue et rien ne se supprime, l'export précédent est donc le numéro
 * d'avant.
 */
export function porteeDeLExport(e: Pick<ExportServi, 'mode' | 'numero'>): string {
  if (e.mode === 'COMPLET') return 'Export complet';
  if (e.numero <= 1) return 'Premier export';
  return `Modifications depuis l'export n° ${e.numero - 1}`;
}

/** Rien à faire partir · ni écriture à envoyer, ni retrait à dire. */
export function apercuVide(a: ApercuExport): boolean {
  return a.nouvelles + a.modifiees + a.supprimees === 0;
}

/** Ce que le prochain export porterait, en une ligne. */
export function resumeApercu(a: ApercuExport): string {
  if (apercuVide(a)) {
    return a.dernierNumero === null
      ? 'Aucune écriture à exporter.'
      : `Aucune modification depuis l'export n° ${a.dernierNumero}.`;
  }
  const morceaux = [
    `${entier(a.nouvelles)} nouvelle${a.nouvelles > 1 ? 's' : ''}`,
    `${entier(a.modifiees)} modifiée${a.modifiees > 1 ? 's' : ''}`,
    `${entier(a.supprimees)} supprimée${a.supprimees > 1 ? 's' : ''}`,
  ];
  return `${morceaux.join(', ')} · ${entier(a.lignes)} ligne${a.lignes > 1 ? 's' : ''}`;
}

/**
 * Ce qui attend le lot suivant · un export des modifications part par lots
 * sous le plafond mesuré (CLAUDE.md § 8 bis), et chaque lot le dit plutôt que
 * de se présenter pour complet.
 */
export function messageEnAttente(enAttente: number): string | null {
  if (enAttente <= 0) return null;
  return `${entier(enAttente)} écriture${enAttente > 1 ? 's' : ''} attend${enAttente > 1 ? 'ent' : ''} le lot suivant · relancez l'export après celui-ci.`;
}

/** Une taille de fichier lisible · un octet n'est pas un montant. */
export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.ceil(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

function entier(n: number): string {
  return n.toLocaleString('fr-FR');
}
