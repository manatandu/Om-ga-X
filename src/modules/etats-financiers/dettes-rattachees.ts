import { Prisma, StatutEcriture } from '@prisma/client';
import { LOT_LECTURE, lireParLots, pageApres } from '../../common/lecture-par-lots';
import { ouverteALaCloture } from '../lettrage/ouverte-a-la-cloture';
import { pairesACheval } from '../lettrage/paires-a-cheval';
import { correspond } from './etats-financiers.communs';
import { LigneDuGroupe, Lecteur, SELECT_LIGNE, estANouveau, factureDOrigine } from './reglements-de-tresorerie';

/**
 * LA DETTE « CONCERNÉE », JAMAIS UN PRORATA (cas chiffrés de la clôture,
 * constat B4, 2026-10-07).
 *
 * Au tableau emplois-ressources d'un projet, les achats (FM), les transports
 * (FN) et les services extérieurs (FO) se corrigent de « la variation des
 * dettes fournisseurs d'exploitation (+ solde […] N-1 du compte 401 CONCERNÉ
 * − solde […] N du compte 401 concerné) » (SYCEBNL, guide d'application,
 * Application 21, renvoi (4)) ; les immobilisations, du « compte 481
 * concerné » (renvoi (2)). Le texte n'écrit aucun prorata · le 401 qui
 * « concerne » les achats est celui des dettes NÉES des achats. Répartie au
 * prorata du mouvement brut des trois postes, la dette d'une facture de
 * fournitures (60) diminuait les transports et les services extérieurs, qui
 * n'en devaient rien (C10 · FM 1 705 882,35 au lieu de 1 500 000).
 *
 * LA DETTE À UNE DATE se lit sur les LIGNES du compte, comme la balance qui la
 * porte · à l'ouverture, les lignes d'à-nouveau de l'exercice (le report) ; à
 * la clôture, les lignes de l'exercice ouvertes à sa date de fin
 * (`ouverteALaCloture`), celles qu'une paire à cheval éteint retirées et le
 * reste d'une ligne d'à-nouveau réglée en partie gardé (`pairesACheval`).
 * Chaque ligne se rattache à la PIÈCE qui l'a fait naître · la sienne, ou,
 * pour une ligne d'à-nouveau, la facture qu'elle reporte (« RAN détail
 * <compte> · <libellé> », même appariement que le règlement au SMT,
 * `factureDOrigine`).
 *
 * LA PIÈCE SE PARTAGE ENTRE LES POSTES selon SES propres lignes de charge (ou
 * d'immobilisation) · une facture de fournitures et de transport partage sa
 * dette comme elle partage son montant. C'est la composition de la pièce,
 * convention d'OmegaX dite · le texte ne règle pas la facture qui mêle deux
 * postes. La taxe et les autres lignes de la pièce suivent ses lignes de
 * poste (la dette est celle de la facture entière).
 *
 * RIEN N'EST DEVINÉ · une ligne d'à-nouveau sans facture unique (report au
 * SOLDE, bilan d'ouverture importé, deux candidates), une pièce sans ligne
 * des postes (règlement non lettré, avance) ne se rattachent à aucun poste.
 * ET LE COMPTE QUI EN PORTE UNE NE SE RATTACHE PAS DU TOUT, à cette date · un
 * règlement non lettré solde une facture qu'on ne sait pas nommer, et
 * rattacher les factures en laissant le règlement au reste répartirait
 * celui-ci sur des postes qui ne devaient rien (C10, le véhicule payé et non
 * lettré au 4812 · la dette rattachée au matériel de transport, son
 * règlement réparti sur toutes les immobilisations). Le compte entier va au
 * reste. L'appelant ne répartit plus que CE RESTE au prorata du brut, et le
 * NOMME · lettrer le règlement lève la réserve.
 */

export interface ComptesDeDette {
  comptes: string[];
  exclusions?: string[];
}

export interface PosteDeRattachement {
  ref: string;
  comptes: string[];
  exclusions?: string[];
}

