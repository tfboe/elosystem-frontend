import fastParser from './parsers/fast';
import '../css/style';
import TournamentInfo, {Match, Phase, PlayerInfo, PurePlayerInfo, Ranking, Team} from "./tournament";
import {assert} from "./parsers/parse-error";

let $ = require("jquery");

//let server = "http://elo.tfboe.org/backend/public/index.php";
let server = process.env.SERVER;


interface Parser {
    parse(file: File): Promise<TournamentInfo>
    getPlayerNames(players: PlayerInfo[]): Promise<void>
}

let p: Parser = null;

function onFileChange(evt: Event) {
    let file = (<HTMLInputElement>evt.target).files[0];
    //TODO distinguish parser depending on file
    document.getElementById("parsing-result").innerHTML = "";
    p = fastParser;
    p.parse(file).then((t: TournamentInfo) => handle(t, file)).catch(err => {
        console.log(err);
        document.getElementById("parsing-result").innerHTML = '<p class="error"> An error occurred: ' +
            err.message + '</p>';
    });
}


let token: string|null = null;

function handle(t: TournamentInfo, file: File) {
    let div = document.getElementById("parsing-result");
    let div1 = document.createElement("div");
    div1.innerText = "The tournament was parsed successfully! Please enter your credentials to upload the tournament " +
        "to the server: ";
    div.appendChild(div1);
    let nonPlayingParticipantsCheckbox = document.createElement("input");
    nonPlayingParticipantsCheckbox.type = "checkbox";
    nonPlayingParticipantsCheckbox.name = "nonPlayingParticipants";
    div.appendChild(nonPlayingParticipantsCheckbox);
    let label = document.createElement("label");
    label.htmlFor = "nonPlayingParticipants";
    label.innerText = "Has non-playing participants";
    div.appendChild(label);
    let login = document.createElement("div");
    if (token === null) {
        login.appendChild(document.createTextNode("E-Mail:"));
        let emailEl = document.createElement("input");
        emailEl.setAttribute("type", "text");
        emailEl.setAttribute("id", "email");
        emailEl.setAttribute("name", "email");
        login.appendChild(emailEl);
        login.appendChild(document.createTextNode("Password:"));
        let passwordEl = document.createElement("input");
        passwordEl.setAttribute("type", "password");
        passwordEl.setAttribute("id", "password");
        passwordEl.setAttribute("name", "password");
        login.appendChild(passwordEl);
    }
    let button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("id", "button");
    button.innerText = "Upload Tournament";
    button.onclick = () => prepareUpload(t, file, nonPlayingParticipantsCheckbox.checked);
    login.appendChild(button);
    div.appendChild(login);
    let log = document.createElement("div");
    log.setAttribute("id", "log");
    div.appendChild(log);
    let div2 = document.createElement("div2");
    let p = document.createElement("p");
    p.setAttribute("class", "error");
    p.setAttribute("id", "upload-error");
    p.style.display = "none";
    div2.appendChild(p);
    div.appendChild(div2);
}

function extractData(data: { [key: string]: { [key: string]: any } }, keys: string[]): { [key: string]: any } {
    let res = [];
    for (let x in data) {
        let tmp: { [key: string]: any } = {};
        for (let key of keys) {
            if (key in data[x]) {
                tmp[key] = data[x][key];
            }
        }
        res.push(tmp);
    }
    return res;
}

class TfboePlayerInfo extends PlayerInfo {
    id: number
}

interface SearchResult {
    [index: number]: {
        [playerId: number]: PlayerResult
    }
}

class PlayerResult extends PurePlayerInfo {
    id: number;
    firstName: string;
    lastName: string;
    birthday: string;
    itsfLicenseNumber: number;
}

function markDone<T>(x: T): T {
    document.getElementById("log").innerText += " done";
    return x;
}

function searchPlayer(data: Object): Promise<SearchResult> {
    document.getElementById("log").innerHTML += "<br>Searching players in TFBÖ-database ...";
    return apiRequest('searchPlayers', data).then(markDone);
}

