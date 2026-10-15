import type { Referentiel } from './ecart-change-realise';

/**
 * ESCOMPTE DE RÈGLEMENT ET ÉCART DE RÈGLEMENT · règles pures (ligne sage-l2,
 * fonction 36 · Sage, « écart de règlement passé en charge ou en produit sous
 * un seuil », « escomptes financiers accordés et obtenus »).
 *
 * L'ESCOMPTE DE RÈGLEMENT est la réduction consentie pour un paiement AVANT
 * le terme normal d'exigibilité (AUDCIF, Titre VII, compte 67 · « 673 :
 * montant des réductions que l'entité consent sous forme d'escompte de
 * règlement aux clients qui s'acquittent de leurs factures ou règlent leurs
 * dettes avant le terme normal d'exigibilité »). Deux plans, mêmes comptes ·
 * fiche du compte 40 (SYSCOHADA, « Débité des escomptes de règlement obtenus
 * des fournisseurs, par le crédit du compte 773 » ; SYCEBNL, « est débité le
 * compte 40 [...] des escomptes de règlement obtenus des fournisseurs ; par le
 * crédit : du compte 773 »), fiche du compte 41 (SYSCOHADA, « Crédité des
 * escomptes de règlement accordés aux clients, par le débit du compte 673 » ;
 * SYCEBNL, « est crédité le compte 412 · CLIENTS-USAGERS [...] des escomptes
 * de règlement accordés aux clients ; par le débit : du compte 673 »). Au
 * SYCEBNL l'escompte accordé ne vise que le CLIENT-USAGER (412) · une
 * cotisation d'adhérent (411) n'en reçoit pas.
 *
 * L'ÉCART DE RÈGLEMENT se TRANCHE PAR LE CODE CIVIL (Livre III), parce que
 * passer une différence en résultat éteint ou garde une obligation ·
 * - « Les obligations s'éteignent : par le payement, [...] par la remise
 *   volontaire » (art. 132) · le CRÉANCIER peut remettre le reste. Le dossier
 *   qui ENCAISSE moins que le dû de son client peut donc l'abandonner · une
 *   CHARGE ;
 * - « ce qui a été payé sans être dû est sujet à répétition » (art. 133) · le
 *   dossier qui a PAYÉ plus que le dû à son fournisseur peut y renoncer ·
 *   une CHARGE ;
 * - « Celui qui reçoit par erreur ou sciemment ce qui ne lui est pas dû,
 *   s'oblige à le restituer » (art. 252) · le trop-perçu d'un client n'est
 *   pas un produit · REFUSÉ, il s'enregistre à part (avance, 419) ;
 * - « Le débiteur ne peut point forcer le créancier à recevoir en partie le
 *   payement d'une dette » (art. 142) · le dossier qui paie MOINS que le dû
 *   à son fournisseur ne s'en libère pas seul · REFUSÉ, le règlement reste
 *   partiel jusqu'à la remise du fournisseur.
 * Sage passe aussi l'écart « en produit » · OmegaX ne le fait pas, et c'est
 * l'écart de parité écrit (parity.md). Le SEUIL est un paramètre du dossier
 * SANS VALEUR PAR DÉFAUT (aucun texte n'en fixe) · sans lui, aucun écart ne
 * se passe.
 *
 * LE COMPTE DE L'ÉCART · AUDCIF, Titre VII, compte 65 · « 658 Charges
 * diverses (... 6588 autres charges diverses) », au SYSCOHADA le 6588 ; au
 * SYCEBNL, dont le 658 n'est pas subdivisé, le 658 (même lecture que D2 de la
 * ligne A6, le résidu des fiches 65). Ni le 651 (créances IRRÉCOUVRABLES,
 * « Les créances clients et autres débiteurs irrécouvrables sont enregistrées
 * au débit du compte 651 ») · un écart abandonné n'est pas une créance
 * irrécouvrable ; ni le 673 · il n'y a pas d'avance sur le terme.
 *
 * LA TVA N'EST PAS RÉGULARISÉE · l'escompte ne sort de la base « qu'[à
 * condition] qu'il[s] figurent sur une facture initiale ou rectificative »
 * (O.-L. n° 10/001, art. 29, 1° ; décret n° 011/42, art. 79). La pièce du
 * règlement ne porte aucune ligne de taxe · la facture rectificative se passe
 * à part, et l'avertissement le dit.
 */