export interface DetteLue {
  ligneId: string;
  /** Le compte de la ligne · un compte qui porte une ligne non rattachable va entier au reste. */
  compteId: string;
  /** Crédit moins débit, en francs · positif pour une dette. */
  montant: number;
  /** L'écriture de la pièce qui l'a fait naître · `null` quand elle ne se retrouve pas. */
  ecritureOrigineId: string | null;
}

export interface DettesParPoste {
  /** Par REF de poste, la part de la dette rattachée à ses lignes. */
  parRef: Map<string, number>;
  /** La part qui ne se rattache à aucun poste. */
  nonRattache: number;
}

const centimes = (x: unknown) => Math.round(Number(x ?? 0) * 100);
const TRANCHE = 500;
/** Lectures de factures d'origine menées ensemble · bornées, une requête chacune. */
const EN_PARALLELE = 10;

export function filtreComptes(c: ComptesDeDette): Prisma.CompteWhereInput {
  return {
    OR: c.comptes.map((p) => ({ numero: { startsWith: p } })),
    ...(c.exclusions && c.exclusions.length > 0 ? { NOT: c.exclusions.map((x) => ({ numero: { startsWith: x } })) } : {}),
  };
}

/**
 * La facture d'un RÈGLEMENT lettré (acompte, paiement partiel) · la seule
 * ligne créditrice de son groupe, autre que lui (relecture du 2026-10-07,
 * mineur 4). Sans elle, l'acompte n'avait aucune ligne de poste et envoyait
 * tout le compte au reste, réparti au prorata. Un groupe à plusieurs
 * factures ne dit pas laquelle il règle · `null`, rien n'est deviné.
 */
async function factureDuGroupe(db: Lecteur, tenantId: string, ligne: LigneDuGroupe): Promise<LigneDuGroupe | null> {
  if (!ligne.lettrageId || centimes(ligne.credit) - centimes(ligne.debit) >= 0) return null;
  const groupe = (await db.ligneEcriture.findMany({
    where: { lettrageId: ligne.lettrageId, ecriture: { tenantId } },
    select: SELECT_LIGNE,
  })) as LigneDuGroupe[];
  const factures = groupe.filter((l) => l.id !== ligne.id && centimes(l.credit) - centimes(l.debit) > 0);
  if (factures.length !== 1) return null;
  return estANouveau(factures[0].ecriture) ? factureDOrigine(db, tenantId, factures[0]) : factures[0];
}

/**
 * La pièce d'origine de chaque ligne · la sienne, celle que l'à-nouveau
 * reporte, ou, pour un règlement lettré, celle de la facture de son groupe.
 */
async function rattacherALaPiece(
  db: Lecteur,
  tenantId: string,
  lignes: Array<{ ligne: LigneDuGroupe; montant: number }>,
): Promise<DetteLue[]> {
  const rendu: DetteLue[] = [];
  for (let i = 0; i < lignes.length; i += EN_PARALLELE) {
    const lot = lignes.slice(i, i + EN_PARALLELE);
    const origines = await Promise.all(
      lot.map(async ({ ligne }) => {
        const facture = await factureDuGroupe(db, tenantId, ligne);
        if (facture) return facture;
        return estANouveau(ligne.ecriture) ? factureDOrigine(db, tenantId, ligne) : ligne;
      }),
    );
    lot.forEach(({ ligne, montant }, k) =>
      rendu.push({ ligneId: ligne.id, compteId: ligne.compteId, montant, ecritureOrigineId: origines[k]?.ecriture.id ?? null }),
    );
  }
  return rendu;
}

/**
 * La dette à l'OUVERTURE de l'exercice · ses lignes d'à-nouveau validées sur
 * ces comptes, telles que le report les porte (la colonne « report » de la
 * balance les lit, et elles seules).
 */
