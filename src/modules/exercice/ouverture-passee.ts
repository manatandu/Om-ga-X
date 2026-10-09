import { ClasseCompte, Prisma, StatutEcriture, TypeJournal } from '@prisma/client';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { montantsAContrePasser } from '../devises/contre-passation-manuelle';
import { partagerLignesDEcarts } from '../devises/ecarts-disponibilites';
import { jourFr } from './portefeuille-etat';
import { LigneOuverturePassee, ouvertureNulle } from './report-a-nouveau';

/**
 * LE PÉRIMÈTRE DE LA POSITION D'OUVERTURE PASSÉE AU PREMIER JOUR (AU2), écrit
 * une fois. La clôture le confronte au report (`ouvertureDejaPassee`,
 * exercice.service.ts) ; les états financiers le lisent pour ne pas prendre
 * pour des flux de l'exercice une ouverture saisie en OD (cas chiffrés de la
 * clôture, relecture du 2026-10-07, bloquant 2). Voir le commentaire de
 * `ouvertureDejaPassee` pour le pourquoi de chaque borne.
 */
const ESTUNE_OUVERTURE: Prisma.EcritureWhereInput = { OR: [{ estGenereeParCloture: true }, { journal: { type: TypeJournal.GENERAL } }] };

/**
 * LA CONTRE-PASSATION D'UNE RÉÉVALUATION N'EST PAS UNE OUVERTURE (paquet 1,
 * point A8, reproduit sur vraie base le 2026-10-08). Le module la passe au
 * journal d'opérations diverses, datée du premier jour de N+1, sans compte de
 * gestion, et l'admet pendant que N est encore ouvert (ligne A5 ter) · elle
 * tombait dans ce périmètre. À la clôture de N, AU2 la lisait comme une
 * ouverture DIVERGENTE de tout le bilan de clôture, refusait sans
 * déclaration, et la seule issue, « Rectifier », l'inscrivait en négatif ·
 * l'écart latent revenait en silence au 478 ou au 479 et au compte du tiers
 * (client à 2 900 000 au lieu de 2 800 000 au coût historique, 479 à
 * -100 000 au lieu de zéro), balance bouclée. Le bilan d'ouverture
 * « correspond au bilan de clôture de l'exercice précédent » (AUDCIF art. 34,
 * premier tiret) · il porte l'écart au 478 ou au 479 ; la contre-passation est
 * une OPÉRATION de N+1, qui suit l'ouverture (Guide, Partie 2 ch. 22,
 * Application 84, « Contrepassation de l'écart au 01/01/N+1 : 411 · 4781 »).
 * Reconnue par sa LIAISON (`Reevaluation.ecritureExtourneId`), jamais par le
 * compte ni le libellé · elle ne porte que les lignes de l'écart. Son négatif
 * (annulation de la réévaluation, D6, qui garde la liaison) sort avec elle ;
 * la contre-passation annulée seule est DÉLIÉE, et elle et son négatif, qui
 * se soldent, restent dans le périmètre sans rien peser. La contre-passation
 * faite à la main et DÉCLARÉE peut grouper d'autres gestes dans la même OD ·
 * ses seules lignes de l'écart sont écartées, ligne à ligne, par la clôture
 * (`ouvertureDejaPassee`, exercice.service.ts).
 */
const HORS_CONTRE_PASSATION_DU_MODULE: Prisma.EcritureWhereInput = {
  reevaluationExtourne: { is: null },
  OR: [{ corrigeEcritureId: null }, { corrigeEcriture: { is: { reevaluationExtourne: { is: null } } } }],
};

/**
 * LE NÉGATIF D'UNE ÉCRITURE DU PREMIER JOUR EN FAIT PARTIE, QUELLE QUE SOIT SA
 * DATE (relecture du paquet 1, B2, reproduit sur vraie base le 2026-10-09).
 * « Toute correction d'erreur commise et découverte sur l'exercice en cours
 * s'effectue exclusivement par inscription en négatif des éléments erronés ;
 * l'enregistrement exact est ensuite opéré » (AUDCIF art. 20, al. 2, non
 * exclu par l'art. 3 du SYCEBNL) · le négatif annule les éléments qu'il
 * corrige, et la position d'ouverture que l'art. 34 (SYCEBNL art. 16, 4))
 * confronte au bilan de clôture est ce qui reste APRÈS lui. Daté du jour où
 * l'erreur est découverte (« Corriger » depuis le Journal, `new Date()` à
 * défaut de date), il tombait hors du premier jour · l'OD annulée restait
 * seule dans le périmètre · CONCORDANTE avec le report, la clôture n'ajoutait
 * rien et N+1 restait sans ouverture (banque à zéro au lieu de 10 500 000) ;
 * DIVERGENTE, elle exigeait une déclaration, et RECTIFIER la retranchait une
 * seconde fois (N+1 = report moins l'OD). Le négatif est reconnu par sa
 * LIAISON (`corrigeEcritureId`), jamais par son libellé ni son montant · tout
 * écrivain de la liaison inscrit l'écriture d'origine ENTIÈRE en négatif
 * (`lignesEnNegatif`, liaison unique), et l'OD et son négatif se soldent
 * compte par compte (`ouvertureNulle`). Au brouillard, il est refusé à la
 * clôture comme toute écriture d'ouverture au brouillard · il pourrait encore
 * disparaître. LIMITE ÉCRITE · l'« enregistrement exact » qui suit la
 * correction n'est lu comme une ouverture que s'il est daté du premier jour,
 * comme toute OD.
 */