export type RoleEcartEscompte = 'ESCOMPTE_OBTENU' | 'ESCOMPTE_ACCORDE' | 'ECART_REGLEMENT';
export type SensReglement = 'FOURNISSEUR' | 'CLIENT';

/** Les racines lues dans les fiches des deux plans (voir l'en-tête), et dans les deux semis. */
export const RACINES_ECART_ESCOMPTE: Readonly<Record<Referentiel, Readonly<Record<RoleEcartEscompte, string>>>> = {
  SYSCOHADA: { ESCOMPTE_OBTENU: '773', ESCOMPTE_ACCORDE: '673', ECART_REGLEMENT: '6588' },
  SYCEBNL: { ESCOMPTE_OBTENU: '773', ESCOMPTE_ACCORDE: '673', ECART_REGLEMENT: '658' },
};

export function roleEscompte(sens: SensReglement): RoleEcartEscompte {
  return sens === 'FOURNISSEUR' ? 'ESCOMPTE_OBTENU' : 'ESCOMPTE_ACCORDE';
}

export interface CompteCandidat {
  id: string;
  numero: string;
  intitule: string;
}

/**
 * LE COMPTE DU RÔLE parmi les comptes de détail actifs sous sa racine · celui
 * qu'a choisi le cabinet s'il en est, sinon l'unique candidat. Le compte du
 * plan SUBDIVISÉ (un sous-compte ouvert sous lui) s'efface devant ses
 * sous-comptes, comme à la saisie. Plusieurs candidats sans choix · refus
 * nommé, jamais deviné.
 */
export function comptesOfferts(referentiel: Referentiel, role: RoleEcartEscompte, candidats: readonly CompteCandidat[]): CompteCandidat[] {
  const racine = RACINES_ECART_ESCOMPTE[referentiel][role];
  const sous = candidats.filter((c) => c.numero.startsWith(racine));
  const seme = racine.padEnd(8, '0');
  const subdivise = sous.some((c) => c.numero !== seme);
  return subdivise ? sous.filter((c) => c.numero !== seme) : sous;
}

export function compteDuRole(
  referentiel: Referentiel,
  role: RoleEcartEscompte,
  candidats: readonly CompteCandidat[],
  choisiId: string | undefined,
): { compte: CompteCandidat } | { motif: string } {
  const racine = RACINES_ECART_ESCOMPTE[referentiel][role];
  const nom = role === 'ECART_REGLEMENT' ? "l'écart de règlement" : role === 'ESCOMPTE_OBTENU' ? "l'escompte obtenu" : "l'escompte accordé";
  const offerts = comptesOfferts(referentiel, role, candidats);
  if (choisiId !== undefined) {
    const c = offerts.find((x) => x.id === choisiId);
    return c
      ? { compte: c }
      : { motif: `Le compte choisi pour ${nom} n'est pas un compte de détail actif sous le ${racine}, ou il est subdivisé (choisissez un de ses sous-comptes).` };
  }
  if (offerts.length === 1) return { compte: offerts[0] };
  if (offerts.length === 0) {
    return { motif: `Aucun compte de détail actif sous le ${racine} pour ${nom} · ouvrez-le ou réactivez-le dans le Plan comptable.` };
  }
  return { motif: `Plusieurs comptes sous le ${racine} pour ${nom} (${offerts.map((c) => c.numero).join(', ')}) · choisissez-en un.` };
}

export interface PlanDuReglement {
  /** Ce que la pièce porte au compte du tiers · le payé, l'escompte et l'écart abandonné. */
  tiers: number;
  /** L'écart passé en charge (zéro sans écart). */
  ecart: number;
  partiel: boolean;
}

const c = (x: number) => Math.round(x * 100);
const f = (x: number) => (x / 100).toFixed(2);

/**
 * LE RÈGLEMENT D'UN TIERS AVEC SON ESCOMPTE ET SON ÉCART · ce qu'il éteint au
 * compte du tiers, et l'écart en charge, au centime ; ou le motif du refus.
 */
