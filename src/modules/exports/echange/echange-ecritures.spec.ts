import * as ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EtatEcritureRecue } from '@prisma/client';
import {
  COLONNES_ECHANGE,
  COLONNES_SUPPRIMEES,
  FEUILLE_ECRITURES,
  FEUILLE_EXPORT,
  FEUILLE_SUPPRIMEES,
} from '../modifications/export-modifications';
import { decisionPour, empreinteRecue, EnvoiIllisible, lireEnvoi, nomDeLaPiece } from './echange-ecritures';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

/** Un envoi écrit comme l'export des modifications l'écrit · mêmes feuilles, mêmes en-têtes. */
async function envoi(options: {
  lignes: Array<Record<string, unknown>>;
  supprimees?: Array<Record<string, unknown>>;
  numero?: number | string;
  sansExport?: boolean;
}): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const f = classeur.addWorksheet(FEUILLE_ECRITURES);
  f.columns = COLONNES_ECHANGE.map((c) => ({ ...c }));
  for (const l of options.lignes) f.addRow(l);
  const s = classeur.addWorksheet(FEUILLE_SUPPRIMEES);
  s.columns = COLONNES_SUPPRIMEES.map((c) => ({ ...c }));
  for (const l of options.supprimees ?? []) s.addRow(l);
  if (!options.sansExport) {
    const r = classeur.addWorksheet(FEUILLE_EXPORT);
    r.columns = [
      { header: 'Rubrique', key: 'rubrique' },
      { header: 'Valeur', key: 'valeur' },
    ];
    r.addRow({ rubrique: 'Dossier', valeur: 'Association des Amis' });
    r.addRow({ rubrique: 'Export n°', valeur: options.numero ?? 3 });
  }
  return Buffer.from(await classeur.xlsx.writeBuffer());
}

const ligne = (identifiant: string, compte: string, debit: number, credit: number, autres: Record<string, unknown> = {}) => ({
  date: new Date('2027-03-04T00:00:00Z'),
  journal: 'OD',
  piece: '7',
  reference: 'F-12',
  compte,
  libelle: 'Loyer de mars',
  debit,
  credit,
  statut: 'Brouillard',
  mouvement: 'Nouvelle',
  identifiant,
  ...autres,
});

