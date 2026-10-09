import { Prisma, RoleMembreInventaire, StatutCampagneInventaire } from '@prisma/client';
import { InventaireService } from './inventaire.service';
import { PrismaService } from '../../common/prisma.service';
import { EcritureService } from '../comptabilite/ecriture.service';

/**
 * LE PROCÈS-VERBAL DE COMPTAGE D'UNE CAISSE · un par caisse, et un seul.
 *
 * CE QUI MANQUAIT. Le PV de la CAMPAGNE porte l'inventaire physique dans son
 * ensemble. Il ne peut pas porter le comptage des espèces : le CPCC demande
 * « A-t-on tenu compte de la caisse SIÈGE, de la caisse AGENCE, de la caisse
 * DE SECOURS ? », trois caisses comptées à trois endroits, chacune par sa
 * sous-commission et chacune à son heure. Un seul PV pour les trois ne dit
 * plus laquelle a été comptée ni par qui, et la caisse d'agence oubliée passe
 * la clôture sans que rien ne l'arrête.
 *
 * CE QUE LE MODULE NE DIT PAS, ET NE DIRA PAS. Aucune source lue ne définit le
 * contenu de l'« attestation » que le CPCC réclame après le comptage. Le
 * module en enregistre l'existence, sa date et son signataire, et laisse le
 * document au cabinet · inventer ses mentions produirait un modèle qui aurait
 * l'air officiel sans l'être. Le dernier bloc de ce fichier fige cette
 * abstention.
 */

type Etat = {
  campagne?: Record<string, unknown>;
  /** Les sous-commissions de la campagne · le faux HONORE le filtre par id. */
  sousCommissions?: Record<string, unknown>[];
  sousCommission?: Record<string, unknown> | null;
  compte?: Record<string, unknown> | null;
  lignesCaisse?: { debit: number; credit: number; compte: { id: string; numero: string; intitule: string } }[];
  pvCaisse?: Record<string, unknown>[];
  ecartsSansDecision?: number;
  /** Les fiches de comptage · le faux HONORE le dossier et la campagne du filtre (paquet 1, B10). */
  fiches?: { tenantId: string; campagneId: string }[];
  /** Le solde du livre-journal de la caisse à la date du comptage (ligne A10). */
  soldeLivre?: number;
};

