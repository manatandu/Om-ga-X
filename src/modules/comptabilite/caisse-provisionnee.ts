import { BadRequestException } from '@nestjs/common';
import { Prisma, StatutExercice } from '@prisma/client';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';
import { HORS_SITUATION } from './ecritures-de-situation';

/**
 * UNE CAISSE NE PAIE QUE CE QU'ELLE CONTIENT (demande de Manasse du
 * 2026-10-16 · « on ne peut pas payer un tiers par caisse pour un montant
 * supérieur au solde de cette caisse […] Pour la banque, la banque peut être
 * négative ça passe »).
 *
 * Le texte le dit, à la fiche du compte 57 des deux plans · « Le solde du
 * compte caisse ne doit être que débiteur ou nul. Un solde créditeur
 * signifierait que l'entité serait parvenue à débourser davantage d'espèces
 * qu'elle n'en aurait reçu en caisse […] un solde créditeur du compte caisse
 * constitue une présomption d'irrégularité de la comptabilité » (AUDCIF
 * Titre VII, compte 57 ; SYCEBNL Partie 2 ch. 3, compte 57). Le contrôle de
 * révision le signalait après coup (`CAISSE_CREDITRICE`, bloquant) · la
 * sortie se refuse désormais AVANT d'entrer, là où elle se corrige encore.
 *
 * Ni la banque (un 52 créditeur est un découvert, « banques, découverts » au
 * passif), ni le 55 · la fiche du 55 dit « débiteur ou nul » sans la
 * présomption, et le contrôle le tient en AVERTISSEMENT (controles.service).
 *
 * LA RÈGLE · le solde de chaque caisse est reconstitué JOUR PAR JOUR sur
 * l'exercice, ouverture comprise, avant et après la pièce ; un jour où il
 * devient créditeur, ou plus créditeur qu'il ne l'était, refuse la pièce.
 * Jamais un jour déjà créditeur que la pièce ne touche pas, ni une pièce qui
 * améliore la caisse · un dossier qui porte déjà une caisse créditrice n'est
 * pas enfermé, l'encaissement et la correction passent.
 *
 * Tous les statuts sauf la simulation · une sortie au brouillard a quitté la
 * caisse autant qu'une sortie validée.
 *
 * LIMITES ÉCRITES · les écritures d'un module qui ne paie personne (clôture,
 * report, import, inscriptions en négatif d'une annulation) ne sont pas
 * jugées · refuser l'annulation d'une entrée de caisse déjà dépensée
 * enfermerait le dossier ; un exercice postérieur déjà ouvert n'est pas relu ;
 * deux sorties envoyées à la même seconde se jugent chacune sans l'autre.
 */

type Client = Prisma.TransactionClient;

/** Une ligne proposée · comptes et montants tels que la pièce les porte. */
export interface LigneProposee {
  compteId: string;
  debit?: number | null;
  credit?: number | null;
  deviseId?: string | null;
  montantDevise?: number | null;
}

/** Une pièce proposée · sa date (celle que lisent la balance et les états) et ses lignes. */
export interface PieceProposee {
  date: Date | string;
  lignes: LigneProposee[];
}

/** La caisse est le 57 des deux plans, et lui seul (voir l'en-tête). */
export const RACINE_CAISSE = '57';

/** Le jour d'une date, en AAAA-MM-JJ UTC, comme `controleCaisse`. */
function jourDe(date: Date | string): string {
  return (typeof date === 'string' ? new Date(date) : date).toISOString().slice(0, 10);
}

const centimes = (x: number) => Math.round(x * 100);

/** Une ligne lue, réduite à ce que le jugement retient. */
interface LigneLue {
  jour: string;
  debit: number;
  credit: number;
  deviseId: string | null;
  montantDevise: number | null;
  /** Une écriture de change (écarts de réévaluation, leur extourne, leur contre-passation, leurs négatifs) · sans devise par construction. */
  deChange: boolean;
}

