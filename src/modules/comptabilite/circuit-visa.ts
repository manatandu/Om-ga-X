import { createHash } from 'crypto';

/**
 * LE CIRCUIT DE VISA AVANT VALIDATION, ET L'AUTEUR DU DERNIER CONTENU (ligne
 * microfina-m1, idée 1 · Microfina++, « visa puis validation, objet par
 * objet », M p. 130 à 133 ; fiche « Saisie par / Approuvée par », M p. 154).
 *
 * PAR LA LOI · aucun texte n'impose un visa. L'AUDCIF art. 22, 2° impose la
 * VALIDATION (« Toute donnée entrée fait l'objet d'une validation, mise en
 * œuvre au terme de chaque période qui ne peut excéder un mois ») et ne nomme
 * personne ; l'art. 69 laisse à l'entité « les procédures nécessaires à la
 * mise en place d'une organisation comptable permettant aussi bien un
 * contrôle interne fiable que le contrôle externe » (SYSCOHADA) ; le SYCEBNL
 * demande par son art. 16, 2) « la mise en place de procédures nécessaires à
 * une organisation comptable permettant un contrôle interne fiable », l'art. 69
 * lui étant exclu par son art. 3. D'où une OPTION du dossier
 * (`Tenant.circuitVisa`), désactivée par défaut, comme le double regard
 * (CLAUDE.md § 10 ter) et le visa des RIB (`tiers/visa-rib.ts`), dont ce
 * module reprend les règles.
 *
 * CE QUI SE VISE · ce qui entre au livre-journal, l'ÉCRITURE (art. 22, 1° et
 * 2°) · la saisie, l'opération diverse, le règlement et l'écriture d'une
 * facture sont visés par leur écriture, dont la NATURE se lit ici
 * (`natureDeLaPiece`). La doctrine CPCC décrit la même division du travail
 * (organisation-comptable-cpcc, ch. 2, § 2.6.1) · « le chef comptable peut se
 * limiter à vérifier la conformité de l'imputation », sa fiche d'imputation
 * portant « paraphe, visa du chef comptable ». LA FACTURE a son propre visa,
 * avant sa comptabilisation (CPCC ch. 3, § 3.1.1 · le bureau fournisseurs
 * « suit l'approbation des factures […] et réceptionne celles approuvées »).
 * LA COMMANDE (bon de commande fournisseur) est le point d'entrée de la ligne
 * M2 · elle entrera au circuit par `ObjetDuCircuit`, avec les mêmes règles
 * d'auteur et de visa, sans rien coder ici.
 *
 * SIX RÈGLES.
 * (1) LE VISA VISE LE CONTENU, et il se dit par son EMPREINTE · date, date de
 *     valeur, journal, pièce, référence, libellé, lignes (compte, libellé,
 *     montants, devise, cours, échéance, taux de taxe, mode de règlement,
 *     ventilations analytiques). Le budget fait partie de ce que le
 *     responsable approuve d'une dépense · une ventilation changée fait tomber
 *     le visa (convention d'OmegaX). Le lettrage et le pointage ne sont pas du
 *     contenu (art. 22, 1° · origine, contenu, imputation), ni la pièce jointe.
 * (2) TOUTE SAISIE DU CONTENU FAIT TOMBER LE VISA ET NOMME SON AUTEUR
 *     (`contenuChange`) · comme le visa d'un RIB (règle 2). La validation
 *     REJOUE l'empreinte · un contenu changé par un chemin qui n'aurait pas
 *     remis le visa à nul n'entre pas au livre-journal sous un visa qui ne le
 *     couvre plus.
 * (3) CE QUI COMPTE EST L'AUTEUR DU DERNIER CONTENU, jamais le seul auteur de
 *     la saisie (`auteurDuDernierContenu`) · le double regard comparait le
 *     validateur à `createdBy`, et le comptable qui réécrivait le brouillard
 *     d'un collègue puis le validait passait sans trace (constat de l'audit de
 *     sécurité du 2026-10-25).
 * (4) L'AUTEUR NE VISE PAS SON PROPRE CONTENU · le logiciel contrôle
 *     l'IDENTITÉ, jamais l'indépendance (même limite que le double regard).
 *     Un contenu dont l'auteur est INCONNU (réécrit par un chemin qui ne l'a
 *     pas nommé) se vise, et la réponse le DIT (règle 3 du visa d'un RIB) ;
 *     sous le double regard, il ne se valide pas sans la dérogation
 *     nominative, seul second regard qui se constate alors (lecture la plus
 *     protectrice, dite).
 * (5) LE VISA VISE CE QUI A ÉTÉ LU · l'écran renvoie l'empreinte qu'il a
 *     montrée, et le serveur refuse un contenu changé depuis.
 * (6) LES ÉCRITURES DE CLÔTURE N'ENTRENT PAS AU CIRCUIT · personne ne
 *     « saisit » un report à nouveau calculé sur des soldes déjà validés
 *     (même exclusion, même raison que le double regard) ; le report
 *     PROVISOIRE ne se valide jamais, la pièce de situation non plus.
 */