function apiRequest(command: string, data: Object, type: string = "POST"): Promise<any> {
    return $.ajax({
        url: server + "/" + command,
        method: type,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        data: data !== null ? JSON.stringify(data): null,
        headers: {'Authorization': 'bearer ' + token},
        timeout: 3600000
    }).catch(catchAPIErrors).then((res: any, status: string) => {
        if (status !== "success") {
            throw new Error("Unsuccessful ajax request! " + server + "/" + command);
        }
        return res;
    });
}

interface ResolvedSearchResult {
    toUpdate: TfboePlayerInfo[],
    idMap: {[key: number]: number},
    newPlayers: PlayerInfo[],
    newPlayersWithoutName: PlayerInfo[],
    nameMap: {[key: number]: String}
}

function resolveSearchResult(data: PlayerInfo[], res: SearchResult): ResolvedSearchResult {
    let ambigousPlayers = [];
    let ambiguousItsfNumbers = [];
    let newPlayers = [];
    let newPlayersWithoutName = [];
    let toUpdate = [];
    let idMap: {[key: number]: number} = {};
    let nameMap: {[key: number]: String} = {};
    for (let index in data) {
        let found: PlayerResult[] = [];
        if (index in res) {
            found = Object.values(res[index]);
        }
        let search = data[index];
        if (found.length > 1) {
            ambigousPlayers.push(search.toString());
        } else if (found.length === 1) {
            if (found[0].itsfLicenseNumber != search.itsfLicenseNumber) {
                if (found[0].itsfLicenseNumber == null) {
                    found[0].itsfLicenseNumber = search.itsfLicenseNumber;
                    let p = found[0] as TfboePlayerInfo;
                    p.tmpId = search.tmpId;
                    toUpdate.push(p);
                } else if (search.itsfLicenseNumber != null) {
                    //both numbers are not null and not equal error
                    ambiguousItsfNumbers.push(search.toString() + " != " + found[0].itsfLicenseNumber);
                }
            }
            idMap[search.tmpId] = found[0].id;
            nameMap[found[0].id] = found[0].firstName + " " + found[0].lastName;
        } else {
            if (search.firstName == null || search.lastName == null || search.birthday == null) {
                newPlayersWithoutName.push(search);
            } else {
                newPlayers.push(search);
            }
        }
    }

    if (ambigousPlayers.length > 0) {
        throw new Error("The following players where ambiguous in the database: " + ambigousPlayers.join());
    } else if (ambiguousItsfNumbers.length > 0) {
        throw new Error("The following players have ambiguous itsf license numbers in the database: " +
            ambiguousItsfNumbers.join());
    }
    return {toUpdate: toUpdate, idMap: idMap, newPlayers: newPlayers, newPlayersWithoutName: newPlayersWithoutName, nameMap: nameMap};
}

function catchAPIErrors(e: any) {
    if (e instanceof Object) {
        if ("responseJSON" in e && "status" in e.responseJSON && e.responseJSON.status === 422) {
            throw new Error(e.responseJSON.message);
        }
    } else {
        throw new Error("Unknown Error");
    }
}

class AsyncResponse {
    type: string;
    result: string;
    "async-id": string;
}

function setPlayedCompetitionCheckbox(checkbox: HTMLInputElement, allMatches: [Match, Phase, HTMLInputElement][]) {
    let playedOne = false;
    let playedAll = true;

    for (let match of allMatches) {
        if (match[0].played) {
            playedOne = true;
        } else {
            playedAll = false;
        }
    }

    checkbox.indeterminate = false;
    if (allMatches.length === 0) {
        checkbox.checked = false;
        checkbox.disabled = true;
    } else if (playedAll) {
        checkbox.checked = true;
    } else if (playedOne) {
        checkbox.indeterminate = true;
    } else {
        checkbox.checked = false;
    }
}

function setMatchPlayed(match: Match, played: boolean) {
    match.played = played;
    for (let game of match.games) {
        game.played = played;
    }
}


