import { HttpException } from '@nestjs/common';
import { NatureImpressionDifferee } from '@prisma/client';

/**
 * L'IMPRESSION DIFFÉRÉE (ligne sage-l7, fonction 59 ; décision L7-2) · règles
 * pures, sans base.
 *
 * Une édition demandée MAINTENANT, produite ENSUITE, retrouvée PLUS TARD.
 * Trois livres, ceux que l'export produit déjà en flux (journal, grand livre,
 * balance) · la demande passe par le MÊME moteur, sous le MÊME plafond
 * (CLAUDE.md § 8 bis), qui refuse avant le premier octet. Un refus ou une
 * panne rend la demande ÉCHOUÉE, motif dit · jamais un fichier partiel rangé
 * comme complet (AUDCIF art. 22, 6°).
 *
 * NUMÉROTÉE ET DATÉE · AUDCIF art. 22, 7°, « les états périodiques fournis
 * soient numérotés et datés » · la suite est continue par dossier ; la date de
 * la demande et celle de la production restent toutes deux.
 */

/**
 * Au-delà, une production commencée et jamais finie est dite INTERROMPUE ·
 * rien n'a été rangé, et on ne sait pas pourquoi (délai de la requête qui la
 * portait dépassé, instance arrêtée, processus tombé) · le motif n'affirme
 * donc aucun redémarrage (relecture M5). Convention d'OmegaX · trente
 * minutes couvrent le plus long export mesuré sous le plafond, 319 s pour
 * 197 000 lignes (balance et feuilles, banc du 2026-10-04,
 * docs/capacite-mesuree.md).
 *
 * LE DÉLAI DE REQUÊTE DE CLOUD RUN N'A PAS ÉTÉ LU · le déploiement ne pose
 * aucun `--timeout`, le service a donc celui que Cloud Run donne par défaut,
 * et sa documentation officielle (cloud.google.com/run/docs/configuring/
 * request-timeout, redirigée vers docs.cloud.google.com) est restée
 * inaccessible depuis l'environnement de développement le 2026-10-15
 * (politique réseau). Aucun chiffre n'est donc repris de mémoire · les
 * trente minutes restent, et le délai réel, avec l'allocation du processeur
 * hors requête, est une décision portée à Manasse. Une production plus longue
 * que le délai de requête ne finit pas · elle est dite interrompue ici.
 */
export const DELAI_PRODUCTION_MS = 30 * 60 * 1000;

/** Au-delà, la liste se tronque et le dit (CLAUDE.md § 8 bis). */
export const PLAFOND_IMPRESSIONS_LISTEES = 50;

export const MOTIF_INTERROMPUE =
  "Production non terminée dans le délai de requête du serveur · rien n'a été rangé, demandez l'édition de nouveau.";

/** Le livre produit mais le fichier jamais rangé (relecture m4) · rien n'est gardé. */
export const MOTIF_NON_RANGEE =
  "Le livre a été produit, mais son fichier n'a pas pu être rangé · rien n'est gardé, demandez l'édition de nouveau.";

export interface CriteresJournal {
  exerciceId: string;
  journalId: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  inclureBrouillard: boolean;
}

export interface CriteresGrandLivre {
  exerciceId: string;
  format: 'fpm' | 'plat';
}

export interface CriteresBalance {
  exerciceId: string;
  grandsLivres: boolean;
}

export type CriteresImpression = CriteresJournal | CriteresGrandLivre | CriteresBalance;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function jourOuNull(valeur: unknown, nom: string): string | null | { motif: string } {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  if (typeof valeur !== 'string' || !JOUR.test(valeur) || Number.isNaN(Date.parse(`${valeur}T00:00:00Z`))) {
    return { motif: `${nom} illisible · une date AAAA-MM-JJ est attendue.` };
  }
  return valeur;
}

/**
 * Les critères d'une demande, relus et ramenés à leur forme · ce que la
 * demande garde est ce que le moteur recevra, jamais un champ que le client
 * aurait ajouté. Un critère illisible est REFUSÉ à la demande, avant tout
 * numéro · une demande qui ne peut que tomber n'en prend pas.
 */
