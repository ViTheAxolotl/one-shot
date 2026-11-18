/**
 * dmSite.js — the DM's control panel (dmSite.html, the DmSite tab; only Vi can use it).
 *
 * The page starts as a grid of buttons. Clicking one removes the buttons (hideButtons,
 * which also checks the user really is Vi) and builds that tool in #story. "Done"
 * reloads the page back to the button grid.
 *
 *   Add Token / Remove Token  add a token, or edit/delete tokens on the map
 *   Preset Tokens / Summons   saved monsters/NPCs (preset/) and the DM's summons
 *                             (playerChar/Vi/summons/summonPreset): edit them or drop them on the map
 *   Quick Change Hp           every token's HP in one list
 *   Turn Order                set who goes when (currentTO/) and start the turn counter
 *   Change / Save / Load Map  switch the map picture; save the whole board under a name
 *                             (listed in lists/) or load a saved one
 *   Interactive               push a picture + text popup to every player
 *   Quests                    edit the quest list players see
 *   Refresh Screens           force one player's page to reload
 *   Upload Image              add a token/push/item/map picture to Firebase Storage
 *   Open Page                 open this panel in its own browser tab
 *
 * All data comes from the dashboard through window.top.parent (filled by parent.js).
 */

import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { toTitleCase, auth, database, setDoc, deleteDoc, returnHpImage, placeBefore, createLabel, wait, storage } from '../js/viMethods.js';
import { uploadBytes, getDownloadURL, ref as sRef } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
import imageCompression from 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.mjs';

const QUEST_PLACEHOLDER = "Placeholder"; //Hidden quest that keeps playerChar/Vi/quests from being empty
const REFRESH_ALL = "All"; //Refresh Screens value meaning every player
let fiveButtons = [];
let db;
let div = document.getElementById("story");
let preOrSumm;
let presetKey; //Key of the preset/summon being edited (null when creating a new one)
let editDiv;
let curCharacter;
let temp;
let mode;
let user;

/**
 * Connects each DM button (by its id) to its tool, and keeps a list of them so
 * hideButtons() can clear them away.
 */
function init()
{
    for(let button of document.getElementsByTagName("button"))
    {
        switch(button.id)
        {
            case "add":
                fiveButtons.push(button);
                button.onclick = handleAdd;
                break;

            case "remove":
                fiveButtons.push(button);
                button.onclick = handleRemove;
                break;

            case "pre":
                fiveButtons.push(button);
                button.onclick = handlePreset;
                break;
            
            case "sum":
                fiveButtons.push(button);
                button.onclick = handleSummons;
                break;

            case "quick":
                fiveButtons.push(button);
                button.onclick = handleQuick;
                break;

            case "turnO":
                fiveButtons.push(button);
                button.onclick = handleTurn;
                break;

            case "changeMap":
                fiveButtons.push(button);
                button.onclick = handleChangeMap;
                break;

            case "save":
                fiveButtons.push(button);
                button.onclick = handleSave;
                break;

            case "load":
                fiveButtons.push(button);
                button.onclick = handleLoad;
                break;

            case "delete":
                fiveButtons.push(button);
                button.onclick = handleDelete;
                break;
            
            case "interactive":
                fiveButtons.push(button);
                button.onclick = handleInteractive;
                break;
            
            case "quest":
                fiveButtons.push(button);
                button.onclick = handleQuest;
                break;

            case "generate":
                fiveButtons.push(button);
                button.onclick = handleGenerate;
                break;

            case "refresh":
                fiveButtons.push(button);
                button.onclick = handleRefresh;
                break;

            case "image":
                fiveButtons.push(button);
                button.onclick = handleUploadImage;
                break;

            case "openPage":
                fiveButtons.push(button);
                button.onclick = handleOpenPage;
                break;
        }
    }
}

/**
 * Reloads the page with "#run:<methodName>" in the address (so a tool can run after reload).
 */
function refreshAndRun(methodName) 
{
    window.location.hash = `run:${methodName}`;
    window.location.reload();
}

/**
 * Security check: if the logged-in account isn't Vi, show an error and reload.
 */
function getUser()
{
    if(auth.currentUser == undefined){alert("Wrong Credentails!!!"); location.reload();}
    else{user = auth.currentUser.email.split("@"); user = toTitleCase(user[0]);}
    if(user != "Vi"){alert("Wrong Credentails!!!"); location.reload();}
}

/**
 * "Add Token": shows the edit form for a brand-new token (defaults: invisible picture,
 * 20 HP, square D5). Saving it adds it to the map.
 */
function handleAdd()
{
    hideButtons();

    mode = "add";
    curCharacter = {border: "invisible", currentHp: "20", map: "", maxHp: "20", tempHp: "0", isSummon : false, name: "invisible-", id: "invisible", title: " ", xPos: "5", yPos: "D", ac: "10"};
    makeToken(curCharacter);
    editDiv = document.getElementById("invisible-div");
    temp = curCharacter.name;
    handleEdit();

    let reset = document.getElementById("reset");
    reset.onclick = handleDone;
}

/**
 * Adds a small preview of a token (picture, border ring, HP bar) to the panel.
 * Clicking the ring offers edit / delete for that token.
 */
function makeToken(key) 
{
    let token = [document.createElement("div"), document.createElement("img"), document.createElement("img"), document.createElement("img")];
    token[0].id = `${key.id}-div`;
    token[0].classList = "bg-oak-deep objectBorder";
    token[0].style.margin = "5px";
    token[0].style.position = "relative";
    token[0].style.minHeight = "calc(12vh + 10px)"; //Pictures are 12vh (Styles.css #story .tokens)
    token[0].style.minWidth = "82px";
    token[0].style.paddingLeft = "calc(12vh + 15px)"; //Keeps every row of fields clear of the picture
    token[1].src = window.top.parent.imgs["tokens"][key.name];
    token[1].id = key.name;
    token[1].classList = `tokens ${key.name} char`;
    token[2].src = window.top.parent.imgs["borders"][key.border];
    token[2].id = key.border;
    token[2].classList = `tokens ${key.id} border_`;
    token[3].src = window.top.parent.imgs["tokens"][key.name];
    token[3].id = "hp";
    token[3].classList = `tokens ${key.name} hp`;
    token[2].onclick = handleDeleteOrEdit;

    token[0].appendChild(token[1]);
    token[0].appendChild(token[2]);
    token[0].appendChild(token[3])
    div.appendChild(token[0]); 
}

/**
 * "Remove Token": shows every token on the map; click one's ring to edit or delete it.
 */
function handleRemove()
{
    hideButtons();
    mode = undefined; //Clear "add"/"preset" left over from the last tool, or Edit shows the filler token

    for(let key of Object.keys(window.top.parent.wholeDB))
    {
        if(key != "invisible" && typeof window.top.parent.wholeDB[key] == "object") //Skip the map setting, it isn't a token
        {
            makeToken(window.top.parent.wholeDB[key]);
        }
    }

    addDone();
}

/**
 * Clicked a token's ring: adds "edit" and "delete" buttons next to it
 * (removing any from a previously clicked token).
 */
function handleDeleteOrEdit()
{
    let currentDiv = this.parentElement;
    let currentEOrD = document.getElementsByClassName("eOrD");
    let editB = document.createElement("button");
    let deleteB = document.createElement("button");

    if(currentEOrD.length > 0)
    {
        for(let i = 0; i < 2; i++)
        {
            currentEOrD[0].parentElement.removeChild(currentEOrD[0]);
        }
    }

    editDiv = currentDiv;
    editB.innerHTML = "Edit";
    editB.onclick = handleEdit;
    temp = this.classList[1];
    editB.classList = `eOrD ${this.classList[1]} rowButton`;
    editB.id = "edit";
    deleteB.innerHTML = "Delete";
    deleteB.onclick = deleteToken;
    deleteB.classList = `eOrD ${this.classList[1]} rowButton`;
    currentDiv.appendChild(editB);
    currentDiv.appendChild(deleteB);
}

