"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const faiblesses_service_1 = require("./faiblesses.service");
const EXERCICE = { id: 'ex1', tenantId: 't1' };
const EXERCICES = [
    { id: 'ex0', tenantId: 't1', dateDebut: new Date('2025-01-01') },
    { id: 'ex1', tenantId: 't1', dateDebut: new Date('2026-01-01') },
    { id: 'ex2', tenantId: 't1', dateDebut: new Date('2027-01-01') },
];
function service(etat = {}) {
    const majFaiblesse = jest.fn().mockImplementation((a) => Promise.resolve({ id: a.where.id, ...a.data }));
    const majRegistre = jest.fn().mockImplementation((a) => Promise.resolve({ id: a.where.id, ...a.data }));
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue(EXERCICE),
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(EXERCICES.filter((e) => e.tenantId === where.tenantId && where.id.in.includes(e.id)))),
        },
        registreFaiblesses: {
            findFirst: jest.fn().mockResolvedValue(etat.registre ?? null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'reg1', ...a.data })),
            update: majRegistre,
        },
        faiblesseControleInterne: {
            findFirst: jest.fn().mockResolvedValue(etat.faiblesse ?? null),
            findMany: jest.fn().mockResolvedValue(etat.faiblesses ?? []),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'f9', ...a.data })),
            update: majFaiblesse,
        },
    };
    return { svc: new faiblesses_service_1.FaiblessesService(prisma), majFaiblesse, majRegistre };
}
const registre = (origine, statut = client_1.StatutRegistreFaiblesses.OUVERT, extra = {}) => ({ id: 'reg1', tenantId: 't1', exerciceId: 'ex1', origine, statut, ...extra });
const faiblesse = (o = {}) => ({
    id: 'f1',
    tenantId: 't1',
    registreId: 'reg1',
    reference: 'F-01',
    intitule: 'Séparation des tâches en caisse',
    description: 'Le caissier saisit et valide.',
    effetPotentiel: 'Un décaissement peut sortir sans second regard.',
    qualification: client_1.QualificationFaiblesse.NON_QUALIFIEE,
    statut: client_1.StatutFaiblesse.OUVERTE,
    indicateursA7: [],
    communiqueeLe: null,
    constatePar: 'u-cabinet',
    registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE),
    ...o,
});
describe('le double régime de report · § A17 contre § A24', () => {
    it('refuse le report muet d’une significative non remédiée', () => {
        expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.SIGNIFICATIVE, client_1.StatutFaiblesse.OUVERTE)).toBe('REFUS_DU_REPORT_MUET');
        expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.SIGNIFICATIVE, client_1.StatutFaiblesse.EN_COURS_DE_REMEDIATION)).toBe('REFUS_DU_REPORT_MUET');
        expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.SIGNIFICATIVE, client_1.StatutFaiblesse.NON_REMEDIEE_ASSUMEE)).toBe('REFUS_DU_REPORT_MUET');
    });
    it('n’exige rien d’une AUTRE faiblesse · « need not repeat »', () => {
        for (const s of [
            client_1.StatutFaiblesse.OUVERTE,
            client_1.StatutFaiblesse.EN_COURS_DE_REMEDIATION,
            client_1.StatutFaiblesse.NON_REMEDIEE_ASSUMEE,
        ]) {
            expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.AUTRE, s)).toBe('LIBRE');
        }
    });
    it('n’exige rien d’une significative remédiée ou sans objet · § A17 vise « if remedial action has NOT yet been taken »', () => {
        expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.SIGNIFICATIVE, client_1.StatutFaiblesse.REMEDIEE)).toBe('LIBRE');
        expect(faiblesses_service_1.FaiblessesService.regimeDeReport(client_1.QualificationFaiblesse.SIGNIFICATIVE, client_1.StatutFaiblesse.SANS_OBJET)).toBe('LIBRE');
    });
    it('ne réclame la communication reconduite que sur la population du § A17', () => {
        const sig = { qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE, statut: client_1.StatutFaiblesse.OUVERTE };
        const autre = { qualification: client_1.QualificationFaiblesse.AUTRE, statut: client_1.StatutFaiblesse.OUVERTE };
        expect(faiblesses_service_1.FaiblessesService.manquesDuReport(sig, {})).toHaveLength(1);
        expect(faiblesses_service_1.FaiblessesService.manquesDuReport(sig, { communicationReconduite: '   ' })).toHaveLength(1);
        expect(faiblesses_service_1.FaiblessesService.manquesDuReport(sig, { communicationReconduite: 'Voir lettre du 12/03/2026.' })).toEqual([]);
        expect(faiblesses_service_1.FaiblessesService.manquesDuReport(autre, {})).toEqual([]);
    });
});
describe('ce qui empêche de clore le registre', () => {
    const ref = (r, q, communiqueeLe) => ({
        reference: r,
        qualification: q,
        communiqueeLe,
    });
    it('refuse une faiblesse laissée non qualifiée · § 8, la détermination est une obligation', () => {
        const motifs = faiblesses_service_1.FaiblessesService.motifsRefusCloture(client_1.OrigineFaiblesse.REVISION_INTERNE, [
            ref('F-01', client_1.QualificationFaiblesse.NON_QUALIFIEE, null),
        ]);
        expect(motifs).toHaveLength(1);
        expect(motifs[0]).toContain('F-01');
        expect(motifs[0]).toContain('§ 8');
    });
    it('refuse une significative jamais sortie par écrit · § 9', () => {
        const motifs = faiblesses_service_1.FaiblessesService.motifsRefusCloture(client_1.OrigineFaiblesse.REVISION_INTERNE, [
            ref('F-02', client_1.QualificationFaiblesse.SIGNIFICATIVE, null),
        ]);
        expect(motifs).toHaveLength(1);
        expect(motifs[0]).toContain('§ 9');
    });
    it('laisse passer une significative communiquée et une autre faiblesse muette', () => {
        expect(faiblesses_service_1.FaiblessesService.motifsRefusCloture(client_1.OrigineFaiblesse.REVISION_INTERNE, [
            ref('F-03', client_1.QualificationFaiblesse.SIGNIFICATIVE, new Date('2026-03-12')),
            ref('F-04', client_1.QualificationFaiblesse.AUTRE, null),
        ])).toEqual([]);
    });
    it('ne réclame ni qualification ni écrit au porte-documents · ce travail est celui de l’émetteur', () => {
        expect(faiblesses_service_1.FaiblessesService.motifsRefusCloture(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE, [
            ref('R-01', client_1.QualificationFaiblesse.NON_QUALIFIEE, null),
            ref('R-02', client_1.QualificationFaiblesse.SIGNIFICATIVE, null),
        ])).toEqual([]);
    });
});
describe('les deux modes ne donnent pas les mêmes droits', () => {
    it('exige l’émetteur et la date sur une recommandation reçue', async () => {
        const { svc } = service();
        await expect(svc.creer('t1', 'u1', {
            exerciceId: 'ex1',
            origine: client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE,
            libelle: 'Lettre du CAC',
        })).rejects.toThrow(/émetteur et la date/);
    });
    it('refuse un émetteur tiers sur un registre de révision interne', async () => {
        const { svc } = service();
        await expect(svc.creer('t1', 'u1', {
            exerciceId: 'ex1',
            origine: client_1.OrigineFaiblesse.REVISION_INTERNE,
            libelle: 'Révision 2026',
            emetteur: 'Cabinet X',
        })).rejects.toThrow(/ne se cite pas lui-même/);
    });
    it('refuse au cabinet de qualifier ce qu’un tiers a écrit', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ registre: registre(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE) }),
        });
        await expect(svc.qualifier('t1', 'f1', 'u1', {
            qualification: client_1.QualificationFaiblesse.AUTRE,
            justification: 'Peu structurant.',
        })).rejects.toThrow(/porte-documents/);
    });
    it('refuse un constat du cabinet dans un registre de recommandations reçues', async () => {
        const { svc } = service({ registre: registre(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE) });
        await expect(svc.ajouter('t1', 'reg1', 'u1', {
            reference: 'R-01',
            intitule: 'x',
            description: 'y',
            effetPotentiel: 'z',
            constatePar: 'u-cabinet',
        })).rejects.toThrow(/pas celui du cabinet/);
    });
    it('recopie la qualification de la lettre en externe, et ne la prend jamais en interne', async () => {
        const externe = service({ registre: registre(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE) });
        const cree = await externe.svc.ajouter('t1', 'reg1', 'u1', {
            reference: 'R-01',
            intitule: 'x',
            description: 'y',
            effetPotentiel: 'z',
            qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE,
        });
        expect(cree.qualification).toBe(client_1.QualificationFaiblesse.SIGNIFICATIVE);
        const interne = service({ registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE) });
        const cree2 = await interne.svc.ajouter('t1', 'reg1', 'u1', {
            reference: 'F-01',
            intitule: 'x',
            description: 'y',
            effetPotentiel: 'z',
            qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE,
        });
        expect(cree2.qualification).toBe(client_1.QualificationFaiblesse.NON_QUALIFIEE);
    });
});
describe('la qualification est un jugement, pas une case', () => {
    it('exige la justification écrite', async () => {
        const { svc } = service({ faiblesse: faiblesse() });
        await expect(svc.qualifier('t1', 'f1', 'u1', { qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE, justification: '  ' })).rejects.toThrow(/§ 8/);
    });
    it('refuse de dé-qualifier vers l’état de départ', async () => {
        const { svc } = service({ faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE }) });
        await expect(svc.qualifier('t1', 'f1', 'u1', { qualification: client_1.QualificationFaiblesse.NON_QUALIFIEE, justification: 'x' })).rejects.toThrow(/état de départ/);
    });
    it('inscrit l’auteur et la date du jugement', async () => {
        const { svc, majFaiblesse } = service({ faiblesse: faiblesse() });
        await svc.qualifier('t1', 'f1', 'u-associe', {
            qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE,
            justification: 'Le décaissement échappe au second regard.',
        });
        expect(majFaiblesse.mock.calls[0][0].data.qualifiePar).toBe('u-associe');
        expect(majFaiblesse.mock.calls[0][0].data.qualifieLe).toBeInstanceOf(Date);
    });
    it('refuse un indicateur qui n’est pas du § A7', async () => {
        const { svc } = service({ registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE) });
        await expect(svc.ajouter('t1', 'reg1', 'u1', {
            reference: 'F-01',
            intitule: 'x',
            description: 'y',
            effetPotentiel: 'z',
            indicateursA7: ['MONTANT_SUPERIEUR_AU_SEUIL'],
        })).rejects.toThrow(/hors § A7/);
    });
    it('porte les neuf indicateurs du § A7', () => {
        expect(faiblesses_service_1.FaiblessesService.INDICATEURS_A7).toHaveLength(9);
        expect(faiblesses_service_1.FaiblessesService.INDICATEURS_A7).toContain('REMEDIATION_ANTERIEURE_NON_MISE_EN_OEUVRE');
    });
});
describe('le constat et la réponse ne sont pas de la même main', () => {
    it('refuse que l’auteur du constat signe la réponse de la direction', async () => {
        const { svc } = service({ faiblesse: faiblesse({ constatePar: 'u-cabinet' }) });
        await expect(svc.reponseDirection('t1', 'f1', 'u-cabinet', { reponseDirection: 'Nous corrigeons.' })).rejects.toThrow(/ne peut pas signer/);
    });
    it('accepte la réponse d’un autre utilisateur', async () => {
        const { svc, majFaiblesse } = service({ faiblesse: faiblesse({ constatePar: 'u-cabinet' }) });
        await svc.reponseDirection('t1', 'f1', 'u-direction', { reponseDirection: 'Nous corrigeons.' });
        expect(majFaiblesse.mock.calls[0][0].data.reponseDirectionPar).toBe('u-direction');
    });
});
describe('remédier n’est pas déclarer', () => {
    it('refuse « remédiée » sans dire si le cabinet a vérifié · § A28', async () => {
        const { svc } = service({ faiblesse: faiblesse() });
        await expect(svc.suivre('t1', 'f1', { statut: client_1.StatutFaiblesse.REMEDIEE })).rejects.toThrow(/§ A28/);
    });
    it('accepte « non vérifiée par le cabinet » comme réponse', async () => {
        const { svc, majFaiblesse } = service({ faiblesse: faiblesse() });
        await svc.suivre('t1', 'f1', {
            statut: client_1.StatutFaiblesse.REMEDIEE,
            verificationCabinet: 'Non vérifiée par le cabinet · déclaration de la direction.',
        });
        expect(majFaiblesse.mock.calls[0][0].data.remedieeLe).toBeInstanceOf(Date);
    });
    it('refuse « non remédiée assumée » sans la raison · § A24 et § A17', async () => {
        const { svc } = service({ faiblesse: faiblesse() });
        await expect(svc.suivre('t1', 'f1', { statut: client_1.StatutFaiblesse.NON_REMEDIEE_ASSUMEE })).rejects.toThrow(/§ A24/);
    });
});
describe('l’escalade du § A24 est un acte, pas un effet du calendrier', () => {
    it('ne vise que les AUTRES faiblesses', async () => {
        const { svc } = service({ faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE }) });
        await expect(svc.escalader('t1', 'f1', 'u1', { motif: 'x' })).rejects.toThrow(/que les AUTRES/);
    });
    it('ne vise pas une faiblesse remédiée', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.AUTRE, statut: client_1.StatutFaiblesse.REMEDIEE }),
        });
        await expect(svc.escalader('t1', 'f1', 'u1', { motif: 'x' })).rejects.toThrow(/rien à escalader/);
    });
    it('ne requalifie pas la lettre d’un tiers, comme `qualifier` (audit final F73)', async () => {
        const { svc, majFaiblesse } = service({
            faiblesse: faiblesse({
                qualification: client_1.QualificationFaiblesse.AUTRE,
                statut: client_1.StatutFaiblesse.OUVERTE,
                registre: registre(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE),
            }),
        });
        await expect(svc.escalader('t1', 'f1', 'u1', { motif: 'Deux exercices sans action.' })).rejects.toThrow(/porte-documents/);
        expect(majFaiblesse).not.toHaveBeenCalled();
    });
    it('remet l’écrit du § 9 à faire · le destinataire n’est plus le même', async () => {
        const { svc, majFaiblesse } = service({
            faiblesse: faiblesse({
                qualification: client_1.QualificationFaiblesse.AUTRE,
                statut: client_1.StatutFaiblesse.OUVERTE,
                communiqueeLe: new Date('2026-02-01'),
                communiqueeA: 'Direction générale',
            }),
        });
        await svc.escalader('t1', 'f1', 'u1', { motif: 'Deux exercices sans action, sans explication.' });
        const data = majFaiblesse.mock.calls[0][0].data;
        expect(data.qualification).toBe(client_1.QualificationFaiblesse.SIGNIFICATIVE);
        expect(data.communiqueeLe).toBeNull();
        expect(data.communiqueeA).toBeNull();
        expect(data.escaladeeLe).toBeInstanceOf(Date);
    });
});
describe('le report, de bout en bout', () => {
    it('refuse le report muet d’une significative non remédiée', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.SIGNIFICATIVE, reconduction: null }),
            registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg2', exerciceId: 'ex2' }),
        });
        await expect(svc.reporter('t1', 'f1', { registreCibleId: 'reg2' })).rejects.toThrow(/A17/);
    });
    it('reporte une AUTRE faiblesse sans rien réclamer', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.AUTRE, reconduction: null }),
            registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg2', exerciceId: 'ex2' }),
        });
        const nouvelle = await svc.reporter('t1', 'f1', { registreCibleId: 'reg2' });
        expect(nouvelle.faiblesseAnterieureId).toBe('f1');
        expect(nouvelle.registreId).toBe('reg2');
        expect(nouvelle.statut).toBe(client_1.StatutFaiblesse.OUVERTE);
    });
    it('refuse un second report de la même faiblesse', async () => {
        const { svc } = service({
            faiblesse: faiblesse({
                qualification: client_1.QualificationFaiblesse.AUTRE,
                reconduction: { id: 'f2', reference: 'F-01' },
            }),
            registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg2', exerciceId: 'ex2' }),
        });
        await expect(svc.reporter('t1', 'f1', { registreCibleId: 'reg2' })).rejects.toThrow(/déjà reportée/);
    });
    it('refuse un report sur le registre d’origine', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.AUTRE, reconduction: null }),
            registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg1' }),
        });
        await expect(svc.reporter('t1', 'f1', { registreCibleId: 'reg1' })).rejects.toThrow(/registre d’origine|registre cible/i);
    });
    it('refuse un report vers un registre d’une autre origine (audit final F74)', async () => {
        const { svc } = service({
            faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.AUTRE, reconduction: null }),
            registre: registre(client_1.OrigineFaiblesse.RECOMMANDATION_EXTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg2', exerciceId: 'ex2' }),
        });
        await expect(svc.reporter('t1', 'f1', { registreCibleId: 'reg2' })).rejects.toThrow(/même origine/);
    });
    it('refuse un report vers un exercice antérieur ou le même (audit final F74)', async () => {
        for (const exerciceId of ['ex0', 'ex1']) {
            const { svc } = service({
                faiblesse: faiblesse({ qualification: client_1.QualificationFaiblesse.AUTRE, reconduction: null }),
                registre: registre(client_1.OrigineFaiblesse.REVISION_INTERNE, client_1.StatutRegistreFaiblesses.OUVERT, { id: 'reg2', exerciceId }),
            });
            await expect(svc.reporter('t1', 'f1', { registreCibleId: 'reg2' })).rejects.toThrow(/exercice postérieur/);
        }
    });
});
describe('ce que la source ne doit jamais porter', () => {
    const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'faiblesses.service.ts'), 'utf8');
    it('ne chiffre jamais l’effet potentiel · § A28, « need not quantify »', () => {
        expect(source).not.toMatch(/montantEffet|effetChiffre|seuilSignificativite/);
    });
    it('ne qualifie jamais à partir d’un nombre', () => {
        const lignes = source.split('\n');
        const suspectes = lignes.filter((l) => /SIGNIFICATIVE/.test(l) && /[<>]=?\s*\d|\d\s*[<>]=?/.test(l));
        expect(suspectes).toEqual([]);
    });
    it('cite les deux paragraphes opposés du report', () => {
        expect(source).toContain('A17');
        expect(source).toContain('A24');
    });
});
//# sourceMappingURL=faiblesses.spec.js.map