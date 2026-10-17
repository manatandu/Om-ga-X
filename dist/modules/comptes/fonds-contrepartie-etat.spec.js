"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const compte_service_1 = require("./compte.service");
const fonds_contrepartie_etat_1 = require("./fonds-contrepartie-etat");
const PROJET = { referentiel: client_1.Referentiel.SYCEBNL, jeu: client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT };
describe('Contrepartie de l’État · le compte se déclare', () => {
    it('admis sur un compte de trésorerie de détail d’un dossier projets, non rattaché à un bailleur', () => {
        for (const numero of ['51210000', '52110000', '53110000', '55100000', '57100000']) {
            expect({ numero, motif: (0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ ...PROJET, numero, typeCompte: client_1.TypeCompteDetailTotal.DETAIL, bailleurId: null }) }).toEqual({
                numero,
                motif: null,
            });
        }
    });
    it('refusé hors du jeu projets, hors trésorerie, sur un Total, sur un compte de bailleur', () => {
        const detail = { numero: '57100000', typeCompte: client_1.TypeCompteDetailTotal.DETAIL, bailleurId: null };
        expect((0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ referentiel: client_1.Referentiel.SYSCOHADA, jeu: null, ...detail })).toMatch(/projets de développement/);
        expect((0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ referentiel: client_1.Referentiel.SYCEBNL, jeu: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, ...detail })).toMatch(/projets de développement/);
        expect((0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ ...PROJET, ...detail, numero: '46300000' })).toMatch(/51, 52, 53, 55, 57/);
        expect((0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ ...PROJET, ...detail, numero: '57', typeCompte: client_1.TypeCompteDetailTotal.TOTAL })).toMatch(/Total/);
        expect((0, fonds_contrepartie_etat_1.motifRefusFondsContrepartieEtat)({ ...PROJET, ...detail, bailleurId: 'b1' })).toMatch(/bailleur/);
    });
    it('la route refuse la déclaration sur un compte rattaché à un bailleur, et passe le geste juste', async () => {
        const compte = {
            id: 'c1',
            tenantId: 't1',
            numero: '57100000',
            typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
            bailleurId: 'b1',
            porteFondsContrepartieEtat: false,
        };
        const update = jest.fn().mockResolvedValue({});
        const prisma = {
            compte: { findFirst: jest.fn().mockResolvedValue(compte), update },
            tenant: {
                findUniqueOrThrow: jest
                    .fn()
                    .mockResolvedValue({ referentiel: client_1.Referentiel.SYCEBNL, jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT }),
            },
            bailleur: { findFirst: jest.fn() },
        };
        const s = new compte_service_1.CompteService(prisma);
        await expect(s.modifier('t1', 'c1', { porteFondsContrepartieEtat: true })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(update).not.toHaveBeenCalled();
        await s.modifier('t1', 'c1', { porteFondsContrepartieEtat: true, bailleurId: null });
        expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { porteFondsContrepartieEtat: true, bailleurId: null } });
    });
});
//# sourceMappingURL=fonds-contrepartie-etat.spec.js.map