/**
 * Le montant en devise est stocké SANS SIGNE, le sens vient de la ligne ·
 * même règle que `sommesDansLUnite` (inventaire/solde-caisse-au-comptage.ts),
 * une inscription en négatif portant un débit ou un crédit négatif.
 */
function netEnDevise(l: { debit: number; credit: number; montantDevise: number | null }): number {
  const m = Number(l.montantDevise ?? 0);
  if (l.debit > 0) return m;
  if (l.debit < 0) return -m;
  if (l.credit > 0) return -m;
  if (l.credit < 0) return m;
  return 0;
}

/**
 * L'UNITÉ DU JUGEMENT · une caisse tenue en devise se juge dans sa devise, sans
 * quoi cent dollars reçus à 2 800 et payés à 2 900 la rendaient créditrice en
 * francs alors qu'elle est vide. Devise quand toutes les lignes qui en portent
 * une portent la MÊME, montant compris, et que les lignes sans devise sont
 * seulement des écritures de change (réévaluation de clôture, son extourne) ·
 * elles ne font ni entrer ni sortir un billet. Sinon, francs · débit moins
 * crédit, au cours historique de chaque ligne.
 */
export function uniteDuJugement(lignes: LigneLue[]): { devise: string | null } {
  const devises = new Set<string>();
  let sansDeviseHorsChange = 0;
  for (const l of lignes) {
    if (l.deviseId) {
      if (l.montantDevise === null || l.montantDevise === undefined) return { devise: null };
      devises.add(l.deviseId);
    } else if (!l.deChange) {
      sansDeviseHorsChange += 1;
    }
  }
  if (devises.size === 1 && sansDeviseHorsChange === 0) return { devise: [...devises][0] };
  return { devise: null };
}

function netDansLUnite(l: LigneLue, devise: string | null): number {
  if (devise === null) return l.debit - l.credit;
  return l.deviseId ? netEnDevise(l) : 0;
}

/** Le premier jour où la pièce rend la caisse créditrice, ou plus créditrice. */
export interface JourRefuse {
  jour: string;
  /** Solde de fin de journée sans la pièce. */
  avant: number;
  /** Solde de fin de journée avec la pièce. */
  apres: number;
}

/**
 * LE JUGEMENT, PUR · `avant` et `apres` sont les mouvements nets par jour,
 * l'ouverture le solde d'entrée de l'exercice. Un jour est refusé quand le
 * solde d'après est créditeur ET inférieur au solde d'avant, au centime.
 */
export function premierJourRefuse(ouverture: number, avant: Map<string, number>, apres: Map<string, number>): JourRefuse | null {
  const jours = [...new Set([...avant.keys(), ...apres.keys()])].sort();
  let cumulAvant = ouverture;
  let cumulApres = ouverture;
  for (const jour of jours) {
    cumulAvant += avant.get(jour) ?? 0;
    cumulApres += apres.get(jour) ?? 0;
    if (centimes(cumulApres) < 0 && centimes(cumulApres) < centimes(cumulAvant)) {
      return { jour, avant: cumulAvant, apres: cumulApres };
    }
  }
  return null;
}

