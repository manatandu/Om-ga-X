"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const bareme_amortissement_013_2025_1 = require("./bareme-amortissement-013-2025");
const bareme_comptes_013_2025_1 = require("./bareme-comptes-013-2025");
const bareme_comptes_1 = require("./bareme-comptes");
const immobilisation_service_1 = require("./immobilisation.service");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const SEMIS = {
    SYSCOHADA: new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c])),
    SYCEBNL: new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c])),
};
describe('la correspondance engendrée', () => {
    it('couvre les 131 natures de l’art. 2, dans l’ordre de la table du barème', () => {
        expect(bareme_comptes_013_2025_1.CORRESPONDANCE_BAREME_COMPTES.map((c) => c.cle)).toEqual(bareme_amortissement_013_2025_1.BAREME_AMORTISSEMENT_013_2025.map((n) => n.cle));
    });
    it('chaque numéro proposé est un compte de détail 21 à 24 de SON semis', () => {
        const fautes = [];
        for (const c of bareme_comptes_013_2025_1.CORRESPONDANCE_BAREME_COMPTES) {
            for (const ref of ['SYSCOHADA', 'SYCEBNL']) {
                for (const n of c[ref].comptes) {
                    const compte = SEMIS[ref].get(n);
                    if (!compte || !/^2[1-4]/.test(n) || (compte.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL) !== client_1.TypeCompteDetailTotal.DETAIL) {
                        fautes.push(`${c.cle} ${ref} ${n}`);
                    }
                }
            }
        }
        expect(fautes).toEqual([]);
    });
    it('un numéro, deux sens · le SYCEBNL ne propose jamais son 2443 (religieux) ni son 2444 (sportif) pour du bureau', () => {
        const proposes = bareme_comptes_013_2025_1.CORRESPONDANCE_BAREME_COMPTES.flatMap((c) => c.SYCEBNL.comptes);
        expect(proposes).not.toContain('24430000');
        expect(proposes).not.toContain('24440000');
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYSCOHADA', 'VI.2').comptes).toEqual(['24440000']);
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYCEBNL', 'VI.2').comptes).toEqual(['24410000']);
    });
    it('le fichier committé est celui que la source engendre', () => {
        const dossier = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'bareme-comptes-'));
        const sortie = (0, node_path_1.join)(dossier, 'engendre.ts');
        (0, node_child_process_1.execFileSync)('node', [(0, node_path_1.join)(__dirname, '../../../scripts/extraire-bareme-comptes.cjs'), sortie]);
        expect((0, node_fs_1.readFileSync)(sortie, 'utf8')).toBe((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'bareme-comptes-013-2025.ts'), 'utf8'));
    });
});
describe('dans les deux sens · décision D-4', () => {
    it('la nature propose ses comptes, le premier en tête ; aucun si le plan n’en ouvre pas', () => {
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYSCOHADA', 'I.1').comptes).toEqual(['21210000', '21220000', '21310000']);
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYSCOHADA', 'I.2').comptes).toEqual(['21500000']);
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYCEBNL', 'I.2').comptes).toEqual([]);
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYCEBNL', 'I.2').remarque).toMatch(/215/);
        expect((0, bareme_comptes_1.comptesDeLaNature)('SYSCOHADA', 'ZZ.9').comptes).toEqual([]);
    });
    it('le compte ne propose que ses natures, sous-compte du cabinet compris', () => {
        expect((0, bareme_comptes_1.naturesDuCompte)('SYSCOHADA', '24510000')).toEqual(['V.14', 'V.15', 'V.16', 'V.17', 'V.18']);
        expect((0, bareme_comptes_1.naturesDuCompte)('SYSCOHADA', '24511000')).toEqual((0, bareme_comptes_1.naturesDuCompte)('SYSCOHADA', '24510000'));
        expect((0, bareme_comptes_1.naturesDuCompte)('SYCEBNL', '24410000')).toContain('VI.2');
        expect((0, bareme_comptes_1.naturesDuCompte)('SYSCOHADA', '24410000')).not.toContain('VI.2');
        expect((0, bareme_comptes_1.naturesDuCompte)('SYSCOHADA', '22200000')).toEqual([]);
    });
    it('le serveur sert le barème avec les comptes du référentiel du dossier', async () => {
        const prisma = { tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) } };
        const svc = new immobilisation_service_1.ImmobilisationService(prisma, {});
        const bareme = await svc.baremeFiscal('t');
        expect(bareme).toHaveLength(131);
        expect(bareme.find((n) => n.cle === 'VI.2')).toMatchObject({ dureeAns: 10, comptes: ['24410000'] });
        expect(prisma.tenant.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 't' }, select: { referentiel: true } });
    });
});
//# sourceMappingURL=bareme-comptes.spec.js.map