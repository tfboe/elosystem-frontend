import * as JsZip from 'jszip';
import {assert, default as ParseError} from './parse-error';
import TournamentInfo, {
    Competition,
    formatDate,
    formatDateTime,
    Game,
    Match,
    Phase,
    PlayerInfo,
    PlayerInfoCollection,
    Ranking,
    RankingType,
    RankingTypeString,
    Team,
    Tournament
} from '../tournament';
import { tfboe } from '../rankingSystems';

let $ = require("jquery");

function parse(file: File): Promise<TournamentInfo> {
    let jszip = new JsZip();
    return jszip.loadAsync(file)
        .then(zip => {
            return zip.file("outfrom.xml").async("text").then(parseXml).then(parseTournamentInfo);
        });
}

function parseXml(text: string): XMLDocument {
    return (new DOMParser()).parseFromString(text, "text/xml");
}

function parseTournamentInfo(xmlDoc: XMLDocument): TournamentInfo {
    assert(xmlDoc.childElementCount === 1, "Wrong number of root elements");
    let ffft = xmlDoc.firstElementChild;
    let tournamentInfo = parseFFFT(ffft);
    return tournamentInfo;
}

function parseFFFT(ffft: Element): TournamentInfo {
    assert(ffft.nodeName === 'ffft', "Wrong root element");
    //assert(ffft.childElementCount === 8 || ffft.childElementCount === 9, "Wrong number of ffft children");
    let child = ffft.firstElementChild;
    assert(child.nodeName === 'creationDate', "Wrong 1st ffft child");
    child = child.nextElementSibling;
    assert(child.nodeName === 'fastVersion', "Wrong 2nd ffft child");
    child = child.nextElementSibling;
    assert(child.nodeName === 'fastBuild', "Wrong 3rd ffft child");
    child = child.nextElementSibling;
    let count = 4;
    if (child.nodeName === 'Uids') {
        child = child.nextElementSibling;
        count++;
    }
    let playerInfos = {};
    if (child.nodeName === 'registeredPlayers') {
        playerInfos = parseRegisteredPlayers(child);
        child = child.nextElementSibling;
        count++;
    }
    if (child.nodeName === 'temporaryLicensePeople') {
        parseTemporaryLicensed(child, playerInfos);
        child = child.nextElementSibling;
        count++;
    }
    if (child.nodeName === 'membersToUpdate') {
        child = child.nextElementSibling;
        count++;
    }
    if (child.nodeName === 'membersNeedRegularization') {
        child = child.nextElementSibling;
        count++;
    }
    assert(child.nodeName === 'tournaments', "Wrong " + count + "th ffft child");
    assert(child.childElementCount === 1, "At the moment we only support one tournament per file!");
    return parseTournament(child.firstElementChild, playerInfos);
}

function parseRegisteredPlayers(el: Element): PlayerInfoCollection {
    let res: PlayerInfoCollection = {};
    for (let info of getElementsByName(el, "playerInfos")) {
        if (info.childElementCount === 1) {
            let p = parsePlayer(info.firstElementChild, true);
            res[p.tmpId] = p;
        } else {
            let id = parseInt(getElementByName(info, "playerId").textContent);
            assert(!(id in res), "double id " + id + " in registeredPlayers");
            res[id] = new PlayerInfo();
            res[id].tmpId = id;
            res[id].itsfLicenseNumber = parseLicenseNumber(getElementByName(info, "noLicense").textContent);
        }
    }
    return res;
}

function parseLicenseNumber(str: string): number {
    return parseInt(str)
}

function parseTemporaryLicensed(el: Element, playerInfos: PlayerInfoCollection) {
    for (let child of getElements(el, (x) => true)) {
        switch (child.nodeName) {
            case "ffftMember":
                parseFFFTMember(child, playerInfos);
                break;
            case "itsfMember":
                parseITSFMemberInPlayerInfos(child, playerInfos);
                break;
            default:
                throw new ParseError("Child elements of temporaryLicensePeople must be ffftMember or itsfMember");
        }
    }
}

function parseFFFTMember(el: Element, playerInfos: PlayerInfoCollection) {
    assert(el.nodeName === 'ffftMember', "Wrong ffftMember type");
    parseITSFMemberInPlayerInfos(getElementByName(el, "itsfMember"), playerInfos);
}

function parseITSFMemberInPlayerInfos(el: Element, playerInfos: PlayerInfoCollection) {
    let p = parseITSFMember(el);
    playerInfos[p.tmpId] = p;
}