export async function dettesALOuverture(db: Lecteur, tenantId: string, exerciceId: string, comptes: ComptesDeDette): Promise<DetteLue[]> {
  const lues: Array<{ ligne: LigneDuGroupe; montant: number }> = [];
  await lireParLots(
    (curseur) =>
      db.ligneEcriture.findMany({
        where: {
          compte: filtreComptes(comptes),
          ecriture: {
            tenantId,
            exerciceId,
            statut: StatutEcriture.VALIDEE,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: false,
          },
        },
        select: SELECT_LIGNE,
        ...pageApres(curseur, LOT_LECTURE),
      }) as Promise<LigneDuGroupe[]>,
    (l) => lues.push({ ligne: l, montant: (centimes(l.credit) - centimes(l.debit)) / 100 }),
  );
  return rattacherALaPiece(db, tenantId, lues);
}

/**
 * La dette à la CLÔTURE de l'exercice · ses lignes validées ouvertes à sa date
 * de fin, sans celles qu'une paire à cheval éteint, le reste d'une ligne
 * d'à-nouveau réglée en partie à la place de son montant.
 */
export async function dettesALaCloture(
  db: Lecteur,
  tenantId: string,
  exercice: { id: string; dateDebut: Date; dateFin: Date },
  comptes: ComptesDeDette,
): Promise<DetteLue[]> {
  const paires = await pairesACheval(db, { tenantId, exercice, compte: filtreComptes(comptes) });
  const lues: Array<{ ligne: LigneDuGroupe; montant: number }> = [];
  await lireParLots(
    (curseur) =>
      db.ligneEcriture.findMany({
        where: {
          compte: filtreComptes(comptes),
          ecriture: { tenantId, exerciceId: exercice.id, statut: StatutEcriture.VALIDEE },
          ...ouverteALaCloture(exercice.dateFin),
        },
        select: SELECT_LIGNE,
        ...pageApres(curseur, LOT_LECTURE),
      }) as Promise<LigneDuGroupe[]>,
    (l) => {
      if (paires.absorbees.has(l.id)) return;
      const reste = paires.reste.get(l.id);
      const montant = reste ? -reste.francs : (centimes(l.credit) - centimes(l.debit)) / 100;
      lues.push({ ligne: l, montant });
    },
  );
  return rattacherALaPiece(db, tenantId, lues);
}

/**
 * La dette PARTAGÉE ENTRE LES POSTES selon la composition de sa pièce · la
 * somme des parts et du non rattaché vaut la dette lue, au centime.
 */
export async function dettesParPoste(
  db: Lecteur,
  tenantId: string,
  dettes: DetteLue[],
  postes: PosteDeRattachement[],
): Promise<DettesParPoste> {
  const rendu: DettesParPoste = { parRef: new Map(), nonRattache: 0 };
  const posteDe = (numero: string) => postes.find((p) => correspond(numero, p.comptes, p.exclusions))?.ref ?? null;

  // La composition de chaque pièce, par poste, en centimes.
  const pieces = [...new Set(dettes.map((d) => d.ecritureOrigineId).filter((x): x is string => x !== null))];
  const composition = new Map<string, Map<string, number>>();
  for (let i = 0; i < pieces.length; i += TRANCHE) {
    const lues = (await db.ligneEcriture.findMany({
      where: { ecritureId: { in: pieces.slice(i, i + TRANCHE) }, ecriture: { tenantId } },
      select: { ecritureId: true, debit: true, credit: true, compte: { select: { numero: true } } },
    })) as Array<{ ecritureId: string; debit: unknown; credit: unknown; compte: { numero: string } }>;
    for (const l of lues) {
      const ref = posteDe(l.compte.numero);
      if (!ref) continue;
      const parts = composition.get(l.ecritureId) ?? new Map<string, number>();
      parts.set(ref, (parts.get(ref) ?? 0) + centimes(l.debit) - centimes(l.credit));
      composition.set(l.ecritureId, parts);
    }
  }

  // La part de chaque ligne par poste, en centimes · `null` quand elle ne se
  // rattache pas (aucune pièce, ou une pièce sans ligne des postes). Un
  // avoir (dette négative, lignes de poste au crédit) se rattache comme sa
  // facture · seul un total nul ne dit rien.
  const partsDe = (d: DetteLue): Array<[string, number]> | null => {
    const enCentimes = Math.round(d.montant * 100);
    const parts = d.ecritureOrigineId ? [...(composition.get(d.ecritureOrigineId) ?? new Map<string, number>()).entries()] : [];
    const total = parts.reduce((s, [, c]) => s + c, 0);
    if (parts.length === 0 || total === 0) return null;
    let reste = enCentimes;
    return parts.map(([ref, c], k) => {
      const part = k === parts.length - 1 ? reste : Math.round((enCentimes * c) / total);
      reste -= part;
      return [ref, part];
    });
  };

  let nonRattache = 0;
  const parRef = new Map<string, number>();
  const parCompte = new Map<string, DetteLue[]>();
  for (const d of dettes) parCompte.set(d.compteId, [...(parCompte.get(d.compteId) ?? []), d]);
  for (const lignesDuCompte of parCompte.values()) {
    const parts = lignesDuCompte.map(partsDe);
    if (parts.some((p) => p === null)) {
      nonRattache += lignesDuCompte.reduce((s, d) => s + Math.round(d.montant * 100), 0);
      continue;
    }
    for (const p of parts) for (const [ref, c] of p!) parRef.set(ref, (parRef.get(ref) ?? 0) + c);
  }
  for (const [ref, c] of parRef) rendu.parRef.set(ref, c / 100);
  rendu.nonRattache = nonRattache / 100;
  return rendu;
}

