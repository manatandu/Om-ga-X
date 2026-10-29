import {
  DEROGATION_JOUR_LE_JOUR,
  EXEMPLAIRES_ETABLISSEMENT,
  EXEMPLAIRES_MOUVEMENT,
  FORMULAIRE_2023_NON_LU,
  MOTIFS_MOUVEMENT,
  PRIMAUTE_DELAI_LOI,
  fenetreDeclarationEtablissement,
  formulaireEtablissement,
  formulaireMouvement,
  motifRefusMouvement,
} from './declarations-travail';
import { declarationsDues } from './regles-contrat-travail';

/**
 * LES DÉCLARATIONS DES ART. 216 ET 217 EN FORMULAIRE (arrêtés n° 006 et 008
 * de 2010). Ce qui casserait en silence · un délai de l'arrêté servi contre
 * la loi, un champ du registre deviné, un motif de départ sans date de départ.
 */

const employeur = { nom: 'ASBL Exemple', adresse: 'Av. du Port 4', ville: 'Kinshasa', telephone: null, activite: 'Santé', numeroAffiliationCnssEmployeur: 'E-123' };
const salarie = {
  nom: 'MBALA',
  postNom: 'KIESE',
  prenoms: 'Jean',
  sexe: 'MASCULIN' as const,
  dateNaissance: new Date('1990-03-04T00:00:00Z'),
  millesimeNaissance: null,
  lieuNaissance: 'Matadi',
  nationalite: 'Congolaise',
  numeroAffiliationCnss: null,
  nomConjoint: null,
  nombreEnfants: 2,
  etranger: false,
};
const contrat = {
  type: 'DUREE_INDETERMINEE' as const,
  dateEntreeEnVigueur: new Date('2026-01-05T00:00:00Z'),
  dateFin: null,
  natureTravail: 'Infirmier',
  categorieProfessionnelle: null,
  classeProfessionnelle: 9,
  periodiciteRemuneration: 'MOIS' as const,
  remunerationBase: 900000,
  deviseRemuneration: 'CDF',
};

describe('le délai est celui de la loi (art. 217, loi n° 16/010), pas les 48 heures de l’arrêté n° 006', () => {
  it('quinze jours après l’engagement, et la primauté est dite', () => {
    const [d] = declarationsDues({ dateEntreeEnVigueur: '2026-01-05', declarationEngagementLe: null, dateFin: null, declarationDepartLe: null }, new Date('2026-01-08'));
    expect(d.echeance.toISOString().slice(0, 10)).toBe('2026-01-20');
    expect(d.article).toContain('arrêté n° 006/CAB/PVPM/ETPS/2010');
    expect(PRIMAUTE_DELAI_LOI).toContain('quinze jours');
    expect(PRIMAUTE_DELAI_LOI).toContain('quarante-huit heures');
    expect(PRIMAUTE_DELAI_LOI).toContain('la loi, postérieure et supérieure, prime');
  });
});

