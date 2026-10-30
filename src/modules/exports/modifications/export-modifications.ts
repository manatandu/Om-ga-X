import { createHash } from 'crypto';
import { StatutEcriture } from '@prisma/client';

/**
 * L'EXPORT DES SEULES MODIFICATIONS (ligne sage-l7, fonction 99 · Sage X3,
 * « numéro d'export » · seuls les enregistrements créés ou modifiés depuis le
 * dernier export partent). Les règles pures, sans base · le service les joue.
 *
 * DÉCISIONS PAR LA LOI (fiche de la ligne, L7-3 et L7-4).
 *
 *  · L'EXPORT EST NUMÉROTÉ, DATÉ, ET GARDÉ · AUDCIF art. 22, 7°, « les états
 *    périodiques fournis soient numérotés et datés », et « chaque donnée
 *    entrée par transmission d'un autre système doit être appuyée d'une pièce
 *    justificative probante ». Le système qui reçoit le fichier doit pouvoir
 *    citer l'envoi · numéro, date, auteur, empreinte du fichier.
 *
 *  · CE QUE « MODIFIÉE » VEUT DIRE · le fichier porte ce que l'art. 22, 1°
 *    nomme, l'origine, le contenu et l'imputation de chaque écriture (date,
 *    journal, pièce, référence, compte, libellé, montants, devise, échéance,
 *    statut, date de valeur de l'art. 22, 4°). Une écriture est modifiée
 *    quand ce contenu a changé depuis son envoi · son EMPREINTE (`empreinte`)
 *    n'est plus celle que le registre a gardée. Le LETTRAGE et le POINTAGE
 *    n'en sont pas · ce sont des rapprochements de lignes, défaits et refaits
 *    jusqu'à la clôture de la période, qui ne changent ni l'origine, ni le
 *    contenu, ni l'imputation de l'écriture ; un lettrage ne renvoie donc rien.
 *
 *  · UNE ÉCRITURE VALIDÉE NE SE RELIT PAS · art. 22, 2°, la validation rend le
 *    traitement irréversible et « interdit toute suppression, addition ou
 *    modification ultérieure ». Partie validée, elle ne change plus · sa
 *    correction (inscription en négatif, art. 20, al. 2) part comme une
 *    écriture nouvelle. Partie AU BROUILLARD, elle est relue à chaque export
 *    jusqu'à ce qu'elle reparte validée · sa validation même est une
 *    modification (le statut est dans l'empreinte), et la receveuse doit la
 *    savoir passée au livre-journal.
 *
 *  · CE QUI EST RETIRÉ SE DIT · une écriture envoyée qui n'existe plus (un
 *    brouillard supprimé) est nommée sur la feuille « Supprimées » de l'export
 *    suivant, une fois, avec l'envoi qui l'avait portée · jamais tue (CLAUDE.md
 *    § 10 bis · la receveuse la garderait, sa balance bouclée).
 *
 *  · RIEN NE SE PERD NI NE SE DOUBLE · le registre est tenu écriture par
 *    écriture, jamais par une date de dernier export · une écriture saisie
 *    dans une transaction encore ouverte au moment de la lecture n'a pas
 *    d'entrée au registre, et part à l'export suivant, quelle que soit
 *    l'horloge de sa création. Une écriture déjà partie et inchangée ne
 *    repart pas.
 *
 * HORS DU CHAMP · l'écriture de SITUATION (aucune opération, jamais au
 * livre-journal, `ecritures-de-situation.ts`) et l'À-NOUVEAU PROVISOIRE
 * (recalculé à chaque relance, jamais validé, remplacé par le report de la
 * clôture · point 11), qu'aucune receveuse ne doit enregistrer. Le report de
 * la clôture, lui, part comme toute écriture.
 *
 * CE QUE L'IMPORT D'OMEGAX EN RELIT, ET CE QU'IL REFUSE (relecture « échecs
 * silencieux », M3) · la première feuille porte, en tête, les colonnes que
 * l'import des écritures reconnaît (`import.service.ts`, `CHAMPS.ECRITURES`),
 * mais l'import ne lit ni la colonne « Mouvement », ni l'« Identifiant », ni
 * la feuille « Supprimées » · une pièce MODIFIÉE y serait créée une seconde
 * fois, une pièce SUPPRIMÉE y resterait. L'import relit donc un envoi qui ne
 * porte que des pièces « Nouvelle » et aucune suppression (le premier export,
 * typiquement), et REFUSE en le nommant tout autre envoi
 * (`motifEnvoiNonRelu`, `import.service.ts`). La relecture complète (remplacer
 * par l'identifiant, retirer les supprimées) est l'échange d'écritures (ligne
 * dossier-l9, fonction 102, `exports/echange/`), qui part de ce format et de
 * ce registre sans les refaire.
 */

