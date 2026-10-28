#!/usr/bin/env node
'use strict';
/**
 * REJEU SUR VRAIE BASE · ligne Microfina M4 (détenteur d'un bien).
 * Serveur COMPILÉ contre une base PostgreSQL jetable déjà migrée.
 * Affectation en N (2025), clôture de N, transfert en N+1 (2026), libération,
 * suivi lu sur les deux exercices ; aucune écriture comptable née des actes.
 *   DATABASE_URL=postgresql://... node scripts/rejouer-detentions-biens.cjs
 */
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const RACINE = process.env.RACINE || join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!RACINE || !/localhost|127\.0\.0\.1/.test(URL_BASE)) { console.error('RACINE et DATABASE_URL locale exigés'); process.exit(2); }
const PORT = 8097;
const API = `http://127.0.0.1:${PORT}`;
const MDP = 'MotDePasse-rejeu-2026!';
const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
const echecs = [];
const verifier = (c, m) => { if (!c) { echecs.push(m); console.log(`  ECHEC · ${m}`); } else console.log(`  ok · ${m}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 1;
class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; }
  async appeler(m, chemin, corps, attendu = [200, 201]) {
    const k = (Date.now() + n++ * 7919) % 16777216;
    const h = { 'X-Forwarded-For': `10.${(k >> 16) & 255}.${(k >> 8) & 255}.${k & 255}` };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([a, b]) => `${a}=${b}`).join('; ');
    if (this.csrf && m !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: m, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(';'); const i = p.indexOf('='); const v = p.slice(i + 1); if (!v || /1970/.test(c)) this.cookies.delete(p.slice(0, i)); else this.cookies.set(p.slice(0, i), v); }
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : undefined; } catch { j = t; }
    if (j && typeof j === 'object' && typeof j.csrfToken === 'string') this.csrf = j.csrfToken;
    if (!attendu.includes(r.status)) { const e = new Error(`${m} ${chemin} · ${r.status} · ${t.slice(0, 600)}`); e.statut = r.status; throw e; }
    return { statut: r.status, corps: j };
  }
  get(c) { return this.appeler('GET', c).then((r) => r.corps); }
  post(c, b, a) { return this.appeler('POST', c, b ?? {}, a).then((r) => r.corps); }
  patch(c, b) { return this.appeler('PATCH', c, b).then((r) => r.corps); }
  del(c, a) { return this.appeler('DELETE', c, undefined, a).then((r) => r); }
  statut(m, c, b) { return this.appeler(m, c, b, [200, 201, 400, 403, 404, 409]).then((r) => r); }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: URL_BASE, JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef', JWT_EXPIRES_IN: '8h', PORT: String(PORT), CORS_ORIGIN: 'http://localhost:4173', INSCRIPTION_PUBLIQUE: 'true', NODE_ENV: 'production' };
  const srv = spawn(process.execPath, [join(RACINE, 'dist', 'main.js')], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = ''; srv.stdout.on('data', (d) => (journal += d)); srv.stderr.on('data', (d) => (journal += d));
  try {
    let pret = false;
    for (let i = 0; i < 90; i++) { try { if ((await fetch(`${API}/health`)).ok) { pret = true; break; } } catch {} await attendre(1000); }
    if (!pret) throw new Error(`serveur non démarré\n${journal.slice(-3000)}`);
    const stamp = Date.now();
    const email = `m4-${stamp}@exemple.invalid`;
    const A = new Client();
    await A.post('/auth/register', { nomEntite: 'Rejeu M4 SARL', referentiel: 'SYSCOHADA', email, motDePasse: MDP, systemeComptableSyscohada: 'NORMAL' });
    await A.post('/auth/login', { email, motDePasse: MDP });
    const tenantId = (await A.get('/auth/me')).tenant?.id ?? (await prisma.user.findFirst({ where: { email } })).tenantId;
    let exercices = await A.get('/exercices');
    const e2026 = exercices.find((e) => e.dateDebut.startsWith('2026'));
    const e2025 = await A.post('/exercices', { dateDebut: '2025-01-01', dateFin: '2025-12-31' });
    console.log('exercices', e2025.id, e2026?.id);

    // Personnel · trois salariés.
    const s1 = await A.post('/personnel/salaries', { nom: 'KABILA', prenoms: 'Jean', sexe: 'MASCULIN', matricule: 'M-01' });
    await A.post(`/personnel/salaries/${s1.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2024-01-01' });
    const s2 = await A.post('/personnel/salaries', { nom: 'MBUYI', prenoms: 'Anne', sexe: 'FEMININ' });
    await A.post(`/personnel/salaries/${s2.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2025-06-01' });
    const s3 = await A.post('/personnel/salaries', { nom: 'TSHIBANDA', sexe: 'MASCULIN' });
    const c3 = await A.post(`/personnel/salaries/${s3.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2024-01-01' });
    await A.post(`/personnel/contrats/${c3.id}/fin`, { dateFin: '2025-03-31', motifFin: 'Démission' }, [200, 201]).catch((e) => console.log('  (fin de contrat)', e.message.slice(0, 300)));

    // Le bien · repris au bilan d'ouverture de 2025, aucune écriture.
    const plan = await A.get('/comptes?typeCompte=DETAIL');
    const c2441 = plan.find((c) => c.numero === '24410000') ?? plan.find((c) => c.numero.startsWith('244'));
    await A.patch(`/comptes/${c2441.id}`, { estRetenu: true });
    const lieu = await A.post('/immobilisations/lieux', { code: 'DG', intitule: 'Direction générale' });
    const bien = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Ordinateur portable', numeroInventaire: 'INV-0001',
      dateAcquisition: '2024-06-01', dateMiseEnService: '2024-06-01', valeurOrigine: 1200000, dureeAmortissementAns: 4,
      amortissementAnterieur: 175000, repris: true, exerciceId: e2025.id,
    });
    const ecrituresAvant = await prisma.ecriture.count({ where: { tenantId } });
    console.log('bien', bien.id, 'écritures avant', ecrituresAvant);

    console.log('N = 2025');
    const aff = await A.post(`/immobilisations/${bien.id}/detentions/affectation`, { salarieId: s1.id, date: '2025-03-01', lieuId: lieu.id, observation: 'Remis avec sa sacoche' });
    verifier(aff.recuRemise?.numero === 1, `affectation · reçu n° 1 (lu ${aff.recuRemise?.numero})`);
    const fiche = await prisma.immobilisation.findUnique({ where: { id: bien.id }, select: { lieuId: true } });
    verifier(fiche.lieuId === lieu.id, 'le lieu dit devient le lieu du bien');
    let r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/affectation`, { salarieId: s2.id, date: '2025-07-01' });
    verifier(r.statut === 400 && /détenu par KABILA Jean/.test(JSON.stringify(r.corps)), `seconde affectation refusée (${r.statut})`);
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/transfert`, { salarieId: s3.id, date: '2025-05-01' });
    verifier(r.statut === 400 && /pas de contrat de travail en cours/.test(JSON.stringify(r.corps)), `transfert à un salarié sans contrat refusé (${r.statut} ${JSON.stringify(r.corps).slice(0, 160)})`);
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/transfert`, { salarieId: s2.id, date: '2025-05-01' });
    verifier(r.statut === 400 && /pas de contrat/.test(JSON.stringify(r.corps)), `transfert avant le contrat du nouveau détenteur refusé (${r.statut})`);
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/liberation`, { date: '2099-01-01' });
    verifier(r.statut === 400 && /postérieure à aujourd/.test(JSON.stringify(r.corps)), `libération future refusée (${r.statut})`);
    const recu1 = aff.recuRemise.id;
    const sig = await A.post(`/immobilisations/detentions/recus/${recu1}/signature`, { signataires: 'Jean Kabila (détenteur), le gérant', date: '2025-03-02' });
    verifier(sig.signature?.signataires?.startsWith('Jean Kabila'), 'signature déclarée');
    r = await A.statut('POST', `/immobilisations/detentions/recus/${recu1}/signature`, { signataires: 'Autre', date: '2025-03-03' });
    verifier(r.statut === 409, `seconde déclaration refusée en 409 (${r.statut})`);
    const recuTexte = await A.get(`/immobilisations/detentions/recus/${recu1}`);
    verifier(/Rejeu M4 SARL/.test(recuTexte.texte) && /N° 1/.test(recuTexte.texte) && /KABILA Jean \(matricule M-01\)/.test(recuTexte.texte), 'reçu · dossier, numéro, détenteur');

    // Aide-comptable · fermé, lecture comprise.
    const emailAide = `aide-${stamp}@exemple.invalid`;
    await A.post('/utilisateurs', { email: emailAide, motDePasse: 'Provisoire-2026-xyz!', role: 'AIDE_COMPTABLE' });
    const aide = new Client();
    await aide.post('/auth/login', { email: emailAide, motDePasse: 'Provisoire-2026-xyz!' });
    await aide.post('/auth/changer-mot-de-passe', { motDePasseActuel: 'Provisoire-2026-xyz!', nouveauMotDePasse: MDP });
    await aide.post('/auth/login', { email: emailAide, motDePasse: MDP });
    r = await aide.statut('GET', `/immobilisations/${bien.id}/detentions`);
    verifier(r.statut === 403, `aide-comptable · lecture refusée (${r.statut})`);
    r = await aide.statut('POST', `/immobilisations/${bien.id}/detentions/liberation`, { date: '2025-04-01' });
    verifier(r.statut === 403, `aide-comptable · libération refusée (${r.statut})`);

    console.log('Clôture de 2025');
    r = await A.statut('POST', `/exercices/${e2025.id}/cloturer`, {});
    if (r.statut >= 400) console.log('   refus de clôture ·', JSON.stringify(r.corps).slice(0, 800));
    const ex25 = await prisma.exercice.findUnique({ where: { id: e2025.id }, select: { statut: true } });
    verifier(ex25.statut === 'CLOTURE', `exercice 2025 clôturé (${ex25.statut})`);

    console.log('N+1 = 2026');
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/transfert`, { salarieId: s2.id, date: '2025-02-28' });
    verifier(r.statut === 400 && /2025-03-01/.test(JSON.stringify(r.corps)), `transfert antidaté sous la détention en cours refusé (${r.statut})`);
    const tr = await A.post(`/immobilisations/${bien.id}/detentions/transfert`, { salarieId: s2.id, date: '2026-02-10' });
    verifier(tr.recuRemise?.numero === 2 && tr.salarie.id === s2.id, `transfert · reçu n° 2 (lu ${tr.recuRemise?.numero})`);
    const h1 = await A.get(`/immobilisations/${bien.id}/detentions`);
    const ancienne = h1.detentions.find((d) => d.salarie.id === s1.id);
    verifier(ancienne?.dateFin === '2026-02-10' && ancienne?.recuFin?.numero === 2, 'la détention de N se ferme au jour du transfert, même reçu');
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/liberation`, { date: '2026-02-09' });
    verifier(r.statut === 400, `libération avant le début de la détention refusée (${r.statut})`);
    const lib = await A.post(`/immobilisations/${bien.id}/detentions/liberation`, { date: '2026-05-15' });
    verifier(lib.dateFin === '2026-05-15' && lib.recuFin?.numero === 3, `libération · reçu n° 3 (lu ${lib.recuFin?.numero})`);
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/liberation`, { date: '2026-05-16' });
    verifier(r.statut === 400 && /rien à libérer/.test(JSON.stringify(r.corps)), `seconde libération refusée (${r.statut})`);
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/affectation`, { salarieId: s1.id, date: '2026-05-14' });
    verifier(r.statut === 400 && /2026-05-15/.test(JSON.stringify(r.corps)), `affectation antidatée sous la dernière détention refusée (${r.statut})`);

    console.log('Suivi');
    const tout = await A.get('/immobilisations/detentions/suivi?du=2025-01-01&au=2026-12-31');
    verifier(tout.total === 2 && tout.detentions[0].dateDebut === '2025-03-01' && tout.detentions[0].dateFin === '2026-02-10' && tout.detentions[1].dateDebut === '2026-02-10' && tout.detentions[1].dateFin === '2026-05-15', 'suivi sur les deux exercices · deux détentions, dates exactes');
    const n25 = await A.get('/immobilisations/detentions/suivi?du=2025-01-01&au=2025-12-31');
    verifier(n25.total === 1 && n25.detentions[0].salarie.nom.startsWith('KABILA'), 'suivi de 2025 · KABILA seul');
    const avril26 = await A.get('/immobilisations/detentions/suivi?du=2026-03-01&au=2026-04-30');
    verifier(avril26.total === 1 && avril26.detentions[0].salarie.nom.startsWith('MBUYI'), 'suivi de mars-avril 2026 · MBUYI seule');
    const juin26 = await A.get('/immobilisations/detentions/suivi?du=2026-06-01&au=2026-06-30');
    verifier(juin26.total === 0, 'suivi de juin 2026 · personne');
    r = await A.statut('GET', '/immobilisations/detentions/suivi?du=2026-06-30&au=2026-06-01');
    verifier(r.statut === 400, 'période à l’envers refusée');

    const ecrituresApres = await prisma.ecriture.count({ where: { tenantId, NOT: { estGenereeParCloture: true } } });
    const ecrituresClotureExclues = await prisma.ecriture.count({ where: { tenantId, estGenereeParCloture: true } });
    verifier(ecrituresApres === ecrituresAvant - 0 || ecrituresApres === ecrituresAvant, `aucune écriture née des actes (${ecrituresAvant} avant, ${ecrituresApres} hors clôture après, ${ecrituresClotureExclues} de clôture)`);
    const recus = await prisma.recuDetentionBien.findMany({ where: { tenantId }, orderBy: { numero: 'asc' }, select: { numero: true } });
    verifier(recus.map((x) => x.numero).join(',') === '1,2,3', 'suite des reçus continue · 1, 2, 3');
    const maillonsD = await prisma.evenementAudit.count({ where: { tenantId, entite: 'DetentionBien' } });
    const maillonsR = await prisma.evenementAudit.count({ where: { tenantId, entite: 'RecuDetentionBien' } });
    // Détentions · 2 créations + 2 fins ; reçus · 3 créations + 1 signature.
    verifier(maillonsD === 4 && maillonsR === 4, `journal d’audit · ${maillonsD} maillons de détention (4 attendus), ${maillonsR} de reçu (4 attendus)`);

    // Suppression · la fiche et le lieu sont retenus, refus nommés (jamais un 500).
    r = await A.statut('DELETE', `/immobilisations/${bien.id}`);
    verifier(r.statut === 409 || r.statut === 400, `suppression de la fiche refusée (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
    await A.patch(`/immobilisations/${bien.id}/lieu`, { lieuId: null });
    r = await A.statut('DELETE', `/immobilisations/lieux/${lieu.id}`);
    verifier(r.statut === 400 && /détention/.test(JSON.stringify(r.corps)), `suppression du lieu porté par une détention refusée, nommée (${r.statut})`);
    const maint = await A.get(`/immobilisations/maintenance?exerciceId=${e2026.id}`).catch((e) => ({ erreur: e.message }));
    verifier(Array.isArray(maint.biensSortisEncoreDetenus) && maint.biensSortisEncoreDetenusTotal === 0, `maintenance · aucun bien sorti encore détenu (${maint.erreur ?? maint.biensSortisEncoreDetenusTotal})`);

    console.log('Second bien, dans 2026 ouvert');
    const bien2 = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Imprimante', numeroInventaire: 'INV-0002',
      dateAcquisition: '2025-02-01', dateMiseEnService: '2025-02-01', valeurOrigine: 400000, dureeAmortissementAns: 4,
      amortissementAnterieur: 91667, repris: true, exerciceId: e2026.id,
    });
    const a2 = await A.post(`/immobilisations/${bien2.id}/detentions/affectation`, { salarieId: s2.id, date: '2026-03-01' });
    verifier(a2.recuRemise?.numero === 4, `affectation du second bien · reçu n° 4 (lu ${a2.recuRemise?.numero})`);
    r = await A.statut('DELETE', `/immobilisations/${bien2.id}`);
    verifier(r.statut >= 400 && /détention/.test(JSON.stringify(r.corps)), `suppression de la fiche détenue refusée, nommée (${r.statut} ${JSON.stringify(r.corps).slice(0, 220)})`);
    const od = (await A.get('/journaux')).find((j) => j.code === 'OD');
    await A.post(`/immobilisations/${bien2.id}/sortie`, {
      dateSortie: '2026-04-30', type: 'MISE_HORS_SERVICE', exerciceId: e2026.id, journalId: od.id,
      natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV-REBUT-1', datePieceSortie: '2026-04-30',
    });
    const maint2 = await A.get(`/immobilisations/maintenance?exerciceId=${e2026.id}`);
    verifier(maint2.biensSortisEncoreDetenusTotal === 1 && maint2.biensSortisEncoreDetenus[0].designation === 'Imprimante' && !JSON.stringify(maint2.biensSortisEncoreDetenus).includes('MBUYI'), 'maintenance · le bien sorti encore détenu nommé, sans le salarié');
    const s2026 = await A.get('/immobilisations/detentions/suivi?du=2026-01-01&au=2026-12-31');
    verifier(s2026.detentionsOuvertesSurBienSorti === 1 && s2026.detentions.some((d) => d.bienSortiPendantLaDetention), 'suivi · la détention ouverte sur un bien sorti est dite');
    r = await A.statut('POST', `/immobilisations/${bien2.id}/detentions/transfert`, { salarieId: s1.id, date: '2026-05-02' });
    verifier(r.statut === 400 && /sorti du registre le 2026-04-30/.test(JSON.stringify(r.corps)), `transfert d'un bien sorti refusé (${r.statut})`);
    const l2 = await A.post(`/immobilisations/${bien2.id}/detentions/liberation`, { date: '2026-05-02' });
    verifier(l2.dateFin === '2026-05-02' && l2.recuFin?.numero === 5, 'le bien sorti se libère encore · reçu n° 5');
    r = await A.statut('POST', `/immobilisations/${bien2.id}/detentions/affectation`, { salarieId: s1.id, date: '2026-05-03' });
    verifier(r.statut === 400 && /sorti du registre/.test(JSON.stringify(r.corps)), `réaffectation d'un bien sorti refusée (${r.statut})`);

    console.log('Relecture B1 · annulation à rebours sur le bien 1, à travers la clôture de 2025');
    let h = await A.get(`/immobilisations/${bien.id}/detentions`);
    const dKab = h.detentions.find((d) => d.salarie.id === s1.id);
    const dMbu = h.detentions.find((d) => d.salarie.id === s2.id);
    verifier(h.acteAnnulable?.detentionId === dMbu.id && h.acteAnnulable?.genre === 'LIBERATION' && h.acteAnnulable?.numero === 3, `acte annulable · la libération n° 3 (lu ${JSON.stringify(h.acteAnnulable)})`);
    r = await A.statut('POST', `/immobilisations/detentions/${dKab.id}/annuler`, { recuId: dKab.recuRemise.id, motif: 'Essai sous un acte plus récent' });
    verifier(r.statut === 400 && /à rebours/.test(JSON.stringify(r.corps)), `annulation sous un acte plus récent refusée (${r.statut})`);
    r = await A.statut('POST', `/immobilisations/detentions/${dMbu.id}/annuler`, { recuId: dMbu.recuRemise.id, motif: 'Mauvais reçu visé' });
    verifier(r.statut === 409, `annulation d'un autre acte que celui montré refusée en 409 (${r.statut})`);
    r = await A.statut('POST', `/immobilisations/detentions/${dMbu.id}/annuler`, { recuId: h.acteAnnulable.recuId, motif: 'x' });
    verifier(r.statut === 400, `motif trop court refusé (${r.statut})`);
    h = await A.post(`/immobilisations/detentions/${dMbu.id}/annuler`, { recuId: h.acteAnnulable.recuId, motif: 'Retour saisi par erreur' });
    verifier(h.enCours?.salarie.id === s2.id && h.enCours.dateFin === null && h.acteAnnulable?.genre === 'REMISE' && h.acteAnnulable?.numero === 2, 'libération annulée · MBUYI détient de nouveau, le transfert n° 2 devient annulable');
    h = await A.post(`/immobilisations/detentions/${dMbu.id}/annuler`, { recuId: h.acteAnnulable.recuId, motif: 'Transfert saisi par erreur' });
    verifier(h.enCours?.salarie.id === s1.id && h.enCours.dateDebut === '2025-03-01' && h.enCours.dateFin === null, 'transfert annulé · la détention de 2025 (exercice clôturé) se rouvre, KABILA détient');
    verifier(h.detentions.find((d) => d.id === dMbu.id)?.annulation?.motif === 'Transfert saisi par erreur', 'la détention annulée reste à l’historique, marquée');
    const sAnn = await A.get('/immobilisations/detentions/suivi?du=2025-01-01&au=2026-12-31');
    verifier(!sAnn.detentions.some((d) => d.id === dMbu.id), 'suivi · la détention annulée en sort');
    r = await A.statut('POST', `/immobilisations/${bien.id}/detentions/transfert`, { salarieId: s2.id, date: '2026-03-01' });
    verifier(r.statut === 201 || r.statut === 200, `l’ordre des dates ne compte plus l’annulée · transfert au 2026-03-01 admis (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
    const ouvertes = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM detentions_biens WHERE "immobilisationId" = $1 AND "dateFin" IS NULL AND "annuleeLe" IS NULL`, bien.id);
    verifier(ouvertes[0].n === 1, 'une seule détention ouverte et vivante');
    // m4 · l'index unique partiel tient en base, même hors du service.
    const unRecu = await prisma.recuDetentionBien.findFirst({ where: { tenantId }, select: { id: true } });
    let indexTient = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO detentions_biens (id, "tenantId", "immobilisationId", "bienDecrit", "salarieId", "dateDebut", "recuDebutId", "createdBy") VALUES (gen_random_uuid()::text, $1, $2, 'x', $3, '2026-06-01', $4, 'rejeu')`,
        tenantId, bien.id, s1.id, unRecu.id,
      );
    } catch (e) { indexTient = /detentions_biens_ouverte_vivante_key|recuDebutId/.test(String(e.message)); }
    verifier(indexTient, 'm4 · une seconde détention ouverte vivante est refusée par la base');

    console.log('Impasse 1 · fiche doublon affectée, annulée, supprimée');
    const doublon = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Ordinateur (doublon)', numeroInventaire: 'INV-0099',
      dateAcquisition: '2025-11-01', dateMiseEnService: '2025-11-01', valeurOrigine: 300000, dureeAmortissementAns: 3,
      amortissementAnterieur: 0, repris: true, exerciceId: e2026.id,
    });
    const aD = await A.post(`/immobilisations/${doublon.id}/detentions/affectation`, { salarieId: s1.id, date: '2026-03-05' });
    r = await A.statut('PATCH', `/immobilisations/${doublon.id}`, { dateAcquisition: '2026-04-01' });
    verifier(r.statut === 400 && /remis à un salarié le 2026-03-05/.test(JSON.stringify(r.corps)), `m1 · acquisition reportée après la remise refusée (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
    r = await A.statut('DELETE', `/immobilisations/${doublon.id}`);
    verifier(r.statut === 400 && /annulez-les d’abord/.test(JSON.stringify(r.corps)), `suppression du doublon détenu refusée avec l'issue (${r.statut})`);
    await A.post(`/immobilisations/detentions/${aD.id}/annuler`, { recuId: aD.recuRemise.id, motif: 'Fiche en double' });
    r = await A.statut('DELETE', `/immobilisations/${doublon.id}`);
    verifier(r.statut === 200, `le doublon dont la détention est annulée se supprime (${r.statut} ${JSON.stringify(r.corps).slice(0, 200)})`);
    const dDet = await prisma.detentionBien.findUnique({ where: { id: aD.id } });
    const rDet = await prisma.recuDetentionBien.findUnique({ where: { id: aD.recuRemise.id } });
    verifier(dDet && dDet.immobilisationId === null && dDet.annuleeLe && /doublon/.test(dDet.bienDecrit), 'la détention annulée reste, détachée, le bien décrit');
    verifier(rDet && rDet.immobilisationId === null && rDet.annuleLe && /doublon/.test(rDet.texte), 'le reçu annulé reste, détaché, son texte garde le bien');
    const suite = await prisma.recuDetentionBien.findMany({ where: { tenantId }, orderBy: { numero: 'asc' }, select: { numero: true } });
    verifier(suite.every((x, i) => x.numero === i + 1), `suite des reçus sans trou (${suite.map((x) => x.numero).join(',')})`);
    console.log('m2 et m3 · détenteur parti, sortie antidatée sous la remise');
    const s4 = await A.post('/personnel/salaries', { nom: 'LUKUSA', prenoms: 'Marie', sexe: 'FEMININ' });
    const c4 = await A.post(`/personnel/salaries/${s4.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01' });
    const tablette = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Tablette', numeroInventaire: 'INV-0101', dateAcquisition: '2025-11-01',
      dateMiseEnService: '2025-11-01', valeurOrigine: 150000, dureeAmortissementAns: 3, amortissementAnterieur: 0, repris: true, exerciceId: e2026.id,
    });
    await A.post(`/immobilisations/${tablette.id}/detentions/affectation`, { salarieId: s4.id, date: '2026-02-01' });
    await A.post(`/personnel/contrats/${c4.id}/fin`, { dateFin: '2026-04-30', motifFin: 'Démission' });
    const camera = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Caméra', numeroInventaire: 'INV-0102', dateAcquisition: '2025-11-01',
      dateMiseEnService: '2025-11-01', valeurOrigine: 250000, dureeAmortissementAns: 3, amortissementAnterieur: 0, repris: true, exerciceId: e2026.id,
    });
    await A.post(`/immobilisations/${camera.id}/detentions/affectation`, { salarieId: s1.id, date: '2026-05-10' });
    await A.post(`/immobilisations/${camera.id}/sortie`, {
      dateSortie: '2026-05-05', type: 'MISE_HORS_SERVICE', exerciceId: e2026.id, journalId: od.id,
      natureSortie: 'MISE_AU_REBUT', referencePieceSortie: 'PV-REBUT-2', datePieceSortie: '2026-05-05',
    });
    const maintA = await A.get(`/immobilisations/maintenance?exerciceId=${e2026.id}`);
    verifier(maintA.detentionsSansContratEnCours === 1 && maintA.detentionsSortiesAvantLaRemise === 1 && !JSON.stringify(maintA).includes('LUKUSA'), `maintenance · m3 un détenteur sans contrat, m2 une sortie avant la remise, sans nom (${maintA.detentionsSansContratEnCours}, ${maintA.detentionsSortiesAvantLaRemise})`);
    const sM = await A.get('/immobilisations/detentions/suivi?du=2026-01-01&au=2026-12-31');
    verifier(sM.detenteursSansContratEnCours === 1 && sM.biensSortisAvantLaRemise === 1 && sM.detentions.some((d) => d.bien.designation === 'Tablette' && d.detenteurSansContratEnCours) && sM.detentions.some((d) => d.bien.designation === 'Caméra' && d.bienSortiAvantLaRemise), 'suivi · les deux cas nommés sur leur ligne et comptés');

    console.log('Impasse 2 · bien transféré dans le groupe, affecté chez le receveur, détention annulée, transfert annulé');
    await prisma.tenant.update({ where: { id: tenantId }, data: { plafondCellules: 3 } });
    const emailCell = `m4-cell-${stamp}@exemple.invalid`;
    const cell = await A.post('/groupe/cellules', { nom: 'Rejeu M4 Établissement', emailAdmin: emailCell });
    const C = new Client();
    await C.post('/auth/login', { email: emailCell, motDePasse: cell.motDePasseTemporaire });
    await C.post('/auth/changer-mot-de-passe', { motDePasseActuel: cell.motDePasseTemporaire, nouveauMotDePasse: MDP });
    await C.post('/auth/login', { email: emailCell, motDePasse: MDP });
    const ctx = await A.get('/immobilisations/transferts-groupe/contexte');
    const dA = ctx.dossiers.find((d) => d.id === tenantId);
    const dC = ctx.dossiers.find((d) => d.id === cell.tenant.id);
    const bienG = await A.post('/immobilisations', {
      compteImmobilisationId: c2441.id, designation: 'Scanner à transférer', numeroInventaire: 'INV-0100',
      dateAcquisition: '2025-10-01', dateMiseEnService: '2025-10-01', valeurOrigine: 600000, dureeAmortissementAns: 3,
      amortissementAnterieur: 50000, repris: true, exerciceId: e2026.id,
    });
    // La famille du compte 2441 naît chez la cellule avec un premier bien
    // (elle suit le compte du bien, `compte-du-bien.ts`).
    const planC = await C.get('/comptes?typeCompte=DETAIL');
    const c2441C = planC.find((c) => c.numero === c2441.numero);
    await C.patch(`/comptes/${c2441C.id}`, { estRetenu: true });
    await C.post('/immobilisations', {
      compteImmobilisationId: c2441C.id, designation: 'Bureau de la cellule', dateAcquisition: '2025-10-01', dateMiseEnService: '2025-10-01',
      valeurOrigine: 200000, dureeAmortissementAns: 4, amortissementAnterieur: 0, repris: true, exerciceId: dC.exercicesOuverts[0].id,
    });
    const liaison = (d) => d.comptesLiaison.find((c) => /^18[4-7]/.test(c.numero)) ?? d.comptesLiaison[0];
    const od2 = (d) => d.journaux.find((j) => j.code === 'OD') ?? d.journaux[0];
    const trG = await A.post('/immobilisations/transferts-groupe', {
      dossierCedantId: tenantId, immobilisationId: bienG.id, dossierReceveurId: cell.tenant.id, date: '2026-06-01',
      referencePiece: 'TR-M4-1', datePiece: '2026-06-01', journalCedantId: od2(dA).id, journalReceveurId: od2(dC).id,
      compteLiaisonCedantId: liaison(dA).id, compteLiaisonReceveurId: liaison(dC).id,
    });
    const entree = await prisma.transfertImmobilisationGroupe.findFirst({ where: { tenantId: cell.tenant.id, sens: 'ENTREE' }, select: { transfertId: true, immobilisationId: true } });
    verifier(!!entree?.immobilisationId, `transfert passé, fiche née chez la cellule (${JSON.stringify(trG).slice(0, 120)})`);
    const sc = await C.post('/personnel/salaries', { nom: 'NGOY', prenoms: 'Paul', sexe: 'MASCULIN' });
    await C.post(`/personnel/salaries/${sc.id}/contrats`, { type: 'DUREE_INDETERMINEE', dateEntreeEnVigueur: '2026-01-01' });
    const aC = await C.post(`/immobilisations/${entree.immobilisationId}/detentions/affectation`, { salarieId: sc.id, date: '2026-06-02' });
    verifier(aC.recuRemise?.numero === 1, `affectation chez la cellule · reçu n° 1 de SA suite (lu ${aC.recuRemise?.numero})`);
    r = await A.statut('POST', `/immobilisations/transferts-groupe/${entree.transfertId}/annulation`, { motif: 'Transfert à défaire' });
    verifier(r.statut === 400 && /remis à un salarié/.test(JSON.stringify(r.corps)) && /volet Détenteur/.test(JSON.stringify(r.corps)), `annulation du transfert refusée tant que la détention vit, issue nommée (${r.statut} ${JSON.stringify(r.corps).slice(0, 240)})`);
    await C.post(`/immobilisations/detentions/${aC.id}/annuler`, { recuId: aC.recuRemise.id, motif: 'Le bien repart au siège' });
    r = await A.statut('POST', `/immobilisations/transferts-groupe/${entree.transfertId}/annulation`, { motif: 'Transfert à défaire' });
    verifier(r.statut === 200 || r.statut === 201, `annulation du transfert admise après l'annulation de la détention (${r.statut} ${JSON.stringify(r.corps).slice(0, 240)})`);
    const dC2 = await prisma.detentionBien.findUnique({ where: { id: aC.id } });
    const rC2 = await prisma.recuDetentionBien.findUnique({ where: { id: aC.recuRemise.id } });
    const ficheC = await prisma.immobilisation.findUnique({ where: { id: entree.immobilisationId } });
    verifier(!ficheC && dC2?.immobilisationId === null && dC2?.annuleeLe && rC2?.immobilisationId === null && rC2?.annuleLe, 'la fiche reçue est retirée · détention et reçu annulés restent chez la cellule, détachés');
    const bienGApres = await prisma.immobilisation.findUnique({ where: { id: bienG.id }, select: { statut: true } });
    verifier(bienGApres.statut === 'EN_SERVICE', 'le siège reprend le bien');
  } finally {
    srv.kill('SIGTERM');
    await prisma.$disconnect();
    if (/Maillon d'audit NON écrit/.test(journal)) { echecs.push('maillon d’audit non écrit au journal du serveur'); }
  }
  console.log(echecs.length ? `\n${echecs.length} ÉCHEC(S)` : '\nTOUT EST VERT');
  process.exit(echecs.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