function service(etat: Etat = {}) {
  const creerPv = jest.fn().mockImplementation((a: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'pv1', ...a.data }),
  );
  const prisma = {
    campagneInventaire: {
      // Le faux HONORE la sélection de l'exercice · le refus d'une caisse à
      // l'écart lit la date de clôture (relecture du paquet 1, mineur 4).
      findFirst: jest.fn().mockImplementation((a?: { select?: { exercice?: unknown } }) =>
        Promise.resolve(
          etat.campagne && a?.select?.exercice
            ? { exercice: { dateFin: new Date('2025-12-31T00:00:00Z') } }
            : (etat.campagne ?? null),
        ),
      ),
      update: jest.fn().mockImplementation((a: { data: unknown }) => Promise.resolve({ id: 'camp1', ...(a.data as object) })),
      // Le PV d'une caisse ouvre le recensement d'une campagne en préparation
      // (audit final F134) · le faux honore le statut du filtre.
      updateMany: jest.fn().mockImplementation((a: { where: { statut?: string } }) =>
        Promise.resolve({ count: etat.campagne && a.where.statut === etat.campagne.statut ? 1 : 0 }),
      ),
    },
    sousCommissionInventaire: {
      // Le faux HONORE `where.id` · sans cela, un service qui cesserait de
      // filtrer sur la sous-commission demandée passerait inaperçu, et le PV
      // d'une caisse s'appuierait sur les signatures d'une autre.
      findFirst: jest.fn().mockImplementation((args: { where?: { id?: string } }) => {
        const toutes = etat.sousCommissions ?? (etat.sousCommission ? [etat.sousCommission] : []);
        const voulue = args?.where?.id;
        return Promise.resolve(voulue ? (toutes.find((sc) => sc.id === voulue) ?? null) : (toutes[0] ?? null));
      }),
    },
    compte: { findFirst: jest.fn().mockResolvedValue(etat.compte ?? null) },
    // Le solde comparé est LU au livre-journal (ligne A10) · exercice 2025,
    // comptage au 31 décembre, rien au brouillard. Les cas de la date du
    // comptage sont dans `solde-caisse-au-comptage.spec.ts`, sur une doublure
    // qui honore les filtres.
    exercice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ligneEcriture: {
      findMany: jest.fn().mockResolvedValue(etat.lignesCaisse ?? []),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { debit: etat.soldeLivre ?? 1_250_000, credit: 0 }, _count: { _all: 1 } }),
      // Une caisse en francs · aucune ligne ne porte de devise (seconde passe A10).
      groupBy: jest.fn().mockResolvedValue([{ deviseId: null }]),
    },
    procesVerbalComptageCaisse: {
      findMany: jest.fn().mockResolvedValue(etat.pvCaisse ?? []),
      create: creerPv,
    },
    ecartInventaire: { count: jest.fn().mockResolvedValue(etat.ecartsSansDecision ?? 0) },
    ficheInventaire: {
      count: jest.fn().mockImplementation((a: { where: { tenantId?: string; campagneId?: string } }) =>
        Promise.resolve(
          (etat.fiches ?? []).filter((f) => f.tenantId === a.where.tenantId && f.campagneId === a.where.campagneId).length,
        ),
      ),
    },
    // Le verrou de la campagne à la clôture (relecture du paquet 1, mineur 3) ·
    // le faux le prend sans rien bloquer ; la course est jouée plus bas, sur
    // une doublure qui sérialise.
    $queryRaw: jest.fn().mockResolvedValue([]),
    // Lecture du solde et création du PV dans UNE transaction (seconde passe A10).
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;
  return { svc: new InventaireService(prisma, {} as unknown as EcritureService), creerPv, prisma };
}

const CAMPAGNE = {
  id: 'camp1',
  tenantId: 't1',
  exerciceId: 'ex1',
  statut: StatutCampagneInventaire.RECENSEMENT,
};
const CAISSE = { id: 'c57', numero: '57100000', intitule: 'Caisse siège' };
const COMMISSION_COMPLETE = {
  id: 'sc1',
  nom: 'Caisses',
  membres: [{ role: RoleMembreInventaire.INVENTORIANT }, { role: RoleMembreInventaire.TEMOIN }],
};

const pv = (extra: Record<string, unknown> = {}) => ({
  compteId: 'c57',
  sousCommissionId: 'sc1',
  dateComptage: '2025-12-31',
  especesComptees: 1_250_000,
  // L'unité annoncée par l'aperçu (second tour A10) · une caisse en francs.
  modeComparaison: 'FRANCS',
  ...extra,
});

describe('la caisse est un 57, et rien d’autre', () => {
  it('refuse un compte de banque · une banque ne se compte pas, elle se circularise', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      compte: { id: 'c52', numero: '52100000', intitule: 'Banque' },
      sousCommission: COMMISSION_COMPLETE,
    });
    await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ compteId: 'c52' }) as never)).rejects.toThrow(
      /circularisation/,
    );
  });

  it('accepte un 57', async () => {
    const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv() as never);
    expect(creerPv.mock.calls[0][0].data.compteId).toBe('c57');
  });
});