function getFederationMemberFromITSFMember(el: Element): Element {
    assert(el.nodeName === 'itsfMember', "Wrong itsfMember type");
    assert(el.childElementCount === 1, "Wrong number of itsfMember children");
    return el.firstElementChild;
}

function parseITSFMember(el: Element): PlayerInfo {
    let federationMember = getFederationMemberFromITSFMember(el);
    assert(federationMember.nodeName === "federationMember", "Wrong itsfMember child type");
    let player = getElementByName(federationMember, "player");
    return parsePlayer(player, true);
}

function parsePlayer(player: Element, allowBirthDateNull: boolean = false): PlayerInfo {
    assert(player.nodeName === 'player', "Wrong player type");
    let id = parseInt(getElementByName(player, "id").textContent);
    let info = new PlayerInfo();
    info.tmpId = id;
    let person = getElementByName(player, "person");
    info.firstName = getElementByName(person, "firstName").textContent;
    info.lastName = titleCase(getElementByName(person, "lastName").textContent);
    let dateEl = getElementByName(person, "birthDate", allowBirthDateNull);
    let dateStr = "01/01/1900";
    if (dateEl !== null) {
        dateStr = dateEl.textContent;
    }
    info.setBirthday(formatDate(parseDate(dateStr)));
    return info;
}

function getElementByName(parent: Element, name: string, allowNull = false): Element {
    let elements = getElementsByName(parent, name);
    assert(elements.length <= 1, "Too many elements " + name + " in element " + parent.tagName);
    if (!allowNull) {
        assert(elements.length > 0, "Couldn't find element " + name + " in element " + parent.tagName + " " + parent.getAttribute("id"));

    } else if (allowNull && elements.length === 0) {
        return null;
    }
    return elements[0];
}

function getElements(parent: Element, prop: ((el: Element) => boolean)): Element[] {
    let res = [];
    let child = parent.firstElementChild;
    while (child !== null) {
        if (prop(child)) {
            res.push(child);
        }
        child = child.nextElementSibling;
    }
    return res;
}

function getElementsByName(parent: Element, name: string): Element[] {
    return getElements(parent, (el) => el.tagName === name);
}

function getElementByNameUnsafe(parent: Element, name: string): Element {
    let child = parent.firstElementChild;
    while (child !== null) {
        if (child.tagName === name) {
            return child;
        }
        child = child.nextElementSibling;
    }
    throw Error("Couldn't find element " + name + " in element " + parent.tagName);
}

function parseDateTime(dateTime: string): Date {
    let parts = dateTime.split(" ");
    assert(parts.length === 2, "Wrongly formatted dateTime: " + dateTime);
    let res = parseDate(parts[0]);
    let timeParts = parts[1].split(":");
    assert(timeParts.length === 3, "Wrongly formatted time: " + dateTime);
    res.setHours(parseInt(timeParts[0]));
    res.setMinutes(parseInt(timeParts[1]));
    res.setSeconds(parseInt(timeParts[2]));
    return res;
}

function parseDate(date: string): Date {
    let parts = date.split("/");
    assert(parts.length === 3, "Wrongly formatted date: " + date);
    let res = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    assert(!isNaN(res.getDate()), "Date not parsable: " + date);
    return res;
}

function parseTournament(tournament: Element, playerInfos: PlayerInfoCollection): TournamentInfo {
    assert(tournament.nodeName === 'tournament', "Wrong tournament element");
    assert(tournament.hasAttribute('id'), "Tournament has no id");
    let res = new TournamentInfo();
    res.tournament = new Tournament();
    res.tournament.name = getElementByName(tournament, "name").textContent;
    let beginDate = getElementByName(tournament, "beginDate").textContent;
    let endDate = getElementByName(tournament, "endDate").textContent;
    res.tournament.userIdentifier = res.tournament.name + "_" + tournament.getAttribute('id') + "_" + beginDate + "_" +
        endDate;
    let timezone_el = getElementByName(tournament, "timeZone", true);
    let timezone = "";
    if (timezone_el === null) {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } else {
        timezone = timezone_el.textContent;
    }
    res.tournament.startTime = formatDateTime(parseDate(beginDate), timezone);
    res.tournament.endTime = formatDateTime(parseDate(beginDate), timezone);
    res.tournament.finished = true;
    res.tournament.competitions = [];
    res.playerInfos = playerInfos;

    let div = document.getElementById("parsing-result");
    let divCompetitionTable = document.createElement("div");
    div.appendChild(divCompetitionTable);
    let competitionTable = document.createElement("table");
    let headers = document.createElement("tr");
    divCompetitionTable.appendChild(headers);
    divCompetitionTable.appendChild(competitionTable);
    let competitionHeader = document.createElement("th");
    competitionHeader.innerText = "Competition";
    headers.appendChild(competitionHeader);
    let categoryHeader = document.createElement("th");
    categoryHeader.innerText = "Category";
    headers.appendChild(categoryHeader);
    for (let el of getElementsByName(tournament, "competition")) {
        let competition = parseCompetition(el, timezone, res.playerInfos, res.tournament, competitionTable);
        if (competition !== null) {
            res.tournament.competitions.push(competition);
        }
    }
    return res;
}

