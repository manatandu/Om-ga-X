/**
 * LA SAISIE DES CONDITIONS ET DES AUTORISATIONS (ligne sage-l3, fonction 46,
 * premier tour de relecture, constat M1 des écrans et M5 des échecs
 * silencieux). Une saisie illisible ne part JAMAIS comme une absence ·
 * `Number("2,5 %")` rendait NaN, que `JSON.stringify` envoie en `null`, et le
 * serveur, qui lit `null` comme « non déclaré », enregistrait la convention
 * sans le taux tapé, « Conditions déclarées. » à l'appui ; un palier illisible
 * disparaissait par le filtre. Ici · vide = absent, illisible = refus NOMMÉ
 * à l'écran, et rien ne part. Les règles de fond restent au serveur
 * (`banques/conditions-bancaires.ts`).
 */

export type Lu = { vide: true } | { valeur: number } | { illisible: true };

/**
 * Un nombre tapé · espaces (insécables comprises) et « % » final retirés,
 * virgule ou point décimal. UN MONTANT n'admet pas un point suivi de trois
 * chiffres (second tour, MAJEUR 2) · en RDC le point sépare les milliers
 * (« 300.000,00 Francs congolais », loi n° 23/053, art. 138), et
 * « 500.000 » s'enregistrait à 500 · AMBIGU, refusé. Un taux garde ses
 * décimales (« 3.125 »).
 */
export function lireNombre(texte: string | undefined, nature: 'montant' | 'taux' = 'taux'): Lu {
  const brut = (texte ?? '').replace(/[\s  ]/g, '').replace(/%$/, '');
  if (nature === 'montant' && /^-?\d{1,3}(\.\d{3})+$/.test(brut)) return { illisible: true };
  const t = brut.replace(',', '.');
  if (t === '') return { vide: true };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { illisible: true };
  return { valeur: Number(t) };
}

export type Corps<T> = { corps: T } | { refus: string };

const valeurOuNull = (lu: Lu) => ('valeur' in lu ? lu.valeur : null);

export interface CorpsConditions {
  dateEffet: string;
  referenceConvention: string;
  dateConvention: string;
  typePalier: string | null;
  paliers: Array<{ plafond: number; taux: number }>;
  tauxInteretsCrediteurs: number | null;
  tauxCommissionMouvement: number | null;
  tauxCommissionPlusFortDecouvert: number | null;
  fraisTenueCompte: number | null;
  periodiciteFrais: string | null;
  baseCalcul: number | null;
}

/** Le corps de la déclaration des conditions, ou le refus qui nomme le premier champ illisible ou incomplet. */
export function corpsConditions(f: Record<string, string | undefined>): Corps<CorpsConditions> {
  const paliers: Array<{ plafond: number; taux: number }> = [];
  for (const i of [1, 2, 3]) {
    const plafond = lireNombre(f[`plafond${i}`], 'montant');
    const taux = lireNombre(f[`taux${i}`]);
    if ('vide' in plafond && 'vide' in taux) continue;
    if ('illisible' in plafond) return { refus: `Palier ${i}, plafond · illisible (écrivez 500 000 ou 500,00).` };
    if ('illisible' in taux) return { refus: `Palier ${i}, taux · illisible.` };
    if ('vide' in plafond) return { refus: `Palier ${i} · le plafond est exigé.` };
    if ('vide' in taux) return { refus: `Palier ${i} · le taux est exigé.` };
    paliers.push({ plafond: plafond.valeur, taux: taux.valeur });
  }
  const champs: Array<[string, string]> = [
    ['tauxInteretsCrediteurs', 'Intérêts créditeurs'],
    ['tauxCommissionMouvement', 'Commission de mouvement'],
    ['tauxCommissionPlusFortDecouvert', 'Plus fort découvert'],
    ['fraisTenueCompte', 'Frais de tenue de compte'],
  ];
  const lus: Record<string, Lu> = {};
  for (const [k, nom] of champs) {
    lus[k] = lireNombre(f[k], k === 'fraisTenueCompte' ? 'montant' : 'taux');
    if ('illisible' in lus[k]) return { refus: k === 'fraisTenueCompte' ? `${nom} · illisible (écrivez 15 000 ou 15 000,00).` : `${nom} · illisible.` };
  }
  return {
    corps: {
      dateEffet: f.dateEffet ?? '',
      referenceConvention: f.referenceConvention ?? '',
      dateConvention: f.dateConvention ?? '',
      typePalier: paliers.length > 0 ? f.typePalier || null : null,
      paliers,
      tauxInteretsCrediteurs: valeurOuNull(lus.tauxInteretsCrediteurs),
      tauxCommissionMouvement: valeurOuNull(lus.tauxCommissionMouvement),
      tauxCommissionPlusFortDecouvert: valeurOuNull(lus.tauxCommissionPlusFortDecouvert),
      fraisTenueCompte: valeurOuNull(lus.fraisTenueCompte),
      periodiciteFrais: f.periodiciteFrais || null,
      baseCalcul: f.baseCalcul ? Number(f.baseCalcul) : null,
    },
  };
}

export interface CorpsAutorisation {
  nature: string;
  montant: number;
  dateDebut: string;
  dateFin: string | null;
  irrevocable: boolean;
  referenceConvention: string;
  dateConvention: string;
}

/** Le corps de la déclaration d'une autorisation, ou le refus qui nomme le montant manquant ou illisible. */
export function corpsAutorisation(f: Record<string, string | undefined>): Corps<CorpsAutorisation> {
  const montant = lireNombre(f.montant, 'montant');
  if ('vide' in montant) return { refus: 'Le montant autorisé est exigé.' };
  if ('illisible' in montant) return { refus: 'Montant autorisé · illisible (écrivez 500 000 ou 500 000,00).' };
  return {
    corps: {
      nature: f.nature ?? 'DECOUVERT',
      montant: montant.valeur,
      dateDebut: f.dateDebut ?? '',
      dateFin: f.dateFin || null,
      irrevocable: f.irrevocable === 'oui',
      referenceConvention: f.referenceConvention ?? '',
      dateConvention: f.dateConvention ?? '',
    },
  };
}