describe('le PV se signe par ceux qui ont compté ET par ceux qui ont assisté', () => {
  const cas = [
    { membres: [], manque: 'un inventoriant et un témoin' },
    { membres: [{ role: RoleMembreInventaire.INVENTORIANT }], manque: 'un témoin' },
    { membres: [{ role: RoleMembreInventaire.TEMOIN }], manque: 'un inventoriant' },
  ];

  it('nomme ce qui manque, cas par cas', () => {
    for (const c of cas) {
      expect({ n: c.membres.length, manque: InventaireService.signaturesManquantes(c.membres) }).toEqual({
        n: c.membres.length,
        manque: c.manque,
      });
    }
    expect(InventaireService.signaturesManquantes(COMMISSION_COMPLETE.membres)).toBeNull();
  });

  it('refuse le PV et cite la sous-commission concernée', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      compte: CAISSE,
      sousCommission: { id: 'sc1', nom: 'Caisses agences', membres: [{ role: RoleMembreInventaire.INVENTORIANT }] },
    });
    await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv() as never)).rejects.toThrow(/Caisses agences/);
    await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv() as never)).rejects.toThrow(/un témoin/);
  });

  it('vérifie les signatures de SA sous-commission, pas de la campagne', async () => {
    // Deux sous-commissions sur la même campagne. La PREMIÈRE est complète ;
    // la seconde n'a personne. Un service qui cesserait de filtrer sur la
    // sous-commission demandée trouverait la première et laisserait passer.
    const { svc } = service({
      campagne: CAMPAGNE,
      compte: CAISSE,
      sousCommissions: [
        COMMISSION_COMPLETE,
        { id: 'sc2', nom: 'Caisse de secours', membres: [] },
      ],
    });
    await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ sousCommissionId: 'sc2' }) as never)).rejects.toThrow(
      /Caisse de secours/,
    );
  });
});

describe('la ventilation par coupure doit égaler le total qu’elle justifie', () => {
  it('refuse un détail qui ne totalise pas le comptage', async () => {
    const { svc } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await expect(
      svc.etablirPvCaisse(
        't1',
        'camp1',
        'u1',
        pv({
          especesComptees: 1_250_000,
          coupures: [
            { valeurUnitaire: 20_000, nombre: 50 },
            { valeurUnitaire: 5_000, nombre: 40 },
          ],
        }) as never,
      ),
    ).rejects.toThrow(/Le détail doit égaler le montant qu’il justifie|détail doit égaler/);
  });

  it('accepte un détail qui tombe juste', async () => {
    const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await svc.etablirPvCaisse(
      't1',
      'camp1',
      'u1',
      pv({
        especesComptees: 1_250_000,
        coupures: [
          { valeurUnitaire: 20_000, nombre: 60 },
          { valeurUnitaire: 5_000, nombre: 10 },
        ],
      }) as never,
    );
    expect(creerPv).toHaveBeenCalled();
  });

  it('n’exige aucune ventilation · c’est un ajout de l’éditeur, pas une règle', async () => {
    const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv() as never);
    expect(creerPv).toHaveBeenCalled();
  });
});

describe('l’écart est figé sur le PV', () => {
  it('calcule espèces comptées moins solde du livre-journal, lu par le serveur', async () => {
    const { svc, creerPv } = service({
      campagne: CAMPAGNE,
      compte: CAISSE,
      sousCommission: COMMISSION_COMPLETE,
      soldeLivre: 1_250_000,
    });
    await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ especesComptees: 1_180_000 }) as never);
    expect(creerPv.mock.calls[0][0].data.ecart).toBe(-70_000);
    // Le solde comptable est COPIÉ sur le PV, jamais relu · un règlement passé
    // le lendemain déplacerait la cible et refermerait l'écart tout seul.
    expect(creerPv.mock.calls[0][0].data.soldeComptableFige).toBe(1_250_000);
  });
});

describe('l’attestation, et ce que le corpus n’en dit pas', () => {
  it('refuse une attestation sans signataire', async () => {
    const { svc } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await expect(
      svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ attestationEtablieLe: '2025-12-31' }) as never),
    ).rejects.toThrow(/atteste de rien/);
  });

  it('enregistre son existence, sa date et son signataire · et rien d’autre', async () => {
    const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
    await svc.etablirPvCaisse(
      't1',
      'camp1',
      'u1',
      pv({ attestationEtablieLe: '2025-12-31', attestationPar: 'Mme la caissière principale' }) as never,
    );
    const data = creerPv.mock.calls[0][0].data;
    expect(data.attestationPar).toBe('Mme la caissière principale');
    // AUCUNE MENTION DE CONTENU. Le corpus ne définit pas ce que l'attestation
    // porte · si un champ de contenu apparaît un jour ici, il aura été
    // inventé, et il aura l'air officiel.
    expect(Object.keys(data).filter((k) => k.startsWith('attestation')).sort()).toEqual([
      'attestationEtablieLe',
      'attestationPar',
    ]);
  });
});

