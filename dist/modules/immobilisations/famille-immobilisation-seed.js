"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA = exports.FAMILLES_IMMOBILISATION_DEFAUT = void 0;
exports.FAMILLES_IMMOBILISATION_DEFAUT = [
    {
        code: 'LOGICIELS',
        intitule: 'Logiciels',
        numeroCompteImmobilisation: '21310000',
        numeroCompteAmortissement: '28130000',
        numeroCompteDotation: '68120000',
        dureeAmortissementAns: 5,
    },
    {
        code: 'BREVETS',
        intitule: 'Brevets et licences',
        numeroCompteImmobilisation: '21210000',
        numeroCompteAmortissement: '28120000',
        numeroCompteDotation: '68120000',
        dureeAmortissementAns: 5,
    },
    {
        code: 'BATIMENTS',
        intitule: 'Bâtiments administratifs',
        numeroCompteImmobilisation: '23130000',
        numeroCompteAmortissement: '28310000',
        numeroCompteDotation: '68130000',
        dureeAmortissementAns: 20,
    },
    {
        code: 'INFORMATIQUE',
        intitule: 'Matériel informatique et bureautique',
        numeroCompteImmobilisation: '24420000',
        numeroCompteAmortissement: '28440000',
        numeroCompteDotation: '68130000',
        dureeAmortissementAns: 5,
    },
    {
        code: 'MOBILIER',
        intitule: 'Mobilier de bureau',
        numeroCompteImmobilisation: '24410000',
        numeroCompteAmortissement: '28440000',
        numeroCompteDotation: '68130000',
        dureeAmortissementAns: 10,
    },
    {
        code: 'VEHICULES',
        intitule: 'Véhicules automobiles',
        numeroCompteImmobilisation: '24510000',
        numeroCompteAmortissement: '28450000',
        numeroCompteDotation: '68130000',
        dureeAmortissementAns: 3,
    },
    {
        code: 'AGENCEMENTS',
        intitule: 'Agencements et aménagements',
        numeroCompteImmobilisation: '23450000',
        numeroCompteAmortissement: '28340000',
        numeroCompteDotation: '68130000',
        dureeAmortissementAns: 10,
    },
];
exports.FAMILLES_IMMOBILISATION_DEFAUT_SYSCOHADA = exports.FAMILLES_IMMOBILISATION_DEFAUT.map((f) => {
    if (f.code === 'MOBILIER') {
        return { ...f, intitule: 'Mobilier de bureau', numeroCompteImmobilisation: '24440000' };
    }
    if (f.code === 'INFORMATIQUE') {
        return { ...f, intitule: 'Matériel informatique' };
    }
    return f;
});
//# sourceMappingURL=famille-immobilisation-seed.js.map