describe('le formulaire de mouvement (arrêté n° 006, annexe)', () => {
  it('les cinq motifs, dans l’ordre et sous le numéro du formulaire', () => {
    expect(MOTIFS_MOUVEMENT.map((m) => [m.rang, m.libelle])).toEqual([
      [1, 'Embauche'],
      [2, 'Expiration normale du contrat'],
      [3, 'Licenciement'],
      [4, 'Démission'],
      [5, 'Décès'],
    ]);
  });

  it('un départ sans date de fin au registre ne se déclare pas, un motif inconnu non plus', () => {
    expect(motifRefusMouvement('DEMISSION', { dateFin: null })).toContain('date du départ');
    expect(motifRefusMouvement('DEMISSION', { dateFin: new Date('2026-06-30T00:00:00Z') })).toBeNull();
    expect(motifRefusMouvement('EMBAUCHE', { dateFin: null })).toBeNull();
    expect(motifRefusMouvement('RETRAITE', { dateFin: null })).toContain('Motif inconnu');
  });

  it('remplit depuis le registre et NOMME ce qu’il ne tient pas, sans rien deviner', () => {
    const f = formulaireMouvement(employeur, salarie, contrat, 'EMBAUCHE');
    const val = (l: string) => [...f.employeur, ...f.travailleur].find((c) => c.libelle === l)?.valeur;
    expect(val('Nom et prénoms')).toBe('MBALA, KIESE, Jean');
    expect(val('Date et lieu de naissance')).toBe('1990-03-04, Matadi');
    expect(val('Classification')).toBe('classe 9 (décret n° 25/22)');
    expect(val('Salaire')).toBe('900000.00 CDF par mois');
    expect(val('Contrat')).toBe('à durée indéterminée');
    expect(f.motif).toEqual({ code: 'EMBAUCHE', rang: 1, libelle: 'Embauche', le: '2026-01-05' });
    expect(f.offreAPreciser).toBe(false);
    // Téléphone, B.P. et immatriculation du travailleur absents · nommés.
    expect(f.manquants).toEqual(expect.arrayContaining(['Téléphone', 'B.P.', "N° d'immatriculation à l'INSS (CNSS)"]));
    expect(f.manquants.join(' ')).toContain('état civil à cocher');
    // Un national n'a pas de carte de travail à présenter.
    expect(f.travailleur.some((c) => c.libelle.startsWith('Carte de travail'))).toBe(false);
  });

  it('la carte de travail se réclame d’un étranger, et quand la nationalité manque', () => {
    for (const etranger of [true, null]) {
      const f = formulaireMouvement(employeur, { ...salarie, etranger }, contrat, 'EMBAUCHE');
      expect(f.manquants).toContain('Carte de travail, délivrée le');
    }
  });

  it('un départ porte sa date et ouvre la section de l’offre d’emploi', () => {
    const f = formulaireMouvement(employeur, salarie, { ...contrat, dateFin: new Date('2026-06-30T00:00:00Z') }, 'LICENCIEMENT');
    expect(f.motif).toMatchObject({ rang: 3, le: '2026-06-30' });
    expect(f.offreAPreciser).toBe(true);
  });

  it('un salaire sans monnaie est nommé, jamais complété', () => {
    const f = formulaireMouvement(employeur, salarie, { ...contrat, deviseRemuneration: null }, 'EMBAUCHE');
    expect(f.travailleur.find((c) => c.libelle === 'Salaire')?.valeur).toBe('900000.00 par mois');
    expect(f.manquants).toContain('Monnaie du salaire (non renseignée au contrat)');
  });

  it('une rémunération sans périodicité ne s’imprime pas comme un salaire', () => {
    const f = formulaireMouvement(employeur, salarie, { ...contrat, periodiciteRemuneration: null }, 'EMBAUCHE');
    expect(f.manquants).toContain('Salaire');
  });

  it('exemplaires de l’arrêté du 24 février 2023 (art. 2 et 4) et dérogation des journaliers de l’arrêté n° 006 (art. 4)', () => {
    expect(EXEMPLAIRES_MOUVEMENT).toContain("Direction de l'Emploi du Secrétariat général de l'Emploi et du Travail (deux exemplaires)");
    expect(EXEMPLAIRES_MOUVEMENT).toContain("Division provinciale de l'Emploi et du Travail (deux exemplaires)");
    expect(EXEMPLAIRES_MOUVEMENT).toContain("Direction provinciale de l'Office national de l'emploi (un exemplaire)");
    expect(EXEMPLAIRES_MOUVEMENT).toContain('le quatrième est conservé par le déclarant');
    expect(EXEMPLAIRES_MOUVEMENT).toContain('art. 321');
    expect(DEROGATION_JOUR_LE_JOUR).toContain('vingt-deux journées de travail sur une période de deux mois');
  });
});

describe('la déclaration d’établissement (art. 216 ; arrêté n° 008)', () => {
  it('la quinzaine qui précède · du quinzième jour avant au jour d’avant', () => {
    expect(fenetreDeclarationEtablissement('2026-03-01')).toEqual({ du: '2026-02-14', au: '2026-02-28' });
    expect(fenetreDeclarationEtablissement('2026-02-30')).toBeNull();
    expect(fenetreDeclarationEtablissement('01/03/2026')).toBeNull();
  });

  it('identité du déclarant tirée du dossier, forme à cocher, quatre exemplaires', () => {
    const f = formulaireEtablissement(employeur);
    expect(f.declarant.find((c) => c.libelle === 'Adresse, B.P., téléphone')?.valeur).toBe('Av. du Port 4, Kinshasa');
    expect(f.manquants).toEqual(['Forme du déclarant · à cocher sur le formulaire']);
    expect(EXEMPLAIRES_ETABLISSEMENT).toContain('087/02/2023 du 24 février 2023');
    expect(EXEMPLAIRES_ETABLISSEMENT).toContain('art. 2 et 4');
  });
});

describe('l’arrêté du 24 février 2023 · son modèle annexé n’est pas lu, et c’est dit', () => {
  it('renvoie au formulaire de l’ONEM, sans prétendre le remplir', () => {
    expect(FORMULAIRE_2023_NON_LU).toContain('Direction provinciale de l\'ONEM (art. 4 et 5)');
    expect(FORMULAIRE_2023_NON_LU).toContain('ce modèle n\'a pas été lu');
  });
});
