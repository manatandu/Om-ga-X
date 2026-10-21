"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs = require("fs");
const path = require("path");
const constants_1 = require("@nestjs/common/constants");
const route_paramtypes_enum_1 = require("@nestjs/common/enums/route-paramtypes.enum");
const class_validator_1 = require("class-validator");
const { defaultMetadataStorage } = require('class-transformer/cjs/storage');
const DOSSIER_DTO = __dirname;
const DOSSIER_MODULE = path.join(__dirname, '..');
function classesExportees(fichiers) {
    const classes = new Map();
    for (const fichier of fichiers) {
        const exporte = require(fichier);
        for (const [nom, valeur] of Object.entries(exporte)) {
            if (typeof valeur === 'function' && /^class\s/.test(Function.prototype.toString.call(valeur))) {
                classes.set(valeur, `${path.basename(fichier)} · ${nom}`);
            }
        }
    }
    return classes;
}
function fichiersDuDossier(dossier, suffixe) {
    return fs
        .readdirSync(dossier)
        .filter((f) => suffixe.test(f) && !f.endsWith('.spec.ts'))
        .map((f) => path.join(dossier, f));
}
function recuesParLesRoutes(controleurs) {
    const recues = new Set();
    for (const controleur of controleurs) {
        const proto = controleur.prototype;
        for (const methode of Object.getOwnPropertyNames(proto)) {
            if (methode === 'constructor')
                continue;
            const types = (Reflect.getMetadata('design:paramtypes', proto, methode) ?? []);
            const args = (Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, controleur, methode) ?? {});
            for (const [cle, arg] of Object.entries(args)) {
                const genre = Number(cle.split(':')[0]);
                if ((genre === route_paramtypes_enum_1.RouteParamtypes.BODY || genre === route_paramtypes_enum_1.RouteParamtypes.QUERY) && arg.data === undefined) {
                    const type = types[arg.index];
                    if (type)
                        recues.add(type);
                }
            }
        }
    }
    return recues;
}
function fermerParImbrication(depart) {
    const atteintes = new Set(depart);
    const aVoir = [...depart];
    while (aVoir.length > 0) {
        const cible = aVoir.pop();
        const proprietes = new Set((0, class_validator_1.getMetadataStorage)()
            .getTargetValidationMetadatas(cible, '', true, false)
            .map((m) => m.propertyName));
        for (const propriete of proprietes) {
            const meta = defaultMetadataStorage.findTypeMetadata(cible, propriete);
            if (!meta)
                continue;
            const imbrique = meta.typeFunction();
            if (imbrique && !atteintes.has(imbrique)) {
                atteintes.add(imbrique);
                aVoir.push(imbrique);
            }
        }
    }
    return atteintes;
}
describe('les DTO du module analytique sont tous reçus par une route (audit final F230)', () => {
    const dtos = classesExportees(fichiersDuDossier(DOSSIER_DTO, /\.dto\.ts$/));
    const controleurs = [...classesExportees(fichiersDuDossier(DOSSIER_MODULE, /\.controller\.ts$/)).keys()];
    const servies = fermerParImbrication(recuesParLesRoutes(controleurs));
    it('le recensement trouve les contrôleurs, les DTO et les imbrications', () => {
        expect(controleurs.length).toBeGreaterThan(0);
        const nomsServis = [...servies].map((c) => c.name);
        expect(nomsServis).toEqual(expect.arrayContaining(['VentilerLigneDto', 'CreerOdAnalytiqueDto']));
        expect(nomsServis).toEqual(expect.arrayContaining(['LigneVentilationDto', 'LigneOdAnalytiqueDto']));
        expect(dtos.size).toBeGreaterThan(0);
    });
    it('aucun DTO exporté ne reste sans route', () => {
        const sansRoute = [...dtos.entries()].filter(([classe]) => !servies.has(classe)).map(([, nom]) => nom);
        expect(sansRoute).toEqual([]);
    });
});
//# sourceMappingURL=dto-servis-f230.spec.js.map