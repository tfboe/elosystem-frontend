import { Parser } from ".";
import { assert } from "./parsers/parse-error";
import TournamentInfo, { Match, Phase, PlayerInfo, PurePlayerInfo, Ranking, Team } from "./tournament";

let $ = require("jquery");

let server = process.env.SERVER;

class AjaxResponse {
    response: any;
    status: any;
    xhr: any;
}

class AsyncResponse {
    type: string;
    result: string;
    "async-id": string;
}

function markDone() {
    document.getElementById("log").innerText += " done";
}


function ajax(data: any): Promise<AjaxResponse> {
    return $.ajax(data).then((res: any, status: any, xhr: any) => {
        let response = new AjaxResponse();
        response.response = res;
        response.status = status;
        response.xhr = xhr;
        return response;
    }).catch((e: Error) => { throw e; });
}

function exchangeIds(ids: number[], idMap: { [key: number]: number }) {
    for (let i = 0; i < ids.length; i++) {
        assert(ids[i] in idMap, "Missing id " + ids[i]);
        ids[i] = idMap[ids[i]];
    }
}

function catchAPIErrors(e: any) {
    if (e instanceof Object && "responseJSON" in e && "status" in e.responseJSON && e.responseJSON.status === 422) {
        throw new Error(e.responseJSON.message);
    } else {
        throw new Error("Unknown Error");
    }
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

function sleep (time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

class GetAsyncRequestResponse {
    type: number;
    message: string;
    [key: string]: any
}

class TfboePlayerInfo extends PlayerInfo {
    constructor(
        public id: number,
        tmpId: number,
        firstName?: string, 
        lastName?: string, 
        birthday?: string, 
        itsfLicenseNumber?: number
    ) {
        super(tmpId, firstName, lastName, birthday, itsfLicenseNumber);
    }
}

interface IntermediateSearchResult {
    [index: number]: {
        [playerId: number]: PlayerResult
    }
}

class PlayerResult extends PurePlayerInfo {
    constructor(
        public id: number,
        public firstName: string, 
        public lastName: string, 
        public birthday: string, 
        public itsfLicenseNumber: number,
        public itsfLicenseNumbersBeforeMerge: number[],
    ) {
        super(firstName, lastName, birthday, itsfLicenseNumber);
    }

    toTfboePlayerInfo(tmpId: number): TfboePlayerInfo {
        return new TfboePlayerInfo(
            this.id, 
            tmpId, 
            this.firstName, 
            this.lastName, 
            this.birthday, 
            this.itsfLicenseNumber
        );
    }
}

type NameMap = { [key: number]: String };

interface SearchResult {
    toUpdate: TfboePlayerInfo[],
    idMap: { [key: number]: number },
    newPlayers: PlayerInfo[],
    newPlayersWithoutName: PlayerInfo[],
    nameMap: NameMap
}

export class UploadManager {
    tournament: TournamentInfo;
    file: File;
    setNonPlayingParticipants: boolean;
    token: string | null;
    parser: Parser;
    loggedInUserId: string | null;
    checkAdminAndLoginAs: boolean;

    constructor(tournament: TournamentInfo, file: File, setNonPlayingParticipants: boolean, token: string | null, parser: Parser, loggedInUserId: string | null) {
        this.tournament = tournament;
        this.file = file;
        this.setNonPlayingParticipants = setNonPlayingParticipants;
        this.token = token;
        this.parser = parser;
        this.loggedInUserId = loggedInUserId;
        this.checkAdminAndLoginAs = false;
    }

    resolveSearchResult(data: PlayerInfo[], res: IntermediateSearchResult): SearchResult {
        let ambigousPlayers = [];
        let newPlayers = [];
        let newPlayersWithoutName = [];
        let toUpdate = [];
        let idMap: { [key: number]: number } = {};
        let nameMap: { [key: number]: String } = {};
        for (let index in data) {
            let found: PlayerResult[] = [];
            if (index in res) {
                found = Object.values(res[index]);
            }
            let search = data[index];
            if (found.length > 1) {
                ambigousPlayers.push(search.toString());
            } else if (found.length === 1) {
                if (search.itsfLicenseNumber != null && found[0].itsfLicenseNumber != search.itsfLicenseNumber && found[0].itsfLicenseNumbersBeforeMerge.indexOf(search.itsfLicenseNumber) === -1) {
                    console.log(search);
                    console.log(found[0]);
                    found[0].itsfLicenseNumber = search.itsfLicenseNumber;
                    let p = found[0].toTfboePlayerInfo(search.tmpId);
                    p.tmpId = search.tmpId;
                    toUpdate.push(p);
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
        }
        return { toUpdate: toUpdate, idMap: idMap, newPlayers: newPlayers, newPlayersWithoutName: newPlayersWithoutName, nameMap: nameMap };
    }

    async searchPlayer(data: PlayerInfo[]) {
        document.getElementById("log").innerHTML += "<br>Searching players in TFBÖ-database ...";
        let result = await this.apiRequest('searchPlayers', data);
        for (let index in result) {
            for (let playerId in result[index]) {
                let anyObject = result[index][playerId];
                result[index][playerId] = new PlayerResult(anyObject.id, anyObject.firstName, anyObject.lastName, anyObject.birthday, anyObject.itsfLicenseNumber, anyObject.itsfLicenseNumbersBeforeMerge);
            }
        }
        markDone();
        return this.resolveSearchResult(data, result);
    }

    async apiRequest(command: string, data: Object, type: string = "POST", additionalEntries: any = {}, processData = true) {
        try {
            let object = Object.assign({
                url: server + "/" + command,
                method: type,
                data: (data !== null && processData) ? JSON.stringify(data) : data,
                timeout: 3600000
            }, additionalEntries);
            if (!processData) {
                object.processData = false;
            }
            let apiResponse = await this.ajax(object);
            if (apiResponse.status !== "success") {
                throw new Error("Unsuccessful ajax request! " + server + "/" + command);
            }
            return apiResponse.response;
        } catch(e) {
            catchAPIErrors(e);
        }
    }

    async ajax(data: any) {
        if (!data.hasOwnProperty("dataType")) {
            data.dataType = "json";
        }
        if (!data.hasOwnProperty("contentType")) {
            data.contentType = "application/json; charset=utf-8";
        }
        if (!data.hasOwnProperty("method")) {
            data.method = "GET";
        }
        if (!!this.token) {
            data.headers = { 'Authorization': 'bearer ' + this.token };
        }
        return await ajax(data);
    }

    async loginAs(adminId: string, loginAsId: string) {
        if (adminId != loginAsId) {
            let loginAsResponse = await this.ajax({
                url: server + "/admin/loginAs",
                method: "POST",
                data: JSON.stringify({ userId: loginAsId })
            });
            this.token = loginAsResponse.xhr.getResponseHeader("jwt-token");
        }
        markDone();
        await this.upload();
    }

    async login() {
        try {
            if (!this.token) {
                let data = {
                    email: (<HTMLInputElement>document.getElementById("email")).value,
                    password: (<HTMLInputElement>document.getElementById("password")).value,
                };
                document.getElementById("log").innerText = "Logging in ...";
                let loginResult = await this.ajax({
                    url: server + "/login",
                    method: "POST",
                    data: JSON.stringify(data)
                });
                markDone();
                this.loggedInUserId = loginResult.response.id;
                this.token = loginResult.xhr.getResponseHeader("jwt-token");
            }
            if (!this.checkAdminAndLoginAs) {
                let isAdminResult = await this.ajax({ url: server + "/isAdmin" });
                if (isAdminResult.response.isAdmin) {
                    let usersResponse = await this.ajax({ url: server + "/admin/users" });
                    let div = document.getElementById("log");
                    let loginAs = document.createElement("div");
                    loginAs.appendChild(document.createTextNode("Login As:"));
                    let select = document.createElement("select");
                    select.id = "loginAs";
                    for (let user of usersResponse.response) {
                        let option = document.createElement("option");
                        option.value = user.id;
                        option.innerText = user.email;
                        select.appendChild(option);
                    }
                    select.value = this.loggedInUserId;
                    loginAs.appendChild(select);
                    let loginAsButton = document.createElement("button");
                    loginAsButton.type = "button";
                    loginAsButton.innerText = "Login As";
                    loginAsButton.onclick = function () {
                        this.loginAs(this.loggedInUserId, select.value);
                    }.bind(this);
                    loginAs.appendChild(loginAsButton);
                    div.appendChild(loginAs);
                    this.checkAdminAndLoginAs = true;
                    return false;
                }
                this.checkAdminAndLoginAs = true;
            }
        } catch (e) {
            if (e instanceof Object && "responseJSON" in e
                && e.responseJSON instanceof Object && "status" in e.responseJSON && e.responseJSON.status === 401) {
                throw new Error("Wrong Login Credentials");
            } else {
                throw new Error("Unknown Error");
            }
        }
        return true;
    }

    async searchWithITSFPlayerDatabase(searchResult: SearchResult) {
        document.getElementById("log").innerHTML += "<br>Loading ITSF Player Database - This may take a while ...";
        await this.parser.getPlayerNames(searchResult.newPlayersWithoutName);
        markDone();
        let notFoundPlayers = [];
        for (let pl of searchResult.newPlayersWithoutName) {
            if (pl.firstName == null || pl.lastName == null || pl.birthday == null) {
                notFoundPlayers.push(pl.itsfLicenseNumber);
            }
        }
        assert(notFoundPlayers.length === 0, "Players not found in ITSF database: " + notFoundPlayers.join());
        let newSearchResult = await this.searchPlayer(searchResult.newPlayersWithoutName);
        assert(newSearchResult.newPlayersWithoutName.length === 0, "Ever player should have a name after " +
            "second iteration");
        searchResult.toUpdate = searchResult.toUpdate.concat(newSearchResult.toUpdate);
        searchResult.idMap = Object.assign(searchResult.idMap, newSearchResult.idMap);
        searchResult.newPlayers = searchResult.newPlayers.concat(newSearchResult.newPlayers);
        searchResult.nameMap = Object.assign(searchResult.nameMap, newSearchResult.nameMap);
        searchResult.newPlayersWithoutName = [];
    }

    async addPlayersToTFBOEDatabase(searchResult: SearchResult) {
        document.getElementById("log").innerHTML += "<br>Adding new players to TFBÖ-database ...";
        let res = await this.apiRequest('addPlayers', searchResult.newPlayers);
        markDone();
        for (let i of res) {
            assert(i.tmpId != null, "addPlayers returned without tmpIds");
            searchResult.idMap[i.tmpId] = i.id;
        }
        for (let i of searchResult.newPlayers) {
            assert(i.tmpId in searchResult.idMap, "player " + i.toString() + " was not add to the database");
            searchResult.nameMap[searchResult.idMap[i.tmpId]] = i.firstName + " " + i.lastName;
        }
        searchResult.newPlayers = [];
    }

    async updatePlayers(searchResult: SearchResult) {
        document.getElementById("log").innerHTML += "<br>Update players in TFBÖ-database ...";
        let res: boolean = await this.apiRequest('updatePlayers', searchResult.toUpdate);
        markDone();
        assert(res, "Update players in TFBÖ-database was unsuccessful!");
        searchResult.toUpdate = [];
    }

    postProcessSearchResult(searchResult: SearchResult) {
        for (let info in this.tournament.playerInfos) {
            assert(
                this.tournament.playerInfos[info].tmpId in searchResult.idMap,
                "Couldn't find or add player " + this.tournament.playerInfos[info].toString()
            );
        }
        for (let comp of this.tournament.tournament.competitions) {
            for (let team of comp.teams) {
                exchangeIds(team.players, searchResult.idMap);
            }
            for (let phase of comp.phases) {
                for (let match of phase.matches) {
                    for (let game of match.games) {
                        exchangeIds(game.playersA, searchResult.idMap);
                        exchangeIds(game.playersB, searchResult.idMap);
                    }
                }
            }
        }
    }

    showFormToSetNonPlayingParticipants(nameMap: NameMap) {
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
        for (let competition of this.tournament.tournament.competitions) {
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

            let teamMap: { [key: number]: Team } = {};

            for (let team of competition.teams) {
                teamMap[team.startNumber] = team;
            }

            nonPlayingParticipantsButton.onclick = function () {
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


                    let getTeamName = function (team: Team) {
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
                    let uniqueRankMap: { [key: number]: { [key: number]: Ranking } } = {};
                    for (let phase of competition.phases) {
                        let uRankMap: { [key: number]: Ranking } = {};
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

                    let rankingName = function (ranking: Ranking) {
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
                    let rankingsName = function (uniqueRanks: number[], phase: Phase) {
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
                    playedCompetitionCheckbox.onchange = function () {
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
                    detailsButton.onclick = function () {
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
                            playedCheckbox.onchange = function () {
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
        uploadButton.onclick = function () {
            document.getElementById("log").innerHTML = log;
            this.finishUpload();
        }.bind(this);
        document.getElementById("log").appendChild(uploadButton);
    }

    public async upload() {
        document.getElementById("file").setAttribute("disabled", "true");
        document.getElementById("button").setAttribute("disabled", "true");
        document.getElementById("upload-error").style.display = "none";

        const shouldContinue = await this.login();
        if (!shouldContinue) {
            return;
        }
        let playerInfos = Object.values(this.tournament.playerInfos);

        try {
            let searchResult: SearchResult = await this.searchPlayer(playerInfos);
            if (searchResult.newPlayersWithoutName.length > 0) {
                await this.searchWithITSFPlayerDatabase(searchResult);
            }
            if (searchResult.newPlayers.length > 0) {
                await this.addPlayersToTFBOEDatabase(searchResult);
            }
            if (searchResult.toUpdate.length > 0) {
                console.log(searchResult.toUpdate);
                await this.updatePlayers(searchResult);
            }
            this.postProcessSearchResult(searchResult);
            if (this.setNonPlayingParticipants) {
                this.showFormToSetNonPlayingParticipants(searchResult.nameMap);
            } else {
                await this.finishUpload();
            }
        } catch(e) {
            let el = document.getElementById("upload-error");
            el.style.display = "block";
            el.innerText = e.message;
        }
    }

    async finishUpload() {
        document.getElementById("log").innerHTML += "<br>Upload fast file to TFBÖ-Server ...";
        let data = new FormData();
        data.append("tournamentFile", this.file);
        data.append("userIdentifier", this.tournament.tournament.userIdentifier);
        data.append("extension", "fast");
        try {
            await this.apiRequest("uploadFile", data, "POST", {contentType: false}, false);
            markDone();
            
            document.getElementById("log").innerHTML += "<br>Upload tournament to TFBÖ-database ...";
            let asyncResponse: AsyncResponse = await this.apiRequest('createOrReplaceTournament', this.tournament.tournament);
            let response: {type: string} = await this.waitForAsyncResult(asyncResponse["async-id"], document.getElementById("log").innerHTML);
            switch (response.type) {
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
        } catch(e) {
            let el = document.getElementById("upload-error");
            el.style.display = "block";
            el.innerText = e.message;
        }
        document.getElementById("file").removeAttribute("disabled");
    }
    
    async waitForAsyncResult(id: string, html: string): Promise<any> {
        let resp: GetAsyncRequestResponse = await this.apiRequest('getAsyncRequestState/' + id, null, "GET");
        if (resp.type == 2 && "progress" in resp) {
            document.getElementById("log").innerHTML = html + " " + Math.round(resp["progress"] * 100) + "% done";
        }
        if (resp.type < 3) {
            await sleep(1000);
            return await this.waitForAsyncResult(id, html);
        } else if ("result" in resp && "data" in resp["result"]) {
            document.getElementById("log").innerHTML = html + " 100% done";
            return resp["result"]["data"];
        } else {
            throw new Error("An error occurred when trying to upload the tournament!");
        }
    }
}