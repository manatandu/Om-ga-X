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
    expect(lu.illisibles[0].message).toMatch(/même date, la même date de valeur, le même journal ou la même pièce/);
  });

  it('lit la date de valeur et le code du taux de TVA de chaque ligne (relecture M2 et M3)', async () => {
    const valeur = new Date('2027-02-27T00:00:00Z');
    const lu = await lireEnvoi(
      await envoi({
        lignes: [
          ligne(ID_A, '60110000', 100000, 0, { jourValeur: valeur }),
          ligne(ID_A, '44520000', 16000, 0, { jourValeur: valeur, codeTaxe: 'tva16' }),
          ligne(ID_A, '40110000', 0, 116000, { jourValeur: valeur }),
        ],
      }),
    );
    expect(lu.ecritures[0].dateValeur).toEqual(valeur);
    expect(lu.ecritures[0].lignes.map((l) => l.codeTaxe)).toEqual(['', 'TVA16', '']);
  });

  it("une ligne sans identifiant d'origine se nomme et n'est pas lue", async () => {
    const lu = await lireEnvoi(await envoi({ lignes: [ligne('', '62210000', 500, 0)] }));
    expect(lu.ecritures).toEqual([]);
    expect(lu.illisibles[0].message).toMatch(/Identifiant d'origine absent/);
  });
});

