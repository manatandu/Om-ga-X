import type { TypeTiers } from '@prisma/client';

/**
 * DUPLICATION D'UN TIERS (ligne sage-l2, fonction 32 · Sage 100 i7, menu
 * Structure, « Dupliquer » un tiers). Règles pures, sans Prisma.
 *
 * LA COPIE REMPLIT LE FORMULAIRE DE CRÉATION, ELLE N'ÉCRIT RIEN · le cabinet
 * la relit, donne le code et crée par la route ordinaire (mêmes contrôles,
 * même panoplie de comptes). Rien n'est écrit avant sa confirmation.
 *
 * CE QUI EST PROPRE À UNE PERSONNE N'EST PAS REPRIS, ET C'EST DIT · le code
 * (unique au dossier) et les comptes (le nouveau tiers ouvre les siens) ; le
 * Numéro Impôt (identifiant d'un autre contribuable, que la liste annuelle
 * des fournisseurs exige pour CHACUN, loi de procédures fiscales, art. 47
 * ter) ; les coordonnées bancaires (un RIB recopié ferait payer le mauvais
 * tiers) ; les documents et les lieux de livraison (pièces et adresses d'un
 * autre tiers) ; le rattachement à une cellule du groupe (il fait éliminer
 * des opérations de l'agrégat) ; l'autorisation d'acquitter la TVA d'après
 * les débits (décision nominative du Directeur Général des Impôts, O.-L.
 * n° 10/001, art. 26) ; l'exclusion des relances (motif propre à ce tiers).
 * Un modèle ou un mode de règlement en sommeil n'est pas repris non plus ·
 * la création le refuserait. Les modèles d'impression (fonction 27) sont
 * repris · un choix de présentation, qui ne nomme personne.
 */

export interface TiersADupliquer {
  code: string;
  type: TypeTiers;
  nom: string;
  qualite: string | null;
  adresse: string | null;
  boitePostale: string | null;
  ville: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  contact: string | null;
  numeroImpot: string | null;
  celluleGroupeId: string | null;
  autoriseTvaDebits: boolean;
  horsRelance: boolean;
  validationAutomatiqueEcheances: boolean;
  modeleReglement: { id: string; estActif: boolean } | null;
  modeReglement: { id: string; estActif: boolean } | null;
  modeleImpressionExtraitId: string | null;
  modeleImpressionReglementId: string | null;
  modeleImpressionRappelId: string | null;
}

export interface CopieDuTiers {
  origine: string;
  corps: {
    type: TypeTiers;
    code: '';
    nom: string;
    qualite?: string;
    adresse?: string;
    boitePostale?: string;
    ville?: string;
    pays?: string;
    telephone?: string;
    email?: string;
    contact?: string;
    modeleReglementId?: string;
    modeReglementId?: string;
    validationAutomatiqueEcheances?: true;
    modeleImpressionExtraitId?: string;
    modeleImpressionReglementId?: string;
    modeleImpressionRappelId?: string;
  };
  nonRepris: Array<{ champ: string; motif: string }>;
}

const COPIEES = ['qualite', 'adresse', 'boitePostale', 'ville', 'pays', 'telephone', 'email', 'contact'] as const;

export function copieDuTiers(t: TiersADupliquer, decomptes: { ribs: number; documents: number; lieux: number }): CopieDuTiers {
  const corps: CopieDuTiers['corps'] = { type: t.type, code: '', nom: t.nom };
  for (const c of COPIEES) {
    const v = t[c];
    if (v) corps[c] = v;
  }
  const nonRepris: CopieDuTiers['nonRepris'] = [
    { champ: 'Code', motif: 'unique dans le dossier · à saisir' },
    { champ: 'Comptes', motif: 'le nouveau tiers ouvre les siens sous son collectif' },
  ];
  if (t.modeleReglement?.estActif) corps.modeleReglementId = t.modeleReglement.id;
  else if (t.modeleReglement) nonRepris.push({ champ: 'Modèle de règlement', motif: 'en sommeil' });
  if (t.modeleReglement?.estActif && t.validationAutomatiqueEcheances) corps.validationAutomatiqueEcheances = true;
  if (t.modeReglement?.estActif) corps.modeReglementId = t.modeReglement.id;
  else if (t.modeReglement) nonRepris.push({ champ: 'Mode de règlement', motif: 'en sommeil' });
  for (const c of ['modeleImpressionExtraitId', 'modeleImpressionReglementId', 'modeleImpressionRappelId'] as const) {
    const v = t[c];
    if (v) corps[c] = v;
  }
  if (t.numeroImpot) nonRepris.push({ champ: 'Numéro Impôt', motif: 'identifiant propre à chaque contribuable' });
  if (decomptes.ribs > 0) nonRepris.push({ champ: 'Coordonnées bancaires', motif: 'un RIB recopié ferait payer le mauvais tiers' });
  if (decomptes.documents > 0) nonRepris.push({ champ: 'Documents', motif: 'pièces de l’autre tiers' });
  if (decomptes.lieux > 0) nonRepris.push({ champ: 'Lieux de livraison', motif: 'adresses de l’autre client' });
  if (t.celluleGroupeId) nonRepris.push({ champ: 'Cellule du groupe', motif: 'rattachement propre à ce tiers' });
  if (t.autoriseTvaDebits) nonRepris.push({ champ: 'Autorisation aux débits', motif: 'décision nominative du Directeur Général des Impôts' });
  if (t.horsRelance) nonRepris.push({ champ: 'Exclusion des relances', motif: 'motif propre à ce tiers' });
  return { origine: t.code, corps, nonRepris };
}