describe('la couverture des caisses · la question composite rendue mécanique', () => {
  const ligne = (id: string, numero: string, debit: number) => ({
    debit,
    credit: 0,
    compte: { id, numero, intitule: `Caisse ${numero}` },
  });

  it('liste les caisses à solde non nul sans PV', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: [ligne('c1', '57100000', 900_000), ligne('c2', '57200000', 400_000)],
      pvCaisse: [{ compteId: 'c1' }],
    });
    const manquantes = await svc.caissesNonComptees('t1', 'camp1');
    expect(manquantes.map((c) => c.numero)).toEqual(['57200000']);
  });

  it('ne réclame rien d’une caisse à solde nul · une caisse fermée n’a rien à compter', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: [{ debit: 500_000, credit: 500_000, compte: { id: 'c3', numero: '57300000', intitule: 'Caisse soldée' } }],
      pvCaisse: [],
    });
    expect(await svc.caissesNonComptees('t1', 'camp1')).toEqual([]);
  });

  it('refuse la clôture tant qu’une caisse n’est pas comptée', async () => {
    const { svc } = service({
      campagne: { ...CAMPAGNE, statut: StatutCampagneInventaire.ARBITRAGE },
      lignesCaisse: [ligne('c2', '57200000', 400_000)],
      pvCaisse: [],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/57200000/);
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/ne se recompte plus jamais/);
  });

  it('laisse clore quand chaque caisse a son PV', async () => {
    const { svc } = service({
      campagne: { ...CAMPAGNE, statut: StatutCampagneInventaire.ARBITRAGE },
      lignesCaisse: [ligne('c2', '57200000', 400_000)],
      pvCaisse: [{ compteId: 'c2' }],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toBeDefined();
  });

  it('laisse passer l’écart non arbitré en PREMIER · c’est le refus le plus ancien', async () => {
    const { svc } = service({
      campagne: { ...CAMPAGNE, statut: StatutCampagneInventaire.ARBITRAGE },
      lignesCaisse: [ligne('c2', '57200000', 400_000)],
      pvCaisse: [],
      ecartsSansDecision: 2,
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/sans décision/);
  });
});

/**
 * LA CAMPAGNE QUI NE COMPTE QUE SA CAISSE (paquet 1, B10). Une association
 * sans stock inventorie sa seule caisse · le PV fait le comptage et la
 * comparaison, aucune fiche n'est à rapprocher, et `rapprocher` refuse une
 * campagne sans fiche. Elle restait au recensement, la clôture étant réservée
 * à l'arbitrage · « statut RECENSEMENT, l'opération n'est possible qu'en
 * ARBITRAGE », relevé sur vraie base avant correction.
 */
describe('une campagne de caisses seules se clôt depuis le recensement', () => {
  const ligne = (id: string, numero: string, debit: number) => ({
    debit,
    credit: 0,
    compte: { id, numero, intitule: `Caisse ${numero}` },
  });
  const CAISSE_SEULE = [ligne('c1', '57100000', 1_300_000)];

  it('se clôt quand son seul PV ne porte aucun écart', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: CAISSE_SEULE,
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toMatchObject({ statut: StatutCampagneInventaire.CLOTUREE });
  });

  it('refuse un PV qui porte un écart, et nomme la caisse et l’issue (CPCC, étape 5)', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: CAISSE_SEULE,
      pvCaisse: [
        {
          compteId: 'c1',
          ecart: -5_000,
          dateComptage: new Date('2025-12-31T00:00:00Z'),
          especesComptees: 1_295_000,
          soldeALaCloture: null,
          encaissementsPosterieurs: null,
          decaissementsPosterieurs: null,
          modeComparaison: 'FRANCS',
          compte: { numero: '57100000' },
        },
      ],
      fiches: [],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/57100000/);
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/fiche de la caisse.*arbitrez/);
    // Comptée à la clôture · la fiche porte les espèces comptées (mineur 4).
    const refus = await svc.clore('t1', 'camp1', 'u1').catch((e: Error) => e.message);
    expect(String(refus).replace(/\s/g, '')).toContain('lesespècescomptées,1295000,00');
  });

  it('nomme la valeur à porter sur la fiche · reconstituée à la clôture pour une caisse comptée après (mineur 4)', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: CAISSE_SEULE,
      pvCaisse: [
        {
          compteId: 'c1',
          ecart: -10_000,
          dateComptage: new Date('2026-01-05T00:00:00Z'),
          especesComptees: 1_190_000,
          soldeALaCloture: 1_300_000,
          encaissementsPosterieurs: 0,
          decaissementsPosterieurs: 100_000,
          modeComparaison: 'FRANCS',
          compte: { numero: '57100000' },
        },
      ],
      fiches: [],
    });
    const refus = await svc.clore('t1', 'camp1', 'u1').catch((e: Error) => e.message);
    expect(String(refus).replace(/\s/g, '')).toContain('reconstituéeàlaclôture,figéesurleprocès-verbal,1290000,00');
    expect(refus).toMatch(/jamais les espèces comptées/);
    expect(refus).toMatch(/fiche de la caisse.*arbitrez/);
  });

  it('refuse une campagne où rien n’a été compté (AUDCIF art. 42)', async () => {
    const { svc } = service({ campagne: CAMPAGNE, pvCaisse: [], fiches: [] });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/Rien n'a été compté/);
  });

  it('garde le rapprochement pour une campagne qui a des fiches · seules celles de SA campagne comptent', async () => {
    const avecFiche = service({
      campagne: CAMPAGNE,
      lignesCaisse: CAISSE_SEULE,
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [{ tenantId: 't1', campagneId: 'camp1' }],
    });
    await expect(avecFiche.svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/1 fiche\(s\) de comptage à rapprocher/);

    // Une fiche d'une AUTRE campagne ne retient pas celle-ci · le faux honore le filtre.
    const ficheAilleurs = service({
      campagne: CAMPAGNE,
      lignesCaisse: CAISSE_SEULE,
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [{ tenantId: 't1', campagneId: 'autre' }],
    });
    await expect(ficheAilleurs.svc.clore('t1', 'camp1', 'u1')).resolves.toBeDefined();
  });

  it('relit encore les caisses non comptées · une seconde caisse sans PV refuse', async () => {
    const { svc } = service({
      campagne: CAMPAGNE,
      lignesCaisse: [...CAISSE_SEULE, ligne('c2', '57200000', 400_000)],
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/57200000/);
  });

  it('reste fermée en préparation', async () => {
    const { svc } = service({
      campagne: { ...CAMPAGNE, statut: StatutCampagneInventaire.PREPARATION },
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [],
    });
    await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/RECENSEMENT ou ARBITRAGE/);
  });
});

