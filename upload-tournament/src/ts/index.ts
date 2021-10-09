import fastParser from './parsers/fast';
import '../css/style';
import TournamentInfo, {PlayerInfo} from "./tournament";
import { UploadManager } from './uploadManager';

export interface Parser {
    parse(file: File): Promise<TournamentInfo>
    getPlayerNames(players: PlayerInfo[]): Promise<void>
}

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

let p: Parser = null;
let token: string|null = null;
let loggedInUserId: string|null = null;

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

function prepareUpload(t: TournamentInfo, file: File, setNonPlayingParticipants: boolean) {
    let uploadManager = new UploadManager(t, file, setNonPlayingParticipants, token, p, loggedInUserId);
    uploadManager.upload().finally(() => {
        token = uploadManager.token;
        loggedInUserId = uploadManager.loggedInUserId;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("file").addEventListener('change', onFileChange, false);
}, false);
