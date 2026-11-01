import * as ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICLE_23,
  RESERVE_DECLARATION_CNSS,
  declarationCnss,
  echeanceDeclaration,
  lignesCnssDuBulletin,
  type BulletinDeclare,
} from './declaration-cnss';
import { classeurDeclarationCnss } from './declaration-cnss-excel';
import { FORMAT_MONTANT_FPM } from '../exports/presentation-fpm';

/**
 * LIGNE PAIE-DECLARATIONS, POINT 1 · la déclaration CNSS se PRÉPARE depuis
 * les bulletins FIGÉS, ses énonciations sont celles de l'arrêté n° 146/2018,
 * art. 23, et ce qui manque se nomme.
 */
const calcul = (base: number, apprenti = false) => ({
  cotisations: {
    lignes: [
      ...(apprenti
        ? []
        : [
            { cle: 'cnss-pf', organisme: 'CNSS', charge: 'EMPLOYEUR', assietteFc: base, montantFc: Math.round(base * 6.5) / 100 },
            { cle: 'cnss-pension-employeur', organisme: 'CNSS', charge: 'EMPLOYEUR', assietteFc: base, montantFc: base * 0.05 },
            { cle: 'cnss-pension-travailleur', organisme: 'CNSS', charge: 'TRAVAILLEUR', assietteFc: base, montantFc: base * 0.05 },
          ]),
      { cle: 'cnss-rp', organisme: 'CNSS', charge: 'EMPLOYEUR', assietteFc: base, montantFc: Math.round(base * 1.5) / 100 },
      // L'INPP n'est pas la CNSS · jamais lu par la déclaration.
      { cle: 'inpp', organisme: 'INPP', charge: 'EMPLOYEUR', assietteFc: base, montantFc: base * 0.035 },
    ],
  },
});

const bulletin = (numero: number, base: number, verse: number, enfants: number | null, immat: string | null = `CNSS-${numero}`): BulletinDeclare => ({
  numero,
  nature: 'MOIS',
  nomComplet: `Salarié ${numero}`,
  matricule: `M${numero}`,
  emploi: 'Comptable',
  categorieProfessionnelle: 'Employé',
  numeroAffiliationCnss: immat,
  totalVerseFc: verse,
  entree: enfants === null ? {} : { enfantsBeneficiairesAllocations: enfants },
  calcul: calcul(base),
});

const EMPLOYEUR = { nom: 'ASBL Essai', numeroAffiliationCnssEmployeur: 'AFF-001', adresse: '12, avenue X', ville: 'Kinshasa' };

