"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const conditions_de_licence_1 = require("./conditions-de-licence");
const acceptation_conditions_1 = require("./acceptation-conditions");
const common_2 = require("@nestjs/common");
const versions_publiees_1 = require("./versions-publiees");
const accuse_reception_conditions_1 = require("./accuse-reception-conditions");
const abonnements_service_1 = require("../plateforme/abonnements/abonnements.service");
const facturation_abonnements_1 = require("../plateforme/abonnements/facturation-abonnements");
const SOURCE = (f) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, f), 'utf8');
const IDENTITE_COMPLETE = {
    denomination: 'VMG Consulting',
    siege: '1, avenue Exemple, Kinshasa',
    courriel: 'contact@exemple.cd',
    telephone: '+243 000 000 000',
    immatriculation: 'NON_ASSUJETTIE',
};
const RECLAMATIONS_COMPLETES = { courriel: 'reclamations@exemple.cd', telephone: '+243 000 000 001', modalites: 'Réponse sous trois jours ouvrables.' };
const OFFRE_COMPLETE = {
    modalitesPaiement: 'Virement bancaire au compte indiqué sur la facture.',
    droitRetractation: 'Exemple de clause de rétractation.',
    garantiesLegales: 'Exemple de clause de garanties légales.',
};
const formule = (prixMensuelUsd) => ({ code: 'ESSENTIEL', libelle: 'Essentiel', type: 'FORMULE', prixMensuelUsd, prixAnnuelUsd: null });
const abonnement = (prix) => ({
    formule: formule(prix),
    options: [],
    dossiersSupplementaires: 0,
    periodicite: 'MENSUELLE',
    debut: '2026-10-01',
    finEssai: '2026-10-31',
    actif: true,
});
const COMMANDE = (0, acceptation_conditions_1.detailCommande)(abonnement(25));
const contexte = (c = {}) => ({
    mentions: [],
    typeLicence: 'ABONNEMENT',
    estDemonstration: false,
    surSite: false,
    commande: COMMANDE,
    ...c,
});
describe('l’offre dit ce que la loi exige, sinon elle ne s’accepte pas (Code du numérique, art. 52 à 54)', () => {
    it('aujourd’hui, l’identité de l’éditeur et le contact des réclamations ne sont pas arrêtés · rien n’est inventé', () => {
        expect(conditions_de_licence_1.EDITEUR.siege).toBeNull();
        expect(conditions_de_licence_1.EDITEUR.courriel).toBeNull();
        expect(conditions_de_licence_1.EDITEUR.telephone).toBeNull();
        expect(conditions_de_licence_1.EDITEUR.immatriculation).toBeNull();
        expect(conditions_de_licence_1.RECLAMATIONS).toEqual({ courriel: null, telephone: null, modalites: null });
        expect(conditions_de_licence_1.OFFRE).toEqual({ modalitesPaiement: null, droitRetractation: null, garantiesLegales: null });
        const manque = (0, conditions_de_licence_1.mentionsAArreter)();
        expect(manque.length).toBe(9);
        expect(manque.join(' ')).toContain('art. 52, 3°');
        expect(manque.join(' ')).toContain('art. 53, 13°');
        expect(manque.join(' ')).toContain('art. 53, 14°');
    });
    it('l’offre dit aussi le paiement, la rétractation et les garanties légales (art. 53, 6°, 16° et 20°) · relecture M3', () => {
        const reste = (0, conditions_de_licence_1.mentionsAArreter)(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES);
        expect(reste).toEqual([
            'les modalités de paiement, notamment les moyens de paiement acceptés (art. 53, 6°)',
            'l’existence ou l’absence d’un droit de rétractation et ses conditions d’exercice (art. 53, 16°)',
            'les garanties légales de conformité, des vices cachés et d’éviction (art. 53, 20°)',
        ]);
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).toContain(`Les modalités de paiement, notamment les moyens de paiement acceptés · (${conditions_de_licence_1.A_ARRETER})`);
        expect(texte).toContain(`L’existence ou l’absence d’un droit de rétractation pour le présent contrat, et ses conditions d’exercice · (${conditions_de_licence_1.A_ARRETER}) (art. 53, 16°).`);
        expect(texte).toContain(`Les garanties légales de conformité, des vices cachés et d’éviction · (${conditions_de_licence_1.A_ARRETER})`);
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ mentions: reste }))).toContain('art. 53, 6°');
    });
    it('complétées, plus rien ne manque · l’immatriculation peut être déclarée sans objet (art. 52, 4°, « si elle est assujettie »)', () => {
        expect((0, conditions_de_licence_1.mentionsAArreter)(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES, OFFRE_COMPLETE)).toEqual([]);
        const complet = (0, conditions_de_licence_1.texteBrutDesConditions)(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES, OFFRE_COMPLETE);
        expect(complet).toContain('Virement bancaire au compte indiqué sur la facture.');
        expect(complet).not.toContain(`moyens de paiement acceptés · (${conditions_de_licence_1.A_ARRETER})`);
    });
    it('le texte écrit « à arrêter » à la place de chaque inconnue, et rien d’autre', () => {
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).toContain(`Siège social · (${conditions_de_licence_1.A_ARRETER})`);
        expect(texte).toContain(`Téléphone · (${conditions_de_licence_1.A_ARRETER})`);
        const complet = (0, conditions_de_licence_1.texteBrutDesConditions)(IDENTITE_COMPLETE, RECLAMATIONS_COMPLETES);
        expect(complet).toContain('Siège social · 1, avenue Exemple, Kinshasa.');
        expect(complet).toContain('n’est pas assujettie aux formalités d’inscription au registre du commerce');
        expect(complet).toContain('Réponse sous trois jours ouvrables.');
    });
    it('l’acceptation reste fermée tant qu’une mention manque, et le motif cite l’art. 54, al. 2', () => {
        const m = (0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ mentions: (0, conditions_de_licence_1.mentionsAArreter)() }));
        expect(m).toContain('art. 54, al. 2');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte())).toBeNull();
    });
});
describe('qui peut accepter, et quoi', () => {
    it('le dossier de l’éditeur et une vitrine ne contractent pas', () => {
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ typeLicence: 'PROPRIETAIRE' }))).toContain('éditeur');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ estDemonstration: true }))).toContain('démonstration');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ typeLicence: 'PROPRIETAIRE', surSite: true }))).toBeNull();
    });
    it('en ligne, sans abonnement rattaché, l’acceptation est fermée et le dit · le prix précède l’acceptation (relecture M4)', () => {
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ commande: null }))).toContain('Aucun abonnement n’est rattaché à ce dossier, ni à son siège');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ commande: null }))).toContain('art. 53, 5°');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ commande: null, surSite: true }))).toBeNull();
    });
    it('une licence perpétuelle hébergée n’a pas d’offre dans le contrat · fermée, nommée (relecture M4)', () => {
        const m = (0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ typeLicence: 'PERPETUEL_SAAS' }));
        expect(m).toContain('licence perpétuelle hébergée');
        expect(m).toContain('à arrêter par VMG Consulting');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ typeLicence: 'PERPETUEL_SAAS', surSite: true }))).toBeNull();
    });
    it('seul le texte en vigueur s’accepte, même numéro ET même empreinte · une page d’une autre construction ne fait rien accepter (relecture M1)', () => {
        const v = conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero;
        const e = (0, versions_publiees_1.empreinteEnVigueur)();
        const ec = (0, acceptation_conditions_1.empreinteCommande)(COMMANDE);
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, ec, contexte())).toBeNull();
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(Number.NaN, e, ec, contexte())).toContain('rechargez la page');
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, '0'.repeat(64), ec, contexte())).toContain('diffère de celui que le service tient pour la même version');
    });
    it('trois écarts, trois messages · une page plus récente que le service ne se recharge pas, elle attend le service (second tour, m-2)', () => {
        const e = (0, versions_publiees_1.empreinteEnVigueur)();
        const ec = (0, acceptation_conditions_1.empreinteCommande)(COMMANDE);
        const ancienne = (0, acceptation_conditions_1.motifRefusAcceptation)(1, e, ec, contexte(), 2, e);
        expect(ancienne).toContain('rechargez la page');
        expect(ancienne).not.toContain('pas encore à jour');
        const recente = (0, acceptation_conditions_1.motifRefusAcceptation)(3, e, ec, contexte(), 2, e);
        expect(recente).toContain('le service n’est pas encore à jour, réessayez dans quelques minutes');
        expect(recente).not.toContain('rechargez');
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(2, '0'.repeat(64), ec, contexte(), 2, e)).toContain('diffère de celui que le service tient pour la même version 2');
    });
    it('l’abonnement affiché doit être celui que le serveur relit · un prix changé entre l’affichage et le clic est refusé (second tour, M-a)', () => {
        const v = conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero;
        const e = (0, versions_publiees_1.empreinteEnVigueur)();
        const affichee = (0, acceptation_conditions_1.empreinteCommande)((0, acceptation_conditions_1.detailCommande)(abonnement(25)));
        const relue = contexte({ commande: (0, acceptation_conditions_1.detailCommande)(abonnement(30)) });
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, affichee, relue)).toContain('L’abonnement affiché n’est plus celui du dossier');
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, affichee, relue)).toContain('art. 55, al. 1er');
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, (0, acceptation_conditions_1.empreinteCommande)(relue.commande), relue)).toBeNull();
        const surSite = contexte({ commande: null, surSite: true });
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, (0, acceptation_conditions_1.empreinteCommande)(null), surSite)).toBeNull();
        expect((0, acceptation_conditions_1.motifRefusAcceptation)(v, e, affichee, surSite)).toContain('n’est plus celui du dossier');
    });
    it('l’empreinte de la commande suit chaque élément affiché, et lui seul', () => {
        const base = (0, acceptation_conditions_1.detailCommande)(abonnement(25));
        expect((0, acceptation_conditions_1.empreinteCommande)(base)).toBe((0, acceptation_conditions_1.empreinteCommande)((0, acceptation_conditions_1.detailCommande)(abonnement(25))));
        expect((0, acceptation_conditions_1.empreinteCommande)(base)).toMatch(/^[0-9a-f]{64}$/);
        for (const autre of [
            { ...base, formule: 'Standard' },
            { ...base, options: ['Paie'] },
            { ...base, periodicite: 'ANNUELLE' },
            { ...base, debut: '2026-09-01' },
            { ...base, finEssai: null },
            { ...base, totalUsd: 26 },
            { ...base, lignes: [{ ...base.lignes[0], quantite: 2 }] },
            { ...base, duSiege: true },
        ]) {
            expect((0, acceptation_conditions_1.empreinteCommande)(autre)).not.toBe((0, acceptation_conditions_1.empreinteCommande)(base));
        }
        expect((0, acceptation_conditions_1.empreinteCommande)({ ...base, actif: false })).toBe((0, acceptation_conditions_1.empreinteCommande)(base));
        expect((0, acceptation_conditions_1.empreinteCommande)(null)).not.toBe((0, acceptation_conditions_1.empreinteCommande)(base));
    });
    it('l’état ne demande l’acceptation que si elle est ouverte et pas déjà faite', () => {
        const ouverte = { typeLicence: 'ABONNEMENT', estDemonstration: false, surSite: false, commande: COMMANDE, mentions: [] };
        expect((0, acceptation_conditions_1.etatConditions)(null, ouverte).aAccepter).toBe(true);
        const faite = { version: conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), le: '2026-10-15T09:00:00.000Z', par: 'admin@exemple.cd', commande: COMMANDE };
        expect((0, acceptation_conditions_1.etatConditions)(faite, ouverte)).toMatchObject({ aJour: true, aAccepter: false });
        expect((0, acceptation_conditions_1.etatConditions)({ ...faite, version: 0 }, ouverte)).toMatchObject({ aJour: false, aAccepter: true });
        expect((0, acceptation_conditions_1.etatConditions)({ ...faite, empreinte: '0'.repeat(64) }, ouverte)).toMatchObject({ aJour: false, aAccepter: true });
        expect((0, acceptation_conditions_1.etatConditions)(faite, ouverte).version.empreinte).toBe((0, versions_publiees_1.empreinteEnVigueur)());
        const fermee = (0, acceptation_conditions_1.etatConditions)(null, { ...ouverte, mentions: ['x'] });
        expect(fermee.aAccepter).toBe(false);
        expect(fermee.motifFermeture).toContain('art. 54');
    });
});
describe('l’accusé se renvoie quand il manque, jamais en doublon (relecture, mineur 5)', () => {
    const faite = { version: conditions_de_licence_1.VERSION_CONDITIONS_LICENCE.numero, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), le: '2026-10-15T09:00:00.000Z', par: 'admin@exemple.cd', commande: COMMANDE };
    it('sans acceptation du texte en vigueur, rien à renvoyer', () => {
        expect((0, acceptation_conditions_1.motifRefusRenvoiAccuse)(null, false, null)).toContain('pas d’accusé à renvoyer');
        expect((0, acceptation_conditions_1.motifRefusRenvoiAccuse)(faite, false, null)).toContain('pas d’accusé à renvoyer');
    });
    it('un accusé en file, en attente d’une messagerie ou parti ne se renvoie pas', () => {
        for (const statut of ['EN_ATTENTE', 'SANS_TRANSPORT', 'ENVOYE']) {
            expect([statut, (0, acceptation_conditions_1.motifRefusRenvoiAccuse)(faite, true, { statut, le: faite.le })]).toEqual([statut, expect.stringContaining('doublon')]);
        }
    });
    it('un accusé en ÉCHEC ne se renvoie pas · la file le retente d’elle-même, un renvoi doublait le courriel (second tour, M-b)', () => {
        const m = (0, acceptation_conditions_1.motifRefusRenvoiAccuse)(faite, true, { statut: 'ECHEC', le: faite.le });
        expect(m).toContain('la file le retente d’elle-même');
        expect(m).toContain('doublon');
        const file = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'courrier', 'courrier.service.ts'), 'utf8');
        const filtre = file.slice(file.indexOf('private filtreEligibles('));
        expect(filtre.slice(0, filtre.indexOf('\n  }\n'))).toContain('StatutMessage.ECHEC');
    });
    it('jamais mis en file ou abandonné, il se renvoie', () => {
        expect((0, acceptation_conditions_1.motifRefusRenvoiAccuse)(faite, true, null)).toBeNull();
        expect((0, acceptation_conditions_1.motifRefusRenvoiAccuse)(faite, true, { statut: 'ABANDONNE', le: faite.le })).toBeNull();
    });
});
describe('les détails de la commande viennent du moteur de la facture (art. 53, 5° ; art. 55, al. 1er)', () => {
    it('un prix fixé rend les lignes et le total de la première période facturable', () => {
        const d = (0, acceptation_conditions_1.detailCommande)(abonnement(25));
        expect(d.lignes).toEqual([{ designation: 'Abonnement OmegaX · Essentiel · 2026-11', quantite: 1, prixUnitaireUsd: 25 }]);
        expect(d.totalUsd).toBe(25);
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ commande: d }))).toBeNull();
    });
    it('un prix non fixé ferme l’acceptation · l’offre doit dire le prix', () => {
        const d = (0, acceptation_conditions_1.detailCommande)(abonnement(null));
        expect(d.lignes).toBeNull();
        expect(d.motifPrix).toContain('Prix mensuel non fixé');
        expect((0, acceptation_conditions_1.motifAcceptationFermee)(contexte({ commande: d }))).toContain('art. 53, 5°');
    });
    it('un abonnement suspendu se montre quand même, prix compris', () => {
        const d = (0, acceptation_conditions_1.detailCommande)({ ...abonnement(25), actif: false });
        expect(d.totalUsd).toBe(25);
        expect(d.actif).toBe(false);
    });
});
describe('le contrat dit ce que le code fait', () => {
    it('la grille recopiée est celle que la console sème, libellé et contenu', () => {
        expect(conditions_de_licence_1.FORMULES_DU_CONTRAT).toEqual(abonnements_service_1.FORMULES_INITIALES.map((f) => ({ code: f.code, libelle: f.libelle, contenu: f.contenu })));
    });
    it('l’essai et le délai de paiement sont ceux du moteur de facturation', () => {
        const enLettres = { 15: 'quinze', 30: 'trente' };
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).toContain(`essai gratuit de ${enLettres[facturation_abonnements_1.JOURS_ESSAI]} jours`);
        expect(texte).toContain(`Le client dispose de ${enLettres[facturation_abonnements_1.DELAI_PAIEMENT_JOURS]} jours après la fin de l’essai`);
    });
    it('la lecture seule dite au contrat est celle de LicenceGuard · téléchargements ouverts, impression numérotée du journal refusée (relecture, mineur 4)', () => {
        const garde = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'licence', 'licence.guard.ts'), 'utf8');
        expect(garde).toContain("const METHODES_DE_LECTURE = new Set(['GET', 'HEAD'])");
        const impressions = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'journaux', 'impressions-journal.controller.ts'), 'utf8');
        expect(impressions).toContain('@UseGuards(JwtAuthGuard, LicenceGuard, RolesGuard)');
        expect(impressions).toContain('@Post()');
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).toContain('passe en LECTURE SEULE · ses utilisateurs le consultent et en téléchargent les états et les livres');
        expect(texte).toContain('aucune impression numérotée du journal n’y est plus admise');
    });
    it('la restitution est dite avec ses cinq réserves, celles que l’écran de restitution écrit (relecture, mineur 10)', () => {
        const ecran = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', '..', '..', 'client', 'src', 'pages', 'RestitutionPage.tsx'), 'utf8');
        for (const r of ['Elle ne remplace pas la conservation.', 'Elle n\'a pas la force probante de l\'écrit papier légalisé.', 'Ce n\'est pas une réversibilité.', 'Ce n\'est pas un instantané.', 'Les CSV ne sont pas le livre-journal.']) {
            expect(ecran).toContain(r);
        }
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).not.toContain('copie intégrale');
        expect(texte).toContain('Cette archive porte cinq réserves, qu’elle écrit elle-même · elle ne remplace pas la conservation des pièces justificatives, n’a pas la force probante d’un écrit légalisé, ne se recharge pas entière dans OmegaX, n’est pas un instantané pris d’un seul coup, et ses fichiers ne sont pas le livre-journal.');
    });
    it('cite les textes lus, chacun par son article · Code du numérique, droit d’auteur, Code civil', () => {
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)().replace(/\s+/g, ' ');
        expect(texte).toContain('ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 47');
        expect(texte).toContain('ordonnance-loi n° 86-033, art. 1er');
        expect(texte).toContain('ordonnance-loi n° 86-033, art. 96');
        expect(texte).toContain('art. 229');
        expect(texte).toContain('art. 30, al. 3');
        expect(texte).toContain('Code civil, Livre III, art. 46');
        expect(texte).toContain('(art. 34)');
    });
    it('ne tranche aucun choix commercial que ni la loi ni le dépôt ne tranchent', () => {
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        for (const choix of ['Un plafond de responsabilité', 'La résiliation à l’initiative de chaque partie et son préavis', 'La juridiction compétente en cas de litige']) {
            expect(texte).toContain(`${choix} · (${conditions_de_licence_1.A_ARRETER})`);
        }
        expect(texte).not.toMatch(/tribunal de (commerce|grande instance)\s+de\s+[A-Z]/);
    });
    it('numérote ses articles sans trou ni doublon, et aucun titre n’est une référence juridique', () => {
        const a = (0, conditions_de_licence_1.articlesDesConditions)();
        expect(a.map((x) => x.numero)).toEqual(a.map((_, i) => i + 1));
        for (const x of a)
            expect(x.titre).not.toMatch(/\b(art\.|article)\s*\d|§\s*\d/i);
    });
    it('dit la pratique de VMG Consulting sur les données des dossiers et nomme ses accès techniques, jamais une impossibilité (relecture B1)', () => {
        const texte = (0, conditions_de_licence_1.texteBrutDesConditions)();
        expect(texte).toContain('Elle ne consulte pas le contenu des dossiers · ses accès techniques à la base se limitent à la sauvegarde chiffrée');
        expect(texte).toContain('la restauration de contrôle automatique qui l’éprouve');
        expect(texte).toContain('aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres');
    });
    it('dit la langue du contrat, le français seul (art. 53, 8°)', () => {
        expect((0, conditions_de_licence_1.texteBrutDesConditions)()).toContain('langue du contrat · français');
        expect((0, conditions_de_licence_1.texteBrutDesConditions)()).toContain('en français, seule langue proposée');
    });
});
describe('l’accusé de réception (art. 55, al. 2) et la copie du contrat (art. 56, al. 1er)', () => {
    const acceptation = { version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), le: '2026-10-15T09:30:00.000Z', par: 'admin@exemple.cd', commande: COMMANDE };
    it('porte la version, le dossier, l’auteur, la date, l’empreinte, et le texte ARCHIVÉ de la version en pièce jointe', () => {
        const a = (0, accuse_reception_conditions_1.accuseReceptionConditions)(acceptation, 'Association Exemple');
        expect(a.sujet).toContain('version 1');
        expect(a.corps).toContain('Dossier · Association Exemple');
        expect(a.corps).toContain('Acceptées par · admin@exemple.cd');
        expect(a.corps).toContain('(heure de Kinshasa)');
        expect(a.corps).toContain(`Empreinte SHA-256 du texte accepté · ${(0, versions_publiees_1.empreinteEnVigueur)()}`);
        expect(a.pieceJointe).toEqual({ nom: (0, accuse_reception_conditions_1.nomPieceJointeConditions)(1), texte: (0, versions_publiees_1.versionPubliee)(1).texte });
        expect(a.pieceJointe.texte).toBe((0, conditions_de_licence_1.texteBrutDesConditions)());
    });
    it('recopie la commande acceptée, lignes et total, celle que l’acte a figée (second tour, M-a ; art. 55, al. 2)', () => {
        const corps = (0, accuse_reception_conditions_1.accuseReceptionConditions)(acceptation, 'Association Exemple').corps;
        expect(corps).toContain('Abonnement · Essentiel');
        expect(corps).toContain('Facturation · mensuelle, depuis le 01/10/2026, essai jusqu’au 31/10/2026');
        expect(corps).toContain('  Abonnement OmegaX · Essentiel · 2026-11 · 1 × 25,00 USD');
        expect(corps).toContain('Total d’une période · 25,00 USD');
        expect((0, accuse_reception_conditions_1.lignesDeLaCommande)({ ...COMMANDE, duSiege: true })[0]).toBe('Abonnement (celui du siège du groupe) · Essentiel');
        expect((0, accuse_reception_conditions_1.accuseReceptionConditions)({ ...acceptation, commande: null }, 'Association Exemple').corps).toContain('Abonnement · aucun abonnement n’est rattaché à cette acceptation');
    });
    it('un auteur absent s’écrit « auteur non enregistré », jamais une case vide (relecture, mineur 6)', () => {
        expect((0, accuse_reception_conditions_1.accuseReceptionConditions)({ ...acceptation, par: null }, 'Association Exemple').corps).toContain(`Acceptées par · ${acceptation_conditions_1.AUTEUR_NON_ENREGISTRE}`);
    });
    it('une version absente de l’archive ne s’accuse pas sur un autre texte', () => {
        expect(() => (0, accuse_reception_conditions_1.accuseReceptionConditions)({ ...acceptation, version: 99 }, 'Association Exemple')).toThrow('n’est pas dans l’archive');
    });
});
jest.mock('./conditions-de-licence', () => {
    const vrai = jest.requireActual('./conditions-de-licence');
    return { ...vrai, mentionsAArreter: jest.fn(vrai.mentionsAArreter) };
});
describe('le service d’acceptation', () => {
    const module = require('./conditions-de-licence');
    const { ConditionsLicenceService } = require('./conditions-licence.service');
    const ligneAbonnement = (prix = 25) => ({
        periodicite: 'MENSUELLE',
        debut: new Date('2026-10-01T00:00:00Z'),
        finEssai: new Date('2026-10-31T00:00:00Z'),
        actif: true,
        dossiersSupplementaires: 0,
        formule: { code: 'ESSENTIEL', libelle: 'Essentiel', type: 'FORMULE', prixMensuelUsd: new client_1.Prisma.Decimal(prix), prixAnnuelUsd: null },
        options: [],
    });
    const LIGNE_ABONNEMENT = ligneAbonnement();
    const AFFICHEE = (0, acceptation_conditions_1.empreinteCommande)(COMMANDE);
    function monde(tenant = {}, courrier, abonnementLu = LIGNE_ABONNEMENT, messageLu = null) {
        const t = {
            nom: 'Association Exemple',
            estDemonstration: false,
            conditionsLicenceVersion: null,
            conditionsLicenceEmpreinte: null,
            conditionsLicenceAccepteesLe: null,
            conditionsLicenceAccepteesPar: null,
            conditionsLicenceCommande: null,
            licence: { type: 'ABONNEMENT' },
            dossierMereId: null,
            ...tenant,
        };
        const etatBase = { abonnement: abonnementLu };
        const tx = {
            $executeRaw: jest.fn(async () => 1),
            tenant: {
                findUnique: jest.fn(async () => ({ ...t })),
                update: jest.fn(async ({ data }) => Object.assign(t, data)),
            },
            abonnementCabinet: { findUnique: jest.fn(async () => etatBase.abonnement) },
            message: { findFirst: jest.fn(async () => messageLu) },
        };
        const prisma = {
            tenant: { findUnique: jest.fn(async () => ({ ...t })) },
            abonnementCabinet: { findUnique: jest.fn(async () => etatBase.abonnement) },
            message: { findFirst: jest.fn(async () => messageLu) },
            $transaction: jest.fn(async (fn) => fn(tx)),
        };
        const s = new ConditionsLicenceService(prisma, courrier);
        return { s, t, tx, prisma, etatBase };
    }
    const premierAppel = (m) => m.mock.invocationCallOrder[0];
    afterEach(() => module.mentionsAArreter.mockImplementation(jest.requireActual('./conditions-de-licence').mentionsAArreter));
    it('refuse tant que l’offre est incomplète · rien n’est écrit, aucun courriel', async () => {
        const courrier = { mettreEnFile: jest.fn() };
        const m = monde({}, courrier);
        await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE)).rejects.toBeInstanceOf(common_1.ConflictException);
        expect(m.tx.tenant.update).not.toHaveBeenCalled();
        expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    });
    it('ouverte, écrit l’acceptation ET la commande acceptée par une mise à jour UNITAIRE, sous verrou du dossier, et accuse réception', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const courrier = { mettreEnFile: jest.fn(async () => ({ id: 'm1', statut: 'SANS_TRANSPORT', erreur: null })) };
        const m = monde({}, courrier);
        const r = await m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE);
        expect(m.tx.$executeRaw).toHaveBeenCalledTimes(1);
        expect(m.tx.tenant.update).toHaveBeenCalledWith({
            where: { id: 't1' },
            data: {
                conditionsLicenceVersion: 1,
                conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)(),
                conditionsLicenceAccepteesLe: expect.any(Date),
                conditionsLicenceAccepteesPar: 'admin@exemple.cd',
                conditionsLicenceCommande: COMMANDE,
            },
        });
        expect(r.deja).toBe(false);
        expect(r.etat).toMatchObject({ aJour: true, aAccepter: false, acceptation: { version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), par: 'admin@exemple.cd', commande: COMMANDE } });
        expect(r.accuse).toEqual({ statut: 'SANS_TRANSPORT' });
        const [tenantId, message] = courrier.mettreEnFile.mock.calls[0];
        expect(tenantId).toBe('t1');
        expect(message.destinataire).toBe('admin@exemple.cd');
        expect(message.origine).toBe('CONDITIONS_LICENCE');
        expect(message.pieceJointe.nom).toBe((0, accuse_reception_conditions_1.nomPieceJointeConditions)(1));
        expect(message.corps).toContain('Total d’une période · 25,00 USD');
    });
    it('le contexte qui décide est relu DANS la transaction, APRÈS le verrou (second tour, M-a)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const m = monde({}, { mettreEnFile: jest.fn(async () => ({ id: 'm1', statut: 'SANS_TRANSPORT', erreur: null })) });
        await m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE);
        const verrou = premierAppel(m.tx.$executeRaw);
        expect(premierAppel(m.tx.tenant.findUnique)).toBeGreaterThan(verrou);
        expect(premierAppel(m.tx.abonnementCabinet.findUnique)).toBeGreaterThan(verrou);
        expect(m.prisma.tenant.findUnique).not.toHaveBeenCalled();
        expect(m.prisma.abonnementCabinet.findUnique).not.toHaveBeenCalled();
    });
    it('un prix changé dans la console entre l’affichage et le clic est refusé en 409 · rien n’est écrit, aucun courriel (second tour, M-a)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const courrier = { mettreEnFile: jest.fn() };
        const m = monde({}, courrier, ligneAbonnement(30));
        const refus = m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE);
        await expect(refus).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE)).rejects.toThrow('L’abonnement affiché n’est plus celui du dossier');
        expect(m.tx.tenant.update).not.toHaveBeenCalled();
        expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    });
    it('la commande gardée se relit avec l’acceptation · une forme qui n’est pas la sienne est rendue nulle, jamais devinée', async () => {
        const le = new Date('2026-10-15T08:00:00Z');
        const acceptee = { conditionsLicenceVersion: 1, conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)(), conditionsLicenceAccepteesLe: le, conditionsLicenceAccepteesPar: 'a@exemple.cd' };
        const gardee = monde({ ...acceptee, conditionsLicenceCommande: JSON.parse(JSON.stringify(COMMANDE)) });
        expect((await gardee.s.etat('t1')).acceptation?.commande).toEqual(COMMANDE);
        for (const illisible of [[1, 2], 'texte', { formule: 3 }]) {
            const m = monde({ ...acceptee, conditionsLicenceCommande: illisible });
            expect((await m.s.etat('t1')).acceptation?.commande).toBeNull();
        }
    });
    it('déjà acceptée, ne réécrit rien · la date, l’auteur et la commande d’origine sont rendus', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const courrier = { mettreEnFile: jest.fn() };
        const le = new Date('2026-10-15T08:00:00Z');
        const m = monde({
            conditionsLicenceVersion: 1,
            conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)(),
            conditionsLicenceAccepteesLe: le,
            conditionsLicenceAccepteesPar: 'premier@exemple.cd',
            conditionsLicenceCommande: JSON.parse(JSON.stringify(COMMANDE)),
        }, courrier);
        const r = await m.s.accepter('t1', { userId: 'u2', email: 'second@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE);
        expect(r.deja).toBe(true);
        expect(r.etat.acceptation).toEqual({ version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), le: le.toISOString(), par: 'premier@exemple.cd', commande: COMMANDE });
        expect(m.tx.tenant.update).not.toHaveBeenCalled();
        expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    });
    it('un texte lu sous une autre empreinte est refusé · rien n’est écrit (relecture M1)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const m = monde();
        await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, 'f'.repeat(64), AFFICHEE)).rejects.toThrow('rechargez la page');
        expect(m.tx.tenant.update).not.toHaveBeenCalled();
    });
    it('un échec de mise en file ne défait JAMAIS l’acceptation, se dit, et se consigne en ERREUR avec le dossier et la version', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const erreur = jest.spyOn(common_2.Logger.prototype, 'error').mockImplementation(() => undefined);
        const courrier = { mettreEnFile: jest.fn(async () => { throw new Error('Adresse inutilisable'); }) };
        const m = monde({}, courrier);
        const r = await m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), AFFICHEE);
        expect(m.t.conditionsLicenceVersion).toBe(1);
        expect(r.accuse).toEqual({ statut: 'NON_MIS_EN_FILE' });
        expect(String(erreur.mock.calls[0][0])).toContain('dossier t1, version 1');
        expect(r.etat.renvoiAccusePossible).toBe(true);
        erreur.mockRestore();
    });
    const ACCEPTEE = {
        conditionsLicenceVersion: 1,
        conditionsLicenceAccepteesLe: new Date('2026-10-15T08:00:00Z'),
        conditionsLicenceAccepteesPar: 'premier@exemple.cd',
    };
    it('« Renvoyer l’accusé » remet en file, SOUS LE VERROU, dans la transaction, l’accusé abandonné · à l’auteur de l’acceptation (second tour, m-1)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const courrier = { mettreEnFile: jest.fn(), ecrireEnFileSansTenter: jest.fn(async () => [{ id: 'm2', statut: 'EN_ATTENTE', motif: null }]) };
        const m = monde({ ...ACCEPTEE, conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)(), conditionsLicenceCommande: JSON.parse(JSON.stringify(COMMANDE)) }, courrier, LIGNE_ABONNEMENT, { statut: 'ABANDONNE', createdAt: new Date('2026-10-15T08:00:01Z') });
        const r = await m.s.renvoyerAccuse('t1', { userId: 'u2', email: 'second@exemple.cd' });
        expect(r.accuse).toEqual({ statut: 'EN_ATTENTE' });
        expect(courrier.mettreEnFile).not.toHaveBeenCalled();
        const [client, tenantId, messages] = courrier.ecrireEnFileSansTenter.mock.calls[0];
        expect(client).toBe(m.tx);
        expect(tenantId).toBe('t1');
        expect(messages[0].destinataire).toBe('premier@exemple.cd');
        expect(messages[0].createdBy).toBe('u2');
        expect(messages[0].corps).toContain('Total d’une période · 25,00 USD');
        expect(premierAppel(m.tx.message.findFirst)).toBeGreaterThan(premierAppel(m.tx.$executeRaw));
        expect(premierAppel(courrier.ecrireEnFileSansTenter)).toBeGreaterThan(premierAppel(m.tx.message.findFirst));
    });
    it('« Renvoyer l’accusé » dit l’accusé qui n’a pas pu entrer en file, et le consigne', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const erreur = jest.spyOn(common_2.Logger.prototype, 'error').mockImplementation(() => undefined);
        const courrier = { ecrireEnFileSansTenter: jest.fn(async () => [{ id: null, statut: null, motif: 'Adresse inutilisable' }]) };
        const m = monde({ ...ACCEPTEE, conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)() }, courrier);
        const r = await m.s.renvoyerAccuse('t1', { userId: 'u2', email: 'second@exemple.cd' });
        expect(r.accuse).toEqual({ statut: 'NON_MIS_EN_FILE' });
        expect(String(erreur.mock.calls[0][0])).toContain('Adresse inutilisable');
        erreur.mockRestore();
    });
    it('« Renvoyer l’accusé » refuse un doublon, en file comme en échec (second tour, M-b)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        for (const statut of ['SANS_TRANSPORT', 'ECHEC']) {
            const courrier = { mettreEnFile: jest.fn(), ecrireEnFileSansTenter: jest.fn() };
            const m = monde({ ...ACCEPTEE, conditionsLicenceEmpreinte: (0, versions_publiees_1.empreinteEnVigueur)() }, courrier, LIGNE_ABONNEMENT, { statut, createdAt: new Date('2026-10-15T08:00:01Z') });
            await expect(m.s.renvoyerAccuse('t1', { userId: 'u2', email: 'second@exemple.cd' })).rejects.toThrow('doublon');
            expect(courrier.mettreEnFile).not.toHaveBeenCalled();
            expect(courrier.ecrireEnFileSansTenter).not.toHaveBeenCalled();
        }
    });
    it('une cellule lit l’abonnement de son siège, et le dit (relecture M4)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const m = monde({ dossierMereId: 'siege-1' });
        const e = await m.s.etat('cellule-1');
        expect(m.prisma.abonnementCabinet.findUnique.mock.calls[0][0].where).toEqual({ cabinetId: 'siege-1' });
        expect(e.commande).toMatchObject({ duSiege: true, totalUsd: 25 });
        expect(e.aAccepter).toBe(true);
    });
    it('sans abonnement, ni à lui ni à son siège, l’acceptation est refusée · rien n’est écrit (relecture M4)', async () => {
        module.mentionsAArreter.mockReturnValue([]);
        const courrier = { mettreEnFile: jest.fn() };
        const m = monde({}, courrier, null);
        await expect(m.s.accepter('t1', { userId: 'u1', email: 'admin@exemple.cd' }, 1, (0, versions_publiees_1.empreinteEnVigueur)(), (0, acceptation_conditions_1.empreinteCommande)(null))).rejects.toThrow('Aucun abonnement n’est rattaché');
        expect(m.tx.tenant.update).not.toHaveBeenCalled();
        expect(courrier.mettreEnFile).not.toHaveBeenCalled();
    });
    it('l’état lu sert la commande sans le tiers facturé du dossier de l’éditeur', async () => {
        const m = monde();
        await m.s.etat('t1');
        const select = m.prisma.abonnementCabinet.findUnique.mock.calls[0][0].select;
        expect(select).not.toHaveProperty('tiers');
        expect(select).not.toHaveProperty('tiersId');
    });
});
describe('le contrôleur', () => {
    const source = SOURCE('conditions-licence.controller.ts');
    it('l’acceptation est réservée à l’administrateur du dossier', () => {
        const avant = source.slice(0, source.indexOf("@Post('acceptation')"));
        expect(avant.slice(avant.lastIndexOf('@Roles(')).startsWith('@Roles(RoleUtilisateur.ADMIN_CABINET)')).toBe(true);
    });
    it('le renvoi de l’accusé est réservé à l’administrateur du dossier', () => {
        const avant = source.slice(0, source.indexOf("@Post('accuse')"));
        expect(avant.slice(avant.lastIndexOf('@Roles(')).startsWith('@Roles(RoleUtilisateur.ADMIN_CABINET)')).toBe(true);
    });
    it('reste hors de LicenceGuard · un dossier en lecture seule doit pouvoir accepter', () => {
        expect(source).toContain('@UseGuards(JwtAuthGuard, RolesGuard)');
        expect(source).not.toContain('LicenceGuard)');
    });
});
describe('l’acceptation reçue (DTO)', () => {
    const { validateSync } = require('class-validator');
    const { plainToInstance } = require('class-transformer');
    const { AccepterConditionsDto } = require('./dto/conditions-licence.dto');
    const erreurs = (corps) => validateSync(plainToInstance(AccepterConditionsDto, corps)).map((e) => e.property);
    const EC = (0, acceptation_conditions_1.empreinteCommande)(COMMANDE);
    it('exige l’empreinte du texte lu, en 64 chiffres hexadécimaux (relecture M1)', () => {
        expect(erreurs({ version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), empreinteCommande: EC, lu: true })).toEqual([]);
        expect(erreurs({ version: 1, empreinteCommande: EC, lu: true })).toEqual(['empreinte']);
        expect(erreurs({ version: 1, empreinte: 'abc', empreinteCommande: EC, lu: true })).toEqual(['empreinte']);
    });
    it('exige l’empreinte de l’abonnement affiché (second tour, M-a)', () => {
        expect(erreurs({ version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), lu: true })).toEqual(['empreinteCommande']);
        expect(erreurs({ version: 1, empreinte: (0, versions_publiees_1.empreinteEnVigueur)(), empreinteCommande: 'xyz', lu: true })).toEqual(['empreinteCommande']);
    });
});
//# sourceMappingURL=conditions-licence.spec.js.map