// provides functions that map ranking types to actual ranking system ids

import { RankingType } from "./tournament";

export function tfboe(rankingType: RankingType): null | string {
    switch(rankingType) {
        case RankingType.OpenSingle: return null;
        case RankingType.OpenDouble: return null;
        case RankingType.WomenSingle: return null;
        case RankingType.WomenDouble: return null;
        case RankingType.JuniorSingle: return null;
        case RankingType.JuniorDouble: return null;
        case RankingType.SeniorSingle: return null;
        case RankingType.SeniorDouble: return null;
        case RankingType.Classic: return null;
        case RankingType.Mixed: return null;
        default: return null;
    }
}