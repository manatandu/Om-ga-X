import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Referentiel, TypeRelance } from '@prisma/client';
import { candidatsSoldesEnDevise, groupesSoldesEnDevise, libelleEcartNonPasse, type LigneLueDuGroupe } from './groupes-soldes-en-devise';
import { RelancesService } from './relances.service';
import type { PrismaService } from '../../common/prisma.service';
import type { CourrierService } from '../courrier/courrier.service';

/**
 * PAQUET 1, B6 · UNE FACTURE SOLDÉE DANS SA DEVISE NE SE RÉCLAME PLUS.
 * Rejoué sur vraie base (scénario paquet1-b, B6, à travers la clôture de
 * 2026) · C6 doit 1 000 USD inscrits à 2 800 000, réglés de 1 000 USD au
 * cours de 2 900 (2 900 000) et lettrés en partiel, plus une facture en
 * francs de 500 000 · `main` réclamait 400 000 (le gain de change retranché
 * de la facture en francs), et à C6B, réglé au cours de 2 700, 400 000 dont
 * la perte de change de 100 000. AUDCIF art. 55 · l'écart réalisé se
 * constate par l'entité, il n'est pas une dette du client.
 */

const ligne = (
  id: string,
  debit: number,
  credit: number,
  lettrageId: string | null,
  devise: { deviseId: string; montantDevise: number } | null,
): LigneLueDuGroupe => ({ id, debit, credit, lettrageId, deviseId: devise?.deviseId ?? null, montantDevise: devise?.montantDevise ?? null });
const usd = (montantDevise: number) => ({ deviseId: 'usd', montantDevise });

describe('groupes soldés dans leur devise · la règle', () => {
  it('soldé en devise, non en francs · un gain (négatif) ou une perte (positive), signés comme `ecartDuGroupe`', () => {
    const gain = candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000))]);
    expect(gain.get('g')).toEqual({ lignes: 2, ecart: -100_000 });
    const perte = candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_700_000, 'g', usd(1_000))]);
    expect(perte.get('g')).toEqual({ lignes: 2, ecart: 100_000 });
  });

  it('un groupe réglé en partie dans sa devise reste à la règle commune', () => {
    expect(candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 1_450_000, 'g', usd(500))]).size).toBe(0);
  });

  it('une ligne en francs seuls dans le groupe · son reste ne serait plus le seul écart', () => {
    const lues = [ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000)), ligne('f2', 500_000, 0, 'g', null)];
    expect(candidatsSoldesEnDevise(lues).size).toBe(0);
  });

  it('deux devises, ou rien en francs à constater, ou une ligne seule · rien', () => {
    const eur = { deviseId: 'eur', montantDevise: 1_000 };
    expect(candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', eur)]).size).toBe(0);
    expect(candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_800_000, 'g', usd(1_000))]).size).toBe(0);
    expect(candidatsSoldesEnDevise([ligne('f', 2_800_000, 0, 'g', usd(1_000))]).size).toBe(0);
  });

  it('le libellé dit le gain ou la perte, son montant, et l’article', () => {
    expect(libelleEcartNonPasse(-100_000)).toMatch(/^Gain de change réalisé de 100 000,00 non passé .*AUDCIF art\. 55/);
    expect(libelleEcartNonPasse(100_000)).toMatch(/^Perte de change réalisée de 100 000,00 non passé/);
  });
});

/**
 * La doublure honore la requête · `lettrage.findMany` rend les groupes
 * demandés du dossier, avec le nombre de leurs lignes en BASE (tous
 * exercices), et aucun groupe reconduit.
 */
function lettrages(groupes: Array<{ id: string; code: string; compteId: string; lignesEnBase: number; tenantId?: string }>) {
  return {
    findMany: jest.fn(async (a: { where: { tenantId: string; id?: { in: string[] }; lettrageReconduitId?: unknown } }) =>
      a.where.lettrageReconduitId
        ? []
        : groupes
            .filter((g) => (g.tenantId ?? 't') === a.where.tenantId && (!a.where.id || a.where.id.in.includes(g.id)))
            .map((g) => ({ id: g.id, code: g.code, compteId: g.compteId, _count: { lignes: g.lignesEnBase } })),
    ),
  };
}

describe('groupes soldés dans leur devise · lus en entier', () => {
  const lues = [ligne('f', 2_800_000, 0, 'g', usd(1_000)), ligne('r', 0, 2_900_000, 'g', usd(1_000))];

  it('toutes ses lignes lues · retenu, avec son code et son compte', async () => {
    const r = await groupesSoldesEnDevise({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 2 }]) }, 't', lues);
    expect(r.get('g')).toMatchObject({ code: 'ab', compteId: 'c6', ecart: -100_000 });
  });

  it('une ligne du groupe hors de la lecture (autre exercice) · la règle commune', async () => {
    const r = await groupesSoldesEnDevise({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 3 }]) }, 't', lues);
    expect(r.size).toBe(0);
  });

  it('un groupe d’un autre dossier n’est pas rendu', async () => {
    const r = await groupesSoldesEnDevise({ lettrage: lettrages([{ id: 'g', code: 'AB', compteId: 'c6', lignesEnBase: 2, tenantId: 'autre' }]) }, 't', lues);
    expect(r.size).toBe(0);
  });

  it('aucun candidat · rien n’est lu', async () => {
    const l = lettrages([]);
    await groupesSoldesEnDevise({ lettrage: l }, 't', [ligne('f', 500_000, 0, null, null)]);
    expect(l.findMany).not.toHaveBeenCalled();
  });
});