/** Les lignes d'une caisse dans un exercice, statut de simulation écarté. */
async function lireLignes(
  prisma: Client,
  tenantId: string,
  compteId: string,
  exerciceId: string,
  ecritureRemplaceeId: string | undefined,
  surLigne: (l: LigneLue, remplacee: boolean) => void,
) {
  const CHANGE = { select: { id: true } } as const;
  await lireParLots(
    (curseur) =>
      prisma.ligneEcriture.findMany({
        where: { compteId, ecriture: { tenantId, exerciceId, ...HORS_SITUATION } },
        select: {
          id: true,
          debit: true,
          credit: true,
          deviseId: true,
          montantDevise: true,
          ecritureId: true,
          ecriture: {
            select: {
              date: true,
              reevaluationEcarts: CHANGE,
              reevaluationExtourne: CHANGE,
              reevaluationContrePassationDeclaree: CHANGE,
              corrigeEcriture: { select: { reevaluationEcarts: CHANGE, reevaluationExtourne: CHANGE, reevaluationContrePassationDeclaree: CHANGE } },
            },
          },
        },
        ...pageApres(curseur, LOT_LECTURE),
      }),
    (l) => {
      const e = l.ecriture;
      const c = e.corrigeEcriture;
      const deChange =
        !!(e.reevaluationEcarts || e.reevaluationExtourne || e.reevaluationContrePassationDeclaree) ||
        !!(c && (c.reevaluationEcarts || c.reevaluationExtourne || c.reevaluationContrePassationDeclaree));
      surLigne(
        {
          jour: jourDe(e.date),
          debit: Number(l.debit),
          credit: Number(l.credit),
          deviseId: l.deviseId ?? null,
          montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
          deChange,
        },
        ecritureRemplaceeId !== undefined && l.ecritureId === ecritureRemplaceeId,
      );
    },
  );
}

/**
 * LES LIGNES QUI FONT L'OUVERTURE quand l'exercice n'en porte aucune · un
 * exercice ouvert avant la clôture du précédent, sans report à-nouveau
 * (provisoire ou définitif) ni bilan d'ouverture, a sa caisse d'ouverture dans
 * les écritures du précédent. Sans elles, la première sortie de janvier se
 * jugeait sur une caisse vide. On remonte de précédent en précédent tant
 * qu'aucun n'est clôturé et qu'aucun n'a d'ouverture ; un précédent clôturé
 * a reporté sa caisse dans le suivant par sa clôture.
 */
async function lignesDOuverture(prisma: Client, tenantId: string, compteId: string, exercice: { id: string; dateDebut: Date }): Promise<LigneLue[]> {
  const lignes: LigneLue[] = [];
  let courant = exercice;
  for (let rang = 0; rang < 20; rang++) {
    const [ouverture, provisoire] = await Promise.all([
      prisma.ecriture.count({ where: filtreOuverturePasseeAuPremierJour(tenantId, courant) }),
      prisma.ecriture.count({ where: { tenantId, exerciceId: courant.id, estANouveauProvisoire: true, ...HORS_SITUATION } }),
    ]);
    if (ouverture > 0 || provisoire > 0) return lignes;
    const precedent = await prisma.exercice.findFirst({
      where: { tenantId, dateFin: { lt: courant.dateDebut } },
      orderBy: { dateFin: 'desc' },
      select: { id: true, dateDebut: true, statut: true },
    });
    if (!precedent || precedent.statut === StatutExercice.CLOTURE) return lignes;
    await lireLignes(prisma, tenantId, compteId, precedent.id, undefined, (l) => lignes.push(l));
    courant = precedent;
  }
  return lignes;
}

