import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { jourDeKinshasaIso } from '../lib/roles-cantonnes';
import { dateLue, LIBELLE_NATURE_RECU, type DetentionServie, type RecuServi } from '../lib/detention-bien';
import { Aide } from './chrome/Aide';

interface Historique {
  bien: { id: string; designation: string; sorti: boolean };
  enCours: DetentionServie | null;
  detentions: DetentionServie[];
  total: number;
  tronque: boolean;
}

interface SalarieAffectable {
  id: string;
  nom: string;
}

interface Lieu {
  id: string;
  code: string;
  intitule: string;
}

interface RecuComplet extends RecuServi {
  texte: string;
  etabliLe: string;
  etabliPar: string;
}

const message = (e: unknown, defaut: string) => (e instanceof ApiError ? e.message : defaut);

/**
 * Imprime le reçu dans une fenêtre à part · le texte est posé par
 * `textContent`, jamais interprété. Une fenêtre bloquée se dit.
 */
function imprimerRecu(r: RecuComplet): string | null {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return 'La fenêtre d’impression a été bloquée par le navigateur · autorisez-la pour ce site.';
  w.document.title = `Reçu n° ${r.numero}`;
  const pre = w.document.createElement('pre');
  pre.style.font = '12px "Segoe UI", sans-serif';
  pre.style.whiteSpace = 'pre-wrap';
  const signature = r.signature
    ? `\n\nSignature déclarée · ${r.signature.signataires ?? '·'}, le ${dateLue(r.signature.date)}.`
    : '\n\nSignature · non encore déclarée.';
  pre.textContent = `${r.texte}${signature}\n\nÉtabli le ${new Date(r.etabliLe).toLocaleString('fr-FR')} par ${r.etabliPar}.`;
  w.document.body.appendChild(pre);
  w.focus();
  w.print();
  return null;
}

/** Le reçu d'un acte · son texte figé, sa signature déclarée ou à déclarer. */
function RecuDetention({ recuId, onFait }: { recuId: string; onFait: () => void }) {
  const { peutValider } = useAuth();
  const [recu, setRecu] = useState<RecuComplet | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [signataires, setSignataires] = useState('');
  const [date, setDate] = useState(() => jourDeKinshasaIso(new Date()));
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    let vivant = true;
    setRecu(null);
    setErreur(null);
    api.get<RecuComplet>(`/immobilisations/detentions/recus/${recuId}`).then(
      (r) => vivant && setRecu(r),
      (e) => vivant && setErreur(message(e, 'Le reçu n’a pas pu être lu.')),
    );
    return () => {
      vivant = false;
    };
  }, [recuId]);
  const declarer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOccupe(true);
    setErreur(null);
    try {
      setRecu(await api.post<RecuComplet>(`/immobilisations/detentions/recus/${recuId}/signature`, { signataires, date }));
      onFait();
    } catch (err) {
      setErreur(message(err, 'La signature n’a pas pu être déclarée.'));
    } finally {
      setOccupe(false);
    }
  };
  if (erreur && !recu) return <div className="text-danger text-[11.5px]">{erreur}</div>;
  if (!recu) return <div className="text-text-dim text-[11.5px]">Lecture du reçu…</div>;
  return (
    <div className="border border-border bg-fenetre p-2 mt-2 text-[11.5px]" data-testid="recu-detention">
      <pre className="whitespace-pre-wrap font-[inherit] mb-2">{recu.texte}</pre>
      <div className="mb-2">
        {recu.signature ? (
          <span data-testid="signature-declaree">
            Signé par {recu.signature.signataires} le {dateLue(recu.signature.date)} · déclaré par {recu.signature.declareePar ?? '·'}
          </span>
        ) : (
          <span className="text-warning">Signature non déclarée</span>
        )}
      </div>
      <div className="flex gap-2 items-end flex-wrap">
        <button type="button" className="border border-border-dark px-2 py-[3px]" onClick={() => setErreur(imprimerRecu(recu))}>
          Imprimer le reçu
        </button>
        {!recu.signature && peutValider && (
          <form onSubmit={(e) => void declarer(e)} className="flex gap-2 items-end flex-wrap">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Signé par</span>
              <input
                aria-label="Signé par"
                value={signataires}
                onChange={(e) => setSignataires(e.target.value)}
                required
                minLength={2}
                maxLength={300}
                className="border border-border-dark px-2 py-[3px] w-64"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-dim">Le</span>
              <input aria-label="Date de la signature" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="border border-border-dark px-2 py-[3px]" />
            </label>
            <button type="submit" disabled={occupe} className="bg-sel text-white px-3 py-[4px] font-semibold disabled:opacity-60">
              Déclarer la signature
            </button>
            <Aide
              titre="Signature du reçu"
              texte="Le reçu ne vaut que par les signatures portées sur le papier. OmegaX ne les présume jamais · déclarez qui a signé et quel jour, une fois. Le reçu n’est pas un contrat."
              source="Convention d’OmegaX"
            />
          </form>
        )}
      </div>
      {erreur && <div className="text-danger mt-1">{erreur}</div>}
    </div>
  );
}

