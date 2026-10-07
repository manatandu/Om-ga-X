import type { Prisma } from '@prisma/client';
import { CompteDuPoste, correspond } from './etats-financiers.communs';
import { ECRITURE_D_A_NOUVEAU } from '../lettrage/paires-a-cheval';

/**
 * LE RÈGLEMENT D'UNE DETTE FOURNISSEUR PREND LA LIGNE DE LA PIÈCE QU'IL RÈGLE
 * (cas chiffrés de la clôture, constats N3 et N4, 2026-10-07).
 *
 * Au Système minimal de trésorerie, l'état des recettes et des dépenses est
 * « dressé à partir d'une comptabilité de trésorerie » (AUDCIF Titre X ch. 1
 * § 1) · « le fait générateur de l'enregistrement comptable est l'encaissement
 * (recette) ou le décaissement (dépense) » (SYCEBNL Partie 4 ch. 1 § 1.3), et
 * « Décaissements au cours de l'exercice N = Achats (N) + Dettes (N – 1) –
 * Dettes N » (même chapitre, section 4). Le règlement en 2027 d'une dette
 * d'achat de 2026 est donc une DÉPENSE SUR ACHATS de 2027 · classé par le
 * seul numéro de sa contrepartie (401), il tombait en « Autres dépenses ».
 *
 * Le 40 porte « achats de fournitures de toutes natures et de services »
 * (fiche du COMPTE 40 des deux plans) · son numéro ne dit pas la ligne. Elle
 * se lit sur la FACTURE que le règlement solde, par son LETTRAGE ; quand la
 * facture est d'un exercice précédent, le règlement est lettré avec sa ligne
 * d'à-nouveau, qui la reporte sous « RAN détail <compte> · <libellé> »
 * (`report-a-nouveau.ts`) · la facture se retrouve par compte, montants,
 * échéance et libellé, comme `paires-a-cheval.ts` les apparie.
 *
 * RIEN N'EST DEVINÉ. Un règlement non lettré, un groupe à plusieurs factures,
 * une ligne d'à-nouveau sans facture unique (report au SOLDE, deux candidates)
 * ou une facture sans charge lisible restent sur leur compte (« Autres
 * dépenses ») et sont NOMMÉS avec leur montant. Une facture qui mêle plusieurs
 * natures partage le règlement au prorata de SES propres lignes · c'est la
 * composition de la pièce, convention d'OmegaX dite (le texte ne règle pas le
 * paiement partiel d'une facture composite).
 */

/** Un règlement à rattacher · sa ligne au 40 et sa contribution à la dépense. */
export interface ReglementARattacher {
  ligneId: string;
  numero: string;
  montant: number;
}

export interface ReglementNonRattache {
  numero: string;
  montant: number;
  motif: string;
}

export interface NaturesDesReglements {
  /**
   * Par ligne de règlement, sa part par compte de résultat de la facture · la
   * somme vaut son montant, moins la part hors résultat, nommée.
   */
  parLigne: Map<string, CompteDuPoste[]>;
  nonRattaches: ReglementNonRattache[];
}

export const MOTIF_REGLEMENT_NON_LETTRE = 'Règlement non lettré avec sa facture · sa nature ne se lit pas.';
export const MOTIF_GROUPE_A_PLUSIEURS_FACTURES =
  'Règlement lettré avec plusieurs factures · aucune répartition entre elles ne se devine.';
export const MOTIF_A_NOUVEAU_SANS_FACTURE =
  "Règlement d'une ligne d'à-nouveau dont la facture d'origine ne se retrouve pas une fois et une seule.";
export const MOTIF_FACTURE_SANS_CHARGE = 'Facture réglée sans ligne de charge lisible.';
export const MOTIF_PART_HORS_RESULTAT =
  "Part du règlement d'une facture portée sur un compte qui n'entre pas au résultat (taxe, autre compte de bilan) · elle reste au 40.";