export function criteresOuMotif(
  nature: NatureImpressionDifferee,
  brut: Record<string, unknown>,
): { criteres: CriteresImpression } | { motif: string } {
  const exerciceId = brut.exerciceId;
  if (typeof exerciceId !== 'string' || exerciceId.trim() === '') {
    return { motif: "L'exercice de l'édition est exigé." };
  }
  if (nature === NatureImpressionDifferee.JOURNAL) {
    const journalId = brut.journalId;
    if (journalId !== undefined && journalId !== null && journalId !== '' && typeof journalId !== 'string') {
      return { motif: 'Journal illisible.' };
    }
    const debut = jourOuNull(brut.dateDebut, 'Date de début');
    if (debut !== null && typeof debut === 'object') return debut;
    const fin = jourOuNull(brut.dateFin, 'Date de fin');
    if (fin !== null && typeof fin === 'object') return fin;
    if (debut && fin && debut > fin) return { motif: 'La date de début suit la date de fin.' };
    if (brut.inclureBrouillard !== undefined && typeof brut.inclureBrouillard !== 'boolean') {
      return { motif: 'Brouillard compris · oui ou non.' };
    }
    return {
      criteres: {
        exerciceId,
        journalId: typeof journalId === 'string' && journalId !== '' ? journalId : null,
        dateDebut: debut,
        dateFin: fin,
        // Comme la fenêtre du journal · le brouillard est montré par défaut,
        // et marqué comme tel dans le livre produit.
        inclureBrouillard: brut.inclureBrouillard !== false,
      },
    };
  }
  if (nature === NatureImpressionDifferee.GRAND_LIVRE) {
    const format = brut.format ?? 'fpm';
    if (format !== 'fpm' && format !== 'plat') {
      return { motif: 'Présentation du grand livre inconnue · « fpm » (présentation du cabinet) ou « plat ».' };
    }
    return { criteres: { exerciceId, format } };
  }
  if (brut.grandsLivres !== undefined && typeof brut.grandsLivres !== 'boolean') {
    return { motif: 'Grands livres de la balance · oui ou non.' };
  }
  return { criteres: { exerciceId, grandsLivres: brut.grandsLivres !== false } };
}

const NOMS: Record<NatureImpressionDifferee, string> = {
  JOURNAL: 'Journal',
  GRAND_LIVRE: 'Grand livre',
  BALANCE: 'Balance',
};

const enFrancais = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
};

/** Ce que la demande imprime, en clair, figé à la demande. */
export function libelleDemande(
  nature: NatureImpressionDifferee,
  criteres: CriteresImpression,
  exercice: { dateDebut: Date; dateFin: Date },
  journal: { code: string } | null,
): string {
  const morceaux = [
    NOMS[nature],
    `exercice du ${enFrancais(exercice.dateDebut.toISOString())} au ${enFrancais(exercice.dateFin.toISOString())}`,
  ];
  if (nature === NatureImpressionDifferee.JOURNAL) {
    const c = criteres as CriteresJournal;
    morceaux.push(journal ? `journal ${journal.code}` : 'tous les journaux');
    if (c.dateDebut || c.dateFin) {
      morceaux.push(`${c.dateDebut ? `du ${enFrancais(c.dateDebut)}` : ''}${c.dateDebut && c.dateFin ? ' ' : ''}${c.dateFin ? `au ${enFrancais(c.dateFin)}` : ''}`);
    }
    morceaux.push(c.inclureBrouillard ? 'brouillard compris' : 'livre-journal seul');
  } else if (nature === NatureImpressionDifferee.GRAND_LIVRE) {
    morceaux.push((criteres as CriteresGrandLivre).format === 'plat' ? 'livre à plat' : 'présentation du cabinet');
  } else {
    morceaux.push((criteres as CriteresBalance).grandsLivres ? 'avec les grands livres' : 'balance seule');
  }
  return morceaux.join(' · ');
}

/**
 * Le motif qu'une demande ÉCHOUÉE garde · le refus nommé du moteur tel quel
 * (plafond de volume et son chemin de rechange, exercice introuvable) ; une
 * panne inattendue, sans son détail technique, qui reste au journal du
 * serveur.
 */
export function motifEchecDe(erreur: unknown): string {
  if (erreur instanceof HttpException) {
    const reponse = erreur.getResponse();
    if (typeof reponse === 'string') return reponse;
    const message = (reponse as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    return erreur.message;
  }
  return "La production a échoué sur une erreur inattendue du serveur, consignée · rien n'a été rangé, demandez l'édition de nouveau.";
}

/** Une production commencée et jamais finie, au-delà du délai. */
export function estInterrompue(etat: string, commenceLe: Date | null, maintenant: Date): boolean {
  return etat === 'EN_COURS' && commenceLe !== null && maintenant.getTime() - commenceLe.getTime() > DELAI_PRODUCTION_MS;
}
