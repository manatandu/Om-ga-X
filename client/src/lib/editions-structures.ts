import type { Compte, Journal, NumerotationPiece, PlanAnalytique, SectionAnalytique, TauxTva, Tiers, TypeJournal, TypeTiers } from './types';
import { COLONNES_EDITION } from './modeles-edition';
import { classeDuNumero } from './classe-du-numero';
import { montant } from './montants';

/**
 * ÉDITIONS DES STRUCTURES (point 18 de la comparaison Sage i7).
 *
 * Le manuel i7 nomme les commandes · « Imprimer la liste des comptes », « des
 * journaux », « des tiers », « Imprimer les paramètres de la société » · sans
 * en donner la maquette. Les colonnes sont donc celles d'OmegaX, tirées des
 * champs de chaque fiche.
 *
 * DEUX RÈGLES. L'édition est une LISTE À PLAT, jamais l'écran imprimé · un
 * plan en arborescence ou une liste filtrée à l'écran sortait sur papier
 * tronquée sans le dire. Et le PÉRIMÈTRE SE DIT · « liste complète », ou la
 * sélection exacte qui a produit la liste, avec le nombre de lignes. Une
 * liste partielle qui ne dit pas qu'elle l'est se lit comme le plan entier.
 */

export interface Edition {
  colonnes: string[];
  lignes: string[][];
  /**
   * Les clés des colonnes, pour les éditions qu'un modèle personnalise
   * (ligne sage-l7, fonction 59 · `modeles-edition.ts`).
   */
  cles?: string[];
  /** Le groupe de chaque ligne, que le saut d'un modèle sépare · sa clé de tri et son titre. */
  groupes?: Array<{ cle: string; titre: string }>;
}

export const LIBELLE_TYPE_JOURNAL: Record<TypeJournal, string> = {
  ACHATS: 'Achats',
  VENTES: 'Ventes',
  TRESORERIE: 'Trésorerie',
  GENERAL: 'Général',
  SITUATION: 'Situation',
};

export const LIBELLE_NUMEROTATION: Record<NumerotationPiece, string> = {
  MANUELLE: 'Manuelle',
  CONTINUE_JOURNAL: 'Continue par journal',
  CONTINUE_FICHIER: 'Continue pour le fichier',
  MENSUELLE: 'Mensuelle',
};

const LIBELLE_TYPE_TIERS: Record<TypeTiers, string> = {
  ADHERENT: 'Adhérent',
  CLIENT: 'Client',
  FOURNISSEUR: 'Fournisseur',
  SALARIE: 'Salarié',
  AUTRE: 'Autre',
};

const REPORT: Record<Compte['modeReportANouveau'], string> = { AUCUN: 'Aucun', SOLDE: 'Solde', DETAIL: 'Détail' };
const ouiNon = (b: boolean) => (b ? 'Oui' : 'Non');
const etat = (actif: boolean) => (actif ? 'Actif' : 'En sommeil');
const parCode = <T,>(cle: (x: T) => string) => (a: T, b: T) => cle(a).localeCompare(cle(b), 'fr');

export function editionPlan(comptes: Compte[]): Edition {
  const tries = [...comptes].sort(parCode((c) => c.numero));
  return {
    colonnes: COLONNES_EDITION.PLAN_COMPTABLE.map((c) => c.libelle),
    cles: COLONNES_EDITION.PLAN_COMPTABLE.map((c) => c.cle),
    // « Le numéro de chacune des classes 1 à 9 constitue le premier chiffre
    // des numéros de la classe » (AUDCIF Titre VII ch. 2, rôle du premier
    // chiffre), lu par la règle de l'écran (`classeDuNumero`) · le saut d'un
    // modèle sépare les classes.
    groupes: tries.map((c) => {
      const classe = classeDuNumero(c.numero);
      return classe ? { cle: classe, titre: `Classe ${classe.slice(-1)}` } : { cle: '~', titre: 'Hors classe' };
    }),
    lignes: tries.map((c) => [
      c.numero,
      c.intitule,
      c.typeCompte === 'TOTAL' ? 'Total' : 'Détail',
      c.nature ?? '',
      REPORT[c.modeReportANouveau],
      ouiNon(c.lettrable),
      etat(c.estActif),
    ]),
  };
}

/** L'ordre des groupes de tiers à l'impression · celui de la fiche. */
const RANG_TYPE_TIERS: Record<TypeTiers, number> = { ADHERENT: 1, CLIENT: 2, FOURNISSEUR: 3, SALARIE: 4, AUTRE: 5 };

export function editionTiers(tiers: Tiers[]): Edition {
  const tries = [...tiers].sort(parCode((t) => t.code));
  return {
    colonnes: COLONNES_EDITION.PLAN_TIERS.map((c) => c.libelle),
    cles: COLONNES_EDITION.PLAN_TIERS.map((c) => c.cle),
    groupes: tries.map((t) => ({ cle: String(RANG_TYPE_TIERS[t.type]), titre: LIBELLE_TYPE_TIERS[t.type] })),
    lignes: tries.map((t) => [
      t.code,
      t.nom,
      t.qualite ?? '',
      LIBELLE_TYPE_TIERS[t.type],
      t.comptesRattaches.find((r) => r.estPrincipal)?.compte.numero ?? '',
      t.ville ?? '',
      t.telephone ?? '',
      t.numeroImpot ?? '',
      etat(t.estActif),
    ]),
  };
}