/**
 * DEUX CLÔTURES SIMULTANÉES (relecture « échecs silencieux » du paquet 1,
 * mineur 3). Les contrôles se lisaient hors transaction et l'écriture visait le
 * seul identifiant · sur vraie base, six campagnes sur six fermées DEUX fois
 * (201 et 201), la seconde réécrivant la date et l'auteur de la première.
 * La doublure joue la base · `$queryRaw` (le `FOR UPDATE`) tient un verrou
 * jusqu'à la fin de la transaction qui l'a pris, et `update` honore le statut
 * de son filtre (P2025 sinon, comme Prisma).
 */
describe('deux clôtures simultanées · une seule passe', () => {
  function baseSerialisee() {
    const campagne: Record<string, unknown> = { ...CAMPAGNE };
    let verrou: Promise<void> = Promise.resolve();
    const ecritures: unknown[] = [];
    const lignes = [{ debit: 1_300_000, credit: 0, compte: { id: 'c1', numero: '57100000', intitule: 'Caisse' } }];
    const client = () => {
      // Le verrou appartient à la transaction · relâché à sa fin, réussie ou non.
      let liberer: () => void = () => undefined;
      return {
        liberer: () => liberer(),
        $queryRaw: jest.fn().mockImplementation(async () => {
          const precedent = verrou;
          verrou = new Promise<void>((r) => (liberer = r));
          await precedent;
          return [{ id: 'camp1' }];
        }),
        campagneInventaire: {
          findFirst: jest.fn().mockImplementation(async () => ({ ...campagne })),
          update: jest.fn().mockImplementation(async (a: { where: { statut?: string }; data: Record<string, unknown> }) => {
            // L'écriture est retardée d'un tour · sans verrou, la seconde clôture
            // lit le statut avant que la première ne l'écrive.
            await new Promise((r) => setImmediate(r));
            if (a.where.statut !== undefined && a.where.statut !== campagne.statut) {
              throw new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
                code: 'P2025',
                clientVersion: 'doublure',
              });
            }
            Object.assign(campagne, a.data);
            ecritures.push(a.data);
            return { ...campagne };
          }),
        },
        ficheInventaire: { count: jest.fn().mockResolvedValue(0) },
        procesVerbalComptageCaisse: {
          findMany: jest.fn().mockResolvedValue([{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }]),
        },
        ecartInventaire: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
      };
    };
    const prisma = {
      ...client(),
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = client();
        try {
          return await fn(tx);
        } finally {
          tx.liberer();
        }
      }),
    };
    return { prisma, campagne, ecritures };
  }

  it('la seconde attend la première, relit CLOTUREE et reçoit le refus ordinaire', async () => {
    const { prisma, campagne, ecritures } = baseSerialisee();
    const svc = new InventaireService(prisma as unknown as PrismaService, {} as unknown as EcritureService);
    const [a, b] = await Promise.allSettled([svc.clore('t1', 'camp1', 'u1'), svc.clore('t1', 'camp1', 'u2')]);
    const reussies = [a, b].filter((r) => r.status === 'fulfilled');
    const refusees = [a, b].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(reussies).toHaveLength(1);
    expect(refusees).toHaveLength(1);
    expect(String(refusees[0].reason?.message)).toMatch(/statut CLOTUREE/);
    expect(ecritures).toHaveLength(1);
    expect(campagne.statut).toBe(StatutCampagneInventaire.CLOTUREE);
  });
});

