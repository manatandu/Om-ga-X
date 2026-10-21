"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportCourriel = exports.TransportAbsent = void 0;
exports.manquesDuTransport = manquesDuTransport;
exports.lireConfigurationSmtp = lireConfigurationSmtp;
exports.texteDErreur = texteDErreur;
const common_1 = require("@nestjs/common");
const nodemailer_1 = require("nodemailer");
const adresse_courriel_1 = require("./adresse-courriel");
const PORT_SMTP_CHIFFRE = 465;
const VRAI = ['true', '1'];
const FAUX = ['false', '0'];
const ABSENTE = 'variable absente de l’environnement';
function lireTexte(env, nom) {
    return (env[nom] ?? '').trim();
}
function manquesDuTransport(env) {
    const manques = [];
    if (lireTexte(env, 'SMTP_HOST').length === 0)
        manques.push({ variable: 'SMTP_HOST', raison: ABSENTE });
    const port = lireTexte(env, 'SMTP_PORT');
    if (port.length === 0) {
        manques.push({ variable: 'SMTP_PORT', raison: ABSENTE });
    }
    else if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535) {
        manques.push({ variable: 'SMTP_PORT', raison: 'valeur illisible · un nombre de 1 à 65535 est attendu' });
    }
    if (lireTexte(env, 'SMTP_USER').length === 0)
        manques.push({ variable: 'SMTP_USER', raison: ABSENTE });
    if (lireTexte(env, 'SMTP_PASS').length === 0)
        manques.push({ variable: 'SMTP_PASS', raison: ABSENTE });
    const securise = lireTexte(env, 'SMTP_SECURE').toLowerCase();
    if (securise.length > 0 && !VRAI.includes(securise) && !FAUX.includes(securise)) {
        manques.push({
            variable: 'SMTP_SECURE',
            raison: 'valeur illisible · true ou false sont attendus, sinon retirer la variable (le port décide)',
        });
    }
    const expediteur = (0, adresse_courriel_1.normaliserAdresse)(lireTexte(env, 'COURRIER_EXPEDITEUR'));
    if (expediteur.length === 0) {
        manques.push({ variable: 'COURRIER_EXPEDITEUR', raison: ABSENTE });
    }
    else if (!(0, adresse_courriel_1.adresseAcceptable)(expediteur)) {
        manques.push({ variable: 'COURRIER_EXPEDITEUR', raison: 'adresse inutilisable comme expéditeur' });
    }
    return manques;
}
function lireConfigurationSmtp(env) {
    if (manquesDuTransport(env).length > 0)
        return null;
    const port = Number(lireTexte(env, 'SMTP_PORT'));
    const declare = lireTexte(env, 'SMTP_SECURE').toLowerCase();
    return {
        hote: lireTexte(env, 'SMTP_HOST'),
        port,
        securise: declare.length > 0 ? VRAI.includes(declare) : port === PORT_SMTP_CHIFFRE,
        identifiant: lireTexte(env, 'SMTP_USER'),
        motDePasse: lireTexte(env, 'SMTP_PASS'),
        expediteur: (0, adresse_courriel_1.normaliserAdresse)(lireTexte(env, 'COURRIER_EXPEDITEUR')),
    };
}
const LONGUEUR_ERREUR = 1_000;
function texteDErreur(erreur) {
    const brut = erreur instanceof Error
        ? `${erreur.name} · ${erreur.message}`
        : typeof erreur === 'string'
            ? erreur
            : 'Erreur sans message rendue par le transport';
    if (brut.length <= LONGUEUR_ERREUR)
        return brut;
    return `${brut.slice(0, LONGUEUR_ERREUR)} […] (erreur tronquée à ${LONGUEUR_ERREUR} caractères)`;
}
class TransportAbsent extends Error {
    constructor(manques) {
        super('Aucun transport de courriel configuré · ' +
            manques.map((m) => `${m.variable} (${m.raison})`).join(', '));
        this.name = 'TransportAbsent';
    }
}
exports.TransportAbsent = TransportAbsent;
let TransportCourriel = class TransportCourriel {
    constructor() {
        this.transporteur = null;
        this.signature = null;
    }
    environnement() {
        return process.env;
    }
    etat() {
        const manques = manquesDuTransport(this.environnement());
        const config = manques.length === 0 ? lireConfigurationSmtp(this.environnement()) : null;
        return { configure: config !== null, manques, expediteur: config?.expediteur ?? null };
    }
    async envoyer(envoi) {
        const config = lireConfigurationSmtp(this.environnement());
        if (!config)
            throw new TransportAbsent(manquesDuTransport(this.environnement()));
        const transporteur = this.transporteurPour(config);
        await transporteur.sendMail({
            from: config.expediteur,
            to: envoi.destinataireNom
                ? { name: envoi.destinataireNom, address: envoi.destinataire }
                : envoi.destinataire,
            subject: envoi.sujet,
            text: envoi.corps,
            ...(envoi.pieceJointe
                ? { attachments: [{ filename: envoi.pieceJointe.nom, content: envoi.pieceJointe.texte, contentType: 'text/plain; charset=utf-8' }] }
                : {}),
        });
    }
    transporteurPour(config) {
        const signature = `${config.hote}|${config.port}|${config.securise}|${config.identifiant}|${config.expediteur}`;
        if (this.transporteur && this.signature === signature)
            return this.transporteur;
        this.transporteur = (0, nodemailer_1.createTransport)({
            host: config.hote,
            port: config.port,
            secure: config.securise,
            auth: { user: config.identifiant, pass: config.motDePasse },
        });
        this.signature = signature;
        return this.transporteur;
    }
};
exports.TransportCourriel = TransportCourriel;
exports.TransportCourriel = TransportCourriel = __decorate([
    (0, common_1.Injectable)()
], TransportCourriel);
//# sourceMappingURL=transport-courriel.js.map