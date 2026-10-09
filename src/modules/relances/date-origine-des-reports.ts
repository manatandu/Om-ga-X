import { Prisma, StatutEcriture } from '@prisma/client';
import { lireParLots, pageApres } from '../../common/lecture-par-lots';
import { cleDeLigne, cleDuReport } from '../devises/declaration-devise-a-nouveau';
import { lignesReporteesAuDetail } from '../exercice/lignes-reportees-au-detail';

/**
 * LA DATE D'ORIGINE D'UNE LIGNE REPORTÉE (simulation du logiciel complet du
 * 2026-10-08, constat REL-ANOUVEAU).
 *
 * Le report au DÉTAIL recopie l'échéance d'une créance (`report-a-nouveau.ts`)
 * · une facture qui n'en portait pas arrivait en N+1 sans échéance, et la
 * relance se rabattait sur la date de l'écriture, c'est-à-dire celle de
 * l'À-NOUVEAU. Une facture de mars 2026 était réclamée « échue depuis le
 * 1er janvier 2027 », son retard comptait 73 jours au lieu de 379, et les
 * relances envoyées en 2026 sortaient du décompte (audit final F169, la plus
 * ancienne pièce ouverte devenait le 1er janvier). La balance âgée range déjà
 * ces lignes en « antérieur à l'exercice » (audit final F51) · la relance, qui
 * imprime une date, doit retrouver celle de la pièce. AVEC UNE ÉCHÉANCE
 * AUSSI (relecture « échecs silencieux » du paquet 1, voisin) · l'échéance
 * range le retard, mais la date de la pièce borne les relances qui comptent
 * (F169) · datée du 1er janvier, la mise en demeure envoyée en N sortait du
 * décompte et se resuggérait en N+1.
 *
 * AUCUN LIEN EN BASE ne relie une ligne à son report · la clé est celle du
 * report au détail (`cleDuReport` · compte, montants au centime, échéance,
 * libellé « RAN détail <compte> · <libellé> »), comme pour la déclaration de
 * devise d'un à-nouveau (`apparierReports`). Les lignes de même clé sont
 * interchangeables · elles s'apparient dans l'ordre, la plus ancienne pièce
 * d'abord, et seulement si les deux côtés en comptent autant ; sinon rien
 * n'est rattaché et la relance garde la date de l'écriture, comme avant. Une
 * origine elle-même reportée se suit d'exercice en exercice, au plus
 * `PROFONDEUR_MAX` fois (dix ans de conservation, AUDCIF art. 24).
 *
 * LA MÊME ORIGINE ORDONNE L'IMPUTATION (paquet 1, B7). Un groupe de lettrage
 * posé à la main en N+1 sur des lignes d'à-nouveau (aucun groupe de N
 * reconduit) s'imputait au 1er janvier · deux factures de mars et de
 * septembre, reportées le même jour, s'éteignaient au PRORATA au lieu de la
 * plus ancienne d'abord (Code civil, Livre III, art. 154). `originesDesReports`
 * rend la pièce d'origine (sa date et sa ligne) que `poidsDesLignesLues` donne
 * à l'imputation, comme `originesDesLignes` le fait pour un groupe reconduit.
 * L'ÉCHÉANCE ENTRE DANS LA CLÉ quand le report en porte une · le report au
 * détail la recopie (`report-a-nouveau.ts`), et deux factures de même montant
 * et de même libellé ne se distinguent que par elle ; sans elle, l'ordre des
 * identifiants les échangeait. Le libellé de l'origine est celui que le report
 * recopie · celui de la ligne, sinon celui de l'écriture
 * (`lireComptesDuReport`).
 *
 * LE PREMIER EXERCICE TENU (relecture « échecs silencieux » du paquet 1, M1 ·
 * le cas du pilote, un dossier repris par un bilan d'ouverture importé). Une
 * ligne d'à-nouveau de l'exercice qui n'a pas d'exercice précédent dans le
 * dossier n'a nulle part où chercher sa pièce · elle EST l'origine. La chaîne
 * s'y arrêtait sans rien rendre (ni origine, ni introuvable), et le groupe de
 * deux factures reportées tombait au prorata, la facture reprise du bilan
 * d'ouverture rangée avec celle de l'année. COMMENT L'IMPORT STOCKE LA PIÈCE ·
 * une ligne par compte, montants et devise seuls (`ImportService`, balance) ·
 * ni date de pièce, ni libellé de ligne, ni échéance (celle-ci n'existe que si
 * le cabinet la complète au brouillard). LA RÈGLE · la date de son ÉCRITURE
 * (le premier jour de l'exercice, ou la date de reprise) est la date la plus
 * TARDIVE que ses pièces puissent porter, un bilan d'ouverture reprenant la
 * clôture de la période d'avant · rangée à cette date, elle passe avant toute
 * pièce de l'exercice (Code civil, Livre III, art. 154, « sur la plus
 * ancienne »), et deux lignes d'ouverture de même date s'imputent au prorata
 * (« toutes choses égales, elle se fait proportionnellement »). L'échéance
 * ne date pas la dette · elle dit si la dette est échue à la date du
 * paiement, ce que l'imputation lit à part (`restesParLImputationLegale`).
 * Une ligne d'à-nouveau d'un exercice qui A un précédent (un bilan importé
 * dans un dossier qui garde son exercice d'avant) se cherche toujours dans
 * ce précédent · introuvable, elle est rendue comme telle, et le groupe nommé.
 */