/**
 * Removes the chosen token from the map (currentMap/<id>), then redraws the list.
 */
function deleteToken()
{
    for(let key of Object.keys(window.top.parent.wholeDB))
    {
        if(key == this.classList[1])
        {
            try
            { 
                deleteDoc(`currentMap/${window.top.parent.wholeDB[key].id}`);
            }
            
            catch (e) 
            {
                console.error("Error adding document: ", e);
            }
        }
    }
    
    resetDelete();
}
 
/**
 * Shows the edit form for a token: border and picture dropdowns (the preview updates as
 * you pick), max/current/temp HP, title (status keywords), x/y position, summon flag and AC.
 * In preset mode it edits a saved preset instead, and its first button puts it on the map.
 */
function handleEdit()
{
    let names = ["border", "name", "maxHp", "currentHp", "title", "xPos", "yPos", "tempHp", "isSummon", "ac"];
    let txtFeilds = [];
    let buttons = [document.createElement("button"), document.createElement("button")];
    let buttonsName = ["Upload", "Back"];
    let currentEOrD = document.getElementsByClassName("eOrD");
    let pickers = [];

    if(currentEOrD.length > 0)
    {
        for(let i = 0; i < 2; i++)
        {
            currentEOrD[0].parentElement.removeChild(currentEOrD[0]);
        }
    }

    for(let i = 0; i < 2; i++)
    {
        buttons[i].innerHTML = buttonsName[i];
        buttons[i].classList = "rowButton";
    }

    buttons[0].id = "edit"; //Other tools find these two by id
    buttons[0].onclick = addToken;
    buttons[1].onclick = resetDelete;
    buttons[1].id = "reset";

    if(temp != undefined)
    {
        if(mode != "preset" && mode != "add")
        {
            //temp is the token's id (the map key). Look it up directly: matching on name breaks for
            //numbered copies (goblin1's name is still "goblin-") and for tokens whose picture changed.
            let found = window.top.parent.wholeDB[temp];

            if(found == undefined)
            {
                for(let key of Object.keys(window.top.parent.wholeDB))
                {
                    if(window.top.parent.wholeDB[key].id == temp || window.top.parent.wholeDB[key].name == temp + "-")
                    {
                        found = window.top.parent.wholeDB[key];
                    }
                }
            }

            if(found != undefined){curCharacter = found;}
        }

        else if(mode == "preset")
        {
            for(let key of Object.keys(db[preOrSumm]))
            {
                if(db[preOrSumm][key].name == temp)
                {
                    curCharacter = db[preOrSumm][key];
                }
            } 

            buttons[0].classList.add(curCharacter.name);
            buttons[0].onclick = function () {let id = this.classList[0].slice(0, this.classList[0].length - 1); setDoc(`currentMap/${id}`, db[preOrSumm][id]);};
            buttons[1].onclick = resetPreset;
        }
    }
    
    for(let i = 0; i < 10; i++)
    {
        let label = createLabel(names[i]);
        
        if(i == 0 || i == 1)
        {
            //Border / picture: a button that opens a grid of the actual pictures (like Change Token
            //on the stats tab). The chosen key lives in a hidden input so addToken() reads it as before.
            txtFeilds[i] = document.createElement("input");
            txtFeilds[i].type = "hidden";
            txtFeilds[i].name = names[i];
            pickers.push(makeImagePicker(names[i], i == 0 ? "borders" : "tokens", txtFeilds[i]));
        }

        else if(i == 2 || i == 3 || i == 7)
        {
            txtFeilds[i] = document.createElement("input");
            txtFeilds[i].name = names[i];
            txtFeilds[i].type = "number";
            txtFeilds[i].min = "0";
            txtFeilds[i].step = "1";
            txtFeilds[i].onchange = handleChangeCurrent;
        }

        else
        {
            txtFeilds[i] = document.createElement("input");
        }
        
        txtFeilds[i].style.width = "75px";
        txtFeilds[i].id = names[i];
        txtFeilds[i].style.margin = "5px";
        editDiv.appendChild(label);
        editDiv.appendChild(txtFeilds[i]);
        if(i == 0 || i == 1){editDiv.appendChild(pickers[i].button);}
    }

    txtFeilds[0].value = curCharacter.border;
    txtFeilds[1].value = curCharacter.name;
    txtFeilds[2].value = curCharacter.maxHp;
    txtFeilds[3].value = curCharacter.currentHp;
    txtFeilds[4].value = curCharacter.title;
    txtFeilds[5].value = curCharacter.xPos;
    txtFeilds[6].value = curCharacter.yPos;
    txtFeilds[7].value = curCharacter.tempHp;
    txtFeilds[8].value = curCharacter.isSummon;
    let curAC = curCharacter.AC ?? curCharacter.ac; //Map tokens store it as AC
    txtFeilds[9].value = (curAC == undefined || curAC === "" || curAC == "undefined") ? "10" : curAC;
    pickers.forEach(p => {p.setValue(p.input.value); editDiv.appendChild(p.panel);}); //Grids go on their own line under the fields
    let buttonRow = document.createElement("div"); //Centers edit/back under the form
    buttonRow.style.textAlign = "center";
    buttonRow.style.whiteSpace = "nowrap";
    buttons.forEach(em => {buttonRow.appendChild(em)});
    editDiv.appendChild(buttonRow);
}

/**
 * Builds a picture picker for the token form: a button showing the current choice and a
 * scrolling grid of every picture in imgs[kind] ("tokens" or "borders"). Picking one stores
 * its key in `input`, updates the button and the token preview, and closes the grid.
 * Opening one picker closes any other.
 */
function makeImagePicker(fieldName, kind, input)
{
    let images = window.top.parent.imgs[kind];
    let button = document.createElement("button");
    let panel = document.createElement("div");

    button.type = "button";
    button.classList = "pickerBtn";
    button.id = `${fieldName}Picker`;
    button.style.margin = "5px";

    panel.classList = "imgPicker";
    panel.id = `${fieldName}PickerGrid`;

    let keys = Object.keys(images).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}));

    for(let key of keys)
    {
        let img = document.createElement("img");
        img.src = images[key];
        img.title = key;
        img.alt = key;
        img.dataset.key = key;
        img.loading = "lazy";
        img.onerror = function () {this.remove();}; //Skip pictures whose file is gone
        img.onclick = function () {setValue(key); panel.classList.remove("open");};
        panel.appendChild(img);
    }

    function setValue(key)
    {
        input.value = key;
        button.innerHTML = `${key} &#9662;`;
        button.title = key;

        for(let img of panel.children){img.classList.toggle("picked", img.dataset.key == key);}

        //Update the preview: child 0 is the picture, child 1 the border ring (see makeToken)
        let preview = editDiv.childNodes[kind == "borders" ? 1 : 0];
        if(preview && images[key])
        {
            let hpLayer = editDiv.childNodes[2]; //makeToken fills the HP layer with the picture too, and it sits on top
            if(kind == "tokens" && hpLayer && hpLayer.src == preview.src){hpLayer.src = images[key];}
            preview.src = images[key];
            preview.classList.remove("invisible");
        }
    }

    button.onclick = function ()
    {
        let opening = !panel.classList.contains("open");
        for(let other of document.getElementsByClassName("imgPicker")){other.classList.remove("open");}
        if(opening)
        {
            panel.classList.add("open");
            let picked = panel.querySelector(".picked");
            if(picked){picked.scrollIntoView({block: "nearest"});}
        }
    };

    return {button, panel, input, setValue};
}