/**
 * LES DETTES DU 40 NÉES D'IMMOBILISATIONS, à l'ouverture et à la clôture
 * (demande du coordinateur après la relecture du 2026-10-07, majeur 3 bis).
 *
 * La fiche du compte 40 des deux plans renvoie les fournisseurs
 * d'immobilisations au 481, que la variation des dettes d'exploitation (VC
 * au SMT SYCEBNL, ligne E au SMT SYSCOHADA) n'a jamais lu. Passée au 401, la
 * dette d'une immobilisation entrait dans VC, et son règlement, rattaché
 * comme au 481 au compte de l'immobilisation (classe 2, flux hors
 * exploitation), sortait de la caisse d'exploitation · KZC faux du montant
 * de la dette dès qu'elle était ouverte à une clôture. La dette se lit donc
 * par la MÊME règle que son règlement (`naturesDesReglementsFournisseurs`) ·
 * la part de chaque pièce sur la classe 2 sort de VC, celle des classes 6 à
 * 8 y reste, et celle d'un autre compte (taxe) y reste aussi, comme son
 * règlement reste au 40. Une ligne qui ne se rattache pas (règlement non
 * lettré, report au solde) reste dans VC, comme son règlement reste en
 * dépense, et le règlement est nommé.
 */
export const POSTES_NATURE_DETTE_FOURNISSEUR: PosteDeRattachement[] = [
  { ref: 'IMMOBILISATION', comptes: ['2'] },
  { ref: 'RESULTAT', comptes: ['6', '7', '8'] },
  { ref: 'AUTRE', comptes: ['1', '3', '4', '9'], exclusions: ['40'] },
];

export async function dettesFournisseursNeesDImmobilisations(
  db: Lecteur,
  tenantId: string,
  exercice: { id: string; dateDebut: Date; dateFin: Date },
  comptes: ComptesDeDette,
): Promise<{ ouverture: number; cloture: number }> {
  const [ouverture, cloture] = await Promise.all([
    dettesALOuverture(db, tenantId, exercice.id, comptes).then((d) => dettesParPoste(db, tenantId, d, POSTES_NATURE_DETTE_FOURNISSEUR)),
    dettesALaCloture(db, tenantId, exercice, comptes).then((d) => dettesParPoste(db, tenantId, d, POSTES_NATURE_DETTE_FOURNISSEUR)),
  ]);
  return { ouverture: ouverture.parRef.get('IMMOBILISATION') ?? 0, cloture: cloture.parRef.get('IMMOBILISATION') ?? 0 };
}