function createCategoryDropdown(categoryOptions: string[], competition: Competition): HTMLSelectElement {
    let categoryDropdown = document.createElement("select");
    for (let option of categoryOptions) {
        let optionElement = document.createElement("option");
        optionElement.value = option;
        optionElement.innerText = option;
        categoryDropdown.appendChild(optionElement);
    }
    categoryDropdown.onchange = function() {
        let value = categoryDropdown.value;
        if (value === "Not Rated") {
            competition.rankingSystems = [];
        } else {
            competition.rankingSystems = [tfboe(value as RankingType)];
        }
    };
    return categoryDropdown;
}

function parseCompetition(competition: Element, timezone: string, playerInfos: PlayerInfoCollection,
                          tournament: Tournament, competitionTable: HTMLTableElement): Competition {
    assert(competition.nodeName === 'competition', "Wrong competition element");
    let linkToPhaseId = getElementByName(competition, "linkToPhaseId", true);
    assert(linkToPhaseId === null || linkToPhaseId.textContent === "0",
        "We don't support Multigroups yet!");
    let res = new Competition();
    res.name = getCompetitionName(competition);
    res.rankingSystems = [];
    res.startTime = formatDateTime(parseDateTime(getElementByName(competition, "beginDate").textContent),
        timezone);
    res.endTime = formatDateTime(parseDateTime(getElementByName(competition, "endDate").textContent), timezone);
    switch (getElementByName(competition, "type").textContent) {
        case "SIMPLE":
            res.teamMode = "SINGLE";
            break;
        case "DOUBLE":
            res.teamMode = "DOUBLE";
            break;
        case "DYP":
            res.teamMode = "DYP";
            break;
        case "FORMATION":
            //team event we do not parse that yet!
            return null;
        default:
            throw new ParseError("The type field of a competition must be SIMPLE, DOUBLE, DYP, OR FORMATION");
    }

    let row = document.createElement("tr");
    competitionTable.appendChild(row);
    let competitionEntry = document.createElement("td");
    competitionEntry.innerText = res.name;
    row.appendChild(competitionEntry);
    let categoryEntry = document.createElement("td");

    let categoryOptions = [
        "Not Rated",
        RankingType.OpenSingle,
        RankingType.OpenDouble,
        RankingType.WomenSingle,
        RankingType.WomenDouble,
        RankingType.JuniorSingle,
        RankingType.JuniorDouble,
        RankingType.SeniorSingle,
        RankingType.SeniorDouble,
        RankingType.Mixed,
        RankingType.Classic
    ];

    let categoryDropdown = createCategoryDropdown(categoryOptions, res);
    categoryEntry.appendChild(categoryDropdown);
    row.appendChild(categoryEntry);
    let rankingType = getRankingType(competition);
    if (rankingType !== null) {
        let rankingSystemId = tfboe(rankingType);
        if (rankingSystemId != null) {
            res.rankingSystems = [rankingSystemId];
            categoryDropdown.selectedIndex = categoryOptions.indexOf(rankingType);
        }
    }
    if (res.rankingSystems.length === 0) {
        categoryDropdown.selectedIndex = 0;
    }

    let rankingSystem = getElementByName(competition, "rankingSystem", true);
    //default if nothing is given
    res.gameMode = "OFFICIAL";
    if (rankingSystem !== null) {
        switch (rankingSystem.textContent) {
            case "CLASSIC":
                res.gameMode = "CLASSIC";
                break;
            case "SPEED_BALL":
                res.gameMode = "SPEEDBALL";
                break;
            case "OFFICIAL":
                res.gameMode = "OFFICIAL";
                break;
            default:
                throw new ParseError(
                    "The rankingSystem field of a competition must be CLASSIC, SPEED_BALL or OFFICIAL");
        }
    }
    switch (getElementByName(competition, "tableType").textContent) {
        case "MULTITABLE":
            res.table = "MULTITABLE";
            break;
        case "GARLANDO":
            res.table = "GARLANDO";
            break;
        case "LEONHART":
            res.table = "LEONHART";
            break;
        case "TORNADO":
            res.table = "TORNADO";
            break;
        case "ROBERTO_SPORT":
            res.table = "ROBERTO_SPORT";
            break;
        case "BONZINI":
            res.table = "BONZINI";
            break;
        default:
            throw new ParseError("The tableType field of a competition must be GARLANDO, LEONHART, TORNADO, " +
                "ROBERTO_SPORT, and/or BONZINI");
    }

    res.teams = [];
    let mastersNumber = parseInt(getElementByName(competition, "mastersNr").textContent);
    let teamMap = {};
    for (let el of getElementsByName(competition, "competitionTeam")) {
        res.teams.push(parseTeam(el, playerInfos, mastersNumber, teamMap));
    }

    res.phases = [];
    let phases = getElementsByName(competition, "phase");
    for (let el of phases) {
        res.phases.push(parsePhase(el, phases.length, timezone, teamMap, tournament));
    }

    /*
    // buttons for selecting non-playing participants
    let nonPlayingParticipantsButtonEntry = document.createElement("td");
    let nonPlayingParticipantsButton = document.createElement("button");
    nonPlayingParticipantsButtonEntry.appendChild(nonPlayingParticipantsButton);
    nonPlayingParticipantsButton.type = "button";
    nonPlayingParticipantsButton.innerText = "Specify non-playing participants";
    let additionalRow = document.createElement("tr");
    let fullAdditionalRow = document.createElement("td");
    fullAdditionalRow.colSpan = 3;
    additionalRow.append(fullAdditionalRow);
    competitionTable.append(additionalRow);
    nonPlayingParticipantsButton.onclick = function() {
        fullAdditionalRow.innerHTML = "";
        let teamsTable = document.createElement("table");
        fullAdditionalRow.appendChild(teamsTable);
        for (let team of res.teams) {
            let teamRow = document.createElement("tr");
            teamsTable.append(teamRow);
            let teamName = document.createElement("td");
        }
    };
    row.appendChild(nonPlayingParticipantsButtonEntry);*/

    return res;
}

