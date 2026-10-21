"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const champs_audites_1 = require("./champs-audites");
const RACINE = (0, node_path_1.join)(__dirname, '..', '..', '..');
function colonnesDuModele(nom) {
    const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
    const bloc = new RegExp(`^model ${nom} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
    if (!bloc)
        throw new Error(`Modèle ${nom} introuvable dans le schéma.`);
    return bloc[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
        .map((l) => l.split(/\s+/)[0]);
}
describe('la liste d’exclusion est fermée sur User', () => {
    const ADMISES = [
        'id',
        'tenantId',
        'tenant',
        'email',
        'role',
        'estActif',
        'doitChangerMotDePasse',
        'sessionsInvalidesAvant',
        'tentativesEchouees',
        'verrouilleJusqua',
        'dernierEchecLe',
        'createdAt',
        'restreindreFonctions',
        'fonctionsAutorisees',
        'restreindreJournaux',
        'journauxAutorises',
        'doubleAuthActiveDepuis',
    ];
    it('classe chaque colonne de User, sans exception ni oubli', () => {
        const exclues = champs_audites_1.COLONNES_EXCLUES_PAR_MODELE.User;
        expect([...colonnesDuModele('User')].sort()).toEqual([...ADMISES, ...exclues].sort());
    });
    it('masque estOperateurPlateforme dans la charge d’un événement User', () => {
        const ligne = {
            id: 'u-1',
            email: 'jean@asbl.cd',
            motDePasse: '$2b$10$empreinteBcrypt',
            role: 'COMPTABLE',
            estOperateurPlateforme: true,
        };
        const masque = (0, champs_audites_1.masquer)(ligne, (0, champs_audites_1.colonnesExclues)('User'));
        expect(masque.estOperateurPlateforme).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(masque.motDePasse).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(masque.email).toBe('jean@asbl.cd');
        expect(masque.role).toBe('COMPTABLE');
    });
    it('masque à toute profondeur, filtre d’une opération de masse compris', () => {
        const masse = {
            operation: 'updateMany',
            filtre: { tenantId: 'd-1', estOperateurPlateforme: false },
            resultat: { count: 3 },
        };
        const masque = (0, champs_audites_1.masquer)(masse, (0, champs_audites_1.colonnesExclues)('User'));
        expect(masque.filtre.estOperateurPlateforme).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(masque.filtre.tenantId).toBe('d-1');
    });
    const ADMISES_PAR_MODELE = {
        Salarie: [
            'id',
            'tenantId',
            'tenant',
            'matricule',
            'nom',
            'postNom',
            'prenoms',
            'sexe',
            'aptitudeConstateeLe',
            'aptitudeConstateePar',
            'aptitudeProvisoire',
            'declarationEngagementLe',
            'declarationDepartLe',
            'actif',
            'contrats',
            'enfants',
            'bulletins',
            'avances',
            'repriseConges',
            'conges',
            'absences',
            'modePaiement',
            'ribs',
            'lignesPaiement',
            'ordresVirement',
            'repartitionsAnalytiques',
            'piecesJointes',
            'createdAt',
            'createdBy',
            'updatedAt',
        ],
        EnfantACharge: ['id', 'tenantId', 'tenant', 'salarieId', 'salarie', 'createdAt', 'updatedAt'],
        ContratTravail: [
            'id',
            'tenantId',
            'tenant',
            'salarieId',
            'salarie',
            'type',
            'constateParEcrit',
            'dateEntreeEnVigueur',
            'dateConclusion',
            'lieuConclusion',
            'dateFinPrevue',
            'separeDeSaFamille',
            'ouvrageDetermine',
            'motifRemplacement',
            'emploiPermanent',
            'natureTravail',
            'lieuExecution',
            'categorieProfessionnelle',
            'classeProfessionnelle',
            'periodiciteRemuneration',
            'deviseRemuneration',
            'manoeuvreSansSpecialite',
            'clauseEssai',
            'essaiConstateParEcrit',
            'essaiDureeJours',
            'dureePreavisJours',
            'viseParOnem',
            'dateVisaOnem',
            'renouvelleDeId',
            'renouvelleDe',
            'renouvellement',
            'bulletins',
            'dateFin',
            'motifFin',
            'createdAt',
            'createdBy',
            'updatedAt',
        ],
        BulletinPaie: [
            'id',
            'tenantId',
            'tenant',
            'salarieId',
            'salarie',
            'contratId',
            'contrat',
            'numero',
            'moisDePaie',
            'statut',
            'nature',
            'nomComplet',
            'matricule',
            'emploi',
            'categorieProfessionnelle',
            'emisLe',
            'emisPar',
            'remisLe',
            'annuleLe',
            'annulePar',
            'motifAnnulation',
            'ecritureId',
            'ecriture',
            'ecritureNegatifId',
            'ecritureNegatif',
            'retenuesAvance',
            'allocationsConge',
            'lignesPaiement',
        ],
        CongeSalarie: [
            'id',
            'tenantId',
            'tenant',
            'salarieId',
            'salarie',
            'du',
            'au',
            'joursVoyage',
            'moisDePaie',
            'deviseAllocation',
            'auDelaDuSolde',
            'motifAuDelaDuSolde',
            'bulletinId',
            'bulletin',
            'annuleLe',
            'annulePar',
            'motifAnnulation',
            'creePar',
            'createdAt',
        ],
        AbsenceSalarie: [
            'id',
            'tenantId',
            'tenant',
            'salarieId',
            'salarie',
            'du',
            'au',
            'demiJourneeDebut',
            'demiJourneeFin',
            'evenement',
            'annuleLe',
            'annulePar',
            'motifAnnulation',
            'creePar',
            'createdAt',
            'indemnitesCaisse',
        ],
        IndemniteCaisseAbsence: [
            'id',
            'tenantId',
            'tenant',
            'absenceId',
            'absence',
            'mois',
            'traitement',
            'annuleLe',
            'annulePar',
            'motifAnnulation',
            'creePar',
            'createdAt',
        ],
        AvanceSalaire: [
            'id',
            'tenantId',
            'tenant',
            'salarieId',
            'salarie',
            'type',
            'categoriePret',
            'dateOctroi',
            'pieceJustificative',
            'referenceActe',
            'greffe',
            'destinataire',
            'dateFin',
            'creePar',
            'createdAt',
            'retenues',
        ],
        RibSalarie: ['id', 'tenantId', 'tenant', 'salarieId', 'salarie', 'banque', 'devise', 'estPrincipal', 'createdAt'],
        PaiementSalaires: [
            'id',
            'tenantId',
            'tenant',
            'moisDePaie',
            'mode',
            'exerciceId',
            'exercice',
            'journalId',
            'journal',
            'date',
            'ecritureId',
            'ecriture',
            'ecritureNegatifId',
            'ecritureNegatif',
            'piecePassee',
            'ordreVirementId',
            'ordreVirement',
            'creePar',
            'createdAt',
            'annuleLe',
            'annulePar',
            'motifAnnulation',
            'lignes',
        ],
    };
    it.each(Object.keys(ADMISES_PAR_MODELE))('classe chaque colonne de %s, sans exception ni oubli', (modele) => {
        const exclues = champs_audites_1.COLONNES_EXCLUES_PAR_MODELE[modele] ?? [];
        expect([...colonnesDuModele(modele)].sort()).toEqual([...ADMISES_PAR_MODELE[modele], ...exclues].sort());
    });
    it('LE JOURNAL DIT QUI, PAS QUOI · un salarié reste identifiable, sa vie non', () => {
        const ligne = {
            id: 's-1',
            matricule: 'M-014',
            nom: 'Mukendi',
            sexe: 'FEMININ',
            nationalite: 'Congolaise',
            dateNaissance: new Date('1990-04-12'),
            nomConjoint: 'Kabeya Marie',
            numeroAffiliationCnss: 'CNSS-0099',
            lieuNaissance: 'Mbuji-Mayi',
            actif: true,
        };
        const m = (0, champs_audites_1.masquer)(ligne, (0, champs_audites_1.colonnesExclues)('Salarie'));
        expect(m.nom).toBe('Mukendi');
        expect(m.matricule).toBe('M-014');
        expect(m.sexe).toBe('FEMININ');
        expect(m.actif).toBe(true);
        for (const champ of [
            'nationalite',
            'dateNaissance',
            'nomConjoint',
            'numeroAffiliationCnss',
            'lieuNaissance',
        ]) {
            expect(m[champ]).toBe(champs_audites_1.MARQUEUR_MASQUE);
        }
        expect(Object.keys(m)).toContain('dateNaissance');
    });
    it('LA RÉMUNÉRATION EST MASQUÉE, le reste du contrat non', () => {
        const ligne = {
            id: 'c-1',
            type: 'DUREE_DETERMINEE',
            dateEntreeEnVigueur: new Date('2026-01-05'),
            remunerationBase: 1_200_000,
            avantagesConvenus: 'Logement de fonction',
            emploiPermanent: false,
        };
        const m = (0, champs_audites_1.masquer)(ligne, (0, champs_audites_1.colonnesExclues)('ContratTravail'));
        expect(m.remunerationBase).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(m.avantagesConvenus).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(m.type).toBe('DUREE_DETERMINEE');
        expect(m.emploiPermanent).toBe(false);
    });
    it('RELECTURE L5, MINEUR 4 · la nature d’une absence et l’indemnité de la Caisse ne se lisent pas au journal', () => {
        const absence = (0, champs_audites_1.masquer)({ id: 'a-1', salarieId: 's-1', nature: 'MATERNITE', du: new Date('2026-08-03'), au: new Date('2026-11-08'), piece: 'Certificat' }, (0, champs_audites_1.colonnesExclues)('AbsenceSalarie'));
        expect([absence.nature, absence.piece]).toEqual([champs_audites_1.MARQUEUR_MASQUE, champs_audites_1.MARQUEUR_MASQUE]);
        expect(absence.salarieId).toBe('s-1');
        const indemnite = (0, champs_audites_1.masquer)({ id: 'i-1', absenceId: 'a-1', mois: '2026-08', montant: 180_000, traitement: 'SUBROGATION', piece: 'Bordereau CNSS 118' }, (0, champs_audites_1.colonnesExclues)('IndemniteCaisseAbsence'));
        expect([indemnite.montant, indemnite.piece]).toEqual([champs_audites_1.MARQUEUR_MASQUE, champs_audites_1.MARQUEUR_MASQUE]);
        expect([indemnite.mois, indemnite.traitement]).toEqual(['2026-08', 'SUBROGATION']);
    });
    it('UN ENFANT NE SE NOMME PAS AU JOURNAL · seul son rattachement y reste', () => {
        const m = (0, champs_audites_1.masquer)({ id: 'e-1', salarieId: 's-1', nom: 'Mukendi', prenoms: 'Grace', dateNaissance: new Date('2019-02-01') }, (0, champs_audites_1.colonnesExclues)('EnfantACharge'));
        expect(m.salarieId).toBe('s-1');
        expect(m.nom).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(m.prenoms).toBe(champs_audites_1.MARQUEUR_MASQUE);
        expect(m.dateNaissance).toBe(champs_audites_1.MARQUEUR_MASQUE);
    });
    it('L’EXCLUSION EST PAR MODÈLE · « nom » reste lisible ailleurs', () => {
        expect((0, champs_audites_1.estChampSensible)('nom', (0, champs_audites_1.colonnesExclues)('EnfantACharge'))).toBe(true);
        expect((0, champs_audites_1.estChampSensible)('nom', (0, champs_audites_1.colonnesExclues)('Salarie'))).toBe(false);
        expect((0, champs_audites_1.estChampSensible)('nom', (0, champs_audites_1.colonnesExclues)('Tiers'))).toBe(false);
    });
    it('n’exclut rien sur un modèle qui n’a pas de liste', () => {
        expect((0, champs_audites_1.colonnesExclues)('Compte').size).toBe(0);
        expect((0, champs_audites_1.estChampSensible)('estOperateurPlateforme')).toBe(false);
        expect((0, champs_audites_1.estChampSensible)('estOperateurPlateforme', (0, champs_audites_1.colonnesExclues)('User'))).toBe(true);
    });
});
//# sourceMappingURL=liste-exclusion-fermee.spec.js.map