/**
 * Max, current or temp HP changed: cap current HP at max HP and update the preview HP bar.
 */
function handleChangeCurrent()
{
    let maxField = document.getElementById("maxHp");
    let currentField = document.getElementById("currentHp");

    if(parseInt(currentField.value) > parseInt(maxField.value))
    {
        currentField.value = maxField.value; //Always cap current HP (not whichever box was edited)
    }

    this.parentNode.childNodes[2].src = updateHpPic(maxField.value, currentField.value);
}

/**
 * Returns the HP-bar picture for the form's HP values. Passes the temp HP *value*
 * (blank counts as 0): passing the box itself always showed the temp HP bar.
 */
function updateHpPic(maxHp, currentHp)
{
    let tempHp = document.getElementById("tempHp").value.trim();
    if(tempHp == "" || parseInt(tempHp) == 0){tempHp = "0";}
    return returnHpImage(maxHp, tempHp, currentHp);
}

/**
 * Throws away the current tool's contents by replacing #story with a fresh empty one.
 */
function resetState()
{
    let aboveDiv = div.parentElement;
    div.remove();
    div = document.createElement("div");
    div.id = "story";
    div.classList = "bg-oak text-parchment col-md-12 col-sm-12";
    placeBefore(div, aboveDiv.childNodes[1]);
}

/**
 * After 1.5s (to let the save land), redraw the Remove Token list.
 */
function resetDelete()
{
    setTimeout(() => {resetState(); handleRemove();}, 1500);
}

/**
 * After 1.5s, redraw the Quick Change Hp list.
 */
function resetQuick()
{
    setTimeout(() => {resetState(); handleQuick();}, 1500);
}

/**
 * After 1.5s, redraw the Preset Tokens list.
 */
function resetPreset()
{
    setTimeout(() => {resetState(); handlePreset();}, 1500);
}

/**
 * After 1.5s, redraw the Summons list.
 */
function resetSummons()
{
    setTimeout(() => {resetState(); handleSummons();}, 1500);
}

/**
 * "Quick Change Hp": lists every visible token with its position and an editable
 * current-HP box plus an Upload button each.
 */
function handleQuick()
{
    hideButtons();

    let curDate = new Date().toLocaleTimeString();
    let date = document.createElement("h3");
    date.innerHTML = `Current Hps at time of ${curDate}`;
    div.appendChild(date);

    for(let key of Object.keys(window.top.parent.wholeDB))
    {
        if(typeof window.top.parent.wholeDB[key] != "object"){continue;} //Skip the map setting (currentMap/map), it isn't a token
        if(key != "invisible" && window.top.parent.wholeDB[key].border != "invisible")
        {
            makeToken(window.top.parent.wholeDB[key]);
            let currentDiv = document.getElementById(`${window.top.parent.wholeDB[key].id}-div`);
            let names = ["xPos", "yPos", "currentHp", "maxHp"];
            let feilds = [document.createElement("h6"), document.createElement("h6"), document.createElement("input"), document.createElement("h6")]
            
            feilds[0].innerHTML = window.top.parent.wholeDB[key].xPos;
            feilds[1].innerHTML = window.top.parent.wholeDB[key].yPos;
            feilds[2].value = window.top.parent.wholeDB[key].currentHp;
            feilds[2].id = "newHp_" + window.top.parent.wholeDB[key].id;
            feilds[2].style.width = "60px";
            feilds[3].innerHTML = window.top.parent.wholeDB[key].maxHp;

            for(let i = 0; i < 4; i++)
            {
                let label = createLabel(names[i]);

                label.style.margin = `5px`;

                feilds[i].style.display = "inline";
                currentDiv.appendChild(label);
                currentDiv.appendChild(feilds[i]);
            }

            let upload = makeRowButton("Upload", quickUpdate);
            upload.id = window.top.parent.wholeDB[key].id;
            currentDiv.appendChild(upload);
        }
    }

    addDone();
}

/**
 * Saves the new current HP for one token from the Quick Change Hp list. Only currentHp is
 * written, so temp HP, AC, summon flag and everything else on the token stay as they are.
 */
function quickUpdate()
{
    let i = this.id;
    let newHp = document.getElementById('newHp_' + i);

    setDoc(`currentMap/${i}/currentHp`, newHp.value);

    resetQuick();
}

/**
 * "Preset Tokens" (or "Summons", depending on preOrSumm): lists the saved tokens with
 * Edit / Delete / Upload (= put on the map) buttons, and a Create New button.
 */
function handlePreset()
{
    hideButtons();
    if(preOrSumm == undefined){preOrSumm = 0;}
    db = [window.top.parent.wholePre ?? {}, window.top.parent.wholeSummons ?? {}];

    for(let token of Object.keys(db[preOrSumm]))
    {
        let entry = db[preOrSumm][token];

        //Only list whole tokens. The summons list also holds leftover scraps with just a
        //position (from the old isSummon:"false" bug); one of those used to crash this screen
        //before its buttons (and Done) were added.
        if(token == "isSummonOn" || entry == null || typeof entry != "object" || typeof entry.name != "string")
        {
            continue;
        }

        if(entry.id == undefined){entry.id = token;} //makeToken names the row after the id
        makeToken(entry);
        let currentDiv = document.getElementById(`${db[preOrSumm][token].id}-div`);
        let names = ["Edit", "Delete", "Upload"]; //Upload = put it on the map
        let feilds = [];

        for(let i = 0; i < 3; i++)
        {
            //Each button already says what it does, so no "Edit:" style label in front of it
            feilds[i] = makeRowButton(names[i]);
            //The entry's own key, not its picture name: purifier1..purifier4 all use the
            //"purifier" picture, so the name would point every button at purifier.
            feilds[i].dataset.key = token;
            currentDiv.appendChild(feilds[i]);
        }

        feilds[0].onclick = addPreset;
        feilds[1].onclick = deletePreset;
        feilds[2].onclick = addToMap;
    }
    
    let addButton = document.createElement("button");
    addButton.innerHTML = "Create New";
    addButton.onclick = function () {addPreset();};

    if(preOrSumm == 1){addActions(makeSummonToggle(), addButton);}
    else{addActions(addButton);}
}

/**
 * Delete on a preset or summon row: deletes that entry and redraws the list.
 */
function deletePreset()
{
    let key = this.dataset.key;

    if(preOrSumm == 1)
    {
        deleteDoc(`playerChar/Vi/summons/${key}`); //Summons live straight under summons/ (there's no summonPreset folder)
        resetSummons();
    }

    else
    {
        deleteDoc(`preset/${key}`);
        resetPreset();
    }
}

/**
 * Opens the edit form for a preset. Called with no token (Create New) it starts from a
 * blank invisible token.
 */
function addPreset()
{
    let token;
     
    if(this?.dataset?.key == undefined) //Create New (not a row's Edit button)
    {
        token = {border : "invisible", currentHp : "20", maxHp : "20", tempHp : "0", isSummon: false, map : "", name : "invisible-", title : " ", xPos : "1", yPos : "A", ac: "10"};
        if(preOrSumm == 1){token["isSummon"] = true};
        db[preOrSumm]["invisible"] = token;
        presetKey = null; //New entry: Upload picks a key from its picture name
    }
    else
    {
        presetKey = this.dataset.key;
        token = db[preOrSumm][presetKey];
        if(token.id == undefined){token.id = presetKey;}
    }

    resetState();
    makeToken(token);
    editDiv = document.getElementById(`${token.id}-div`);
    temp = token.name;
    mode = "preset";
    handleEdit();
    mode = "";
    let editBtn = document.getElementById("edit");
    editBtn.onclick = updatePreset;
    editBtn.innerHTML = "Upload";
    document.getElementById("reset").onclick = resetPreset; //Back returns to the list (the form's Upload / Back are this screen's buttons)
}

