import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useExercice } from '../lib/exercice';
import { useGardeFermeture } from '../lib/fenetres';
import { ecouterEchap } from '../lib/echap';
import { montant as fmt } from '../lib/montants';
import { corpsOperation, montantExige, type ChampsOperation, type Mode, type Type } from '../lib/operations-tresorerie-saisie';
import { Aide } from '../components/chrome/Aide';
import { PortailModale } from '../components/PortailModale';

/**
 * FINANCEMENTS ET PLACEMENTS · Traitement > Tiers et trésorerie (ligne
 * sage-l3, fonction 47, décision D16 · chez Sage, F_OPFINANCEMENT et
 * F_OPPLACEMENT). Le crédit de trésorerie entre au 561, le dépôt à terme au
 * 525 ou au 2784 ; la clôture rattache les intérêts à l'exercice (566, 5267,
 * 476, 477), l'ouverture suivante les contre-passe, l'échéance porte les
 * intérêts du décompte de la banque. Règles au serveur (src/modules/
 * tresorerie/), l'écran ne les refait pas · il propose, le serveur juge, et
 * les montants proposés sont ceux que le serveur sert.
 */

type Statut = 'EN_COURS' | 'ECHUE' | 'ANNULEE';
type Nature = 'MISE_EN_PLACE' | 'REGULARISATION' | 'CONTRE_PASSATION' | 'ECHEANCE';
const LIBELLES_STATUT: Record<Statut, string> = { EN_COURS: 'En cours', ECHUE: 'Échue', ANNULEE: 'Annulée' };

