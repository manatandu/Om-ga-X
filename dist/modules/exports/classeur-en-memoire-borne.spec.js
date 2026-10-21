"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const export_service_1 = require("./export.service");
const LIGNE = { date: new Date('2026-03-01'), journalCode: 'BQ', numeroPiece: 1, libelle: 'x', debit: 1, credit: 0 };
function service(nbLignes) {
    const lignes = Array.from({ length: nbLignes }, () => LIGNE);
    const ecritures = {
        grandLivre: jest.fn().mockResolvedValue({ compte: { numero: '52110000', intitule: 'Banque' }, lignes, soldeFinal: 0 }),
        justificatifSolde: jest.fn().mockResolvedValue({ compte: { numero: '52110000', intitule: 'Banque' }, lignes }),
    };
    return new export_service_1.ExportService({}, ecritures, {}, {}, {}, {}, {}, {}, {}, {});
}
describe('F101 · un classeur bâti en mémoire est borné', () => {
    it('le grand livre d’un compte au-delà de 50 000 lignes est refusé, et renvoie au grand livre complet', async () => {
        const refus = service(50_001).grandLivreExcel('t1', 'c1', 'ex');
        await expect(refus).rejects.toBeInstanceOf(common_1.PayloadTooLargeException);
        await expect(service(50_001).grandLivreExcel('t1', 'c1', 'ex')).rejects.toThrow(/Grand livre du compte 52110000 : 50\s001 lignes/);
        await expect(service(50_001).grandLivreExcel('t1', 'c1', 'ex')).rejects.toThrow('grand livre complet');
    });
    it('le justificatif au-delà de 50 000 lignes est refusé, avec son chemin de rechange', async () => {
        await expect(service(50_001).justificatifSoldeExcel('t1', 'c1', 'ex')).rejects.toThrow("Masquez les lignes lettrées ou choisissez une date d'arrêt antérieure.");
    });
    it('50 000 lignes passent la borne', () => {
        expect(() => service(0).refuserClasseurEnMemoire(50_000, 'x', 'y')).not.toThrow();
        expect(() => service(0).refuserClasseurEnMemoire(50_001, 'x', 'y')).toThrow(common_1.PayloadTooLargeException);
    });
});
//# sourceMappingURL=classeur-en-memoire-borne.spec.js.map