/**
 * Saves the edited preset (to preset/) or summon (to playerChar/Vi/summons/) and redraws the list.
 */
function updatePreset()
{
    mode = "preset";
    addToken();
    mode = undefined;
    resetPreset();
}

/**
 * Puts a preset onto the map. If its id is already taken it adds a number
 * (goblin -> goblin1 -> goblin2 ...) so several copies can be on the map.
 */
function addToMap()
{
    let key = this.dataset.key;
    let token = {...db[preOrSumm][key]}; //A copy, so the preset itself keeps its own id
    let id = token.id ?? key;
    
    if(Object.keys(window.top.parent.wholeDB).includes(id))
    {
        id = id + "1";

        while(Object.keys(window.top.parent.wholeDB).includes(id))
        {
            id = id.slice(0, id.length - 1) + (parseInt(id.charAt(id.length - 1)) + 1);
        }
    }

    token["id"] = id;
    setDoc(`currentMap/${id}`, token);
}

/**
 * "Summons": adds a Turn Summons On/Off switch (when on, a player's summons appear with
 * them on the map) and then lists the summon presets like handlePreset().
 */
function handleSummons()
{
    if(preOrSumm == undefined){preOrSumm = 1;}
    handlePreset(); //Adds the Turn Summons On/Off switch to its button row
}

/**
 * The Summons screen's Turn Summons On / Off switch.
 */
function makeSummonToggle()
{
    let changeIsSummons = document.createElement("button");
    if(window.top.parent.wholeSummons["isSummonOn"]){changeIsSummons.innerHTML = "Turn Summons Off";}
    else{changeIsSummons.innerHTML = "Turn Summons On";}
    changeIsSummons.onclick = (event) => 
        {
            if(window.top.parent.wholeSummons["isSummonOn"]){changeIsSummons.innerHTML = "Turn Summons On"; setDoc(`playerChar/Vi/summons/isSummonOn`, false);}
            else{changeIsSummons.innerHTML = "Turn Summons Off"; setDoc(`playerChar/Vi/summons/isSummonOn`, true);}
        };
    return changeIsSummons;
}

/**
 * Adds one editable row to the turn-order tool: name, order number, "selected"
 * (true = it's their turn) and a Remove button.
 */
function makeTORow(key)
{
    let TORow = [document.createElement("div"), ["Name", "Order", "Selected"], [document.createElement("h6"), document.createElement("input"), document.createElement("input"), document.createElement("button")]];
    TORow[0].id = `${key.charName}-div`;
    TORow[0].classList = "bg-stone objectBorder center toRow";

    for(let i = 0; i < 3; i++)
    {
        let group = document.createElement("span"); //"Label: box" kept together, with space around each group
        group.classList = "toField";
        let label = createLabel(TORow[1][i]);
        label.style.margin = "0";

        TORow[2][i].id = `${TORow[1][i]}_${key.charName}`;
        group.appendChild(label);
        group.appendChild(TORow[2][i]);
        TORow[0].appendChild(group);
    }

    TORow[2][3].innerHTML = "Remove";
    TORow[2][3].classList = "rowButton";
    TORow[2][3].onclick = removeFromTO;
    TORow[2][3].id = `${key.charName}_Remove`;
    TORow[0].appendChild(TORow[2][3]);
    placeBefore(TORow[0], div.firstChild);
}

/**
 * Removes the listed keys from an object and returns it.
 */
function DeleteKeys(myObj, array) 
{
    for (let index = 0; index < array.length; index++) 
    {
        delete myObj[array[index]];
    }

    return myObj;
}

/**
 * Remove button on a turn-order row: drops that character from the list being edited.
 */
function removeFromTO()
{
    let nodeName = this.id.replace("_Remove", "");

    if(Object.keys(window.top.parent.wholeTO).includes(nodeName))
    {
        window.top.parent.wholeTO = DeleteKeys(window.top.parent.wholeTO, [nodeName]);
    }

    document.getElementById(`${nodeName}-div`).remove();
}

/**
 * Adds a new character to the turn order being edited (position 0, not selected).
 */
function addTORow(rowName)
{
    if(window.top.parent.wholeTO == null){window.top.parent.wholeTO = {};}
    let newRow = {charName : rowName, position : 0, selected : false};
    window.top.parent.wholeTO[rowName] = newRow;
    makeTORow(newRow);

    let feilds = [document.getElementById(`Name_${rowName}`), document.getElementById(`Order_${rowName}`), document.getElementById(`Selected_${rowName}`)];
            
    feilds[0].innerHTML = newRow.charName;
    feilds[1].value = newRow.position;
    feilds[2].value = newRow.selected;
}

/**
 * "Turn Order": shows the current turn order as editable rows (after 1.5s, so the data
 * is fresh), plus a box and Add button for new rows and an Upload button.
 */
function handleTurn()
{
    hideButtons();
    setTimeout(() => 
    {
        if(window.top.parent.wholeTO != null)
        {
            for(let key of Object.keys(window.top.parent.wholeTO))
            {
                if(window.top.parent.wholeTO[key].charName)
                {
                    makeTORow(window.top.parent.wholeTO[key]);
                    let feilds = [document.getElementById(`Name_${window.top.parent.wholeTO[key].charName}`), document.getElementById(`Order_${window.top.parent.wholeTO[key].charName}`), document.getElementById(`Selected_${window.top.parent.wholeTO[key].charName}`)]
                    
                    feilds[0].innerHTML = window.top.parent.wholeTO[key].charName;
                    feilds[1].value = window.top.parent.wholeTO[key].position;
                    feilds[2].value = window.top.parent.wholeTO[key].selected;
                } 
            }
        }
    
        //New row: name box with a small Add button beside it
        let newRowLine = document.createElement("div");
        let rowName = document.createElement("input");
        let addButton = makeRowButton("Add", function () {addTORow(rowName.value); rowName.value = "";});
        newRowLine.style.textAlign = "center";
        rowName.id = "newRow";
        rowName.placeholder = "Name of New Row";
        addButton.id = "AddTO";
        newRowLine.appendChild(rowName);
        newRowLine.appendChild(addButton);
        div.appendChild(newRowLine);

        let uploadButton = document.createElement("button");
        uploadButton.innerHTML = "Upload";
        uploadButton.id = "UploadTO";
        uploadButton.onclick = uploadTO;
        addActions(uploadButton);
    }, 1500);
}

/**
 * Saves the edited turn order: clears currentTO/, writes each row, resets the turn
 * counter to 1 and clears every character's rage flag. Reloads after 4s.
 */
function uploadTO()
{
    temp = window.top.parent.wholeTO;
    emptyTOCollection();
    deleteDoc("currentTO/Var");

    for(let key of Object.keys(temp))
    {   
        setTimeout(() => {uploadRowTO(key)}, 250);
    }

    setDoc(`currentTO/Var/currentTurn`, 1);

    for(let person of Object.keys(window.top.parent.wholeChar))
    {
        setDoc(`playerChar/${person}/rage`, false);
    }

    wait(4, handleDone);
}

/**
 * Writes one turn-order row from the form, plus an empty slot in currentTO/Var/<name>
 * where that character's running spells/abilities get tracked.
 */