/** Ce qui entre au circuit. `COMMANDE` · point d'entrée de la ligne M2, non servi ici. */
export type ObjetDuCircuit = 'ECRITURE' | 'FACTURE' | 'COMMANDE';

/** La nature d'une écriture du brouillard, telle que l'écran du visa la filtre (« objet par objet »). */
export type NatureDeLaPiece = 'SAISIE' | 'OD' | 'FACTURE' | 'REGLEMENT';

export const LIBELLES_NATURE: Record<NatureDeLaPiece, string> = {
  SAISIE: 'Saisie',
  OD: 'Opération diverse',
  FACTURE: 'Facture',
  REGLEMENT: 'Règlement',
};

/**
 * La nature d'une écriture · la facture par sa LIAISON (`Facture.ecritureId`),
 * jamais par son libellé ; l'opération diverse par son journal (type
 * GÉNÉRAL) ; le règlement par un journal de trésorerie dont une ligne touche
 * un tiers (40 ou 41 · fiches des comptes 40 et 41 des deux plans, le compte
 * débité ou crédité du règlement) ; le reste est une saisie.
 */
export function natureDeLaPiece(e: { journalType: string; aUneFacture: boolean; numerosComptes: readonly string[] }): NatureDeLaPiece {
  if (e.aUneFacture) return 'FACTURE';
  if (e.journalType === 'GENERAL') return 'OD';
  if (e.journalType === 'TRESORERIE' && e.numerosComptes.some((n) => n.startsWith('40') || n.startsWith('41'))) return 'REGLEMENT';
  return 'SAISIE';
}

// ---------------------------------------------------------------------------
// L'empreinte du contenu
// ---------------------------------------------------------------------------

type Montant = { toString(): string } | number | string;

export interface VentilationDuContenu {
  sectionId: string;
  planId: string | null;
  debit: Montant;
  credit: Montant;
}

export interface LigneDuContenu {
  compteId: string;
  libelle: string | null;
  debit: Montant;
  credit: Montant;
  deviseId: string | null;
  montantDevise: Montant | null;
  coursApplique: Montant | null;
  dateEcheance: Date | null;
  tauxTvaId: string | null;
  modeReglementId: string | null;
  ventilations: readonly VentilationDuContenu[];
}

export interface ContenuDeLEcriture {
  date: Date;
  dateValeur: Date | null;
  journalId: string;
  numeroPiece: number | null;
  reference: string | null;
  libelle: string;
  lignes: readonly LigneDuContenu[];
}

/**
 * Un montant sous une forme canonique · un `Decimal` relu (« 100 ») et le
 * même montant écrit (« 100.00 », 100) donnent le même texte. Jamais un
 * flottant formaté · 0.1 + 0.2 ne doit pas faire tomber un visa.
 */