function montantFr(x: number): string {
  return x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateFr(jour: string): string {
  const [a, m, j] = jour.split('-');
  return `${j}/${m}/${a}`;
}

/**
 * LE MOTIF DU REFUS, ou null · `pieces` les pièces proposées (une sortie, ou
 * les deux pièces d'un virement), `ecritureRemplaceeId` la pièce du brouillard
 * que la modification remplace (ses lignes comptent AVANT, plus APRÈS).
 */
export async function motifCaisseNonProvisionnee(
  prisma: Client,
  tenantId: string,
  exerciceId: string,
  pieces: PieceProposee[],
  ecritureRemplaceeId?: string,
): Promise<string | null> {
  const ids = [...new Set(pieces.flatMap((p) => p.lignes.map((l) => l.compteId)))];
  if (ids.length === 0) return null;
  const caisses = await prisma.compte.findMany({
    where: { tenantId, id: { in: ids }, numero: { startsWith: RACINE_CAISSE } },
    select: { id: true, numero: true, intitule: true },
    orderBy: { numero: 'asc' },
  });
  // La modification qui RETIRE une caisse de sa pièce la juge aussi · la
  // sortie retirée ne fait pas de mal, mais une entrée retirée peut en faire.
  if (ecritureRemplaceeId) {
    const deLaPiece = await prisma.compte.findMany({
      where: { tenantId, numero: { startsWith: RACINE_CAISSE }, lignesEcriture: { some: { ecritureId: ecritureRemplaceeId } } },
      select: { id: true, numero: true, intitule: true },
    });
    for (const c of deLaPiece) if (!caisses.some((x) => x.id === c.id)) caisses.push(c);
  }
  if (caisses.length === 0) return null;
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
  if (!exercice) return null;

  for (const caisse of caisses) {
    const existantes: { ligne: LigneLue; remplacee: boolean }[] = [];
    await lireLignes(prisma, tenantId, caisse.id, exercice.id, ecritureRemplaceeId, (ligne, remplacee) => existantes.push({ ligne, remplacee }));
    const ouverture = await lignesDOuverture(prisma, tenantId, caisse.id, exercice);
    const nouvelles: LigneLue[] = pieces.flatMap((p) =>
      p.lignes
        .filter((l) => l.compteId === caisse.id)
        .map((l) => ({
          jour: jourDe(p.date),
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          deviseId: l.deviseId ?? null,
          montantDevise: l.montantDevise === null || l.montantDevise === undefined ? null : Number(l.montantDevise),
          deChange: false,
        })),
    );
    const { devise } = uniteDuJugement([...ouverture, ...existantes.map((x) => x.ligne), ...nouvelles]);

    const soldeOuverture = ouverture.reduce((s, l) => s + netDansLUnite(l, devise), 0);
    const avant = new Map<string, number>();
    const apres = new Map<string, number>();
    const ajouter = (m: Map<string, number>, jour: string, net: number) => m.set(jour, (m.get(jour) ?? 0) + net);
    for (const { ligne, remplacee } of existantes) {
      const net = netDansLUnite(ligne, devise);
      ajouter(avant, ligne.jour, net);
      if (!remplacee) ajouter(apres, ligne.jour, net);
    }
    for (const ligne of nouvelles) ajouter(apres, ligne.jour, netDansLUnite(ligne, devise));

    const refuse = premierJourRefuse(soldeOuverture, avant, apres);
    if (!refuse) continue;
    const code = devise ? (await prisma.devise.findFirst({ where: { id: devise }, select: { code: true } }))?.code ?? 'devise' : null;
    const unite = code ? ` ${code}` : '';
    const disponible = Math.max(0, refuse.avant);
    return (
      `La caisse ${caisse.numero} ${caisse.intitule} deviendrait créditrice le ${dateFr(refuse.jour)} · solde ` +
      `${montantFr(refuse.avant)}${unite} sans cette pièce, ${montantFr(refuse.apres)}${unite} avec elle ` +
      `(disponible ${montantFr(disponible)}${unite}, il manque ${montantFr(Math.min(-refuse.apres, refuse.avant - refuse.apres))}${unite}). ` +
      'Le solde du compte caisse ne doit être que débiteur ou nul (fiche du compte 57) · approvisionnez d’abord la caisse ' +
      '(virement de fonds depuis la banque), payez par la banque, ou datez la sortie après l’entrée qui la couvre.'
    );
  }
  return null;
}

/** Le refus, nommé, en 400. */
export async function verifierCaisseProvisionnee(
  prisma: Client,
  tenantId: string,
  exerciceId: string,
  pieces: PieceProposee[],
  ecritureRemplaceeId?: string,
): Promise<void> {
  const motif = await motifCaisseNonProvisionnee(prisma, tenantId, exerciceId, pieces, ecritureRemplaceeId);
  if (motif) throw new BadRequestException(motif);
}