function uploadRowTO(key)
{
    setDoc(`currentTO/${key}`,
    {
        charName : document.getElementById(`Name_${temp[key].charName}`).innerHTML,
        position : document.getElementById(`Order_${temp[key].charName}`).value,
        selected : document.getElementById(`Selected_${temp[key].charName}`).value
    });

    setDoc(`currentTO/Var/${key}`, {"temp" : "temp"});
}

/**
 * "Change Map": a big preview of the chosen map, a scrolling grid of every map picture
 * (with names) to pick from, and a Change button. Opens on the map that's showing now.
 */
function handleChangeMap()
{
    hideButtons();

    let maps = window.top.parent.imgs["mapName"];
    let keys = Object.keys(maps).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}));
    let current = window.top.parent.wholeDB["map"];
    if(maps[current] == undefined){current = keys[0];}

    let chosen = document.createElement("input"); //Holds the picked map's name for updateMap()
    chosen.type = "hidden";
    chosen.id = "select";

    let previewBox = document.createElement("figure");
    previewBox.classList = "mapPreview";
    let preview = document.createElement("img");
    let previewName = document.createElement("figcaption");
    previewBox.appendChild(preview);
    previewBox.appendChild(previewName);

    let grid = document.createElement("div");
    grid.classList = "imgPicker open mapGrid";

    function pick(key)
    {
        chosen.value = key;
        preview.src = maps[key];
        preview.alt = key;
        previewName.innerHTML = key == window.top.parent.wholeDB["map"] ? `${key} (showing now)` : key;
        for(let cell of grid.children){cell.classList.toggle("picked", cell.dataset.key == key);}
    }

    for(let key of keys)
    {
        let cell = document.createElement("figure");
        let img = document.createElement("img");
        let name = document.createElement("figcaption");

        cell.dataset.key = key;
        cell.title = key;
        img.src = maps[key];
        img.alt = key;
        img.loading = "lazy";
        img.onerror = function () {cell.remove();}; //Skip maps whose picture is gone
        name.innerHTML = key;

        cell.appendChild(img);
        cell.appendChild(name);
        cell.onclick = function () {pick(key);};
        grid.appendChild(cell);
    }

    let button = document.createElement("button");
    button.innerHTML = "Upload";
    button.onclick = updateMap;

    div.appendChild(previewBox);
    div.appendChild(grid);
    div.appendChild(chosen);
    pick(current);
    let picked = grid.querySelector(".picked");
    if(picked){picked.scrollIntoView({block: "nearest"});}
    addActions(button);
}

/**
 * Saves the chosen map picture (currentMap/map) so every player's map switches.
 */
function updateMap()
{
    setDoc(`currentMap/map`, document.getElementById("select").value);

    handleDone();
}

/**
 * Adds a dropdown of saved boards (from lists/), filled in after 1.5s once they've loaded.
 */
function listSelect()
{
    let collectionNames = [];
    const tempRef = ref(database, `lists/`);
    onValue(tempRef, (snapshot) => 
    {
        const data = snapshot.val();
        for(let point of Object.keys(data))
        {
            collectionNames.push(point);
        }
    });

    let selectNames = document.createElement("select");

    setTimeout(() => 
    {
        for(let cName of collectionNames)
        {
            if(cName != "currentMap")
            {
                let option = document.createElement("option");
                option.value = cName;
                option.text = cName;
                selectNames.appendChild(option); 
            }  
        }
    }, 1500);

    selectNames.classList = "center blo";
    selectNames.id = "selectNames";

    div.appendChild(selectNames);
}

/**
 * "Save Map": pick an existing save to overwrite or type a new save name.
 */
function handleSave()
{
    hideButtons();
    listSelect();

    let saveName = document.createElement("input");
    let label = createLabel(`Save Name`);
    let button = document.createElement("button");
    
    let nameLine = document.createElement("div"); //Label and box centred together
    nameLine.style.textAlign = "center";
    label.style.margin = "5px";
    saveName.id = "saveName";
    saveName.style.margin = "5px";
    button.innerHTML = "Save";
    button.onclick = handleUploadeSave;
    
    nameLine.appendChild(label);
    nameLine.appendChild(saveName);
    div.appendChild(nameLine);
    addActions(button);
}

/**
 * Copies every token on the current map into the save (a top-level database path named
 * after the save) and records the name in lists/. An empty name overwrites the picked save.
 */
function handleUploadeSave()
{
    let saveName = document.getElementById("saveName");
    let selectNames = document.getElementById("selectNames");
    let cName = saveName.value;

    if(saveName.value == "")
    {
        cName = selectNames[selectNames.selectedIndex].value;
        emptyCollection(cName);
    }

    for(let key of Object.keys(window.top.parent.wholeDB))
    {
        setDoc(`${cName}/${key}`, window.top.parent.wholeDB[key]);
    }

    setDoc(`${cName}/${Object.keys(window.top.parent.wholeDB)[0]}`, window.top.parent.wholeDB[Object.keys(window.top.parent.wholeDB)[0]]);

    window.top.parent.wholeDB[Object.keys(window.top.parent.wholeDB)[0]]

    setDoc(`lists/${cName}`, {name : `${cName}`});

    handleDone();
}

/**
 * Deletes everything at the top-level database path `cName`.
 */
function emptyCollection(cName)
{
    deleteDoc(`${cName}/`);
}

/**
 * Deletes the whole turn order (currentTO/).
 */
function emptyTOCollection()
{
    deleteDoc(`currentTO/`);
}

/**
 * "Load Map": pick a saved board and Load it.
 */
function handleLoad()
{
    hideButtons();
    listSelect();

    let goButton = document.createElement("button");

    goButton.innerHTML = "Load";
    goButton.onclick = loadMap;
    addActions(goButton);
}

/**
 * Clears the current map and copies every token from the chosen save onto it.
 */
function loadMap()
{
    let selectNames = document.getElementById("selectNames");
    let cName = "";
    cName = selectNames[selectNames.selectedIndex].value;
    emptyCollection("currentMap");

    const tempRef = ref(database, `${cName}/`);
    onValue(tempRef, (snapshot) => 
    {
        const data = snapshot.val();
        window.top.parent.wholeDB = data;
    });

    setTimeout(() => 
    {  
        temp = window.top.parent.wholeDB;
        for(let key of Object.keys(temp))
        {
            setDoc(`currentMap/${key}`, temp[key]);
        }

        handleDone();
    }, 90);
}

/**
 * "Delete Map": pick a saved board and delete it.
 */
function handleDelete()
{
    hideButtons();
    listSelect();

    let goButton = document.createElement("button");

    goButton.innerHTML = "Delete";
    goButton.onclick = deleteMap;
    addActions(goButton);
}

/**
 * Deletes the chosen saved board and its entry in lists/.
 */
function deleteMap()
{
    let selectNames = document.getElementById("selectNames");
    let cName = "";
    cName = selectNames[selectNames.selectedIndex].value;

    selectNames.remove(selectNames.selectedIndex);
    deleteDoc(cName);
    deleteDoc(`lists/${cName}`);
}

/**
 * "Interactive": a form to push a popup to every player: text, an image link, or one of
 * the preset "push" pictures from the dropdown below.
 */
