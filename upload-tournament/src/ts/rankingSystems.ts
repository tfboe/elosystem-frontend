// provides functions that map ranking types to actual ranking system ids

import { RankingType } from "./tournament";

export function tfboe(rankingType: RankingType): null | string {
    switch(rankingType) {
        case RankingType.OpenSingle: return "d08eda56-a7ee-11eb-8243-0242ac140002";
        case RankingType.OpenDouble: return "dc264cb5-a7ee-11eb-8243-0242ac140002";
        case RankingType.WomenSingle: return "e6456a1e-a7ee-11eb-8243-0242ac140002";
        case RankingType.WomenDouble: return "e8fc01a0-a7ee-11eb-8243-0242ac140002";
        case RankingType.JuniorSingle: return "edba2a8b-a7ee-11eb-8243-0242ac140002";
        case RankingType.JuniorDouble: return "f06e92ce-a7ee-11eb-8243-0242ac140002";
        case RankingType.SeniorSingle: return "f4f95737-a7ee-11eb-8243-0242ac140002";
        case RankingType.SeniorDouble: return "f7972e41-a7ee-11eb-8243-0242ac140002";
        case RankingType.Classic: return "fbb021e4-a7ee-11eb-8243-0242ac140002";
        case RankingType.WomenClassic: return "42c15405-e499-11ee-bd3f-00163e334dfa";
        case RankingType.Mixed: return "fe9448f4-a7ee-11eb-8243-0242ac140002";
        default: return null;
    }
}