function getCompetitionName(competition: Element): string {
    let nameElement = getElementByName(competition, "name", true);
    if (nameElement !== null) {
        //has a name;
        return nameElement.textContent;
    }
    let category = "Open";
    switch (getElementByName(competition, "disabledOnly").textContent) {
        case "true":
            category = "Disabled";
            break;
        case "false":
            let categoryElement = getElementByName(competition, "category", true);
            if (categoryElement !== null) {
                switch (categoryElement.textContent) {
                    case "J":
                        category = "Junior";
                        break;
                    case "V":
                        category = "Senior";
                        break;
                    default:
                        throw new ParseError("The category of a competition must either be J or V");
                }
            }
            let sexElement = getElementByName(competition, "sex", true);
            if (sexElement !== null) {
                if (categoryElement !== null) {
                    throw new ParseError("Tournaments with a category and a sex are at the moment not possible");
                }
                switch (sexElement.textContent) {
                    case "F":
                        category = "Women";
                        break;
                    case "M":
                        category = "Men";
                        break;
                    default:
                        throw new ParseError("The sex of a competition must either be F or M");
                }
            }
            if (categoryElement === null && sexElement === null) {
                //check for mixed
                switch (getElementByName(competition, "isMixed").textContent) {
                    case "true":
                        category = "Mixed";
                        break;
                    case "false":
                        break;
                    default:
                        throw new ParseError("The isMixed field must either be true or false");
                }
            }
            break;
        default:
            throw new ParseError("The disabledOnly field must either be true or false");
    }

    let type = "";
    switch (getElementByName(competition, "type").textContent) {
        case "SIMPLE":
            type = "Singles";
            break;
        case "DOUBLE":
            type = "Doubles";
            break;
        case "DYP":
            type = "D.Y.P";
            break;
        default:
            throw new ParseError("The type field of a competition must be SIMPLE, DOUBLE or DYP");
    }

    //check authorized series only
    let authorizedSeriesEl = getElementByName(competition, "authorizedSeries", true);
    let authorizedSeries = "";
    if (authorizedSeriesEl !== null) {
        let series = authorizedSeriesEl.textContent.split(",");
        assert(series.length < 5, "At least one series must be unselected!");
        let append = (x: string) => {
            if (authorizedSeries !== "") {
                authorizedSeries += "/";
            }
            authorizedSeries += x;
        };
        for (let s of series) {
            switch (s) {
                case "0":
                    append("Pro-Elite");
                    break;
                case "1":
                    append("Elite");
                    break;
                case "2":
                    append("A");
                    break;
                case "3":
                    append("B");
                    break;
                case "4":
                    append("C");
                    break;
                default:
                    throw new ParseError("The authorizedSeries field can only contain 0, 1, 2, 3, and/or 4");
            }
        }
    }
    let name = category + " ";
    if (authorizedSeries !== "" && category == "Open") {
        name = "";
    }
    name += type;
    if (authorizedSeries !== "") {
        name += " - " + authorizedSeries;
    }
    return name;
}

