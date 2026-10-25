// Aucun import de « vitest » · les globales servent jest (racine) et vitest (client), convention du dépôt.
import { corpsDesLignes, ligneVierge, partProposee, totalLigneCentimes } from './bon-commande';
import { coupuresAEnvoyer, grilleProposee, totalCoupuresCentimes } from './arrete-caisse';
import { LIBELLES_ETAT_CHEQUE } from './cheques-emis';

/** Ligne microfina-m2 · les saisies de l'écran · vide n'est pas zéro, le serveur juge seul. */
describe('bon de commande · saisie', () => {
  it("refuse une ligne sans ligne budgétaire ou au prix illisible, admet une taxe vide (zéro, facultative)", () => {
    expect(corpsDesLignes([{ ...ligneVierge(), designation: 'Cahiers', prixUnitaire: '100' }])).toEqual({ motif: expect.stringMatching(/ligne budgétaire/) });
    expect(corpsDesLignes([{ ...ligneVierge(), designation: 'Cahiers', sectionId: 's', prixUnitaire: '' }])).toEqual({ motif: expect.stringMatching(/prix unitaire/) });
    expect(corpsDesLignes([{ ...ligneVierge(), designation: 'Cahiers', sectionId: 's', prixUnitaire: '1 000,50', quantite: '2' }])).toEqual({
      lignes: [{ designation: 'Cahiers', quantite: 2, prixUnitaire: 1000.5, sectionId: 's' }],
    });
  });

  it('le total indicatif est en centimes, null tant qu’un champ est illisible', () => {
    expect(totalLigneCentimes({ ...ligneVierge(), quantite: '3', prixUnitaire: '0,1', montantTva: '' })).toBe(30);
    expect(totalLigneCentimes({ ...ligneVierge(), prixUnitaire: 'abc' })).toBeNull();
  });

  it('la part d’une facture ne se propose que sur un bon à une seule ligne budgétaire', () => {
    expect(partProposee([{ resteAFacturer: 500 }], 300)).toBe(300);
    expect(partProposee([{ resteAFacturer: 500 }, { resteAFacturer: 10 }], 300)).toBeNull();
    expect(partProposee([{ resteAFacturer: 0 }], 300)).toBeNull();
  });
});

describe('arrêté de caisse · coupures', () => {
  it('propose les valeurs du dernier arrêté, nombres vides, et une ligne vide sinon', () => {
    expect(grilleProposee([5000, 500])).toEqual([{ valeur: '5000', nombre: '' }, { valeur: '500', nombre: '' }]);
    expect(grilleProposee([])).toEqual([{ valeur: '', nombre: '' }]);
  });

  it('ignore les lignes vides, refuse un nombre fractionnaire, totalise en centimes', () => {
    expect(coupuresAEnvoyer([{ valeur: '', nombre: '' }, { valeur: '500', nombre: '3' }])).toEqual({ coupures: [{ valeurUnitaire: 500, nombre: 3 }] });
    expect(coupuresAEnvoyer([{ valeur: '500', nombre: '1,5' }])).toEqual({ motif: expect.stringMatching(/entier/) });
    expect(totalCoupuresCentimes([{ valeur: '0,5', nombre: '3' }])).toBe(150);
  });
});

describe('chèques émis · états', () => {
  it("chaque état lu a son libellé · « encaissé » n'est jamais un choix", () => {
    expect(Object.keys(LIBELLES_ETAT_CHEQUE).sort()).toEqual(['ANNULE', 'EMIS_SANS_PIECE', 'ENCAISSE', 'EN_CIRCULATION']);
  });
});