function handleInteractive()
{
    hideButtons();
    let labels = ["iText", "iURL"];
    let elms = [document.createElement("input"), document.createElement("input")];

    for(let i = 0; i < labels.length; i++)
    {
        let divider = document.createElement("span");
        divider.style.display = "block";

        let label = createLabel(labels[i]);
        label.style.padding = "5%";
        elms[i].id = labels[i];
        elms[i].type = "text";
        
        div.appendChild(label);
        div.appendChild(elms[i]);
        div.appendChild(divider);
    }

    let uploadButton = document.createElement("button");
    uploadButton.innerHTML = "Upload";
    uploadButton.onclick = handleUploadInteractive;

    displayInteractive(addActions(uploadButton)); //Picture dropdown goes above the button row
}

/**
 * Builds the picture dropdown for the Interactive tool from files/push.
 */
function displayInteractive(buttonRow)
{
    let labels = ["Push"];
    let selects = [document.createElement("div")];
    
    for(let i = 0; i < labels.length; i++)
    {
        let label = createLabel(labels[i]);

        label.style.padding = "5%";
        placeBefore(selects[i], buttonRow);
        placeBefore(label, selects[i]);
        selects[i].classList = "ddown ddownHide sDropdown";
        selects[i].id = labels[i];
        selects[i].style.width = "100%";

        let dropBtn = document.createElement("button");
        dropBtn.classList.add("dropbtn");
        dropBtn.classList.add(labels[i]);
        dropBtn.id = `${labels[i]}Button`;
        dropBtn.onclick = handleShowSelect; //
        placeBefore(dropBtn, selects[i]);

        let selectDiv = document.createElement("div");
        selectDiv.classList.add("ddown-content");
        selectDiv.classList.add("large");
        selects[i].appendChild(selectDiv);
        selectDiv.id = `${labels[i]}Select`;

        //Use the image list's own names; cutting a name out of a Firebase Storage address
        //gave junk, so Upload saved "undefined" as the picture.
        let pushImages = window.top.parent.imgs["push"] ?? {};

        for(let name of Object.keys(pushImages))
        {
            let img = document.createElement("img");
            img.src = pushImages[name];
            img.onclick = changeSourceSelect; 
            img.dataset.button = dropBtn.id;
            img.dataset.name = name;
            img.title = name;
            img.onerror = function () {this.remove();};
            selectDiv.appendChild(img);
        }
    }
}

/**
 * Builds one editable quest card: title, description, status, an Active Quest checkbox
 * and a delete icon. "empty" makes a blank one.
 */
function createQuestCard(quest)
{
    let card = document.createElement("div");
    let cardBody = document.createElement("div");
    let title = document.createElement("input");
    let text = document.createElement("textarea");
    let status = document.createElement("input");
    let active = document.createElement("input");
    let deleteBtn = document.createElement("img");
    let spacer = document.createElement("span");
    let desc = createLabel("Desc");

    if(quest != "empty")
    {
        card.id = `${window.top.parent.wholeQuests[quest]["name"]}-div`;
        title.id = `${window.top.parent.wholeQuests[quest]["name"]}-title`;
        text.id = `${window.top.parent.wholeQuests[quest]["name"]}-text`;
        status.id = `${window.top.parent.wholeQuests[quest]["name"]}-status`;
        active.id = `${window.top.parent.wholeQuests[quest]["name"]}-activeQuest`;
        deleteBtn.id = `${window.top.parent.wholeQuests[quest]["name"]}-delete`;

        title.value = window.top.parent.wholeQuests[quest]["name"];
        text.value = window.top.parent.wholeQuests[quest]["Desc"];
        status.value = window.top.parent.wholeQuests[quest]["status"];
        active.checked = window.top.parent.wholeQuests[quest]["activeQuest"];
    }

    else
    {
        card.id = `empty-div`;
        title.id = `empty-title`;
        text.id = `empty-text`;
        status.id = `empty-status`;
        active.id = `empty-activeQuest`;
        deleteBtn.id = `empty-delete`;
    }

    card.classList = "card text-parchment bg-oak-deep";
    cardBody.classList = "card-body";
    
    title.classList = "basicMargin text-parchment";
    title.style.display = "inline";
    
    text.classList = "basicMargin card-text";
    text.style.display = "inline";
    text.style.width = "30vw";
    text.style.height = "15vw";

    status.style.display = "inline";
    status.classList = "basicMargin";

    active.type = "checkbox";
    active.style.display = "inline";
    active.classList = "basicMargin";

    deleteBtn.src = "images/trashIcon.png";
    deleteBtn.onclick = handleDeleteQuest;
    deleteBtn.classList = "basicMargin";
    spacer.style.display = "block";

    desc.style.transform = "translateY(-7.5vw)";

    card.appendChild(cardBody);
    cardBody.appendChild(createLabel("Title"));
    cardBody.appendChild(title);
    cardBody.appendChild(document.createElement("div"));
    cardBody.appendChild(desc);
    cardBody.appendChild(text);
    cardBody.appendChild(document.createElement("div"));
    cardBody.appendChild(createLabel("Status"));
    cardBody.appendChild(status);
    cardBody.appendChild(document.createElement("div"));
    cardBody.appendChild(createLabel("Active Quest"));
    cardBody.appendChild(active);
    cardBody.appendChild(document.createElement("div"));
    cardBody.appendChild(deleteBtn);

    return card;
}

/**
 * Removes a quest card from the editor (saved when Upload is pressed).
 */
function handleDeleteQuest()
{
    this.parentElement.parentElement.remove();
}

/**
 * Adds a blank quest card above the button row.
 */
function handleCreateQuest()
{
    placeBefore(createQuestCard("empty"), this.closest(".actionRow") ?? this); //New card goes above the button row
}

/**
 * Reads every quest card and replaces the whole quest list (playerChar/Vi/quests).
 */
function uploadQuests()
{
    let children = div.children;
    let quests = {};

    for(let child of children)
    {
        if(!child.id.includes("-div")){continue;}
        
        let quest = child.id.slice(0, child.id.indexOf("-div"));

        quests[document.getElementById(`${quest}-title`).value] = 
        {
            "Desc" : document.getElementById(`${quest}-text`).value,
            "activeQuest" : document.getElementById(`${quest}-activeQuest`).checked,
            "name" : document.getElementById(`${quest}-title`).value,
            "status" : document.getElementById(`${quest}-status`).value
        }
    }

    //The hidden placeholder keeps playerChar/Vi/quests from ever being empty
    quests[QUEST_PLACEHOLDER] = {"Desc" : "Placeholder", "activeQuest" : false, "name" : QUEST_PLACEHOLDER, "status" : "placeholder"};
    setDoc("playerChar/Vi/quests", quests);
    wait(4, handleDone); //Give the save a moment before reloading
}

/**
 * "Quests": shows every quest as an editable card with Create / Upload / Done buttons.
 */
function handleQuest()
{
    hideButtons();
    
    let buttons = ["Create", "Upload"];
    let actionButtons = [];

    for(let quest of Object.keys(window.top.parent.wholeQuests ?? {}))
    {
        if(quest == QUEST_PLACEHOLDER){continue;} //Hidden: it only keeps the quest list from being empty
        div.appendChild(createQuestCard(quest));
    }

    for(let button of buttons)
    {
        let btn = document.createElement("button");
        btn.innerHTML = button;
        btn.id = button;

        switch(button)
        {
            case "Create":
                btn.onclick = handleCreateQuest;
                break;

            case "Upload":
                btn.onclick = uploadQuests;
                break;
        }

        actionButtons.push(btn);
    }

    addActions(...actionButtons);
}

/**
 * A picture in the dropdown was clicked: show its name on the dropdown button.
 */
function changeSourceSelect()
{
    let select = document.getElementById(this.dataset.button);
    for(let img of Array.from(this.parentNode.getElementsByClassName("picked"))){img.classList.remove("picked");}
    this.classList.add("picked");
    select.innerHTML = this.dataset.name;
    select.click();
}