const DATEE_DU_PREMIER_JOUR = (debut: Date): Prisma.EcritureWhereInput => ({ OR: [{ date: debut }, { dateValeur: debut }] });

export function filtreOuverturePasseeAuPremierJour(tenantId: string, exercice: { id: string; dateDebut: Date }): Prisma.EcritureWhereInput {
  return {
    tenantId,
    exerciceId: exercice.id,
    estANouveauProvisoire: false,
    estSoldeDesComptesDeGestion: false,
    AND: [
      { OR: [DATEE_DU_PREMIER_JOUR(exercice.dateDebut), { corrigeEcriture: { is: DATEE_DU_PREMIER_JOUR(exercice.dateDebut) } }] },
      // Une ouverture de bilan ne passe JAMAIS par un journal d'achats, de
      // ventes ou de trésorerie (décision du coordinateur, troisième tour) ·
      // une écriture de ces journaux au premier jour est une opération de
      // l'exercice, que RECTIFIER ne doit jamais inscrire en négatif. Restent
      // l'à-nouveau (quel que soit son journal), le journal d'opérations
      // diverses (type général), et ce qui corrige l'un d'eux (lien
      // `corrigeEcritureId`).
      { OR: [ESTUNE_OUVERTURE, { corrigeEcriture: { is: ESTUNE_OUVERTURE } }] },
      // Dans le AND, pour que chaque lecteur qui reprend `AND` (candidates de
      // la reconduction du lettrage, reconduction-lettrage.ts) l'écarte aussi.
      HORS_CONTRE_PASSATION_DU_MODULE,
    ],
    lignes: { none: { compte: { classe: { in: [ClasseCompte.CLASSE_6, ClasseCompte.CLASSE_7, ClasseCompte.CLASSE_8] } } } },
  };
}

/** Une écriture du périmètre, telle que la clôture la lit · sa déclaration de contre-passation, s'il y en a une. */
export interface EcritureDuPremierJour {
  id: string;
  reevaluationContrePassationDeclaree?: {
    annuleeLe: Date | null;
    ecritureEcarts: { lignes: Array<{ compteId: string; debit: unknown; credit: unknown; compte: { numero: string } }> } | null;
  } | null;
}

/**
 * A8 · LES LIGNES D'UNE CONTRE-PASSATION FAITE À LA MAIN ET DÉCLARÉE (A5 bis,
 * troisième tour, `declarerContrePassationManuelle`) ne sont pas une position
 * d'ouverture, pour la même raison que celle du module
 * (`HORS_CONTRE_PASSATION_DU_MODULE`). Mais l'OD déclarée peut grouper d'autres
 * gestes (« D'autres lignes sur d'autres comptes sont admises »,
 * contre-passation-manuelle.ts), un bilan d'ouverture saisi à la main
 * compris · l'écarter en entier ferait
 * passer le report par-dessus ces autres lignes, l'ouverture comptée deux
 * fois. Seules ses lignes sur les comptes de l'écart de conversion sont donc
 * écartées · sur chacun, la déclaration a vérifié qu'elles inversent
 * EXACTEMENT l'écart, sans autre ligne au même compte (`motifRefusInversion`).
 * Les comptes sont ceux que la déclaration a jugés, lus de la même façon
 * (écriture des écarts, disponibilités mises à part par
 * `partagerLignesDEcarts`, net non nul par `montantsAContrePasser`). Une
 * réévaluation annulée ne couvre plus rien · sa contre-passation redevient une
 * écriture comme une autre. Rend, par écriture, les comptes écartés.
 */