describe('groupes soldés dans leur devise · les positions de relance', () => {
  const tiers = (id: string) => ({ id, nom: id, type: 'CLIENT', email: null, horsRelance: false, motifHorsRelance: null, horsRelanceDepuis: null });
  const compte = (id: string) => ({ id, numero: id, intitule: id, tiersCompte: { tiers: tiers(`t-${id}`) } });
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const lue = (
    id: string,
    compteId: string,
    debit: number,
    credit: number,
    date: string,
    lettrageId: string | null,
    echeance: string | null,
    devise: { deviseId: string; montantDevise: number } | null,
  ) => ({
    id,
    debit,
    credit,
    lettrageId,
    lettre: null,
    libelle: id,
    dateEcheance: echeance ? d(echeance) : null,
    deviseId: devise?.deviseId ?? null,
    montantDevise: devise?.montantDevise ?? null,
    compte: compte(compteId),
    ecriture: { date: d(date), libelle: 'Pièce', estANouveauProvisoire: false, estGenereeParCloture: false, estSoldeDesComptesDeGestion: false },
  });
  const lignes = [
    // C6 · gain de 100 000 non passé, facture en francs de 500 000.
    lue('c6-f', 'c6', 2_800_000, 0, '2027-01-05', 'g6', '2027-01-31', usd(1_000)),
    lue('c6-r', 'c6', 0, 2_900_000, '2027-02-10', 'g6', null, usd(1_000)),
    lue('c6-f2', 'c6', 500_000, 0, '2027-01-10', null, '2027-01-31', null),
    // C6B · perte de 100 000 non passée, facture en francs de 300 000.
    lue('c6b-f', 'c6b', 2_800_000, 0, '2027-01-05', 'g6b', '2027-01-31', usd(1_000)),
    lue('c6b-r', 'c6b', 0, 2_700_000, '2027-02-10', 'g6b', null, usd(1_000)),
    lue('c6b-f2', 'c6b', 300_000, 0, '2027-01-10', null, '2027-01-31', null),
    // C6C · rien d'autre que la facture soldée dans sa devise · aucune position.
    lue('c6c-f', 'c6c', 2_800_000, 0, '2027-01-05', 'g6c', '2027-01-31', usd(1_000)),
    lue('c6c-r', 'c6c', 0, 2_700_000, '2027-02-10', 'g6c', null, usd(1_000)),
  ];
  const prisma = () =>
    ({
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: Referentiel.SYSCOHADA }) },
      ligneEcriture: {
        findMany: jest.fn(async (a: { cursor?: unknown }) => (a.cursor ? [] : lignes)),
        groupBy: jest.fn(async (a: { where: { lettrageId?: { in: string[] } } }) =>
          (a.where.lettrageId?.in ?? []).map((id) => ({ lettrageId: id, _count: { _all: lignes.filter((l) => l.lettrageId === id).length } })),
        ),
      },
      lettrage: lettrages([
        { id: 'g6', code: 'AA', compteId: 'c6', lignesEnBase: 2 },
        { id: 'g6b', code: 'AB', compteId: 'c6b', lignesEnBase: 2 },
        { id: 'g6c', code: 'AC', compteId: 'c6c', lignesEnBase: 2 },
      ]),
      imputationPaiement: { findMany: jest.fn(async () => []) },
      niveauRelance: { findMany: jest.fn().mockResolvedValue([]) },
      relance: { findMany: jest.fn().mockResolvedValue([]) },
    }) as unknown as PrismaService;

  it('la facture soldée dans sa devise n’est ni réclamée ni retranchée, et l’écart est nommé', async () => {
    const positions = await new RelancesService(prisma(), {} as CourrierService).positions('t', {
      exerciceId: 'ex',
      type: TypeRelance.RAPPEL,
      dateReference: '2027-03-15',
    });
    const p6 = positions.find((p) => p.compteId === 'c6');
    expect(p6?.montantDu).toBe(500_000);
    expect(p6?.lignes.map((l) => l.montant)).toEqual([500_000]);
    expect(p6?.ecartsChangeNonPasses).toEqual([{ code: 'aa', ecart: -100_000, libelle: libelleEcartNonPasse(-100_000) }]);
    // Nommé une fois, pour ce qu'il est · pas aussi parmi les groupes lus ligne à ligne (B5).
    expect(p6?.groupesLusLigneALigne.total).toBe(0);
    const p6b = positions.find((p) => p.compteId === 'c6b');
    // La perte de change n'est jamais réclamée au client.
    expect(p6b?.montantDu).toBe(300_000);
    expect(p6b?.ecartsChangeNonPasses.map((e) => e.ecart)).toEqual([100_000]);
    // Rien d'autre à réclamer · aucune lettre ne part.
    expect(positions.some((p) => p.compteId === 'c6c')).toBe(false);
  });

  it('la lettre n’imprime pas l’écart · seules les lignes réclamées entrent au détail', () => {
    // Le câblage se teste avec la règle (F4a) · `composer` reçoit les lignes
    // de la position, jamais les écarts.
    const src = readFileSync(join(__dirname, 'relances.service.ts'), 'utf8');
    expect(src).toMatch(/if \(l\.lettrageId && soldesEnDevise\.has\(l\.lettrageId\)\) return;/);
    expect(src).toMatch(/lignes: position\.lignes,\n\s*\}\);/);
  });
});