function getRankingType(competition: Element): null | RankingType {
    let nameElement = getElementByName(competition, "name", true);
    if (nameElement !== null) {
        //has a name => we don't rank it
        return null;
    }
    let category = "O";
    switch (getElementByName(competition, "disabledOnly").textContent) {
        case "true":
            //we don't rank disabled
            return null;
        case "false":
            let categoryElement = getElementByName(competition, "category", true);
            if (categoryElement !== null) {
                switch (categoryElement.textContent) {
                    case "J":
                        category = "J";
                        break;
                    case "V":
                        category = "S";
                        break;
                    default:
                        throw new ParseError("The category of a competition must either be J or V");
                }
            }
            let sexElement = getElementByName(competition, "sex", true);
            if (sexElement !== null) {
                if (categoryElement !== null) {
                    throw new ParseError("Tournaments with a category and a sex are at the moment not possible");
                }
                switch (sexElement.textContent) {
                    case "F":
                        category = "W";
                        break;
                    case "M":
                        // we rank men events as open for now
                        category = "O";
                        break;
                    default:
                        throw new ParseError("The sex of a competition must either be F or M");
                }
            }
            if (categoryElement === null && sexElement === null) {
                //check for mixed
                switch (getElementByName(competition, "isMixed").textContent) {
                    case "true":
                        return RankingType.Mixed;
                    case "false":
                        break;
                    default:
                        throw new ParseError("The isMixed field must either be true or false");
                }
            }
            break;
        default:
            throw new ParseError("The disabledOnly field must either be true or false");
    }

    let type = "";
    switch (getElementByName(competition, "type").textContent) {
        case "SIMPLE":
            type = "S";
            break;
        case "DOUBLE":
            type = "D";
            break;
        case "DYP":
            // we don't rank DYP for now
            return null;
        case "FORMATION":
            // we don't rank team events
            return null;
        default:
            throw new ParseError("The type field of a competition must be SIMPLE, DOUBLE, DYP, or FORMATION");
    }

    //check authorized series only
    let authorizedSeriesEl = getElementByName(competition, "authorizedSeries", true);
    if (authorizedSeriesEl !== null) {
        // we don't rank authorizedSeries at the moment
        return null;
    }

    let rankingSystem = getElementByName(competition, "rankingSystem", true);
    if (rankingSystem !== null) {
        switch (rankingSystem.textContent) {
            case "OFFICIAL":
                //we do nothing
                break
            case "CLASSIC":
                // we only rank open double
                if (type === "D" && category === "O") {
                    return RankingType.Classic;
                } else {
                    return null;
                }
            default:
                // all other rankingSystems are not ranked
                return null;
        }
    }

    switch (type) {
        case "S":
            switch (category) {
                case "O":
                    return RankingType.OpenSingle;
                case "W":
                    return RankingType.WomenSingle;
                case "J":
                    return RankingType.JuniorSingle;
                case "S":
                    return RankingType.SeniorSingle;
                default:
                    throw new ParseError("Couldn't parse competition category correctly!");
            }
        case "D":
            switch (category) {
                case "O":
                    return RankingType.OpenDouble;
                case "W":
                    return RankingType.WomenDouble;
                case "J":
                    return RankingType.JuniorDouble;
                case "S":
                    return RankingType.SeniorDouble;
                default:
                    throw new ParseError("Couldn't parse competition category correctly!");
            }
        default:
            throw new ParseError("Couldn't parse competition type correctly!");
    }
}


function titleCase(str: string): string {
    let f = function (t: string) {
        return t.toUpperCase()
    };
    return (" " + str).toLowerCase().replace(/[ -]\S/g, f).trim();
}

