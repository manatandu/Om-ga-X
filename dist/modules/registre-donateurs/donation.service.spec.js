"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const donation_service_1 = require("./donation.service");
const correspondance_registre_1 = require("./correspondance-registre");
function ligne(numero, classe, mouvementDebit, mouvementCredit) {
    return {
        compteId: `id-${numero}`, numero, intitule: `Compte ${numero}`, classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        totalDebit: mouvementDebit, totalCredit: mouvementCredit,
        reportDebit: 0, reportCredit: 0,
        mouvementDebit, mouvementCredit,
        solde: mouvementDebit - mouvementCredit,
    };
}
const EXERCICE = { id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function prismaAvec(registre = []) {
    const lignes = registre.map((l) => ({
        tenantId: 't1', dateOperation: new Date('2026-06-01'),
        nature: client_1.NatureLiberalite.DON, typeDonateur: client_1.TypeDonateur.PERSONNE_PHYSIQUE,
        nom: 'Kabila', prenoms: 'Jean', domicile: 'Kinshasa', adresseElectronique: 'j@k.cd',
        denomination: null, numeroImmatriculation: null, numeroIdentificationFiscale: null, adresseSiegeSocial: null,
        montant: new client_1.Prisma.Decimal(0), modeLiberation: client_1.ModeLiberation.ESPECES, designationNature: null,
        signeePar: null, signeeLe: null, ecritureId: null,
        annulee: false, motifAnnulation: null, annuleeLe: null,
        createdAt: new Date(), createdBy: 'u1',
        ...l,
    }));
    const donation = {
        findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(lignes
            .filter((l) => (where?.annulee === false ? !l.annulee : true))
            .sort((a, b) => a.numero - b.numero))),
        findFirst: jest.fn().mockImplementation(({ where, orderBy }) => {
            if (orderBy?.numero === 'desc') {
                const max = lignes.reduce((m, l) => Math.max(m, l.numero), 0);
                return Promise.resolve(max === 0 ? null : { numero: max });
            }
            return Promise.resolve(lignes.find((l) => l.id === where.id) ?? null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
            if (lignes.some((l) => l.numero === data.numero)) {
                throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5' });
            }
            const cree = { id: `d${data.numero}`, ...data };
            lignes.push(cree);
            return Promise.resolve(cree);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
            const l = lignes.find((x) => x.id === where.id);
            Object.assign(l, data);
            return Promise.resolve(l);
        }),
    };
    return {
        donation,
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        ecriture: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
        $transaction: jest.fn().mockImplementation((fn) => fn({ donation })),
        _lignes: lignes,
    };
}
function service(balance = [], prisma = prismaAvec()) {
    const ecriture = {
        balance: jest.fn().mockResolvedValue({ lignes: balance, totaux: { debit: 0, credit: 0 } }),
    };
    return { svc: new donation_service_1.DonationService(prisma, ecriture), prisma };
}
const donPP = (montant, extra = {}) => ({
    dateOperation: '2026-06-01',
    nature: client_1.NatureLiberalite.DON,
    typeDonateur: client_1.TypeDonateur.PERSONNE_PHYSIQUE,
    nom: 'Kabila', prenoms: 'Jean', domicile: 'Kinshasa', adresseElectronique: 'j@k.cd',
    montant,
    modeLiberation: client_1.ModeLiberation.VIREMENT,
    ...extra,
});
describe('une écriture de situation n’est la pièce d’aucun don', () => {
    it('refusée à l’inscription comme à la modification, nommée par son numéro, rien n’est écrit', async () => {
        const prisma = prismaAvec();
        prisma.ecriture.findFirst.mockResolvedValue({ id: 'e1', statut: 'SITUATION', numeroPiece: 5 });
        const { svc } = service([], prisma);
        await expect(svc.inscrire('t1', 'u1', donPP(100, { ecritureId: 'e1' }))).rejects.toThrow(/n° 5 est une écriture de situation/);
        expect(prisma._lignes).toHaveLength(0);
    });
});
describe('Article 17 · « numéroté de façon continue »', () => {
    it('attribue 1, 2, 3… sans que le client puisse imposer un numéro', async () => {
        const { svc } = service();
        const a = await svc.inscrire('t1', 'u1', donPP(100));
        const b = await svc.inscrire('t1', 'u1', donPP(200));
        const c = await svc.inscrire('t1', 'u1', donPP(300));
        expect([a.numero, b.numero, c.numero]).toEqual([1, 2, 3]);
    });
    it('rejoue sur collision de numéro plutôt que de dupliquer', async () => {
        const { svc, prisma } = service();
        await svc.inscrire('t1', 'u1', donPP(100));
        let interceptee = false;
        const create = prisma.donation.create;
        const vrai = create.getMockImplementation();
        create.mockImplementation((args) => {
            if (!interceptee) {
                interceptee = true;
                prisma._lignes.push({ id: 'concurrent', numero: 2, annulee: false });
            }
            return vrai(args);
        });
        const suivante = await svc.inscrire('t1', 'u1', donPP(200));
        expect(suivante.numero).toBe(3);
    });
    it("l'annulation conserve le numéro : le registre ne prend pas de trou", async () => {
        const { svc } = service();
        await svc.inscrire('t1', 'u1', donPP(100));
        const deux = await svc.inscrire('t1', 'u1', donPP(200));
        await svc.annuler('t1', deux.id, { motifAnnulation: 'Double saisie' });
        const trois = await svc.inscrire('t1', 'u1', donPP(300));
        expect(trois.numero).toBe(3);
        const rapport = await svc.rapportConformite('t1', 'ex1');
        expect(rapport.numerotation.continue).toBe(true);
        expect(rapport.numerotation.trous).toEqual([]);
    });
    it('signale les trous et les doublons d’un registre repris d’un autre outil', async () => {
        const { svc } = service([], prismaAvec([
            { id: 'a', numero: 1 }, { id: 'b', numero: 3 }, { id: 'c', numero: 4 }, { id: 'd', numero: 4 },
        ]));
        const { numerotation } = await svc.rapportConformite('t1', 'ex1');
        expect(numerotation.trous).toEqual([2]);
        expect(numerotation.doublons).toEqual([4]);
        expect(numerotation.continue).toBe(false);
    });
});
describe('Article 17, points 2 et 3 · identifiants du donateur', () => {
    it('refuse un identifiant de personne morale sur une personne physique', async () => {
        const { svc } = service();
        await expect(svc.inscrire('t1', 'u1', donPP(100, { numeroIdentificationFiscale: 'A1234' }))).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse des prénoms sur une personne morale', async () => {
        const { svc } = service();
        await expect(svc.inscrire('t1', 'u1', {
            ...donPP(100), typeDonateur: client_1.TypeDonateur.PERSONNE_MORALE,
            nom: undefined, domicile: undefined, denomination: 'Fondation X', prenoms: 'Jean',
        })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('exige la désignation du bien quand la libération est « en nature » (point 4)', async () => {
        const { svc } = service();
        await expect(svc.inscrire('t1', 'u1', donPP(100, { modeLiberation: client_1.ModeLiberation.NATURE }))).rejects.toThrow(/désignation du bien/i);
    });
    it('inscrit une ligne incomplète mais la signale au rapport, plutôt que de la refuser', async () => {
        const { svc } = service();
        const d = await svc.inscrire('t1', 'u1', donPP(500, { adresseElectronique: undefined, domicile: undefined }));
        expect(d.numero).toBe(1);
        const rapport = await svc.rapportConformite('t1', 'ex1');
        const incomplete = rapport.completude.lignesIncompletes.find((l) => l.numero === 1);
        expect(incomplete.manquements.map((m) => m.champ).sort()).toEqual(['adresseElectronique', 'domicile']);
        expect(incomplete.manquements[0].exigence).toContain('Art. 17, point 2');
    });
    it('exige les cinq mentions de la personne morale (point 3)', () => {
        const manque = (0, donation_service_1.manquementsArticle17)({ typeDonateur: client_1.TypeDonateur.PERSONNE_MORALE, denomination: 'Fondation X' });
        expect(manque.map((m) => m.champ).sort()).toEqual([
            'adresseElectronique', 'adresseSiegeSocial', 'numeroIdentificationFiscale', 'numeroImmatriculation',
        ]);
    });
});
describe('Article 17 · « signées par le représentant légal »', () => {
    it('liste les lignes non signées et retire celles qui le sont', async () => {
        const { svc } = service();
        const a = await svc.inscrire('t1', 'u1', donPP(100));
        await svc.inscrire('t1', 'u1', donPP(200));
        await svc.signer('t1', a.id, { signeePar: 'Mme la Présidente' });
        const { signature } = await svc.rapportConformite('t1', 'ex1');
        expect(signature.lignesNonSignees.map((l) => l.numero)).toEqual([2]);
    });
    it('refuse de retoucher une ligne déjà signée', async () => {
        const { svc } = service();
        const a = await svc.inscrire('t1', 'u1', donPP(100));
        await svc.signer('t1', a.id, { signeePar: 'Mme la Présidente' });
        await expect(svc.modifier('t1', a.id, { domicile: 'Lubumbashi' })).rejects.toThrow(/signée/i);
    });
    it('refuse une annulation sans motif au niveau du DTO, et exige le motif en base', async () => {
        const { svc } = service();
        const a = await svc.inscrire('t1', 'u1', donPP(100));
        await svc.annuler('t1', a.id, { motifAnnulation: 'Don restitué au donateur' });
        await expect(svc.annuler('t1', a.id, { motifAnnulation: 'x' })).rejects.toThrow(/déjà annulée/i);
    });
});
describe('Article 18 · rapprochement registre / comptabilité', () => {
    it('boucle quand le registre couvre exactement les comptes de libéralité', async () => {
        const { svc } = service([ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 800)]);
        await svc.inscrire('t1', 'u1', donPP(500));
        await svc.inscrire('t1', 'u1', donPP(300));
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.totalRegistre).toBe(800);
        expect(rapprochement.totalComptable).toBe(800);
        expect(rapprochement.rapproche).toBe(true);
    });
    it('exclut du total la ligne annulée, qui reste au registre', async () => {
        const { svc } = service([ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 500)]);
        await svc.inscrire('t1', 'u1', donPP(500));
        const b = await svc.inscrire('t1', 'u1', donPP(300));
        await svc.annuler('t1', b.id, { motifAnnulation: 'Saisie en double' });
        const rapport = await svc.rapportConformite('t1', 'ex1');
        expect(rapport.rapprochement.totalRegistre).toBe(500);
        expect(rapport.rapprochement.rapproche).toBe(true);
        expect(rapport.existence.lignesSurExercice).toBe(2);
        expect(rapport.existence.lignesAnnuleesSurExercice).toBe(1);
    });
    it('nomme le sens de l’écart · art. 24 quand la comptabilité dépasse le registre', async () => {
        const { svc } = service([ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 1000)]);
        await svc.inscrire('t1', 'u1', donPP(600));
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.ecart).toBe(400);
        expect(rapprochement.lecture).toMatch(/art\. 24/);
    });
    it('signale l’inverse · inscrit au registre sans contrepartie comptable', async () => {
        const { svc } = service([ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 100)]);
        await svc.inscrire('t1', 'u1', donPP(600));
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.ecart).toBe(-500);
        expect(rapprochement.lecture).toMatch(/sans contrepartie comptable/);
    });
    it('lit les dons en nature au crédit seul : l’extourne de clôture ne réduit pas le don reçu', async () => {
        const { svc } = service([ligne('7542', client_1.ClasseCompte.CLASSE_7, 400, 1000)]);
        await svc.inscrire('t1', 'u1', donPP(1000, { modeLiberation: client_1.ModeLiberation.NATURE, designationNature: 'Sacs de riz (200)' }));
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.totalComptable).toBe(1000);
        expect(rapprochement.rapproche).toBe(true);
    });
    it('lit le 167 au crédit seul : la reprise au rythme des amortissements n’efface pas le legs reçu', async () => {
        const { svc } = service([ligne('1671', client_1.ClasseCompte.CLASSE_1, 250, 5000)]);
        await svc.inscrire('t1', 'u1', {
            ...donPP(5000), nature: client_1.NatureLiberalite.LEGS,
            modeLiberation: client_1.ModeLiberation.NATURE, designationNature: 'Bâtiment légué (Gombe)',
        });
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.totalComptable).toBe(5000);
    });
    it('chiffre les comptes frontière sans les agréger au rapprochement', async () => {
        const { svc } = service([
            ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 500),
            ligne('7047', client_1.ClasseCompte.CLASSE_7, 0, 900),
            ligne('7045', client_1.ClasseCompte.CLASSE_7, 0, 120),
        ]);
        await svc.inscrire('t1', 'u1', donPP(500));
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.totalComptable).toBe(500);
        expect(rapprochement.rapproche).toBe(true);
        const parrainage = rapprochement.comptesFrontiere.find((c) => c.numero === '7047');
        expect(parrainage.montant).toBe(900);
        expect(parrainage.fondement).toMatch(/BÉNÉFICE DIRECT/);
    });
    it('chiffre à part la générosité promise non encore reçue (475), hors du champ de l’art. 17', async () => {
        const { svc } = service([ligne('475', client_1.ClasseCompte.CLASSE_4, 700, 0)]);
        const { rapprochement } = await svc.rapportConformite('t1', 'ex1');
        expect(rapprochement.totalComptable).toBe(0);
        expect(rapprochement.comptesHorsPerimetre.find((c) => c.numero === '475').montant).toBe(-700);
    });
    it('exclut du rapprochement les libéralités hors bornes de l’exercice', async () => {
        const { svc } = service([ligne('7041', client_1.ClasseCompte.CLASSE_7, 0, 100)], prismaAvec([
            { id: 'vieux', numero: 1, dateOperation: new Date('2025-06-01'), montant: new client_1.Prisma.Decimal(9999) },
            { id: 'bon', numero: 2, dateOperation: new Date('2026-06-01'), montant: new client_1.Prisma.Decimal(100) },
        ]));
        const rapport = await svc.rapportConformite('t1', 'ex1');
        expect(rapport.rapprochement.totalRegistre).toBe(100);
        expect(rapport.existence.lignesTotalRegistre).toBe(2);
        expect(rapport.existence.lignesSurExercice).toBe(1);
    });
});
describe('Périmètre comptable du registre', () => {
    it('n’assigne aucun compte à deux catégories à la fois', () => {
        const tous = [...correspondance_registre_1.COMPTES_LIBERALITE, ...correspondance_registre_1.COMPTES_FRONTIERE, ...correspondance_registre_1.COMPTES_HORS_PERIMETRE];
        const numeros = tous.map((c) => c.numero);
        expect(new Set(numeros).size).toBe(numeros.length);
    });
    it('n’a aucun préfixe qui en absorbe un autre', () => {
        const tous = [...correspondance_registre_1.COMPTES_LIBERALITE, ...correspondance_registre_1.COMPTES_FRONTIERE, ...correspondance_registre_1.COMPTES_HORS_PERIMETRE];
        for (const a of tous) {
            for (const b of tous) {
                if (a.numero !== b.numero)
                    expect(b.numero.startsWith(a.numero)).toBe(false);
            }
        }
    });
    it('cite le texte pour chaque compte retenu ou écarté', () => {
        for (const c of [...correspondance_registre_1.COMPTES_LIBERALITE, ...correspondance_registre_1.COMPTES_FRONTIERE, ...correspondance_registre_1.COMPTES_HORS_PERIMETRE]) {
            expect(c.fondement.length).toBeGreaterThan(40);
            expect(c.fondement).toMatch(/Art|Partie|Glossaire/);
        }
    });
});
//# sourceMappingURL=donation.service.spec.js.map