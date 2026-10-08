import { Prisma, StatutLettrage } from '@prisma/client';
import { pageApres } from '../../common/lecture-par-lots';
import {
  originesDesLignes,
  restesDesFactures,
  restesParLImputationLegale,
  type LigneDeGroupe,
  type OrigineDeLigne,
  type ResteDeFacture,
} from '../lettrage/reconduction-lettrage';
import type { FactureEnDevise } from './ecart-change-realise';
import type { SensReglement } from './reglement-tiers';

/**
 * LE RÈGLEMENT D'UNE FACTURE D'UN LETTRAGE PARTIEL (ligne lettrage-cloture).
 *
 * Une facture réunie en partiel avec son acompte (en N, ou reconduite par la
 * clôture sur ses lignes d'à-nouveau en N+1) ne doit plus que son RESTE ·
 * fiche du compte 41 (« crédité des avances et acomptes ainsi que des
 * règlements reçus des clients »), du compte 40 (« débité des avances et
 * acomptes versés aux fournisseurs ainsi que des règlements effectués sur
 * factures »), aux deux plans. Le Règlement des tiers ne la servait pas
 * (« déjà lettrée · elle n'est plus due », ce qui était faux) ou, reportée
 * sans son groupe, la servait ENTIÈRE · 34 800 000 réglés pour 14 800 000 dus,
 * le client créditeur de 20 000 000 sans un mot. Elle est désormais servie
 * pour son reste (`restesDesFactures` · ce que le compte du tiers porte pour
 * elle, dans l'ordre d'inscription des règlements ; en devise au coût
 * historique, art. 54 et 55), BORNÉE à lui (plus que le dû est refusé, règle
 * (3) du règlement, message nommé), et le règlement COMPLÈTE le groupe au
 * lieu d'en ouvrir un second.
 *
 * Trois refus nommés, avec leur issue · un groupe SOLDÉ (la facture n'est plus
 * due) ; un groupe à cheval de deux exercices (la paire le lit, il se
 * complète depuis l'interrogation du compte) ; un groupe verrouillé. Un même
 * règlement ne réunit pas deux groupes partiels.
 */

/** Un groupe partiel lu pour le règlement, avec toutes ses lignes. */
export interface GroupePourReglement {
  id: string;
  code: string;
  statut: StatutLettrage;
  verrouille: boolean;
  compteId: string;
  /** Le groupe de l'exercice précédent qu'il reconduit · l'origine de ses lignes (ordre d'inscription). */
  lettrageReconduitId?: string | null;
  /** Le solde du groupe tel qu'il est enregistré · relu par `completer` (409 s'il a changé). */
  solde?: Prisma.Decimal | number;
  compte: { numero: string };
  lignes: Array<{
    id: string;
    compteId: string;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
    dateEcheance: Date | null;
    deviseId: string | null;
    montantDevise: Prisma.Decimal | number | null;
    libelle: string | null;
    ecriture: { exerciceId: string; date: Date; libelle: string };
  }>;
}

const SELECT_GROUPE = {
  id: true,
  code: true,
  statut: true,
  verrouille: true,
  compteId: true,
  lettrageReconduitId: true,
  solde: true,
  compte: { select: { numero: true } },
  lignes: {
    select: {
      id: true,
      compteId: true,
      debit: true,
      credit: true,
      dateEcheance: true,
      deviseId: true,
      montantDevise: true,
      libelle: true,
      ecriture: { select: { exerciceId: true, date: true, libelle: true } },
    },
  },
} satisfies Prisma.LettrageSelect;

type Lecteur = { lettrage: { findMany: (args: Prisma.LettrageFindManyArgs) => Promise<unknown[]> } };

/** Des groupes lus, et l'origine des lignes de ceux qui sont reconduits (date et ligne). */
export interface GroupesLus {
  groupes: Map<string, GroupePourReglement>;
  origines: Map<string, OrigineDeLigne>;
}

/** Les groupes que nomment des lignes choisies · lus avec toutes leurs lignes, et l'origine des reconduites. */
export async function groupesDesLignes(db: unknown, tenantId: string, lettrageIds: string[]): Promise<GroupesLus> {
  if (lettrageIds.length === 0) return { groupes: new Map(), origines: new Map() };
  const lus = (await (db as Lecteur).lettrage.findMany({
    where: { tenantId, id: { in: [...new Set(lettrageIds)] } },
    select: SELECT_GROUPE,
  })) as GroupePourReglement[];
  return { groupes: new Map(lus.map((g) => [g.id, g])), origines: await originesDesLignes(db, tenantId, lus) };
}