/**
 * Opens or closes a picture dropdown (and closes any other open one).
 */
function handleShowSelect()
{
    let divs = document.getElementsByClassName("sDropdown");

    for(let div of divs)
    {
        if(div.id == this.classList[1])
        {
            if(div.classList.contains("ddownHide"))
            {
                div.classList.remove("ddownHide");
                div.classList.add("ddownShow");
            }
        
            else if(div.classList.contains("ddownShow"))
            {
                div.classList.remove("ddownShow");
                div.classList.add("ddownHide");
            }
        }

        else
        {
            div.classList.remove("ddownShow");
            div.classList.add("ddownHide");
        }
    }
    
}

/**
 * Sends the Interactive popup to everyone (playerChar/Vi/interactive). A picture picked
 * from the dropdown wins over a typed image link.
 */
function handleUploadInteractive()
{
    let text = document.getElementById("iText");
    let img = document.getElementById("iURL");
    let select = document.getElementById("PushButton");
    let src = img.value;

    if(select.innerHTML != ""){src = window.top.parent.imgs["push"][select.innerHTML];}
    let obj = {"image" : `${src}`, "text" : `${text.value}`};

    setDoc("playerChar/Vi/interactive", obj);
    handleDone();
}

/**
 * Development helper: copies the "Okami" character to create four test players.
 */
function handleGenerate()
{
    hideButtons();
    handleDone();
    backupFavorites();
}

/**
 * Merges every player's favourite spells and actions into the site's spell and action
 * lists and downloads them as spells.json and actions.json (to update src/).
 */
function backupFavorites()
{
    let classes = ["Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard", "Infused Abilities"];

    for(let player of Object.keys(window.top.parent.wholeChar))
    {
        let favoriteSpells = window.top.parent.wholeChar[player]["favorites"]["spells"];
        let favoriteActions = window.top.parent.wholeChar[player]["favorites"]["actions"];

        for(let spellLv of Object.keys(favoriteSpells))
        {
            for(let spell of Object.keys(favoriteSpells[spellLv]))
            {
                if(spell != "hold"){window.top.parent.wholeSpells[spellLv][spell] = favoriteSpells[spellLv][spell]};
            }
        }

        for(let tag of Object.keys(favoriteActions))
        {
            for(let action of Object.keys(favoriteActions[tag]))
            {
                if(action != "hold")
                {
                    if(!classes.includes(tag))
                    {
                        window.top.parent.wholeActions["Misc"][action] = favoriteActions[tag][action];
                    }
    
                    else{window.top.parent.wholeActions[tag][action] = favoriteActions[tag][action];}
                }
            }
        }
    }

    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.top.parent.wholeSpells));
    let dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", "spells.json");
    dlAnchorElem.click();

    dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.top.parent.wholeActions));
    dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", "actions.json");
    dlAnchorElem.click();
}

/**
 * "Upload Image": a form to choose the type (token / push / item / map), a name and a file.
 */
function handleUploadImage()
{
    // 1. Wipe out the main control grid layout buttons 
    hideButtons();

    // --- STEP 3: CHOOSE ASSET TYPE DROPDOWN (<select>) ---
    let selectLabel = document.createElement("label");
    selectLabel.innerHTML = "Select Image Type: ";
    selectLabel.style.fontWeight = "bold";
    selectLabel.style.margin = "10px";

    let assetSelect = document.createElement("select");
    assetSelect.id = "dm-asset-type-select";
    assetSelect.style.margin = "10px";
    assetSelect.style.padding = "5px";

    // Set options exactly as requested
    let choices = [
        { value: "token", display: "Token Image" },
        { value: "push", display: "Push Image" },
        { value: "item", display: "Item Image" },
        { value: "map", display: "Map Image" }
    ];

    choices.forEach(choice => {
        let option = document.createElement("option");
        option.value = choice.value;
        option.text = choice.display;
        assetSelect.appendChild(option);
    });

    // --- STEP 4: TRACKING NAME INPUT (<input type="text">) ---
    let nameLabel = document.createElement("label");
    nameLabel.innerHTML = "File Name / Label: ";
    nameLabel.style.fontWeight = "bold";
    nameLabel.style.margin = "10px";

    let assetNameInput = document.createElement("input");
    assetNameInput.type = "text";
    assetNameInput.id = "dm-asset-name-input";
    assetNameInput.placeholder = "couch (No -, it adds it for you)";
    assetNameInput.style.margin = "10px";
    assetNameInput.style.padding = "5px";

    // --- STEP 5: FILE SELECTOR (<input type="file">) ---
    let fileLabel = document.createElement("label");
    fileLabel.innerHTML = "Choose File: ";
    fileLabel.style.fontWeight = "bold";
    fileLabel.style.margin = "10px";

    let assetFileInput = document.createElement("input");
    assetFileInput.type = "file";
    assetFileInput.id = "dm-asset-file-input";
    assetFileInput.accept = "image/*"; // Handshakes with system to filter to graphics
    assetFileInput.style.margin = "10px";

    // --- STEP 6: UPLOAD EXECUTION TRIGGER (<button>) ---
    let uploadBtn = document.createElement("button");
    uploadBtn.id = "dm-upload-btn";
    uploadBtn.innerHTML = "Upload";

    // Empty template for your upcoming Firebase Storage integration execution block
    uploadBtn.onclick = uploadImage;

    // --- STEP 7: APARTMENT STRUCTURE WRAPPER & INJECTION ---
    let formWrapper = document.createElement("div");
    formWrapper.id = "dm-upload-form-wrapper";
    formWrapper.style.padding = "20px";
    formWrapper.style.textAlign = "left";

    // Grouping structure elements cleanly with linebreaks to stack symmetrically
    formWrapper.appendChild(selectLabel);
    formWrapper.appendChild(assetSelect);
    formWrapper.appendChild(document.createElement("br"));

    formWrapper.appendChild(nameLabel);
    formWrapper.appendChild(assetNameInput);
    formWrapper.appendChild(document.createElement("br"));

    formWrapper.appendChild(fileLabel);
    formWrapper.appendChild(assetFileInput);
    formWrapper.appendChild(document.createElement("br"));

    // Append the whole setup box to your global 'story' div workspace element 
    div.appendChild(formWrapper);

    // 8. Upload and Done share the tool's button row
    addActions(uploadBtn);
}

/**
 * Uploads the chosen picture: compresses it, stores it in Firebase Storage, and records
 * its link under files/<type>/<name>. Items also ask for a description.
 */
/**
 * Resolves to the picture file's real size in pixels: {width, height}.
 */
function getImageSize(file)
{
    return new Promise((resolve) =>
    {
        let img = new Image();
        img.onload = () => {resolve({width: img.naturalWidth, height: img.naturalHeight}); URL.revokeObjectURL(img.src);};
        img.onerror = () => resolve({width: 0, height: 0});
        img.src = URL.createObjectURL(file);
    });
}

