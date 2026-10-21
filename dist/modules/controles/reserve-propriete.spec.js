"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const l = (numero, debit, credit = 0, statut = client_1.StatutEcriture.VALIDEE, exerciceId = 'ex') => ({
    numero,
    debit,
    credit,
    statut,
    exerciceId,
});
function service(lignes, referentiel = client_1.Referentiel.SYSCOHADA, systeme = client_1.SystemeComptableSyscohada.NORMAL) {
    const groupBy = jest.fn(async ({ where }) => {
        const prefixes = (where?.OR ?? []).map((o) => o.compte?.numero?.startsWith).filter(Boolean);
        const retenues = lignes.filter((x) => (where?.OR === undefined || prefixes.some((p) => x.numero.startsWith(p))) &&
            (where?.ecriture?.statut === undefined || x.statut === where.ecriture.statut) &&
            (where?.ecriture?.exerciceId === undefined || x.exerciceId === where.ecriture.exerciceId));
        const parCompte = new Map();
        for (const x of retenues) {
            const acc = parCompte.get(x.numero) ?? { debit: 0, credit: 0 };
            acc.debit += x.debit;
            acc.credit += x.credit;
            parCompte.set(x.numero, acc);
        }
        return [...parCompte.entries()].map(([numero, s]) => ({ compteId: `id-${numero}`, _sum: s }));
    });
    const numeros = [...new Set(lignes.map((x) => x.numero))];
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                dateArreteComptes: null,
            }),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                nom: 'Dossier',
                referentiel,
                systemeComptableSyscohada: systeme,
                formeJuridiqueSyscohada: null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: {
            findMany: jest.fn(async (a) => {
                const ids = a?.where?.id?.in;
                if (!ids)
                    return [];
                return numeros.filter((n) => ids.includes(`id-${n}`)).map((n) => ({ id: `id-${n}`, numero: n }));
            }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new controles_service_1.ControlesService(prisma), groupBy };
}
const trouver = async (lignes, referentiel, systeme) => {
    const { svc } = service(lignes, referentiel, systeme);
    const rapport = await svc.analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === 'RESERVE_PROPRIETE_A_MENTIONNER');
};
describe('RESERVE_PROPRIETE_A_MENTIONNER', () => {
    it('se déclenche sur un solde de clôture, rend les soldes par racine et rappelle les quatre montants', async () => {
        const a = await trouver([l('41160000', 5_000_000), l('41160000', 0, 1_000_000), l('90830000', 0, 2_500_000)]);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
        expect(a.occurrences).toEqual([
            { reference: '4116 Clients, réserve de propriété', detail: 'Solde débiteur à la clôture (livre-journal)', montant: 4_000_000 },
            { reference: '9083 Achats avec clause de réserve de propriété', detail: 'Solde créditeur à la clôture (livre-journal)', montant: -2_500_000 },
        ]);
        expect(a.consequence).toContain('AUDCIF, Titre VIII ch. 9, section 3');
        expect(a.consequence).toContain('immobilisations, des stocks, des clients (et autres créances) et des fournisseurs');
        expect(a.consequence).toContain('Note 7 (4116)');
        expect(a.action).toContain('Note 2 D');
        expect(a.action).toContain('emplacement retenu par OmegaX');
        expect(a.action).toContain('dérisoires');
        expect(a.action).toContain('inventaire permanent (§ 3.1)');
    });
    it('additionne les sous-comptes d’une même racine, chacune des cinq', async () => {
        const a = await trouver([
            l('40160000', 0, 300),
            l('40161000', 0, 200),
            l('48160000', 0, 700),
            l('90430000', 900),
        ]);
        expect(a.occurrences.map((o) => [o.reference.slice(0, 4), o.montant])).toEqual([
            ['4016', -500],
            ['4816', -700],
            ['9043', 900],
        ]);
    });
    it('ne lit que le livre-journal · une écriture au brouillard ne le déclenche pas', async () => {
        expect(await trouver([l('48160000', 0, 700, client_1.StatutEcriture.BROUILLARD)])).toBeUndefined();
    });
    it('ne lit que l’exercice demandé', async () => {
        expect(await trouver([l('41160000', 800, 0, client_1.StatutEcriture.VALIDEE, 'autre')])).toBeUndefined();
    });
    it('se tait sur un compte soldé et sur les comptes voisins (4011, 4117)', async () => {
        expect(await trouver([l('41160000', 500), l('41160000', 0, 500), l('40110000', 0, 900), l('41170000', 400)])).toBeUndefined();
    });
    it('est borné au SYSCOHADA Système normal · ni le Système minimal, ni le SYCEBNL', async () => {
        const lignes = [l('41160000', 500)];
        expect(await trouver(lignes, client_1.Referentiel.SYSCOHADA, client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).toBeUndefined();
        expect(await trouver(lignes, client_1.Referentiel.SYCEBNL, null)).toBeUndefined();
        expect(await trouver(lignes, client_1.Referentiel.SYSCOHADA, client_1.SystemeComptableSyscohada.NORMAL)).toBeDefined();
    });
    it('câblage · une seule lecture regroupée, livre-journal de l’exercice, bornée au dossier, sur les cinq racines', async () => {
        const { svc, groupBy } = service([l('41160000', 500)]);
        await svc.analyser('t', 'ex');
        const appel = groupBy.mock.calls
            .map((c) => c[0])
            .find((c) => (c.where?.OR ?? []).some((o) => o.compte?.numero?.startsWith === '4116'));
        expect(appel?.where?.ecriture).toEqual({ tenantId: 't', exerciceId: 'ex', statut: client_1.StatutEcriture.VALIDEE });
        expect(appel?.where?.OR).toEqual(['4016', '4816', '4116', '9043', '9083'].map((r) => ({ compte: { tenantId: 't', numero: { startsWith: r } } })));
        expect(controles_service_1.RACINES_RESERVE_PROPRIETE.map((r) => r.racine)).toEqual(['4016', '4816', '4116', '9043', '9083']);
    });
});
describe('RESERVE_PROPRIETE_A_MENTIONNER · la prémisse relue dans le semis SYSCOHADA', () => {
    it('chaque racine est ouverte au plan semé, sous un intitulé de réserve de propriété', () => {
        const semis = require('fs').readFileSync(require('path').join(__dirname, '../comptes/compte-seed-syscohada.ts'), 'utf8');
        for (const { racine } of controles_service_1.RACINES_RESERVE_PROPRIETE) {
            expect(semis).toMatch(new RegExp(`'${racine}0000', '[^']*[Rr]éserve de propriété`));
        }
    });
});
//# sourceMappingURL=reserve-propriete.spec.js.map