export type EvenementDoubleAuth = 'ACTIVEE' | 'RETIREE' | 'CODES_SECOURS_REGENERES';
export declare function avisDoubleAuth(evenement: EvenementDoubleAuth, compte: {
    email: string;
    instant: Date;
}): {
    sujet: string;
    corps: string;
};