describe('déclaration CNSS préparée (arrêté n° 146/2018, art. 21 à 28)', () => {
  it('reprend les dix énonciations de l’art. 23, dans l’ordre du texte', () => {
    const d = declarationCnss({ mois: '2026-03', employeur: EMPLOYEUR, bulletins: [bulletin(1, 1_000_000, 1_200_000, 2)], travailleursAuDernierJour: 1 });
    expect(d.enonciations.map((e) => e.rang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.enonciations.map((e) => e.libelle)).toEqual(ARTICLE_23);
    expect(ARTICLE_23[5]).toBe('montant total des sommes payées aux travailleurs qui sont prises en considération pour le calcul des cotisations');
    expect(d.reserve).toBe(RESERVE_DECLARATION_CNSS);
    expect(d.reserve).toContain("ce n'est pas l'imprimé de la Caisse");
  });

  it('chiffre sur les bulletins figés, jamais un recalcul · total versé, base, branches', () => {
    const d = declarationCnss({
      mois: '2026-03',
      employeur: EMPLOYEUR,
      bulletins: [bulletin(1, 1_000_000, 1_200_000, 2), bulletin(2, 600_000.5, 650_000, 1)],
      travailleursAuDernierJour: 2,
    });
    const v = (rang: number) => d.enonciations.find((e) => e.rang === rang)!.valeur;
    expect(v(5)).toBe(1_850_000);
    expect(v(6)).toBe(1_600_000.5);
    // 6,5 % + 5 % + 5 % + 1,5 % = 18 % de la base, au centime de chaque ligne figée.
    const branches = Object.fromEntries(d.branches.map((b) => [b.cle, b.montantFc]));
    expect(branches['cnss-pension-travailleur']).toBe(80_000.03);
    expect(v(7)).toBe(d.totalCotisationsFc);
    expect(d.totalCotisationsFc).toBe(
      Math.round(d.branches.reduce((t, b) => t + Math.round((b.montantFc ?? 0) * 100), 0)) / 100,
    );
    expect(v(9)).toBe(3);
    expect(v(10)).toBeNull();
    expect(d.manques).toEqual([]);
  });

  it('l’INPP ne fait pas partie de la déclaration CNSS', () => {
    const lignes = lignesCnssDuBulletin(calcul(100_000));
    expect(lignes!.map((l) => l.cle)).not.toContain('inpp');
  });

  it('un bulletin illisible rend les totaux NULL et se nomme · jamais un total amputé', () => {
    const illisible: BulletinDeclare = { ...bulletin(3, 0, 500_000, 0), calcul: { cotisations: {} } };
    const d = declarationCnss({ mois: '2026-03', employeur: EMPLOYEUR, bulletins: [bulletin(1, 1_000_000, 1_200_000, 2), illisible], travailleursAuDernierJour: 2 });
    expect(d.totalCotisationsFc).toBeNull();
    expect(d.enonciations.find((e) => e.rang === 5)!.valeur).toBeNull();
    expect(d.enonciations.find((e) => e.rang === 6)!.manque).toContain('ne se lit pas');
    expect(d.manques.join(' ')).toContain('Bulletin n° 3');
  });

  it('une cotisation CNSS en abstention rend NULS la base et les cotisations, jamais un total minoré', () => {
    const enAbstention: BulletinDeclare = {
      ...bulletin(4, 0, 300_000, 0),
      calcul: { cotisations: { lignes: [], abstentions: ['CNSS · aucun barème lu pour le mois 2018-01.'] } },
    };
    const d = declarationCnss({ mois: '2026-03', employeur: EMPLOYEUR, bulletins: [bulletin(1, 1_000_000, 1_200_000, 2), enAbstention], travailleursAuDernierJour: 2 });
    const e = (rang: number) => d.enonciations.find((x) => x.rang === rang)!;
    expect(e(5).valeur).toBe(1_500_000);
    expect(e(6).valeur).toBeNull();
    expect(e(7).valeur).toBeNull();
    expect(e(7).manque).toContain('s’abstient sur la CNSS');
    expect(d.branches.every((b) => b.montantFc === null)).toBe(true);
    expect(d.manques.join(' ')).toContain('Bulletin n° 4');
  });

  it('ce que le registre ne tient pas est NOMMÉ · affiliation, adresse, immatriculation, enfants', () => {
    const d = declarationCnss({
      mois: '2026-03',
      employeur: { nom: 'X', numeroAffiliationCnssEmployeur: null, adresse: null, ville: null },
      bulletins: [bulletin(1, 1_000_000, 1_200_000, null, null)],
      travailleursAuDernierJour: null,
    });
    const e = (rang: number) => d.enonciations.find((x) => x.rang === rang)!;
    expect(e(2).valeur).toBeNull();
    expect(e(2).manque).toContain('Paramètres du dossier');
    expect(e(3).valeur).toBeNull();
    expect(e(8).valeur).toBeNull();
    // Les enfants ne sont jamais présumés à zéro.
    expect(e(9).valeur).toBeNull();
    expect(d.manques.join(' ')).toContain("numéro d'immatriculation");
    expect(d.manques.join(' ')).toContain('Enfants bénéficiaires');
  });

  it('un mois sans bulletin émis le dit, avec l’art. 26', () => {
    const d = declarationCnss({ mois: '2026-04', employeur: EMPLOYEUR, bulletins: [], travailleursAuDernierJour: 0 });
    expect(d.aucunBulletin).toContain('Aucun bulletin émis pour 2026-04');
    expect(d.aucunBulletin).toContain('art. 26');
  });

  it('l’échéance est le quinze du mois suivant (art. 21 et 31), décembre passant à janvier, rien reporté', () => {
    expect(echeanceDeclaration('2026-03')).toEqual({ dateLimite: '2026-04-15', regularisationAvant: '2026-04-20' });
    expect(echeanceDeclaration('2026-12')).toEqual({ dateLimite: '2027-01-15', regularisationAvant: '2027-01-20' });
  });

  it('au-delà de vingt-cinq bulletins, la télédéclaration de l’art. 24 se dit', () => {
    const bs = Array.from({ length: 26 }, (_, i) => bulletin(i + 1, 100_000, 100_000, 0));
    const d = declarationCnss({ mois: '2026-03', employeur: EMPLOYEUR, bulletins: bs, travailleursAuDernierJour: 26 });
    expect(d.reserves.join(' ')).toContain('art. 24, al. 2');
  });

  it('le classeur se relit · énonciations, bulletins, manques ; un total non chiffré est une cellule vide', async () => {
    const d = declarationCnss({ mois: '2026-03', employeur: EMPLOYEUR, bulletins: [bulletin(1, 1_000_000, 1_200_000, 2)], travailleursAuDernierJour: 1 });
    const buffer = await classeurDeclarationCnss(d, new Date('2026-04-01T10:00:00Z'));
    const c = new ExcelJS.Workbook();
    await c.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(c.worksheets.map((f) => f.name)).toEqual(['Déclaration', 'Bulletins', 'Manques et réserves']);
    const f1 = c.getWorksheet('Déclaration')!;
    const valeurs: unknown[] = [];
    f1.eachRow((r) => valeurs.push(r.getCell(3).value));
    expect(valeurs).toContain(1_200_000);
    expect(valeurs).toContain(1_000_000);
    const f2 = c.getWorksheet('Bulletins')!;
    let trouve = false;
    f2.eachRow((r) => {
      if (r.getCell(1).value === 1) {
        trouve = true;
        expect(r.getCell(5).value).toBe('CNSS-1');
        expect(r.getCell(12).value).toBe(50_000);
        // Le lecteur d'ExcelJS retire la barre du format FPM (CLAUDE.md, ligne FPM).
        expect(r.getCell(12).numFmt).toBe(FORMAT_MONTANT_FPM.replace('\\', ''));
      }
    });
    expect(trouve).toBe(true);
  });

  it('le service lit les bulletins ÉMIS du mois et refuse au-delà du plafond plutôt que d’amputer', () => {
    const source = readFileSync(join(__dirname, 'declaration-cnss.service.ts'), 'utf8');
    expect(source).toContain('statut: StatutBulletinPaie.EMIS');
    expect(source).toContain('if (total > PLAFOND_BULLETINS_DECLARATION)');
  });
});
