"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const inventaire_service_1 = require("./inventaire.service");
function service(etat = {}) {
    const creerPv = jest.fn().mockImplementation((a) => Promise.resolve({ id: 'pv1', ...a.data }));
    const prisma = {
        campagneInventaire: {
            findFirst: jest.fn().mockImplementation((a) => Promise.resolve(etat.campagne && a?.select?.exercice
                ? { exercice: { dateFin: new Date('2025-12-31T00:00:00Z') } }
                : (etat.campagne ?? null))),
            update: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'camp1', ...a.data })),
            updateMany: jest.fn().mockImplementation((a) => Promise.resolve({ count: etat.campagne && a.where.statut === etat.campagne.statut ? 1 : 0 })),
        },
        sousCommissionInventaire: {
            findFirst: jest.fn().mockImplementation((args) => {
                const toutes = etat.sousCommissions ?? (etat.sousCommission ? [etat.sousCommission] : []);
                const voulue = args?.where?.id;
                return Promise.resolve(voulue ? (toutes.find((sc) => sc.id === voulue) ?? null) : (toutes[0] ?? null));
            }),
        },
        compte: { findFirst: jest.fn().mockResolvedValue(etat.compte ?? null) },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') }),
            findMany: jest.fn().mockResolvedValue([]),
        },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue(etat.lignesCaisse ?? []),
            count: jest.fn().mockResolvedValue(0),
            aggregate: jest.fn().mockResolvedValue({ _sum: { debit: etat.soldeLivre ?? 1_250_000, credit: 0 }, _count: { _all: 1 } }),
            groupBy: jest.fn().mockResolvedValue([{ deviseId: null }]),
        },
        procesVerbalComptageCaisse: {
            findMany: jest.fn().mockResolvedValue(etat.pvCaisse ?? []),
            create: creerPv,
        },
        ecartInventaire: { count: jest.fn().mockResolvedValue(etat.ecartsSansDecision ?? 0) },
        ficheInventaire: {
            count: jest.fn().mockImplementation((a) => Promise.resolve((etat.fiches ?? []).filter((f) => f.tenantId === a.where.tenantId && f.campagneId === a.where.campagneId).length)),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
    };
    return { svc: new inventaire_service_1.InventaireService(prisma, {}), creerPv, prisma };
}
const CAMPAGNE = {
    id: 'camp1',
    tenantId: 't1',
    exerciceId: 'ex1',
    statut: client_1.StatutCampagneInventaire.RECENSEMENT,
};
const CAISSE = { id: 'c57', numero: '57100000', intitule: 'Caisse siège' };
const COMMISSION_COMPLETE = {
    id: 'sc1',
    nom: 'Caisses',
    membres: [{ role: client_1.RoleMembreInventaire.INVENTORIANT }, { role: client_1.RoleMembreInventaire.TEMOIN }],
};
const pv = (extra = {}) => ({
    compteId: 'c57',
    sousCommissionId: 'sc1',
    dateComptage: '2025-12-31',
    especesComptees: 1_250_000,
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
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ compteId: 'c52' }))).rejects.toThrow(/circularisation/);
    });
    it('accepte un 57', async () => {
        const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv());
        expect(creerPv.mock.calls[0][0].data.compteId).toBe('c57');
    });
});
describe('le PV se signe par ceux qui ont compté ET par ceux qui ont assisté', () => {
    const cas = [
        { membres: [], manque: 'un inventoriant et un témoin' },
        { membres: [{ role: client_1.RoleMembreInventaire.INVENTORIANT }], manque: 'un témoin' },
        { membres: [{ role: client_1.RoleMembreInventaire.TEMOIN }], manque: 'un inventoriant' },
    ];
    it('nomme ce qui manque, cas par cas', () => {
        for (const c of cas) {
            expect({ n: c.membres.length, manque: inventaire_service_1.InventaireService.signaturesManquantes(c.membres) }).toEqual({
                n: c.membres.length,
                manque: c.manque,
            });
        }
        expect(inventaire_service_1.InventaireService.signaturesManquantes(COMMISSION_COMPLETE.membres)).toBeNull();
    });
    it('refuse le PV et cite la sous-commission concernée', async () => {
        const { svc } = service({
            campagne: CAMPAGNE,
            compte: CAISSE,
            sousCommission: { id: 'sc1', nom: 'Caisses agences', membres: [{ role: client_1.RoleMembreInventaire.INVENTORIANT }] },
        });
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv())).rejects.toThrow(/Caisses agences/);
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv())).rejects.toThrow(/un témoin/);
    });
    it('vérifie les signatures de SA sous-commission, pas de la campagne', async () => {
        const { svc } = service({
            campagne: CAMPAGNE,
            compte: CAISSE,
            sousCommissions: [
                COMMISSION_COMPLETE,
                { id: 'sc2', nom: 'Caisse de secours', membres: [] },
            ],
        });
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ sousCommissionId: 'sc2' }))).rejects.toThrow(/Caisse de secours/);
    });
});
describe('la ventilation par coupure doit égaler le total qu’elle justifie', () => {
    it('refuse un détail qui ne totalise pas le comptage', async () => {
        const { svc } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({
            especesComptees: 1_250_000,
            coupures: [
                { valeurUnitaire: 20_000, nombre: 50 },
                { valeurUnitaire: 5_000, nombre: 40 },
            ],
        }))).rejects.toThrow(/Le détail doit égaler le montant qu’il justifie|détail doit égaler/);
    });
    it('accepte un détail qui tombe juste', async () => {
        const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({
            especesComptees: 1_250_000,
            coupures: [
                { valeurUnitaire: 20_000, nombre: 60 },
                { valeurUnitaire: 5_000, nombre: 10 },
            ],
        }));
        expect(creerPv).toHaveBeenCalled();
    });
    it('n’exige aucune ventilation · c’est un ajout de l’éditeur, pas une règle', async () => {
        const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv());
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
        await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ especesComptees: 1_180_000 }));
        expect(creerPv.mock.calls[0][0].data.ecart).toBe(-70_000);
        expect(creerPv.mock.calls[0][0].data.soldeComptableFige).toBe(1_250_000);
    });
});
describe('l’attestation, et ce que le corpus n’en dit pas', () => {
    it('refuse une attestation sans signataire', async () => {
        const { svc } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await expect(svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ attestationEtablieLe: '2025-12-31' }))).rejects.toThrow(/atteste de rien/);
    });
    it('enregistre son existence, sa date et son signataire · et rien d’autre', async () => {
        const { svc, creerPv } = service({ campagne: CAMPAGNE, compte: CAISSE, sousCommission: COMMISSION_COMPLETE });
        await svc.etablirPvCaisse('t1', 'camp1', 'u1', pv({ attestationEtablieLe: '2025-12-31', attestationPar: 'Mme la caissière principale' }));
        const data = creerPv.mock.calls[0][0].data;
        expect(data.attestationPar).toBe('Mme la caissière principale');
        expect(Object.keys(data).filter((k) => k.startsWith('attestation')).sort()).toEqual([
            'attestationEtablieLe',
            'attestationPar',
        ]);
    });
});
describe('la couverture des caisses · la question composite rendue mécanique', () => {
    const ligne = (id, numero, debit) => ({
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
    it('une simulation sur un 57 ne fait réclamer aucun procès-verbal (ligne sage-l1, relecture M5)', async () => {
        const { svc, prisma } = service({ campagne: CAMPAGNE, lignesCaisse: [], pvCaisse: [] });
        await svc.caissesNonComptees('t1', 'camp1');
        const lu = prisma.ligneEcriture.findMany.mock.calls[0][0];
        expect(lu.where.ecriture).toMatchObject({ tenantId: 't1', statut: { not: 'SITUATION' } });
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
            campagne: { ...CAMPAGNE, statut: client_1.StatutCampagneInventaire.ARBITRAGE },
            lignesCaisse: [ligne('c2', '57200000', 400_000)],
            pvCaisse: [],
        });
        await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/57200000/);
        await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/ne se recompte plus jamais/);
    });
    it('laisse clore quand chaque caisse a son PV', async () => {
        const { svc } = service({
            campagne: { ...CAMPAGNE, statut: client_1.StatutCampagneInventaire.ARBITRAGE },
            lignesCaisse: [ligne('c2', '57200000', 400_000)],
            pvCaisse: [{ compteId: 'c2' }],
        });
        await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toBeDefined();
    });
    it('laisse passer l’écart non arbitré en PREMIER · c’est le refus le plus ancien', async () => {
        const { svc } = service({
            campagne: { ...CAMPAGNE, statut: client_1.StatutCampagneInventaire.ARBITRAGE },
            lignesCaisse: [ligne('c2', '57200000', 400_000)],
            pvCaisse: [],
            ecartsSansDecision: 2,
        });
        await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/sans décision/);
    });
});
describe('une campagne de caisses seules se clôt depuis le recensement', () => {
    const ligne = (id, numero, debit) => ({
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
        await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toMatchObject({ statut: client_1.StatutCampagneInventaire.CLOTUREE });
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
        const refus = await svc.clore('t1', 'camp1', 'u1').catch((e) => e.message);
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
        const refus = await svc.clore('t1', 'camp1', 'u1').catch((e) => e.message);
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
            campagne: { ...CAMPAGNE, statut: client_1.StatutCampagneInventaire.PREPARATION },
            pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
            fiches: [],
        });
        await expect(svc.clore('t1', 'camp1', 'u1')).rejects.toThrow(/RECENSEMENT ou ARBITRAGE/);
    });
});
describe('deux clôtures simultanées · une seule passe', () => {
    function baseSerialisee() {
        const campagne = { ...CAMPAGNE };
        let verrou = Promise.resolve();
        const ecritures = [];
        const lignes = [{ debit: 1_300_000, credit: 0, compte: { id: 'c1', numero: '57100000', intitule: 'Caisse' } }];
        const client = () => {
            let liberer = () => undefined;
            return {
                liberer: () => liberer(),
                $queryRaw: jest.fn().mockImplementation(async () => {
                    const precedent = verrou;
                    verrou = new Promise((r) => (liberer = r));
                    await precedent;
                    return [{ id: 'camp1' }];
                }),
                campagneInventaire: {
                    findFirst: jest.fn().mockImplementation(async () => ({ ...campagne })),
                    update: jest.fn().mockImplementation(async (a) => {
                        await new Promise((r) => setImmediate(r));
                        if (a.where.statut !== undefined && a.where.statut !== campagne.statut) {
                            throw new client_1.Prisma.PrismaClientKnownRequestError('Record to update not found.', {
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
            $transaction: jest.fn().mockImplementation(async (fn) => {
                const tx = client();
                try {
                    return await fn(tx);
                }
                finally {
                    tx.liberer();
                }
            }),
        };
        return { prisma, campagne, ecritures };
    }
    it('la seconde attend la première, relit CLOTUREE et reçoit le refus ordinaire', async () => {
        const { prisma, campagne, ecritures } = baseSerialisee();
        const svc = new inventaire_service_1.InventaireService(prisma, {});
        const [a, b] = await Promise.allSettled([svc.clore('t1', 'camp1', 'u1'), svc.clore('t1', 'camp1', 'u2')]);
        const reussies = [a, b].filter((r) => r.status === 'fulfilled');
        const refusees = [a, b].filter((r) => r.status === 'rejected');
        expect(reussies).toHaveLength(1);
        expect(refusees).toHaveLength(1);
        expect(String(refusees[0].reason?.message)).toMatch(/statut CLOTUREE/);
        expect(ecritures).toHaveLength(1);
        expect(campagne.statut).toBe(client_1.StatutCampagneInventaire.CLOTUREE);
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
        const maj = prisma.campagneInventaire.update;
        maj.mockRejectedValueOnce(new client_1.Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: 'doublure' }));
        const refus = svc.clore('t1', 'camp1', 'u1');
        await expect(refus).rejects.toMatchObject({ status: 409 });
        await expect(svc.clore('t1', 'camp1', 'u1')).resolves.toBeDefined();
        expect(maj.mock.calls[0][0].where).toEqual({ id: 'camp1', tenantId: 't1', statut: client_1.StatutCampagneInventaire.RECENSEMENT });
    });
    it('le verrou de la campagne est pris AVANT la lecture de son statut, dans la transaction', async () => {
        const { svc, prisma } = service({
            campagne: CAMPAGNE,
            lignesCaisse: [{ debit: 1_300_000, credit: 0, compte: { id: 'c1', numero: '57100000', intitule: 'Caisse' } }],
            pvCaisse: [{ compteId: 'c1', ecart: 0, compte: { numero: '57100000' } }],
            fiches: [],
        });
        await svc.clore('t1', 'camp1', 'u1');
        const p = prisma;
        expect(p.$transaction).toHaveBeenCalled();
        const sql = p.$queryRaw.mock.calls[0][0].join('?');
        expect(sql).toMatch(/FROM "campagnes_inventaire" WHERE "id" = \? AND "tenantId" = \? FOR UPDATE/);
        expect(p.$queryRaw.mock.calls[0].slice(1)).toEqual(['camp1', 't1']);
        expect(p.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(p.campagneInventaire.findFirst.mock.invocationCallOrder[0]);
    });
});
//# sourceMappingURL=pv-comptage-caisse.spec.js.map