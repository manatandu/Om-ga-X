import { Injectable } from '@nestjs/common';
import { ClasseCompte } from '@prisma/client';
import { EcritureService } from '../comptabilite/ecriture.service';
import { AUCUN_VIREMENT, VirementsParCompte } from '../immobilisations/virements-mise-en-service';
import { ExerciceService } from '../exercice/exercice.service';
import {
  CompteDuPoste,
  LigneBalancePourEtat,
  MOTIF_RESULTAT_N1_NON_TENU,
  brouillardDuPrecedentNonTenu,
  EtatDuPrecedentNonTenu,
  etatDuPrecedentNonTenu,
  PosteDeFluxVide,
  chargerLignes,
  chargerOuverture,
  comparatifDuBilan,
  controleDuTableauDesFlux,
  correspond,
  exerciceCloture,
  exercicePrecedentCloture,
  exercicePrecedentTenu,
  lireOuverturePasseeEnOd,
  lireNegatifsTardifsDeLOuverture,
  avecNegatifsTardifs,
  mentionComparatifSurOuverture,
  mentionExercicePrecedentVide,
  mentionOuverturePresumeeNulle,
  motifColonneN1NonTenue,
  motifOuverturePasseeEnOd,
  ouvertureTenue,
  precedentNonTenuCloture,
  trouverExerciceN1,
} from './etats-financiers.communs';
import {
  estCompteDuResultatDeLExercice,
  partsDuResultatAuBilan,
  resultatAnterieurNonVire,
  resultatAnterieurNonVireDuComparatif,
  resultatAuBilan,
  type PartsDuResultatAuBilan,
} from './resultat-de-l-exercice';
import {
  POSTES_CHARGES,
  POSTES_HAO,
  POSTES_PRODUITS,
  PosteCompteResultat,
  posteDuCompte,
} from './correspondance-compte-resultat';
import {
  COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR,
  ORDRE_AFFICHAGE_ACTIF,
  ORDRE_AFFICHAGE_PASSIF,
  POSTES_ACTIF,
  POSTES_PASSIF,
  PosteBilanDeBase,
  TOTAUX_ACTIF,
  TOTAUX_PASSIF,
} from './correspondance-bilan';
import {
  COMPTES_SANS_TRESORERIE,
  COMPTES_A_CONTREPARTIE_INTERNE,
  ORDRE_AFFICHAGE_FLUX,
  PosteFluxTresorerie,
  TOTAUX_FLUX,
  TOUS_LES_POSTES_FLUX,
} from './correspondance-tft';

/**
 * Un poste du compte de résultat OU du bilan, calculé.
 *
 * `brut`/`amortissement` : BILAN ACTIF seulement · le texte officiel exige
 * trois colonnes côté actif (Brut, Amortissements et dépréciations, Net),
 * pas un seul montant net. `amortissement` est une magnitude POSITIVE (le
 * montant accumulé), `montant` (net) = `brut` − `amortissement`. Absents
 * (undefined) pour un poste de passif ou du compte de résultat, qui n'ont
 * qu'une colonne de valeur.
 *
 * `montantN1` : comparatif N-1, exigé par le texte officiel sur les DEUX
 * états (bilan ET compte de résultat). Calculé depuis l'exercice
 * immédiatement antérieur du même tenant ; `undefined` (jamais 0 trompeur)
 * quand il n'y en a aucun (premier exercice du dossier).
 *
 * LA COLONNE N-1 DU BILAN EST NETTE, ET SEULEMENT NETTE (audit final F217,
 * son jumeau SYCEBNL) · le modèle de la Partie 4 ch. 2 imprime l'actif en
 * « Brut (N) | Amort. et déprec. (N) | Net (N) | Net (N-1) ». Deux champs
 * `brutN1` et `amortissementN1` étaient servis sans que personne ne les
 * lise, et valaient 0 sur un dossier sans exercice antérieur, là où ce
 * commentaire promettait `undefined` · un faux zéro sur une colonne que le
 * modèle n'a pas. Ils sont retirés, comme au SYSCOHADA.
 */
export interface PosteCalcule {
  ref: string;
  libelle: string;
  montant: number;
  montantN1?: number;
  brut?: number;
  amortissement?: number;
  comptes: CompteDuPoste[];
  /** Bilan uniquement : ligne de sous-total ou de total, pas un poste de détail. */
  estTotal?: boolean;
}

/**
 * `LigneBalancePourBilan` = alias local historique de
 * `LigneBalancePourEtat` (`etats-financiers.communs.ts`, où `correspond` et
 * le chargement de balance ont été extraits le 2026-08-28 pour être
 * partagés avec le jeu « projets de développement »). Conservé pour ne pas
 * réécrire toutes les signatures ci-dessous.
 */
type LigneBalancePourBilan = LigneBalancePourEtat;

/**
 * BILAN et COMPTE DE RÉSULTAT · adossés au tableau de correspondance
 * OFFICIEL SYCEBNL (`correspondance-bilan.ts` et
 * `correspondance-compte-resultat.ts`, transcrits du Journal officiel
 * OHADA, Partie 4 ch. 2 section 6). Les deux exposent, comme le texte
 * officiel l'exige : le détail Brut/Amortissement/Net côté bilan actif
 * (voir `PosteCalcule`), et un comparatif N-1 sur les deux états · trouvé
 * en écart lors d'une relecture du 2026-08-28 (voir le commentaire de
 * `trouverExerciceN1`), corrigé dans la foulée. Anomalies du texte officiel
 * signalées et corrigées explicitement, jamais masquées ni devinées.
 */
@Injectable()
export class EtatsFinanciersService {
  constructor(
    private readonly ecritureService: EcritureService,
    private readonly exerciceService: ExerciceService,
  ) {}

  /**
   * Exercice « N-1 » d'un bilan/compte de résultat : celui du même tenant
   * dont la date de début est la plus récente PARMI celles antérieures à
   * l'exercice demandé. `null` si aucun (premier exercice du dossier) · le
   * comparatif reste alors simplement absent (`undefined`), jamais un faux
   * zéro qui laisserait croire à un exercice antérieur réel et vide.
   */
  private async trouverExerciceN1(tenantId: string, exerciceId: string): Promise<string | null> {
    return trouverExerciceN1(this.exerciceService, tenantId, exerciceId);
  }

  private async chargerLignes(tenantId: string, exerciceId: string | null): Promise<LigneBalancePourBilan[]> {
    return chargerLignes(this.ecritureService, tenantId, exerciceId);
  }