function canon(v: Montant | null): string | null {
  if (v === null) return null;
  const texte = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(texte)) return texte;
  const negatif = texte.startsWith('-');
  const [ent, dec = ''] = (negatif ? texte.slice(1) : texte).split('.');
  const entier = ent.replace(/^0+(?=\d)/, '');
  const decimales = dec.replace(/0+$/, '');
  const nul = /^0*$/.test(entier) && decimales === '';
  return `${negatif && !nul ? '-' : ''}${entier}${decimales ? `.${decimales}` : ''}`;
}

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Un ordre TOTAL par le texte · jamais `localeCompare`, qui suit la version d'ICU du serveur. */
function trier<T>(elements: readonly T[], cle: (e: T) => string): T[] {
  return [...elements].map((e) => ({ e, k: cle(e) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((x) => x.e);
}

/**
 * L'EMPREINTE DU CONTENU (règle 1) · les lignes et leurs ventilations dans un
 * ordre canonique, si bien qu'une pièce réenregistrée à l'identique (lignes
 * recréées sous d'autres identifiants, rendues dans un autre ordre) garde son
 * empreinte et son visa.
 */
export function empreinteDuContenu(c: ContenuDeLEcriture): string {
  const lignes = trier(
    c.lignes.map((l) =>
      JSON.stringify([
        l.compteId,
        l.libelle ?? null,
        canon(l.debit),
        canon(l.credit),
        l.deviseId ?? null,
        canon(l.montantDevise ?? null),
        canon(l.coursApplique ?? null),
        jour(l.dateEcheance ?? null),
        l.tauxTvaId ?? null,
        l.modeReglementId ?? null,
        trier(
          l.ventilations.map((v) => JSON.stringify([v.sectionId, v.planId ?? null, canon(v.debit), canon(v.credit)])),
          (x) => x,
        ),
      ]),
    ),
    (x) => x,
  );
  const contenu = {
    date: jour(c.date),
    dateValeur: jour(c.dateValeur),
    journalId: c.journalId,
    numeroPiece: c.numeroPiece,
    reference: c.reference ?? null,
    libelle: c.libelle,
    lignes,
  };
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex');
}

// ---------------------------------------------------------------------------
// L'auteur du dernier contenu
// ---------------------------------------------------------------------------

export interface TracesDuContenu {
  createdBy: string;
  contenuPar: string | null;
  contenuLe: Date | null;
}

export type AuteurDuContenu = { connu: true; id: string } | { connu: false };

/**
 * L'auteur du dernier contenu (règle 3) · la création, tant que rien n'a
 * changé le contenu depuis ; l'auteur du dernier changement ensuite ; INCONNU
 * quand un chemin a changé le contenu sans nommer son auteur.
 */
export function auteurDuDernierContenu(t: TracesDuContenu): AuteurDuContenu {
  // Une trace ABSENTE (sélection trop étroite) n'est pas « jamais réécrite » ·
  // la lire comme le contenu de la création rouvrirait la faille en silence.
  if (t.contenuLe === undefined || t.contenuPar === undefined) {
    throw new Error('auteurDuDernierContenu · l’écriture est lue sans les traces de son dernier contenu');
  }
  if (t.contenuLe === null) return { connu: true, id: t.createdBy };
  if (t.contenuPar !== null && t.contenuPar !== '') return { connu: true, id: t.contenuPar };
  return { connu: false };
}

/**
 * Ce qu'un changement du contenu écrit sur la tête de l'écriture (règle 2) ·
 * son auteur, ou `null` quand le chemin ne le connaît pas, et le visa remis
 * à nul.
 */
export function contenuChange(auteur: string | null, maintenant: Date) {
  return {
    contenuPar: auteur,
    contenuLe: maintenant,
    viseePar: null,
    viseeLe: null,
    viseeEmpreinte: null,
  };
}

// ---------------------------------------------------------------------------
// Le visa d'une écriture
// ---------------------------------------------------------------------------

export interface VisaDeLEcriture {
  viseePar: string | null;
  viseeLe: Date | null;
  viseeEmpreinte: string | null;
}

export type EtatDuVisa = 'A_VISER' | 'VISEE' | 'VISA_TOMBE';

/** Visée · posé ET sur le contenu présent. Une empreinte absente n'est jamais un visa. */
export function etatDuVisa(v: VisaDeLEcriture, empreinteActuelle: string): EtatDuVisa {
  if (typeof v.viseePar !== 'string' || v.viseePar === '' || !(v.viseeLe instanceof Date)) return 'A_VISER';
  if (v.viseeEmpreinte !== empreinteActuelle) return 'VISA_TOMBE';
  return 'VISEE';
}

export const MOTIF_VISA_PAR_SON_AUTEUR =
  'Vous êtes l’auteur du dernier contenu de cette pièce · un autre administrateur ou comptable du dossier la vise. C’est le second regard que le circuit de visa demande avant la validation.';

export const MOTIF_CONTENU_CHANGE_DEPUIS_LA_LECTURE =
  'Cette pièce a changé depuis que vous l’avez affichée · relisez-la avant de la viser.';

export const MOTIF_DEJA_VISEE = 'Cette pièce est déjà visée sur son contenu présent.';

export const AVERTISSEMENT_AUTEUR_INCONNU =
  'Le dernier contenu de cette pièce a été écrit par un chemin qui n’a pas nommé son auteur · OmegaX n’a donc pas pu vérifier que vous n’en êtes pas l’auteur.';

export interface EcritureAViser extends TracesDuContenu, VisaDeLEcriture {
  statut: string;
  estGenereeParCloture: boolean;
  estANouveauProvisoire: boolean;
  journalDeSituation: boolean;
}

/** Le refus de viser une écriture, ou `null`, et l'avertissement qui accompagne un visa admis. */
export function motifRefusVisaEcriture(
  e: EcritureAViser,
  utilisateurId: string,
  empreinteLue: string,
  empreinteActuelle: string,
): { motif: string | null; avertissement: string | null } {
  const refus = (motif: string) => ({ motif, avertissement: null });
  if (e.statut !== 'BROUILLARD') return refus('Cette pièce n’est plus au brouillard · seul le brouillard se vise.');
  if (e.estANouveauProvisoire) return refus('Le report à-nouveau provisoire ne se vise pas · il ne se valide jamais.');
  if (e.journalDeSituation) return refus('Une pièce restée dans un journal de situation ne se vise pas · transférez-la d’abord dans un journal ordinaire.');
  if (e.estGenereeParCloture) return refus('Une écriture de clôture n’entre pas au circuit de visa · elle reprend des soldes déjà validés.');
  if (empreinteLue !== empreinteActuelle) return refus(MOTIF_CONTENU_CHANGE_DEPUIS_LA_LECTURE);
  if (etatDuVisa(e, empreinteActuelle) === 'VISEE') return refus(MOTIF_DEJA_VISEE);
  const auteur = auteurDuDernierContenu(e);
  if (auteur.connu && auteur.id === utilisateurId) return refus(MOTIF_VISA_PAR_SON_AUTEUR);
  return { motif: null, avertissement: auteur.connu ? null : AVERTISSEMENT_AUTEUR_INCONNU };
}

/** Ce qu'un visa écrit sur la tête de l'écriture. */
export function visaPose(utilisateurId: string, maintenant: Date, empreinte: string) {
  return { viseePar: utilisateurId, viseeLe: maintenant, viseeEmpreinte: empreinte };
}

/** Le retrait d'un visa · par son auteur, ou par l'administrateur du dossier. */
export function motifRefusRetraitVisa(e: VisaDeLEcriture & { statut: string }, utilisateurId: string, estAdministrateur: boolean): string | null {
  if (e.statut !== 'BROUILLARD') return 'Cette pièce n’est plus au brouillard · son visa ne se retire plus.';
  if (typeof e.viseePar !== 'string' || e.viseePar === '') return 'Cette pièce n’est pas visée.';
  if (e.viseePar !== utilisateurId && !estAdministrateur) {
    return 'Seul l’auteur du visa, ou l’administrateur du dossier, retire un visa.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// La validation
// ---------------------------------------------------------------------------

export interface EcritureAValider extends TracesDuContenu, VisaDeLEcriture {
  id: string;
  estGenereeParCloture: boolean;
  /** L'empreinte du contenu présent · exigée seulement sous le circuit de visa. */
  empreinte: string | null;
}

export interface PartitionValidation {
  validables: string[];
  /** Sous le circuit, sans visa. */
  nonVisees: string[];
  /** Sous le circuit, visée sur un contenu qui n'est plus le sien. */
  visaTombe: string[];
  /** Sous le double regard, le validateur est l'auteur du dernier contenu. */
  refuseesSecondRegard: string[];
  /** Sous le double regard, l'auteur du dernier contenu n'est pas connu. */
  refuseesAuteurInconnu: string[];
}

/**
 * LA PARTITION DE LA VALIDATION · le refus ÉCARTE, il ne jette pas (AUDCIF
 * art. 22, 2° · « au terme de chaque période qui ne peut excéder un mois »,
 * donc par lots ; une seule pièce écartée n'arrête pas la période). Chaque
 * écriture tombe dans UN compteur · le visa d'abord (sans lui, la question du
 * validateur ne se pose pas encore), le double regard ensuite. Les écritures
 * de clôture passent (règle 6).
 */
export function partitionnerLaValidation(
  ecritures: readonly EcritureAValider[],
  validateur: string,
  exigences: { doubleRegard: boolean; visa: boolean },
): PartitionValidation {
  const p: PartitionValidation = { validables: [], nonVisees: [], visaTombe: [], refuseesSecondRegard: [], refuseesAuteurInconnu: [] };
  for (const e of ecritures) {
    if (e.estGenereeParCloture) {
      p.validables.push(e.id);
      continue;
    }
    if (exigences.visa) {
      if (e.empreinte === null) throw new Error('partitionnerLaValidation · le circuit de visa exige l’empreinte du contenu présent');
      const etat = etatDuVisa(e, e.empreinte);
      if (etat === 'A_VISER') {
        p.nonVisees.push(e.id);
        continue;
      }
      if (etat === 'VISA_TOMBE') {
        p.visaTombe.push(e.id);
        continue;
      }
    }
    if (exigences.doubleRegard) {
      const auteur = auteurDuDernierContenu(e);
      if (!auteur.connu) {
        p.refuseesAuteurInconnu.push(e.id);
        continue;
      }
      if (auteur.id === validateur) {
        p.refuseesSecondRegard.push(e.id);
        continue;
      }
    }
    p.validables.push(e.id);
  }
  return p;
}

export function motifNonVisees(nonVisees: number, visaTombe: number): string | null {
  if (nonVisees === 0 && visaTombe === 0) return null;
  const parts = [
    nonVisees > 0 ? `${nonVisees} pièce(s) non visée(s)` : null,
    visaTombe > 0 ? `${visaTombe} pièce(s) dont le contenu a changé depuis le visa` : null,
  ].filter(Boolean);
  return (
    `${parts.join(' et ')} · ce dossier exige le visa d’un second utilisateur avant la validation (Paramètres du ` +
    'dossier, circuit de visa). Faites-les viser au brouillard, puis validez.'
  );
}

export const MOTIF_AUTEUR_INCONNU_DOUBLE_REGARD =
  'Le dernier contenu de ces pièces a été écrit par un chemin qui n’a pas nommé son auteur · OmegaX ne peut pas constater qu’un autre que vous les a écrites, et le double regard ne se présume pas. Validez-les avec le nom et le motif du second regard porté hors du logiciel, ou faites-les valider par un autre utilisateur après leur avoir fait réenregistrer le contenu.';

// ---------------------------------------------------------------------------
// Le visa d'une facture
// ---------------------------------------------------------------------------

export interface FactureAViser {
  saisiePar: string | null;
  viseePar: string | null;
  viseeLe: Date | null;
  ecritureId: string | null;
  /**
   * Émise par le logiciel lui-même (facture d'abonnement de la console, liée
   * à son `FactureAbonnement`) · personne ne l'a saisie, et ce n'est pas une
   * pièce d'avant le circuit (relecture du circuit, mineur).
   */
  emiseParLeLogiciel: boolean;
}

export function estFactureVisee(f: Pick<FactureAViser, 'viseePar' | 'viseeLe'>): boolean {
  return typeof f.viseePar === 'string' && f.viseePar !== '' && f.viseeLe instanceof Date;
}

export const MOTIF_FACTURE_PAR_SON_AUTEUR =
  'Vous avez enregistré cette facture · un autre administrateur ou comptable du dossier la vise avant sa comptabilisation.';

export const AVERTISSEMENT_FACTURE_AUTEUR_INCONNU =
  'Cette facture a été enregistrée avant le circuit de visa · son auteur n’est pas connu d’OmegaX, qui n’a donc pas pu vérifier que vous n’en êtes pas l’auteur.';

export const AVERTISSEMENT_FACTURE_EMISE_PAR_LE_LOGICIEL =
  'Cette facture a été émise par OmegaX (facture d’abonnement de la console) · aucun utilisateur ne l’a saisie, votre visa est celui d’un second regard sur une pièce du logiciel.';

export function motifRefusVisaFacture(f: FactureAViser, utilisateurId: string): { motif: string | null; avertissement: string | null } {
  if (estFactureVisee(f)) return { motif: 'Cette facture est déjà visée.', avertissement: null };
  if (f.ecritureId !== null) {
    return { motif: 'Cette facture est déjà comptabilisée · son écriture se vise au brouillard.', avertissement: null };
  }
  if (f.saisiePar !== null && f.saisiePar === utilisateurId) return { motif: MOTIF_FACTURE_PAR_SON_AUTEUR, avertissement: null };
  if (f.saisiePar === null && f.emiseParLeLogiciel) return { motif: null, avertissement: AVERTISSEMENT_FACTURE_EMISE_PAR_LE_LOGICIEL };
  return { motif: null, avertissement: f.saisiePar === null ? AVERTISSEMENT_FACTURE_AUTEUR_INCONNU : null };
}

/** Le refus de comptabiliser une facture non visée, sous le circuit. */
export function motifComptabilisationSansVisa(f: Pick<FactureAViser, 'viseePar' | 'viseeLe'>, circuitVisa: boolean): string | null {
  if (!circuitVisa || estFactureVisee(f)) return null;
  return (
    'Cette facture n’est pas visée · ce dossier exige le visa d’un second utilisateur avant sa comptabilisation ' +
    '(Paramètres du dossier, circuit de visa). Faites-la viser dans la fenêtre Facturation, puis comptabilisez-la.'
  );
}

/** La façon dont l'écran nomme un auteur · un utilisateur retiré du dossier n'est jamais une case vide. */
export function nommerAuteur(id: string | null | undefined, courriels: ReadonlyMap<string, string>): string | null {
  if (id == null || id === '') return null;
  return courriels.get(id) ?? 'utilisateur retiré du dossier';
}