describe('une écriture de clôture qui ne trouve plus le statut lu · 409 nommé', () => {
  it('P2025 sur le statut lu devient un ConflictException qui dit quoi faire', async () => {
    const { svc, prisma } = service({
      campagne: CAMPAGNE,
      lignesCaisse: [{ debit: 1_300_000, credit: 0, compte: { id: 'c1', numero: '57100000', intitule: 'Caisse' } }],
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [],
    });
    const maj = (prisma as unknown as { campagneInventaire: { update: jest.Mock } }).campagneInventaire.update;
    maj.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: 'doublure' }),
    );
    const refus = svc.clore('t1', 'camp1', 'u1');
    await expect(refus).rejects.toMatchObject({ status: 409 });
    await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toBeDefined();
    // L'écriture vise le statut LU, pas le seul identifiant.
    expect(maj.mock.calls[0][0].where).toEqual({ id: 'camp1', tenantId: 't1', statut: StatutCampagneInventaire.RECENSEMENT });
  });

  it('le verrou de la campagne est pris AVANT la lecture de son statut, dans la transaction', async () => {
    const { svc, prisma } = service({
      campagne: CAMPAGNE,
      lignesCaisse: [{ debit: 1_300_000, credit: 0, compte: { id: 'c1', numero: '57100000', intitule: 'Caisse' } }],
      pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
      fiches: [],
    });
    await svc.clore('t1', 'camp1', 'u1');
    const p = prisma as unknown as { $queryRaw: jest.Mock; $transaction: jest.Mock; campagneInventaire: { findFirst: jest.Mock } };
    expect(p.$transaction).toHaveBeenCalled();
    const sql = (p.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toMatch(/FROM "campagnes_inventaire" WHERE "id" = \? AND "tenantId" = \? FOR UPDATE/);
    expect(p.$queryRaw.mock.calls[0].slice(1)).toEqual(['camp1', 't1']);
    expect(p.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(p.campagneInventaire.findFirst.mock.invocationCallOrder[0]);
  });
});