function parseTeam(team: Element, playerInfos: PlayerInfoCollection, mastersNumber: number,
                   teamMap: { [key: number]: Team }): Team {
    let res = new Team();
    res.rank = 1; //TODO
    res.startNumber = parseInt(getElementByName(team, "noTeam").textContent);
    let id = parseInt(getElementByName(team, "id").textContent);
    teamMap[id] = res;
    let isMaster = getElementByName(team, "isMaster").textContent;
    if (isMaster === "false") {
        res.startNumber += mastersNumber;
    } else if (isMaster !== "true") {
        throw new ParseError("The field isMaster of a team must either be true or false");
    }
    res.players = [];
    let t = getElementByName(team, "team", true);
    if (t !== null) {
        let i = 1;
        let keyFn = () => "player" + i + "Id";
        let elFn = () => getElementByName(t, keyFn(), true);
        let el = elFn();
        while (el !== null) {
            let id = parseInt(el.textContent);
            assert(id in playerInfos, "id " + id + " is missing in playerInfos");
            res.players.push(id);
            i += 1;
            el = elFn();
        }
    } else {
        res.name = "absent";
    }

    return res;
}

function parsePhase(phase: Element, numPhases: number, timezone: string,
                    teamMap: { [key: number]: Team }, tournament: Tournament): Phase {
    assert(phase.nodeName === 'phase', "Wrong phase element");
    assert(getElementByName(phase, "isMaster").textContent === "false",
        "We don't support Master phases yet!");
    assert(numPhases <= 2, "At the moment not more than 2 phases are supported!");
    let groupNumber = getElementByName(phase, "groupNumber", true);
    if (groupNumber !== null) {
        assert(parseInt(groupNumber.textContent) <= 1, "At the moment no groups are supported!");
    }
    assert(numPhases <= 2, "At the moment not more than 2 phases are supported!");
    let res = new Phase();
    let isQualification = false;
    switch (getElementByName(phase, "isQualification").textContent) {
        case "true":
            isQualification = true;
            break;
        case "false":
            isQualification = false;
            break;
        default:
            throw new Error("The field isQualification of a phase must be either true or false");
    }
    res.organizingMode = isQualification ? "QUALIFICATION" : "ELIMINATION";
    res.name = isQualification ? "Qualification" : "Elimination";
    res.nextPhaseNumbers = [];
    if (isQualification || numPhases === 1) {
        res.phaseNumber = 1;
        if (numPhases === 2) {
            res.nextPhaseNumbers = [2];
        }
    } else {
        res.phaseNumber = 2;
    }
    res.rankings = [];
    let phaseRankings = getElementByName(phase, "phaseRanking");
    let rankingEls = getElementsByName(phaseRankings, "ranking");
    let startNumberUniqueRankMap: { [key: number]: number } = {};
    if (rankingEls.length === 0) {
        //phase is not yet finished;
        tournament.finished = false;
    } else {
        //read rankings
        for (let el of rankingEls) {
            let ranking = new Ranking();
            ranking.uniqueRank = parseInt(getElementByName(el, "rank").textContent);
            let sub = getElementByName(el, "definitivePhaseOpponentRanking");
            ranking.rank = parseInt(getElementByName(sub, "relativeRank").textContent);
            if (ranking.rank < 1) {
                ranking.rank = ranking.uniqueRank;
            }
            let team = teamMap[parseInt(getElementByName(sub, "teamId").textContent)];
            let startNumber = team.startNumber;
            team.rank = ranking.rank;
            ranking.teamStartNumbers = [startNumber];
            startNumberUniqueRankMap[startNumber] = ranking.uniqueRank;
            res.rankings.push(ranking);
        }
    }

    let defaultScoreMode: "ONE_SET" | "BEST_OF_THREE" | "BEST_OF_FIVE" = "ONE_SET";
    let winningGames = getElementByName(phase, "winningGames", true);
    let isWinningGames = winningGames === null || winningGames.textContent === "true";
    if (isWinningGames) {
        let setsToWin = parseInt(getElementByName(phase, "winGameNumber").textContent)
        if (setsToWin === 2) {
            defaultScoreMode = "BEST_OF_THREE";
        } else if (setsToWin === 3) {
            defaultScoreMode = "BEST_OF_FIVE";
        }
    } else {
        let gamesToPlay = parseInt(getElementByName(phase, "gamesNumber").textContent)
        if (gamesToPlay >=4) {
            defaultScoreMode = "BEST_OF_FIVE";
        } else if (gamesToPlay >= 2) {
            defaultScoreMode = "BEST_OF_THREE";
        }
    }
    let defaultLoserBracketMode: "ONE_SET" | "BEST_OF_THREE" | "BEST_OF_FIVE" = "ONE_SET";
    if (isWinningGames) {
        let setsToWin = parseInt(getElementByName(phase, "loserBracketWinGameNumber").textContent)
        if (setsToWin === 2) {
            defaultLoserBracketMode = "BEST_OF_THREE";
        } else if (setsToWin === 3) {
            defaultLoserBracketMode = "BEST_OF_FIVE";
        }
    } else {
        let gamesToPlay = parseInt(getElementByName(phase, "loserBracketGamesNumber").textContent)
        if (gamesToPlay >=4) {
            defaultLoserBracketMode = "BEST_OF_FIVE";
        } else if (gamesToPlay >= 2) {
            defaultLoserBracketMode = "BEST_OF_THREE";
        }
    }

    res.matches = [];
    for (let match of getElementsByName(phase, "teamMatch")) {
        let m = parseMatch(match, timezone, teamMap, startNumberUniqueRankMap, rankingEls.length !== 0, res.rankings, defaultScoreMode, defaultLoserBracketMode);
        if (m !== null) {
            res.matches.push(m);
        }
    }
    return res;
}