  /** Poste ACTIF de détail : brut, amortissement (magnitude positive) et net, chacun exposé séparément. */
  private calculerPosteActif(poste: PosteBilanDeBase, lignes: LigneBalancePourBilan[]): PosteCalcule {
    let lignesBrut = lignes.filter((l) => correspond(l.numero, poste.comptes, poste.exclusions));
    if (poste.sens_qualificatif === 'DEBITEUR') {
      lignesBrut = lignesBrut.filter((l) => l.solde > 0);
    }
    // Découverts bancaires : un compte 52/53 créditeur appartient à DW
    // (passif), pas à BW (actif). Le laisser ici l'aurait compté deux fois // en négatif à l'actif ET en positif au passif déséquilibrant le bilan
    // du double du découvert. Voir `comptesTransferesSiCrediteur`.
    if (poste.comptesTransferesSiCrediteur) {
      lignesBrut = lignesBrut.filter(
        (l) => !(correspond(l.numero, poste.comptesTransferesSiCrediteur!) && l.solde < 0),
      );
    }
    const comptesBrut: CompteDuPoste[] = lignesBrut.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
    const brut = comptesBrut.reduce((s, c) => s + c.montant, 0);

    const lignesAmort = poste.comptesAmortissement
      ? lignes.filter((l) => correspond(l.numero, poste.comptesAmortissement!, poste.exclusionsAmortissement))
      : [];
    // PAS de négation sur `montant` ici : un compte d'amortissement bien
    // formé porte déjà un solde (débit − crédit) négatif (créditeur), ce qui
    // le soustrait naturellement du brut par simple addition · brut(5000) +
    // solde(-1500) = net(3500). Le signer en positif dans CETTE somme
    // l'ADDITIONNERAIT au lieu de le déduire : piège de signe repéré en
    // dérivant un cas de test à la main avant livraison, jamais constaté en
    // production, verrouillé depuis par un test de régression dédié.
    // `amortissement` (exposé séparément, ligne suivante) reste lui la
    // magnitude POSITIVE attendue par la colonne officielle.
    const comptesAmort: CompteDuPoste[] = lignesAmort.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));
    // `|| 0` normalise -0 en 0 (reduce sur un tableau vide renvoie 0, la
    // négation donne -0 : mathématiquement identique, mais Object.is(-0,0)
    // est faux · un simple souci de propreté de sortie, repéré par un test).
    const amortissement = -comptesAmort.reduce((s, c) => s + c.montant, 0) || 0;

    return {
      ref: poste.ref,
      libelle: poste.libelle,
      montant: brut - amortissement,
      brut,
      amortissement,
      comptes: [...comptesBrut, ...comptesAmort],
    };
  }

  /** Poste PASSIF de détail : solde créditeur net dans son sens naturel de lecture (pas de colonne Brut/Amort côté passif). */
  private calculerPostePassif(poste: PosteBilanDeBase, lignes: LigneBalancePourBilan[]): PosteCalcule {
    let matches = lignes.filter((l) => correspond(l.numero, poste.comptes, poste.exclusions));
    if (poste.sens_qualificatif === 'CREDITEUR') {
      matches = matches.filter((l) => l.solde < 0);
    }
    const comptes: CompteDuPoste[] = matches.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));
    return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
  }

  /**
   * DW (banques… crédits de trésorerie) · capte le compte 56 comme un poste
   * normal, PLUS les comptes 52/53 (les mêmes numéros que BW à l'actif) mais
   * SEULEMENT pour ceux dont le solde est créditeur (une banque à
   * découvert) · « 56, Solde créditeurs : 52, 53 », dit la table officielle
   * (Partie 4, ch. 2). Traité à part : ce n'est pas un poste de détail
   * ordinaire, il partage ses comptes avec un poste de l'ACTIF. Le
   * commentaire parlait encore de « 564/565 », restriction retirée le
   * 2026-08-28 (anomalie n° 5 de `correspondance-bilan.ts`, audit final
   * F212).
   */
  private calculerDW(lignes: LigneBalancePourBilan[]): PosteCalcule {
    const posteDW = POSTES_PASSIF.find((p) => p.ref === 'DW')!;
    const base = this.calculerPostePassif(posteDW, lignes);
    const decouverts = lignes.filter((l) => correspond(l.numero, COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) && l.solde < 0);
    const comptes = [...base.comptes, ...decouverts.map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }))];
    return { ref: 'DW', libelle: posteDW.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
  }

  /**
   * CH (Résultat net de l'exercice) · n'est PAS listé dans
   * `correspondance-bilan.ts`, il a DEUX sources qui s'ADDITIONNENT
   * (`resultatAuBilan`, resultat-de-l-exercice.ts) · le compte 13, que la
   * correspondance de la Partie 4 ch. 2 porte sur CH (« 13 (131 ou 139) »),
   * et les classes 6 à 8, que la clôture y portera (SYCEBNL, fiche du
   * compte 13, Fonctionnement).
   * Le 13 porte, entre la réouverture et l'affectation, le résultat de
   * l'exercice PRÉCÉDENT · sans lui, le bilan de N+1 lu avant l'assemblée
   * perdait ce résultat et sortait déséquilibré (passe V1, B1).
   */
  private calculerCH(
    lignes: LigneBalancePourBilan[],
  ): { poste: PosteCalcule; resultatClasses678: number; resultatCompte13: number; parts: PartsDuResultatAuBilan } {
    const lignes678 = lignes.filter(
      (l) => l.classe === ClasseCompte.CLASSE_6 || l.classe === ClasseCompte.CLASSE_7 || l.classe === ClasseCompte.CLASSE_8,
    );
    const resultatClasses678 = lignes678.reduce((s, l) => s - l.solde, 0);

    const lignes13 = lignes.filter((l) => estCompteDuResultatDeLExercice(l.numero));
    const resultatCompte13 = lignes13.reduce((s, l) => s - l.solde, 0);

    const montant = resultatAuBilan(resultatClasses678, resultatCompte13);
    const comptes = [...lignes13, ...lignes678]
      .filter((l) => Math.abs(l.solde) > 0.005)
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: -l.solde }));

    return {
      poste: { ref: 'CH', libelle: "Résultat net de l'exercice (excédent + ou déficit -)", montant, comptes },
      resultatClasses678,
      resultatCompte13,
      // L'exercice et le résultat antérieur non affecté, séparés par la règle
      // de la fiscalité (`partsDuResultatAuBilan`).
      parts: partsDuResultatAuBilan(resultatClasses678, resultatCompte13, lignes678, lignes13),
    };
  }

  /**
   * Résout tous les postes du bilan (détail + totaux) pour UN jeu de lignes
   * de balance · appelée une fois pour l'exercice N, une fois pour N-1
   * (`bilan()` fusionne ensuite les deux résultats). `lignes: []` (aucun
   * exercice N-1) résout tout à zéro sans cas particulier : un poste sans
   * compte est légitimement à 0, pas une erreur.
   */
  private resoudreTousLesPostesBilan(lignes: LigneBalancePourBilan[]): {
    parRef: Map<string, PosteCalcule>;
    resultatClasses678: number;
    resultatCompte13: number;
    parts: PartsDuResultatAuBilan;
  } {
    const parRef = new Map<string, PosteCalcule>();
    for (const poste of POSTES_ACTIF) {
      parRef.set(poste.ref, this.calculerPosteActif(poste, lignes));
    }
    for (const poste of POSTES_PASSIF) {
      if (poste.ref === 'DW') continue; // traité à part (calculerDW)
      parRef.set(poste.ref, this.calculerPostePassif(poste, lignes));
    }
    parRef.set('DW', this.calculerDW(lignes));

    const { poste: posteCH, resultatClasses678, resultatCompte13, parts } = this.calculerCH(lignes);
    parRef.set('CH', posteCH);

    // Totaux : chaque total additionne des refs déjà résolues (détail OU
    // total imbriqué) · TOTAUX_ACTIF/PASSIF sont déjà dans un ordre où une
    // ref n'est jamais utilisée avant d'avoir été calculée (vérifié par un
    // test dédié dans correspondance-bilan.spec.ts).
    for (const total of TOTAUX_ACTIF) {
      const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
      const brut = total.deRefs.reduce((s, ref) => {
        const p = parRef.get(ref);
        return s + (p?.brut ?? p?.montant ?? 0);
      }, 0);
      const amortissement = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.amortissement ?? 0), 0);
      parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, brut, amortissement, comptes: [] });
    }
    for (const total of TOTAUX_PASSIF) {
      const montant = total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0);
      parRef.set(total.ref, { ref: total.ref, libelle: total.libelle, montant, comptes: [] });
    }

    return { parRef, resultatClasses678, resultatCompte13, parts };
  }

  async bilan(tenantId: string, exerciceId: string) {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    const [lignesN, lignesN1, clos, closN1, ouvertureN] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId),
      this.chargerLignes(tenantId, exerciceN1Id),
      exerciceCloture(this.exerciceService, tenantId, exerciceId),
      exercicePrecedentCloture(this.exerciceService, tenantId, exerciceN1Id),
      // Paquet 1, A4 · l'ouverture lue AVANT ce que la clôture de N y porte
      // (`chargerOuverture`), seulement quand elle sert le comparatif.
      exerciceN1Id ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId),
    ]);

    // Q3 des cas chiffrés de la clôture · sans exercice N-1, le comparatif
    // est le bilan d'ouverture du dossier (SYCEBNL Partie 4 ch. 1 § 1.4,
    // `comparatifDuBilan`), jamais une colonne vide pour un dossier repris.
    // Bloquant 2 de la relecture du 2026-10-07 · sans exercice N-1 ni
    // report, une ouverture saisie en OD au premier jour n'est lue ni comme
    // flux ni comme ouverture, et l'ouverture présumée nulle est DITE.
    const ouverturePassee = await lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceId, exerciceN1Id, ouvertureN);
    const comparatif = comparatifDuBilan(exerciceN1Id, lignesN1, ouvertureN, ouverturePassee, 'SYCEBNL');
    const { parRef: parRefN, resultatClasses678, resultatCompte13, parts } = this.resoudreTousLesPostesBilan(lignesN);
    const { parRef: parRefN1, parts: partsN1 } = this.resoudreTousLesPostesBilan(comparatif.lignes);

    const refsTotaux = new Set([...TOTAUX_ACTIF, ...TOTAUX_PASSIF].map((t) => t.ref));
    const fusionnerN1 = (ref: string): PosteCalcule => {
      const n = parRefN.get(ref)!;
      const n1 = comparatif.provenance ? parRefN1.get(ref) : undefined;
      return {
        ...n,
        estTotal: refsTotaux.has(ref),
        montantN1: n1?.montant,
      };
    };
    const actif = ORDRE_AFFICHAGE_ACTIF.map(fusionnerN1);
    const passif = ORDRE_AFFICHAGE_PASSIF.map(fusionnerN1);

    // Comptes de bilan (classes 1-5) qu'AUCUN poste ne capte · signalés,
    // jamais absorbés en silence (règle §2.6, même discipline qu'au compte
    // de résultat). Un plan de comptes personnalisé qui s'écarterait des
    // préfixes officiels ferait apparaître ses comptes ici. Calculé sur N
    // seulement : N-1 n'est qu'un comparatif d'affichage, pas un état
    // audité par cet appel.
    const comptesRattaches = new Set<string>();
    for (const poste of [...POSTES_ACTIF, ...POSTES_PASSIF]) {
      for (const l of lignesN) {
        if (
          correspond(l.numero, poste.comptes, poste.exclusions) ||
          (poste.comptesAmortissement && correspond(l.numero, poste.comptesAmortissement, poste.exclusionsAmortissement))
        ) {
          comptesRattaches.add(l.compteId);
        }
      }
    }
    for (const l of lignesN) {
      if (correspond(l.numero, COMPTES_TRESORERIE_PASSIF_SI_CREDITEUR) || estCompteDuResultatDeLExercice(l.numero)) {
        comptesRattaches.add(l.compteId);
      }
    }
    const CLASSES_DE_BILAN = new Set<ClasseCompte>([
      ClasseCompte.CLASSE_1,
      ClasseCompte.CLASSE_2,
      ClasseCompte.CLASSE_3,
      ClasseCompte.CLASSE_4,
      ClasseCompte.CLASSE_5,
    ]);
    const comptesNonRattaches: CompteDuPoste[] = lignesN
      .filter((l) => CLASSES_DE_BILAN.has(l.classe) && !comptesRattaches.has(l.compteId))
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));

    const totalActif = parRefN.get('BZ')!.montant;
    const totalPassif = parRefN.get('DZ')!.montant;
    const totalActifN1 = comparatif.provenance ? parRefN1.get('BZ')!.montant : undefined;
    const totalPassifN1 = comparatif.provenance ? parRefN1.get('DZ')!.montant : undefined;

    return {
      actif,
      passif,
      totalActif,
      totalPassif,
      totalActifN1,
      totalPassifN1,
      exerciceN1Disponible: exerciceN1Id !== null,
      comparatif: comparatif.provenance,
      mentionComparatif: comparatif.mention,
      // Tolérance d'arrondi ; un écart réel signale un bug du moteur
      // d'écritures OU un compte non rattaché (voir comptesNonRattaches),
      // pas un défaut de cette répartition.
      equilibre: Math.abs(totalActif - totalPassif) < 0.01,
      comptesNonRattaches,
      // Les deux sources de CH, rendues séparées (la clôture en relit l'écart,
      // `ecartInexpliqueDuBilan`). Toutes deux non nulles, c'est la situation
      // avant l'affectation, pas un double comptage (`resultatAuBilan`).
      controle: {
        resultatClasses678,
        resultatCompte13,
        resultatAnterieurNonAffecte: parts.resultatAnterieurNonAffecte,
      },
      // Exercice CLÔTURÉ qui porte encore le résultat précédent non affecté ·
      // nommé, jamais présenté en silence comme résultat de l'exercice.
      resultatAnterieurNonVire: resultatAnterieurNonVire(clos, parts.resultatAnterieurNonAffecte, 'CH', 'SYCEBNL'),
      // La colonne N-1 qui reprend le même défaut de l'exercice précédent ·
      // dite, jamais recalculée (paquet 1, A1).
      resultatAnterieurNonVireN1: resultatAnterieurNonVireDuComparatif(
        comparatif.provenance,
        closN1,
        partsN1.resultatAnterieurNonAffecte,
        'CH',
        'SYCEBNL',
      ),
    };
  }

  /**
   * Résout tous les postes du compte de résultat pour UN jeu de lignes de
   * balance · même principe que `resoudreTousLesPostesBilan`, appelée une
   * fois pour N, une fois pour N-1.
   */
  private resoudreTousLesPostesCR(lignes: LigneBalancePourBilan[]): {
    produits: PosteCalcule[];
    charges: PosteCalcule[];
    produitsHao: PosteCalcule;
    chargesHao: PosteCalcule;
    comptesNonRattaches: CompteDuPoste[];
    resultatToutesClassesDeGestion: number;
  } {
    const comptesParPoste = new Map<string, CompteDuPoste[]>();
    // Comptes de gestion (classes 6/7/8) qu'aucun poste du tableau officiel
    // ne réclame : signalés, jamais rattachés d'office à un poste voisin
    // (règle §2.6 · une non-conformité se déclare, elle ne se devine pas).
    const comptesNonRattaches: CompteDuPoste[] = [];
    // Résultat « brut » · tous les comptes de gestion, indépendamment des
    // postes : c'est exactement la base sur laquelle le bilan calcule sa
    // ligne « Excédent (déficit) de l'exercice ». Sert de contrôle croisé.
    let resultatToutesClassesDeGestion = 0;

    for (const l of lignes) {
      if (l.classe === ClasseCompte.CLASSE_6 || l.classe === ClasseCompte.CLASSE_7 || l.classe === ClasseCompte.CLASSE_8) {
        resultatToutesClassesDeGestion += l.totalCredit - l.totalDebit;
      }
    }

    for (const l of lignes) {
      const poste = posteDuCompte(l.numero);

      if (!poste) {
        const estCompteDeGestion =
          l.classe === ClasseCompte.CLASSE_6 || l.classe === ClasseCompte.CLASSE_7 || l.classe === ClasseCompte.CLASSE_8;
        if (estCompteDeGestion) {
          comptesNonRattaches.push({ numero: l.numero, intitule: l.intitule, montant: l.totalCredit - l.totalDebit });
        }
        // Classes 1-5 (bilan) et classe 9 (hors états) : exclusion normale.
        continue;
      }

      const montant = poste.sens === 'PRODUIT' ? l.totalCredit - l.totalDebit : l.totalDebit - l.totalCredit;
      const existants = comptesParPoste.get(poste.ref) ?? [];
      existants.push({ numero: l.numero, intitule: l.intitule, montant });
      comptesParPoste.set(poste.ref, existants);
    }

    const calculer = (poste: PosteCompteResultat): PosteCalcule => {
      const comptes = comptesParPoste.get(poste.ref) ?? [];
      return { ref: poste.ref, libelle: poste.libelle, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes };
    };

    const produits = POSTES_PRODUITS.map(calculer);
    const charges = POSTES_CHARGES.map(calculer);
    const [produitsHao, chargesHao] = POSTES_HAO.map(calculer);

    return { produits, charges, produitsHao, chargesHao, comptesNonRattaches, resultatToutesClassesDeGestion };
  }

  /**
   * COMPTE DE RÉSULTAT · adossé au tableau de correspondance OFFICIEL
   * (`correspondance-compte-resultat.ts`, transcrit du Journal officiel
   * OHADA, Partie 4 ch. 2 section 6).
   *
   * Les postes portent leur montant dans leur sens naturel de lecture
   * (charges en positif), de sorte que les formules officielles s'appliquent
   * littéralement : XA = ΣR, XB = ΣT, XC = XA − XB, XD = TM − TN, XE = XC + XD
   * · sur N comme sur N-1 (le texte officiel exige les deux, colonne
   * « Net exercice au 31/12/N-1 »).
   */
  async compteDeResultat(tenantId: string, exerciceId: string) {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    const [lignesN, lignesN1, ouvertureN] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId),
      this.chargerLignes(tenantId, exerciceN1Id),
      // Le motif de la colonne N-1 lit l'ouverture comme le bilan (paquet 1, A4).
      exerciceN1Id ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId),
    ]);

    const resN = this.resoudreTousLesPostesCR(lignesN);
    const resN1 = this.resoudreTousLesPostesCR(lignesN1);
    const parRefN1 = new Map(
      [...resN1.produits, ...resN1.charges, resN1.produitsHao, resN1.chargesHao].map((p) => [p.ref, p]),
    );
    const fusionnerN1 = (p: PosteCalcule): PosteCalcule => ({
      ...p,
      montantN1: exerciceN1Id ? (parRefN1.get(p.ref)?.montant ?? 0) : undefined,
    });

    const produits = resN.produits.map(fusionnerN1);
    const charges = resN.charges.map(fusionnerN1);
    const produitsHao = fusionnerN1(resN.produitsHao);
    const chargesHao = fusionnerN1(resN.chargesHao);

    // XA inclut RH · voir l'anomalie n° 4 documentée dans
    // correspondance-compte-resultat.ts (le libellé officiel dit « Somme RA à
    // RG », ce qui romprait l'égalité résultat/bilan dès qu'il y a reprises).
    const totalProduits = produits.reduce((s, p) => s + p.montant, 0);
    const totalCharges = charges.reduce((s, p) => s + p.montant, 0);
    const resultatActivitesOrdinaires = totalProduits - totalCharges;
    const resultatHao = produitsHao.montant - chargesHao.montant;
    const resultatNet = resultatActivitesOrdinaires + resultatHao;

    const totalProduitsN1 = exerciceN1Id ? produits.reduce((s, p) => s + (p.montantN1 ?? 0), 0) : undefined;
    const totalChargesN1 = exerciceN1Id ? charges.reduce((s, p) => s + (p.montantN1 ?? 0), 0) : undefined;
    const resultatActivitesOrdinairesN1 =
      totalProduitsN1 !== undefined && totalChargesN1 !== undefined ? totalProduitsN1 - totalChargesN1 : undefined;
    const resultatHaoN1 = exerciceN1Id !== null ? (produitsHao.montantN1 ?? 0) - (chargesHao.montantN1 ?? 0) : undefined;
    const resultatNetN1 =
      resultatActivitesOrdinairesN1 !== undefined && resultatHaoN1 !== undefined
        ? resultatActivitesOrdinairesN1 + resultatHaoN1
        : undefined;

    // Contrôle croisé : le résultat obtenu en additionnant les postes
    // officiels (XE) doit être identique au résultat obtenu en soldant tous
    // les comptes de gestion · celui que le bilan loge en « Excédent
    // (déficit) de l'exercice ». Tout écart vaut exactement la somme des
    // comptes non rattachés : un compte de gestion hors poste disparaît des
    // totaux de l'état, et le compte de résultat cesse alors de boucler avec
    // le bilan. Exposé plutôt que masqué, et repris tel quel en feuille
    // « Anomalies » de l'export : un état qui ne boucle pas doit se voir.
    const ecartControle = resN.resultatToutesClassesDeGestion - resultatNet;

    return {
      produits,
      totalProduits, // XA
      totalProduitsN1,
      charges,
      totalCharges, // XB
      totalChargesN1,
      resultatActivitesOrdinaires, // XC
      resultatActivitesOrdinairesN1,
      produitsHao, // TM
      chargesHao, // TN
      resultatHao, // XD
      resultatHaoN1,
      resultatNet, // XE
      resultatNetN1,
      exerciceN1Disponible: exerciceN1Id !== null,
      // Q3 · le compte de résultat N-1 ne se tire pas d'un bilan d'ouverture.
      motifComparatifAbsent: !exerciceN1Id && ouvertureTenue(ouvertureN) ? MOTIF_RESULTAT_N1_NON_TENU : null,
      comptesNonRattaches: resN.comptesNonRattaches,
      controle: {
        resultatToutesClassesDeGestion: resN.resultatToutesClassesDeGestion,
        ecart: ecartControle,
        coherent: Math.abs(ecartControle) < 0.01,
      },
    };
  }

  // ==========================================================================
  // TABLEAU DE FLUX DE TRÉSORERIE (associations et ordres professionnels)
  //
  // Méthode DIRECTE, imposée par le référentiel (Partie 4, ch. 1 § 4), et
  // formule officielle appliquée telle quelle :
  //
  //     Encaissements N = Revenus (N) + Créances (N-1) - Créances (N)
  //     Décaissements N = Achats  (N) + Dettes   (N-1) - Dettes   (N)
  //
  // Voir `correspondance-tft.ts` pour le rattachement poste par poste et les
  // quatre anomalies du texte relevées.
  // ==========================================================================

  /**
   * Montant du FLUX d'un poste · le fait générateur, lu sur les mouvements
   * PROPRES de l'exercice (report à-nouveau exclu, voir
   * `EcritureService.balance`). Sans cette exclusion, le report à-nouveau
   * d'un compte d'immobilisation serait lu comme une acquisition de
   * l'exercice, et tout le tableau serait faux dès le deuxième exercice.
   */
  private fluxDuPoste(
    poste: PosteFluxTresorerie,
    lignes: LigneBalancePourBilan[],
    virements: VirementsParCompte = AUCUN_VIREMENT,
    reevaluations: VirementsParCompte = AUCUN_VIREMENT,
    incorporations: VirementsParCompte = AUCUN_VIREMENT,
  ): CompteDuPoste[] {
    const comptes: CompteDuPoste[] = [];
    for (const l of lignes) {
      const enFlux = correspond(l.numero, poste.comptesFlux, poste.exclusionsFlux);
      // Passe R6 · l'autre moitié d'un virement sans trésorerie dont le poste
      // lit le débit (en-cours achevé, avance imputée, production
      // immobilisée, reprise au 792). Un même compte peut être lu des deux
      // côtés (le 239 : débit payé, crédit viré) · une seule ligne, nette.
      const retranche = (poste.creditsARetrancher ?? []).some((r) => correspond(l.numero, r.comptes, r.exclusions));
      // D6 · la mise en service LIÉE à une fiche, sur un compte que la liste
      // ci-dessus ne retranche pas déjà en entier (le 219, le 229) · sinon
      // le 239 perdrait deux fois le même crédit.
      const viree =
        poste.misesEnServiceARetrancher && !retranche ? (virements.get(l.compteId)?.credit ?? 0) : 0;
      if (!enFlux && !retranche && !viree) continue;
      let montant = 0;
      if (enFlux) {
        switch (poste.lectureFlux) {
          case 'NET_PRODUIT':
            montant = l.mouvementCredit - l.mouvementDebit;
            break;
          case 'NET_CHARGE':
            montant = l.mouvementDebit - l.mouvementCredit;
            break;
          case 'DEBIT_SEUL':
            montant = l.mouvementDebit;
            break;
          case 'CREDIT_SEUL':
            montant = l.mouvementCredit;
            break;
        }
      }
      if (retranche) montant -= l.mouvementCredit;
      montant -= viree;
      // Lot 14 · la réévaluation passée par le module, reconnue par sa
      // liaison, n'est pas une acquisition · son débit sur un compte que le
      // poste lit au débit en sort (`reevaluationARetrancher`). Une
      // réévaluation passée à la main, sans liaison, y reste.
      if (enFlux && poste.reevaluationARetrancher && poste.lectureFlux === 'DEBIT_SEUL') {
        montant -= reevaluations.get(l.compteId)?.debit ?? 0;
      }
      // Ligne A22 · même règle pour les coûts d'emprunt incorporés du module.
      if (enFlux && poste.coutsEmpruntARetrancher && poste.lectureFlux === 'DEBIT_SEUL') {
        montant -= incorporations.get(l.compteId)?.debit ?? 0;
      }
      if (Math.abs(montant) > 0.005) comptes.push({ numero: l.numero, intitule: l.intitule, montant });
    }
    return comptes;
  }

  /**
   * Solde de CLÔTURE des contreparties (créances ou dettes) d'un poste, dans
   * sa magnitude naturelle : une créance est débitrice, une dette créditrice.
   * Lu en solde et non en mouvement · c'est une SITUATION à une date, que la
   * formule officielle compare entre N-1 et N.
   */
  private contrepartieDuPoste(poste: PosteFluxTresorerie, lignes: LigneBalancePourBilan[]): number {
    if (!poste.comptesContrepartie) return 0;
    const soldes = lignes
      .filter((l) => correspond(l.numero, poste.comptesContrepartie!, poste.exclusionsContrepartie))
      .reduce((s, l) => s + l.solde, 0);
    // Une créance (encaissement à venir) est débitrice, une dette
    // (décaissement à venir) créditrice : on ramène les deux à une magnitude
    // positive pour que la formule s'écrive à l'identique dans les deux sens.
    return poste.sens === 'ENCAISSEMENT' ? soldes : -soldes;
  }

  /**
   * Un poste de flux, formule officielle appliquée. Le montant retourné est
   * l'EFFET SUR LA TRÉSORERIE, signé : positif pour un encaissement, négatif
   * pour un décaissement · de sorte que les sous-totaux ZB à ZF s'obtiennent
   * par simple addition, comme le modèle l'écrit (« somme FA à FH »).
   */
  private calculerPosteFlux(
    poste: PosteFluxTresorerie,
    lignesN: LigneBalancePourBilan[],
    lignesN1: LigneBalancePourBilan[],
    virementsN: VirementsParCompte = AUCUN_VIREMENT,
    reevaluationsN: VirementsParCompte = AUCUN_VIREMENT,
    incorporationsN: VirementsParCompte = AUCUN_VIREMENT,
  ): PosteCalcule & { flux: number; variationContrepartie: number } {
    const comptes = this.fluxDuPoste(poste, lignesN, virementsN, reevaluationsN, incorporationsN);
    const flux = comptes.reduce((s, c) => s + c.montant, 0);
    const contrepartieN = this.contrepartieDuPoste(poste, lignesN);
    const contrepartieN1 = this.contrepartieDuPoste(poste, lignesN1);
    // « + Créances (N-1) - Créances (N) », mot pour mot.
    const variationContrepartie = contrepartieN1 - contrepartieN;
    const encaisse = flux + variationContrepartie;
    return {
      ref: poste.ref,
      libelle: poste.libelle,
      montant: (poste.sens === 'ENCAISSEMENT' ? encaisse : -encaisse) || 0,
      flux,
      variationContrepartie,
      comptes,
    };
  }

  /**
   * Trésorerie nette à la clôture d'un jeu de lignes : « Trésorerie actif -
   * Trésorerie passif », deuxième égalité de contrôle du texte officiel.
   * Lue depuis les postes du BILAN (BX et DX) et non depuis les comptes en
   * vrac : c'est le même chiffre que celui présenté au bilan, y compris le
   * traitement des découverts bancaires (52/53 créditeurs transférés de BW
   * vers DW) · les deux états ne peuvent donc pas diverger.
   */
  private tresorerieNette(lignes: LigneBalancePourBilan[]): number {
    const { parRef } = this.resoudreTousLesPostesBilan(lignes);
    return (parRef.get('BX')?.montant ?? 0) - (parRef.get('DX')?.montant ?? 0);
  }

  /**
   * Résout tous les postes de flux pour UN exercice, à partir de ses propres
   * lignes et de celles de l'exercice qui le précède (ses créances/dettes de
   * comparaison). Isolé pour être appelé DEUX FOIS par `tableauFluxTresorerie` :
   * une fois pour l'exercice demandé (colonne N), une fois pour son propre
   * exercice antérieur (colonne N-1) · le modèle officiel porte les deux
   * (« Colonnes : REF | LIBELLES | Rep. | Note | Exercice N | Exercice N-1 »),
   * et chaque ligne de ce tableau est elle-même une comparaison entre deux
   * exercices : la colonne N-1 exige donc un TROISIÈME exercice (N-2) en
   * arrière-plan, exactement comme la colonne N exige N-1. Sans exercice
   * antérieur disponible à un niveau donné, `chargerLignes(tenantId, null)`
   * renvoie `[]` et la formule se réduit proprement (même dégradation que ZA
   * quand le dossier n'a pas d'exercice antérieur).
   */
  private resoudreFluxPourExercice(
    lignesCourant: LigneBalancePourBilan[],
    lignesAnterieur: LigneBalancePourBilan[],
    // Les mises en service de l'exercice COURANT (D6), lues sur les mêmes
    // écritures que ses mouvements.
    virementsCourant: VirementsParCompte = AUCUN_VIREMENT,
    // Lot 14 · l'écriture de réévaluation du module, sur les mêmes écritures.
    reevaluationsCourant: VirementsParCompte = AUCUN_VIREMENT,
    // Ligne A22 · les coûts d'emprunt incorporés par le module.
    incorporationsCourant: VirementsParCompte = AUCUN_VIREMENT,
    // Une colonne qui ne se lit pas · ouverture saisie en OD au premier jour,
    // sans exercice précédent tenu ni report (paquet 1, A7), ou exercice ouvert
    // sans écriture au livre-journal (A3). Les postes qui lisent l'ouverture
    // ou les mouvements restent vides, avec ce motif.
    motifOuvertureIncertaine: string | null = null,
    // Le motif nomme-t-il un geste du cabinet qui lève sa cause (paquet 1,
    // relecture m3) ? Vrai d'une OD du premier jour (à-nouveau, journal ou
    // lendemain) et d'un exercice précédent ouvert, vide ou au brouillard ;
    // faux d'un exercice précédent clôturé sans écriture, que rien ne lève.
    motifALever = true,
  ): {
    parRef: Map<string, PosteCalcule & { flux?: number; variationContrepartie?: number }>;
    tresorerieOuverture: number;
    tresorerieClotureParFlux: number;
    tresorerieClotureParBilan: number;
    ecart: number;
    /** Postes laissés vides, et les totaux qui en dépendent · jamais des zéros constatés. */
    nonCalcules: Set<string>;
    postesNonCalculables: PosteDeFluxVide[];
  } {
    const parRef = new Map<string, PosteCalcule & { flux?: number; variationContrepartie?: number }>();
    const nonCalcules = new Set<string>();
    const postesNonCalculables: PosteDeFluxVide[] = [];
    // UNE OUVERTURE SAISIE EN OD AU PREMIER JOUR (paquet 1, A7, même règle que
    // le tableau du SYSCOHADA, bloquant 2 du 2026-10-07) · sans exercice
    // précédent ni report, une position de bilan passée par le journal
    // d'opérations diverses au premier jour peut être la REPRISE d'un dossier
    // (son bilan d'ouverture, SYCEBNL art. 16, 4) ; cadre conceptuel
    // § 3.3.1.2.4) ou l'APPORT qui fait naître l'association, et rien ne les
    // distingue. Lue comme flux, la reprise sortait en encaissement de la
    // dotation (FM) et ZA valait zéro, sous la mention d'une ouverture
    // présumée nulle. Ni l'un ni l'autre · ZA (l'ouverture) et chaque poste
    // FA à FQ (tous lisent les mouvements de l'exercice, et leurs
    // contreparties à l'ouverture) restent VIDES, le motif nomme les pièces.
    const laisserVide = (ref: string, libelle: string) => {
      parRef.set(ref, { ref, libelle, montant: 0, comptes: [] });
      nonCalcules.add(ref);
      postesNonCalculables.push({ ref, raison: motifOuvertureIncertaine!, aLever: motifALever });
    };

    // ZA · « Trésorerie nette au 1er janvier (Trésorerie actif N-1 -
    // Trésorerie passif N-1) », le libellé officiel dit lui-même la formule.
    const libelleZA = 'Trésorerie nette au 1er janvier (Trésorerie actif N-1 – Trésorerie passif N-1)';
    const tresorerieOuverture = motifOuvertureIncertaine ? 0 : this.tresorerieNette(lignesAnterieur);
    if (motifOuvertureIncertaine) {
      laisserVide('ZA', libelleZA);
    } else {
      parRef.set('ZA', { ref: 'ZA', libelle: libelleZA, montant: tresorerieOuverture, comptes: [] });
    }

    for (const poste of TOUS_LES_POSTES_FLUX) {
      if (motifOuvertureIncertaine) {
        laisserVide(poste.ref, poste.libelle);
        continue;
      }
      parRef.set(
        poste.ref,
        this.calculerPosteFlux(poste, lignesCourant, lignesAnterieur, virementsCourant, reevaluationsCourant, incorporationsCourant),
      );
    }
    for (const total of TOTAUX_FLUX) {
      parRef.set(total.ref, {
        ref: total.ref,
        libelle: total.libelle,
        montant: total.deRefs.reduce((s, ref) => s + (parRef.get(ref)?.montant ?? 0), 0),
        comptes: [],
      });
      // Un total d'un poste laissé vide est vide lui aussi · l'additionner
      // comme zéro rendrait un total plausible et faux.
      if (total.deRefs.some((ref) => nonCalcules.has(ref))) nonCalcules.add(total.ref);
    }

    // ZG calculé DEUX FOIS, comme le texte l'exige (deux égalités de
    // contrôle). Le montant présenté est celui du CUMUL DES FLUX (G + A),
    // qui est ce que le tableau démontre ; la lecture directe du bilan sert
    // de contrôle indépendant. Un écart n'est pas corrigé : il chiffre
    // exactement ce que la ventilation FA-FQ ne couvre pas.
    const variation = parRef.get('ZF')!.montant;
    const tresorerieClotureParFlux = tresorerieOuverture + variation;
    const tresorerieClotureParBilan = this.tresorerieNette(lignesCourant);
    const ecart = tresorerieClotureParFlux - tresorerieClotureParBilan;
    parRef.set('ZG', {
      ref: 'ZG',
      libelle: 'Trésorerie nette au 31 Décembre (G+A)',
      montant: tresorerieClotureParFlux,
      comptes: [],
    });
    if (nonCalcules.has('ZA') || nonCalcules.has('ZF')) nonCalcules.add('ZG');

    return { parRef, tresorerieOuverture, tresorerieClotureParFlux, tresorerieClotureParBilan, ecart, nonCalcules, postesNonCalculables };
  }

  async tableauFluxTresorerie(tenantId: string, exerciceId: string) {
    const exerciceN1Id = await this.trouverExerciceN1(tenantId, exerciceId);
    const exerciceN2Id = exerciceN1Id ? await this.trouverExerciceN1(tenantId, exerciceN1Id) : null;
    const [lignesN, lignesN1, lignesN2, virementsN, virementsN1, reevaluationsN, reevaluationsN1, incorporationsN, incorporationsN1] = await Promise.all([
      this.chargerLignes(tenantId, exerciceId),
      this.chargerLignes(tenantId, exerciceN1Id),
      this.chargerLignes(tenantId, exerciceN2Id),
      // Chaque colonne retranche SES mises en service (D6).
      this.ecritureService.virementsDeMiseEnService(tenantId, exerciceId),
      this.ecritureService.virementsDeMiseEnService(tenantId, exerciceN1Id),
      // Et SA réévaluation (lot 14).
      this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceId),
      this.ecritureService.mouvementsDeReevaluation(tenantId, exerciceN1Id),
      // Et SES coûts d'emprunt incorporés (ligne A22).
      this.ecritureService.mouvementsDeCoutsEmpruntIncorpores(tenantId, exerciceId),
      this.ecritureService.mouvementsDeCoutsEmpruntIncorpores(tenantId, exerciceN1Id),
    ]);

    // POSITIONS D'OUVERTURE · la clôture de l'exercice précédent quand il est
    // tenu, sinon l'OUVERTURE de l'exercice, qui est cette clôture (SYCEBNL
    // art. 16, 4) ; Partie 4 ch. 1 § 1.4 ; cas chiffrés de la clôture, Q3) ·
    // à-nouveau ou bilan d'ouverture importé d'un dossier repris, lus sur la
    // colonne REPORT avant la clôture de l'exercice (`chargerOuverture`), ou
    // rien pour une entité qui naît.
    // Sans elles, le premier exercice d'un dossier repris lisait une
    // trésorerie d'ouverture nulle et prenait le règlement d'une dette reprise
    // pour une absence de flux (passe V1, A1 · ZA 0 au lieu de 35 000 000,
    // variation +1 549 100 au lieu de -450 900). Même règle que le tableau du
    // SYSCOHADA (`EtatsFinanciersSyscohadaService.tableauFluxTresorerie`).
    // Un exercice précédent ouvert SANS ÉCRITURE ne tient aucune clôture ·
    // ses positions, nulles, ne remplacent pas l'ouverture de l'exercice
    // (`exercicePrecedentTenu`, relecture de la passe V1).
    const n1Tenu = exercicePrecedentTenu(exerciceN1Id, lignesN1);
    const n2Tenu = exercicePrecedentTenu(exerciceN2Id, lignesN2);
    // L'OUVERTURE se lit AVANT ce que la clôture de l'exercice y porte
    // (`chargerOuverture`, paquet 1, A4) · la colonne report d'un exercice
    // clôturé porte aussi le virement du résultat antérieur non affecté.
    const [ouvertureN, ouvertureN1, brouillardN1, closN1NonTenu] = await Promise.all([
      n1Tenu ? Promise.resolve([]) : chargerOuverture(this.ecritureService, tenantId, exerciceId),
      exerciceN1Id && !n2Tenu ? chargerOuverture(this.ecritureService, tenantId, exerciceN1Id) : Promise.resolve([]),
      // Un exercice précédent qui ne tient rien · vide, ou au brouillard (A2).
      brouillardDuPrecedentNonTenu(this.ecritureService, tenantId, exerciceN1Id, n1Tenu),
      // Et s'il est CLÔTURÉ, l'issue n'est plus de le compléter (relecture m1).
      precedentNonTenuCloture(this.exerciceService, tenantId, exerciceN1Id, n1Tenu),
    ]);
    // PAQUET 1, A7 · une ouverture saisie en OD au premier jour, sans exercice
    // précédent tenu ni report, n'est lue ni comme flux ni comme ouverture
    // (même règle que le tableau du SYSCOHADA) · cherchée pour chaque colonne.
    const [ouverturePasseeN, ouverturePasseeN1, negatifsTardifsN] = await Promise.all([
      lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceId, n1Tenu ? exerciceN1Id : null, ouvertureN),
      exerciceN1Id
        ? lireOuverturePasseeEnOd(this.ecritureService, tenantId, exerciceN1Id, n2Tenu ? exerciceN2Id : null, ouvertureN1)
        : Promise.resolve(null),
      // Second tour, jumeau du BLOQUANT 1 · une ouverture annulée après le
      // premier jour, dont la ressaisie se lit ici comme des flux · dite.
      lireNegatifsTardifsDeLOuverture(this.ecritureService, tenantId, exerciceId, n1Tenu ? exerciceN1Id : null, ouvertureN),
    ]);
    // Le motif de l'OD dit l'exercice précédent qui EXISTE sans rien tenir,
    // et l'issue de son brouillard (paquet 1, relecture m2) · jamais « sans
    // exercice précédent ». Pour la colonne N-1, l'état de N-2 n'est lu que
    // si une OD l'exige.
    const precedentN: EtatDuPrecedentNonTenu | null =
      exerciceN1Id && !n1Tenu ? { auBrouillard: brouillardN1, clos: closN1NonTenu } : null;
    const precedentN1 = ouverturePasseeN1
      ? await etatDuPrecedentNonTenu(this.ecritureService, this.exerciceService, tenantId, exerciceN2Id, n2Tenu)
      : null;
    const resN = this.resoudreFluxPourExercice(
      lignesN,
      n1Tenu ? lignesN1 : ouvertureN,
      virementsN,
      reevaluationsN,
      incorporationsN,
      ouverturePasseeN ? motifOuverturePasseeEnOd(ouverturePasseeN, 'SYCEBNL', precedentN) : null,
    );
    // Colonne N-1 : seulement si un exercice N-1 existe · jamais un faux
    // zéro pour un dossier à son premier exercice (même discipline que
    // partout ailleurs dans ce service). Ses propres positions d'ouverture
    // suivent la même règle (N-2, sinon l'ouverture de N-1).
    // PAQUET 1, A3 · un exercice N-1 ouvert SANS ÉCRITURE au livre-journal ne
    // tient ni positions ni flux · sa colonne reste vide, motif dit
    // (`motifColonneN1NonTenue`), jamais des zéros calculés sur rien.
    const motifN1 =
      exerciceN1Id && !n1Tenu
        ? motifColonneN1NonTenue('SYCEBNL', brouillardN1, closN1NonTenu)
        : ouverturePasseeN1
          ? motifOuverturePasseeEnOd(ouverturePasseeN1, 'SYCEBNL', precedentN1)
          : null;
    const resN1 = exerciceN1Id
      ? this.resoudreFluxPourExercice(
          lignesN1,
          n2Tenu ? lignesN2 : ouvertureN1,
          virementsN1,
          reevaluationsN1,
          incorporationsN1,
          motifN1,
          // Un exercice précédent CLÔTURÉ sans écriture ne se complète plus ·
          // sa colonne vide est une information, rien ne la lève (m3).
          !(exerciceN1Id && !n1Tenu && closN1NonTenu),
        )
      : null;

    const REFS_TOTAUX = new Set(['ZA', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF', 'ZG', '']);
    const lignesAffichees = ORDRE_AFFICHAGE_FLUX.map((entree) => {
      if ('section' in entree) return { section: entree.section };
      const p = resN.parRef.get(entree.ref)!;
      const total = TOTAUX_FLUX.find((t) => t.ref === entree.ref);
      return {
        ...p,
        // Un poste laissé vide en N-1 (paquet 1, A7) n'a pas de valeur ·
        // jamais un zéro.
        montantN1: resN1 && !resN1.nonCalcules.has(entree.ref) ? resN1.parRef.get(entree.ref)?.montant : undefined,
        estTotal: REFS_TOTAUX.has(entree.ref),
        repere: total?.repere,
      };
    });

    // Comptes ENCAISSABLES qu'aucun poste ne ventile · même discipline qu'au
    // bilan et au compte de résultat. Ce sont eux qui expliquent un écart de
    // bouclage : les lister à côté de l'écart donne la cause avec le montant,
    // plutôt qu'un chiffre orphelin. Calculé sur N seulement : N-1 n'est
    // qu'un comparatif d'affichage, pas un état audité par cet appel (même
    // convention que `bilan()`).
    const ventiles = new Set<string>();
    for (const poste of TOUS_LES_POSTES_FLUX) {
      for (const l of lignesN) {
        if (
          correspond(l.numero, poste.comptesFlux, poste.exclusionsFlux) ||
          (poste.comptesContrepartie && correspond(l.numero, poste.comptesContrepartie, poste.exclusionsContrepartie)) ||
          (poste.creditsARetrancher ?? []).some((r) => correspond(l.numero, r.comptes, r.exclusions))
        ) {
          ventiles.add(l.compteId);
        }
      }
    }
    const mouvemente = (l: LigneBalancePourBilan) =>
      Math.abs(l.mouvementDebit) > 0.005 || Math.abs(l.mouvementCredit) > 0.005;
    const interne = (l: LigneBalancePourBilan) => COMPTES_A_CONTREPARTIE_INTERNE.find((c) => l.numero.startsWith(c.numero));
    const comptesNonVentiles = lignesN
      .filter((l) => !ventiles.has(l.compteId))
      // La trésorerie elle-même (classe 5) n'a rien à ventiler : elle EST le
      // solde que le tableau explique. La classe 3 (stocks) ne porte pas de
      // flux non plus. Les 11, 12 et 13 passent par la règle ci-dessous.
      .filter((l) => !l.numero.startsWith('5') && !l.numero.startsWith('3'))
      .filter((l) => !interne(l))
      // Comptes sans trésorerie PAR CONSTRUCTION (dons en nature, dotations,
      // écritures d'inventaire…) : ils n'expliquent aucun écart, et les lister
      // à côté d'un écart nul apprend à ignorer le bloc. Ce qui doit y rester,
      // ce sont les comptes que le PLAN ne tranche pas (4491, 4572 et les
      // anomalies n° 6 à 10 de l'en-tête) · ceux-là en expliquent un. Voir
      // COMPTES_SANS_TRESORERIE.
      .filter((l) => !COMPTES_SANS_TRESORERIE.some((c) => l.numero.startsWith(c.numero)))
      .filter(mouvemente)
      .map((l) => ({ numero: l.numero, intitule: l.intitule, montant: l.solde }));

    // Passe R6 · les mouvements que la balance ne sait pas qualifier
    // (incorporation à la dotation, absorption d'un déficit, achèvement d'un
    // 219 ou d'un 229) sont lus comme des flux sans l'être. Ils ne sont pas
    // retranchés d'office, faute de connaître la contrepartie de chaque
    // écriture · ils sont NOMMÉS, seulement quand le tableau ne boucle pas.
    // Les réserves, le report et le résultat ne le sont que si la dotation a
    // bougé : sans mouvement du 10, leur affectation ordinaire (131 au 121,
    // 131 au 111) ne touche aucun poste.
    // Une ouverture en OD au premier jour (A7) explique l'écart par son motif ·
    // ses comptes ne sont pas des suspects.
    if (Math.abs(resN.ecart) >= 0.01 && !ouverturePasseeN) {
      const dotationMouvementee = lignesN.some(
        (l) => correspond(l.numero, ['10'], ['106', '1049']) && mouvemente(l),
      );
      for (const l of lignesN) {
        const c = interne(l);
        if (!c) continue;
        const suspect = c.lecture === 'CREDIT' ? l.mouvementCredit > 0.005 : dotationMouvementee && mouvemente(l);
        if (suspect) comptesNonVentiles.push({ numero: l.numero, intitule: l.intitule, montant: l.solde });
      }
    }

    return {
      lignes: lignesAffichees,
      exerciceN1Disponible: exerciceN1Id !== null,
      comptesNonVentiles,
      // D'où viennent les positions d'ouverture (ZA comprise) quand
      // l'exercice précédent n'en tient pas · même mention que le tableau du
      // SYSCOHADA · le report (dossier repris), rien (présumée nulle, dit), ou
      // une OD du premier jour (motif, postes vides, paquet 1, A7).
      mentionOuverture: avecNegatifsTardifs(
        n1Tenu
          ? null
          : exerciceN1Id && !ouverturePasseeN
            ? mentionExercicePrecedentVide('SYCEBNL', ouvertureTenue(ouvertureN), brouillardN1, closN1NonTenu)
            : ouverturePasseeN
              ? motifOuverturePasseeEnOd(ouverturePasseeN, 'SYCEBNL', precedentN)
              : ouvertureTenue(ouvertureN)
                ? mentionComparatifSurOuverture('SYCEBNL')
                : mentionOuverturePresumeeNulle('SYCEBNL'),
        negatifsTardifsN,
        'SYCEBNL',
      ),
      // Les postes laissés VIDES, jamais des zéros (paquet 1, A7), et leur
      // motif · colonne N, puis colonne N-1.
      postesVides: [...resN.nonCalcules],
      postesNonCalculables: resN.postesNonCalculables,
      postesNonCalculablesN1: resN1?.postesNonCalculables ?? [],
      // Les deux égalités du texte officiel sont vérifiées ensemble : si
      // elles concordent, le tableau boucle. ZA ou ZF laissée vide (A7) ·
      // contrôle non effectué, jamais un écart chiffré sur des zéros
      // (relecture M1, `controleDuTableauDesFlux`).
      controle: controleDuTableauDesFlux({
        ouverture: { ref: 'ZA', montant: resN.tresorerieOuverture },
        variation: { ref: 'ZF', montant: resN.parRef.get('ZF')!.montant },
        clotureParFlux: { ref: 'ZG', montant: resN.tresorerieClotureParFlux },
        clotureParBilan: resN.tresorerieClotureParBilan,
        vides: resN.nonCalcules,
      }),
    };
  }

}