export const PROFONDEUR_MAX = 10;

/** Une ligne reportée à rattacher · son compte, ses montants, son libellé. */
export interface LigneReportee {
  id: string;
  compteId: string;
  numeroCompte: string;
  debit: number;
  credit: number;
  libelle: string | null;
  /** L'échéance, que le report au détail recopie · absente, aucune. */
  dateEcheance?: Date | null;
  /**
   * La date de son écriture · elle date l'origine quand la ligne n'a pas
   * d'exercice précédent où chercher sa pièce (premier exercice tenu, M1).
   */
  date: Date;
  /**
   * Vraie pour une ligne de l'à-nouveau PROVISOIRE, qui ne reporte que le
   * livre-journal (point 11) · ses origines ne se cherchent que parmi les
   * lignes VALIDÉES (mineur 2).
   */
  provisoire?: boolean;
}

/** Une ligne candidate de l'exercice précédent. */
export interface LigneCandidate extends LigneReportee {
  /** Elle-même un report d'à-nouveau · on remonte encore d'un exercice. */
  estReport: boolean;
  /** Au livre-journal · seule candidate d'un report provisoire. */
  validee: boolean;
}

/**
 * L'appariement pur · chaque ligne reportée reçoit l'origine de même clé,
 * dans l'ordre (reports par identifiant, origines de la plus ancienne à la
 * plus récente), quand les deux côtés de la clé ont le même nombre de lignes.
 */
export function apparierAuxOrigines(
  reports: LigneReportee[],
  candidates: LigneCandidate[],
): Map<string, LigneCandidate> {
  const cleReport = (r: LigneReportee) =>
    cleDeLigne({ id: r.id, compteId: r.compteId, debit: r.debit, credit: r.credit, libelle: r.libelle, dateEcheance: r.dateEcheance ?? null });
  const cleOrigine = (o: LigneCandidate) =>
    cleDuReport(
      { id: o.id, compteId: o.compteId, debit: o.debit, credit: o.credit, libelle: o.libelle, dateEcheance: o.dateEcheance ?? null },
      o.numeroCompte,
    );
  const reportsParCle = new Map<string, LigneReportee[]>();
  for (const r of reports) reportsParCle.set(cleReport(r), [...(reportsParCle.get(cleReport(r)) ?? []), r]);
  const originesParCle = new Map<string, LigneCandidate[]>();
  for (const o of candidates) originesParCle.set(cleOrigine(o), [...(originesParCle.get(cleOrigine(o)) ?? []), o]);
  const resultat = new Map<string, LigneCandidate>();
  for (const [cle, rs] of reportsParCle) {
    const os = originesParCle.get(cle) ?? [];
    if (os.length === 0 || os.length !== rs.length) continue;
    const reportsTries = [...rs].sort((a, b) => a.id.localeCompare(b.id));
    const originesTriees = [...os].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    reportsTries.forEach((r, i) => resultat.set(r.id, originesTriees[i]));
  }
  return resultat;
}

type Client = Pick<Prisma.TransactionClient, 'exercice' | 'ligneEcriture'>;

/** La pièce d'origine d'une ligne reportée · sa date et l'identifiant de sa ligne. */
export interface OrigineDuReport {
  date: Date;
  id: string;
}

/**
 * Les dates d'origine des lignes reportées, lues dans les exercices qui
 * précèdent `debutExercice` · la clé est l'identifiant de la ligne reportée,
 * la valeur la date de la pièce d'origine. Une ligne non retrouvée n'a pas
 * d'entrée.
 */
export async function datesOrigineDesReports(
  client: Client,
  tenantId: string,
  debutExercice: Date,
  reports: LigneReportee[],
): Promise<Map<string, Date>> {
  const { origines } = await originesDesReports(client, tenantId, debutExercice, reports);
  return new Map([...origines].map(([id, o]) => [id, o.date]));
}

