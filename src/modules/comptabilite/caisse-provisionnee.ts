import { BadRequestException } from '@nestjs/common';
import { Prisma, StatutExercice } from '@prisma/client';
import { filtreOuverturePasseeAuPremierJour } from '../exercice/ouverture-passee';

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
 * l'exercice, ouverture comprise, avant et après la pièce, en centimes
 * entiers ; un jour où il devient créditeur, ou plus créditeur qu'il ne
 * l'était, refuse la pièce. SEULE UNE PIÈCE QUI FAIT SORTIR quelque chose de
 * la caisse se juge · une entrée, une entrée réduite ou retirée, une sortie
 * retirée passent toujours, et la caisse créditrice qu'elles révèlent reste
 * dite par `CAISSE_CREDITRICE`. Un dossier qui porte déjà une caisse
 * créditrice n'est pas enfermé.
 *
 * Tous les statuts sauf la simulation et l'à-nouveau provisoire · une sortie
 * au brouillard a quitté la caisse autant qu'une sortie validée. Le jour est
 * celui de la date INSCRITE (art. 22, 4°).
 *
 * LES PORTES JUGÉES · la saisie et la modification (au contrôleur, option
 * `jugerLaCaisse` de `creer` et `modifier`, après leurs propres contrôles),
 * le règlement des tiers, le virement de fonds, le paiement des salaires,
 * l'acquisition d'un bien payé comptant (bouquet de rente compris) et la
 * réimputation sur une caisse.
 *
 * LIMITES ÉCRITES · les écritures d'un module qui ne paie personne (clôture,
 * report, import, inscriptions en négatif d'une annulation) ne sont pas
 * jugées · refuser l'annulation d'une entrée de caisse déjà dépensée
 * enfermerait le dossier ; le transfert d'un brouillard depuis la situation
 * ne fait que repousser sa date, jamais vider la caisse ; la fiche d'un bien
 * retouchée en place (`modifierPieceDuModule`) ou dont la pièce d'acquisition
 * est remplacée (changement de mois ou d'exercice) n'est pas rejugée ; un
 * exercice postérieur déjà ouvert n'est pas relu ; deux sorties envoyées à la
 * même seconde se jugent chacune sans l'autre. Seconde relecture · une
 * opération diverse du premier jour qui porte la caisse, même annulée par son
 * négatif, arrête la remontée vers l'exercice précédent encore ouvert (la
 * caisse se lit sur elle seule, des refus peuvent tomber jusqu'à la clôture de
 * N · la dater du lendemain ou clôturer N les lève) ; la fusion de deux
 * caisses se juge exercice par exercice, sans les lignes que l'exercice
 * précédent va lui apporter, et ses lignes validées arrivent à la date de la
 * fusion quand son brouillard garde la sienne (valider d'abord le brouillard).
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

/** Une pièce proposée · sa date INSCRITE (celle que lisent la balance et les états) et ses lignes. */
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

/** Un montant saisi, en centimes ENTIERS · tout le jugement se fait en centimes (CLAUDE.md, « un seuil se juge en centimes entiers »). */
const enCentimes = (x: number | null | undefined) => Math.round(Number(x ?? 0) * 100);

/**
 * Un mouvement de la caisse, en centimes entiers · une ligne proposée, ou les
 * lignes d'un même jour agrégées par la base (même devise, même nature).
 */
export interface MouvementLu {
  jour: string;
  /** Débit moins crédit, en centimes. */
  netFrancs: number;
  deviseId: string | null;
  /** Le net dans la devise, en centimes · null quand une ligne en devise n'en porte pas le montant. */
  netDevise: number | null;
  /**
   * Une ligne qui ne fait entrer ni sortir aucun billet · une écriture de
   * change (écarts de réévaluation, leur extourne, leur contre-passation, leurs
   * négatifs), ou le reste en francs d'un à-nouveau de clôture qui porte aussi
   * la caisse en devise (voir `mouvementsParJour`) · sans devise par construction.
   */
  deChange: boolean;
}

/**
 * Le montant en devise est stocké SANS SIGNE, le sens vient de la ligne ·
 * même règle que `sommesDansLUnite` (inventaire/solde-caisse-au-comptage.ts),
 * une inscription en négatif portant un débit ou un crédit négatif. La
 * requête de `mouvementsParJour` écrit la même règle en SQL.
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
 * francs alors qu'elle est vide. Devise quand tous les mouvements qui en portent
 * une portent la MÊME, montant compris, et que les mouvements sans devise sont
 * seulement des écritures de change (réévaluation de clôture, son extourne) ·
 * elles ne font ni entrer ni sortir un billet. Sinon, francs · débit moins
 * crédit, au cours historique de chaque ligne.
 */
export function uniteDuJugement(mouvements: Pick<MouvementLu, 'deviseId' | 'netDevise' | 'deChange' | 'netFrancs'>[]): { devise: string | null } {
  const devises = new Set<string>();
  let sansDeviseHorsChange = 0;
  for (const m of mouvements) {
    if (m.deviseId) {
      if (m.netDevise === null) return { devise: null };
      devises.add(m.deviseId);
    } else if (!m.deChange && m.netFrancs !== 0) {
      // Un jour dont les lignes sans devise se compensent (la ligne en francs
      // d'un à-nouveau et son négatif, déclaration de devise AU3) n'a fait
      // entrer ni sortir aucun franc (seconde relecture, B1).
      sansDeviseHorsChange += 1;
    }
  }
  if (devises.size === 1 && sansDeviseHorsChange === 0) return { devise: [...devises][0] };
  return { devise: null };
}

function netDansLUnite(m: MouvementLu, devise: string | null): number {
  if (devise === null) return m.netFrancs;
  return m.deviseId ? (m.netDevise ?? 0) : 0;
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
 * l'ouverture le solde d'entrée de l'exercice, le tout en centimes entiers
 * (l'arrondi n'y est qu'une garde). Un jour est refusé quand le solde d'après
 * est créditeur ET inférieur au solde d'avant.
 */
export function premierJourRefuse(ouverture: number, avant: Map<string, number>, apres: Map<string, number>): JourRefuse | null {
  const jours = [...new Set([...avant.keys(), ...apres.keys()])].sort();
  let cumulAvant = ouverture;
  let cumulApres = ouverture;
  for (const jour of jours) {
    cumulAvant += avant.get(jour) ?? 0;
    cumulApres += apres.get(jour) ?? 0;
    if (Math.round(cumulApres) < 0 && Math.round(cumulApres) < Math.round(cumulAvant)) {
      return { jour, avant: cumulAvant, apres: cumulApres };
    }
  }
  return null;
}

/** Une rangée de la requête · sommes en centimes, rendues en bigint par la base. */
interface RangeeMouvement {
  jour: string;
  deviseId: string | null;
  deChange: boolean;
  remplacee: boolean;
  netFrancs: bigint | number;
  netDevise: bigint | number | null;
}

/**
 * LES MOUVEMENTS D'UNE CAISSE DANS UN EXERCICE, AGRÉGÉS PAR LA BASE (§ 8 bis ·
 * « une somme se demande à la base, jamais à une boucle sur des lignes
 * rapatriées ») · un jour, une devise, une nature (change ou non), et la pièce
 * que la modification remplace à part. Tous les statuts sauf la simulation ·
 * une sortie au brouillard a quitté la caisse autant qu'une sortie validée.
 * JAMAIS L'À-NOUVEAU PROVISOIRE (A7 ter, B1) · il recopie la clôture
 * reconstituée du seul livre-journal et ignore le brouillard de l'exercice
 * précédent, que `mouvementsDOuverture` relit · le compter ajouterait la caisse
 * d'ouverture une seconde fois (validé), ou la tiendrait pour vide
 * (brouillard). Le jour est celui de la date INSCRITE (art. 22, 4°).
 * LE RESTE EN FRANCS D'UN À-NOUVEAU EN DEVISE NE FAIT PAS BASCULER EN FRANCS
 * (seconde relecture, B1) · le report au solde écrit une ligne par devise et
 * une ligne sans devise pour le reste (`report-a-nouveau.ts`) ; d'une caisse
 * tenue en dollars, ce reste est l'écart de la réévaluation de clôture, et le
 * compter faisait juger en francs, au cours du jour, une caisse qui tient ses
 * cent dollars (« il manque 5 000 » quand le cours avait monté, et rien de
 * refusé quand il avait baissé). Il se lit comme une écriture de change ·
 * neutre dans la devise, compté en francs. Une caisse qui tient aussi de vrais
 * francs se juge en francs dès qu'un franc y entre ou en sort.
 */
async function mouvementsParJour(
  prisma: Client,
  tenantId: string,
  compteId: string,
  exerciceId: string,
  ecritureRemplaceeId: string | undefined,
): Promise<Array<MouvementLu & { remplacee: boolean }>> {
  const remplacee = ecritureRemplaceeId ?? '';
  const rangees = (await prisma.$queryRaw`
    SELECT to_char(e."date", 'YYYY-MM-DD') AS "jour",
           l."deviseId" AS "deviseId",
           (EXISTS (
             SELECT 1 FROM "reevaluations" r
             WHERE r."ecritureEcartsId" IN (e."id", e."corrigeEcritureId")
                OR r."ecritureExtourneId" IN (e."id", e."corrigeEcritureId")
                OR r."contrePassationDeclareeId" IN (e."id", e."corrigeEcritureId")
           ) OR (
             e."estGenereeParCloture" = true AND l."deviseId" IS NULL AND EXISTS (
               SELECT 1 FROM "lignes_ecriture" l2
               WHERE l2."ecritureId" = e."id" AND l2."compteId" = l."compteId" AND l2."deviseId" IS NOT NULL
             )
           )) AS "deChange",
           (e."id" = ${remplacee}) AS "remplacee",
           (SUM(l."debit" - l."credit") * 100)::bigint AS "netFrancs",
           CASE WHEN COUNT(*) FILTER (WHERE l."deviseId" IS NOT NULL AND l."montantDevise" IS NULL) > 0 THEN NULL
                ELSE (SUM(CASE WHEN l."deviseId" IS NULL THEN 0
                               WHEN l."debit" > 0 THEN l."montantDevise"
                               WHEN l."debit" < 0 THEN -l."montantDevise"
                               WHEN l."credit" > 0 THEN -l."montantDevise"
                               WHEN l."credit" < 0 THEN l."montantDevise"
                               ELSE 0 END) * 100)::bigint
           END AS "netDevise"
    FROM "lignes_ecriture" l
    JOIN "ecritures" e ON e."id" = l."ecritureId"
    WHERE l."compteId" = ${compteId}
      AND e."tenantId" = ${tenantId}
      AND e."exerciceId" = ${exerciceId}
      AND e."statut" <> 'SITUATION'
      AND e."estANouveauProvisoire" = false
    GROUP BY 1, 2, 3, 4
  `) as RangeeMouvement[];
  return rangees.map((r) => ({
    jour: r.jour,
    deviseId: r.deviseId,
    deChange: r.deChange,
    remplacee: r.remplacee,
    netFrancs: Number(r.netFrancs),
    netDevise: r.netDevise === null ? null : Number(r.netDevise),
  }));
}

/**
 * LES MOUVEMENTS QUI FONT L'OUVERTURE quand l'exercice n'en porte aucune sur
 * cette caisse · un exercice ouvert avant la clôture du précédent a sa caisse
 * d'ouverture dans les écritures du précédent. Sans elles, la première sortie
 * de janvier se jugeait sur une caisse vide. On remonte de précédent en
 * précédent tant qu'aucun n'est clôturé et qu'aucun n'a d'ouverture qui porte
 * CETTE caisse ; un précédent clôturé a reporté sa caisse dans le suivant par
 * sa clôture (rien reporté · elle était vide).
 *
 * Deux relectures de la ligne (2026-10-16). L'à-nouveau PROVISOIRE n'arrête
 * jamais la remontée (il est écarté de toute lecture, voir
 * `mouvementsParJour`). Une écriture d'ouverture qui ne touche pas la caisse
 * (une opération diverse du premier jour) ne l'arrête pas non plus · elle ne
 * dit rien de la caisse, et la tenir pour l'ouverture rendait la caisse vide
 * au 1er janvier, toute sortie refusée. LIMITE ÉCRITE · un bilan d'ouverture
 * importé SANS ligne de caisse (caisse vide à l'ouverture) au-dessus d'un
 * précédent encore ouvert lit la caisse de ce précédent · la règle laisse
 * alors passer ce qu'elle aurait pu refuser, jamais l'inverse.
 */
async function mouvementsDOuverture(prisma: Client, tenantId: string, compteId: string, exercice: { id: string; dateDebut: Date }): Promise<MouvementLu[]> {
  const mouvements: MouvementLu[] = [];
  let courant = exercice;
  for (let rang = 0; rang < 20; rang++) {
    const ouverture = await prisma.ecriture.count({
      where: { AND: [filtreOuverturePasseeAuPremierJour(tenantId, courant), { lignes: { some: { compteId } } }] },
    });
    if (ouverture > 0) return mouvements;
    const precedent = await prisma.exercice.findFirst({
      where: { tenantId, dateFin: { lt: courant.dateDebut } },
      orderBy: { dateFin: 'desc' },
      select: { id: true, dateDebut: true, statut: true },
    });
    if (!precedent || precedent.statut === StatutExercice.CLOTURE) return mouvements;
    mouvements.push(...(await mouvementsParJour(prisma, tenantId, compteId, precedent.id, undefined)));
    courant = precedent;
  }
  return mouvements;
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
 * les deux pièces d'un virement), à leur date INSCRITE, `ecritureRemplaceeId`
 * la pièce du brouillard que la modification remplace (ses lignes comptent
 * AVANT, plus APRÈS).
 *
 * SEULE UNE SORTIE NOUVELLE SE JUGE (décision par la loi du 2026-10-16,
 * relecture de la ligne). La fiche du compte 57 interdit de « débourser
 * davantage d'espèces » qu'on n'en a reçu · c'est la SORTIE qu'elle vise. Une
 * pièce qui ne fait sortir aucun billet de la caisse (une entrée, une entrée
 * réduite, retirée ou déplacée, une sortie retirée) n'est jamais refusée,
 * comme la suppression d'un brouillard ne l'est pas · refuser la correction
 * d'une entrée trop forte obligerait à garder une écriture fausse pour
 * satisfaire la règle, et la caisse créditrice qu'elle révèle reste dite par
 * le contrôle `CAISSE_CREDITRICE` (« présomption d'irrégularité »).
 */
export async function motifCaisseNonProvisionnee(
  prisma: Client,
  tenantId: string,
  exerciceId: string,
  pieces: PieceProposee[],
  ecritureRemplaceeId?: string,
): Promise<string | null> {
  // Les comptes où une pièce fait SORTIR quelque chose · le seul qui se juge.
  const sortants = new Set(
    pieces.flatMap((p) => p.lignes.filter((l) => enCentimes(l.debit) - enCentimes(l.credit) < 0).map((l) => l.compteId)),
  );
  if (sortants.size === 0) return null;
  const caisses = await prisma.compte.findMany({
    where: { tenantId, id: { in: [...sortants] }, numero: { startsWith: RACINE_CAISSE } },
    select: { id: true, numero: true, intitule: true },
    orderBy: { numero: 'asc' },
  });
  if (caisses.length === 0) return null;
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, tenantId }, select: { id: true, dateDebut: true } });
  if (!exercice) return null;

  for (const caisse of caisses) {
    const existants = await mouvementsParJour(prisma, tenantId, caisse.id, exercice.id, ecritureRemplaceeId);
    const ouverture = await mouvementsDOuverture(prisma, tenantId, caisse.id, exercice);
    const nouveaux: MouvementLu[] = pieces.flatMap((p) =>
      p.lignes
        .filter((l) => l.compteId === caisse.id)
        .map((l) => {
          const debit = Number(l.debit ?? 0);
          const credit = Number(l.credit ?? 0);
          const montantDevise = l.montantDevise === null || l.montantDevise === undefined ? null : Number(l.montantDevise);
          return {
            jour: jourDe(p.date),
            netFrancs: enCentimes(debit) - enCentimes(credit),
            deviseId: l.deviseId ?? null,
            netDevise: l.deviseId ? (montantDevise === null ? null : enCentimes(netEnDevise({ debit, credit, montantDevise }))) : 0,
            deChange: false,
          };
        }),
    );
    const { devise } = uniteDuJugement([...ouverture, ...existants, ...nouveaux]);

    const soldeOuverture = ouverture.reduce((s, m) => s + netDansLUnite(m, devise), 0);
    const avant = new Map<string, number>();
    const apres = new Map<string, number>();
    const ajouter = (m: Map<string, number>, jour: string, net: number) => m.set(jour, (m.get(jour) ?? 0) + net);
    for (const m of existants) {
      const net = netDansLUnite(m, devise);
      ajouter(avant, m.jour, net);
      if (!m.remplacee) ajouter(apres, m.jour, net);
    }
    for (const m of nouveaux) ajouter(apres, m.jour, netDansLUnite(m, devise));

    const refuse = premierJourRefuse(soldeOuverture, avant, apres);
    if (!refuse) continue;
    const code = devise ? (await prisma.devise.findFirst({ where: { id: devise, tenantId }, select: { code: true } }))?.code ?? 'devise' : null;
    const unite = code ? ` ${code}` : '';
    const disponible = Math.max(0, refuse.avant);
    const manque = Math.min(-refuse.apres, refuse.avant - refuse.apres);
    return (
      `La caisse ${caisse.numero} ${caisse.intitule} deviendrait créditrice le ${dateFr(refuse.jour)} · solde ` +
      `${montantFr(refuse.avant / 100)}${unite} sans cette pièce, ${montantFr(refuse.apres / 100)}${unite} avec elle ` +
      `(disponible ${montantFr(disponible / 100)}${unite}, il manque ${montantFr(manque / 100)}${unite}). ` +
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