describe("l'envoi lu · les trois feuilles de l'export des modifications", () => {
  it("rassemble les lignes par identifiant d'origine et lit le dossier et le numéro", async () => {
    const lu = await lireEnvoi(
      await envoi({
        lignes: [ligne(ID_A, '62210000', 500000, 0), ligne(ID_A, '40110000', 0, 500000), ligne(ID_B, '57110000', 1000, 0, { piece: '8' }), ligne(ID_B, '70110000', 0, 1000, { piece: '8' })],
        supprimees: [{ identifiant: ID_C, date: new Date('2027-02-01T00:00:00Z'), journal: 'OD', piece: '3', libelle: 'Erreur', envoyee: 2 }],
      }),
    );
    expect(lu.dossierSource).toBe('Association des Amis');
    expect(lu.numeroExport).toBe(3);
    expect(lu.ecritures.map((e) => [e.identifiant, e.lignes.length])).toEqual([
      [ID_A, 2],
      [ID_B, 2],
    ]);
    expect(lu.ecritures[0].date.toISOString().slice(0, 10)).toBe('2027-03-04');
    expect(lu.ecritures[0].lignes[0]).toMatchObject({ compte: '62210000', debit: 500000, credit: 0 });
    expect(lu.suppressions).toEqual([{ identifiant: ID_C, date: new Date('2027-02-01T00:00:00Z'), journal: 'OD', piece: '3', libelle: 'Erreur' }]);
    expect(lu.illisibles).toEqual([]);
  });

  it("refuse entier un classeur sans la feuille « Export » · ce n'est pas un envoi d'OmegaX", async () => {
    await expect(lireEnvoi(await envoi({ lignes: [ligne(ID_A, '62210000', 1, 0)], sansExport: true }))).rejects.toThrow(EnvoiIllisible);
  });

  it('refuse entier un envoi sans numéro lisible', async () => {
    await expect(lireEnvoi(await envoi({ lignes: [], numero: 'trois' }))).rejects.toThrow(/numéro de l'envoi/);
  });

  it("n'emporte pas une écriture dont deux lignes ne portent pas la même pièce · nommée, jamais à moitié", async () => {
    const lu = await lireEnvoi(await envoi({ lignes: [ligne(ID_A, '62210000', 500, 0), ligne(ID_A, '40110000', 0, 500, { piece: '9' }), ligne(ID_A, '40110000', 0, 1)] }));
    expect(lu.ecritures).toEqual([]);
    expect(lu.illisibles).toHaveLength(1);
    expect(lu.illisibles[0].message).toMatch(/même date, le même journal ou la même pièce/);
  });

  it("une ligne sans identifiant d'origine se nomme et n'est pas lue", async () => {
    const lu = await lireEnvoi(await envoi({ lignes: [ligne('', '62210000', 500, 0)] }));
    expect(lu.ecritures).toEqual([]);
    expect(lu.illisibles[0].message).toMatch(/Identifiant d'origine absent/);
  });
});

describe("l'empreinte du contenu reçu", () => {
  const base = { date: new Date('2027-03-04T00:00:00Z'), journal: 'OD', reference: 'F-12' };
  const l1 = { compte: '62210000', libelle: 'Loyer', debit: 500000, credit: 0, devise: '', montantDevise: '', cours: '', echeance: null };
  const l2 = { compte: '40110000', libelle: 'Loyer', debit: 0, credit: 500000, devise: '', montantDevise: '', cours: '', echeance: null };

  it("ne dépend pas de l'ordre des lignes", () => {
    expect(empreinteRecue({ ...base, lignes: [l1, l2] })).toBe(empreinteRecue({ ...base, lignes: [l2, l1] }));
  });

  it('change avec un montant, un compte ou la date', () => {
    const a = empreinteRecue({ ...base, lignes: [l1, l2] });
    expect(empreinteRecue({ ...base, lignes: [{ ...l1, debit: 500001 }, l2] })).not.toBe(a);
    expect(empreinteRecue({ ...base, lignes: [{ ...l1, compte: '62200000' }, l2] })).not.toBe(a);
    expect(empreinteRecue({ ...base, date: new Date('2027-03-05T00:00:00Z'), lignes: [l1, l2] })).not.toBe(a);
  });
});

describe('la table de décision · jamais deux fois la même écriture', () => {
  const tenue = { etat: EtatEcritureRecue.TENUE, ecritureId: 'e1', empreinteSource: 'X', numeroExportSource: 2 };

  it('une écriture jamais reçue naît, quel que soit son mouvement, et le dit si elle se disait déjà envoyée', () => {
    expect(decisionPour(undefined, 'X', 3, 'Nouvelle')).toEqual({ action: 'CREER', note: null });
    expect(decisionPour(undefined, 'X', 3, "Modifiée · remplace l'envoi n° 2")).toMatchObject({ action: 'CREER', note: expect.stringMatching(/jamais reçue/) });
  });

  it('déjà reçue à l’identique · rien', () => {
    expect(decisionPour(tenue, 'X', 3, 'Déjà envoyée au n° 2')).toMatchObject({ action: 'LAISSER', refus: false });
  });

  it('contenu changé · remplacée', () => {
    expect(decisionPour(tenue, 'Y', 3, "Modifiée · remplace l'envoi n° 2")).toEqual({ action: 'REMPLACER' });
  });

  it("un envoi plus ancien que celui qui l'a portée ne la remplace jamais", () => {
    expect(decisionPour(tenue, 'Y', 2, "Modifiée · remplace l'envoi n° 1")).toMatchObject({ action: 'LAISSER', refus: false });
    expect(decisionPour(tenue, 'Y', 1, 'Nouvelle')).toMatchObject({ action: 'LAISSER' });
  });

  it('détachée · la modification de l’expéditeur est nommée, jamais portée', () => {
    expect(decisionPour({ ...tenue, etat: EtatEcritureRecue.DETACHEE, ecritureId: null }, 'Y', 3, 'Modifiée')).toMatchObject({
      action: 'LAISSER',
      refus: true,
    });
  });

  it('retirée par la source · jamais recréée', () => {
    expect(decisionPour({ ...tenue, etat: EtatEcritureRecue.RETIREE_PAR_LA_SOURCE, ecritureId: null }, 'Y', 3, 'Nouvelle')).toMatchObject({
      action: 'LAISSER',
      refus: true,
    });
  });

  it('un remplacement interrompu (tenue sans écriture) se reprend', () => {
    expect(decisionPour({ ...tenue, ecritureId: null }, 'Y', 3, 'Modifiée')).toMatchObject({ action: 'CREER' });
  });
});

describe('le nom d’une pièce et les portes du service', () => {
  it('nomme journal, pièce et date', () => {
    expect(nomDeLaPiece({ journal: 'OD', piece: '7', date: new Date('2027-03-04T00:00:00Z') })).toBe('OD n° 7 du 04/03/2027');
  });

  const service = readFileSync(join(__dirname, 'echange-ecritures.service.ts'), 'utf8');
  it("juge chaque écriture par les contrôles d'entrée de l'import, sans exiger la ventilation", () => {
    expect(service).toMatch(/controlesDEntree\(\s*tenantId,\s*\{[^}]*exigerVentilationObligatoire: false/);
  });
  it('une écriture reçue naît au brouillard · aucun statut posé à la création', () => {
    const corps = service.slice(service.indexOf('tx.ecriture.createMany'), service.indexOf('tx.ligneEcriture.createMany'));
    expect(corps).not.toMatch(/statut/);
  });
  it("refuse le fichier d'un dossier qui s'enverrait à lui-même", () => {
    expect(service).toMatch(/export de CE dossier/);
  });

  it("l'export des modifications ne fait pas repartir une écriture reçue", () => {
    const exp = readFileSync(join(__dirname, '..', 'modifications', 'export-modifications.service.ts'), 'utf8');
    const occurrences = exp.match(/FROM "ecritures_recues" rr/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