type Geste = 'AFFECTATION' | 'TRANSFERT' | 'LIBERATION';

/**
 * LE VOLET « DÉTENTEUR » DE LA FICHE D'UN BIEN (ligne Microfina M4) · qui le
 * détient, ses détentions passées, et les trois gestes. Les refus et leur
 * motif viennent du serveur · l'écran ne rejuge rien.
 */
export function DetenteurImmobilisation({
  bien,
  onFait,
  onOccupe,
}: {
  bien: { id: string; designation: string };
  onFait: (message: string) => void;
  onOccupe?: (occupe: boolean) => void;
}) {
  const { peutValider } = useAuth();
  const [historique, setHistorique] = useState<Historique | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [geste, setGeste] = useState<Geste | null>(null);
  const [date, setDate] = useState(() => jourDeKinshasaIso(new Date()));
  const [salaries, setSalaries] = useState<{ liste: SalarieAffectable[]; tronque: boolean } | null>(null);
  const [erreurSalaries, setErreurSalaries] = useState<string | null>(null);
  const [lieux, setLieux] = useState<Lieu[] | null>(null);
  const [erreurLieux, setErreurLieux] = useState<string | null>(null);
  const [salarieId, setSalarieId] = useState('');
  const [lieuId, setLieuId] = useState('');
  const [observation, setObservation] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [recuOuvert, setRecuOuvert] = useState<string | null>(null);
  const jeton = useRef(0);

  const charger = useCallback(() => {
    const j = ++jeton.current;
    setErreurLecture(null);
    api.get<Historique>(`/immobilisations/${bien.id}/detentions`).then(
      (h) => j === jeton.current && setHistorique(h),
      (e) => j === jeton.current && setErreurLecture(message(e, 'L’historique des détenteurs n’a pas pu être lu.')),
    );
  }, [bien.id]);
  useEffect(() => charger(), [charger]);
  // Le rappel passe par une référence · la fiche le recrée à chaque rendu, et
  // le mettre en dépendance relançait l'effet, qui la faisait se redessiner,
  // sans fin.
  const surOccupe = useRef(onOccupe);
  surOccupe.current = onOccupe;
  useEffect(() => surOccupe.current?.(occupe), [occupe]);

  // Les salariés sous contrat à la DATE du geste · relus quand elle change.
  useEffect(() => {
    if (geste !== 'AFFECTATION' && geste !== 'TRANSFERT') return;
    let vivant = true;
    setSalaries(null);
    setErreurSalaries(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    api.get<{ salaries: SalarieAffectable[]; tronque: boolean }>(`/immobilisations/detentions/salaries?date=${date}`).then(
      (r) => {
        if (!vivant) return;
        setSalaries({ liste: r.salaries, tronque: r.tronque });
        // Un choix unique se présélectionne.
        if (r.salaries.length === 1) setSalarieId(r.salaries[0].id);
      },
      (e) => vivant && setErreurSalaries(message(e, 'La liste des salariés n’a pas pu être lue.')),
    );
    return () => {
      vivant = false;
    };
  }, [geste, date]);
  useEffect(() => {
    if (!geste || geste === 'LIBERATION' || lieux) return;
    // Un échec de lecture se dit · jamais lu comme « aucun lieu ».
    api.get<Lieu[]>('/immobilisations/lieux').then(
      (l) => {
        setErreurLieux(null);
        setLieux(l);
      },
      (e) => setErreurLieux(message(e, 'La liste des lieux n’a pas pu être lue · le bien peut être remis sans lieu.')),
    );
  }, [geste, lieux]);

  const ouvrir = (g: Geste) => {
    setGeste(g);
    setErreur(null);
    setSalarieId('');
    setObservation('');
  };
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geste) return;
    setOccupe(true);
    setErreur(null);
    const route = geste === 'AFFECTATION' ? 'affectation' : geste === 'TRANSFERT' ? 'transfert' : 'liberation';
    const corps =
      geste === 'LIBERATION'
        ? { date, ...(observation.trim() ? { observation: observation.trim() } : {}) }
        : { salarieId, date, ...(lieuId ? { lieuId } : {}), ...(observation.trim() ? { observation: observation.trim() } : {}) };
    try {
      const d = await api.post<DetentionServie>(`/immobilisations/${bien.id}/detentions/${route}`, corps);
      setGeste(null);
      const recu = geste === 'LIBERATION' ? d.recuFin : d.recuRemise;
      onFait(`${LIBELLE_NATURE_RECU[geste]} enregistré · reçu n° ${recu?.numero ?? '·'}.`);
      setRecuOuvert(recu?.id ?? null);
      charger();
    } catch (err) {
      setErreur(message(err, 'Le geste n’a pas pu être enregistré.'));
    } finally {
      setOccupe(false);
    }
  };

  if (erreurLecture) return <div className="text-danger text-[11.5px]">{erreurLecture}</div>;
  if (!historique) return <div className="text-text-dim text-[11.5px]">Lecture des détenteurs…</div>;
  const enCours = historique.enCours;
  return (
    <div className="text-[11.5px]" data-testid="volet-detenteur">
      <div className="flex items-center gap-1.5 font-semibold mb-1">
        Détenteur actuel
        <Aide
          titre="Détenteur d’un bien"
          texte="Le salarié qui a le bien en main, depuis quand, et l’historique de ses détentions. Une détention à la fois, enregistrée dans l’ordre des dates ; le salarié doit avoir un contrat en cours le jour de la remise ; un bien sorti du registre ne se remet plus. Chaque geste établit un reçu numéroté. Aucune écriture comptable · aucun texte ne l’impose, convention d’OmegaX."
          source="Convention d’OmegaX (idée tirée de Microfina++)"
        />
      </div>
      <div className="mb-2" data-testid="detenteur-actuel">
        {enCours ? (
          <>
            {enCours.salarie.nom} depuis le {dateLue(enCours.dateDebut)}
            {enCours.lieu ? ` · ${enCours.lieu.code} ${enCours.lieu.intitule}` : ''}
            {enCours.bienSortiPendantLaDetention && (
              <span className="text-warning"> · bien sorti du registre le {dateLue(enCours.dateSortieDuBien)}, détention à libérer</span>
            )}
          </>
        ) : (
          <span className="text-text-dim">Aucun détenteur</span>
        )}
      </div>

      {peutValider && !geste && (
        <div className="flex gap-2 mb-2">
          {!enCours && !historique.bien.sorti && (
            <button type="button" className="bg-sel text-white px-3 py-[4px] font-semibold" onClick={() => ouvrir('AFFECTATION')}>
              Affecter
            </button>
          )}
          {enCours && !historique.bien.sorti && (
            <button type="button" className="border border-border-dark px-2 py-[3px]" onClick={() => ouvrir('TRANSFERT')}>
              Transférer
            </button>
          )}
          {enCours && (
            <button type="button" className="border border-border-dark px-2 py-[3px]" onClick={() => ouvrir('LIBERATION')}>
              Libérer
            </button>
          )}
        </div>
      )}

      {geste && (
        <form onSubmit={(e) => void envoyer(e)} className="border border-border bg-fenetre p-2 mb-2 flex flex-wrap gap-2 items-end">
          <span className="font-semibold w-full">{geste === 'AFFECTATION' ? 'Affecter le bien' : geste === 'TRANSFERT' ? 'Transférer le bien' : 'Libérer le bien'}</span>
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Date</span>
            <input aria-label="Date du geste" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="border border-border-dark px-2 py-[3px]" />
          </label>
          {geste !== 'LIBERATION' && (
            <>
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">{geste === 'TRANSFERT' ? 'Nouveau détenteur' : 'Détenteur'}</span>
                <select aria-label="Salarié détenteur" value={salarieId} onChange={(e) => setSalarieId(e.target.value)} required className="border border-border-dark px-2 py-[3px] min-w-[220px]">
                  <option value="">{salaries === null ? 'Lecture…' : 'Choisir'}</option>
                  {salaries?.liste.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-text-dim">Lieu</span>
                <select aria-label="Lieu de remise" value={lieuId} onChange={(e) => setLieuId(e.target.value)} className="border border-border-dark px-2 py-[3px]">
                  <option value="">Non précisé</option>
                  {lieux?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.intitule}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <span className="text-text-dim">Observation</span>
            <input aria-label="Observation" value={observation} onChange={(e) => setObservation(e.target.value)} maxLength={300} className="border border-border-dark px-2 py-[3px]" />
          </label>
          <button type="submit" disabled={occupe} className="bg-sel text-white px-3 py-[4px] font-semibold disabled:opacity-60">
            Enregistrer
          </button>
          <button type="button" disabled={occupe} onClick={() => setGeste(null)} className="border border-border-dark px-2 py-[3px]">
            Annuler
          </button>
          {erreurSalaries && <div className="text-danger w-full">{erreurSalaries}</div>}
          {erreurLieux && <div className="text-danger w-full">{erreurLieux}</div>}
          {salaries && salaries.liste.length === 0 && (
            <div className="text-text-dim w-full">Aucun salarié n’a de contrat en cours à cette date · enregistrez d’abord son contrat dans le registre du personnel.</div>
          )}
          {salaries?.tronque && <div className="text-text-dim w-full">Liste tronquée aux cinq cents premiers salariés.</div>}
        </form>
      )}
      {erreur && <div className="text-danger mb-2">{erreur}</div>}

      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Détenteur</th>
            <th className="text-left">Du</th>
            <th className="text-left">Au</th>
            <th className="text-left">Lieu</th>
            <th className="text-left">Reçus</th>
          </tr>
        </thead>
        <tbody>
          {historique.detentions.map((d) => (
            <tr key={d.id}>
              <td>{d.salarie.nom}</td>
              <td>{dateLue(d.dateDebut)}</td>
              <td>{d.dateFin ? dateLue(d.dateFin) : 'en cours'}</td>
              <td>{d.lieu ? d.lieu.code : '·'}</td>
              <td className="whitespace-nowrap">
                {[d.recuRemise, d.recuFin].filter((r): r is RecuServi => !!r).map((r) => (
                  <button key={r.id} type="button" className="text-sel underline mr-2" onClick={() => setRecuOuvert(recuOuvert === r.id ? null : r.id)}>
                    n° {r.numero}
                    {r.signature ? '' : ' (non signé)'}
                  </button>
                ))}
              </td>
            </tr>
          ))}
          {historique.detentions.length === 0 && (
            <tr>
              <td colSpan={5} className="text-text-dim">Le bien n’a jamais été remis à un salarié.</td>
            </tr>
          )}
        </tbody>
      </table>
      {historique.tronque && <div className="text-text-dim mt-1">{historique.detentions.length} détentions affichées sur {historique.total}.</div>}
      {recuOuvert && <RecuDetention recuId={recuOuvert} onFait={charger} />}
    </div>
  );
}

interface Suivi {
  du: string;
  au: string;
  detentions: DetentionServie[];
  total: number;
  tronque: boolean;
  detentionsOuvertesSurBienSorti: number;
}

/**
 * LE SUIVI SUR UNE PÉRIODE (ligne Microfina M4) · qui détenait quoi, quand,
 * entre deux dates. Lecture seule.
 */
export function SuiviDetentions() {
  const annee = jourDeKinshasaIso(new Date()).slice(0, 4);
  const [du, setDu] = useState(`${annee}-01-01`);
  const [au, setAu] = useState(jourDeKinshasaIso(new Date()));
  const [suivi, setSuivi] = useState<Suivi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const jeton = useRef(0);
  const lire = useCallback(() => {
    const j = ++jeton.current;
    setOccupe(true);
    setErreur(null);
    api
      .get<Suivi>(`/immobilisations/detentions/suivi?du=${encodeURIComponent(du)}&au=${encodeURIComponent(au)}`)
      .then(
        (s) => j === jeton.current && setSuivi(s),
        (e) => {
          if (j !== jeton.current) return;
          setSuivi(null);
          setErreur(message(e, 'Le suivi n’a pas pu être lu.'));
        },
      )
      .finally(() => j === jeton.current && setOccupe(false));
  }, [du, au]);
  useEffect(() => {
    lire();
    // La première lecture seule · ensuite, au bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="border border-border bg-surface p-3 mb-4 max-w-[1100px] text-[11.5px]" data-testid="suivi-detentions">
      <div className="flex items-center gap-1.5 font-semibold mb-2">
        Suivi des détenteurs
        <Aide
          titre="Suivi des détenteurs"
          texte="Les détentions qui touchent la période, bornes comprises · une détention qui la déborde est rendue entière, avec ses vraies dates. Ouvrez la fiche d’un bien, volet Détenteur, pour affecter, transférer ou libérer."
          source="Convention d’OmegaX"
        />
      </div>
      <form
        className="flex gap-2 items-end mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          lire();
        }}
      >
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Du</span>
          <input aria-label="Début de la période" type="date" value={du} onChange={(e) => setDu(e.target.value)} required className="border border-border-dark px-2 py-[3px]" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-text-dim">Au</span>
          <input aria-label="Fin de la période" type="date" value={au} onChange={(e) => setAu(e.target.value)} required className="border border-border-dark px-2 py-[3px]" />
        </label>
        <button type="submit" disabled={occupe} className="bg-sel text-white px-3 py-[4px] font-semibold disabled:opacity-60">
          Afficher
        </button>
      </form>
      {erreur && <div className="text-danger mb-2">{erreur}</div>}
      {suivi && suivi.detentionsOuvertesSurBienSorti > 0 && (
        <div className="text-warning mb-2">
          {suivi.detentionsOuvertesSurBienSorti} bien(s) sorti(s) du registre restent détenus · libérez-les depuis leur fiche.
        </div>
      )}
      {suivi && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Bien</th>
              <th className="text-left">N° d’inventaire</th>
              <th className="text-left">Détenteur</th>
              <th className="text-left">Du</th>
              <th className="text-left">Au</th>
              <th className="text-left">Lieu</th>
            </tr>
          </thead>
          <tbody>
            {suivi.detentions.map((d) => (
              <tr key={d.id}>
                <td>{d.bien.designation}</td>
                <td>{d.bien.numeroInventaire ?? '·'}</td>
                <td>{d.salarie.nom}</td>
                <td>{dateLue(d.dateDebut)}</td>
                <td>{d.dateFin ? dateLue(d.dateFin) : 'en cours'}</td>
                <td>{d.lieu ? d.lieu.code : '·'}</td>
              </tr>
            ))}
            {suivi.detentions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-text-dim">
                  Aucun bien détenu entre le {dateLue(suivi.du)} et le {dateLue(suivi.au)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {suivi?.tronque && <div className="text-text-dim mt-1">{suivi.detentions.length} détentions affichées sur {suivi.total}.</div>}
    </div>
  );
}
