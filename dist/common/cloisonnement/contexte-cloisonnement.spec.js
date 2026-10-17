"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contexte_cloisonnement_1 = require("./contexte-cloisonnement");
function promesseParesseuse(travail) {
    let lance = false;
    return {
        get aEteLance() {
            return lance;
        },
        then(resoudre, rejeter) {
            lance = true;
            try {
                resoudre(travail());
            }
            catch (erreur) {
                rejeter(erreur);
            }
        },
    };
}
describe('sortie de cloisonnement et promesse paresseuse', () => {
    it('la raison est encore lisible quand la promesse s’exécute enfin', async () => {
        let raisonVueAuLancement = 'jamais lancée';
        const paresseuse = promesseParesseuse(() => {
            raisonVueAuLancement = (0, contexte_cloisonnement_1.raisonHorsCloisonnement)();
            return 'fait';
        });
        const rendu = await (0, contexte_cloisonnement_1.horsCloisonnement)('démarrage · promotion des opérateurs', () => paresseuse);
        expect(rendu).toBe('fait');
        expect(paresseuse.aEteLance).toBe(true);
        expect(raisonVueAuLancement).toBe('démarrage · promotion des opérateurs');
    });
    it('la portée se referme une fois la sortie consommée', async () => {
        await (0, contexte_cloisonnement_1.horsCloisonnement)('console · dossier créé par l’opérateur', async () => undefined);
        expect((0, contexte_cloisonnement_1.raisonHorsCloisonnement)()).toBeUndefined();
    });
    it('un rejet de la promesse paresseuse remonte tel quel', async () => {
        const paresseuse = promesseParesseuse(() => {
            throw new Error('la base a dit non');
        });
        await expect((0, contexte_cloisonnement_1.horsCloisonnement)('connexion', () => paresseuse)).rejects.toThrow('la base a dit non');
    });
    it('une valeur qui n’est pas une promesse traverse sans être enveloppée', () => {
        expect((0, contexte_cloisonnement_1.horsCloisonnement)('semis', () => 42)).toBe(42);
    });
});
//# sourceMappingURL=contexte-cloisonnement.spec.js.map