export function lignesDeContrePassationDeclaree(ecritures: readonly EcritureDuPremierJour[]): Map<string, Set<string>> {
  const horsOuverture = new Map<string, Set<string>>();
  for (const e of ecritures) {
    const r = e.reevaluationContrePassationDeclaree;
    if (!r || r.annuleeLe || !r.ecritureEcarts) continue;
    const lignes = r.ecritureEcarts.lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }));
    const comptes = montantsAContrePasser(partagerLignesDEcarts(lignes).aContrePasser).map((m) => m.compteId);
    if (comptes.length > 0) horsOuverture.set(e.id, new Set(comptes));
  }
  return horsOuverture;
}

/** Le négatif lié d'une écriture du premier jour, inscrit hors du premier jour · sa pièce et sa date. */
export interface NegatifTardif {
  piece: string;
  date: Date;
}

/** Une écriture du périmètre, lue avec ce qui la date et ce qu'elle corrige. */
export interface EcritureDuPerimetreDatee {
  numeroPiece: number | null;
  journal: { code: string };
  date?: Date | null;
  dateValeur?: Date | null;
  corrigeEcritureId?: string | null;
}

/**
 * UNE OUVERTURE ANNULÉE APRÈS LE PREMIER JOUR NE CONCLUT PAS SEULE (second
 * tour de relecture du paquet 1, BLOQUANT 1, reproduit sur vraie base le
 * 2026-10-09). Le négatif lié entre au périmètre quelle que soit sa date (B2,
 * `DATEE_DU_PREMIER_JOUR`), et l'OD qu'il annule s'y solde à zéro · « une
 * position nulle n'est pas une ouverture » (R10), et la clôture passait le
 * report entier. Mais « l'enregistrement exact est ensuite opéré » (AUDCIF
 * art. 20, al. 2, non exclu par l'art. 3 du SYCEBNL), et un négatif inscrit
 * le jour où l'erreur est découverte (« Corriger » depuis le Journal, date du
 * jour) appelle une ressaisie du même jour, HORS du périmètre · la clôture
 * reportait par-dessus, l'ouverture comptée deux fois sans un mot (banque
 * 2027 à 20 800 000 pour 10 400 000, OD du 01/01 annulée le 15/03 et ressaisie
 * le 15/03). OmegaX ne sait pas si la position exacte a été ressaisie
 * ailleurs · le cabinet le DÉCLARE (`issueDeLOuverture`). Un négatif daté ou
 * valorisé au premier jour corrige l'ouverture DANS le périmètre · sa
 * ressaisie y entre aussi, et la confrontation la lit. Le premier jour se lit
 * comme le périmètre le lit (égalité de la date ou de la date de valeur).
 */