/**
 * Le plan analytique · les sections d'un plan. Le groupe est la RUBRIQUE de
 * premier niveau · la section TOTAL au code le plus court qui commence le
 * code de la ligne (une rubrique agrège les sections dont le code commence
 * par le sien, `analytique/rubriques-budgetaires.ts`) ; sans elle, « Hors
 * rubrique », rangé en dernier.
 */
export function editionAnalytique(plan: Pick<PlanAnalytique, 'code' | 'intitule'> | null, sections: SectionAnalytique[]): Edition {
  const tries = [...sections].sort(parCode((s) => s.code));
  const rubriques = tries
    .filter((s) => s.type === 'TOTAL')
    .sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code, 'fr'));
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
  return {
    colonnes: COLONNES_EDITION.PLAN_ANALYTIQUE.map((c) => c.libelle),
    cles: COLONNES_EDITION.PLAN_ANALYTIQUE.map((c) => c.cle),
    groupes: tries.map((s) => {
      const r = rubriques.find((x) => s.code.startsWith(x.code));
      // « ~ » se range après tout code · la ligne sans rubrique vient en dernier.
      return r ? { cle: r.code, titre: `${plan ? `${plan.code} · ` : ''}Rubrique ${r.code} · ${r.intitule}` } : { cle: '~', titre: 'Hors rubrique' };
    }),
    lignes: tries.map((s) => [
      s.code,
      s.intitule,
      s.type === 'TOTAL' ? 'Total' : 'Détail',
      s.bailleur ? `${s.bailleur.code} · ${s.bailleur.nom}` : '',
      date(s.dateDebut),
      date(s.dateFin),
      s.estActive ? 'Active' : 'En sommeil',
    ]),
  };
}

export function editionJournaux(journaux: Journal[]): Edition {
  return {
    colonnes: ['Code', 'Intitulé', 'Type', 'Compte de trésorerie', 'Numérotation', 'Contrepartie à chaque ligne', 'État'],
    lignes: [...journaux].sort(parCode((j) => j.code)).map((j) => [
      j.code,
      j.intitule,
      LIBELLE_TYPE_JOURNAL[j.type],
      j.compteTresorerie?.numero ?? '',
      LIBELLE_NUMEROTATION[j.numerotation],
      j.type === 'TRESORERIE' ? ouiNon(!!j.contrepartieChaqueLigne) : '',
      etat(j.estActif),
    ]),
  };
}

export function editionTaux(taux: TauxTva[]): Edition {
  return {
    colonnes: ['Code', 'Intitulé', 'Taux', 'Compte collecté', 'Compte déductible', 'État'],
    lignes: [...taux].sort(parCode((t) => t.code)).map((t) => [
      t.code,
      t.intitule,
      `${Number(t.taux).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} %`,
      t.compteCollecte?.numero ?? '',
      t.compteDeductible?.numero ?? '',
      etat(t.estActif),
    ]),
  };
}

/**
 * LE PÉRIMÈTRE DE L'ÉDITION DU PLAN ANALYTIQUE (relecture « échecs
 * silencieux » de sage-l7, m6) · des sections NON LUES (axe qui change, lecture
 * tombée) ne s'impriment pas comme une « Liste complète · 0 section », ni
 * comme celles de l'axe d'avant · le périmètre le dit.
 */
export function perimetreDesSections(
  plan: Pick<PlanAnalytique, 'code' | 'intitule'> | null,
  sectionsLues: boolean,
  recherche: string,
  nombre: number,
): string {
  if (!plan) return "Aucun axe choisi · rien n'est imprimé";
  if (!sectionsLues) return `Sections de l'axe ${plan.code} non lues · rien n'est imprimé`;
  return perimetreEdition(
    [
      ['Plan', `${plan.code} · ${plan.intitule}`],
      ['Recherche', recherche],
    ],
    nombre,
    'section',
  );
}

/**
 * LE PÉRIMÈTRE D'UNE LISTE RELUE À CHAQUE RECHERCHE (relecture des écrans,
 * second tour, 12 · jumeau de `perimetreDesSections`) · le plan comptable ou
 * le plan des tiers PAS ENCORE LU pour la recherche tapée (réponse en route,
 * lecture tombée) ne s'imprime pas sous ses critères · l'édition aurait porté
 * la liste de la recherche d'avant sous la recherche du jour.
 */
export function perimetreSiLue(
  lue: boolean,
  quoi: string,
  criteres: Array<[string, string | null | undefined]>,
  nombre: number,
  unite: string,
  pluriel?: string,
): string {
  if (!lue) return `${quoi} non lu pour cette recherche · rien n'est imprimé`;
  return perimetreEdition(criteres, nombre, unite, pluriel);
}

/**
 * Ce que la liste couvre · les critères qui l'ont produite, dans l'ordre où
 * l'écran les pose. Aucun critère, c'est la liste complète.
 */