function parseMatch(match: Element, timezone: string, teamMap: { [key: number]: Team },
                    startNumberUniqueRankMap: { [key: number]: number }, phaseFinished: boolean,
                    rankings: Ranking[], 
                    defaultScoreMode: "ONE_SET" | "BEST_OF_THREE" | "BEST_OF_FIVE", 
                    defaultLoserBracketMode: "ONE_SET" | "BEST_OF_THREE" | "BEST_OF_FIVE"): Match | null {
    let id2 = getElementByName(match, "team2Id", true);
    let id1 = getElementByName(match, "team1Id", true);
    let id = parseInt(match.getAttribute("id"));
    if (id1 === null || id2 === null) {
        //artificial game against nobody
        return null;
    }

    let res = new Match();
    res.matchNumber = id;
    let scheduleStart = getElementByName(match, "scheduleStart", true);
    if (scheduleStart !== null) {
        res.startTime = formatDateTime(parseDateTime(scheduleStart.textContent), timezone);
    }
    let teamA = teamMap[parseInt(id1.textContent)];
    let teamB = teamMap[parseInt(id2.textContent)];

    let checkOrAdd = function (startNumber: number) {
        if (!startNumberUniqueRankMap[startNumber]) {
            let ranking = new Ranking();
            ranking.uniqueRank = startNumber;
            ranking.rank = ranking.uniqueRank;
            ranking.teamStartNumbers = [startNumber];
            startNumberUniqueRankMap[startNumber] = startNumber;
            rankings.push(ranking);
        }
    };
    checkOrAdd(teamA.startNumber);
    checkOrAdd(teamB.startNumber);

    if (!startNumberUniqueRankMap[teamA.startNumber]) {
        throw new Error(teamA.startNumber + " does not exist in startNumberUniqueRankMap");
    }
    if (!startNumberUniqueRankMap[teamB.startNumber]) {
        throw new Error(teamB.startNumber + " does not exist in startNumberUniqueRankMap");
    }
    res.rankingsAUniqueRanks = [startNumberUniqueRankMap[teamA.startNumber]];
    res.rankingsBUniqueRanks = [startNumberUniqueRankMap[teamB.startNumber]];

    let games = getElementsByName(match, "game");

    if (games.length === 0) {
        //match not yet started
        res.games = [];
        res.played = false;
        res.result = "NOT_YET_FINISHED";
        res.resultA = 0;
        res.resultB = 0;
        res.scoreMode = "ONE_SET";
    } else {
        res.resultA = 0;
        res.resultB = 0;
        for (let game of games) {
            let resA = parseInt(getElementByName(game, "scoreTeam1").textContent);
            let resB = parseInt(getElementByName(game, "scoreTeam2").textContent);
            if (games.length === 1) {
                res.resultA = resA;
                res.resultB = resB;
            } else if (resA > resB) {
                res.resultA += 1;
            } else if (resB > resA) {
                res.resultB += 1;
            } else if (resA > 0) {
                res.resultA += 0.5;
                res.resultB += 0.5;
            }
        }
        res.played = res.resultA >= 0 && res.resultB >= 0 && teamA.players.length > 0 && teamB.players.length > 0; //otherwise it is a forfeit
        res.result = res.resultA > res.resultB ? "TEAM_A_WINS" : (res.resultB > res.resultA ? "TEAM_B_WINS" : (
            res.resultA === 0 ? "NOT_YET_FINISHED" : "DRAW"));
        if (res.resultA < 0) {
            res.resultA = 0;
        }
        if (res.resultB < 0) {
            res.resultB = 0;
        }

        let game = new Game();
        let start = getElementByName(match, "effectiveStart", true);
        if (start !== null) {
            res.startTime = formatDateTime(parseDateTime(start.textContent), timezone);
            game.startTime = res.startTime;
        }

        let end = getElementByName(match, "scheduleEnd", true);
        if (end !== null) {
            res.endTime = formatDateTime(parseDateTime(end.textContent), timezone);
            game.endTime = res.endTime;
        }
        game.gameNumber = 1;
        game.played = res.played;
        game.result = res.result;
        game.resultA = res.resultA;
        game.resultB = res.resultB;

        game.playersA = Object.assign([], teamA.players);
        game.playersB = Object.assign([], teamB.players);
        assert(!game.played || game.playersA.length === game.playersB.length,
            "We don't support games with different number of players at the moment, see match " + id);
        res.games = [game];
        if (games.length === 1) {
            res.scoreMode = "ONE_SET";
        } else {
            let maxScore = Math.max(res.resultA, res.resultB);
            if (maxScore <= 1) {
                res.scoreMode = "ONE_SET";
            } else if (maxScore == 2) {
                res.scoreMode = "BEST_OF_THREE";
            } else if (maxScore == 3) {
                res.scoreMode = "BEST_OF_FIVE";
            } else if (maxScore == 4) {
                //probably the result of a final of a double elimination tournament.
                //Since we don't know if it was Berliner Zeitmodell or not we say it is only one best of three.
                res.scoreMode = "BEST_OF_THREE";
            } else if (maxScore == 6) {
                //probably the result of a final of a double elimination tournament.
                //Since we don't know if it was Berliner Zeitmodell or not we say it is only one best of five.
                res.scoreMode = "BEST_OF_FIVE";
            } else {
                throw Error("Unsupported number of games (winner has won " + maxScore + " games!) in match " + id);
            }
        }
        if (res.scoreMode === "ONE_SET" && res.resultA + res.resultB === 1) {
            // use default scoreMode
            if (getElementByName(match, "isWinnerBracket").textContent === "false") {
                res.scoreMode = defaultLoserBracketMode;
            } else {
                res.scoreMode = defaultScoreMode;
            }
        }
    }
    return res;
}

