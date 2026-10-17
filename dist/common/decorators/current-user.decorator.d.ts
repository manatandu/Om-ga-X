export interface AuthenticatedUser {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
    doubleAuthentificationActive?: boolean;
    restreindreFonctions?: boolean;
    fonctionsAutorisees?: string[];
    restreindreJournaux?: boolean;
    journauxAutorises?: string[];
    doitChangerMotDePasse?: boolean;
    referentiel?: string;
    licence?: import('@prisma/client').Licence | null;
    estOperateurPlateforme?: boolean;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