export function perimetreEdition(
  criteres: Array<[string, string | null | undefined]>,
  nombre: number,
  unite: string,
  pluriel = `${unite}s`,
): string {
  const actifs = criteres.filter(([, v]) => v && v.trim() !== '').map(([k, v]) => `${k} « ${v!.trim()} »`);
  const compte = `${nombre} ${nombre > 1 ? pluriel : unite}`;
  return actifs.length ? `Sélection · ${actifs.join(' · ')} · ${compte}` : `Liste complète · ${compte}`;
}

/**
 * « Imprimer les paramètres de la société » · une rubrique par ligne. Une
 * rubrique vide s'imprime « non renseigné » plutôt que de disparaître · une
 * fiche qui omet ce qu'elle n'a pas se lit comme complète.
 */
export function editionParametres(
  p: import('./types').ParametresDossier,
  libelles: { jeuOuSysteme: string | null; forme: string | null },
): Edition {
  const v = (x: string | number | null | undefined) => (x === null || x === undefined || x === '' ? 'non renseigné' : String(x));
  const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : null);
  const sycebnl = p.referentiel === 'SYCEBNL';
  const lignes: Array<[string, string]> = [
    ['Dénomination', v(p.nom)],
    ['Référentiel', p.referentiel],
    [sycebnl ? "Jeu d'états financiers" : 'Système comptable', v(libelles.jeuOuSysteme)],
    ['Forme juridique', v(libelles.forme)],
    ['Activité', v(p.activite)],
    ['Adresse', v(p.adresse)],
    ['Ville', v(p.ville)],
    ['Pays', v(p.pays)],
    ['Téléphone', v(p.telephone)],
    ['Courriel', v(p.email)],
    ['Site', v(p.siteWeb)],
  ];
  if (!sycebnl) {
    lignes.push(
      ['Capital social', p.capitalSocial === null ? 'non renseigné' : `${p.capitalSocial.toLocaleString('fr-FR')} ${p.devise ?? ''}${p.capitalVariable ? ' · à capital variable' : ''}`.trim()],
      // LE REGISTRE DE LA FORME, JAMAIS LE RCCM POUR UN AUTRE · la coopérative
      // est immatriculée au Registre des Sociétés Coopératives et à lui seul
      // (AUSCOOP art. 74 et 77 al. 1), l'entreprenant déclare son activité et
      // n'est pas immatriculé (AUDCG art. 62 et 64). Leur imprimer « RCCM :
      // non renseigné » les dirait en défaut d'une immatriculation qu'ils
      // n'ont pas à prendre.
      p.formeJuridiqueSyscohada === 'SOCIETE_COOPERATIVE'
        ? ['Registre des Sociétés Coopératives', v(p.numeroRegistreCooperatives)]
        : p.formeJuridiqueSyscohada === 'ENTREPRENANT'
          ? ['N° de déclaration d’activité', v(p.numeroDeclarationActivite)]
          : ['RCCM', v(p.rccm)],
    );
  }
  lignes.push(['N° impôt', v(p.numeroImpot)], ['Identification nationale', v(p.idNat)]);
  if (sycebnl) {
    lignes.push(
      ['Acte de personnalité juridique', v([p.actePersonnaliteJuridique, date(p.dateActePersonnalite)].filter(Boolean).join(' du ') || null)],
      ['Enregistrement sectoriel', v(p.numeroEnregistrementSecteur)],
      ['Certificat du Ministère du Plan', v(p.certificatEnregistrementPlan)],
      ["Attestation d'exemption d'IS", v(p.attestationExemptionIs)],
    );
  }
  lignes.push(
    ['Monnaie de tenue', v(p.devise)],
    ['Monnaie fonctionnelle', v(p.deviseFonctionnelle)],
    ['Longueur des comptes', `${p.longueurCompte} chiffres`],
    // La RÉPONSE, pas le booléen · un faux par défaut s'imprimerait « Non »
    // sur un dossier qui n'a jamais répondu.
    ['Assujetti à la TVA', p.assujettissementTva == null ? 'non renseigné' : ouiNon(p.assujettissementTva)],
    ['Vente de biens ou de services', p.venteBiensServices == null ? 'non renseigné' : ouiNon(p.venteBiensServices)],
    ['Double regard à la validation', ouiNon(p.doubleRegardValidation)],
    ['Visa des RIB par un second utilisateur', ouiNon(p.visaRibs)],
    ['Circuit de visa avant validation', ouiNon(p.circuitVisa === true)],
    ['Refus de clôturer un journal non imprimé', ouiNon(p.refusClotureJournalNonImprime)],
    ['Création de comptes pendant la saisie', ouiNon(p.creationCompteEnSaisie)],
    // Ligne sage-l2, fonction 36 · `null` est « aucun seuil », jamais zéro.
    ["Seuil de l'écart de règlement", p.seuilEcartReglement == null ? 'aucun' : montant(p.seuilEcartReglement)],
  );
  return { colonnes: ['Rubrique', 'Valeur'], lignes };
}

export function libelleTypeTiers(t: TypeTiers): string {
  return LIBELLE_TYPE_TIERS[t];
}
