import { JeuNotesAnnexes } from '@prisma/client';

/**
 * LE TRANSFERT DE DÉPRÉCIATION À LA MISE EN SERVICE, DIT DANS LA NOTE
 * (décision par la loi du 2026-10-07, quatrième lot, point 9).
 *
 * À la mise en service d'un bien en cours, la dépréciation du 29x9 passe au 29
 * du bien achevé par une REPRISE et une DOTATION de même montant (ligne A22
 * bis, `immobilisations/transfert-depreciation-en-cours.ts`). La NOTE 28
 * (SYSCOHADA) et la note 5F (associations SYCEBNL) gardent leurs colonnes
 * BRUTES · la note se chiffre « selon les mêmes principes » que le compte de
 * résultat (AUDCIF Titre IX ch. 6 § 1.1), qui porte dotation et reprise
 * séparément, et toute compensation non juridiquement fondée y est interdite
 * (AUDCIF art. 34 ; SYCEBNL art. 16, 5°, et Partie 4 ch. 1 § 1.4). Mais le
 * commentaire officiel des deux modèles demande d'« indiquer les événements
 * et circonstances qui ont conduit à la constitution et à la reprise de la
 * dépréciation » (NOTE 28) ou « à la dépréciation et à la reprise » (5F) · la
 * mise en service EST cet événement, et une dotation lue 1 700 000 pour une
 * hausse réelle de 300 000 influence le jugement (AUDCIF art. 33, al. 3 ;
 * SYCEBNL art. 15, al. 3). Le serveur sert donc la phrase, chiffrée, pour
 * chaque exercice qui porte un transfert ; aucune ligne n'est ajoutée aux
 * modèles, que les balayages tiennent.
 *
 * LE MONTANT SE LIT PAR LA NATURE DU MOUVEMENT (`TRANSFERT_REPRISE`,
 * `TRANSFERT_DOTATION`), jamais par les numéros de compte · un 29x9 se
 * déprécie aussi à la clôture, et sa reprise de clôture n'est pas un transfert.
 * Le niveau (exploitation ou H.A.O.) se lit sur la contrepartie que le
 * mouvement a passée, comme la note ventile ses colonnes · 853 / 863 au
 * H.A.O., 691 / 791 à l'exploitation (fiches des comptes 29, 69 et 79).
 *
 * La note ne lit que le livre-journal (`chargerLignes`) · un transfert dont
 * l'écriture est au brouillard n'est pas dans ses colonnes, et la phrase le dit
 * à part, sans le compter.
 */