export function planDuReglement(p: {
  sens: SensReglement;
  referentiel: Referentiel;
  numeroTiers: string;
  du: number;
  /** Le payé ou l'encaissé, en trésorerie. */
  montant: number;
  escompte: number;
  solderEcart: boolean;
  seuil: number | null;
}): PlanDuReglement | { motif: string } {
  const du = c(p.du);
  const paye = c(p.montant);
  const escompte = c(p.escompte);
  if (escompte < 0) return { motif: "L'escompte ne peut pas être négatif." };
  if (escompte > 0 && escompte >= du) {
    return { motif: `L'escompte (${f(escompte)}) atteint le dû des factures choisies (${f(du)}) · il réduit un paiement, il ne le remplace pas.` };
  }
  if (paye <= 0) return { motif: 'Le montant réglé doit être positif.' };
  if (escompte > 0 && p.sens === 'CLIENT' && p.referentiel === 'SYCEBNL' && !p.numeroTiers.startsWith('412')) {
    return {
      motif:
        "au SYCEBNL, l'escompte de règlement ne s'accorde qu'au client-usager · la fiche du compte 41 crédite « le compte 412 · " +
        'CLIENTS-USAGERS » des escomptes accordés, par le débit du 673. Une cotisation d’adhérent n’en reçoit pas.',
    };
  }
  const seuilC = p.seuil === null ? null : c(p.seuil);
  const refusSeuil = (ecart: number) =>
    seuilC === null
      ? "Aucun seuil d'écart de règlement n'est fixé pour ce dossier · fixez-le dans Paramètres du dossier, ou réglez sans solder l'écart."
      : ecart > seuilC
        ? `L'écart de ${f(ecart)} dépasse le seuil du dossier (${f(seuilC)}) · réglez sans solder l'écart, ou relevez le seuil dans Paramètres du dossier.`
        : null;
  if (p.sens === 'FOURNISSEUR') {
    if (p.solderEcart) {
      if (escompte > 0) return { motif: "Un escompte obtenu et un trop-payé ne se passent pas dans le même règlement · réglez l'un, puis l'autre." };
      if (paye < du) {
        return {
          motif:
            `Payé ${f(paye)} pour un dû de ${f(du)} · la dette du reste demeure, le fournisseur seul peut la remettre (Code civil, Livre III, ` +
            'art. 132 et 142) · le règlement reste partiel, sans écart.',
        };
      }
      if (paye === du) return { motif: "Le payé égale le dû · il n'y a pas d'écart à solder." };
      const motif = refusSeuil(paye - du);
      if (motif) return { motif };
      return { tiers: du / 100, ecart: (paye - du) / 100, partiel: false };
    }
    const tiers = paye + escompte;
    if (tiers > du) {
      return {
        motif:
          `Le payé (${f(paye)})${escompte > 0 ? ` et l'escompte (${f(escompte)})` : ''} dépassent le dû des factures choisies (${f(du)}) · ` +
          "l'excédent est une avance, à comptabiliser à part, ou, s'il est sous le seuil du dossier, un écart à solder.",
      };
    }
    return { tiers: tiers / 100, ecart: 0, partiel: tiers < du };
  }
  const recu = paye + escompte;
  if (recu > du) {
    return {
      motif:
        `L'encaissé (${f(paye)})${escompte > 0 ? ` et l'escompte (${f(escompte)})` : ''} dépassent le dû des factures choisies (${f(du)}) · ` +
        'le trop-perçu se restitue au client (Code civil, Livre III, art. 252) · il s’enregistre à part, en avance reçue, jamais en produit.',
    };
  }
  if (p.solderEcart) {
    if (recu === du) return { motif: "L'encaissé égale le dû · il n'y a pas d'écart à solder." };
    const motif = refusSeuil(du - recu);
    if (motif) return { motif };
    return { tiers: du / 100, ecart: (du - recu) / 100, partiel: false };
  }
  return { tiers: recu / 100, ecart: 0, partiel: recu < du };
}

export interface LigneDuReglement {
  compteId: string;
  debit?: number;
  credit?: number;
  libelle: string;
}

