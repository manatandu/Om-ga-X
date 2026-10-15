import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COLONNES_EXCLUES_PAR_MODELE,
  MARQUEUR_MASQUE,
  colonnesExclues,
  estChampSensible,
  masquer,
} from './champs-audites';

/**
 * LE JOURNAL D'AUDIT NE RECOPIE PAS CE QUE L'API N'EXPOSE PAS.
 *
 * `masquer()` décidait par le NOM du champ · neuf fragments (`motdepasse`,
 * `token`, `secret`…). L'heuristique attrape ce qui s'annonce, et rien
 * d'autre.
 *
 * `User.estOperateurPlateforme` ne s'annonce pas. Le schéma dit de lui
 * « aucun DTO n'expose ce champ, il est donc inatteignable par l'API » et
 * « jamais renvoyé par /utilisateurs ». Pourtant `User` est un modèle audité,
 * la charge `apres` recopie la ligne entière, et `/journal-audit` la rend à
 * tout utilisateur du dossier. Le drapeau désigne le compte de l'exploitant
 * du logiciel présent chez le client · exactement celui qu'on cherche quand
 * on cherche.
 *
 * D'où une liste par colonne, et le test qui la tient FERMÉE.
 */

const RACINE = join(__dirname, '..', '..', '..');

function colonnesDuModele(nom: string): string[] {
  const schema = readFileSync(join(RACINE, 'prisma/schema.prisma'), 'utf8');
  const bloc = new RegExp(`^model ${nom} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
  if (!bloc) throw new Error(`Modèle ${nom} introuvable dans le schéma.`);
  return bloc[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/)[0]);
}

describe('la liste d’exclusion est fermée sur User', () => {
  // Toute colonne de `User` doit être classée · admise au journal, ou exclue.
  // Une colonne ajoutée demain fait tomber ce test tant que personne ne l'a
  // tranchée. C'est ce qui distingue une liste fermée d'une liste oubliée.
  const ADMISES = [
    'id',
    'tenantId',
    'tenant',
    'email',
    'role',
    'estActif',
    // Attrapé par le fragment `motdepasse` · un sur-masquage sans conséquence,
    // le journal n'a pas besoin de dire si le drapeau valait vrai ou faux.
    'doitChangerMotDePasse',
    'sessionsInvalidesAvant',
    'tentativesEchouees',
    'verrouilleJusqua',
    // Délai d'oubli du verrou (verrouillage.ts) · ADMIS comme ses deux
    // voisines : un décompte d'échecs remis à zéro à la main se relit.
    'dernierEchecLe',
    'createdAt',
    // Profil de fonctions (point 15) · ADMIS : qui a ouvert ou fermé quelle
    // fonction à qui est exactement ce qu'un journal d'audit doit rendre.
    'restreindreFonctions',
    'fonctionsAutorisees',
    // Journaux autorisés (priorité 5) · ADMIS, pour la même raison : ouvrir
    // la banque à un caissier la veille d'un décaissement doit se relire.
    'restreindreJournaux',
    'journauxAutorises',
    // Double authentification · ADMIS pour sa DATE seulement : qui l'a
    // activée ou retirée, et quand, se relit. Le secret, le dernier pas et
    // les empreintes des codes de secours sont exclus.
    'doubleAuthActiveDepuis',
  ];

  it('classe chaque colonne de User, sans exception ni oubli', () => {
    const exclues = COLONNES_EXCLUES_PAR_MODELE.User;
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
    const masque = masquer(ligne, colonnesExclues('User')) as Record<string, unknown>;
    expect(masque.estOperateurPlateforme).toBe(MARQUEUR_MASQUE);
    expect(masque.motDePasse).toBe(MARQUEUR_MASQUE);
    // Ce qui n'est pas sensible reste lisible · un journal qui masque tout ne
    // sert plus de chemin de révision (AUDCIF art. 22, 6°).
    expect(masque.email).toBe('jean@asbl.cd');
    expect(masque.role).toBe('COMPTABLE');
  });

  it('masque à toute profondeur, filtre d’une opération de masse compris', () => {
    const masse = {
      operation: 'updateMany',
      filtre: { tenantId: 'd-1', estOperateurPlateforme: false },
      resultat: { count: 3 },
    };
    const masque = masquer(masse, colonnesExclues('User')) as {
      filtre: Record<string, unknown>;
    };
    expect(masque.filtre.estOperateurPlateforme).toBe(MARQUEUR_MASQUE);
    expect(masque.filtre.tenantId).toBe('d-1');
  });

  // ══════════════════════════════════════════════════════════════════════
  // LE REGISTRE DU PERSONNEL · les premières données personnelles du dépôt
  // ══════════════════════════════════════════════════════════════════════
  //
  // La liste fermée valait pour `User` seul. Trois modèles s'y ajoutent, et
  // ils posent un problème d'une autre nature : sur `User`, l'exclusion
  // protège le LOGICIEL (le compte de l'exploitant) ; ici elle protège une
  // PERSONNE. Le même mécanisme, et la même exigence · toute colonne doit
  // être classée, et une colonne ajoutée demain fait tomber le test.

  const ADMISES_PAR_MODELE: Record<string, string[]> = {
    Salarie: [
      'id',
      'tenantId',
      'tenant',
      'matricule',
      'nom',
      'postNom',
      'prenoms',
      'sexe',
      // Faits de GESTION, pas données de la personne · ce sont eux qu'un
      // inspecteur du travail vient vérifier.
      'aptitudeConstateeLe',
      'aptitudeConstateePar',
      'aptitudeProvisoire',
      'declarationEngagementLe',
      'declarationDepartLe',
      'actif',
      'contrats',
      'enfants',
      'bulletins',
      // Le lien vers ses avances · la relation, jamais un montant.
      'avances',
      // Ligne sage-l5 · sa reprise de congés et ses congés · les relations seules.
      'repriseConges',
      'conges',
      // Ligne sage-l5 · ses absences (fonction 78) · la relation seule.
      'absences',
      // Ligne sage-l5 · fonction 75 · le mode de paiement CONVENU est un fait
      // de gestion (art. 98, al. 2), admis ; RIB, lignes de paiement et
      // d'ordre de virement · les relations seules.
      'modePaiement',
      'ribs',
      'lignesPaiement',
      'ordresVirement',
      // Ligne sage-l5 · fonction 88 · la répartition analytique, la relation seule.
      'repartitionsAnalytiques',
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
      // LA CLASSE RESTE LISIBLE, ET C'EST DÉLIBÉRÉ. Elle commande le MINIMUM
      // légal de la rémunération : rétrograder quelqu'un d'une classe après
      // coup abaisse le minimum qui lui est opposable, et c'est exactement la
      // retouche qu'un journal d'audit existe pour rendre visible. La masquer
      // protégerait la manipulation, pas la personne.
      'classeProfessionnelle',
      // L'UNITÉ, PAS LE MONTANT. Savoir qu'une rémunération est stipulée au
      // mois ne dit rien de ce qu'elle vaut · le montant, lui, est masqué.
      // Et sans l'unité, un changement de classe au journal se lirait sans
      // qu'on puisse voir s'il s'accompagne d'un changement de base.
      'periodiciteRemuneration',
      // LA MONNAIE, PAS LE MONTANT (audit final F226) · même raison que
      // l'unité. Elle décide si le minimum se contrôle · un contrat en francs
      // déclaré en dollars y échappe, et c'est ce que le journal doit montrer.
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
      // A8 · bulletin du mois ou décompte final · aucun montant, c'est ce que
      // la ligne EST, et le journal doit pouvoir dire qu'un décompte a été émis.
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
      // P9 · quelle écriture de paie porte le bulletin. Aucun montant ·
      // c'est le lien que le journal doit montrer quand il se pose ou se défait.
      'ecritureId',
      'ecriture',
      // C2 · quelle écriture reprend en négatif le bulletin annulé. Aucun
      // montant · le lien que le journal doit montrer quand il se pose.
      'ecritureNegatifId',
      'ecritureNegatif',
      // Les retenues d'avance portées par le bulletin · la relation seule.
      'retenuesAvance',
      // Ligne sage-l5 · les congés dont il porte l'allocation · la relation seule.
      'allocationsConge',
      // Ligne sage-l5 · les paiements qui ont versé son net · la relation seule.
      'lignesPaiement',
    ],
    // LIGNE SAGE-L5 · LE CONGÉ DU SALARIÉ · le journal dit ses dates, son
    // rattachement à un bulletin, sa prise au-delà du solde et son
    // annulation ; le taux journalier et la moyenne des primes sont masqués,
    // comme la rémunération du contrat.
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
    // LIGNE SAGE-L5 · L'ABSENCE DU SALARIÉ · le journal dit ses dates et son
    // annulation ; la nature (relecture, mineur 4), la pièce (certificat
    // médical) et l'observation sont masquées.
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
      // Étape 3 · les indemnités de la Caisse déclarées sur l'arrêt · la relation seule.
      'indemnitesCaisse',
    ],
    // RELECTURE L5, MINEUR 4 · L'INDEMNITÉ DE LA CAISSE · le journal dit son
    // arrêt, son mois, son traitement et son annulation ; le montant et la
    // pièce sont masqués, comme la rémunération.
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
    // L'AVANCE AU SALARIÉ · le journal dit qu'elle existe, de quel type, à
    // quelle date et sur quelle pièce ; le montant et l'objet sont masqués,
    // comme la rémunération du contrat.
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
      // La saisie-arrêt notifiée (passe O4-C2) · l'acte, son greffe, le
      // destinataire des versements et la mainlevée. Aucun montant · ce sont
      // les références qu'un contrôle de l'employeur demande (AUPSRVE, art. 188).
      'referenceActe',
      'greffe',
      'destinataire',
      'dateFin',
      'creePar',
      'createdAt',
      'retenues',
    ],
    // LIGNE SAGE-L5, FONCTION 75 · LE RIB D'UN SALARIÉ · le journal dit qu'il
    // a changé, qui l'a changé et quand, la banque et la devise ; les
    // numéros, le titulaire et le commentaire sont masqués.
    RibSalarie: ['id', 'tenantId', 'tenant', 'salarieId', 'salarie', 'banque', 'devise', 'estPrincipal', 'createdAt'],
    // LE PAIEMENT DES SALAIRES · identifiable (mois, mode, journal, pièce,
    // ordre, annulation) ; le total et le billetage sont masqués.
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

  it.each(Object.keys(ADMISES_PAR_MODELE))(
    'classe chaque colonne de %s, sans exception ni oubli',
    (modele) => {
      const exclues = COLONNES_EXCLUES_PAR_MODELE[modele] ?? [];
      expect([...colonnesDuModele(modele)].sort()).toEqual(
        [...ADMISES_PAR_MODELE[modele], ...exclues].sort(),
      );
    },
  );

  it('LE JOURNAL DIT QUI, PAS QUOI · un salarié reste identifiable, sa vie non', () => {
    // Les deux moitiés de l'exigence, dans un seul test, parce qu'elles se
    // contredisent si on les tient séparément : tout masquer rend le journal
    // inutile comme chemin de révision, ne rien masquer en fait un fichier de
    // personnel ouvert à tout le dossier et conservé bien plus longtemps que
    // la fiche.
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
    const m = masquer(ligne, colonnesExclues('Salarie')) as Record<string, unknown>;
    // QUI · la ligne reste désignable.
    expect(m.nom).toBe('Mukendi');
    expect(m.matricule).toBe('M-014');
    expect(m.sexe).toBe('FEMININ');
    expect(m.actif).toBe(true);
    // QUOI · rien de ce qui décrit la personne.
    for (const champ of [
      'nationalite',
      'dateNaissance',
      'nomConjoint',
      'numeroAffiliationCnss',
      'lieuNaissance',
    ]) {
      expect(m[champ]).toBe(MARQUEUR_MASQUE);
    }
    // La CLÉ survit au masquage · savoir QUE la date de naissance a changé
    // fait partie de la trace.
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
    const m = masquer(ligne, colonnesExclues('ContratTravail')) as Record<string, unknown>;
    expect(m.remunerationBase).toBe(MARQUEUR_MASQUE);
    expect(m.avantagesConvenus).toBe(MARQUEUR_MASQUE);
    // Le type et la date font la requalification · les masquer viderait le
    // journal de ce qu'on vient précisément y chercher.
    expect(m.type).toBe('DUREE_DETERMINEE');
    expect(m.emploiPermanent).toBe(false);
  });

  it('RELECTURE L5, MINEUR 4 · la nature d’une absence et l’indemnité de la Caisse ne se lisent pas au journal', () => {
    const absence = masquer(
      { id: 'a-1', salarieId: 's-1', nature: 'MATERNITE', du: new Date('2026-08-03'), au: new Date('2026-11-08'), piece: 'Certificat' },
      colonnesExclues('AbsenceSalarie'),
    ) as Record<string, unknown>;
    expect([absence.nature, absence.piece]).toEqual([MARQUEUR_MASQUE, MARQUEUR_MASQUE]);
    expect(absence.salarieId).toBe('s-1');
    const indemnite = masquer(
      { id: 'i-1', absenceId: 'a-1', mois: '2026-08', montant: 180_000, traitement: 'SUBROGATION', piece: 'Bordereau CNSS 118' },
      colonnesExclues('IndemniteCaisseAbsence'),
    ) as Record<string, unknown>;
    expect([indemnite.montant, indemnite.piece]).toEqual([MARQUEUR_MASQUE, MARQUEUR_MASQUE]);
    expect([indemnite.mois, indemnite.traitement]).toEqual(['2026-08', 'SUBROGATION']);
  });

  it('UN ENFANT NE SE NOMME PAS AU JOURNAL · seul son rattachement y reste', () => {
    const m = masquer(
      { id: 'e-1', salarieId: 's-1', nom: 'Mukendi', prenoms: 'Grace', dateNaissance: new Date('2019-02-01') },
      colonnesExclues('EnfantACharge'),
    ) as Record<string, unknown>;
    expect(m.salarieId).toBe('s-1');
    expect(m.nom).toBe(MARQUEUR_MASQUE);
    expect(m.prenoms).toBe(MARQUEUR_MASQUE);
    expect(m.dateNaissance).toBe(MARQUEUR_MASQUE);
  });

  it('L’EXCLUSION EST PAR MODÈLE · « nom » reste lisible ailleurs', () => {
    // `nom` est exclu sur `EnfantACharge` et ADMIS sur `Salarie`. Une
    // exclusion par NOM DE CHAMP, et non par modèle, effacerait le nom du
    // salarié lui-même, et le journal ne dirait plus de qui il parle.
    expect(estChampSensible('nom', colonnesExclues('EnfantACharge'))).toBe(true);
    expect(estChampSensible('nom', colonnesExclues('Salarie'))).toBe(false);
    expect(estChampSensible('nom', colonnesExclues('Tiers'))).toBe(false);
  });

  it('n’exclut rien sur un modèle qui n’a pas de liste', () => {
    // La liste est nommée modèle par modèle · `estOperateurPlateforme` n'est
    // pas un nom réservé, c'est une colonne de `User`.
    expect(colonnesExclues('Compte').size).toBe(0);
    expect(estChampSensible('estOperateurPlateforme')).toBe(false);
    expect(estChampSensible('estOperateurPlateforme', colonnesExclues('User'))).toBe(true);
  });
});