/** Le tableau qui porte la dépréciation des immobilisations, par jeu. Aucun autre jeu ne la sert. */
export const NOTE_DU_TRANSFERT: Partial<Record<JeuNotesAnnexes, string>> = {
  [JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: '28',
  [JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: '5F',
};

export interface MouvementDeTransfert {
  nature: 'TRANSFERT_REPRISE' | 'TRANSFERT_DOTATION';
  montant: number;
  /** Le 29 mouvementé · le 29x9 pour la reprise, le 29 du bien achevé pour la dotation. */
  numeroCompteDepreciation: string;
  /** La contrepartie de gestion · 791 ou 863 pour la reprise, 691 ou 853 pour la dotation. */
  numeroContrepartie: string;
  /** L'écriture est au livre-journal. */
  valide: boolean;
}

const EPSILON = 0.005;
const centimes = (x: number) => Math.round(x * 100) / 100;
const montant = (n: number) => centimes(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function estHao(m: MouvementDeTransfert): boolean {
  return m.nature === 'TRANSFERT_DOTATION' ? m.numeroContrepartie.startsWith('85') : m.numeroContrepartie.startsWith('86');
}

function niveaux(ms: MouvementDeTransfert[]): string {
  const hao = ms.some(estHao);
  const exploitation = ms.some((m) => !estHao(m));
  return hao && exploitation ? 'exploitation et H.A.O.' : hao ? 'H.A.O.' : 'exploitation';
}

/**
 * Les phrases servies à la note, ou une liste vide quand l'exercice ne porte
 * aucun transfert. `ligneDe` rend la rubrique de la note qui lit un compte,
 * `null` si aucune · quand la reprise et la dotation tombent sur deux lignes
 * (au 5F, 2919 en « Autres immobilisations incorporelles » et 2913 en
 * « Logiciels et sites internet »), la phrase nomme les deux.
 */
export function phrasesTransfertDepreciation(
  mouvements: MouvementDeTransfert[],
  ligneDe: (numero: string) => string | null,
): string[] {
  const phrases: string[] = [];
  const valides = mouvements.filter((m) => m.valide);
  const reprises = valides.filter((m) => m.nature === 'TRANSFERT_REPRISE');
  const dotations = valides.filter((m) => m.nature === 'TRANSFERT_DOTATION');
  const total = (ms: MouvementDeTransfert[]) => centimes(ms.reduce((s, m) => s + m.montant, 0));
  const reprise = total(reprises);
  const dotation = total(dotations);
  if (reprise > EPSILON || dotation > EPSILON) {
    const lignes = (ms: MouvementDeTransfert[]) => [...new Set(ms.map((m) => ligneDe(m.numeroCompteDepreciation)))];
    const lignesReprise = lignes(reprises);
    const lignesDotation = lignes(dotations);
    const memeLigne =
      lignesReprise.length === 1 &&
      lignesDotation.length === 1 &&
      lignesReprise[0] === lignesDotation[0];
    const nomme = (ls: Array<string | null>) =>
      ls.every((l) => l !== null) && ls.length > 0
        ? ` sur la ligne ${ls.map((l) => `« ${l} »`).join(' et ')}`
        : '';
    const surReprise = memeLigne ? '' : nomme(lignesReprise);
    const surDotation = memeLigne ? '' : nomme(lignesDotation);
    phrases.push(
      `Dont transfert à la mise en service · ${montant(reprise)} en reprise${surReprise} et ${montant(dotation)} en ` +
        `dotation${surDotation} (${niveaux(valides)}), dépréciation déjà constatée sur l'immobilisation en cours, ` +
        'portée au compte du bien achevé, sans perte de valeur nouvelle.',
    );
  }
  const auBrouillard = mouvements.filter((m) => !m.valide);
  if (auBrouillard.length > 0) {
    const r = total(auBrouillard.filter((m) => m.nature === 'TRANSFERT_REPRISE'));
    const d = total(auBrouillard.filter((m) => m.nature === 'TRANSFERT_DOTATION'));
    phrases.push(
      `Transfert à la mise en service au brouillard · ${montant(r)} en reprise et ${montant(d)} en dotation, hors des ` +
        'colonnes de la note tant que ses écritures ne sont pas validées.',
    );
  }
  return phrases;
}

/**
 * La rubrique d'un tableau qui lit un compte · un rattachement du dossier
 * d'abord (exact ou racine), puis la racine la plus longue des rubriques du
 * modèle, totaux exclus. `null` si aucune ne le lit.
 */
export function rubriqueQuiLit(
  numero: string,
  rubriques: Array<{ libelle: string; comptes?: string[]; totalDeRubriques?: number[] }>,
  rattaches: Array<{ libelle: string; comptesRattaches?: string[] }>,
): string | null {
  for (const r of rattaches) {
    if ((r.comptesRattaches ?? []).some((c) => numero.startsWith(c) || c.startsWith(numero))) return r.libelle;
  }
  let retenue: { libelle: string; longueur: number } | null = null;
  for (const r of rubriques) {
    if (r.totalDeRubriques) continue;
    for (const prefixe of r.comptes ?? []) {
      if (numero.startsWith(prefixe) && (!retenue || prefixe.length > retenue.longueur)) {
        retenue = { libelle: r.libelle, longueur: prefixe.length };
      }
    }
  }
  return retenue?.libelle ?? null;
}
