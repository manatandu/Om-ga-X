import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ELEMENTS_TVA_NON_DEDUCTIBLE_ART_41,
  motifRefusForfaitAuMois,
  motifRefusFrais,
  motifRefusMission,
  sortDuFrais,
  totauxMission,
} from './missions-salarie';
import { NOMENCLATURE_PAIE, passationPaie } from './passation-paie';
import { assiettes } from './assiettes-paie';

/**
 * LIGNE MICROFINA-M3, IDÉE 3 · missions et frais de mission. Ce qui casserait
 * en silence · un forfait sorti de l'impôt, un remboursement sans pièce lu
 * comme dépense effective, une indemnité de mission qui ferait refuser toute
 * la paie du mois faute de compte, ou passée ailleurs qu'au 6384.
 */
describe('Mission · les refus', () => {
  it('objet, destination et dates', () => {
    expect(motifRefusMission({ objet: '', destination: 'Goma', dateDepart: '2026-12-01', dateRetour: '2026-12-05' })).toMatch(/objet/);
    expect(motifRefusMission({ objet: 'Atelier', destination: '', dateDepart: '2026-12-01', dateRetour: '2026-12-05' })).toMatch(/destination/);
    expect(motifRefusMission({ objet: 'Atelier', destination: 'Goma', dateDepart: '2026-12-05', dateRetour: '2026-12-01' })).toMatch(/précéder/);
    expect(motifRefusMission({ objet: 'Atelier', destination: 'Goma', dateDepart: '2026-12-01', dateRetour: '2026-12-01' })).toBeNull();
  });

  it("un remboursement exige sa pièce (art. 68, 1° · l'effectivité se prouve)", () => {
    expect(motifRefusFrais({ element: 'HEBERGEMENT', qualification: 'JUSTIFIE', montantFc: 90_000 })).toMatch(/art\. 68, 1°/);
    expect(motifRefusFrais({ element: 'HEBERGEMENT', qualification: 'JUSTIFIE', montantFc: 90_000, piece: 'Facture hôtel 12' })).toBeNull();
    expect(motifRefusFrais({ element: 'RESTAURATION', qualification: 'FORFAIT', montantFc: 30_000 })).toBeNull();
    expect(motifRefusFrais({ element: 'TRANSPORT', qualification: 'REGLE_PAR_ENTITE', montantFc: 300_000 })).toMatch(/facture/);
  });

  it("le forfait ne se porte pas avant le départ, ni sur une mission annulée", () => {
    const m = { numero: 4, dateDepart: '2026-12-28', annuleLe: null, aPorterFc: 10 };
    expect(motifRefusForfaitAuMois(m, '2026-11')).toMatch(/part le 2026-12-28/);
    expect(motifRefusForfaitAuMois(m, '2026-12')).toBeNull();
    expect(motifRefusForfaitAuMois({ ...m, annuleLe: new Date() }, '2027-01')).toMatch(/annulée/);
    expect(motifRefusForfaitAuMois({ ...m, aPorterFc: 0 }, '2027-01')).toMatch(/aucun frais/);
  });
});

describe('Mission · les totaux et le sort des frais', () => {
  const frais = [
    { element: 'HEBERGEMENT' as const, qualification: 'JUSTIFIE' as const, montantFc: 90_000.1 },
    { element: 'RESTAURATION' as const, qualification: 'FORFAIT' as const, montantFc: 30_000.2 },
    { element: 'TRANSPORT' as const, qualification: 'REGLE_PAR_ENTITE' as const, montantFc: 300_000 },
  ];
  it('trois totaux au centime, le coût compris ce que l’entité a réglé', () => {
    expect(totauxMission(frais)).toEqual({ justifieFc: 90_000.1, forfaitFc: 30_000.2, regleParEntiteFc: 300_000, totalFc: 420_000.3 });
  });
  it("hébergement, restauration et transport · TVA non déductible (O.-L. n° 10/001, art. 41, 1°)", () => {
    expect(ELEMENTS_TVA_NON_DEDUCTIBLE_ART_41).toEqual(['HEBERGEMENT', 'RESTAURATION', 'TRANSPORT']);
    expect(sortDuFrais(frais[0])).toMatch(/art\. 41, 1°/);
    expect(sortDuFrais({ element: 'DIVERS', qualification: 'JUSTIFIE', montantFc: 1 })).toMatch(/à la main/);
  });
});

describe('Mission · au bulletin', () => {
  it("le forfait est imposable, le remboursement sur pièce ne l'est pas, ni l'un ni l'autre n'est rémunération", () => {
    const r = assiettes([
      { nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 600_000 },
      { nature: 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION', libelle: 'Forfait', montantFc: 30_000 },
      { nature: 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION', libelle: 'Remboursement', montantFc: 90_000, remboursementDeDepenseProfessionnelleEffective: true },
    ]);
    expect(r.assietteSocialeFc).toBe(600_000);
    expect(r.assietteFiscaleBruteFc).toBe(630_000);
  });

  it('le 6384 est le compte des deux semis, et la mission le donne à la passation', () => {
    const racine = join(__dirname, '..', 'comptes');
    expect(readFileSync(join(racine, 'compte-seed.ts'), 'utf8')).toContain("'63840000', 'Missions'");
    expect(readFileSync(join(racine, 'compte-seed-syscohada.ts'), 'utf8')).toContain("'63840000', 'Missions'");
    const entree = {
      referentiel: 'SYCEBNL' as const,
      elements: [
        { nature: 'SALAIRE_OU_TRAITEMENT' as const, libelle: 'Salaire', montantFc: 600_000 },
        { nature: 'FRAIS_DE_VOYAGE_OU_AVANTAGE_DE_FONCTION' as const, libelle: 'Forfait n° 1', montantFc: 30_000, missionId: 'm1' },
      ],
      cotisations: [],
      abstentionsCotisations: [],
      irppFc: 0,
      netAPayerFc: 630_000,
    };
    const p = passationPaie(entree);
    expect(p.refus).toEqual([]);
    const ligne = p.lignes.find((l) => l.compte === NOMENCLATURE_PAIE.MISSIONS.SYCEBNL);
    expect(ligne).toMatchObject({ sens: 'DEBIT', montantFc: 30_000 });
    // La même nature sans mission reste refusée · la nature seule ne tranche pas.
    const sans = passationPaie({ ...entree, elements: [entree.elements[0], { ...entree.elements[1], missionId: undefined }] });
    expect(sans.refus.map((r) => r.motif)).toContain('NATURE_SANS_IMPUTATION');
  });
});
