import * as ExcelJS from 'exceljs';
import { ficheIndividuelle, type BulletinPourFiche } from './fiche-individuelle';
import { classeurFicheIndividuelle } from './fiche-individuelle-excel';
import { FORMAT_MONTANT_FPM } from '../exports/presentation-fpm';

/**
 * LIGNE PAIE-SUITE, FONCTION 89 · la fiche individuelle. Ce qui casserait en
 * silence · un bulletin annulé additionné, un mois d'une autre année compté,
 * une rubrique éclatée par ses libellés libres, un bulletin en dollars lu sans
 * ses francs figés (cumul à zéro), un centime perdu dans le cumul, un classeur
 * dont les montants ne sont pas ceux du moteur.
 */
const b = (numero: number, mois: string, statut: 'EMIS' | 'ANNULE', elements: unknown[], extra: Partial<BulletinPourFiche> = {}): BulletinPourFiche => ({
  numero,
  moisDePaie: mois,
  nature: 'MOIS',
  statut,
  totalVerseFc: 500_000,
  assietteSocialeFc: 450_000,
  cotisationsTravailleurFc: 22_500,
  cotisationsEmployeurFc: 58_500,
  irppFc: 31_000.33,
  netAPayerFc: 446_499.67,
  entree: { elements },
  calcul: { retenuesAvances: [{ montantFc: 10_000 }] },
  ...extra,
});
const salaire = (m: number) => ({ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire de base', montantFc: m });

describe('fiche individuelle · le moteur', () => {
  const rubriques = new Map([['r1', { code: 'PRIM01', libelle: 'Prime de rendement' }]]);
  const fiche = ficheIndividuelle(
    2026,
    [
      b(1, '2026-01', 'EMIS', [salaire(450_000), { nature: 'PRIME', libelle: 'Prime de janvier', montantFc: 50_000, rubriqueId: 'r1' }]),
      b(2, '2026-02', 'ANNULE', [salaire(999_999)]),
      b(3, '2026-02', 'EMIS', [salaire(450_000), { nature: 'PRIME', libelle: 'Prime de février', montantFc: 50_000, rubriqueId: 'r1' }]),
      b(4, '2025-12', 'EMIS', [salaire(1)]),
      // Stipulé en dollars · ses francs sont les éléments convertis et figés, par rang.
      b(5, '2026-03', 'EMIS', [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire USD', montantUsd: 200 }], {
        calcul: { conversion: { elements: [{ montantFc: 560_000.5 }] } },
      }),
      b(6, '2026-04', 'EMIS', [{ nature: 'PRIME', libelle: 'illisible' }]),
    ],
    rubriques,
  );

  it("seuls les bulletins émis de l'année comptent · l'annulé est nommé à part", () => {
    expect(fiche.mois.map((m) => m.mois)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(fiche.annules).toEqual([{ numero: 2, moisDePaie: '2026-02' }]);
    expect(fiche.cumul.brut).toBe(2_000_000);
    expect(fiche.cumul.irpp).toBe(124_001.32);
    // Le bulletin n° 5 ne porte aucune retenue d'avance · trois fois 10 000.
    expect(fiche.cumul.retenuesAvances).toBe(30_000);
  });

  it('une rubrique du cabinet se cumule par son code, un élément sans rubrique par sa nature', () => {
    const prime = fiche.rubriques.find((r) => r.code === 'PRIM01');
    expect(prime).toMatchObject({ libelle: 'Prime de rendement', total: 100_000, parMois: { '2026-01': 50_000, '2026-02': 50_000 } });
    const salaires = fiche.rubriques.filter((r) => r.nature === 'SALAIRE_OU_TRAITEMENT');
    expect(salaires).toHaveLength(1);
    // Le dollar se lit en francs figés · jamais zéro.
    expect(salaires[0].total).toBe(1_460_000.5);
  });

  it('un bulletin illisible ne nourrit aucune rubrique, et c’est dit · ses totaux restent comptés', () => {
    expect(fiche.illisibles).toEqual([6]);
    expect(fiche.mois.find((m) => m.mois === '2026-04')?.totaux.brut).toBe(500_000);
  });

  it('le classeur porte les montants du moteur, au format des éditions du cabinet', async () => {
    const buffer = await classeurFicheIndividuelle(fiche, { entite: 'ASBL Test', nif: 'A123', salarie: 'KABILA Jean', matricule: '007' });
    const relu = new ExcelJS.Workbook();
    await relu.xlsx.load(buffer as unknown as ArrayBuffer);
    const f1 = relu.getWorksheet('Fiche')!;
    const valeurs: unknown[][] = [];
    f1.eachRow((r) => valeurs.push((r.values as unknown[]).slice(1)));
    const total = valeurs.find((v) => v[0] === 'Total de l’année')!;
    expect(total[2]).toBe(2_000_000);
    expect(valeurs.some((v) => String(v[0]).includes('annulés, hors cumul'))).toBe(true);
    // Le lecteur d'ExcelJS retire la barre qui échappe l'espace insécable (CLAUDE.md, ligne FPM).
    expect(f1.getColumn(3).numFmt).toBe(FORMAT_MONTANT_FPM.replace('\\', ''));
    const f2 = relu.getWorksheet('Cumuls par rubrique')!;
    const lignes: unknown[][] = [];
    f2.eachRow((r) => lignes.push((r.values as unknown[]).slice(1)));
    const prime = lignes.find((v) => v[0] === 'PRIM01 · Prime de rendement')!;
    expect(prime[14]).toBe(100_000);
    // Un zéro se rend par une cellule vide.
    expect(prime[5]).toBeUndefined();
  });
});
