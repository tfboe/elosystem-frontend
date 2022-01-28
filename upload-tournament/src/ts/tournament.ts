class Modes {
    gameMode?: "OFFICIAL" | "SPEEDBALL" | "CLASSIC";
    organizingMode?: "ELIMINATION" | "QUALIFICATION";
    scoreMode?: "ONE_SET" | "BEST_OF_THREE" | "BEST_OF_FIVE";
    teamMode?: "DOUBLE" | "SINGLE" | "DYP";
    table?: "MULTITABLE" | "GARLANDO" | "LEONHART" | "TORNADO" | "ROBERTO_SPORT" | "BONZINI"
}

export default class TournamentInfo {
    tournament: Tournament;
    playerInfos: PlayerInfoCollection;
}

export interface PlayerInfoCollection {
    [key: string]: PlayerInfo;
}

export class PurePlayerInfo {
    constructor(
        public firstName?: string, 
        public lastName?: string, 
        public birthday?: string, 
        public itsfLicenseNumber?: number) {}

    toString(): string {
        let res = "";
        if (this.firstName != null && this.lastName != null) {
            res = this.firstName + " " + this.lastName;
        }
        if (this.itsfLicenseNumber != null) {
            if (res !== "") {
                res += "(" + this.itsfLicenseNumber + ")";
            } else {
                res += this.itsfLicenseNumber;
            }
        }
        return res;
    }

    setBirthday(birthday: string) {
        if (birthday.slice(0, 4) === "1900") {
            birthday = "1902" + birthday.slice(4);
        }
        this.birthday = birthday;
    }
}

export class PlayerInfo extends PurePlayerInfo {
    constructor(
        public tmpId: number,
        firstName?: string, 
        lastName?: string, 
        birthday?: string, 
        itsfLicenseNumber?: number
    ) {
        super(firstName, lastName, birthday, itsfLicenseNumber);
    }
}

export class Tournament extends Modes {
    async: boolean;
    name: string;
    userIdentifier: string;
    tournamentListId?: string;
    finished?: boolean;
    startTime?: string;
    endTime?: string;
    competitions: Competition[];

    constructor() {
        super();
        this.async = true;
    }
}

export function formatDateTime(date: Date, timeZone: string) {
    return date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2)
        + " " + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2) + ":" +
        ("0" + date.getSeconds()).slice(-2) + " " + timeZone;
}

export function formatDate(date: Date) {
    return date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
}

export enum RankingType {
    OpenSingle = "Open Single",
    OpenDouble = "Open Double",
    WomenSingle = "Women Single",
    WomenDouble = "Women Double",
    JuniorSingle = "Junior Single",
    JuniorDouble = "Junior Double",
    SeniorSingle = "Senior Single",
    SeniorDouble = "Senior Double",
    Mixed = "Mixed",
    Classic = "Classic"
}

export type RankingTypeString = keyof typeof RankingType;

export class Competition extends Modes {
    name: string;
    startTime?: string;
    endTime?: string;
    teams: Team[];
    phases: Phase[];
    rankingSystems: string[];
}

export class Team {
    rank: number;
    startNumber: number;
    players: number[];
    name?: string
}

export class Phase extends Modes {
    phaseNumber: number;
    name?: string;
    startTime?: string;
    endTime?: string;
    nextPhaseNumbers: number[];
    rankings: Ranking[];
    matches: Match[];
}

export class Ranking {
    rank: number;
    uniqueRank: number;
    teamStartNumbers: number[];
    name?: string;
}

export class Match extends Modes {
    matchNumber: number;
    rankingsAUniqueRanks: number[];
    rankingsBUniqueRanks: number[];
    resultA: number;
    resultB: number;
    result: "TEAM_A_WINS" | "TEAM_B_WINS" | "DRAW" | "NOT_YET_FINISHED" | "NULLED";
    played: boolean;
    startTime?: string;
    endTime?: string;
    games: Game[];
}

export class Game extends Modes {
    gameNumber: number;
    playersA: number[];
    playersB: number[];
    resultA: number;
    resultB: number;
    result: "TEAM_A_WINS" | "TEAM_B_WINS" | "DRAW" | "NOT_YET_FINISHED" | "NULLED";
    played: boolean;
    startTime?: string;
    endTime?: string;
}