export function negatifsTardifs(ecritures: readonly EcritureDuPerimetreDatee[], premierJour: Date): NegatifTardif[] {
  const jour = premierJour.getTime();
  const tardifs: NegatifTardif[] = [];
  for (const e of ecritures) {
    if (!e.corrigeEcritureId || !(e.date instanceof Date)) continue;
    if (e.date.getTime() === jour || (e.dateValeur instanceof Date && e.dateValeur.getTime() === jour)) continue;
    tardifs.push({ piece: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`, date: e.date });
  }
  return tardifs;
}

/** « OD n° 2 du 15/03/2027 » · les négatifs tardifs dans un message, cinq au plus. */
export function negatifsTardifsLisibles(tardifs: readonly NegatifTardif[]): string {
  const noms = tardifs.slice(0, 5).map((t) => `${t.piece} du ${jourFr(t.date)}`);
  return noms.join(', ') + (tardifs.length > 5 ? ` et ${tardifs.length - 5} autre(s)` : '');
}

/** Ce qu'il faut de la base pour juger l'ouverture · la transaction de la clôture ou le client d'un service. */
export type LecteurOuverturePassee = Pick<Prisma.TransactionClient, 'ecriture' | 'ligneEcriture'>;

/**
 * Au-delà, l'ouverture n'est pas relue ligne à ligne pour la dire nulle · elle
 * est tenue pour NON nulle (les états la nomment, le groupe ne remonte pas),
 * jamais pour absente. Même plafond que la confrontation de la clôture.
 */
export const PLAFOND_LIGNES_JUGEMENT_OUVERTURE = 50_000;

/** Les pièces qui portent une ouverture non nulle, cinq au plus, et leur nombre. */
export interface OuverturePasseeNonNulle {
  nombre: number;
  pieces: string[];
}

/**
 * La position d'ouverture passée au premier jour · aucune écriture, une
 * position qui se solde (avec les négatifs inscrits hors du premier jour,
 * `negatifsTardifs`), ou une position non nulle.
 */
export type PositionDOuverturePassee =
  | { etat: 'AUCUNE' }
  | { etat: 'NULLE'; negatifsTardifs: NegatifTardif[] }
  | ({ etat: 'NON_NULLE' } & OuverturePasseeNonNulle);

/**
 * L'OUVERTURE PASSÉE AU PREMIER JOUR, JUGÉE SUR SA POSITION NETTE (relecture du
 * paquet 1, B2, M4, m4). Hors de la clôture, deux lecteurs demandaient
 * seulement « y a-t-il une écriture dans le périmètre ? » · les états d'un
 * exercice sans précédent (qui vident alors leurs postes d'ouverture) et le 585
 * du groupe (qui ne remonte plus à l'exercice précédent). Une OD annulée par
 * son négatif (art. 20, al. 2 · B2) ou une contre-passation DÉCLARÉE (A8 ·
 * ses lignes de l'écart ne sont pas une ouverture) y passaient pour une
 * ouverture · le tableau des flux restait vide sans issue, et le groupe ne
 * lisait pas l'exercice précédent encore ouvert. La position se lit comme la
 * clôture la lit (même périmètre, mêmes lignes écartées,
 * `lignesDeContrePassationDeclaree`), et une position qui se solde compte par
 * compte et devise par devise n'est PAS une ouverture (`ouvertureNulle`, R10).
 * `validees` borne au livre-journal (AUDCIF art. 22, 2°) · c'est la lecture des
 * états et du groupe. `null` · aucune ouverture, ou une ouverture nulle.
 */
export async function ouverturePasseeNonNulle(
  db: LecteurOuverturePassee,
  tenantId: string,
  exercice: { id: string; dateDebut: Date },
  options: { validees: boolean },
): Promise<OuverturePasseeNonNulle | null> {
  const position = await positionDOuverturePassee(db, tenantId, exercice, options);
  return position.etat === 'NON_NULLE' ? { nombre: position.nombre, pieces: position.pieces } : null;
}

/**
 * La même lecture, qui dit en plus d'une position nulle les négatifs inscrits
 * hors du premier jour (second tour, BLOQUANT 1) · les états d'un exercice
 * sans précédent la NOMMENT, une ressaisie de l'ouverture après le premier
 * jour se lisant chez eux comme des flux de l'exercice.
 */
export async function positionDOuverturePassee(
  db: LecteurOuverturePassee,
  tenantId: string,
  exercice: { id: string; dateDebut: Date },
  options: { validees: boolean },
): Promise<PositionDOuverturePassee> {
  const filtre: Prisma.EcritureWhereInput = {
    ...filtreOuverturePasseeAuPremierJour(tenantId, exercice),
    ...(options.validees ? { statut: StatutEcriture.VALIDEE } : {}),
  };
  const nombreLignes = await db.ligneEcriture.count({ where: { ecriture: filtre } });
  if (nombreLignes === 0) return { etat: 'AUCUNE' };
  const lues = await db.ecriture.findMany({
    where: { ...filtre, tenantId },
    select: {
      id: true,
      numeroPiece: true,
      date: true,
      dateValeur: true,
      corrigeEcritureId: true,
      journal: { select: { code: true } },
      reevaluationContrePassationDeclaree: {
        select: { annuleeLe: true, ecritureEcarts: { select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } } } },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: PLAFOND_LIGNES_JUGEMENT_OUVERTURE,
  });
  const piece = (e: (typeof lues)[number]) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`;
  if (nombreLignes > PLAFOND_LIGNES_JUGEMENT_OUVERTURE) {
    return { etat: 'NON_NULLE', nombre: lues.length, pieces: lues.slice(0, 5).map(piece) };
  }
  const horsOuverture = lignesDeContrePassationDeclaree(lues);
  const retenues = new Set<string>();
  const lignes: LigneOuverturePassee[] = [];
  await lireParLots(
    (curseur) =>
      db.ligneEcriture.findMany({
        where: { ecriture: filtre },
        select: { id: true, ecritureId: true, compteId: true, debit: true, credit: true, deviseId: true, montantDevise: true },
        ...pageApres(curseur, LOT_LECTURE),
      }),
    (l) => {
      if (horsOuverture.get(l.ecritureId)?.has(l.compteId)) return;
      retenues.add(l.ecritureId);
      lignes.push({
        compteId: l.compteId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        libelle: null,
        dateEcheance: null,
        deviseId: l.deviseId,
        montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        coursApplique: null,
      });
    },
    LOT_LECTURE,
  );
  const portees = lues.filter((e) => retenues.has(e.id));
  if (lignes.length === 0 || ouvertureNulle(lignes)) return { etat: 'NULLE', negatifsTardifs: negatifsTardifs(portees, exercice.dateDebut) };
  return { etat: 'NON_NULLE', nombre: portees.length, pieces: portees.slice(0, 5).map(piece) };
}
