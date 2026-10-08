import { ImportService } from './import.service';
import { EcritureService } from '../comptabilite/ecriture.service';
import { PrismaService } from '../../common/prisma.service';
import { TypeImport } from './dto/import.dto';

/**
 * LIGNE AU3 · UNE BALANCE IMPORTÉE GARDE LA DEVISE DE SES LIGNES.
 *
 * Défaut de production · une balance d'ouverture reprise sans devise faisait
 * de l'ancienne créance de 1 500 USD (3 200 000 FC au cours d'origine) une
 * ligne en francs. La réévaluation de clôture ne lit que les lignes qui
 * portent une devise · la créance restait à 3 200 000 au bilan quand le cours
 * de clôture (2 400) en faisait 3 600 000 (AUDCIF art. 54).
 *
 * Ce que le spec gèle · (1) les colonnes Devise, Montant en devise et Cours
 * sont proposées à l'import d'une balance ; (2) la ligne écrite porte la
 * devise, le montant en devise et le cours (saisi, ou déduit des deux
 * montants, art. 52) ; (3) chaque refus de la saisie vaut ici, ligne par
 * ligne, simulation comprise · monnaie de tenue prise pour devise, devise
 * inconnue du dossier, contrevaleur qui ne tombe pas au centime ; (4) un
 * fichier sans ces colonnes s'importe comme avant.
 */

const COMPTES = [
  { id: 'c411', numero: '41110000', typeCompte: 'DETAIL' },
  { id: 'c401', numero: '40110000', typeCompte: 'DETAIL' },
  { id: 'c521', numero: '52110000', typeCompte: 'DETAIL' },
  { id: 'c101', numero: '10110000', typeCompte: 'DETAIL' },
];
const DEVISES = [
  { id: 'd-usd', code: 'USD' },
  { id: 'd-cdf', code: 'CDF' },
];

function service() {
  const creerEcriture = jest.fn().mockResolvedValue({ id: 'e1' });
  const tx = {
    compte: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue(COMPTES.map((c) => ({ id: c.id, numero: c.numero }))),
    },
    ecriture: { create: creerEcriture },
  };
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't', longueurCompte: 8, referentiel: 'SYSCOHADA' }) },
    exercice: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'ex',
        statut: 'OUVERT',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
      }),
    },
    journal: { findMany: jest.fn().mockResolvedValue([{ id: 'j-od', code: 'OD', type: 'GENERAL' }]) },
    compte: { findMany: jest.fn().mockResolvedValue(COMPTES) },
    devise: { findMany: jest.fn().mockResolvedValue(DEVISES) },
    $transaction: jest.fn().mockImplementation((f: (t: unknown) => unknown) => f(tx)),
  } as unknown as PrismaService;
  const controlesDEntree = jest.fn().mockResolvedValue({});
  const ecritureService = { controlesDEntree } as unknown as EcritureService;
  return { svc: new ImportService(prisma, ecritureService), creerEcriture, controlesDEntree, prisma };
}

const ENTETE = 'numero;intitule;debit;credit;devise;montant en devise;cours';
function fichier(lignes: string[], entete = ENTETE) {
  return Buffer.from([entete, ...lignes].join('\n'), 'utf8').toString('base64');
}
const MAPPING = {
  numero: 'numero',
  intitule: 'intitule',
  debit: 'debit',
  credit: 'credit',
  devise: 'devise',
  montantDevise: 'montant en devise',
  cours: 'cours',
};

async function importer(lignes: string[], simulation = false) {
  const s = service();
  const rapport = await s.svc.executer('t', 'u', {
    type: TypeImport.BALANCE,
    nomFichier: 'balance.csv',
    contenuBase64: fichier(lignes),
    mapping: MAPPING,
    simulation,
  });
  return { ...s, rapport, ecriture: s.creerEcriture.mock.calls[0]?.[0]?.data };
}