/**
 * LE RÈGLEMENT NE SE RATTACHE QU'AUX COMPTES QUE LE COMPTE DE RÉSULTAT DU SMT
 * SAIT LIRE (relecture du 2026-10-07, majeur 3, et sa suite). Les classes 6 à
 * 8 font la dépense d'exploitation ; la classe 2 fait un flux hors
 * exploitation (acquisition d'immobilisation, comme le règlement du 481), et
 * la dette du 40 qui en est née sort, par la même règle, de la variation des
 * dettes d'exploitation (`dettesFournisseursNeesDImmobilisations`) · sans
 * cette sortie, le règlement d'une dette ouverte à une clôture sortait de JF
 * alors que VC retranchait toujours la baisse du 40 (KZC surévalué), et
 * laissé au 40 il faussait l'exercice où la facture est réglée. Tout autre
 * compte (taxe, autre compte de bilan) reste au 40, nommé, et sa dette reste
 * dans VC.
 */
export function partRattachable(numero: string): boolean {
  return entreAuResultat(numero) || numero.startsWith('2');
}

export function entreAuResultat(numero: string): boolean {
  return /^[678]/.test(numero);
}

/**
 * Les dettes fournisseurs d'EXPLOITATION que le rattachement lit · le 40 sauf
 * 404 (acquisitions d'immobilisations, SYSCOHADA), 408 (factures non
 * parvenues, sans facture à lettrer) et 409 (avances versées, réglées avant
 * la facture).
 */
export const DETTES_FOURNISSEURS_RATTACHEES = { comptes: ['40'], exclusions: ['404', '408', '409'] };

export function estDetteFournisseurRattachee(numero: string): boolean {
  return correspond(numero, DETTES_FOURNISSEURS_RATTACHEES.comptes, DETTES_FOURNISSEURS_RATTACHEES.exclusions);
}

export type Lecteur = { ligneEcriture: { findMany: (args: Prisma.LigneEcritureFindManyArgs) => Promise<unknown[]> } };

const TRANCHE = 500;
const PROFONDEUR_MAX = 10;
const centimes = (x: unknown) => Math.round(Number(x ?? 0) * 100);

export interface LigneDuGroupe {
  id: string;
  lettrageId: string | null;
  compteId: string;
  debit: unknown;
  credit: unknown;
  libelle: string | null;
  dateEcheance: Date | null;
  compte: { numero: string };
  ecriture: {
    id: string;
    date: Date;
    libelle: string;
    estANouveauProvisoire: boolean;
    estGenereeParCloture: boolean;
    estSoldeDesComptesDeGestion: boolean;
  };
}

export const SELECT_LIGNE = {
  id: true,
  lettrageId: true,
  compteId: true,
  debit: true,
  credit: true,
  libelle: true,
  dateEcheance: true,
  compte: { select: { numero: true } },
  ecriture: {
    select: {
      id: true,
      date: true,
      libelle: true,
      estANouveauProvisoire: true,
      estGenereeParCloture: true,
      estSoldeDesComptesDeGestion: true,
    },
  },
} satisfies Prisma.LigneEcritureSelect;

export const estANouveau = (e: LigneDuGroupe['ecriture']) =>
  e.estANouveauProvisoire || (e.estGenereeParCloture && !e.estSoldeDesComptesDeGestion);

function tranches<T>(xs: T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += TRANCHE) r.push(xs.slice(i, i + TRANCHE));
  return r;
}

/**
 * La facture d'origine d'une ligne d'à-nouveau · même compte, mêmes
 * montants, même échéance, antérieure, et dont le libellé est celui que le
 * report recopie. Une seule, sinon `null`. Remonte les reports successifs.
 */
