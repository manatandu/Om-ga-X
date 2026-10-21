"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const path_1 = require("path");
const class_transformer_1 = require("class-transformer");
const courriel_1 = require("./courriel");
const login_dto_1 = require("../modules/auth/dto/login.dto");
const register_dto_1 = require("../modules/auth/dto/register.dto");
const changer_adresse_dto_1 = require("../modules/auth/dto/changer-adresse.dto");
const utilisateur_dto_1 = require("../modules/utilisateurs/dto/utilisateur.dto");
const plateforme_dto_1 = require("../modules/plateforme/dto/plateforme.dto");
const groupe_dto_1 = require("../modules/groupe/dto/groupe.dto");
const auth_service_1 = require("../modules/auth/auth.service");
const utilisateur_service_1 = require("../modules/utilisateurs/utilisateur.service");
const bcrypt = require("bcryptjs");
const BRUTE = '  Admin@VMGConsulting.NET ';
const NETTE = 'admin@vmgconsulting.net';
describe('F43 · la règle', () => {
    it('retire les espaces et passe en minuscules', () => {
        expect((0, courriel_1.normaliserCourriel)(BRUTE)).toBe(NETTE);
    });
});
describe('F43 · chaque porte qui reçoit une adresse de COMPTE la normalise', () => {
    const cas = [
        ['connexion', login_dto_1.LoginDto, 'email'],
        ['inscription', register_dto_1.RegisterDto, 'email'],
        ['changement d’adresse', changer_adresse_dto_1.ChangerAdresseDto, 'nouvelleAdresse'],
        ['utilisateur du dossier', utilisateur_dto_1.CreerUtilisateurDto, 'email'],
        ['cabinet de la console', plateforme_dto_1.CreerCabinetDto, 'emailAdmin'],
        ['réinitialisation par la console', plateforme_dto_1.ReinitialiserAdminDto, 'email'],
        ['dossier de démonstration', plateforme_dto_1.PreparerDemonstrationDto, 'email'],
        ['cellule du siège', groupe_dto_1.CreerCelluleDto, 'emailAdmin'],
    ];
    it.each(cas)('%s', (_nom, Classe, champ) => {
        const dto = (0, class_transformer_1.plainToInstance)(Classe, { [champ]: BRUTE });
        expect(dto[champ]).toBe(NETTE);
    });
    it('aucune adresse de compte n’entre par un DTO sans être normalisée', () => {
        const fichiers = [
            '../modules/auth/dto/login.dto.ts',
            '../modules/auth/dto/register.dto.ts',
            '../modules/auth/dto/changer-adresse.dto.ts',
            '../modules/utilisateurs/dto/utilisateur.dto.ts',
            '../modules/plateforme/dto/plateforme.dto.ts',
            '../modules/groupe/dto/groupe.dto.ts',
        ];
        for (const f of fichiers) {
            const lignes = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, f), 'utf8').split('\n');
            lignes.forEach((ligne, i) => {
                if (ligne.includes('@IsEmail('))
                    expect(`${f}:${i + 1} ${lignes[i - 1].trim()}`).toContain('@CourrielNormalise()');
            });
        }
    });
});
describe('F43 · les services normalisent aussi', () => {
    it('la connexion cherche l’adresse normalisée', async () => {
        const recherches = [];
        const s = new auth_service_1.AuthService({ user: { findUnique: async (a) => (recherches.push(a), null) } }, {}, {}, {}, {}, {}, {}, {}, {}, {});
        await expect(s.login({ email: BRUTE, motDePasse: 'x' })).rejects.toThrow(/Identifiants invalides/);
        expect(recherches).toEqual([{ where: { email: NETTE } }]);
    });
    const auth = (prisma) => new auth_service_1.AuthService(prisma, { sign: () => 'jeton' }, {}, {}, {}, {}, {}, {}, {}, {});
    it('le changement d’adresse écrit l’adresse normalisée', async () => {
        const ecrites = [];
        const hache = await bcrypt.hash('actuel-123456', 4);
        const s = auth({
            user: {
                findUnique: async () => ({ id: 'u1', email: 'ancienne@exemple.cd', motDePasse: hache }),
                update: async (a) => (ecrites.push(a), a),
            },
        });
        const r = await s.changerAdresse('u1', 'actuel-123456', BRUTE);
        expect(r.adresse).toBe(NETTE);
        expect(ecrites[0].data.email).toBe(NETTE);
    });
    it('l’inscription appelée sans passer par HTTP (siège, console) normalise elle-même', async () => {
        const vus = [];
        const s = auth({
            user: { findUnique: async (a) => (vus.push(a), { id: 'deja' }) },
        });
        await expect(s.register({ nomEntite: 'X', referentiel: 'SYCEBNL', email: BRUTE, motDePasse: 'motdepasse12' })).rejects.toThrow(/existe déjà/);
        expect(vus).toEqual([{ where: { email: NETTE } }]);
    });
    it('un utilisateur créé par l’administrateur du dossier naît avec l’adresse normalisée', async () => {
        const crees = [];
        const recherches = [];
        const prisma = {
            user: {
                findUnique: async (a) => (recherches.push(a), null),
                create: async (a) => (crees.push(a), a.data),
            },
        };
        await new utilisateur_service_1.UtilisateurService(prisma).creer('t1', {
            email: BRUTE,
            motDePasse: 'motdepasse12',
            role: 'COMPTABLE',
        });
        expect(recherches).toEqual([{ where: { email: NETTE } }]);
        expect(crees[0].data.email).toBe(NETTE);
    });
});
//# sourceMappingURL=courriel-f43.spec.js.map