describe('Import d’une balance · les lignes en devise (AU3)', () => {
  it('propose les trois colonnes de la devise à l’analyse d’une balance', async () => {
    const { svc } = service();
    const analyse = await svc.analyser({ type: TypeImport.BALANCE, nomFichier: 'b.csv', contenuBase64: fichier([]) });
    expect(analyse.champs.map((c) => c.cle)).toEqual(
      expect.arrayContaining(['devise', 'montantDevise', 'cours']),
    );
    // La colonne « montant en devise » n'est pas prise pour la devise.
    expect(analyse.mappingPropose.devise).toBe('devise');
    expect(analyse.mappingPropose.montantDevise).toBe('montant en devise');
    expect(analyse.mappingPropose.cours).toBe('cours');
  });

  it('LE CAS AU3 · 1 500 USD repris pour 3 200 000 FC, cours déduit (art. 52), la ligne garde sa devise', async () => {
    const { rapport, ecriture, controlesDEntree } = await importer([
      '41110000;Client Kin;3200000;0;USD;1500;',
      '10110000;Capital;0;3200000;;;',
    ]);
    expect(rapport.anomalies).toEqual([]);
    expect(rapport.ecrituresCreees).toBe(1);
    const lignes = ecriture.lignes.createMany.data as Array<Record<string, unknown>>;
    const creance = lignes.find((l) => l.compteId === 'c411')!;
    expect(creance.deviseId).toBe('d-usd');
    expect(creance.montantDevise).toBe(1500);
    // 3 200 000 / 1 500 = 2 133,333333 · à six décimales, comme la colonne.
    expect(creance.coursApplique).toBe(2133.333333);
    // La ligne en francs ne porte rien.
    const capital = lignes.find((l) => l.compteId === 'c101')!;
    expect(capital.deviseId).toBeUndefined();
    // Les contrôles d'entrée reçoivent la devise · la règle de la saisie joue.
    const lignesControlees = controlesDEntree.mock.calls[0][1].lignes as Array<Record<string, unknown>>;
    expect(lignesControlees.find((l) => l.compteId === 'c411')).toMatchObject({ deviseId: 'd-usd', montantDevise: 1500 });
  });

  it('un cours saisi qui rend la contrevaleur au centime est gardé tel quel', async () => {
    const { rapport, ecriture } = await importer([
      '40110000;Fournisseur Lub;0;3200000;USD;1500;2133,333333',
      '52110000;Banque;3200000;0;;;',
    ]);
    expect(rapport.anomalies).toEqual([]);
    const dette = (ecriture.lignes.createMany.data as Array<Record<string, unknown>>).find((l) => l.compteId === 'c401')!;
    expect(dette.coursApplique).toBe(2133.333333);
  });

  it('REFUS · un cours de 2 133,33 ne rend pas 3 200 000 (il rend 3 199 995) · la ligne est refusée, nommée, et rien n’est écrit', async () => {
    const { rapport, creerEcriture } = await importer([
      '41110000;Client Kin;3200000;0;USD;1500;2133,33',
      '10110000;Capital;0;3200000;;;',
    ]);
    const messages = rapport.anomalies.map((a) => a.message).join(' | ');
    expect(messages).toMatch(/41110000/);
    expect(messages).toMatch(/3199995/);
    expect(messages).toMatch(/AUDCIF art\. 52/);
    // La ligne refusée sort, la balance ne s'équilibre plus · rien n'est écrit.
    expect(creerEcriture).not.toHaveBeenCalled();
  });

  it('la monnaie de tenue dans la colonne Devise se lit « sans devise » (m1)', async () => {
    const { rapport, ecriture } = await importer(['41110000;Client;100000;0;CDF;100000;1', '10110000;Capital;0;100000;CDF;;']);
    expect(rapport.anomalies).toEqual([]);
    const lignes = ecriture.lignes.createMany.data as Array<Record<string, unknown>>;
    expect(lignes).toHaveLength(2);
    expect(lignes.every((l) => l.deviseId === undefined)).toBe(true);
  });

  it('REFUS · la monnaie de tenue avec un montant ou un cours qui ne la confirment pas', async () => {
    const { rapport } = await importer(['41110000;Client;100000;0;CDF;50;', '10110000;Capital;0;100000;;;']);
    expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/CDF est la monnaie de tenue, pas une devise/);
    const { rapport: r2 } = await importer(['41110000;Client;100000;0;CDF;100000;2', '10110000;Capital;0;100000;;;']);
    expect(r2.anomalies.map((a) => a.message).join(' ')).toMatch(/son cours 1/);
  });

  it('REFUS · une devise inconnue du dossier', async () => {
    const { rapport } = await importer(['41110000;Client;100000;0;EUR;50;', '10110000;Capital;0;100000;;;']);
    expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/Devise « EUR » inconnue du dossier/);
  });

  it('REFUS · un montant en devise sans devise', async () => {
    const { rapport } = await importer(['41110000;Client;100000;0;;50;', '10110000;Capital;0;100000;;;']);
    expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/sans devise sur le compte 41110000/);
  });

  it('REFUS · un montant en devise illisible', async () => {
    const { rapport } = await importer(['41110000;Client;100000;0;USD;abc;', '10110000;Capital;0;100000;;;']);
    expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/illisible sur le compte 41110000/);
  });

  it('les refus se disent aussi en SIMULATION, rien n’étant écrit', async () => {
    const { rapport, creerEcriture } = await importer(['41110000;Client;100000;0;CDF;50;1', '10110000;Capital;0;100000;;;'], true);
    expect(rapport.anomalies.map((a) => a.message).join(' ')).toMatch(/CDF est la monnaie de tenue/);
    expect(creerEcriture).not.toHaveBeenCalled();
  });

  it('un fichier sans colonne de devise s’importe comme avant, sans lire les devises', async () => {
    const s = service();
    const rapport = await s.svc.executer('t', 'u', {
      type: TypeImport.BALANCE,
      nomFichier: 'balance.csv',
      contenuBase64: fichier(['41110000;Client;100000;0', '10110000;Capital;0;100000'], 'numero;intitule;debit;credit'),
      mapping: { numero: 'numero', intitule: 'intitule', debit: 'debit', credit: 'credit' },
    });
    expect(rapport.anomalies).toEqual([]);
    expect((s.prisma as unknown as { devise: { findMany: jest.Mock } }).devise.findMany).not.toHaveBeenCalled();
    const lignes = s.creerEcriture.mock.calls[0][0].data.lignes.createMany.data as Array<Record<string, unknown>>;
    expect(lignes.every((l) => l.deviseId === undefined && l.coursApplique === undefined)).toBe(true);
  });
});