export async function factureDOrigine(db: Lecteur, tenantId: string, an: LigneDuGroupe): Promise<LigneDuGroupe | null> {
  let courante = an;
  for (let i = 0; i < PROFONDEUR_MAX; i++) {
    if (!estANouveau(courante.ecriture)) return courante;
    const candidates = (await db.ligneEcriture.findMany({
      where: {
        compteId: courante.compteId,
        debit: Number(courante.debit),
        credit: Number(courante.credit),
        dateEcheance: courante.dateEcheance,
        ecriture: { tenantId, date: { lt: courante.ecriture.date } },
      },
      select: SELECT_LIGNE,
      take: 50,
    })) as LigneDuGroupe[];
    const attendu = courante.libelle;
    const retenues = candidates.filter(
      (c) => `RAN détail ${c.compte.numero} · ${c.libelle ?? c.ecriture.libelle}` === attendu,
    );
    if (retenues.length !== 1) return null;
    courante = retenues[0];
  }
  return null;
}

export async function naturesDesReglementsFournisseurs(
  db: Lecteur,
  tenantId: string,
  reglements: ReglementARattacher[],
): Promise<NaturesDesReglements> {
  const resultat: NaturesDesReglements = { parLigne: new Map(), nonRattaches: [] };
  if (reglements.length === 0) return resultat;
  const nommer = (r: ReglementARattacher, motif: string) =>
    resultat.nonRattaches.push({ numero: r.numero, montant: r.montant, motif });

  // 1. Le groupe de chaque règlement.
  const groupeDe = new Map<string, string>();
  for (const t of tranches(reglements.map((r) => r.ligneId))) {
    const lues = (await db.ligneEcriture.findMany({
      where: { id: { in: t }, ecriture: { tenantId } },
      select: { id: true, lettrageId: true },
    })) as Array<{ id: string; lettrageId: string | null }>;
    for (const l of lues) if (l.lettrageId) groupeDe.set(l.id, l.lettrageId);
  }

  // 2. Les lignes de ces groupes.
  const groupes = [...new Set(groupeDe.values())];
  const lignesDuGroupe = new Map<string, LigneDuGroupe[]>();
  for (const t of tranches(groupes)) {
    const lues = (await db.ligneEcriture.findMany({
      where: { lettrageId: { in: t }, ecriture: { tenantId } },
      select: SELECT_LIGNE,
    })) as LigneDuGroupe[];
    for (const l of lues) {
      const g = lignesDuGroupe.get(l.lettrageId!) ?? [];
      g.push(l);
      lignesDuGroupe.set(l.lettrageId!, g);
    }
  }

  // 3. La facture de chaque groupe, et son origine si c'est un à-nouveau.
  const idsReglements = new Set(reglements.map((r) => r.ligneId));
  const factureDuGroupe = new Map<string, LigneDuGroupe | string>();
  for (const [groupe, lignes] of lignesDuGroupe) {
    const factures = lignes.filter((l) => !idsReglements.has(l.id) && centimes(l.credit) - centimes(l.debit) > 0);
    if (factures.length !== 1) {
      factureDuGroupe.set(groupe, factures.length === 0 ? MOTIF_A_NOUVEAU_SANS_FACTURE : MOTIF_GROUPE_A_PLUSIEURS_FACTURES);
      continue;
    }
    const origine = estANouveau(factures[0].ecriture) ? await factureDOrigine(db, tenantId, factures[0]) : factures[0];
    factureDuGroupe.set(groupe, origine ?? MOTIF_A_NOUVEAU_SANS_FACTURE);
  }

  // 4. La composition des écritures de facture · leurs lignes hors 40.
  const ecritures = [
    ...new Set([...factureDuGroupe.values()].filter((f): f is LigneDuGroupe => typeof f !== 'string').map((f) => f.ecriture.id)),
  ];
  const composition = new Map<string, CompteDuPoste[]>();
  for (const t of tranches(ecritures)) {
    const lues = (await db.ligneEcriture.findMany({
      where: { ecritureId: { in: t }, ecriture: { tenantId } },
      select: { ecritureId: true, debit: true, credit: true, compte: { select: { numero: true, intitule: true } } },
    })) as Array<{ ecritureId: string; debit: unknown; credit: unknown; compte: { numero: string; intitule: string } }>;
    for (const l of lues) {
      if (l.compte.numero.startsWith('40')) continue;
      const parts = composition.get(l.ecritureId) ?? [];
      const existant = parts.find((p) => p.numero === l.compte.numero);
      const montant = (centimes(l.debit) - centimes(l.credit)) / 100;
      if (existant) existant.montant += montant;
      else parts.push({ numero: l.compte.numero, intitule: l.compte.intitule, montant });
      composition.set(l.ecritureId, parts);
    }
  }

  // 5. La part de chaque règlement, au centime, le dernier compte prenant le reste.
  for (const r of reglements) {
    const groupe = groupeDe.get(r.ligneId);
    if (!groupe) {
      nommer(r, MOTIF_REGLEMENT_NON_LETTRE);
      continue;
    }
    const facture = factureDuGroupe.get(groupe);
    if (!facture || typeof facture === 'string') {
      nommer(r, facture ?? MOTIF_A_NOUVEAU_SANS_FACTURE);
      continue;
    }
    const parts = (composition.get(facture.ecriture.id) ?? []).filter((p) => Math.abs(p.montant) > 0.005);
    const total = parts.reduce((s, p) => s + p.montant, 0);
    // Une facture qui toucherait la trésorerie n'est pas une dette née d'une
    // charge · rien ne se lit.
    if (total <= 0.005 || parts.some((p) => p.numero.startsWith('5'))) {
      nommer(r, MOTIF_FACTURE_SANS_CHARGE);
      continue;
    }
    const enCentimes = Math.round(r.montant * 100);
    let reste = enCentimes;
    const toutes = parts.map((p, i) => {
      const c = i === parts.length - 1 ? reste : Math.round((enCentimes * p.montant) / total);
      reste -= c;
      return { numero: p.numero, intitule: p.intitule, montant: c / 100 };
    });
    const reparties = toutes.filter((p) => partRattachable(p.numero));
    const horsResultat = toutes.filter((p) => !partRattachable(p.numero)).reduce((t, p) => t + Math.round(p.montant * 100), 0);
    if (horsResultat !== 0) resultat.nonRattaches.push({ numero: r.numero, montant: horsResultat / 100, motif: MOTIF_PART_HORS_RESULTAT });
    if (reparties.length === 0) continue;
    resultat.parLigne.set(r.ligneId, reparties);
  }
  return resultat;
}

