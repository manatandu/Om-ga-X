"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const bcrypt = require("bcryptjs");
const auth_service_1 = require("./auth.service");
const jwt_strategy_1 = require("./jwt.strategy");
const verrouillage_1 = require("./verrouillage");
const mot_de_passe_a_changer_guard_1 = require("../../common/guards/mot-de-passe-a-changer.guard");
const sortie_mot_de_passe_decorator_1 = require("../../common/decorators/sortie-mot-de-passe.decorator");
const utilisateur_service_1 = require("../utilisateurs/utilisateur.service");
describe('1 · le mot de passe provisoire ferme le logiciel côté serveur', () => {
    const garde = (sortie) => new mot_de_passe_a_changer_guard_1.MotDePasseAChangerGuard({ getAllAndOverride: () => sortie });
    const requete = (utilisateur) => ({
        switchToHttp: () => ({ getRequest: () => ({ user: utilisateur }) }),
        getHandler: () => undefined,
        getClass: () => undefined,
    });
    it('refuse toute route ordinaire tant que le mot de passe est provisoire', () => {
        expect(() => garde(false).canActivate(requete({ doitChangerMotDePasse: true }))).toThrow(common_1.ForbiddenException);
    });
    it('laisse passer les routes qui permettent d’en SORTIR', () => {
        expect(garde(true).canActivate(requete({ doitChangerMotDePasse: true }))).toBe(true);
    });
    it('ne gêne pas un compte ordinaire ni une route non authentifiée', () => {
        expect(garde(false).canActivate(requete({ doitChangerMotDePasse: false }))).toBe(true);
        expect(garde(false).canActivate(requete(undefined))).toBe(true);
    });
    it('les trois sorties sont marquées dans le contrôleur, et elles seules', () => {
        const { AuthController } = require('./auth.controller');
        const proto = AuthController.prototype;
        const sorties = Object.getOwnPropertyNames(proto)
            .filter((m) => m !== 'constructor' && Reflect.getMetadata(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE, proto[m]) === true)
            .map((m) => Reflect.getMetadata(constants_1.PATH_METADATA, proto[m]));
        expect(sorties.sort()).toEqual(['changer-mot-de-passe', 'deconnecter-partout', 'me']);
        expect(Reflect.getMetadata(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE, AuthController)).toBeUndefined();
        expect(sortie_mot_de_passe_decorator_1.CLE_SORTIE_MOT_DE_PASSE).toBe('sortie-mot-de-passe-provisoire');
    });
    it('aucun autre fichier du serveur ne pose une sortie, sous le décorateur ou sous sa clé', () => {
        const { readdirSync, readFileSync, statSync } = require('fs');
        const { join, relative } = require('path');
        const racine = join(__dirname, '..', '..');
        const sources = (dossier) => readdirSync(dossier).flatMap((nom) => {
            const chemin = join(dossier, nom);
            if (statSync(chemin).isDirectory())
                return sources(chemin);
            return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
        });
        const nomment = (motif) => sources(racine)
            .filter((f) => motif.test(readFileSync(f, 'utf8')))
            .map((f) => relative(racine, f).split('\\').join('/'))
            .sort();
        expect(nomment(/\bSortieMotDePasseProvisoire\b/)).toEqual([
            'common/decorators/sortie-mot-de-passe.decorator.ts',
            'modules/auth/auth.controller.ts',
        ]);
        expect(nomment(/\bCLE_SORTIE_MOT_DE_PASSE\b|sortie-mot-de-passe-provisoire/)).toEqual([
            'common/decorators/sortie-mot-de-passe.decorator.ts',
            'common/guards/mot-de-passe-a-changer.guard.ts',
        ]);
    });
});
describe('2 · la révocation de session', () => {
    it('rejette un jeton émis AVANT la révocation', () => {
        const revocation = new Date('2026-09-02T10:00:00.000Z');
        const avant = Math.floor(new Date('2026-09-02T09:59:59.000Z').getTime() / 1000);
        expect((0, jwt_strategy_1.sessionRevoquee)(avant, revocation)).toBe(true);
    });
    it('accepte un jeton signé dans la MÊME seconde que la révocation', () => {
        const revocation = new Date('2026-09-02T10:00:00.400Z');
        const memeSeconde = Math.floor(new Date('2026-09-02T10:00:00.000Z').getTime() / 1000);
        expect((0, jwt_strategy_1.sessionRevoquee)(memeSeconde, revocation)).toBe(false);
    });
    it('accepte tout jeton quand rien n’a jamais été révoqué', () => {
        expect((0, jwt_strategy_1.sessionRevoquee)(1_756_800_000, null)).toBe(false);
    });
    it('rejette un jeton sans date d’émission · il ne peut pas prouver son antériorité', () => {
        expect((0, jwt_strategy_1.sessionRevoquee)(undefined, new Date())).toBe(true);
    });
});
describe('3 · le verrouillage par compte', () => {
    it('ne verrouille pas avant le seuil', () => {
        for (let n = 0; n < verrouillage_1.SEUIL_VERROUILLAGE; n++) {
            expect([n, (0, verrouillage_1.dureeVerrouMinutes)(n)]).toEqual([n, 0]);
        }
    });
    it('verrouille au seuil, puis de plus en plus longtemps', () => {
        const durees = [0, 1, 2, 3, 4, 5, 6].map((i) => (0, verrouillage_1.dureeVerrouMinutes)(verrouillage_1.SEUIL_VERROUILLAGE + i));
        expect(durees).toEqual([1, 5, 15, 30, 60, 60, 60]);
    });
    it('reste TEMPORAIRE · un verrou définitif se retourne en refus de service', () => {
        const maintenant = new Date('2026-09-02T10:00:00.000Z');
        for (const echecs of [5, 20, 500]) {
            const jusqua = (0, verrouillage_1.instantDeverrouillage)(echecs, maintenant);
            expect([echecs, jusqua.getTime() - maintenant.getTime() <= 60 * 60_000]).toEqual([echecs, true]);
        }
    });
    const authService = (user, capture) => new auth_service_1.AuthService({
        user: {
            findUnique: async () => user,
            update: async ({ data }) => {
                capture.data = data;
                return {};
            },
        },
    }, { sign: () => 'jeton' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    it('compte les échecs et pose le verrou au cinquième', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const user = { id: 'u1', motDePasse: hash, estActif: true, tentativesEchouees: 4, verrouilleJusqua: null, dernierEchecLe: new Date(Date.now() - 60_000) };
        await expect(authService(user, capture).login({ email: 'a@b.cd', motDePasse: 'faux' })).rejects.toThrow(common_1.UnauthorizedException);
        expect(capture.data).toMatchObject({ tentativesEchouees: 5 });
        expect(capture.data.dernierEchecLe).toBeInstanceOf(Date);
        expect(capture.data.verrouilleJusqua).toBeInstanceOf(Date);
    });
    it('un compte verrouillé répond comme un mot de passe faux, APRÈS le même hachage (audit final F238)', async () => {
        const compare = jest.spyOn(bcrypt, 'compare');
        const hash = await bcrypt.hash('le-bon', 4);
        for (const essai of ['faux', 'le-bon']) {
            compare.mockClear();
            const capture = {};
            const user = {
                id: 'u1',
                motDePasse: hash,
                estActif: true,
                tentativesEchouees: 5,
                verrouilleJusqua: new Date(Date.now() + 60_000),
            };
            await expect(authService(user, capture).login({ email: 'a@b.cd', motDePasse: essai })).rejects.toThrow(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
            expect([essai, compare.mock.calls.length]).toEqual([essai, 1]);
            expect([essai, capture.data]).toEqual([essai, undefined]);
        }
        compare.mockRestore();
    });
    it('le bon mot de passe pendant le verrou ne se distingue pas d’un faux · le verrou n’est pas un oracle', async () => {
        const hash = await bcrypt.hash('le-bon', 4);
        const verrouille = (motDePasse) => authService({ id: 'u1', motDePasse: hash, estActif: true, tentativesEchouees: 5, verrouilleJusqua: new Date(Date.now() + 60_000) }, {})
            .login({ email: 'a@b.cd', motDePasse })
            .catch((e) => e.message);
        expect(await verrouille('le-bon')).toBe(await verrouille('faux'));
    });
    it('NE repart PLUS de zéro à l’échéance du verrou · seul le délai d’oubli efface le compteur (verrouillage.ts)', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const user = {
            id: 'u1',
            motDePasse: hash,
            estActif: true,
            tentativesEchouees: 9,
            verrouilleJusqua: new Date(Date.now() - 60_000),
            dernierEchecLe: new Date(Date.now() - 61 * 60_000),
        };
        await expect(authService(user, capture).login({ email: 'a@b.cd', motDePasse: 'faux' })).rejects.toThrow(common_1.UnauthorizedException);
        expect(capture.data).toMatchObject({ tentativesEchouees: 10 });
        expect((0, verrouillage_1.dureeVerrouMinutes)(capture.data.tentativesEchouees)).toBe(60);
    });
    it('remet le compteur à zéro à la connexion réussie', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const user = { id: 'u1', motDePasse: hash, estActif: true, tentativesEchouees: 3, verrouilleJusqua: null, dernierEchecLe: new Date() };
        await authService(user, capture).login({ email: 'a@b.cd', motDePasse: 'le-bon' });
        expect(capture.data).toEqual({ tentativesEchouees: 0, verrouilleJusqua: null, dernierEchecLe: null });
    });
    it('dit la même chose dans les trois cas · adresse inconnue, mot de passe faux, compte verrouillé (F238)', async () => {
        const capture = {};
        const hash = await bcrypt.hash('le-bon', 4);
        const inconnu = new auth_service_1.AuthService({ user: { findUnique: async () => null } }, { sign: () => 'j' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
        const messages = [];
        for (const service of [
            inconnu,
            authService({ id: 'u1', motDePasse: hash, estActif: true, tentativesEchouees: 0, verrouilleJusqua: null }, capture),
            authService({ id: 'u1', motDePasse: hash, estActif: true, tentativesEchouees: 5, verrouilleJusqua: new Date(Date.now() + 60_000) }, {}),
        ]) {
            await service.login({ email: 'a@b.cd', motDePasse: 'faux' }).catch((e) => messages.push(e.message));
        }
        expect(messages).toEqual([verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES, verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES, verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES]);
        expect(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES).toMatch(/^Identifiants invalides · après plusieurs essais manqués/);
    });
    it('une adresse inconnue fait tourner bcrypt comme une adresse connue · la durée ne trahit rien (F238)', async () => {
        const compare = jest.spyOn(bcrypt, 'compare');
        const inconnu = new auth_service_1.AuthService({ user: { findUnique: async () => null } }, { sign: () => 'j' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
        await expect(inconnu.login({ email: 'personne@b.cd', motDePasse: 'essai' })).rejects.toThrow(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
        expect(compare.mock.calls).toEqual([['essai', auth_service_1.EMPREINTE_FACTICE]]);
        compare.mockRestore();
    }, 30000);
    it('l’empreinte factice est du même coût que les vraies, et son résultat est jeté', async () => {
        expect(bcrypt.getRounds(auth_service_1.EMPREINTE_FACTICE)).toBe(auth_service_1.SALT_ROUNDS);
        const inconnu = new auth_service_1.AuthService({ user: { findUnique: async () => null } }, { sign: () => 'j' }, ...[undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
        const compare = jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
        await expect(inconnu.login({ email: 'personne@b.cd', motDePasse: 'x' })).rejects.toThrow(verrouillage_1.MOTIF_IDENTIFIANTS_INVALIDES);
        compare.mockRestore();
    });
});
describe('4 · la réinitialisation par l’administrateur du dossier', () => {
    const prismaFactice = (capture) => ({
        user: {
            findFirst: async () => ({ id: 'u2', email: 'comptable@cabinet.cd', tenantId: 'd-1' }),
            update: async ({ data }) => {
                capture.data = data;
                return { id: 'u2' };
            },
        },
    });
    it('pose un mot de passe PROVISOIRE, ferme les sessions et lève le verrou', async () => {
        const capture = {};
        const resultat = await new utilisateur_service_1.UtilisateurService(prismaFactice(capture)).reinitialiserMotDePasse('d-1', 'u2', 'provisoire-tres-long');
        expect(resultat).toEqual({ reinitialise: true, email: 'comptable@cabinet.cd' });
        expect(capture.data.doitChangerMotDePasse).toBe(true);
        expect(capture.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
        expect(capture.data.tentativesEchouees).toBe(0);
        expect(capture.data.dernierEchecLe).toBeNull();
        expect(capture.data).toMatchObject({ secretDoubleAuth: null, doubleAuthActiveDepuis: null, codesSecoursDoubleAuth: [] });
        expect(capture.data.verrouilleJusqua).toBeNull();
        expect(capture.data.motDePasse).not.toBe('provisoire-tres-long');
        expect(await bcrypt.compare('provisoire-tres-long', capture.data.motDePasse)).toBe(true);
    });
    it('rétrograder un rôle ferme les sessions du compte', async () => {
        const capture = {};
        await new utilisateur_service_1.UtilisateurService(prismaFactice(capture)).modifier('d-1', 'u2', 'u1', { role: 'COMPTABLE' });
        expect(capture.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
    });
    it('un simple changement sans effet sur les droits ne ferme rien', async () => {
        const capture = {};
        await new utilisateur_service_1.UtilisateurService(prismaFactice(capture)).modifier('d-1', 'u2', 'u1', { estActif: true });
        expect(capture.data.sessionsInvalidesAvant).toBeUndefined();
    });
});
describe('5 · la chaîne de recours va jusqu’au bout', () => {
    const envoyerUnSecret = jest.fn(async (..._args) => ({ id: 'm1', statut: 'ENVOYE', erreur: null }));
    const service = (admin, capture) => new (require('../plateforme/plateforme.service').PlateformeService)({
        user: {
            findFirst: async () => admin,
            update: async ({ data }) => {
                capture.data = data;
                return {};
            },
        },
    }, { get: () => undefined }, undefined, undefined, { etatDuTransport: () => ({ configure: true }), envoyerUnSecret });
    it('l’opérateur réinitialise l’administrateur d’un cabinet, avec les trois mêmes effets', async () => {
        const capture = {};
        envoyerUnSecret.mockClear();
        const resultat = await service({ id: 'u1', email: 'chef@cabinet.cd' }, capture).reinitialiserAdmin('d-1', {
            email: 'chef@cabinet.cd',
        });
        expect(resultat).toEqual({ reinitialise: true, email: 'chef@cabinet.cd', courriel: 'ENVOYE' });
        const corps = envoyerUnSecret.mock.calls[0][1].corps;
        const envoye = /Mot de passe provisoire · (\S+)/.exec(corps)[1];
        expect(capture.data.doitChangerMotDePasse).toBe(true);
        expect(capture.data.sessionsInvalidesAvant).toBeInstanceOf(Date);
        expect(capture.data.verrouilleJusqua).toBeNull();
        expect(capture.data).toMatchObject({ tentativesEchouees: 0, dernierEchecLe: null });
        expect(await bcrypt.compare(envoye, capture.data.motDePasse)).toBe(true);
        expect(capture.data).toMatchObject({ secretDoubleAuth: null, doubleAuthActiveDepuis: null, codesSecoursDoubleAuth: [] });
    });
    it('refuse un compte qui n’est PAS administrateur du dossier visé', async () => {
        const capture = {};
        await expect(service(null, capture).reinitialiserAdmin('d-1', {
            email: 'comptable@cabinet.cd',
        })).rejects.toThrow(/administrateur/);
        expect(capture.data).toBeUndefined();
    });
});
//# sourceMappingURL=cycle-de-vie-acces.spec.js.map