async function uploadImage()
{
    let type = document.getElementById("dm-asset-type-select").value;
    let name = document.getElementById("dm-asset-name-input").value;
    let files = document.getElementById("dm-asset-file-input").files;
    let dbPath, storagePath;
    let desc = "";
    let toUpload;

    if (!files || files.length === 0) 
    {
        alert("Please select a file first!");
        return;
    }

    let options = 
    {
        maxSizeMB: 0.4,          // Max size 200KB (Perfect for tokens/sheets)
        maxWidthOrHeight: 1024, // Keeps it crisp but not massive
        useWebWorker: true
    };

    switch (type)
    {
        case "token":
            dbPath = `files/tokens/${name}-`;
            storagePath = `images/map/tokens/${name}-`;
            options.maxWidthOrHeight = 73;
            break;

        case "push":
            dbPath = `files/push/${name}`;
            storagePath = `images/push/${name}`;
            break;  

        case "item":
            dbPath = `files/items/${name}`;
            storagePath = `images/items/${name}`;
            desc = prompt("Please write the description of said item:", "Placeholder.");
            break;

        case "map":
            dbPath = `files/mapName/${name}`;
            storagePath = `images/map/${name}`;
            options.maxWidthOrHeight = 2030;
            //Maps must stay 2030px: tokens are placed for a 2030px grid. With the 0.4MB limit
            //a detailed map (grass, stone) got shrunk to ~1300px and the grid no longer lined up.
            options.maxSizeMB = 4;
            break;
    }

    if(type == "map")
    {
        let size = await getImageSize(files[0]);
        if(size.width != 2030 || size.height != 2030)
        {
            let goOn = confirm(`This map is ${size.width} x ${size.height} pixels. Maps need to be 2030 x 2030 (the size of images/grid.png) or tokens won't line up with its squares. Upload anyway?`);
            if(!goOn){return;}
        }
    }

    try {
        const compressedFile = await imageCompression(files[0], options);
        
        // --- STEP 2: UPLOAD TO STORAGE ---
        // Saving it as the player's name ensures they only ever have ONE file (saves space)
        const storageRef = sRef(storage, storagePath);
        
        const snapshot = await uploadBytes(storageRef, compressedFile);
        
        // --- STEP 3: GET THE PERMANENT URL ---
        toUpload = await getDownloadURL(snapshot.ref);

        if(type == "item")
        {
            toUpload = {"desc": desc, "img": toUpload};
        }

        setDoc(dbPath, toUpload);
        alert("Upload Complete");
    } 
    
    catch (error) 
    {
        console.error("Compression or upload crashed:", error);
        return;
    }
}

/**
 * Opens this DM panel in a new browser tab.
 */
function handleOpenPage()
{
    let window = document.createElement("a");
    window.href = "dmSite.html";
    window.target = "_blank";
    window.click();
    handleDone();
}

/**
 * "Done": reloads back to the button grid (after 1s).
 */
function handleDone()
{
    setInterval(() => {location.reload();}, 1000);
}

/**
 * Clears the DM button grid before a tool is shown. Also runs the Vi-only check.
 */
function hideButtons()
{
    getUser(); 

    if(fiveButtons != [])
    {
        for(let button of fiveButtons)
        {
            button.remove();
        }

        fiveButtons = [];
    }
}

/**
 * Adds a Done button under the current tool.
 */
function addDone()
{
    return addActions();
}

/**
 * Adds the tool's bottom button row: the given buttons, then Done, all the same size and
 * centred together (.actionRow). Every DM tool uses this so its buttons match.
 * Returns the row, so things can be placed above it.
 */
function addActions(...buttons)
{
    let row = document.createElement("div");
    row.classList = "actionRow";

    let doneButton = document.createElement("button");
    doneButton.id = "done";
    doneButton.innerHTML = "Done";
    doneButton.onclick = handleDone;

    for(let button of [...buttons, doneButton])
    {
        button.classList.add("actionBtn");
        button.style.removeProperty("margin");
        button.style.removeProperty("width");
        button.style.removeProperty("padding");
        button.style.removeProperty("display");
        row.appendChild(button);
    }

    div.appendChild(row);
    return row;
}

/**
 * Makes a small button for inside a list row (a token, turn-order row...). All of them
 * share .rowButton so they're the same size everywhere.
 */
function makeRowButton(text, onclick)
{
    let button = document.createElement("button");
    button.innerHTML = text;
    button.classList = "rowButton";
    if(onclick){button.onclick = onclick;}
    return button;
}

/**
 * Saves the token from the edit form. A new token whose id is taken gets a number added.
 * It goes to currentMap/<id>, or preset/<id> when editing presets.
 * The isSummon box is text, so it's saved as a real true/false: the string "false" would
 * count as true everywhere the site checks isSummon.
 */
function addToken()
{
    let b = document.getElementById("border").value;
    let c = document.getElementById("currentHp").value;
    let mH = document.getElementById("maxHp").value;
    let tH = document.getElementById("tempHp").value;
    let n = document.getElementById("name").value;
    let t = document.getElementById("title").value;
    let x = document.getElementById("xPos").value;
    let y = document.getElementById("yPos").value;
    let s = document.getElementById("isSummon").value;
    let ac = document.getElementById("ac").value;
    if(ac.trim() == "" || ac == "undefined"){ac = "10";}
    let id = n.slice(0, n.indexOf("-"));
    
    if(Object.keys(window.top.parent.wholeDB).includes(id) && mode == "add")
    {
        id = id + "1";

        while(Object.keys(window.top.parent.wholeDB).includes(id))
        {
            id = id.slice(0, id.length - 1) + (parseInt(id.charAt(id.length - 1)) + 1);
        }

        mode = "none";
    }

    s = (s === true || `${s}`.trim().toLowerCase() == "true"); //Text box -> true/false

    let table = `currentMap/${id}`;
    if(mode == "preset")
    {
        let list = db[preOrSumm] ?? {};

        if(presetKey){id = presetKey;} //Editing: save over the same entry, even if its picture changed
        else
        {
            //New: don't overwrite an existing entry with the same picture (goblin -> goblin1...)
            let base = id;
            let number = 1;
            while(list[id] != undefined && id != "invisible"){id = `${base}${number}`; number++;}
        }

        if(preOrSumm == 1)
        {
            table = `playerChar/Vi/summons/${id}`;
            s = true; //Everything on the Summons list is a summon
        }

        else
        {
            table = `preset/${id}`;
        }
    }
 
    setDoc(table,
    {
        border : b,
        currentHp : c,
        maxHp : mH,
        tempHp : tH,
        isSummon : s,
        map : "",
        id : `${id}`,
        name : n,
        title : t,
        xPos : x,
        yPos : y,
        AC : ac
    });

    resetDelete();
}

/**
 * "Refresh Screens": choose a player whose page should reload.
 */
function handleRefresh()
{
    hideButtons();

    let playerSelect;
    let upload;

    playerSelect = document.createElement("select");
    playerSelect.id = "playerSelect";

    let allOption = document.createElement("option");
    allOption.value = REFRESH_ALL;
    allOption.innerHTML = "All Players";
    playerSelect.appendChild(allOption);
    
    for(let player of Object.keys(window.top.parent.wholeChar))
    {
        let playerOption = document.createElement("option");
        playerOption.value = player;
        playerOption.innerHTML = player;
        playerSelect.appendChild(playerOption);
    }

    upload = document.createElement("button");
    upload.innerHTML = "Upload";
    upload.onclick = handleRefreshUpload;

    div.appendChild(playerSelect);

    addActions(upload);
}

/**
 * Writes that player's name to playerChar/Vi/playerRefresh; parent.js on their page sees
 * it, clears it and reloads.
 */
function handleRefreshUpload()
{
    let playerToRefresh = document.getElementById("playerSelect").value;

    if(playerToRefresh == REFRESH_ALL)
    {
        //Everyone reloads. The time stamp lets each page reload once (parent.js remembers the
        //last one it handled), since no single player can clear it for everybody.
        setDoc("playerChar/Vi/playerRefresh", {"target" : REFRESH_ALL, "at" : Date.now()});
    }

    else
    {
        setDoc("playerChar/Vi/playerRefresh", playerToRefresh);
    }
    alert("Done");
}

init(); //Hook up the DM buttons