function getPlayerNames(players: PlayerInfo[]): Promise<void> {
    return fetch('https://extranet.fast4foos.org/fast/tournament/norealm/download_out_tournament_xml.jsp?fn=outto')
        .then(function (response) {                       // 2) filter on 200 OK
            if (response.status === 200 || response.status === 0) {
                return response.blob();
            } else {
                throw new Error(response.statusText);
            }
        }).then(JsZip.loadAsync)
        .then((zip) => {
            return zip.file("outto.xml").async("text");
        }).then(parseXml).then((x: XMLDocument) => {
            let licenseMap: { [key: number]: PlayerInfo[] } = {}; // we allow multiple players with the same license
                                                                  // since it happens sometimes
            for (let player of players) {
                if (!(player.itsfLicenseNumber in licenseMap)) {
                    licenseMap[player.itsfLicenseNumber] = [];
                }
                licenseMap[player.itsfLicenseNumber].push(player);
            }
            assert(x.childElementCount === 1, "Wrong number of root elements");
            let ffft = x.firstElementChild;
            let federationPeople = getElementByName(ffft, "federationPeople");
            parseFederationPeople(federationPeople, licenseMap);
            let itsfPeople = getElementByName(ffft, "itsfPeople");
            parseItsfPeople(itsfPeople, licenseMap);
        });
}

function parseFederationPeople(el: Element, licenseMap: { [key: number]: PlayerInfo[] }) {
    for (let child of getElementsByName(el, "ffftLeague")) {
        for (let club of getElementsByName(child, "ffftClub")) {
            for (let member of getElementsByName(club, "ffftMember")) {
                parseItsfPeople(member, licenseMap);
            }
        }
    }
}

function parseItsfPeople(el: Element, licenseMap: { [key: number]: PlayerInfo[] }) {
    for (let member of getElementsByName(el, "itsfMember")) {
        let federationMember = getFederationMemberFromITSFMember(member);
        let licenseNr = parseLicenseNumber(getElementByNameUnsafe(federationMember, "noLicense").textContent);

        if (licenseNr in licenseMap) {
            let playerInfo = parsePlayer(getElementByName(federationMember, "player"), true);
            for (let player of licenseMap[licenseNr]) {
                player.firstName = playerInfo.firstName;
                player.lastName = playerInfo.lastName;
                player.setBirthday(playerInfo.birthday);
            }
        }
    }
}

export default {parse: parse, getPlayerNames: getPlayerNames};