/** La pièce · le tiers, la trésorerie, l'escompte et l'écart, chacun sur sa ligne, équilibrée au centime. */
export function lignesAvecEscompteEtEcart(p: {
  sens: SensReglement;
  compteTiersId: string;
  compteTresorerieId: string;
  montant: number;
  plan: PlanDuReglement;
  escompte: number;
  compteEscompteId: string | null;
  compteEcartId: string | null;
  libelle: string;
}): LigneDuReglement[] {
  const { libelle } = p;
  const lignes: LigneDuReglement[] = [];
  if (p.sens === 'FOURNISSEUR') {
    lignes.push({ compteId: p.compteTiersId, debit: p.plan.tiers, libelle });
    if (p.plan.ecart > 0) lignes.push({ compteId: p.compteEcartId!, debit: p.plan.ecart, libelle: `Écart de règlement · ${libelle}`.slice(0, 190) });
    lignes.push({ compteId: p.compteTresorerieId, credit: p.montant, libelle });
    if (p.escompte > 0) lignes.push({ compteId: p.compteEscompteId!, credit: p.escompte, libelle: `Escompte obtenu · ${libelle}`.slice(0, 190) });
    return lignes;
  }
  lignes.push({ compteId: p.compteTresorerieId, debit: p.montant, libelle });
  if (p.escompte > 0) lignes.push({ compteId: p.compteEscompteId!, debit: p.escompte, libelle: `Escompte accordé · ${libelle}`.slice(0, 190) });
  if (p.plan.ecart > 0) lignes.push({ compteId: p.compteEcartId!, debit: p.plan.ecart, libelle: `Écart de règlement · ${libelle}`.slice(0, 190) });
  lignes.push({ compteId: p.compteTiersId, credit: p.plan.tiers, libelle });
  return lignes;
}

/**
 * L'ESCOMPTE QUI NE SE CONSENT QU'AVANT LE TERME (fiche du compte 673) · une
 * facture déjà échue à la date du règlement le fait dire, sans refus · le
 * cabinet sait si l'escompte a été convenu.
 */
export function avertissementEscompteApresEcheance(numero: string, dateReglement: Date, echeances: ReadonlyArray<{ reference: string; echeance: Date }>): string | null {
  const echues = echeances.filter((e) => e.echeance.getTime() < Date.UTC(dateReglement.getUTCFullYear(), dateReglement.getUTCMonth(), dateReglement.getUTCDate()));
  if (echues.length === 0) return null;
  return (
    `${numero} · ${echues.map((e) => `${e.reference} (échue le ${e.echeance.toISOString().slice(0, 10)})`).join(', ')} · l'escompte de ` +
    'règlement se consent pour un paiement AVANT le terme normal d’exigibilité (fiche du compte 673) · vérifiez qu’il a bien été convenu.'
  );
}

/** La TVA de l'escompte · dite, jamais régularisée par la pièce (voir l'en-tête). */
export function avertissementTvaEscompte(numero: string, escompte: number): string {
  return (
    `${numero} · l'escompte de ${escompte.toFixed(2)} ne sort de la base de la TVA que s'il figure sur une facture initiale ou ` +
    'rectificative (O.-L. n° 10/001, art. 29, 1° ; décret n° 011/42, art. 79) · la pièce du règlement ne régularise pas la taxe, ' +
    'passez la facture rectificative à part.'
  );
}

/**
 * LA TVA DE L'ÉCART ABANDONNÉ AU CLIENT · une remise ne sort de la base que
 * si elle figure sur une facture initiale ou rectificative (O.-L. n° 10/001,
 * art. 29, point 1 ; décret n° 011/42, art. 79). Dite, jamais régularisée ;
 * le trop-payé abandonné à un fournisseur n'est pas dans sa facture et ne
 * touche pas la taxe.
 */
export function avertissementTvaEcart(numero: string, ecart: number): string {
  return (
    `${numero} · l'écart de ${ecart.toFixed(2)} abandonné au client ne réduit pas la TVA facturée · une remise ne sort de la base ` +
    "que si elle figure sur une facture initiale ou rectificative (O.-L. n° 10/001, art. 29, point 1 ; décret n° 011/42, art. 79)."
  );
}
