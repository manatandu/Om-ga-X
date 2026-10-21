"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
const comptes_de_passage_1 = require("./comptes-de-passage");
const virement_fonds_1 = require("./virement-fonds");
const virements_fonds_dto_1 = require("./virements-fonds.dto");
const virements_fonds_service_1 = require("./virements-fonds.service");
const banque = (id, numero, extra = {}) => ({
    id,
    code: id.toUpperCase(),
    type: 'TRESORERIE',
    estActif: true,
    compteTresorerie: { id: `c-${numero}`, numero, intitule: `Compte ${numero}` },
    ...extra,
});
const DEMANDE = {
    montant: 500_000,
    objet: 'Alimentation de la caisse',
    sortie: { nature: 'CHEQUE', reference: 'CHQ 0042', date: '2026-03-14' },
    entree: { nature: 'BON_ENTREE_CAISSE', reference: 'PC 118', date: '2026-03-14' },
    porteur: 'Kalala',
};
describe('Le compte de passage est le 585, semé par les deux plans', () => {
    it.each([
        ['SYSCOHADA', compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA],
        ['SYCEBNL', compte_seed_1.PLAN_COMPTES_SYCEBNL],
    ])('%s sème le 58500000 « Virements de fonds »', (_r, plan) => {
        const c = plan.find((x) => x.numero === virement_fonds_1.COMPTE_DU_PLAN_585);
        expect(c?.intitule).toMatch(/Virements de fonds/i);
    });
    it('le 581 n’est jamais le compte de passage d’un virement', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'virement-fonds.ts'), 'utf8');
        expect(source).toMatch(/COMPTE_DU_PLAN_585 = '58500000'/);
        expect(Object.values(virement_fonds_1.COMPTES_DE_PASSAGE).map((c) => c.rang)).toEqual([1, 2, 3, 4]);
    });
});
describe('Le sens se lit sur les comptes des deux journaux', () => {
    it.each([
        ['52110000', '52120000', client_1.SensVirementFonds.BANQUE_BANQUE],
        ['52110000', '57110000', client_1.SensVirementFonds.BANQUE_CAISSE],
        ['57110000', '52110000', client_1.SensVirementFonds.CAISSE_BANQUE],
        ['57110000', '57120000', client_1.SensVirementFonds.CAISSE_CAISSE],
        ['53100000', '55100000', client_1.SensVirementFonds.BANQUE_BANQUE],
    ])('%s vers %s · %s', (o, d, sens) => {
        expect((0, virement_fonds_1.sensDuVirement)(o, d)).toBe(sens);
    });
});
describe('Les refus qui ne lisent rien', () => {
    const o = banque('bq', '52110000');
    const d = banque('ca', '57110000');
    it('admet un virement complet', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, DEMANDE)).toBeNull();
    });
    it('refuse un journal qui n’est pas de trésorerie', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, banque('ac', '40110000', { type: 'ACHAT' }), DEMANDE)).toMatch(/n'est pas un journal de banque ou de caisse/);
    });
    it('refuse un journal en sommeil ou sans compte', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, { ...d, estActif: false }, DEMANDE)).toMatch(/en sommeil/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, { ...d, compteTresorerie: null }, DEMANDE)).toMatch(/n'a pas de compte de trésorerie/);
    });
    it('refuse le même journal, ou deux journaux sur le même compte', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, o, DEMANDE)).toMatch(/sont le même/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, { ...d, compteTresorerie: o.compteTresorerie }, DEMANDE)).toMatch(/même compte 52110000/);
    });
    it('refuse un montant nul, négatif ou au-delà du centime', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, montant: 0 })).toMatch(/positif/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, montant: -1 })).toMatch(/positif/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, montant: 10.005 })).toMatch(/centime/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, montant: 10.05 })).toBeNull();
    });
    it('exige l’objet et la référence de la pièce de CHAQUE opération (AUDCIF art. 17, 5°)', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, objet: '  ' })).toMatch(/objet/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, sortie: { ...DEMANDE.sortie, reference: '' } })).toMatch(/pièce de la sortie.*art\. 17, 5°/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, reference: ' ' } })).toMatch(/pièce de l'entrée des fonds.*art\. 17, 5°/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, reference: 'x'.repeat(101) } })).toBe("La référence de la pièce de l'entrée des fonds se saisit en 100 caractères au plus.");
    });
    it('la nature et le jour de chaque pièce se jugent ici, l’opération nommée (jamais un préfixe « sortie. »)', () => {
        const [o, d] = [banque('bq', '52110000'), banque('ca', '57110000')];
        for (const nature of ['', 'VIREMENT', 'cheque']) {
            expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, sortie: { ...DEMANDE.sortie, nature } })).toBe('Choisissez la nature de la pièce de la sortie des fonds.');
        }
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, nature: '' } })).toBe("Choisissez la nature de la pièce de l'entrée des fonds.");
        for (const date of ['2026', '2026-03', '2026-W11', '2026-03-15T10:00', '2026-02-30', '2026-13-01']) {
            expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, date } })).toBe("La date de la pièce de l'entrée des fonds se donne au jour (AAAA-MM-JJ).");
        }
        expect((0, virement_fonds_1.estUnJour)('2028-02-29')).toBe(true);
        expect((0, virement_fonds_1.estUnJour)('2026-02-29')).toBe(false);
        const recue = (p) => p;
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, sortie: recue({ reference: 'CHQ 1', date: '2026-03-14' }) })).toBe('Choisissez la nature de la pièce de la sortie des fonds.');
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, sortie: recue({ nature: 'CHEQUE', reference: 42, date: '2026-03-14' }) })).toMatch(/^La référence de la pièce de la sortie des fonds est exigée/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: recue({ nature: 'BON_ENTREE_CAISSE', reference: 'BC 1' }) })).toBe("La date de la pièce de l'entrée des fonds se donne au jour (AAAA-MM-JJ).");
    });
    it('la porte ne juge que l’objet de chaque pièce · ses refus ne portent jamais le préfixe « sortie. »', async () => {
        const pipe = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
        const corps = {
            exerciceId: '7f3c3e9e-2b8a-4d2a-9c41-1f1f8e6f0a11',
            journalOrigineId: '7f3c3e9e-2b8a-4d2a-9c41-1f1f8e6f0a12',
            journalDestinationId: '7f3c3e9e-2b8a-4d2a-9c41-1f1f8e6f0a13',
            montant: 1000,
            objet: 'Alimentation',
            sortie: { reference: 'CHQ 1', date: '2026-03-14' },
            entree: { nature: 'BON_ENTREE_CAISSE', reference: 'BC 1', date: '2026-03-14' },
        };
        await expect(pipe.transform(corps, { type: 'body', metatype: virements_fonds_dto_1.CreerVirementDto })).resolves.toBeInstanceOf(virements_fonds_dto_1.CreerVirementDto);
        for (const entree of [undefined, null, 'BC 1', []]) {
            const refus = await pipe.transform({ ...corps, entree }, { type: 'body', metatype: virements_fonds_dto_1.CreerVirementDto }).catch((e) => e.getResponse());
            expect(refus).toMatchObject({ message: ["La pièce de l'entrée des fonds se donne avec sa nature, sa référence et sa date."] });
        }
    });
    it('l’entrée suit la sortie, le même jour ou après, jamais avant (AUDCIF art. 16, al. 2)', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, date: '2026-03-16' } })).toBeNull();
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, entree: { ...DEMANDE.entree, date: '2026-03-13' } })).toMatch(/entrée des fonds est datée avant leur sortie.*art\. 16, al\. 2/);
    });
    it('exige le porteur dès qu’une caisse est en jeu, jamais entre deux banques', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(o, d, { ...DEMANDE, porteur: '' })).toMatch(/porteur/);
        const versLaBanque = { sortie: { ...DEMANDE.sortie, nature: 'BON_SORTIE_CAISSE' }, entree: { ...DEMANDE.entree, nature: 'AVIS_CREDIT' } };
        expect((0, virement_fonds_1.motifRefusVirement)(d, o, { ...DEMANDE, ...versLaBanque, porteur: undefined })).toMatch(/porteur/);
        expect((0, virement_fonds_1.motifRefusVirement)(o, banque('bq2', '52120000'), { ...DEMANDE, entree: versLaBanque.entree, porteur: undefined })).toBeNull();
    });
});
describe('Les deux pièces soldent le 585', () => {
    it('origine D 585 / C sa trésorerie, destination D sa trésorerie / C 585', () => {
        const l = (0, virement_fonds_1.lignesDuVirement)({ compteOrigineId: 'o', compteDestinationId: 'd', comptePassageId: 'p', montant: 750, libelle: 'x' });
        expect(l.origine).toEqual([
            { compteId: 'p', debit: 750, credit: 0, libelle: 'x' },
            { compteId: 'o', debit: 0, credit: 750, libelle: 'x' },
        ]);
        expect(l.destination).toEqual([
            { compteId: 'd', debit: 750, credit: 0, libelle: 'x' },
            { compteId: 'p', debit: 0, credit: 750, libelle: 'x' },
        ]);
        const solde585 = [...l.origine, ...l.destination].filter((x) => x.compteId === 'p').reduce((s, x) => s + x.debit - x.credit, 0);
        expect(solde585).toBe(0);
    });
});
describe('Les comptes de passage restent ouverts à la saisie', () => {
    it('585 et 588 sont des comptes de passage, le 581 non', () => {
        expect((0, subdivisions_du_plan_1.estCompteDePassage)('58500001')).toBe(true);
        expect((0, subdivisions_du_plan_1.estCompteDePassage)('58800000')).toBe(true);
        expect((0, subdivisions_du_plan_1.estCompteDePassage)('58100000')).toBe(false);
    });
    it('le 58500000 subdivisé par les virements n’est pas dit « subdivisé »', () => {
        const subdivises = (0, subdivisions_du_plan_1.comptesDuPlanSubdivises)('SYSCOHADA', [
            { numero: '58500001', typeCompte: 'DETAIL', estActif: true },
            { numero: '52110001', typeCompte: 'DETAIL', estActif: true },
        ]);
        expect(subdivises.has('58500000')).toBe(false);
        expect(subdivises.has('52110000')).toBe(true);
    });
});
describe('assurerComptesDePassage', () => {
    function client(existants, liens = [], avec585 = true) {
        const crees = [];
        const relies = [];
        return {
            crees,
            relies,
            tx: {
                compteVirementFonds: {
                    findMany: async () => liens,
                    create: async ({ data }) => void relies.push(data),
                },
                tenant: { findUniqueOrThrow: async () => ({ referentiel: 'SYSCOHADA', longueurCompte: 8 }) },
                compte: {
                    findUnique: async () => (avec585 ? { lettrable: false, modeReportANouveau: 'SOLDE' } : null),
                    findMany: async () => [...existants, ...crees.map((c) => c.numero)].map((numero) => ({ numero })),
                    create: async ({ data }) => {
                        crees.push(data);
                        return { id: `id-${data.numero}`, numero: data.numero, intitule: data.intitule };
                    },
                },
            },
        };
    }
    it('ouvre les quatre au rang de leur sens, personnalisés, aux réglages du 58500000', async () => {
        const c = client(['58500000']);
        const r = await (0, comptes_de_passage_1.assurerComptesDePassage)(c.tx, 't1');
        expect(c.crees.map((x) => x.numero)).toEqual(['58500001', '58500002', '58500003', '58500004']);
        expect(c.crees.every((x) => x.estRetenu && x.lettrable === false)).toBe(true);
        expect(r.CAISSE_BANQUE.numero).toBe('58500003');
        expect(c.relies).toHaveLength(4);
    });
    it('un rang déjà pris par le cabinet passe au premier numéro libre, sans rien écraser', async () => {
        const c = client(['58500000', '58500002']);
        await (0, comptes_de_passage_1.assurerComptesDePassage)(c.tx, 't1');
        expect(c.crees.map((x) => x.numero)).toEqual(['58500001', '58500003', '58500004', '58500005']);
    });
    it('ne recrée rien de ce que le dossier tient déjà', async () => {
        const liens = Object.keys(virement_fonds_1.COMPTES_DE_PASSAGE).map((sens, i) => ({
            sens,
            compte: { id: `p${i}`, numero: `5850000${i + 1}`, intitule: 'x' },
        }));
        const c = client(['58500000'], liens);
        const r = await (0, comptes_de_passage_1.assurerComptesDePassage)(c.tx, 't1');
        expect(c.crees).toEqual([]);
        expect(r.BANQUE_BANQUE.id).toBe('p0');
    });
    it('sans 58500000 au plan, refuse en le nommant', async () => {
        const c = client([], [], false);
        await expect((0, comptes_de_passage_1.assurerComptesDePassage)(c.tx, 't1')).rejects.toThrow(/58500000 « Virements de fonds » manque/);
    });
});
describe('VirementsFondsService.creer', () => {
    const passages = Object.keys(virement_fonds_1.COMPTES_DE_PASSAGE).map((sens, i) => ({
        sens,
        compte: { id: `p-${sens}`, numero: `5850000${i + 1}`, intitule: 'x' },
    }));
    function monter(journaux, ribs = [], opts = {}) {
        const creerPlusieursAvec = jest.fn(async (_t, _u, dtos, suite) => {
            const tx = {
                ecriture: { findMany: async () => [{ id: 'e1', numeroPiece: '7' }, { id: 'e2', numeroPiece: '3' }] },
                virementFonds: { create: jest.fn(async ({ data }) => ({ id: 'v1', ...data })) },
            };
            const r = await suite(tx, [{ id: 'e1' }, { id: 'e2' }]);
            return { ecritures: dtos, suite: r };
        });
        const prisma = {
            journal: { findMany: async () => journaux },
            exercice: {
                findFirst: async ({ where }) => where.id === 'x1' && where.tenantId === 't1'
                    ? {
                        dateDebut: new Date('2026-01-01T00:00:00.000Z'),
                        dateFin: new Date('2026-12-31T00:00:00.000Z'),
                        statut: opts.exerciceClos ? 'CLOTURE' : 'OUVERT',
                    }
                    : null,
            },
            ribBanque: { findMany: async () => ribs },
            tenant: { findUniqueOrThrow: async () => ({ referentiel: opts.referentiel ?? 'SYSCOHADA' }) },
            ligneEcriture: { findMany: async () => (opts.compteEnDevise ? [{ compteId: opts.compteEnDevise }] : []) },
            compteVirementFonds: { findMany: async () => passages },
            $executeRaw: async () => 0,
            $transaction: async (fn) => fn(prisma),
        };
        const verifierEcritureAutorisee = jest.fn(async (_t, journalId) => {
            if (opts.periodeClose?.journalId === journalId)
                throw new common_1.ForbiddenException(opts.periodeClose.message);
        });
        const premierJourOuvert = jest.fn(async () => new Date(`${opts.periodeClose?.premierJourOuvert ?? '2026-04-01'}T00:00:00.000Z`));
        return {
            service: new virements_fonds_service_1.VirementsFondsService(prisma, { creerPlusieursAvec }, { verifierEcritureAutorisee, premierJourOuvert }),
            creerPlusieursAvec,
            verifierEcritureAutorisee,
        };
    }
    const dto = {
        exerciceId: 'x1',
        journalOrigineId: 'ca',
        journalDestinationId: 'bq',
        montant: 1_200_000,
        sortie: { nature: 'BON_SORTIE_CAISSE', reference: ' BC-77 ', date: '2026-03-14' },
        entree: { nature: 'BORDEREAU_VERSEMENT', reference: ' BV-118 ', date: '2026-03-16' },
        objet: 'Versement de la recette',
        porteur: 'Mbuyi',
    };
    it('caisse vers banque · deux pièces au 58500003, la fiche porte les deux numéros', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        const r = await service.creer('t1', 'u1', dto);
        const [, , pieces] = creerPlusieursAvec.mock.calls[0];
        expect(pieces.map((p) => p.journalId)).toEqual(['ca', 'bq']);
        expect(pieces[0].lignes).toEqual([
            expect.objectContaining({ compteId: 'p-CAISSE_BANQUE', debit: 1_200_000, credit: 0 }),
            expect.objectContaining({ compteId: 'c-57110000', debit: 0, credit: 1_200_000 }),
        ]);
        expect(pieces[1].lignes).toEqual([
            expect.objectContaining({ compteId: 'c-52110000', debit: 1_200_000, credit: 0 }),
            expect.objectContaining({ compteId: 'p-CAISSE_BANQUE', debit: 0, credit: 1_200_000 }),
        ]);
        expect(r).toMatchObject({ sens: 'CAISSE_BANQUE', piecesPassees: 'CA n° 7 · BQ n° 3', porteur: 'Mbuyi', montant: 1_200_000 });
    });
    it('chaque écriture porte la référence et la date de SA pièce, la fiche garde les deux (demande du 2026-10-16)', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        const r = (await service.creer('t1', 'u1', dto));
        const [, , pieces] = creerPlusieursAvec.mock.calls[0];
        expect(pieces.map((p) => [p.date, p.reference])).toEqual([
            ['2026-03-14', 'Bon de sortie de caisse BC-77'],
            ['2026-03-16', 'Bordereau de versement BV-118'],
        ]);
        expect(pieces[0].libelle).toBe('Virement de fonds · Versement de la recette');
        expect(r).toMatchObject({ naturePiece: 'BON_SORTIE_CAISSE', referencePiece: 'BC-77', naturePieceEntree: 'BORDEREAU_VERSEMENT', referencePieceEntree: 'BV-118' });
        expect([r.date, r.datePiece, r.datePieceEntree].map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-03-14', '2026-03-14', '2026-03-16']);
    });
    it('refuse AVANT toute pièce une opération datée hors de l’exercice · le 585 se solde à la fin de l’exercice', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        await expect(service.creer('t1', 'u1', { ...dto, sortie: { ...dto.sortie, date: '2026-12-31' }, entree: { ...dto.entree, date: '2027-01-02' } })).rejects.toThrow(/La date de l'entrée des fonds \(02\/01\/2027\) tombe hors de l'exercice.*compte 58\)\. Une entrée qui tombe sur l'exercice suivant se passe à la main\.$/);
        await expect(service.creer('t1', 'u1', { ...dto, sortie: { ...dto.sortie, date: '2025-12-31' } })).rejects.toThrow(/^La date de la sortie des fonds \(31\/12\/2025\) tombe hors de l'exercice · le compte de passage se solde à la fin de l'exercice \(fiche du compte 58\)\.$/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('refuse AVANT toute pièce une entrée datée avant la sortie', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        await expect(service.creer('t1', 'u1', { ...dto, entree: { ...dto.entree, date: '2026-03-10' } })).rejects.toThrow(/datée avant leur sortie/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('un exercice d’un autre dossier est introuvable · lu avec le dossier de la session', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        await expect(service.creer('t2', 'u1', dto)).rejects.toThrow('Exercice introuvable pour ce dossier.');
        await expect(service.creer('t1', 'u1', { ...dto, exerciceId: 'x9' })).rejects.toThrow('Exercice introuvable pour ce dossier.');
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('une clé de trop dans une pièce est refusée, nommée, avant toute écriture (relecture TypeScript, mineur 3)', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        await expect(service.creer('t1', 'u1', { ...dto, sortie: { ...dto.sortie, tenantId: 'autre' } })).rejects.toThrow("La pièce de la sortie des fonds ne porte que sa nature, sa référence et sa date · tenantId n'y est pas admis.");
        await expect(service.creer('t1', 'u1', { ...dto, entree: { ...dto.entree, reférence: 'x' } })).rejects.toThrow(/de l'entrée des fonds .* reférence n'y est pas admis/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('une période close se dit par son opération, avant toute écriture, avec l’issue de la saisie (relecture « échecs silencieux », M4)', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [], {
            periodeClose: { journalId: 'bq', message: "La période jusqu'au 2026-03-31 est clôturée pour tous les journaux." },
        });
        await expect(service.creer('t1', 'u1', dto)).rejects.toThrow(/^Pièce de l'entrée des fonds au journal BQ · La période jusqu'au 2026-03-31 est clôturée pour tous les journaux\. Ce formulaire ne reporte pas une opération · passez ce virement à la main dans la saisie, où le report se demande\.$/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('une période close jusqu’à la fin de l’exercice ne renvoie pas à la saisie, qui refuserait le report (second tour, 3)', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [], {
            periodeClose: { journalId: 'bq', message: "La période jusqu'au 2026-12-31 est clôturée pour tous les journaux.", premierJourOuvert: '2027-01-01' },
        });
        await expect(service.creer('t1', 'u1', dto)).rejects.toThrow(/^Pièce de l'entrée des fonds au journal BQ · La période jusqu'au 2026-12-31 est clôturée pour tous les journaux\. Aucun jour de cet exercice n'est plus ouvert au journal BQ · plus rien ne s'y inscrit à cette date\.$/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('un exercice clôturé refuse le virement avant tout autre contrôle de date (second tour, 3)', async () => {
        const { service, creerPlusieursAvec, verifierEcritureAutorisee } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [], { exerciceClos: true });
        await expect(service.creer('t1', 'u1', dto)).rejects.toThrow(/^Cet exercice est clôturé · aucun virement ne s'y passe/);
        expect(verifierEcritureAutorisee).not.toHaveBeenCalled();
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('refuse AVANT toute pièce un journal qui n’est pas de trésorerie', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '40110000', { type: 'ACHAT' })]);
        await expect(service.creer('t1', 'u1', dto)).rejects.toThrow(common_1.BadRequestException);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('refuse un journal dont le RIB est en devise, et dit le geste de rechange', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [{ devise: 'USD', journal: { code: 'BQ' } }]);
        await expect(service.creer('t1', 'u1', dto)).rejects.toThrow(/BQ est tenu en USD.*à la main/);
        expect(creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('refuse une caisse en devises, qui ne porte jamais de RIB (relecture B1)', async () => {
        const syscohada = monter([banque('ca', '57120001'), banque('bq', '52110000')]);
        await expect(syscohada.service.creer('t1', 'u1', dto)).rejects.toThrow(/57120001 du journal CA est tenu en devise.*art\. 57.*à la main/);
        expect(syscohada.creerPlusieursAvec).not.toHaveBeenCalled();
        const sycebnl = monter([banque('ca', '57200001'), banque('bq', '52110000')], [], { referentiel: 'SYCEBNL' });
        await expect(sycebnl.service.creer('t1', 'u1', dto)).rejects.toThrow(/57200001/);
    });
    it('refuse un compte qui porte déjà une ligne en devise, hors de toute racine « en devises »', async () => {
        const m = monter([banque('ca', '57110000'), banque('bq', '52110000')], [], { compteEnDevise: 'c-52110000' });
        await expect(m.service.creer('t1', 'u1', dto)).rejects.toThrow(/52110000 du journal BQ est tenu en devise/);
        expect(m.creerPlusieursAvec).not.toHaveBeenCalled();
    });
    it('une sortie et une entrée du même jour donnent deux écritures à ce jour, la fiche aussi (relecture m5)', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')]);
        const r = await service.creer('t1', 'u1', { ...dto, entree: { ...dto.entree, date: '2026-03-14' } });
        const [, , pieces] = creerPlusieursAvec.mock.calls[0];
        expect(pieces.map((p) => p.date)).toEqual(['2026-03-14', '2026-03-14']);
        expect(r.date.toISOString().slice(0, 10)).toBe('2026-03-14');
    });
    it('un RIB au franc ne gêne rien', async () => {
        const { service, creerPlusieursAvec } = monter([banque('ca', '57110000'), banque('bq', '52110000')], [{ devise: 'cdf', journal: { code: 'BQ' } }]);
        await service.creer('t1', 'u1', dto);
        expect(creerPlusieursAvec).toHaveBeenCalledTimes(1);
    });
});
describe('VirementsFondsService.annuler', () => {
    function monter(opts) {
        const updates = [];
        const supprimes = [];
        const inscrireEnNegatifPourAnnulation = jest.fn(async (_t, _u, id) => ({ id: `neg-${id}` }));
        const prisma = {
            virementFonds: {
                findFirst: async () => ({
                    id: 'v1',
                    annuleLe: opts.annuleLe ?? null,
                    piecesPassees: 'BQ n° 12 · CA n° 7',
                    ecritureOrigineId: 'e1',
                    ecritureDestinationId: 'e2',
                    exercice: { statut: opts.exercice ?? client_1.StatutExercice.OUVERT },
                }),
                update: async ({ data }) => {
                    updates.push(data);
                    return { id: 'v1', ...data };
                },
                updateMany: async ({ data }) => {
                    updates.push(data);
                    return { count: opts.dejaPrise ? 0 : 1 };
                },
            },
            ecriture: {
                findMany: async () => ['e1', 'e2'].map((id) => ({ id, numeroPiece: id, statut: opts.statuts[id], lignes: [{ lettre: opts.lettre ?? null, lettrageId: opts.lettre ? 'g1' : null, rapprochementId: null }] })),
                findFirst: async ({ where }) => ({ statut: opts.statuts[where.id], numeroPiece: `N-${where.id}` }),
                deleteMany: async ({ where }) => {
                    supprimes.push(where.id);
                    return { count: opts.supprimees ?? 1 };
                },
            },
            ligneEcriture: {
                deleteMany: async () => ({ count: 2 }),
                findMany: async () => [{ lettre: opts.lettreEnCours ?? null, lettrageId: opts.lettreEnCours ? 'g2' : null, rapprochementId: null }],
            },
        };
        prisma.$transaction = async (fn) => fn(prisma);
        const service = new virements_fonds_service_1.VirementsFondsService(prisma, { inscrireEnNegatifPourAnnulation }, {});
        return { service, updates, supprimes, inscrireEnNegatifPourAnnulation };
    }
    it('au brouillard · les deux pièces retirées, la fiche marquée annulée, jamais supprimée', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD } });
        await m.service.annuler('t1', 'u1', 'v1', { motif: ' Doublon ' });
        expect(m.supprimes).toEqual(['e1', 'e2']);
        expect(m.inscrireEnNegatifPourAnnulation).not.toHaveBeenCalled();
        expect(m.updates.at(-1)).toMatchObject({ annulePar: 'u1', motifAnnulation: 'Doublon', ecritureOrigineId: null, ecritureDestinationId: null });
    });
    it('validées · chacune inscrite en négatif (AUDCIF art. 20, al. 2), la fiche retient pièce et négatif', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.VALIDEE, e2: client_1.StatutEcriture.VALIDEE } });
        await m.service.annuler('t1', 'u1', 'v1', { motif: 'Erreur de caisse' });
        expect(m.supprimes).toEqual([]);
        expect(m.inscrireEnNegatifPourAnnulation.mock.calls.map((c) => c[2])).toEqual(['e1', 'e2']);
        expect(m.updates.at(-1)).toMatchObject({
            ecritureOrigineId: 'e1',
            ecritureDestinationId: 'e2',
            ecritureNegatifOrigineId: 'neg-e1',
            ecritureNegatifDestinationId: 'neg-e2',
        });
    });
    it('une pièce validée entre-temps · rien ne passe, 409 qui dit de relancer', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD }, supprimees: 0 });
        await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/validée pendant l'annulation/);
    });
    it('refuse une ligne lettrée, un exercice clôturé, un virement déjà annulé', async () => {
        await expect(monter({ statuts: { e1: client_1.StatutEcriture.VALIDEE, e2: client_1.StatutEcriture.VALIDEE }, lettre: 'AA' }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' })).rejects.toThrow(common_1.BadRequestException);
        await expect(monter({ statuts: {}, exercice: client_1.StatutExercice.CLOTURE }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' })).rejects.toThrow(/clôturé/);
        await expect(monter({ statuts: {}, annuleLe: new Date() }).service.annuler('t1', 'u1', 'v1', { motif: 'x y z' })).rejects.toThrow(common_1.ConflictException);
    });
    it('un lettrage posé pendant l’annulation sur une pièce au brouillard refuse, rien n’est retiré (relecture M1)', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD }, lettreEnCours: 'AB' });
        await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/lettrées/);
        expect(m.supprimes).toEqual([]);
    });
    it('une seconde annulation concurrente dit « déjà annulé » (relecture m1)', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD }, dejaPrise: true });
        await expect(m.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' })).rejects.toThrow(/déjà annulé/);
        expect(m.supprimes).toEqual([]);
    });
    it('un motif fait d’espaces est refusé (relecture m2)', async () => {
        const m = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD } });
        await expect(m.service.annuler('t1', 'u1', 'v1', { motif: '     ' })).rejects.toThrow(/motif/);
    });
    it('la trace dit ce qui est arrivé aux pièces · retirées, ou inscrites en négatif avec leurs numéros (relecture m4)', async () => {
        const brouillard = monter({ statuts: { e1: client_1.StatutEcriture.BROUILLARD, e2: client_1.StatutEcriture.BROUILLARD } });
        await brouillard.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' });
        expect(brouillard.updates.at(-1).piecesPassees).toBe('BQ n° 12 · CA n° 7 · retirées du brouillard, numéros libérés');
        const validees = monter({ statuts: { e1: client_1.StatutEcriture.VALIDEE, e2: client_1.StatutEcriture.VALIDEE } });
        await validees.service.annuler('t1', 'u1', 'v1', { motif: 'Doublon' });
        expect(validees.updates.at(-1).piecesPassees).toBe('BQ n° 12 · CA n° 7 · inscrites en négatif (n° N-neg-e1, n° N-neg-e2)');
    });
});
describe('VirementsFondsService.deposerPiece', () => {
    const PDF = Buffer.from('%PDF-1.4\n% e2e\n%%EOF\n', 'latin1');
    function monter(ancien = null) {
        const crees = [];
        const lus = [];
        const prisma = {
            virementFonds: { findFirst: async () => ({ id: 'v1' }) },
            pieceVirementFonds: {
                findFirst: async (args) => {
                    lus.push(args);
                    return ancien;
                },
                create: async ({ data }) => {
                    crees.push(data);
                    return { id: 'p1', operation: data.operation, nomFichier: data.nomFichier, taille: data.taille };
                },
            },
        };
        return { service: new virements_fonds_service_1.VirementsFondsService(prisma, {}, {}), crees, lus };
    }
    it('un scan se joint à UNE opération, nommée', async () => {
        const m = monter();
        await m.service.deposerPiece('t1', 'v1', 'ENTREE', { originalname: 'bordereau.pdf', buffer: PDF }, 'a@b.cd');
        expect(m.crees[0]).toMatchObject({ virementId: 'v1', operation: 'ENTREE', nomFichier: 'bordereau.pdf' });
    });
    it('sans opération, ou avec une autre, le refus le dit et rien n’est déposé', async () => {
        const m = monter();
        for (const operation of [undefined, 'VIREMENT']) {
            await expect(m.service.deposerPiece('t1', 'v1', operation, { originalname: 'b.pdf', buffer: PDF }, 'a@b.cd')).rejects.toThrow(/sortie des fonds \(SORTIE\) ou leur entrée \(ENTREE\)/);
        }
        expect(m.crees).toEqual([]);
    });
    it('un scan déjà joint au virement entier (avant la distinction) ne se rejoint pas à une opération · 409 qui le nomme', async () => {
        const m = monter({ nomFichier: 'ordre-001.pdf' });
        await expect(m.service.deposerPiece('t1', 'v1', 'SORTIE', { originalname: 'ordre.pdf', buffer: PDF }, 'a@b.cd')).rejects.toThrow('Ce scan est déjà joint au virement entier (« ordre-001.pdf »).');
        expect(m.crees).toEqual([]);
        expect(m.lus[0]).toMatchObject({ where: { tenantId: 't1', virementId: 'v1', operation: null, empreinte: expect.any(String) } });
    });
    it('le même scan joint deux fois à l’entrée est refusé en le disant, article élidé', async () => {
        const prisma = {
            virementFonds: { findFirst: async () => ({ id: 'v1' }) },
            pieceVirementFonds: {
                findFirst: async () => null,
                create: async () => {
                    throw new client_1.Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
                },
            },
        };
        const service = new virements_fonds_service_1.VirementsFondsService(prisma, {}, {});
        await expect(service.deposerPiece('t1', 'v1', 'ENTREE', { originalname: 'b.pdf', buffer: PDF }, 'a@b.cd')).rejects.toThrow("Cette pièce est déjà jointe à l'entrée des fonds.");
        await expect(service.deposerPiece('t1', 'v1', 'SORTIE', { originalname: 'b.pdf', buffer: PDF }, 'a@b.cd')).rejects.toThrow('Cette pièce est déjà jointe à la sortie des fonds.');
    });
});
describe('La trésorerie en devises se lit dans le plan de chaque référentiel', () => {
    it('chaque racine est semée par son plan sous un intitulé « devise »', () => {
        for (const [ref, plan] of [
            ['SYSCOHADA', compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA],
            ['SYCEBNL', compte_seed_1.PLAN_COMPTES_SYCEBNL],
        ]) {
            for (const racine of virement_fonds_1.RACINES_TRESORERIE_EN_DEVISES[ref]) {
                const seme = plan.find((c) => c.numero === racine.padEnd(8, "0"));
                expect({ ref, racine, intitule: seme?.intitule }).toEqual({ ref, racine, intitule: expect.stringMatching(/devise/i) });
            }
        }
    });
    it('un numéro, deux sens · le 5712 est une caisse en devises au SYSCOHADA seulement', () => {
        expect((0, virement_fonds_1.estTresorerieEnDevises)('57120001', 'SYSCOHADA')).toBe(true);
        expect((0, virement_fonds_1.estTresorerieEnDevises)('57120001', 'SYCEBNL')).toBe(false);
        expect((0, virement_fonds_1.estTresorerieEnDevises)('57200003', 'SYCEBNL')).toBe(true);
        expect((0, virement_fonds_1.estTresorerieEnDevises)('52110000', 'SYSCOHADA')).toBe(false);
    });
});
describe('Le centime se juge sans seuil (relecture M1)', () => {
    it('admet les montants justes au-delà de cent millions, refuse le millième', () => {
        expect((0, virement_fonds_1.estAuCentime)(136_620_326.98)).toBe(true);
        expect((0, virement_fonds_1.estAuCentime)(999_999_999.99)).toBe(true);
        expect((0, virement_fonds_1.estAuCentime)(1000.555)).toBe(false);
        expect((0, virement_fonds_1.motifRefusVirement)(banque('a', '52110000'), banque('b', '52120000'), { ...DEMANDE, entree: { ...DEMANDE.entree, nature: 'AVIS_CREDIT' }, montant: 136_620_326.98 })).toBeNull();
    });
});
describe('La pièce suit sa trésorerie (demande de Manasse du 2026-10-16)', () => {
    const bq = banque('bq', '52110000');
    const ca = banque('ca', '57110000');
    const bq2 = banque('bq2', '52120000');
    const piece = (nature) => ({ nature, reference: 'P 1', date: '2026-03-14' });
    it('sortie d’une caisse · le bon de sortie ; entrée d’une caisse · le bon d’entrée', () => {
        expect((0, virement_fonds_1.naturesProposees)(client_1.SensVirementFonds.CAISSE_BANQUE, 'SORTIE')).toEqual(['BON_SORTIE_CAISSE', 'AUTRE']);
        expect((0, virement_fonds_1.naturesProposees)(client_1.SensVirementFonds.BANQUE_CAISSE, 'ENTREE')).toEqual(['BON_ENTREE_CAISSE', 'AUTRE']);
    });
    it('sortie d’une banque · ordre, chèque, avis de débit, extrait ; entrée · bordereaux, avis de crédit, extrait', () => {
        expect((0, virement_fonds_1.naturesProposees)(client_1.SensVirementFonds.BANQUE_CAISSE, 'SORTIE')).toEqual(['ORDRE_VIREMENT', 'CHEQUE', 'AVIS_DEBIT', 'EXTRAIT_COMPTE', 'AUTRE']);
        expect((0, virement_fonds_1.naturesProposees)(client_1.SensVirementFonds.CAISSE_BANQUE, 'ENTREE')).toEqual([
            'BORDEREAU_VERSEMENT',
            'BORDEREAU_REMISE_CHEQUE',
            'AVIS_CREDIT',
            'EXTRAIT_COMPTE',
            'AUTRE',
        ]);
        for (const parOperation of Object.values(virement_fonds_1.NATURES_PROPOSEES))
            for (const liste of Object.values(parOperation))
                expect(liste[liste.length - 1]).toBe('AUTRE');
    });
    it('un bon de caisse sur une banque, un avis sur une caisse, se refusent en nommant les pièces admises', () => {
        expect((0, virement_fonds_1.motifRefusVirement)(bq, ca, { ...DEMANDE, sortie: piece('BON_SORTIE_CAISSE') })).toBe("La pièce de la sortie des fonds d'une banque se choisit parmi · Ordre de virement, Chèque, Avis de débit, Extrait de compte, Autre pièce.");
        expect((0, virement_fonds_1.motifRefusVirement)(bq, ca, { ...DEMANDE, entree: piece('AVIS_CREDIT') })).toBe("La pièce de l'entrée des fonds d'une caisse se choisit parmi · Bon d'entrée de caisse, Autre pièce.");
        expect((0, virement_fonds_1.motifRefusVirement)(ca, bq, { ...DEMANDE, sortie: piece('CHEQUE'), entree: piece('AVIS_CREDIT') })).toMatch(/sortie des fonds d'une caisse/);
        expect((0, virement_fonds_1.motifRefusVirement)(bq, bq2, { ...DEMANDE, entree: piece('BON_ENTREE_CAISSE') })).toMatch(/entrée des fonds d'une banque/);
        expect((0, virement_fonds_1.motifRefusVirement)(bq, bq2, { ...DEMANDE, entree: piece('AUTRE') })).toBeNull();
    });
    it('les natures d’avant se lisent sur les virements passés, mais ne se proposent plus', () => {
        for (const ancienne of ['BON_CAISSE', 'AVIS_DEBIT_CREDIT']) {
            expect(virement_fonds_1.LIBELLES_NATURE_PIECE[ancienne]).toBeTruthy();
            expect((0, virement_fonds_1.motifRefusVirement)(bq, ca, { ...DEMANDE, sortie: piece(ancienne) })).toMatch(/se choisit parmi/);
            expect((0, virement_fonds_1.motifRefusVirement)(bq, ca, { ...DEMANDE, entree: piece(ancienne) })).toMatch(/se choisit parmi/);
        }
    });
});
//# sourceMappingURL=virement-fonds.spec.js.map