/**
 * Les pièces d'origine des lignes reportées · `origines` par identifiant de
 * la ligne reportée ; `introuvables`, celles qu'un exercice précédent aurait
 * dû porter et où aucune origine sûre n'a été retrouvée (clé absente, ou
 * portée par un nombre différent de lignes des deux côtés). Une ligne dont la
 * chaîne atteint une ligne d'à-nouveau SANS exercice précédent (bilan
 * d'ouverture du premier exercice tenu) a pour origine cette ligne, à la date
 * de son écriture (M1, en tête du fichier).
 */
export async function originesDesReports(
  client: Client,
  tenantId: string,
  debutExercice: Date,
  reports: LigneReportee[],
): Promise<{ origines: Map<string, OrigineDuReport>; introuvables: string[] }> {
  const origines = new Map<string, OrigineDuReport>();
  const introuvables: string[] = [];
  // Chaque niveau · la ligne reportée de départ, et la ligne qu'on cherche à
  // rattacher à ce niveau (la même au premier, son origine reportée ensuite).
  let enCours = reports.map((r) => ({ depart: r.id, ligne: r }));
  let borne = debutExercice;
  for (let niveau = 0; niveau < PROFONDEUR_MAX && enCours.length; niveau++) {
    const precedent = await client.exercice.findFirst({
      where: { tenantId, dateFin: { lt: borne } },
      orderBy: { dateFin: 'desc' },
      select: { id: true, dateDebut: true },
    });
    if (!precedent) {
      // Le premier exercice tenu · la ligne d'ouverture EST l'origine (M1).
      for (const e of enCours) origines.set(e.depart, { date: e.ligne.date, id: e.ligne.id });
      break;
    }
    const comptes = [...new Set(enCours.map((e) => e.ligne.compteId))];
    const numeros = new Map(enCours.map((e) => [e.ligne.compteId, e.ligne.numeroCompte]));
    const candidates: LigneCandidate[] = [];
    // LE MÊME FILTRE QUE LE REPORT (mineur 2) · les lignes que le report au
    // détail reporte, lettre vide et groupe à cheval compris
    // (`lignesReporteesAuDetail`), toutes statuts · le report provisoire,
    // qui ne lit que le livre-journal, s'apparie plus bas aux seules
    // validées.
    await lireParLots(
      (curseur) =>
        client.ligneEcriture.findMany({
          ...pageApres(curseur, 500),
          where: {
            ...lignesReporteesAuDetail({ tenantId, exerciceId: precedent.id }),
            compteId: { in: comptes },
          },
          select: {
            id: true,
            compteId: true,
            debit: true,
            credit: true,
            libelle: true,
            dateEcheance: true,
            ecriture: { select: { date: true, libelle: true, statut: true, estGenereeParCloture: true, estANouveauProvisoire: true } },
          },
        }),
      (l) =>
        candidates.push({
          id: l.id,
          compteId: l.compteId,
          numeroCompte: numeros.get(l.compteId) ?? '',
          debit: Number(l.debit),
          credit: Number(l.credit),
          // Le libellé que le report recopie · celui de la ligne, sinon celui
          // de l'écriture (`lireComptesDuReport`).
          libelle: l.libelle ?? l.ecriture.libelle ?? null,
          dateEcheance: l.dateEcheance ?? null,
          date: l.ecriture.date,
          estReport: l.ecriture.estGenereeParCloture === true || l.ecriture.estANouveauProvisoire === true,
          provisoire: l.ecriture.estANouveauProvisoire === true,
          validee: l.ecriture.statut === StatutEcriture.VALIDEE,
        }),
    );
    // Un report provisoire ne vient que du livre-journal · un doublon resté
    // au brouillard ne lui dispute pas sa pièce.
    const trouvees = new Map([
      ...apparierAuxOrigines(
        enCours.filter((e) => e.ligne.provisoire === true).map((e) => e.ligne),
        candidates.filter((c) => c.validee),
      ),
      ...apparierAuxOrigines(
        enCours.filter((e) => e.ligne.provisoire !== true).map((e) => e.ligne),
        candidates,
      ),
    ]);
    const suivants: typeof enCours = [];
    for (const e of enCours) {
      const o = trouvees.get(e.ligne.id);
      if (!o) {
        introuvables.push(e.depart);
        continue;
      }
      if (o.estReport) suivants.push({ depart: e.depart, ligne: o });
      else origines.set(e.depart, { date: o.date, id: o.id });
    }
    enCours = suivants;
    borne = precedent.dateDebut;
  }
  return { origines, introuvables };
}