function prepareUpload(t: TournamentInfo, file: File, setNonPlayingParticipants: boolean) {
    document.getElementById("file").setAttribute("disabled", "true");
    document.getElementById("button").setAttribute("disabled", "true");
    document.getElementById("upload-error").style.display = "none";
    let promise = null;
    let playerInfos = Object.values(t.playerInfos);
    if (token === null) {
        let data = {
            email: (<HTMLInputElement>document.getElementById("email")).value,
            password: (<HTMLInputElement>document.getElementById("password")).value,
        };
        document.getElementById("log").innerText = "Logging in ...";
        promise = $.ajax({
            url: server + "/login",
            method: "POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify(data)
        }).then((res: any, status: any, xhr: any) => {
            token = xhr.getResponseHeader("jwt-token");
        }, (e: any) => {
            if (e instanceof Object && "responseJSON" in e 
                && e.responseJSON instanceof Object && "status" in e.responseJSON) {
                if (e.responseJSON.status === 422) {
                    throw new Error("Wrong Login Credentials");
                }
            } else {
                throw new Error("Unknown Error");
            }
        }).then(markDone).then(() => searchPlayer(playerInfos));
    } else {
        promise = searchPlayer(playerInfos);
    }
    promise
        .then((x: SearchResult) => resolveSearchResult(playerInfos, x))
        .then((o: ResolvedSearchResult) => {
        if (o.newPlayersWithoutName.length > 0) {
            document.getElementById("log").innerHTML += "<br>Loading ITSF Player Database - This may take a while ...";
            return p.getPlayerNames(o.newPlayersWithoutName).then(markDone).then(() => {
                let notFoundPlayers = [];
                for (let pl of o.newPlayersWithoutName) {
                    if (pl.firstName == null || pl.lastName == null || pl.birthday == null) {
                        notFoundPlayers.push(pl.itsfLicenseNumber);
                    }
                }
                assert(notFoundPlayers.length === 0, "Players not found in ITSF database: " + notFoundPlayers.join());
                return searchPlayer(o.newPlayersWithoutName)
                    .then((x: SearchResult) => resolveSearchResult(o.newPlayersWithoutName, x))
                    .then((o2: ResolvedSearchResult) => {
                        assert(o2.newPlayersWithoutName.length === 0, "Ever player should have a name after " +
                            "second iteration");
                        return {toUpdate: o.toUpdate.concat(o2.toUpdate),
                            idMap: Object.assign(o.idMap, o2.idMap), newPlayers: o.newPlayers.concat(o2.newPlayers), 
                            nameMap: Object.assign(o.nameMap, o2.nameMap)};
                    });
            });
        } else {
            return {toUpdate: o.toUpdate, idMap: o.idMap, newPlayers: o.newPlayers, nameMap: o.nameMap};
        }
    }).then((o: {toUpdate: TfboePlayerInfo[], idMap: {[key: number]: number}, newPlayers: PlayerInfo[], nameMap: {[key: number]: String}}) => {
        if (o.newPlayers.length > 0) {
            document.getElementById("log").innerHTML += "<br>Adding new players to TFBÖ-database ...";
            return apiRequest('addPlayers', o.newPlayers).then(markDone)
                .then((res: TfboePlayerInfo[]) => {
                    for (let i of res) {
                        assert(i.tmpId != null, "addPlayers returned without tmpIds");
                        o.idMap[i.tmpId] = i.id;
                    }
                    for (let i of o.newPlayers) {
                        assert(i.tmpId in o.idMap, "player " + i.toString() + " was not add to the database");
                        o.nameMap[o.idMap[i.tmpId]] = i.firstName + " " + i.lastName;
                    }
                    return {toUpdate: o.toUpdate, idMap: o.idMap, nameMap: o.nameMap};
                });
        } else {
            return {toUpdate: o.toUpdate, idMap: o.idMap, nameMap: o.nameMap};
        }
    }).then((o: {toUpdate: TfboePlayerInfo[], idMap: {[key: number]: number}, nameMap: {[key: number]: String}}) => {
        if (o.toUpdate.length > 0) {
            document.getElementById("log").innerHTML += "<br>Update players in TFBÖ-database ...";
            return apiRequest('updatePlayers', o.toUpdate).then(markDone).then((res: boolean) => {
                assert(res, "Update players in TFBÖ-database was unsuccessful!");
                return {idMap: o.idMap, nameMap: o.nameMap};
            });
        } else {
            return {idMap: o.idMap, nameMap: o.nameMap};
        }
    }).then((o: {idMap: {[key: number]: number}, nameMap: {[key: number]: String}}) => {
        for (let info in t.playerInfos) {
            assert(t.playerInfos[info].tmpId in o.idMap, "Couldn't find or add player " + t.playerInfos[info].toString());
        }
        for (let comp of t.tournament.competitions) {
            for (let team of comp.teams) {
                exchangeIds(team.players, o.idMap);
            }
            for (let phase of comp.phases) {
                for (let match of phase.matches) {
                    for (let game of match.games) {
                        exchangeIds(game.playersA, o.idMap);
                        exchangeIds(game.playersB, o.idMap);
                    }
                }
            }
        }
        return o.nameMap
    }).then((nameMap: {[key: number]: String}) => {
        if (setNonPlayingParticipants) {
            let log = document.getElementById("log").innerHTML;
            let tableDiv = document.createElement("div");
            let competitionTable = document.createElement("table");
            let headers = document.createElement("tr");
            tableDiv.appendChild(headers);
            tableDiv.appendChild(competitionTable);
            let competitionHeader = document.createElement("th");
            competitionHeader.innerText = "Competition";
            headers.appendChild(competitionHeader);
            let categoryHeader = document.createElement("th");
            categoryHeader.innerText = "Set playing participants";
            headers.appendChild(categoryHeader);
            for (let competition of t.tournament.competitions) {
                let tr = document.createElement("tr");
                let competitionNameEntry = document.createElement("td");
                competitionNameEntry.innerText = competition.name;
                tr.appendChild(competitionNameEntry);
                let nonPlayingParticipantsButtonEntry = document.createElement("td");
                let nonPlayingParticipantsButton = document.createElement("button");
                nonPlayingParticipantsButtonEntry.appendChild(nonPlayingParticipantsButton);
                nonPlayingParticipantsButton.type = "button";
                nonPlayingParticipantsButton.innerText = "Specify playing participants";
                tr.appendChild(nonPlayingParticipantsButtonEntry);
                competitionTable.appendChild(tr);

                let additionalRow = document.createElement("tr");
                let fullAdditionalRow = document.createElement("td");
                fullAdditionalRow.colSpan = 2;
                additionalRow.appendChild(fullAdditionalRow);
                competitionTable.appendChild(additionalRow);

                let teamMap: {[key: number]: Team} = {};

                for (let team of competition.teams) {
                    teamMap[team.startNumber] = team;
                }

                nonPlayingParticipantsButton.onclick = function() {
                    fullAdditionalRow.innerHTML = "";
                    let teamsTable = document.createElement("table");
                    fullAdditionalRow.appendChild(teamsTable);

                    let headers = document.createElement("tr");
                    let teamHeader = document.createElement("th");
                    teamHeader.innerText = "Team";
                    headers.appendChild(teamHeader);
                    let playedHeader = document.createElement("th");
                    playedHeader.innerText = "Played";
                    headers.appendChild(categoryHeader);
                    let detailsHeader = document.createElement("th");
                    detailsHeader.innerText = "Details";
                    headers.appendChild(detailsHeader);

                    teamsTable.appendChild(headers);

                    for (let team of competition.teams) {
                        let teamRow = document.createElement("tr");
                        teamsTable.appendChild(teamRow);
                        let teamName = document.createElement("td");
                        

                        let getTeamName = function(team: Team) {
                            let name = "";
                            for (let player of team.players) {
                                if (name != "") {
                                    name += " und ";
                                }
                                name += nameMap[player];
                            }
                            return name;
                        }

                        
                        teamName.innerText = getTeamName(team);

                        let playedCompetitionCheckboxEntry = document.createElement("td");
                        let playedCompetitionCheckbox = document.createElement("input");
                        playedCompetitionCheckbox.type = "checkbox";

                        let allMatches: [Match, Phase, HTMLInputElement][] = [];
                        let uniqueRankMap: {[key: number]: {[key: number]: Ranking}} = {};
                        for (let phase of competition.phases) {
                            let uRankMap: {[key: number]: Ranking} = {};
                            // search unique rank of team
                            let uniqueRank = 0;
                            for (let ranking of phase.rankings) {
                                uRankMap[ranking.uniqueRank] = ranking;
                                if (ranking.teamStartNumbers.indexOf(team.startNumber) >= 0) {
                                    uniqueRank = ranking.uniqueRank;
                                }
                            }
                            for (let match of phase.matches) {
                                if (match.played && match.rankingsAUniqueRanks.concat(match.rankingsBUniqueRanks).indexOf(uniqueRank) >= 0) {
                                    allMatches.push([match, phase, null]);
                                }
                            }
                            uniqueRankMap[phase.phaseNumber] = uRankMap;
                        }

                        let rankingName = function(ranking: Ranking) {
                            if (ranking.name !== undefined) {
                                return ranking.name;
                            }
                            let name = "";
                            for (let startNumber of ranking.teamStartNumbers) {
                                if (name != "") {
                                    name += " und ";
                                }
                                name += getTeamName(teamMap[startNumber]);
                            }
                            return name;
                        }
                        let rankingsName = function(uniqueRanks: number[], phase: Phase) {
                            let name = "";
                            for (let uniqueRank of uniqueRanks) {
                                if (name != "") {
                                    name += " und ";
                                }
                                name += rankingName(uniqueRankMap[phase.phaseNumber][uniqueRank]); 
                            }
                            return name;
                        }

                        setPlayedCompetitionCheckbox(playedCompetitionCheckbox, allMatches);
                        playedCompetitionCheckbox.onchange = function() {
                            for (let match of allMatches) {
                                setMatchPlayed(match[0], playedCompetitionCheckbox.checked);
                                if (match[2] !== null) {
                                    match[2].checked = playedCompetitionCheckbox.checked;
                                }
                            }
                        };
                        playedCompetitionCheckboxEntry.appendChild(playedCompetitionCheckbox);

                        let detailsButtonEntry = document.createElement("td");
                        let detailsButton = document.createElement("button");
                        detailsButton.setAttribute("type", "button");
                        detailsButton.innerText = "Specify for each match";
                        let additionalRow = document.createElement("tr");

                        let additionalRowEntry = document.createElement("td");
                        additionalRowEntry.colSpan = 3;
                        additionalRow.appendChild(additionalRowEntry);
                        detailsButton.onclick = function() {
                            let table = document.createElement("table");
                            additionalRowEntry.innerHTML = "";
                            additionalRowEntry.appendChild(table);
                            for (let match of allMatches) {
                                let matchRow = document.createElement("tr");
                                table.appendChild(matchRow);

                                let matchEntry = document.createElement("td");
                                matchRow.appendChild(matchEntry);
                                matchEntry.innerText = rankingsName(match[0].rankingsAUniqueRanks, match[1]) 
                                    + " gegen " 
                                    + rankingsName(match[0].rankingsBUniqueRanks, match[1]);
                                
                                let playedCheckboxEntry = document.createElement("td");
                                matchRow.appendChild(playedCheckboxEntry);
                                let playedCheckbox = document.createElement("input");
                                playedCheckboxEntry.appendChild(playedCheckbox);
                                playedCheckbox.type = "checkbox";
                                playedCheckbox.checked = match[0].played;
                                playedCheckbox.onchange = function() {
                                    setMatchPlayed(match[0], playedCheckbox.checked);
                                    setPlayedCompetitionCheckbox(playedCompetitionCheckbox, allMatches);
                                };
                                match[2] = playedCheckbox;
                            }
                        };
                        detailsButtonEntry.appendChild(detailsButton);

                        teamRow.appendChild(teamName);
                        teamRow.appendChild(playedCompetitionCheckboxEntry);
                        teamRow.appendChild(detailsButtonEntry);
                        teamsTable.appendChild(teamRow);
                        teamsTable.appendChild(additionalRow);
                    }
                };
            }
            document.getElementById("log").appendChild(tableDiv);
            let uploadButton = document.createElement("button");
            uploadButton.setAttribute("type", "button");
            uploadButton.innerText = "Upload tournament";
            uploadButton.onclick = function() {
                document.getElementById("log").innerHTML = log;
                upload(t, file);
            }
            document.getElementById("log").appendChild(uploadButton);
        } else {
            upload(t, file);
        }
    }).catch((e: Error) => {
        let el = document.getElementById("upload-error");
        el.style.display = "block";
        el.innerText = e.message;
    });
}

