import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { lireNombre } from '../lib/conditions-bancaires-saisie';
import { Aide } from '../components/chrome/Aide';

/**
 * TAUX DE RÉFÉRENCE · Structure > Paramètres de saisie (ligne sage-l3,
 * fonction 47 · chez Sage, F_TAUXREFERENCE et F_HISTOTAUXREFERENCE). Un taux
 * se crée et se retire par l'administrateur ; un cours se DÉCLARE avec sa
 * source par l'administrateur ou le comptable, et ne se réécrit pas. Un taux
 * ou un cours qui a fixé une opération ne se retire pas (le serveur le dit).
 */

interface Cours {
  id: string;
  date: string;
  valeur: number;
  source: string;
}
interface Taux {
  id: string;
  code: string;
  intitule: string;
  cours: Cours[];
  coursTotal: number;
  coursTronques: boolean;
  operations: number;
}
interface Liste {
  taux: Taux[];
  total: number;
  tronque: boolean;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const messageDuRefus = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.status < 500 ? err.message : `${defaut} · réponse perdue, le geste a pu passer. Relisez la liste avant de le refaire.`;

export function TauxReferencePage() {
  const { estAdmin, peutValider } = useAuth();
  const [liste, setListe] = useState<Liste | null>(null);
  // L'erreur d'un geste reste jusqu'au geste suivant ; celle de la lecture suit la dernière lecture.
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const jeton = useRef(0);
  const charger = useCallback(async () => {
    const n = ++jeton.current;
    try {
      const l = await api.get<Liste>('/taux-reference');
      if (n === jeton.current) {
        setListe(l);
        setErreurLecture(null);
      }
    } catch (err) {
      if (n === jeton.current) setErreurLecture(err instanceof ApiError ? err.message : 'Taux de référence illisibles');
    }
  }, []);
  useEffect(() => {
    void charger();
  }, [charger]);
  const fait = async (m: string) => {
    setInfo(m);
    setErreur(null);
    await charger();
  };
  const refus = (err: unknown, defaut: string) => {
    setErreur(messageDuRefus(err, defaut));
    if (!(err instanceof ApiError && err.status < 500 && err.status !== 409)) void charger();
  };

  const [code, setCode] = useState('');
  const [intitule, setIntitule] = useState('');
  const [envoi, setEnvoi] = useState<string | null>(null);
  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi || !code.trim() || !intitule.trim()) return;
    setEnvoi('creation');
    try {
      await api.post('/taux-reference', { code: code.trim(), intitule: intitule.trim() });
      setCode('');
      setIntitule('');
      await fait(`Taux ${code.trim().toUpperCase()} créé · déclarez son premier cours avec sa source.`);
    } catch (err) {
      refus(err, 'Création impossible');
    } finally {
      setEnvoi(null);
    }
  };
  const retirer = async (t: Taux) => {
    if (envoi) return;
    setEnvoi(t.id);
    try {
      await api.delete(`/taux-reference/${t.id}`);
      await fait(`Taux ${t.code} retiré.`);
    } catch (err) {
      refus(err, 'Retrait impossible');
    } finally {
      setEnvoi(null);
    }
  };
  const retirerCours = async (t: Taux, c: Cours) => {
    if (envoi) return;
    setEnvoi(c.id);
    try {
      await api.delete(`/taux-reference/${t.id}/cours/${c.id}`);
      await fait(`Cours du ${date(c.date)} retiré du taux ${t.code}.`);
    } catch (err) {
      refus(err, 'Retrait impossible');
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <div className="p-3 space-y-3 text-[11.5px] avec-edition">
      {([['geste', erreur], ['lecture', erreurLecture]] as const).filter(([, m]) => m).map(([cle, m]) => (
        <div key={cle} role="alert" className="text-danger bg-danger-soft border border-danger/30 px-3 py-2">
          {m}
        </div>
      ))}
      <div role="status" aria-live="polite">
        {info && <div className="text-ok bg-ok-soft border border-ok/30 px-3 py-2">{info}</div>}
      </div>
      <div className="flex items-center justify-end">
        <Aide
          titre="Taux de référence"
          texte="Un taux de référence (taux directeur, taux de la banque) porte ses cours datés, chacun avec sa source. Une opération de trésorerie à taux variable retient le cours en vigueur à sa mise en place, jamais un cours postérieur, et le fige avec sa marge. Un cours déclaré ne se réécrit pas · retirez-le s'il n'a servi à aucune opération, puis redéclarez-le."
          source="AUDCIF art. 17, 3° (pièce justificative) ; Sage 100, structure des fichiers"
        />
      </div>
      {estAdmin && (
        <form onSubmit={creer} noValidate className="border border-border bg-surface p-3 flex flex-wrap items-end gap-2" aria-label="Nouveau taux de référence">
          <label className="flex flex-col gap-0.5">
            <span className="text-text-dim">Code</span>
            <input value={code} maxLength={10} onChange={(e) => setCode(e.target.value)} className="border border-border px-2 py-[2px] w-28" />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
            <span className="text-text-dim">Intitulé</span>
            <input value={intitule} maxLength={60} onChange={(e) => setIntitule(e.target.value)} className="border border-border px-2 py-[2px]" />
          </label>
          <button type="submit" disabled={envoi !== null || !code.trim() || !intitule.trim()} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-40">
            {envoi === 'creation' ? '…' : 'Créer le taux'}
          </button>
        </form>
      )}
      {liste === null && !erreurLecture && <div className="text-text-dim">Lecture des taux…</div>}
      {liste && liste.taux.length === 0 && <div className="text-text-dim">Aucun taux de référence dans ce dossier.</div>}
      {liste?.taux.map((t) => (
        <section key={t.id} aria-labelledby={`taux-${t.id}`} className="border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id={`taux-${t.id}`} className="font-semibold">
              {t.code} · {t.intitule}
              {t.operations > 0 && <span className="font-normal text-text-dim"> · {t.operations} opération(s)</span>}
            </h2>
            {estAdmin && t.operations === 0 && (
              <button type="button" disabled={envoi !== null} onClick={() => void retirer(t)} className="px-2 py-px border border-border text-danger disabled:opacity-40">
                {envoi === t.id ? '…' : 'Retirer le taux'}
              </button>
            )}
          </div>
          {t.cours.length === 0 ? (
            <div className="text-text-dim">Aucun cours déclaré.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th scope="col" className="text-left px-2 py-1">Date</th>
                  <th scope="col" className="text-right px-2 py-1">Cours (%)</th>
                  <th scope="col" className="text-left px-2 py-1">Source</th>
                  <th scope="col" className="text-left px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {t.cours.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-2 py-1">{date(c.date)}</td>
                    <td className="px-2 py-1 text-right">{c.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 6 })}</td>
                    <td className="px-2 py-1">{c.source}</td>
                    <td className="px-2 py-1">
                      {estAdmin && (
                        <button type="button" disabled={envoi !== null} onClick={() => void retirerCours(t, c)} className="px-2 py-px border border-border text-danger disabled:opacity-40">
                          {envoi === c.id ? '…' : 'Retirer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {t.coursTronques && <div className="text-text-dim">{t.cours.length} cours montrés sur {t.coursTotal}, les plus récents.</div>}
          {peutValider && <FormCours taux={t} onFait={fait} onRefus={refus} />}
        </section>
      ))}
      {liste?.tronque && <div className="text-text-dim">{liste.taux.length} taux montrés sur {liste.total}.</div>}
    </div>
  );
}

function FormCours(p: { taux: Taux; onFait: (m: string) => Promise<void>; onRefus: (err: unknown, defaut: string) => void }) {
  const [jour, setJour] = useState('');
  const [valeur, setValeur] = useState('');
  const [source, setSource] = useState('');
  const [refusLocal, setRefusLocal] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const declarer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const lu = lireNombre(valeur);
    if (!('valeur' in lu)) {
      setRefusLocal('Cours illisible (en pour cent, par exemple 8,25).');
      return;
    }
    setRefusLocal(null);
    setEnvoi(true);
    try {
      await api.post(`/taux-reference/${p.taux.id}/cours`, { date: jour, valeur: lu.valeur, source: source.trim() });
      setJour('');
      setValeur('');
      setSource('');
      await p.onFait(`Cours du ${date(jour)} déclaré pour le taux ${p.taux.code}.`);
    } catch (err) {
      p.onRefus(err, 'Déclaration impossible');
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <form onSubmit={declarer} noValidate className="flex flex-wrap items-end gap-2" aria-label={`Déclarer un cours du taux ${p.taux.code}`}>
      {refusLocal && (
        <div role="alert" className="w-full text-danger bg-danger-soft border border-danger/30 px-2 py-1.5">
          {refusLocal}
        </div>
      )}
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Date</span>
        <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="border border-border px-2 py-[2px]" />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-text-dim">Cours (%)</span>
        <input inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} className="border border-border px-2 py-[2px] w-24 text-right" />
      </label>
      <label className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
        <span className="text-text-dim">Source</span>
        <input value={source} maxLength={200} onChange={(e) => setSource(e.target.value)} className="border border-border px-2 py-[2px]" />
      </label>
      <button type="submit" disabled={envoi || !jour || !valeur.trim() || !source.trim()} className="px-3 py-1 border border-border disabled:opacity-40">
        {envoi ? '…' : 'Déclarer le cours'}
      </button>
    </form>
  );
}