/** Le sens des factures d'un règlement · un client doit au débit, on doit au fournisseur au crédit. */
const sensDesFactures = (sens: SensReglement) => (sens === 'CLIENT' ? 'DEBIT' : 'CREDIT');

/** Les lignes d'un groupe telles que le reste les lit · pièce d'origine (date, ligne), échéance. */
export function lignesDuGroupe(g: GroupePourReglement, origines: Map<string, OrigineDeLigne>): LigneDeGroupe[] {
  return g.lignes.map((l) => ({
    id: l.id,
    debit: Number(l.debit),
    credit: Number(l.credit),
    deviseId: l.deviseId,
    montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
    date: origines.get(l.id)?.date ?? l.ecriture.date,
    cle: origines.get(l.id)?.id ?? l.id,
    dateEcheance: l.dateEcheance,
  }));
}

/** Les restes des factures d'un groupe, dans le sens du règlement. */
export function restesDuGroupe(
  g: GroupePourReglement,
  sens: SensReglement,
  origines: Map<string, OrigineDeLigne> = new Map(),
): Map<string, ResteDeFacture> {
  return restesDesFactures(lignesDuGroupe(g, origines), sensDesFactures(sens));
}

/**
 * UNE FACTURE D'UN GROUPE SE SERT TANT QU'ELLE DOIT · dans sa devise pour
 * une facture en devise (un reste en francs sans devise est le réalisé d'un
 * ancien règlement inscrit au payé, que l'écart proposé au groupe soldé
 * reprend, jamais un dû), en francs sinon ou quand sa devise est inconnue.
 */
export function factureEncoreDue(r: ResteDeFacture): boolean {
  return r.devise === null || r.deviseIndeterminee ? r.francs > 0 : r.devise > 0;
}

/**
 * LES FACTURES DU GROUPE QU'UN RÈGLEMENT EN DEVISE ÉPUISE, dans l'ordre
 * d'inscription (relecture TypeScript du second tour, majeur) · toutes les
 * factures encore dues du groupe dans cette devise, à leur reste, sous la clé
 * de leur pièce d'origine · le coût historique du règlement
 * (`coutHistoriqueRegle`) se calcule sur elles, et le reste relu ensuite
 * (`restesDesFactures`) retrouve ce que le règlement a inscrit, facture par
 * facture. Choisir une facture du groupe désigne le groupe · son reste suit
 * l'ordre du groupe (D5), et le règlement le dit (`avertissementImputationDuGroupe`).
 * `null` quand une facture de cette devise a un reste en devise inconnu.
 */
export function fileDuGroupeEnDevise(
  g: GroupePourReglement,
  sens: SensReglement,
  origines: Map<string, OrigineDeLigne>,
  deviseId: string,
): FactureEnDevise[] | null {
  const restes = restesDuGroupe(g, sens, origines);
  const file: FactureEnDevise[] = [];
  for (const l of g.lignes) {
    const r = restes.get(l.id);
    if (!r || l.deviseId !== deviseId) continue;
    if (r.deviseIndeterminee) return null;
    if (!factureEncoreDue(r)) continue;
    file.push({ id: origines.get(l.id)?.id ?? l.id, francs: r.francs, montantDevise: r.devise!, date: origines.get(l.id)?.date ?? l.ecriture.date });
  }
  return file;
}

/**
 * Pourquoi une ligne choisie, tenue par un groupe, ne se règle pas ici ·
 * `null` quand son groupe est PARTIEL, ouvert, tout entier dans l'exercice du
 * règlement · elle se règle alors pour son reste, et le règlement complète
 * le groupe.
 */
export function motifLigneDuGroupe(numero: string, g: GroupePourReglement | undefined, exerciceId: string): string | null {
  if (!g || g.statut === StatutLettrage.SOLDE) return `Une facture du compte ${numero} est déjà lettrée · elle n'est plus due.`;
  const code = g.code.toLowerCase();
  if (g.lignes.some((l) => l.ecriture.exerciceId !== exerciceId)) {
    return (
      `Une facture du compte ${numero} appartient au lettrage partiel ${code}, qui touche un autre exercice · son reste se lit par ` +
      "la ligne d'à-nouveau qui la reporte. Complétez ce lettrage depuis Interrogation et lettrage, ou réglez la ligne d'à-nouveau."
    );
  }
  if (g.verrouille) return `Une facture du compte ${numero} appartient au lettrage partiel ${code}, verrouillé · déverrouillez-le avant de régler son reste.`;
  return null;
}