function upload(t: TournamentInfo, file: File) {
    document.getElementById("log").innerHTML += "<br>Upload fast file to TFBÖ-Server ...";
    let data = new FormData();
    data.append("tournamentFile", file);
    data.append("userIdentifier", t.tournament.userIdentifier);
    data.append("extension", "fast");
    return $.ajax({
        url: server + "/uploadFile",
        type: 'POST',
        contentType: false,
        processData: false,
        data: data,
        timeout: 3600000,
        headers: {'Authorization': 'bearer ' + token},
    })
    .catch(catchAPIErrors)
    .then((res: any, status: string) => {
        if (status !== "success" || res !== true) {
            throw new Error("Unsuccessful ajax request! " + server + "/uploadFile");
        }
    }).then(markDone).then(() => {
        document.getElementById("log").innerHTML += "<br>Upload tournament to TFBÖ-database ...";
        return apiRequest('createOrReplaceTournament', t.tournament);
    }).then((res: AsyncResponse) => {
        return waitForAsyncResult(res["async-id"], document.getElementById("log").innerHTML);
    }).then((res: {type: string}) => {
        switch (res.type) {
            case "replace":
                document.getElementById("log").innerHTML += "<br>Replaced the tournament in the TFBÖ-database!";
                break;
            case "create":
                document.getElementById("log").innerHTML +=
                    "<br>Successfully created the tournament in the TFBÖ-database!";
                break;
            default:
                throw new Error("An error occurred when trying to upload the tournament!");
        }
    }).catch((e: Error) => {
        let el = document.getElementById("upload-error");
        el.style.display = "block";
        el.innerText = e.message;
    }).then(() => {
        document.getElementById("file").removeAttribute("disabled");
    });
}

function sleep (time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

class GetAsyncRequestResponse {
    type: number;
    message: string;
    [key: string]: any
}

function waitForAsyncResult(id: string, html: string): Promise<{type: string}> {
    return apiRequest('getAsyncRequestState/' + id, null, "GET").then((resp: GetAsyncRequestResponse) => {
        if (resp.type == 2 && "progress" in resp) {
            document.getElementById("log").innerHTML = html + " " + Math.round(resp["progress"] * 100) + "% done";
        }
        if (resp.type < 3) {
            return sleep(1000).then(() => waitForAsyncResult(id, html));
        } else if ("result" in resp && "data" in resp["result"]) {
            document.getElementById("log").innerHTML = html + " 100% done";
            return resp["result"]["data"];
        } else {
            throw new Error("An error occurred when trying to upload the tournament!");
        }
    });
}

function exchangeIds(ids: number[], idMap: {[key: number]: number}) {
    for (let i = 0; i < ids.length; i++) {
        assert(ids[i] in idMap, "Missing id " + ids[i]);
        ids[i] = idMap[ids[i]];
    }
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("file").addEventListener('change', onFileChange, false);
}, false);
