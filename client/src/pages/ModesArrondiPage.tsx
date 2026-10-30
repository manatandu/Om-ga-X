import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Aide } from '../components/chrome/Aide';
import { montant } from '../lib/montants';
import { LIBELLES_METHODES, lireNombre, type MethodeArrondi, type ModeArrondi } from '../lib/gestion-commerciale';

const message = (e: unknown, defaut: string) => (e instanceof ApiError ? e.message : defaut);

/**
 * MODES D'ARRONDI (ligne commercial-l8, fonction 94) · Structure > Gestion
 * commerciale. Une structure de l'administrateur · le mode arrondit le prix
 * net proposé à la ligne d'une vente, jamais la taxe ni un total.
 */
export function ModesArrondiPage() {
  const { estAdmin } = useAuth();
  const [liste, setListe] = useState<{ total: number; tronque: boolean; modes: ModeArrondi[] } | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Ce que le serveur dit d'un mode mis en sommeil que des articles portent.
  const [avis, setAvis] = useState<string | null>(null);
  const [intitule, setIntitule] = useState('');
  const [methode, setMethode] = useState<MethodeArrondi>('PROCHE');
  const [pas, setPas] = useState('');

  const relire = useCallback(
    () =>
      api.get<{ total: number; tronque: boolean; modes: ModeArrondi[] }>('/commercial/modes-arrondi').then(
        (r) => {
          setListe(r);
          setErreurLecture(null);
        },
        (e) => setErreurLecture(message(e, 'Les modes d’arrondi n’ont pas pu être lus.')),
      ),
    [],
  );
  useEffect(() => {
    void relire();
  }, [relire]);

  const agir = async (fn: () => Promise<unknown>) => {
    setErreur(null);
    setEnvoi(true);
    try {
      await fn();
      await relire();
      return true;
    } catch (e) {
      setErreur(message(e, 'Le serveur n’a pas répondu.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const creer = (e: FormEvent) => {
    e.preventDefault();
    const p = lireNombre(pas);
    if (p === undefined || p === null) {
      setErreur('Le pas se saisit en chiffres, la virgule pour les décimales (0,01 au moins).');
      return;
    }
    void agir(() => api.post('/commercial/modes-arrondi', { intitule: intitule.trim(), methode, pas: p })).then((ok) => {
      if (ok) {
        setIntitule('');
        setPas('');
      }
    });
  };

  return (
    <div className="p-2 max-w-[820px] text-[11.5px]">
      <div className="flex items-center mb-2">
        <div className="flex-1" />
        <Aide
          titre="Modes d’arrondi"
          texte="Un mode arrondit le prix net unitaire proposé à la ligne d’une vente (prix de l’article ou tarif du client, moins la remise), au pas choisi · au plus proche, au supérieur ou à l’inférieur. Sans mode, le prix net est proposé au centime le plus proche. Le mode ne touche jamais la taxe ni un total, et la ligne garde le prix que le cabinet y porte."
          source="AUDCG art. 263 (prix convenu) · O.-L. n° 10/001, art. 29 (base de la taxe)"
        />
      </div>
      {erreurLecture && <div className="text-danger mb-2">{erreurLecture}</div>}
      {avis && <div role="status" className="text-warning mb-2">{avis}</div>}
      {erreur && <div className="text-danger bg-danger-soft border border-danger/30 px-3 py-1.5 mb-2">{erreur}</div>}
      {estAdmin && (
        <form onSubmit={creer} className="border border-border bg-surface p-2 mb-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Intitulé
            <input required maxLength={35} value={intitule} onChange={(e) => setIntitule(e.target.value)} className="border border-border px-1 py-0.5 w-[220px]" />
          </label>
          <label className="flex flex-col">
            Méthode
            <select value={methode} onChange={(e) => setMethode(e.target.value as MethodeArrondi)} className="border border-border px-1 py-0.5 bg-surface">
              {(Object.keys(LIBELLES_METHODES) as MethodeArrondi[]).map((m) => (
                <option key={m} value={m}>
                  {LIBELLES_METHODES[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Pas (francs)
            <input required inputMode="decimal" value={pas} onChange={(e) => setPas(e.target.value)} className="border border-border px-1 py-0.5 w-[110px] text-right" />
          </label>
          <button type="submit" disabled={envoi} className="bg-sel text-white px-4 py-1 rounded-full disabled:opacity-50">
            Créer le mode
          </button>
        </form>
      )}
      {liste === null && !erreurLecture && <div className="text-text-dim">Lecture des modes d’arrondi…</div>}
      {liste && (
        <>
          {liste.tronque && <div className="text-warning mb-1">{liste.modes.length} modes montrés sur {liste.total}.</div>}
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Intitulé</th>
                <th className="text-left w-[140px]">Méthode</th>
                <th className="text-right w-[120px]">Pas</th>
                <th className="text-center w-[60px]">Actif</th>
                <th className="w-[90px]" />
              </tr>
            </thead>
            <tbody>
              {liste.modes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-text-dim">
                    Aucun mode d’arrondi · le prix net se propose au centime le plus proche.
                  </td>
                </tr>
              )}
              {liste.modes.map((m) => (
                <tr key={m.id} className={m.actif ? '' : 'text-text-dim'}>
                  <td>{m.intitule}</td>
                  <td>{LIBELLES_METHODES[m.methode]}</td>
                  <td className="text-right">{montant(m.pas)}</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`Mode ${m.intitule} actif`}
                      checked={m.actif}
                      disabled={!estAdmin || envoi}
                      onChange={(e) =>
                        void agir(async () => {
                          const r = await api.patch<{ avertissement?: string | null }>(`/commercial/modes-arrondi/${m.id}`, { actif: e.target.checked });
                          setAvis(r.avertissement ?? null);
                        })
                      }
                    />
                  </td>
                  <td className="text-right">
                    {estAdmin && (
                      <button
                        type="button"
                        disabled={envoi}
                        onClick={() => void agir(() => api.delete(`/commercial/modes-arrondi/${m.id}`))}
                        className="border border-border-dark bg-chrome hover:bg-chrome-alt px-2 py-0.5 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
