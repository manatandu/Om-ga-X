"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lecture_par_lots_1 = require("./lecture-par-lots");
describe('lecture par tranches · les outils', () => {
    it('pageApres ordonne par identifiant, et exclut le curseur de la tranche suivante', () => {
        expect((0, lecture_par_lots_1.pageApres)(undefined, 500)).toEqual({ orderBy: { id: 'asc' }, take: 500 });
        expect((0, lecture_par_lots_1.pageApres)('e-9', 500)).toEqual({ orderBy: { id: 'asc' }, take: 500, cursor: { id: 'e-9' }, skip: 1 });
    });
    it('une collecte garde sa tête, compte tout, et dit qu’elle est tronquée', () => {
        const c = new lecture_par_lots_1.Collecte(3);
        for (let i = 0; i < 5; i++)
            c.ajouter(i);
        expect(c.elements).toEqual([0, 1, 2]);
        expect(c.nombre).toBe(5);
        expect(c.tronquee).toBe(true);
        const d = new lecture_par_lots_1.Collecte(3);
        d.ajouter(1);
        expect(d.tronquee).toBe(false);
    });
    it('les N premiers selon un ordre, quel que soit l’ordre d’arrivée', () => {
        const p = new lecture_par_lots_1.PremiersSelon(3, (a, b) => a - b);
        for (const x of [9, 4, 8, 1, 7, 2, 6, 3, 5, 0])
            p.ajouter(x);
        expect(p.elements()).toEqual([0, 1, 2]);
        expect(p.nombre).toBe(10);
        expect(p.tronquee).toBe(true);
    });
    it('sous la capacité, tout est gardé et rien n’est dit tronqué', () => {
        const p = new lecture_par_lots_1.PremiersSelon(5, (a, b) => a - b);
        for (const x of [3, 1, 2])
            p.ajouter(x);
        expect(p.elements()).toEqual([1, 2, 3]);
        expect(p.tronquee).toBe(false);
    });
});
function valeur(v) {
    return v instanceof Date ? v.getTime() : v;
}
function satisfait(r, where) {
    return Object.entries(where).every(([cle, attendu]) => {
        if (cle === 'OR')
            return attendu.some((b) => satisfait(r, b));
        if (cle === 'AND')
            return attendu.every((b) => satisfait(r, b));
        const v = r[cle];
        if (attendu === null)
            return v === null;
        if (attendu && typeof attendu === 'object' && !(attendu instanceof Date) && 'gt' in attendu) {
            return v !== null && valeur(v) > valeur(attendu.gt);
        }
        return v !== null && valeur(v) === valeur(attendu);
    });
}
function ordre(a, b) {
    const d = a.date.getTime() - b.date.getTime();
    if (d !== 0)
        return d;
    if (a.piece !== b.piece) {
        if (a.piece === null)
            return 1;
        if (b.piece === null)
            return -1;
        return a.piece - b.piece;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
describe('pagination par la clé · ce qui disparaît pendant le parcours ne l’arrête plus (sage-l7, M6)', () => {
    const jour = (j) => new Date(Date.UTC(2026, 0, j));
    const base = () => [
        { id: 'a1', date: jour(1), piece: 1 },
        { id: 'a2', date: jour(1), piece: 2 },
        { id: 'a3', date: jour(1), piece: null },
        { id: 'b1', date: jour(2), piece: 1 },
        { id: 'b2', date: jour(2), piece: 1 },
        { id: 'b3', date: jour(2), piece: null },
        { id: 'b4', date: jour(2), piece: null },
        { id: 'c1', date: jour(3), piece: 7 },
    ];
    function parcourir(lignes, cleDe) {
        const lues = [];
        let derniere;
        for (;;) {
            const restantes = lignes.filter((r) => !derniere || satisfait(r, cleDe(derniere))).sort(ordre).slice(0, 2);
            lues.push(...restantes.map((r) => r.id));
            if (restantes.length < 2)
                return lues;
            derniere = restantes[restantes.length - 1];
            lignes.splice(lignes.findIndex((r) => r.id === derniere.id), 1);
        }
    }
    it('apresLaCle rend chaque ligne restante une fois, dans l’ordre, nuls en dernier', () => {
        const lues = parcourir(base(), (d) => (0, lecture_par_lots_1.apresLaCle)([
            { champ: 'date', valeur: d.date },
            { champ: 'piece', valeur: d.piece, nullable: true },
            { champ: 'id', valeur: d.id },
        ]));
        expect(lues).toEqual(base().sort(ordre).map((r) => r.id));
    });
    it('le curseur de Prisma, lui, s’arrêtait à la première ligne-curseur retirée', () => {
        const lignes = base().sort(ordre);
        const lues = [];
        let curseur;
        for (;;) {
            const depart = curseur ? lignes.findIndex((r) => r.id === curseur) : -1;
            const tranche = curseur && depart < 0 ? [] : lignes.slice(depart + 1, depart + 3);
            lues.push(...tranche.map((r) => r.id));
            if (tranche.length < 2)
                break;
            curseur = tranche[1].id;
            lignes.splice(lignes.findIndex((r) => r.id === curseur), 1);
        }
        expect(lues).toEqual(['a1', 'a2']);
    });
    it('idApres sert l’ordre par identifiant seul', () => {
        expect((0, lecture_par_lots_1.idApres)(undefined)).toEqual({});
        expect((0, lecture_par_lots_1.idApres)('e-9')).toEqual({ id: { gt: 'e-9' } });
        const lues = parcourir(base(), (d) => (0, lecture_par_lots_1.idApres)(d.id));
        expect(lues.sort()).toEqual(base().map((r) => r.id).sort());
    });
    it('un ordre qui ne finit pas par l’identifiant est refusé · il perdrait des lignes de même clé', () => {
        expect(() => (0, lecture_par_lots_1.apresLaCle)([{ champ: 'date', valeur: jour(1) }])).toThrow(/identifiant/);
        expect(() => (0, lecture_par_lots_1.apresLaCle)([{ champ: 'datte', valeur: jour(1) }, { champ: 'id', valeur: 'e-1' }])).not.toThrow();
    });
});
//# sourceMappingURL=lecture-par-lots.spec.js.map