interface CompteServi {
  id: string;
  numero: string;
  intitule: string;
}
interface JournalServi {
  id: string;
  code: string;
  intitule: string;
  type: string;
  estActif: boolean;
}
interface Piece {
  id: string;
  numeroPiece: number | null;
  statut: string;
}
interface Acte {
  id: string;
  nature: Nature;
  libelle: string;
  date: string;
  montantInterets: number;
  interetsProposes: number | null;
  annuleLe: string | null;
  motifAnnulation: string | null;
  ecriture: Piece | null;
  ecritureNegatif: Piece | null;
}
interface Operation {
  id: string;
  type: Type;
  libelleType: string;
  reference: string;
  statut: Statut;
  comptePrincipal: CompteServi;
  dateMiseEnPlace: string;
  dateEcheance: string;
  montant: number;
  tauxApplique: number;
  baseCalcul: number;
  modeInterets: Mode;
  interetsProposes: number;
  avertissement: string | null;
  regularisationProposee: { date: string; montant: number; compte: string } | null;
  contrePassationProposee: { regularisationId: string; date: string; montant: number } | null;
  actes: Acte[];
}
interface Liste {
  exercice: { id: string; dateDebut: string; dateFin: string; statut: string };
  operations: Operation[];
  total: number;
  tronque: boolean;
}
interface ComptesDuRole {
  racines: string[];
  comptes: Array<CompteServi & { estRetenu: boolean }>;
  total: number;
  tronque: boolean;
}
interface TauxServi {
  id: string;
  code: string;
  intitule: string;
}
interface ReponseAnnulation {
  statut: Statut;
  traitement: 'SUPPRIMEE' | 'INSCRITE_EN_NEGATIF' | 'SANS_PIECE';
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const messageDuRefus = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.status < 500 ? err.message : `${defaut} · réponse perdue, le geste a pu passer. Relisez la liste avant de le refaire.`;
const piece = (p: Piece | null) => (p ? `n° ${p.numeroPiece ?? '·'}${p.statut === 'BROUILLARD' ? ' (brouillard)' : ''}` : '·');
const ROLES = ['PRINCIPAL', 'INTERETS', 'COURUS', 'FRAIS'] as const;
type Role = (typeof ROLES)[number];
const LIBELLES_ROLE: Record<Type, Record<Role, string>> = {
  FINANCEMENT: { PRINCIPAL: 'Compte du crédit', INTERETS: 'Compte des intérêts', COURUS: 'Intérêts courus', FRAIS: 'Compte des frais' },
  PLACEMENT: { PRINCIPAL: 'Compte du dépôt', INTERETS: 'Compte des intérêts', COURUS: 'Intérêts courus à recevoir', FRAIS: 'Compte des frais' },
};

export function FinancementsPlacementsPage() {
  const { peutEcrire, peutValider } = useAuth();
  const { exerciceCourant } = useExercice();
  const exerciceId = exerciceCourant?.id ?? null;
  const exerciceClos = exerciceCourant?.statut === 'CLOTURE';
  const [liste, setListe] = useState<Liste | null>(null);
  const [journaux, setJournaux] = useState<JournalServi[] | null>(null);
  const [taux, setTaux] = useState<TauxServi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const bandeauErreur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erreur) bandeauErreur.current?.focus({ preventScroll: false });
  }, [erreur]);

  const exerciceAffiche = useRef(exerciceId);
  exerciceAffiche.current = exerciceId;
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    const garde = () => n === jeton.current && exerciceId === exerciceAffiche.current;
    try {
      const [j, t] = await Promise.all([api.get<JournalServi[]>('/journaux'), api.get<{ taux: TauxServi[] }>('/taux-reference')]);
      if (!garde()) return;
      setJournaux(j);
      setTaux(t.taux);
      if (exerciceId) {
        const l = await api.get<Liste>(`/operations-tresorerie?exerciceId=${exerciceId}`);
        if (!garde()) return;
        setListe(l);
      }
      setErreur(null);
    } catch (err) {
      if (garde()) setErreur(err instanceof ApiError ? err.message : 'Opérations illisibles');
    }
  }, [exerciceId]);
  useEffect(() => {
    setListe(null);
    setInfo(null);
    setErreur(null);
    void charger();
  }, [charger]);

  const fait = async (message: string) => {
    setInfo(message);
    setErreur(null);
    await charger();
  };
  const refus = useCallback(
    (err: unknown, defaut: string) => {
      setErreur(messageDuRefus(err, defaut));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) void charger();
    },
    [charger],
  );
  const [garde, setGarde] = useState<string | null>(null);
  useGardeFermeture(garde);
  const journauxOd = useMemo(() => (journaux ?? []).filter((j) => j.type === 'GENERAL' && j.estActif), [journaux]);
  const banques = useMemo(() => (journaux ?? []).filter((j) => j.type === 'TRESORERIE' && j.estActif), [journaux]);

  const [regul, setRegul] = useState<Operation | null>(null);
  const [echeance, setEcheance] = useState<Operation | null>(null);
  const [aAnnuler, setAAnnuler] = useState<{ op: Operation; acte: Acte } | null>(null);
  const [detail, setDetail] = useState<Operation | null>(null);
  const [envoiContre, setEnvoiContre] = useState<string | null>(null);
  const contrePasser = async (op: Operation) => {
    if (!op.contrePassationProposee || envoiContre) return;
    setEnvoiContre(op.id);
    try {
      await api.post(`/operations-tresorerie/${op.id}/contre-passer`, { regularisationId: op.contrePassationProposee.regularisationId });
      await fait(`${op.libelleType} ${op.reference} · régularisation contre-passée au ${date(op.contrePassationProposee.date)}.`);
    } catch (err) {
      refus(err, 'Contre-passation impossible');
    } finally {
      setEnvoiContre(null);
    }
  };
  const dernierActe = (o: Operation) => [...o.actes].reverse().find((a) => !a.annuleLe) ?? null;

  return (
    <div className="p-3 space-y-3 text-[11.5px] avec-edition">
      {erreur && (
        <div ref={bandeauErreur} tabIndex={-1} role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
          {erreur}
        </div>
      )}
      <div role="status" aria-live="polite">
        {info && <div className="text-ok bg-ok-soft border border-ok/30 px-3 py-2">{info}</div>}
      </div>
      <div className="flex items-center justify-end">
        <Aide
          titre="Financements et placements"
          texte="Le crédit de trésorerie (deux ans au plus) entre au 561 par la banque, ses intérêts au 6745, ses frais au 631. Le dépôt à terme entre au 525, ou au 2784 s'il ne se débloque pas avant plus d'un an, ses intérêts au 771 ou au 774. Le taux est fixe, ou un taux de référence plus une marge, figé au cours en vigueur à la mise en place. À la clôture, une opération à cheval porte la part courue de ses intérêts post-comptés (566, 5267) ou la part non courue de ses intérêts précomptés (476, 477), proposée au prorata des jours et déclarée ; l'ouverture suivante la contre-passe, et l'échéance n'est admise qu'ensuite. Les intérêts de l'échéance sont ceux du décompte de la banque · la proposition n'est qu'une aide. Chaque acte s'annule à rebours, avec son motif · au brouillard la pièce est retirée, validée elle est inscrite en négatif."
          source="AUDCIF Titre VII et SYCEBNL Partie 2 ch. 3, comptes 47, 52, 56, 63, 67 et 77 ; postulat de spécialisation des exercices ; AUDCIF art. 17, 3° et art. 20, al. 2"
        />
      </div>
      {!exerciceId && <div className="text-text-dim">Aucun exercice · ouvrez-en un dans Exercices.</div>}
      {peutEcrire && exerciceId && !exerciceClos && (
        <FormMiseEnPlace banques={banques} journauxOd={journauxOd} taux={taux} journauxLus={journaux !== null} onFait={fait} onRefus={refus} onGarde={setGarde} />
      )}
      {liste === null && exerciceId && !erreur && <div className="text-text-dim">Lecture des opérations…</div>}
      {liste && (
        <section aria-labelledby="titre-operations" className="space-y-1">
          <h2 id="titre-operations" className="font-semibold">
            Opérations de l'exercice
          </h2>
          {liste.operations.length === 0 ? (
            <div className="text-text-dim">Aucune opération en cours ni passée dans cet exercice.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th scope="col" className="text-left px-2 py-1">Opération</th>
                    <th scope="col" className="text-left px-2 py-1">Compte</th>
                    <th scope="col" className="text-left px-2 py-1">Mise en place</th>
                    <th scope="col" className="text-left px-2 py-1">Échéance</th>
                    <th scope="col" className="text-right px-2 py-1">Montant</th>
                    <th scope="col" className="text-right px-2 py-1">Taux</th>
                    <th scope="col" className="text-left px-2 py-1">État</th>
                    <th scope="col" className="text-left px-2 py-1">À faire dans l'exercice</th>
                    <th scope="col" className="text-left px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.operations.map((o) => {
                    const dernier = dernierActe(o);
                    return (
                      <tr key={o.id} className="border-t border-border align-top">
                        <th scope="row" className="text-left font-normal px-2 py-1">
                          {o.libelleType} {o.reference}
                          {o.avertissement && <div className="text-warn">{o.avertissement}</div>}
                        </th>
                        <td className="px-2 py-1">{o.comptePrincipal.numero}</td>
                        <td className="px-2 py-1">{date(o.dateMiseEnPlace)}</td>
                        <td className="px-2 py-1">{date(o.dateEcheance)}</td>
                        <td className="px-2 py-1 text-right">{fmt(o.montant)}</td>
                        <td className="px-2 py-1 text-right">{o.tauxApplique.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} %</td>
                        <td className="px-2 py-1">{LIBELLES_STATUT[o.statut]}</td>
                        <td className="px-2 py-1">
                          {o.contrePassationProposee && <div>Contre-passer la régularisation · {fmt(o.contrePassationProposee.montant)} au {date(o.contrePassationProposee.date)}</div>}
                          {o.regularisationProposee && (
                            <div>
                              Régulariser à la clôture · {fmt(o.regularisationProposee.montant)} proposés au {o.regularisationProposee.compte}
                            </div>
                          )}
                          {!o.contrePassationProposee && !o.regularisationProposee && <span className="text-text-dim">·</span>}
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => setDetail(o)} className="px-2 py-[1px] border border-border">
                              Actes
                            </button>
                            {peutEcrire && !exerciceClos && o.statut === 'EN_COURS' && o.contrePassationProposee && (
                              <button type="button" disabled={envoiContre !== null} onClick={() => void contrePasser(o)} className="px-2 py-[1px] border border-border disabled:opacity-40">
                                {envoiContre === o.id ? '…' : 'Contre-passer'}
                              </button>
                            )}
                            {peutEcrire && !exerciceClos && o.statut === 'EN_COURS' && o.regularisationProposee && (
                              <button type="button" onClick={() => setRegul(o)} className="px-2 py-[1px] border border-border">
                                Régulariser
                              </button>
                            )}
                            {peutEcrire && o.statut === 'EN_COURS' && (
                              <button type="button" onClick={() => setEcheance(o)} className="px-2 py-[1px] border border-border">
                                Échéance
                              </button>
                            )}
                            {peutValider && dernier && o.statut !== 'ANNULEE' && (
                              <button type="button" onClick={() => setAAnnuler({ op: o, acte: dernier })} className="px-2 py-[1px] border border-border text-danger">
                                Annuler « {dernier.libelle} »
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {liste.tronque && <div className="text-text-dim">{liste.operations.length} opérations montrées sur {liste.total}.</div>}
        </section>
      )}
      {regul && liste && (
        <ModaleMontant
          titre={`Régulariser · ${regul.libelleType} ${regul.reference}`}
          resume={`Intérêts ${regul.modeInterets === 'POST_COMPTES' ? 'courus' : "constatés d'avance"} au ${date(liste.exercice.dateFin)}, au ${regul.regularisationProposee?.compte ?? '·'} · proposés au prorata des jours.`}
          libelle="Montant rattaché à l'exercice"
          initial={regul.regularisationProposee ? String(regul.regularisationProposee.montant).replace('.', ',') : ''}
          action="Régulariser"
          onFermer={() => setRegul(null)}
          envoyer={(montantLu) => api.post(`/operations-tresorerie/${regul.id}/regulariser`, { exerciceId: liste.exercice.id, montant: montantLu })}
          onFait={async () => {
            const o = regul;
            setRegul(null);
            await fait(`${o.libelleType} ${o.reference} · régularisée à la clôture du ${date(liste.exercice.dateFin)}.`);
          }}
          onRelire={refus}
        />
      )}
      {echeance && <ModaleEcheance op={echeance} onFermer={() => setEcheance(null)} onFait={async (m) => { setEcheance(null); await fait(m); }} onRelire={refus} />}
      {aAnnuler && (
        <ModaleMotif
          titre={`Annuler · ${aAnnuler.acte.libelle}`}
          resume={`${aAnnuler.op.libelleType} ${aAnnuler.op.reference} · ${aAnnuler.acte.libelle} du ${date(aAnnuler.acte.date)}, pièce ${piece(aAnnuler.acte.ecriture)}.`}
          chemin={`/operations-tresorerie/${aAnnuler.op.id}/actes/${aAnnuler.acte.id}/annuler`}
          onFermer={() => setAAnnuler(null)}
          onRelire={refus}
          onFait={async (r) => {
            const a = aAnnuler;
            setAAnnuler(null);
            await fait(
              `${a.acte.libelle} de ${a.op.reference} annulée · ${r.traitement === 'INSCRITE_EN_NEGATIF' ? 'pièce inscrite en négatif' : r.traitement === 'SUPPRIMEE' ? 'pièce du brouillard retirée' : 'aucune pièce'} · l'opération est « ${LIBELLES_STATUT[r.statut]} ».`,
            );
          }}
        />
      )}
      {detail && <ModaleActes op={detail} onFermer={() => setDetail(null)} />}
    </div>
  );
}

// ----- Mise en place ------------------------------------------------------------

const VIDE: ChampsOperation = {
  type: 'FINANCEMENT',
  modeInterets: 'POST_COMPTES',
  reference: '',
  journalBanqueId: '',
  journalOdId: '',
  comptePrincipalId: '',
  compteInteretsId: '',
  compteCourusId: '',
  compteFraisId: '',
  taux: '',
  tauxFixe: '',
  marge: '',
  baseCalcul: '360',
  montant: '',
  frais: '',
  interetsPrecomptes: '',
  deblocableAToutMoment: '',
  dateMiseEnPlace: '',
  dateEcheance: '',
  referenceConvention: '',
  dateConvention: '',
};

function FormMiseEnPlace(p: {
  banques: JournalServi[];
  journauxOd: JournalServi[];
  taux: TauxServi[] | null;
  journauxLus: boolean;
  onFait: (m: string) => Promise<void>;
  onRefus: (e: unknown, d: string) => void;
  onGarde: (motif: string | null) => void;
}) {
  const [c, setC] = useState<ChampsOperation>(VIDE);
  const [comptes, setComptes] = useState<Partial<Record<Role, ComptesDuRole>>>({});
  const [erreurComptes, setErreurComptes] = useState<string | null>(null);
  const [refusLocal, setRefusLocal] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const envoiRef = useRef(false);
  const maj = (champ: keyof ChampsOperation, v: string) => setC((x) => ({ ...x, [champ]: v }));

  // Les comptes de chaque rôle, sous les racines que le serveur prescrit pour ce type · un choix unique se présélectionne.
  useEffect(() => {
    let vivant = true;
    setComptes({});
    setErreurComptes(null);
    setC((x) => ({ ...x, comptePrincipalId: '', compteInteretsId: '', compteCourusId: '', compteFraisId: '' }));
    Promise.all(ROLES.map((r) => api.get<ComptesDuRole>(`/operations-tresorerie/comptes?type=${c.type}&role=${r}`)))
      .then((lus) => {
        if (!vivant) return;
        const parRole = Object.fromEntries(ROLES.map((r, i) => [r, lus[i]])) as Record<Role, ComptesDuRole>;
        setComptes(parRole);
        const champ: Record<Role, keyof ChampsOperation> = { PRINCIPAL: 'comptePrincipalId', INTERETS: 'compteInteretsId', COURUS: 'compteCourusId', FRAIS: 'compteFraisId' };
        setC((x) => {
          const y = { ...x };
          for (const r of ROLES) if (parRole[r].comptes.length === 1) (y[champ[r]] as string) = parRole[r].comptes[0].id;
          return y;
        });
      })
      .catch((e) => vivant && setErreurComptes(e instanceof ApiError ? e.message : 'Comptes illisibles · rechargez la fenêtre.'));
    return () => {
      vivant = false;
    };
  }, [c.type]);
  useEffect(() => {
    if (!c.journalBanqueId && p.banques.length === 1) maj('journalBanqueId', p.banques[0].id);
    if (!c.journalOdId && p.journauxOd.length === 1) maj('journalOdId', p.journauxOd[0].id);
  }, [p.banques, p.journauxOd, c.journalBanqueId, c.journalOdId]);

  const entame = !!(c.reference || c.montant || c.referenceConvention);
  const motifGarde = envoi ? "La mise en place est en cours d'envoi · fermer maintenant laisserait son issue inconnue." : entame ? "Une opération est en cours de saisie et n'est pas mise en place." : null;
  const { onGarde } = p;
  useEffect(() => {
    onGarde(motifGarde);
    return () => onGarde(null);
  }, [motifGarde, onGarde]);

  const manque = (): string | null => {
    if (!c.journalBanqueId) return 'Choisissez le journal de banque.';
    if (!c.journalOdId) return "Choisissez le journal d'opérations diverses de la régularisation.";
    if (!c.comptePrincipalId) return `Choisissez le ${LIBELLES_ROLE[c.type].PRINCIPAL.toLowerCase()}.`;
    if (!c.compteInteretsId) return 'Choisissez le compte des intérêts.';
    if (c.modeInterets === 'POST_COMPTES' && !c.compteCourusId) return 'Choisissez le compte des intérêts courus.';
    if (!c.reference.trim()) return "La référence de l'opération est exigée.";
    if (!c.dateMiseEnPlace || !c.dateEcheance) return 'Les dates de mise en place et d’échéance sont exigées.';
    if (!c.referenceConvention.trim() || !c.dateConvention) return 'La convention (référence et date) est exigée.';
    if (c.type === 'PLACEMENT' && !c.deblocableAToutMoment) return 'Dites si le dépôt se débloque à tout moment.';
    return null;
  };
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoiRef.current || manque()) return;
    const r = corpsOperation(c);
    if ('refus' in r) {
      setRefusLocal(r.refus);
      return;
    }
    setRefusLocal(null);
    envoiRef.current = true;
    setEnvoi(true);
    try {
      const op = await api.post<Operation>('/operations-tresorerie', r.corps);
      setC({ ...VIDE, type: c.type, journalBanqueId: c.journalBanqueId, journalOdId: c.journalOdId });
      await p.onFait(`${op.libelleType} ${op.reference} mis en place au ${op.comptePrincipal.numero}, taux appliqué ${op.tauxApplique.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} %.`);
    } catch (err) {
      p.onRefus(err, 'Mise en place impossible');
    } finally {
      envoiRef.current = false;
      setEnvoi(false);
    }
  };
  const champ = 'border border-border px-2 py-[2px]';
  const selecteur = (role: Role, cle: keyof ChampsOperation, facultatif = false) => {
    const lus = comptes[role];
    return (
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">
          {LIBELLES_ROLE[c.type][role]}
          {lus ? ` (${lus.racines.join(' ou ')})` : ''}
        </span>
        <select value={c[cle] as string} onChange={(e) => maj(cle, e.target.value)} className={champ}>
          <option value="">{erreurComptes ? erreurComptes : !lus ? '…' : lus.comptes.length === 0 ? `Aucun compte sous le ${lus.racines.join(' ou ')} · ouvrez-le dans Plan comptable` : facultatif ? 'Aucun' : '·'}</option>
          {(lus?.comptes ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.numero} · {x.intitule}
            </option>
          ))}
        </select>
        {lus?.tronque && <span className="text-text-dim">{lus.comptes.length} comptes montrés sur {lus.total}.</span>}
      </label>
    );
  };
  const raison = manque();
  return (
    <form onSubmit={envoyer} noValidate className="border border-border bg-surface p-3 space-y-2" aria-labelledby="titre-mise-en-place">
      <div id="titre-mise-en-place" className="font-semibold">
        Mettre en place une opération
      </div>
      {p.journauxLus && p.banques.length === 0 && <div className="text-text-dim">Aucun journal de banque actif · créez-en un dans Structure › Codes journaux.</div>}
      {refusLocal && (
        <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
          {refusLocal}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Nature</span>
          <select value={c.type} onChange={(e) => maj('type', e.target.value)} className={champ}>
            <option value="FINANCEMENT">Crédit de trésorerie</option>
            <option value="PLACEMENT">Dépôt à terme</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Intérêts</span>
          <select value={c.modeInterets} onChange={(e) => maj('modeInterets', e.target.value)} className={champ}>
            <option value="POST_COMPTES">Payés à l'échéance</option>
            <option value="PRECOMPTES">Payés à la mise en place</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Référence</span>
          <input value={c.reference} maxLength={60} onChange={(e) => maj('reference', e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Montant</span>
          <input inputMode="decimal" value={c.montant} onChange={(e) => maj('montant', e.target.value)} className={`${champ} text-right`} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Journal de banque</span>
          <select value={c.journalBanqueId} onChange={(e) => maj('journalBanqueId', e.target.value)} className={champ}>
            <option value="">·</option>
            {p.banques.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} · {j.intitule}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Journal de la régularisation</span>
          <select value={c.journalOdId} onChange={(e) => maj('journalOdId', e.target.value)} className={champ}>
            <option value="">·</option>
            {p.journauxOd.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} · {j.intitule}
              </option>
            ))}
          </select>
        </label>
        {selecteur('PRINCIPAL', 'comptePrincipalId')}
        {selecteur('INTERETS', 'compteInteretsId')}
        {c.modeInterets === 'POST_COMPTES' && selecteur('COURUS', 'compteCourusId')}
        {selecteur('FRAIS', 'compteFraisId', true)}
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Taux</span>
          <select value={c.taux} onChange={(e) => maj('taux', e.target.value)} className={champ}>
            <option value="">{p.taux === null ? '…' : '·'}</option>
            <option value="FIXE">Taux fixe</option>
            {(p.taux ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} · {t.intitule}
              </option>
            ))}
          </select>
        </label>
        {c.taux === 'FIXE' ? (
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Taux annuel (%)</span>
            <input inputMode="decimal" value={c.tauxFixe} onChange={(e) => maj('tauxFixe', e.target.value)} className={`${champ} text-right`} />
          </label>
        ) : c.taux ? (
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Marge (points)</span>
            <input inputMode="decimal" value={c.marge} onChange={(e) => maj('marge', e.target.value)} className={`${champ} text-right`} />
          </label>
        ) : null}
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Base de calcul</span>
          <select value={c.baseCalcul} onChange={(e) => maj('baseCalcul', e.target.value)} className={champ}>
            <option value="360">360 jours</option>
            <option value="365">365 jours</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Frais</span>
          <input inputMode="decimal" value={c.frais} onChange={(e) => maj('frais', e.target.value)} className={`${champ} text-right`} />
        </label>
        {c.modeInterets === 'PRECOMPTES' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Intérêts précomptés (décompte)</span>
            <input inputMode="decimal" value={c.interetsPrecomptes} onChange={(e) => maj('interetsPrecomptes', e.target.value)} className={`${champ} text-right`} />
          </label>
        )}
        {c.type === 'PLACEMENT' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Déblocable à tout moment</span>
            <select value={c.deblocableAToutMoment} onChange={(e) => maj('deblocableAToutMoment', e.target.value)} className={champ}>
              <option value="">·</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </label>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Mise en place</span>
          <input type="date" value={c.dateMiseEnPlace} onChange={(e) => maj('dateMiseEnPlace', e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Échéance</span>
          <input type="date" value={c.dateEcheance} onChange={(e) => maj('dateEcheance', e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Convention</span>
          <input value={c.referenceConvention} maxLength={100} onChange={(e) => maj('referenceConvention', e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Date de la convention</span>
          <input type="date" value={c.dateConvention} onChange={(e) => maj('dateConvention', e.target.value)} className={champ} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={envoi || raison !== null} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
          {envoi ? '…' : 'Mettre en place'}
        </button>
        {raison && <span className="text-text-dim">{raison}</span>}
      </div>
    </form>
  );
}

// ----- Modales ----------------------------------------------------------------------

function useFermetureParEchap(onFermer: () => void, envoi: boolean) {
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;
  const envoiRef = useRef(envoi);
  envoiRef.current = envoi;
  useEffect(
    () =>
      ecouterEchap(() => {
        if (!envoiRef.current) fermerRef.current();
        return true;
      }),
    [],
  );
}

function Cadre(p: { id: string; titre: string; onFermer: () => void; envoi: boolean; onSubmit?: (e: FormEvent) => void; enfants: React.ReactNode; pied: React.ReactNode; focus?: React.RefObject<HTMLDivElement> }) {
  const Conteneur = p.onSubmit ? 'form' : 'div';
  return (
    <PortailModale>
      <div className="anim-voile ecran-seul fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
        <Conteneur
          ref={p.focus as React.RefObject<HTMLDivElement & HTMLFormElement> | undefined}
          tabIndex={p.focus ? -1 : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={p.id}
          onSubmit={p.onSubmit}
          className="anim-modale w-full max-w-[560px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto text-[11.5px]"
        >
          <div className="h-[32px] flex items-center px-2.5 border-b border-border">
            <span id={p.id}>{p.titre}</span>
          </div>
          <div className="p-3 space-y-2">{p.enfants}</div>
          <div className="flex justify-end gap-2 px-3 pb-3">
            <button type="button" onClick={p.onFermer} disabled={p.envoi} className="px-3 py-1 border border-border">
              Fermer
            </button>
            {p.pied}
          </div>
        </Conteneur>
      </div>
    </PortailModale>
  );
}

function ModaleMontant(p: {
  titre: string;
  resume: string;
  libelle: string;
  initial: string;
  action: string;
  onFermer: () => void;
  envoyer: (montant: number) => Promise<unknown>;
  onFait: () => Promise<void>;
  onRelire: (err: unknown, defaut: string) => void;
}) {
  const [texte, setTexte] = useState(p.initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const lu = montantExige(texte, 'Le montant');
    if ('refus' in lu) {
      setErreur(lu.refus);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await p.envoyer(lu.corps);
      await p.onFait();
    } catch (err) {
      setErreur(messageDuRefus(err, `${p.action} impossible`));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, `${p.action} impossible`);
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-modale-montant-tresorerie"
      titre={p.titre}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={valider}
      enfants={
        <>
          <div>{p.resume}</div>
          {erreur && <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">{p.libelle}</span>
            <input ref={champ} inputMode="decimal" value={texte} onChange={(e) => setTexte(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
          </label>
        </>
      }
      pied={
        <button type="submit" disabled={envoi} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
          {envoi ? '…' : p.action}
        </button>
      }
    />
  );
}

function ModaleEcheance(p: { op: Operation; onFermer: () => void; onFait: (m: string) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
  const [jour, setJour] = useState(p.op.dateEcheance.slice(0, 10));
  const [interets, setInterets] = useState(p.op.modeInterets === 'POST_COMPTES' ? String(p.op.interetsProposes).replace('.', ',') : '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const post = p.op.modeInterets === 'POST_COMPTES';
  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    let montantInterets: number | undefined;
    if (post) {
      const lu = montantExige(interets, 'Le montant des intérêts');
      if ('refus' in lu) {
        setErreur(lu.refus);
        return;
      }
      montantInterets = lu.corps;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await api.post(`/operations-tresorerie/${p.op.id}/echeance`, { date: jour, ...(post ? { interets: montantInterets } : {}) });
      await p.onFait(`${p.op.libelleType} ${p.op.reference} · échéance du ${date(jour)} passée.`);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Échéance impossible'));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, 'Échéance impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-modale-echeance-tresorerie"
      titre={`Échéance · ${p.op.libelleType} ${p.op.reference}`}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={valider}
      enfants={
        <>
          <div>
            {fmt(p.op.montant)} {p.op.type === 'FINANCEMENT' ? 'remboursés à la banque' : 'rendus par la banque'}
            {post ? ` · intérêts proposés ${fmt(p.op.interetsProposes)} sur la durée entière, à corriger selon le décompte.` : ' · intérêts passés à la mise en place.'}
          </div>
          {erreur && <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Date</span>
            <input ref={champ} type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
          {post && (
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Intérêts du décompte de la banque</span>
              <input inputMode="decimal" value={interets} onChange={(e) => setInterets(e.target.value)} className="border border-border px-2 py-[2px] text-right" />
            </label>
          )}
        </>
      }
      pied={
        <button type="submit" disabled={envoi || !jour} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
          {envoi ? '…' : "Passer l'échéance"}
        </button>
      }
    />
  );
}

function ModaleMotif(p: { titre: string; resume: string; chemin: string; onFermer: () => void; onFait: (r: ReponseAnnulation) => Promise<void>; onRelire: (err: unknown, defaut: string) => void }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus({ preventScroll: true }), []);
  useFermetureParEchap(p.onFermer, envoi);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi || motif.trim().length < 3) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<ReponseAnnulation>(p.chemin, { motif: motif.trim() });
      await p.onFait(r);
    } catch (err) {
      setErreur(messageDuRefus(err, 'Annulation impossible'));
      if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) {
        p.onRelire(err, 'Annulation impossible');
        p.onFermer();
      }
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre
      id="titre-modale-motif-tresorerie"
      titre={p.titre}
      onFermer={p.onFermer}
      envoi={envoi}
      onSubmit={envoyer}
      enfants={
        <>
          <div>{p.resume}</div>
          {erreur && <div role="alert" className="text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">{erreur}</div>}
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Motif</span>
            <input ref={champ} required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
        </>
      }
      pied={
        <button type="submit" disabled={envoi || motif.trim().length < 3} className="bg-danger text-white font-semibold px-3 py-1 disabled:opacity-40">
          {envoi ? '…' : 'Annuler l’acte'}
        </button>
      }
    />
  );
}

function ModaleActes(p: { op: Operation; onFermer: () => void }) {
  useFermetureParEchap(p.onFermer, false);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => boite.current?.focus({ preventScroll: true }), []);
  return (
    <Cadre
      id="titre-actes-tresorerie"
      titre={`Actes · ${p.op.libelleType} ${p.op.reference}`}
      onFermer={p.onFermer}
      envoi={false}
      focus={boite}
      enfants={
        <table className="w-full">
          <thead>
            <tr>
              <th scope="col" className="text-left px-2 py-1">Acte</th>
              <th scope="col" className="text-left px-2 py-1">Date</th>
              <th scope="col" className="text-right px-2 py-1">Intérêts</th>
              <th scope="col" className="text-left px-2 py-1">Pièce</th>
              <th scope="col" className="text-left px-2 py-1">Annulation</th>
            </tr>
          </thead>
          <tbody>
            {p.op.actes.map((a) => (
              <tr key={a.id} className={`border-t border-border ${a.annuleLe ? 'text-text-dim' : ''}`}>
                <td className="px-2 py-1">{a.libelle}</td>
                <td className="px-2 py-1">{date(a.date)}</td>
                <td className="px-2 py-1 text-right">
                  {fmt(a.montantInterets)}
                  {a.interetsProposes !== null && a.interetsProposes !== a.montantInterets ? ` (proposés ${fmt(a.interetsProposes)})` : ''}
                </td>
                <td className="px-2 py-1">{a.ecriture ? piece(a.ecriture) : 'sans pièce'}</td>
                <td className="px-2 py-1">{a.annuleLe ? `annulé le ${date(a.annuleLe)}${a.ecritureNegatif ? ` · négatif ${piece(a.ecritureNegatif)}` : ''}${a.motifAnnulation ? ` · ${a.motifAnnulation}` : ''}` : '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      pied={null}
    />
  );
}