/** Un règlement ne réunit pas deux groupes partiels · leur issue est de les régler une pièce chacun. */
export function motifDeuxGroupes(numero: string, codes: string[]): string | null {
  if (codes.length <= 1) return null;
  return (
    `${numero} · les factures choisies appartiennent à ${codes.length} lettrages partiels (${codes.map((c) => c.toLowerCase()).join(', ')}) · ` +
    'un règlement complète un seul lettrage. Réglez-les une pièce chacun.'
  );
}

/**
 * Le refus d'un montant au-delà du reste · il NOMME le lettrage partiel et ce
 * qu'il a déjà réglé (ligne lettrage-cloture, attendu (2)). Le reste se lit
 * dans le sens du règlement, au centime.
 */
export function motifRefusMontantDuGroupe(numero: string, montant: number, du: number, code: string, regle: number, enDevise = false): string | null {
  if (Math.round(montant * 100) <= Math.round(du * 100)) return null;
  const f = (x: number) => x.toFixed(2);
  return (
    `${numero} · le montant réglé (${f(montant)}) dépasse le reste dû (${f(du)})${enDevise ? ' dans la devise des factures' : ''} · la facture choisie appartient ` +
    `au lettrage partiel ${code.toLowerCase()}, qui en a déjà réglé ${f(regle)} (acomptes, règlements ou avoirs réunis avec elle ; à l'ouverture de ` +
    "l'exercice, reconduit par la clôture, AUDCIF art. 34). L'excédent est une avance ou un trop-perçu, à comptabiliser à part."
  );
}

/** Une facture d'un lettrage partiel servie à l'échéancier · avec ce qu'elle doit encore. */
export interface EcheanceDUnGroupe {
  ligneId: string;
  groupe: { id: string; code: string };
  reste: ResteDeFacture;
}

/** Tranche de groupes lus à la fois par l'échéancier. */
const LOT_GROUPES_ECHEANCIER = 500;

/**
 * LES FACTURES DES LETTRAGES PARTIELS DE L'EXERCICE, servies pour leur reste
 * · groupe PARTIEL, ouvert, tout entier dans l'exercice, sur les comptes du
 * sens du règlement. Lus par tranches · le reste se calcule sur TOUTES les
 * lignes du groupe.
 */
export async function echeancesDesGroupesPartiels(
  db: unknown,
  p: { tenantId: string; exerciceId: string; sens: SensReglement },
): Promise<EcheanceDUnGroupe[]> {
  const lecteur = db as Lecteur;
  const rendues: EcheanceDUnGroupe[] = [];
  let curseur: string | undefined;
  for (;;) {
    const lot = (await lecteur.lettrage.findMany({
      where: {
        tenantId: p.tenantId,
        statut: StatutLettrage.PARTIEL,
        verrouille: false,
        compte: { numero: { startsWith: p.sens === 'FOURNISSEUR' ? '40' : '41' } },
        lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: p.exerciceId } } },
        NOT: { lignes: { some: { ecriture: { tenantId: p.tenantId, exerciceId: { not: p.exerciceId } } } } },
      },
      select: SELECT_GROUPE,
      ...pageApres(curseur, LOT_GROUPES_ECHEANCIER),
    })) as GroupePourReglement[];
    const origines = await originesDesLignes(db, p.tenantId, lot);
    for (const g of lot) {
      if (g.lignes.some((l) => l.ecriture.exerciceId !== p.exerciceId)) continue;
      for (const [ligneId, reste] of restesDuGroupe(g, p.sens, origines)) {
        if (factureEncoreDue(reste)) rendues.push({ ligneId, groupe: { id: g.id, code: g.code }, reste });
      }
    }
    if (lot.length < LOT_GROUPES_ECHEANCIER) return rendues;
    curseur = lot[lot.length - 1].id;
  }
}

/**
 * LE RÈGLEMENT EN DEVISE D'UNE FACTURE AU RESTE INDÉTERMINÉ EST REFUSÉ
 * (relecture « échecs silencieux », bloquant 1 · règle d'A6, « jamais
 * deviné »). Le groupe porte un acompte, un règlement ou un avoir sans montant
 * dans la devise de la facture · ce qu'il en a réglé DANS SA DEVISE ne se
 * déduit pas (AUDCIF art. 54 et 55). Le compter pour rien laissait la facture
 * due de 1 000 USD après 1 680 000 francs d'acompte, et 1 000 USD à 3 000
 * passaient (656 de 1 880 000, banque de 3 000 000 pour 400 USD dus).
 */