describe("l'empreinte du contenu reçu", () => {
  const base = { date: new Date('2027-03-04T00:00:00Z'), dateValeur: null, journal: 'OD', reference: 'F-12' };
  const l1 = { compte: '62210000', libelle: 'Loyer', debit: 500000, credit: 0, devise: '', montantDevise: '', cours: '', echeance: null, codeTaxe: '' };
  const l2 = { compte: '40110000', libelle: 'Loyer', debit: 0, credit: 500000, devise: '', montantDevise: '', cours: '', echeance: null, codeTaxe: '' };

  it("ne dépend pas de l'ordre des lignes", () => {
    expect(empreinteRecue({ ...base, lignes: [l1, l2] })).toBe(empreinteRecue({ ...base, lignes: [l2, l1] }));
  });

  it('change avec un montant, un compte ou la date', () => {
    const a = empreinteRecue({ ...base, lignes: [l1, l2] });
    expect(empreinteRecue({ ...base, lignes: [{ ...l1, debit: 500001 }, l2] })).not.toBe(a);
    expect(empreinteRecue({ ...base, lignes: [{ ...l1, compte: '62200000' }, l2] })).not.toBe(a);
    expect(empreinteRecue({ ...base, date: new Date('2027-03-05T00:00:00Z'), lignes: [l1, l2] })).not.toBe(a);
  });

  it('change avec la date de valeur et le taux de TVA (relecture M2 et M3) · un remplacement les porte', () => {
    const a = empreinteRecue({ ...base, lignes: [l1, l2] });
    expect(empreinteRecue({ ...base, dateValeur: new Date('2027-02-27T00:00:00Z'), lignes: [l1, l2] })).not.toBe(a);
    expect(empreinteRecue({ ...base, lignes: [{ ...l1, codeTaxe: 'TVA16' }, l2] })).not.toBe(a);
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

  it('RELIRE LE MÊME FICHIER (relecture B1) · le reçu reste, le refusé revient, l’interrompu se reprend', () => {
    // Reçue par cet envoi même · « déjà reçue par cet envoi », jamais « plus récent » (m2).
    const recue = decisionPour(tenue, 'X', 2, 'Nouvelle');
    expect(recue).toMatchObject({ action: 'LAISSER', refus: false });
    expect((recue as { motif: string }).motif).toMatch(/par cet envoi \(n° 2\)/);
    expect((recue as { motif: string }).motif).not.toMatch(/plus récent/);
    // Refusée à la première lecture (journal absent) · aucune entrée, elle naît.
    expect(decisionPour(undefined, 'X', 2, 'Nouvelle')).toMatchObject({ action: 'CREER' });
    // Interrompue par le même envoi · reprise par sa relecture.
    expect(decisionPour({ ...tenue, ecritureId: null }, 'Y', 2, 'Nouvelle')).toMatchObject({ action: 'CREER' });
    // Un envoi plus ancien ne reprend rien.
    expect(decisionPour({ ...tenue, ecritureId: null }, 'Y', 1, 'Nouvelle')).toMatchObject({ action: 'LAISSER' });
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
  it('un fichier déjà reçu se RELIT (B1) · seule une réception en cours sur un autre poste refuse', () => {
    expect(service).not.toMatch(/rien n'est relu/);
    expect(service).toMatch(/existante\?\.etat === EtatReceptionEchange\.EN_COURS && Date\.now\(\)/);
    // La reprise est prise par un seul poste · filtrée sur l'état et l'instant lus (m2).
    expect(service).toMatch(/updateMany\(\{\s*where: \{ id: existante\.id, tenantId, etat: existante\.etat, recuLe: existante\.recuLe \}/);
  });

  it('le retrait et la recréation d’un remplacement passent dans UNE transaction (M1)', () => {
    const corps = service.slice(service.indexOf('  private async remplacer('), service.indexOf('  private versLigne('));
    expect(corps).toMatch(/liberer: async \(tx\) => \{\s*const \[ecrite\] = await this\.ecrireLesPieces\(tx,/);
    expect(corps).not.toMatch(/this\.creerLesPieces\(/);
  });

  it('la date de valeur et le taux sont posés, à la création comme au remplacement (M2, M3)', () => {
    expect(service).toMatch(/dateValeur: p\.source\.dateValeur,\s*libelle: p\.libelle/);
    expect(service).toMatch(/\.\.\.\(l\.tauxTvaId \? \{ tauxTvaId: l\.tauxTvaId \} : \{\}\)/);
    expect(service).toMatch(/tauxTvaId: l\.tauxTvaId,\s*\};/);
  });

  it('le détail d’une panne ne va pas au compte rendu (m6)', () => {
    const corps = service.slice(service.indexOf('  private motifDeLEchec('));
    expect(corps).not.toMatch(/return `[^`]*\$\{message\(e\)\}/);
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

describe('le taux de TVA voyage par son code (relecture M3)', () => {
  // `juger` est la règle de chaque pièce · éprouvée seule, la base hors du jeu.
  const { EchangeEcrituresService } = jest.requireActual('./echange-ecritures.service');
  const service = new EchangeEcrituresService({} as never, { controlesDEntree: jest.fn().mockResolvedValue({}) } as never);
  const ctx = (taux: Array<{ id: string; code: string; estActif: boolean }>) => ({
    exercices: [{ id: 'ex', dateDebut: new Date('2027-01-01T00:00:00Z'), dateFin: new Date('2027-12-31T00:00:00Z'), statut: 'OUVERT' }],
    journauxParCode: new Map([['HA', { id: 'j', code: 'HA' }]]),
    comptesParNumero: new Map(
      ['60110000', '44520000', '40110000'].map((n) => [n, { id: `c${n}`, numero: n, typeCompte: 'DETAIL' }]),
    ),
    devisesParCode: new Map(),
    tauxParCode: new Map(taux.map((t) => [t.code, t])),
    memoire: new Map(),
  });
  const lignes = (codeTaxe: string) => [
    { compte: '60110000', libelle: 'Achat', debit: 100000, credit: 0, devise: '', montantDevise: '', cours: '', echeance: null, codeTaxe: '' },
    { compte: '44520000', libelle: 'TVA', debit: 16000, credit: 0, devise: '', montantDevise: '', cours: '', echeance: null, codeTaxe },
    { compte: '40110000', libelle: 'Fournisseur', debit: 0, credit: 116000, devise: '', montantDevise: '', cours: '', echeance: null, codeTaxe: '' },
  ];
  const ecriture = (codeTaxe: string) => ({
    identifiant: ID_A, date: new Date('2027-03-04T00:00:00Z'), dateValeur: null, journal: 'HA', piece: '1', reference: null,
    statut: 'Brouillard', mouvement: 'Nouvelle', rang: 2, lignes: lignes(codeTaxe),
  });

  it('résolu dans le dossier qui reçoit, posé sur la ligne de taxe', async () => {
    const r = await service.juger('t', ecriture('TVA16'), ctx([{ id: 'tva16', code: 'TVA16', estActif: true }]));
    expect(r.lignes.find((l: { compteId: string }) => l.compteId === 'c44520000').tauxTvaId).toBe('tva16');
    expect(r.avertissements).toEqual([]);
  });

  it('un code que le dossier n’a pas refuse la pièce, en le nommant', async () => {
    expect(await service.juger('t', ecriture('TVA16'), ctx([]))).toMatch(/« TVA16 » .* n'existe pas dans ce dossier/);
  });

  it('une ligne 445 reçue sans taux passe, NOMMÉE · la déclaration ne la lirait pas', async () => {
    const r = await service.juger('t', ecriture(''), ctx([]));
    expect(r.avertissements).toEqual([expect.stringMatching(/44520000 est reçue sans taux de TVA · la déclaration de TVA ne la lit pas/)]);
  });
});
