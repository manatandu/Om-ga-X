import { ClasseCompte, Prisma, TypeJournal } from '@prisma/client';
import { montantsAContrePasser } from '../devises/contre-passation-manuelle';
import { partagerLignesDEcarts } from '../devises/ecarts-disponibilites';

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

export function filtreOuverturePasseeAuPremierJour(tenantId: string, exercice: { id: string; dateDebut: Date }): Prisma.EcritureWhereInput {
  return {
    tenantId,
    exerciceId: exercice.id,
    estANouveauProvisoire: false,
    estSoldeDesComptesDeGestion: false,
    AND: [
      { OR: [{ date: exercice.dateDebut }, { dateValeur: exercice.dateDebut }] },
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