export function motifDeviseIndeterminee(numero: string, code: string): string {
  return (
    `${numero} · la facture en devise choisie appartient au lettrage partiel ${code.toLowerCase()}, qui porte un acompte, un règlement ou ` +
    'un avoir en francs seuls (ou dans une autre devise) · ce qu’il en a réglé dans sa devise ne se déduit pas (AUDCIF art. 54 et 55), et son ' +
    'reste en devise est inconnu. Deux issues · passez le règlement au journal de trésorerie et lettrez-le à la main depuis Interrogation et ' +
    'lettrage ; ou annulez l’acompte en francs (inscription en négatif) et repassez-le avec son montant en devise, puis réglez la facture ici.'
  );
}

/** Le nom d'une facture dans un message · son libellé et la date de sa pièce d'origine. */
function nomDeLaFacture(l: GroupePourReglement['lignes'][number], origines: Map<string, OrigineDeLigne>): string {
  return `« ${l.libelle ?? l.ecriture.libelle} » du ${(origines.get(l.id)?.date ?? l.ecriture.date).toISOString().slice(0, 10)}`;
}

/**
 * CE QUE LE RÈGLEMENT FERA DANS LE GROUPE, DIT AVANT LA PIÈCE · rien n'est
 * refusé (relecture « échecs silencieux », majeur 5 ; relecture TypeScript
 * du second tour, majeur).
 *
 * (1) L'INSCRIPTION · le règlement épuise les factures du groupe dans
 * l'ordre d'inscription (la plus ancienne pièce d'abord, `restesDesFactures`),
 * et non la seule facture choisie · un groupe {F1 10 000, F2 5 000, acompte
 * 8 000} réglé « sur F2 » de 5 000 éteint d'abord les 2 000 de F1.
 *
 * (2) LA TVA · la déclaration impute les sommes par la loi (Code civil, Livre
 * III, art. 154 · les échues d'abord, puis la plus ancienne, au prorata à
 * date égale · `restesParLImputationLegale`) · quand cette imputation porte
 * le règlement sur une autre facture que la choisie, la date d'exigibilité ou
 * de déduction de sa TVA la suit.
 *
 * Rend `null` quand le règlement ne touche, des deux façons, que les factures
 * choisies.
 */
export function avertissementImputationDuGroupe(e: {
  numero: string;
  groupe: GroupePourReglement;
  origines: Map<string, OrigineDeLigne>;
  sens: SensReglement;
  choisies: string[];
  date: Date;
  /** Le règlement en francs, ou en devise (`deviseId` donné). */
  montant: number;
  deviseId: string | null;
}): string | null {
  const lignes = lignesDuGroupe(e.groupe, e.origines);
  const paiement: LigneDeGroupe = {
    id: '__reglement',
    // Un client paie au crédit de son compte, on paie un fournisseur au débit.
    debit: e.sens === 'FOURNISSEUR' ? e.montant : 0,
    credit: e.sens === 'CLIENT' ? e.montant : 0,
    deviseId: e.deviseId,
    montantDevise: e.deviseId ? e.montant : null,
    date: e.date,
  };
  const sens = sensDesFactures(e.sens);
  const portees = (avant: Map<string, { francs: number; devise: number | null }>, apres: Map<string, { francs: number; devise: number | null }>) => {
    const dites: string[] = [];
    for (const l of e.groupe.lignes) {
      if (e.choisies.includes(l.id)) continue;
      const a = avant.get(l.id);
      const b = apres.get(l.id);
      if (!a || !b) continue;
      const pris = e.deviseId ? (a.devise ?? 0) - (b.devise ?? 0) : a.francs - b.francs;
      if (pris > 0.005) dites.push(`${pris.toFixed(2)}${e.deviseId ? ' en devise' : ''} sur ${nomDeLaFacture(l, e.origines)}`);
    }
    return dites;
  };
  const inscription = portees(restesDesFactures(lignes, sens), restesDesFactures([...lignes, paiement], sens));
  const legale = portees(restesParLImputationLegale(lignes, sens), restesParLImputationLegale([...lignes, paiement], sens));
  const phrases: string[] = [];
  if (inscription.length > 0) {
    phrases.push(
      `le règlement s’inscrit d’abord sur les factures les plus anciennes du groupe · ${inscription.join(' et ')}, avant la facture choisie, ` +
        'qui reste due d’autant',
    );
  }
  if (legale.length > 0) {
    phrases.push(
      'à défaut d’imputation déclarée, la déclaration de TVA suit l’imputation légale (Code civil, Livre III, art. 154 · les factures ' +
        `échues d’abord, puis la plus ancienne, au prorata à date égale), qui porte ${legale.join(' et ')} de ce règlement · la date ` +
        'd’exigibilité ou de déduction de leur TVA suit cette imputation',
    );
  }
  if (phrases.length === 0) return null;
  return `${e.numero} · lettrage partiel ${e.groupe.code.toLowerCase()} · ${phrases.join(' ; ')}.`;
}