/**
 * Les contreparties des DÉPENSES, la part rattachée de chaque règlement
 * déplacée du 40 vers les comptes de sa facture · le total ne bouge pas.
 */
export function depensesRattachees(
  depenses: Map<string, CompteDuPoste>,
  reglements: ReglementARattacher[],
  natures: NaturesDesReglements,
): Map<string, CompteDuPoste> {
  const r = new Map([...depenses].map(([k, v]) => [k, { ...v }]));
  const ajouter = (numero: string, intitule: string, montant: number) => {
    const e = r.get(numero);
    if (e) e.montant = Math.round((e.montant + montant) * 100) / 100;
    else r.set(numero, { numero, intitule, montant });
  };
  for (const reglement of reglements) {
    const parts = natures.parLigne.get(reglement.ligneId);
    if (!parts) continue;
    // Seule la part rattachée quitte le 40 · une part hors résultat y reste
    // (`entreAuResultat`, majeur 3 de la relecture du 2026-10-07).
    const rattache = parts.reduce((t, p) => t + Math.round(p.montant * 100), 0) / 100;
    const quarante = r.get(reglement.numero);
    if (quarante) quarante.montant = Math.round((quarante.montant - rattache) * 100) / 100;
    for (const p of parts) ajouter(p.numero, p.intitule, p.montant);
  }
  return r;
}