/** Les feuilles du classeur d'échange. */
export const FEUILLE_ECRITURES = 'Écritures';
export const FEUILLE_SUPPRIMEES = 'Supprimées';
export const FEUILLE_EXPORT = 'Export';

/**
 * LES COLONNES DE LA PREMIÈRE FEUILLE · les onze premières sont celles que
 * l'import des écritures reconnaît par leur en-tête (date, journal, pièce,
 * référence, compte, libellé, débit, crédit, montant en devise, devise,
 * cours) ; les suivantes ne s'y confondent avec aucune (« Jour de valeur » et
 * non « Date de valeur », que l'import prendrait pour la date).
 */
export const COLONNES_ECHANGE = [
  { header: 'Date', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Code journal', key: 'journal', width: 10 },
  { header: 'N° de pièce', key: 'piece', width: 14 },
  { header: 'Référence', key: 'reference', width: 16 },
  { header: 'Numéro de compte', key: 'compte', width: 14 },
  { header: 'Libellé', key: 'libelle', width: 36 },
  { header: 'Débit', key: 'debit', width: 16, style: { numFmt: '#,##0.00' } },
  { header: 'Crédit', key: 'credit', width: 16, style: { numFmt: '#,##0.00' } },
  { header: 'Montant en devise', key: 'montantDevise', width: 16, style: { numFmt: '#,##0.00' } },
  { header: 'Devise', key: 'devise', width: 8 },
  { header: 'Cours', key: 'cours', width: 12, style: { numFmt: '0.000000' } },
  { header: 'Échéance', key: 'echeance', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Jour de valeur', key: 'jourValeur', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Statut', key: 'statut', width: 11 },
  { header: 'Mouvement', key: 'mouvement', width: 34 },
  { header: "Identifiant de l'écriture", key: 'identifiant', width: 38 },
] as const;

export const COLONNES_SUPPRIMEES = [
  { header: "Identifiant de l'écriture", key: 'identifiant', width: 38 },
  { header: 'Date', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Code journal', key: 'journal', width: 10 },
  { header: 'N° de pièce', key: 'piece', width: 14 },
  { header: 'Libellé', key: 'libelle', width: 36 },
  { header: "Envoyée à l'export n°", key: 'envoyee', width: 14 },
] as const;

/** Une ligne d'écriture telle que le fichier la porte. */
export interface LigneEchange {
  compte: string;
  libelle: string | null;
  debit: string;
  credit: string;
  devise: string | null;
  montantDevise: string | null;
  cours: string | null;
  echeance: string | null;
}

/** Une écriture telle que le fichier la porte · ce dont l'empreinte est faite. */
export interface EcritureEchange {
  id: string;
  date: Date;
  dateValeur: Date | null;
  journal: string;
  numeroPiece: number | null;
  reference: string | null;
  libelle: string;
  statut: StatutEcriture;
  lignes: LigneEchange[];
}

const jourIso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Ce qu'une ligne porte dans le fichier, dans l'ordre des colonnes · ce que l'empreinte lit. */
function contenuDeLaLigne(l: LigneEchange) {
  return [l.compte, l.libelle ?? null, l.debit, l.credit, l.devise, l.montantDevise, l.cours, l.echeance] as const;
}

/**
 * L'ordre des lignes dans le fichier · débits puis crédits, comme le Guide
 * présente une écriture, puis TOUT le contenu de la ligne (compte, libellé,
 * montants, devise, montant en devise, cours, échéance), comparé caractère
 * par caractère.
 *
 * UN ORDRE TOTAL SUR LE CONTENU (relecture TypeScript, M1) · deux lignes que
 * le seul ordre (sens, compte, montants, libellé) laissait à égalité, l'une
 * à échéance du 31 mars, l'autre du 30 avril, gardaient l'ordre où la base
 * les rendait, et la base les rend dans l'ordre physique · un lettrage
 * réécrit la ligne, la déplace, et l'empreinte changeait sans que rien de
 * l'écriture eût changé. La pièce repartait « Modifiée » (contre L7-4) et
 * l'import refusait l'envoi entier. Deux lignes à contenu identique sont
 * indiscernables · leur ordre entre elles ne change ni le fichier ni
 * l'empreinte. Jamais `localeCompare` · il suit la version d'ICU du serveur,
 * et une mise à jour de Node aurait changé l'ordre, donc toutes les
 * empreintes du registre.
 */
export function ordonnerLignes<L extends LigneEchange>(lignes: L[]): L[] {
  return lignes
    .map((l) => ({ l, sens: Number(l.debit) !== 0 ? 0 : 1, cle: JSON.stringify(contenuDeLaLigne(l)) }))
    .sort((a, b) => a.sens - b.sens || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0))
    .map((x) => x.l);
}

/**
 * L'EMPREINTE DU CONTENU · ce qui fait qu'une écriture est « modifiée ». Les
 * montants entrent au centime en texte (un `Decimal` relu ne se compare pas
 * au flottant), les lignes dans l'ordre canonique · une écriture du brouillard
 * réenregistrée à l'identique (lignes recréées sous d'autres identifiants)
 * garde son empreinte et ne repart pas.
 */
export function empreinteEcriture(e: EcritureEchange): string {
  const contenu = {
    date: jourIso(e.date),
    dateValeur: jourIso(e.dateValeur),
    journal: e.journal,
    numeroPiece: e.numeroPiece,
    reference: e.reference ?? null,
    libelle: e.libelle,
    statut: e.statut,
    lignes: ordonnerLignes(e.lignes).map(contenuDeLaLigne),
  };
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex');
}

/**
 * LE N° DE PIÈCE QUE LE FICHIER PORTE · l'import regroupe ses lignes par date,
 * journal et pièce (`import.service.ts`). Sans numéro (journal à numérotation
 * MANUELLE), deux écritures du même jour et du même journal fusionneraient en
 * une · la pièce se nomme alors par le début de l'identifiant, et une
 * collision restante (même numéro, même jour, même journal) est départagée de
 * même par `piecesDistinctes`.
 */
export function pieceDuFichier(numeroPiece: number | null, id: string): string {
  return numeroPiece !== null && numeroPiece !== undefined ? String(numeroPiece) : `sans n° · ${id.slice(0, 8)}`;
}

/**
 * DEUX ÉCRITURES NE PARTAGENT JAMAIS UNE CLÉ DE PIÈCE DANS LE FICHIER · la clé
 * de l'import est (date, journal, pièce). Une seconde écriture sur une clé déjà
 * prise prend le début de son identifiant en suffixe. La mémoire se vide à
 * chaque jour, le fichier étant écrit dans l'ordre des dates.
 */
export class PiecesDistinctes {
  private jour = '';
  private prises = new Map<string, string>();

  piece(e: { id: string; date: Date; journal: string; numeroPiece: number | null }): string {
    const jour = e.date.toISOString().slice(0, 10);
    if (jour !== this.jour) {
      this.jour = jour;
      this.prises = new Map();
    }
    const brute = pieceDuFichier(e.numeroPiece, e.id);
    const cle = `${e.journal}|${brute}`;
    const deja = this.prises.get(cle);
    if (deja === undefined || deja === e.id) {
      this.prises.set(cle, e.id);
      return brute;
    }
    return `${brute} · ${e.id.slice(0, 8)}`;
  }
}

/** Ce que le registre sait d'une écriture partie. */
export interface EntreeRegistre {
  numeroExport: number;
  statutExporte: StatutEcriture;
  empreinte: string;
}

export type Mouvement = 'NOUVELLE' | 'MODIFIEE' | 'RENVOYEE';

/** Le mouvement d'une écriture au regard du registre · le contenu actuel contre ce qui est parti. */
export function mouvementDe(entree: EntreeRegistre | undefined, empreinteActuelle: string): Mouvement {
  if (!entree) return 'NOUVELLE';
  return entree.empreinte === empreinteActuelle ? 'RENVOYEE' : 'MODIFIEE';
}

/**
 * Le libellé de la colonne « Mouvement », qui dit à la receveuse quoi faire de
 * la pièce · l'ajouter, la REMPLACER (identifiant à l'appui), ou rien. Une
 * pièce partie au brouillard et validée depuis le dit · c'est son entrée au
 * livre-journal (art. 22, 2°).
 */
export function libelleMouvement(m: Mouvement, entree: EntreeRegistre | undefined, statutActuel: StatutEcriture): string {
  if (m === 'NOUVELLE' || !entree) return 'Nouvelle';
  if (m === 'MODIFIEE') {
    const validee =
      entree.statutExporte === StatutEcriture.BROUILLARD && statutActuel === StatutEcriture.VALIDEE ? ' · validée depuis' : '';
    return `Modifiée · remplace l'envoi n° ${entree.numeroExport}${validee}`;
  }
  return `Déjà envoyée au n° ${entree.numeroExport}`;
}

/** Le nom du fichier · le numéro dedans, pour qu'aucun envoi n'en écrase un autre. */
export function nomFichierExport(numero: number, jour: Date): string {
  return `ecritures-export-${String(numero).padStart(4, '0')}-${jour.toISOString().slice(0, 10)}.xlsx`;
}

/** L'empreinte d'un fichier produit · celle que la receveuse peut recalculer. */
export function empreinteFichier(contenu: Buffer): string {
  return createHash('sha256').update(contenu).digest('hex');
}

/**
 * LE REFUS D'UN EXPORT VIDE · un export ne prend un numéro que s'il porte
 * quelque chose (une écriture ou une suppression à dire) · un numéro sans
 * contenu ne ferait qu'allonger la suite que la receveuse doit suivre.
 */
export function motifExportVide(dernierNumero: number | null): string {
  return dernierNumero === null
    ? "Aucune écriture à exporter · le dossier n'a encore rien qui puisse partir."
    : `Aucune modification depuis l'export n° ${dernierNumero} · rien n'est parti, aucun numéro n'est pris.`;
}

/**
 * UNE ÉCRITURE QU'AUCUN EXPORT NE PEUT PORTER (relecture « échecs
 * silencieux », m3) · une écriture ne se coupe jamais, et celle qui dépasse à
 * elle seule le plafond de lignes attendrait toujours, retenant derrière elle
 * toutes les nouvelles · le refus disait « aucune modification ». Il la nomme.
 */
export function motifHorsPlafond(e: { journal: string; numeroPiece: number | null; date: Date; lignes: number }, plafond: number): string {
  const piece = e.numeroPiece === null ? 'sans numéro' : `n° ${e.numeroPiece}`;
  const jour = e.date.toISOString().slice(0, 10).split('-').reverse().join('/');
  return (
    `La pièce ${piece} du journal ${e.journal}, du ${jour}, porte ${e.lignes.toLocaleString('fr-FR')} lignes, ` +
    `au-delà du plafond de ${plafond.toLocaleString('fr-FR')} lignes d'un export · une écriture ne se coupe pas, ` +
    "et aucun export ne peut la porter. Rien n'est parti, aucun numéro n'est pris · les pièces qui la suivent " +
    'attendent derrière elle.'
  );
}

/** Le texte de l'import des écritures pour un envoi qu'il ne sait pas relire · jumeau de l'en-tête ci-dessus. */
export const MENTION_RELECTURE =
  "Ce classeur se relit dans un autre dossier OmegaX par Fichier > Échanger des écritures · chaque écriture y naît, " +
  "y est remplacée ou retirée au brouillard par son identifiant, jamais deux fois. Fichier > Importer des données " +
  "n'en relit que les pièces « Nouvelle », sans feuille « Supprimées ».";

/** L'en-tête de la colonne du mouvement, et le mouvement que l'import sait relire. */
const ENTETE_MOUVEMENT = COLONNES_ECHANGE.find((c) => c.key === 'mouvement')!.header;
const MOUVEMENT_RELU = libelleMouvement('NOUVELLE', undefined, StatutEcriture.VALIDEE);

/**
 * L'ENVOI QUE L'IMPORT NE SAIT PAS RELIRE (relecture « échecs silencieux »,
 * M3) · une pièce « Modifiée » ou « Déjà envoyée » serait créée une seconde
 * fois chez la receveuse, une pièce de la feuille « Supprimées » y resterait,
 * sa balance bouclée. L'import des écritures REFUSE donc le fichier ENTIER,
 * en le nommant · ni à moitié, ni en silence. `null` · rien ne s'y oppose
 * (fichier sans colonne « Mouvement », ou seulement des « Nouvelle »).
 */
export function motifEnvoiNonRelu(colonnes: string[], lignes: string[][], lignesSupprimees: number): string | null {
  const motifs: string[] = [];
  const i = colonnes.findIndex((c) => c.trim() === ENTETE_MOUVEMENT);
  if (i >= 0) {
    const autres = lignes.map((l, rang) => ({ rang, m: (l[i] ?? '').trim() })).filter((x) => x.m !== '' && x.m !== MOUVEMENT_RELU);
    if (autres.length > 0) {
      motifs.push(
        `${autres.length} ligne${autres.length > 1 ? 's' : ''} de la colonne « ${ENTETE_MOUVEMENT} » ` +
          `remplace${autres.length > 1 ? 'nt' : ''} ou renvoie${autres.length > 1 ? 'nt' : ''} une pièce déjà envoyée ` +
          `(première à la ligne ${autres[0].rang + 2} · « ${autres[0].m} ») · l'import ${autres.length > 1 ? 'les' : 'la'} ` +
          'créerait une seconde fois',
      );
    }
  }
  if (lignesSupprimees > 0) {
    motifs.push(
      `la feuille « ${FEUILLE_SUPPRIMEES} » nomme ${lignesSupprimees} pièce${lignesSupprimees > 1 ? 's' : ''} retirée` +
        `${lignesSupprimees > 1 ? 's' : ''} depuis leur envoi · l'import ne sait pas retirer une pièce`,
    );
  }
  if (motifs.length === 0) return null;
  return (
    `Ce fichier est un export des modifications que l'import ne sait pas relire · ${motifs.join(' ; ')}. ` +
    "Rien n'est importé. Un tel envoi se relit par Fichier > Échanger des écritures, qui remplace et retire les " +
    'pièces par leur identifiant.'
  );
}

