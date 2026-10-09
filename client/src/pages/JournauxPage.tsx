import { FormEvent, useEffect, useId, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import type { Compte, Journal, NumerotationPiece, TypeJournal } from '../lib/types';
import { BoutonImprimer, EnteteImpression } from '../components/chrome/EnteteImpression';
import { EditionStructure } from '../components/EditionStructure';
import { motifAucunCompteRetenu, RETENUS } from '../lib/comptes-proposes';
import { usePreselectionUnique } from '../lib/preselection-unique';
import {
  LIBELLE_NUMEROTATION,
  LIBELLE_TYPE_JOURNAL as LIBELLE_TYPE,
  editionJournaux,
  perimetreEdition,
} from '../lib/editions-structures';
import { PortailModale } from '../components/PortailModale';
import {
  corpsCompteDuJournal,
  type CompteDuJournalPropose,
  type CompteDuPlan,
  type ModeCompteJournal,
} from '../lib/compte-propre-journal';

/**
 * CODES JOURNAUX · la fenêtre Structure → Codes journaux de Sage 100 i7 :
 * liste dense (code · intitulé · type · numérotation · compte de trésorerie
 * · état), création en boîte de dialogue. Le type d'un journal est figé
 * après création (règle Sage) ; un journal de trésorerie exige son compte
 * de trésorerie rattaché · c'est lui qui porte la contrepartie automatique.
 */

export function JournauxPage() {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<Journal[] | null>(null);
  // Liste de choix (comptes retenus ou utilisés) · null tant qu'elle n'est pas lue.
  const [comptesTresorerie, setComptesTresorerie] = useState<Compte[] | null>(null);
  const [erreurComptes, setErreurComptes] = useState<string | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [nouveauOuvert, setNouveauOuvert] = useState(false);

  // Codes journaux · seule la création est offerte ici. Un code journal ne se
  // « consulte » pas séparément : sa fiche EST la ligne de la liste.

  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [type, setType] = useState<TypeJournal>('GENERAL');
  const [compteTresorerieId, setCompteTresorerieId] = useState('');
  // LE COMPTE PROPRE DU JOURNAL (décision de Manasse du 2026-10-09) · ouvert
  // à sa création sous un compte du plan de la classe 5, à défaut ; un compte
  // existant reste un choix.
  const [modeCompte, setModeCompte] = useState<ModeCompteJournal>('OUVRIR');
  const [comptesDuPlan, setComptesDuPlan] = useState<CompteDuPlan[] | null>(null);
  const [erreurComptesDuPlan, setErreurComptesDuPlan] = useState<string | null>(null);
  const [sousId, setSousId] = useState('');
  const [numeroCompte, setNumeroCompte] = useState('');
  // La proposition est rattachée au compte du plan qui l'a demandée · une
  // réponse arrivée après un autre choix ne s'affiche pas.
  const [lectureNumero, setLectureNumero] = useState<{
    sousId: string;
    propose: CompteDuJournalPropose | null;
    erreur: string | null;
  } | null>(null);
  // Relancer la lecture de la proposition après un échec · sans quoi seul un
  // aller-retour sur un autre compte du plan la redemandait.
  const [relire, setRelire] = useState(0);
  const idNumero = useId();
  const idSous = useId();
  const idMessageNumero = useId();
  const idCompteExistant = useId();
  const idModeCompte = useId();
  // Continue par journal à défaut, comme au serveur (audit final F59) · en
  // manuelle aucune pièce ne reçoit de numéro, la saisie n'en portant aucun.
  const [numerotation, setNumerotation] = useState<NumerotationPiece>('CONTINUE_JOURNAL');
  const [erreurForm, setErreurForm] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      setListe(await api.get<Journal[]>('/journaux'));
      setErreurChargement(null);
    } catch (err) {
      setErreurChargement(err instanceof ApiError ? err.message : 'Impossible de charger les journaux');
    }
  };

  useEffect(() => {
    if (!estAdmin) return;
    charger();
    // Liste de choix · comptes retenus ou utilisés (`lib/comptes-proposes.ts`) ;
    // un échec de lecture se dit au lieu d'une liste vide muette.
    api.get<Compte[]>(`/comptes?classe=CLASSE_5&actifsSeuls=true&typeCompte=DETAIL&${RETENUS}`).then(
      (c) => {
        setComptesTresorerie(c);
        setErreurComptes(null);
      },
      (err) => setErreurComptes(err instanceof ApiError ? err.message : 'serveur injoignable'),
    );
    // Les comptes du plan sous lesquels ouvrir · lus par leur numéro, jamais
    // par la règle des comptes retenus (comptes/listes-de-comptes.ts).
    api.get<CompteDuPlan[]>('/journaux/comptes-du-plan').then(
      (c) => {
        setComptesDuPlan(c);
        setErreurComptesDuPlan(null);
      },
      (err) => setErreurComptesDuPlan(err instanceof ApiError ? err.message : 'serveur injoignable'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAdmin]);
  // Un seul compte de trésorerie proposé se présélectionne (§ 9 ter).
  usePreselectionUnique(comptesTresorerie, compteTresorerieId, setCompteTresorerieId);
  usePreselectionUnique(comptesDuPlan, sousId, setSousId);

  // LE NUMÉRO PROPOSÉ SOUS LE COMPTE DU PLAN CHOISI · relu à chaque choix ;
  // le champ prend la proposition, que le cabinet garde ou remplace.
  useEffect(() => {
    if (!nouveauOuvert || type !== 'TRESORERIE' || modeCompte !== 'OUVRIR' || !sousId) return;
    let actif = true;
    // Le numéro d'un autre compte du plan, ou une proposition périmée, ne part
    // pas pendant la relecture · un champ vide laisse le serveur prendre le
    // premier libre au moment même (`numeroAEnvoyer`).
    setLectureNumero(null);
    setNumeroCompte('');
    api.get<CompteDuJournalPropose>(`/journaux/compte-propose?sousId=${encodeURIComponent(sousId)}`).then(
      (p) => {
        if (!actif) return;
        setLectureNumero({ sousId, propose: p, erreur: null });
        setNumeroCompte(p.numero ?? '');
      },
      (err) => {
        if (!actif) return;
        setLectureNumero({ sousId, propose: null, erreur: err instanceof ApiError ? err.message : 'serveur injoignable' });
        setNumeroCompte('');
      },
    );
    return () => {
      actif = false;
    };
  }, [nouveauOuvert, type, modeCompte, sousId, relire]);
  const propositionDuChoix = lectureNumero && lectureNumero.sousId === sousId ? lectureNumero : null;
  const lectureEnCours = type === 'TRESORERIE' && modeCompte === 'OUVRIR' && !!sousId && !propositionDuChoix;

  // Fermer remet le formulaire à neuf · un refus ou un numéro d'une ouverture
  // précédente ne reparaît pas à la suivante. Le compte du plan reste choisi,
  // sa proposition étant relue à l'ouverture.
  const fermer = () => {
    setCode('');
    setIntitule('');
    setType('GENERAL');
    setCompteTresorerieId('');
    setModeCompte('OUVRIR');
    setNumeroCompte('');
    setLectureNumero(null);
    setNumerotation('CONTINUE_JOURNAL');
    setErreurForm(null);
    setNouveauOuvert(false);
  };

  if (!estAdmin) {
    return (
      <div className="p-4">
        <div className="border border-warning/30 bg-warning-soft px-4 py-3 text-[11.5px] max-w-[480px]">
          Cette fenêtre est réservée aux administrateurs du dossier.
        </div>
      </div>
    );
  }

  const onCreer = async (e: FormEvent) => {
    e.preventDefault();
    setErreurForm(null);
    setEnvoi(true);
    try {
      await api.post('/journaux', {
        code,
        intitule,
        type,
        numerotation,
        ...(type === 'TRESORERIE'
          ? corpsCompteDuJournal(modeCompte, {
              sousId,
              numeroSaisi: numeroCompte,
              propose: propositionDuChoix?.propose ?? null,
              compteTresorerieId,
            })
          : {}),
      });
      fermer();
      await charger();
    } catch (err) {
      setErreurForm(err instanceof ApiError ? err.message : 'Impossible de créer ce journal');
    } finally {
      setEnvoi(false);
    }
  };

  // Suppression · le serveur refuse tout objet mouvementé ou utilisé, et
  // dit lequel (common/suppression/references.ts). La confirmation évite le
  // clic malheureux sur un objet libre, qui, lui, disparaît pour de bon.
  const supprimer = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer ${nom} ? Cette suppression est définitive.`)) return;
    setErreurChargement(null);
    try {
      await api.delete(`/journaux/${id}`);
      
      await charger();
    } catch (err) {
      setErreurChargement(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  };

  const basculerContrepartie = async (j: Journal) => {
    try {
      await api.patch(`/journaux/${j.id}`, { contrepartieChaqueLigne: !j.contrepartieChaqueLigne });
      await charger();
    } catch (err) {
      setErreurChargement(err instanceof ApiError ? err.message : 'Action impossible');
    }
  };

  const basculerActif = async (j: Journal) => {
    try {
      await api.patch(`/journaux/${j.id}`, { estActif: !j.estActif });
      await charger();
    } catch (err) {
      setErreurChargement(err instanceof ApiError ? err.message : 'Action impossible');
    }
  };

  return (
    <div className="p-2 avec-edition">
      <EnteteImpression titre="Codes journaux" />
      <EditionStructure edition={editionJournaux(liste ?? [])} perimetre={perimetreEdition([], liste?.length ?? 0, 'journal', 'journaux')} />
      <div className="flex items-center justify-end gap-2 mb-2">
        <BoutonImprimer libelle="Imprimer la liste" />
        <Aide
          titre="Codes journaux"
          texte="Le type d'un journal détermine le pré-positionnement du curseur en saisie (débit ou crédit selon la racine du compte) et n'est plus modifiable après création. Un journal de trésorerie porte son compte rattaché : la contrepartie s'y enregistre en un clic depuis la saisie. « Situation » : écritures provisoires, jamais clôturé."
          source="Codes journaux"
        />
        <button
          type="button"
          onClick={() => setNouveauOuvert(true)}
          className="bg-sel text-white px-3.5 py-1 text-[11.5px] font-semibold"
        >
          Nouveau journal
        </button>
      </div>

      {erreurChargement && (
        <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">
          {erreurChargement}
        </div>
      )}

      <div
        // `overflow-x-auto` ici, `min-w` sur les lignes · les 726 px de colonnes
        // incompressibles du tableau ne tiennent pas dans les ~326 px utiles d'une
        // fenêtre à 360 px, et sans conteneur le débordement remontait à la fenêtre,
        // qui emportait alors titre, onglets et boutons hors de l'écran.
        className="border border-border bg-surface shadow-posee overflow-x-auto"
      >
        <div className="entete-colonnes grid grid-cols-[76px_1fr_100px_160px_220px_92px_70px] min-w-[950px] gap-2.5 px-3.5 py-1.5 bg-surface-alt border-b border-border-dark text-[11px] font-bold text-text-dim">
          <span>Code</span>
          <span>Intitulé</span>
          <span>Type</span>
          <span>Numérotation des pièces</span>
          <span>Compte de trésorerie</span>
          <span>État</span>
          <span />
        </div>
        {!liste && <div className="px-3.5 py-3 text-[11.5px] text-text-dim">Chargement…</div>}
        {liste?.map((j) => (
          <div
            key={j.id}
            className={`grid grid-cols-[76px_1fr_100px_160px_220px_92px_70px] min-w-[950px] gap-2.5 items-center px-3.5 py-[4px] border-b border-border/50 last:border-b-0 text-[11.5px] hover:bg-sel-soft ${
              !j.estActif ? 'opacity-55' : ''
            }`}
          >
            <span className="font-mono font-semibold">{j.code}</span>
            <span className="truncate">{j.intitule}</span>
            <span className="text-text-dim">{LIBELLE_TYPE[j.type]}</span>
            <span className="text-[11px] text-text-dim">{LIBELLE_NUMEROTATION[j.numerotation]}</span>
            <span className="font-mono text-[11px] text-text-dim truncate">
              {j.compteTresorerie ? `${j.compteTresorerie.numero} ${j.compteTresorerie.intitule}` : ''}
              {j.type === 'TRESORERIE' && (
                <label className="flex items-center gap-1 font-sans text-text" title="Chaque ligne saisie reçoit aussitôt sa ligne de trésorerie, même libellé, sens inverse (Sage i7)">
                  <input
                    type="checkbox"
                    checked={!!j.contrepartieChaqueLigne}
                    onChange={() => basculerContrepartie(j)}
                  />
                  Contrepartie à chaque ligne
                </label>
              )}
            </span>
            <button
              onClick={() => basculerActif(j)}
              title={j.estActif ? 'Mettre en sommeil (bloque la saisie sur ce journal)' : 'Réactiver'}
              className={`text-[11px] text-left ${j.estActif ? 'text-positive hover:underline' : 'text-warning hover:underline'}`}
            >
              {j.estActif ? 'Actif' : 'En sommeil'}
            </button>
            <button onClick={() => supprimer(j.id, `le journal ${j.code}`)} className="text-[11px] text-left text-danger hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>


      {nouveauOuvert && (
        <PortailModale>
          <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
            <form onSubmit={onCreer} className="anim-modale w-full max-w-[460px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <div
                className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]"
              >
                <span>Nouveau code journal</span>
                <button type="button" disabled={envoi} onClick={fermer} className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c] disabled:opacity-50">
                  ✕
                </button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2.5">
                  <label className="text-[11.5px] text-right">Code :</label>
                  <input
                    required
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ACH, VEN, BQ…"
                    className="border border-border-dark px-2.5 py-1.5 text-[12px] font-mono"
                  />
                  <label className="text-[11.5px] text-right">Intitulé :</label>
                  <input
                    required
                    value={intitule}
                    onChange={(e) => setIntitule(e.target.value)}
                    className="border border-border-dark px-2.5 py-1.5 text-[12px]"
                  />
                  <label className="text-[11.5px] text-right">Type :</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TypeJournal)}
                    className="border border-border-dark px-2.5 py-1.5 text-[11.5px]"
                  >
                    {(Object.keys(LIBELLE_TYPE) as TypeJournal[]).map((t) => (
                      <option key={t} value={t}>
                        {LIBELLE_TYPE[t]}
                      </option>
                    ))}
                  </select>
                  <label className="text-[11.5px] text-right">Numérotation :</label>
                  <select
                    value={numerotation}
                    onChange={(e) => setNumerotation(e.target.value as NumerotationPiece)}
                    className="border border-border-dark px-2.5 py-1.5 text-[11.5px]"
                  >
                    {(Object.keys(LIBELLE_NUMEROTATION) as NumerotationPiece[]).map((n) => (
                      <option key={n} value={n}>
                        {LIBELLE_NUMEROTATION[n]}
                      </option>
                    ))}
                  </select>
                  {numerotation === 'MANUELLE' && (
                    <>
                      <span />
                      <span className="text-[11px] text-warning">Les pièces de ce journal resteront sans numéro.</span>
                    </>
                  )}
                  {type === 'TRESORERIE' && (
                    <>
                      <span id={idModeCompte} className="text-[11.5px] text-right">Compte du journal :</span>
                      <div role="radiogroup" aria-labelledby={idModeCompte} className="flex gap-4 text-[11.5px]">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="mode-compte-journal"
                            checked={modeCompte === 'OUVRIR'}
                            onChange={() => setModeCompte('OUVRIR')}
                          />
                          Ouvrir son compte
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="mode-compte-journal"
                            checked={modeCompte === 'EXISTANT'}
                            onChange={() => setModeCompte('EXISTANT')}
                          />
                          Compte existant
                        </label>
                      </div>
                    </>
                  )}
                  {type === 'TRESORERIE' && modeCompte === 'OUVRIR' && (
                    <>
                      <label htmlFor={idSous} className="text-[11.5px] text-right">
                        Sous le compte :
                      </label>
                      <select
                        id={idSous}
                        required
                        value={sousId}
                        onChange={(e) => setSousId(e.target.value)}
                        className="border border-border-dark px-2.5 py-1.5 text-[11.5px]"
                      >
                        <option value="">Sélectionner</option>
                        {(comptesDuPlan ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.numero} · {c.intitule}
                          </option>
                        ))}
                      </select>
                      {(erreurComptesDuPlan || (comptesDuPlan && comptesDuPlan.length === 0)) && (
                        <>
                          <span />
                          <span className={`text-[11px] ${erreurComptesDuPlan ? 'text-danger' : 'text-warning'}`}>
                            {erreurComptesDuPlan
                              ? `Comptes du plan illisibles · ${erreurComptesDuPlan}`
                              : 'Aucun compte de trésorerie du plan actif dans ce dossier · réactivez-en un dans le plan comptable.'}
                          </span>
                        </>
                      )}
                      <label htmlFor={idNumero} className="text-[11.5px] text-right">
                        N° de compte :
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={idNumero}
                          inputMode="numeric"
                          value={numeroCompte}
                          onChange={(e) => setNumeroCompte(e.target.value)}
                          disabled={!sousId || !propositionDuChoix}
                          placeholder={lectureEnCours ? 'Lecture…' : undefined}
                          aria-busy={lectureEnCours}
                          aria-describedby={idMessageNumero}
                          className="border border-border-dark px-2.5 py-1.5 text-[12px] w-[140px] disabled:opacity-50"
                        />
                        <Aide
                          titre="Numéro du compte du journal"
                          texte="OmegaX propose le premier numéro libre sous le compte du plan choisi · gardez-le, ou remplacez-le par un numéro de même longueur qui commence par le sien. Le compte naît avec le journal."
                          source="Le numéro d'un compte divisionnaire commence toujours par celui du compte dont il est une subdivision (AUDCIF, Titre VII ; SYCEBNL, Partie 2 ch. 2)."
                        />
                      </div>
                      <span />
                      <span id={idMessageNumero} role="status" className="text-[11px] text-danger">
                        {propositionDuChoix && (propositionDuChoix.erreur ?? propositionDuChoix.propose?.motif)}
                        {propositionDuChoix?.erreur && (
                          <button
                            type="button"
                            onClick={() => setRelire((n) => n + 1)}
                            className="ml-2 underline text-text"
                          >
                            Relire
                          </button>
                        )}
                      </span>
                    </>
                  )}
                  {type === 'TRESORERIE' && modeCompte === 'EXISTANT' && (
                    <>
                      <label htmlFor={idCompteExistant} className="text-[11.5px] text-right">
                        Compte de trésorerie :
                      </label>
                      <select
                        id={idCompteExistant}
                        required
                        value={compteTresorerieId}
                        onChange={(e) => setCompteTresorerieId(e.target.value)}
                        className="border border-border-dark px-2.5 py-1.5 text-[11.5px]"
                      >
                        <option value="">Sélectionner</option>
                        {(comptesTresorerie ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.numero} · {c.intitule}
                          </option>
                        ))}
                      </select>
                      {(erreurComptes || (comptesTresorerie && comptesTresorerie.length === 0)) && (
                        <>
                          <span />
                          <span className={`text-[11px] ${erreurComptes ? 'text-danger' : 'text-warning'}`}>
                            {erreurComptes
                              ? `Comptes de trésorerie illisibles · ${erreurComptes}`
                              : motifAucunCompteRetenu(comptesTresorerie, 'de trésorerie (classe 5)')}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
                {erreurForm && (
                  <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-2.5 py-1.5 mt-3">
                    {erreurForm}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    disabled={envoi}
                    onClick={fermer}
                    className="border border-border-dark bg-chrome hover:bg-chrome-alt px-4 py-1.5 text-[11.5px] disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button type="submit" disabled={envoi || lectureEnCours} className="bg-sel text-white px-4 py-1.5 text-[11.5px] font-semibold disabled:opacity-50">
                    {envoi ? 'Création…' : 'Créer le journal'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </PortailModale>
      )}
    </div>
  );
}
