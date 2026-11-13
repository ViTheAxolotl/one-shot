/**
 * selection.js — the Change Token page (selection.html).
 *
 * Where a player sets up the token that represents them on the battle map:
 *   1. pick a picture (their standard token from files/tokens, or a custom image they uploaded),
 *   2. pick a coloured border ring,
 *   3. enter Max / Current / Temp HP and AC,
 *   4. Go! saves the token to the map (currentMap/<Name>) and to their character
 *      (playerChar/<Player>/token), then sends them to the dashboard.
 * If they already had a token, its border, HP, title and map position are kept.
 *
 * Custom images: "Manage/Add Imgs" lets a player upload their own picture. It's compressed
 * in the browser, stored in Firebase Storage under images/map/tokens/, and listed in
 * files/tokens/<nickname>-. Token names end in "-" by convention.
 */

"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, clenseInput, deleteDoc, reload, placeBefore, storage } from './viMethods.js';
import { uploadBytes, getDownloadURL, ref as sRef } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
import imageCompression from 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.mjs';

let player;
let wholeChars = {};
let wholeCustom = {};
let wholeDb = {};
let enter = document.getElementById("enter");
let charName = document.getElementById("name");
let div = document.getElementById("story");
let borders = [];
let char = document.createElement("h3");
let bord = document.createElement("h3");
let hp = document.createElement("h3");
let go = document.createElement("button");
let people = [];
let firstRun = true;
let firstRunCustom = true;
let imgs = {};
let oldToken = {};
let firstLoad = true;

// Only the first read of character data is used to build the page.
const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    const data = snapshot.val();
    if(firstRun)
    {
        firstRun = false;
        wholeChars = data;
        userLoggedIn();
    }
});

const customsRef = ref(database, 'customImages/');

const dbRef = ref(database, 'currentMap/');
onValue(dbRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeDb = data;
});

// The list of border images lives in files/borders. Once it arrives, build the page.
const filesRef = ref(database, 'files/');
onValue(filesRef, (snapshot) => 
{
    const data = snapshot.val();
    imgs = data;

    if(firstLoad)
    {
        let temp = imgs["borders"];
        for(let border of Object.keys(temp)){if(border != "invisible"){borders.push([border, temp[border]]);}} //Populates the borders with each border
        firstLoad = false;
        setUpCharacters();
    }
});

onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        alert("You need to login before using this resource. Click Ok and be redirected");
        window.location.href = "loginPage.html?selection.html"; 
    } 
});

/**
 * Runs once character data arrives: works out who is logged in, remembers their
 * current token (oldToken) so its settings can be kept, and builds the headings.
 */
function userLoggedIn()
{
    player = auth.currentUser.email;
    player = player.split("@");
    player = toTitleCase(player[0]);
    oldToken = wholeChars[player]["token"];
    init();
    charName.value = wholeChars[player]["charName"];
}

/**
 * Creates the section headings (Select Character, Select Border, Current & Max Hp)
 * and the Go! button, ready to be placed by setUpCharacters().
 */
function init()
{
    char.innerHTML = "Select Character";
    char.classList = "blo";
    char.style.margin = "5px";
    bord.innerHTML = "Select Boarder";
    bord.classList = "blo";
    bord.style.margin = "5px";
    go.innerHTML = "Go!";
    go.classList = "blo";
    go.style.margin = "5px";
    hp.innerHTML = "Current & Max Hp";
    hp.classList = "blo";
    hp.style.margin = "5px";

    //enter.onclick = setUpCharacters;
    go.onclick = handleGoButton;
}

/**
 * Builds the page: hides the placeholder content, then adds the player's token pictures,
 * the border rings, the HP/AC boxes and Go!. If they already have a token, it
 * pre-selects their border and fills in their HP.
 */
function setUpCharacters()
{
    for(let elem of div.children)
    {
        elem.classList = "hide";
    }

    if(imgs["tokens"][player+"-"]){people.push(player+"-");}

    if(!people.includes(wholeChars[player]["token"]["name"]))
    {
        people.push(wholeChars[player]["token"]["name"]);
    }

    div.appendChild(char);

    addCharacters()
    addBorders();
    addHp();
    div.appendChild(go);

    onValue(customsRef, (snapshot) => 
    {
        const data = snapshot.val();
        wholeCustom = data;
        
        if(firstRunCustom)
        {
            addCustomImgs();
            firstRunCustom = false;
        }
    });

    if(oldToken != null || oldToken != undefined)
    {
        document.getElementById(`${oldToken["border"]}`).onclick();
        document.getElementById(`Max Hp`).value = oldToken["maxHp"];
        document.getElementById(`Current Hp`).value = oldToken["currentHp"];
        document.getElementById(`Temp Hp`).value = oldToken["tempHp"];
    }
}

/**
 * Opens the link stored in the clicked element's id in a new tab, then reloads. Not used now.
 */
function openWindow()
{    
    setInterval(() => {window.open(this.id, '_blank'); location.reload();}, 2000);   
}

/**
 * Adds a clickable picture for each standard token this player can use.
 */
function addCharacters()
{
    for(let char of people)
    {
        if(imgs["tokens"][char])
        {
            let person = document.createElement("img");
            person.id = char;
            person.src = imgs["tokens"][char];
            person.classList = "char";
            person.onclick = handleChoose;
            div.appendChild(person);
        }
    }
}

/**
 * Adds the player's own uploaded images as more token choices, plus the
 * "Manage/Add Imgs" button. Pre-selects their current token picture.
 */
function addCustomImgs()
{
    for(let custom of Object.keys(wholeCustom))
    {
        if(wholeCustom[custom]["player"] == player)
        {
            let person = document.createElement("img");
            person.id = wholeCustom[custom]["name"];
            person.src = wholeCustom[custom]["src"];
            person.classList = "char customImg";
            person.style.width = "73px";
            person.style.height = "73px";
            person.onclick = handleChoose;
            placeBefore(person, bord);
        }
    }

    let customsBtn = document.createElement("button");
    customsBtn.classList = "gridButton";
    customsBtn.innerHTML = "Manage/Add Imgs";
    customsBtn.style.width = "100%";
    customsBtn.onclick = handleCustomImg;
    placeBefore(customsBtn, bord);

    
    if(oldToken != null || oldToken != undefined)
    {
        document.getElementById(`${oldToken["name"]}`).onclick();
    }
}

/**
 * "Manage/Add Imgs": replaces the page with the player's custom images (each with a
 * Delete button) and a form to upload a new one with a nickname.
 */
function handleCustomImg()
{
    while(div.children.length > 0)
    {
        div.lastChild.remove();
    }

    let customsDiv = document.createElement("div");

    for(let custom of Object.keys(wholeCustom))
    {
        if(wholeCustom[custom]["player"] == player)
        {
            let personDiv = document.createElement("div");
            personDiv.classList.add("center");
            
            let person = document.createElement("img");
            person.id = wholeCustom[custom]["name"];
            person.src = wholeCustom[custom]["src"];
            person.classList = "char customImg";
            person.style.width = "73px";
            person.style.height = "73px";
            personDiv.appendChild(person);
            person.style.margin = "10px";

            let deleteBtn = document.createElement("button");
            deleteBtn.classList = "gridButton";
            deleteBtn.innerHTML = "Delete Custom Img";
            deleteBtn.onclick = handleDeleteCustom;
            deleteBtn.id = wholeCustom[custom]["name"];
            personDiv.appendChild(deleteBtn);
            customsDiv.appendChild(personDiv);
            deleteBtn.style.margin = "10px";
        }
    }

    let names = ["Url", "Nickname"];
    let objects = [document.createElement("input"), document.createElement("input")];
    let newDiv = document.createElement("div");
    newDiv.classList.add("center");

    let fileLabel = document.createElement("h6");
    fileLabel.innerHTML = "Upload Image: ";
    fileLabel.style.margin = "5px";
    fileLabel.style.display = "inline";

    let tokenFileInput = document.createElement("input");
    tokenFileInput.type = "file";
    tokenFileInput.id = "CustomFileInput";
    tokenFileInput.accept = "image/*";
    tokenFileInput.style.margin = "5px";
    tokenFileInput.style.setProperty("width", "40%", "important");

    let br = document.createElement("span");
    br.style.display = "block";

    let nameLabel = document.createElement("h6");
    nameLabel.innerHTML = "Nickname: ";
    nameLabel.style.margin = "5px";
    nameLabel.style.display = "inline";

    let tokenNameInput = document.createElement("input");
    tokenNameInput.type = "text";
    tokenNameInput.id = "Nickname";
    tokenNameInput.style.margin = "5px";
    tokenNameInput.style.width = "40%";

    newDiv.appendChild(fileLabel);
    newDiv.appendChild(tokenFileInput);
    newDiv.appendChild(br);
    newDiv.appendChild(nameLabel);
    newDiv.appendChild(tokenNameInput);

    let createBtn = document.createElement("button");
    createBtn.innerHTML = "Create Custom Img";
    createBtn.onclick = handleCreateCustom;
    createBtn.style.margin = "5px";

    let cancelBtn = document.createElement("button");
    cancelBtn.innerHTML = "Cancel";
    cancelBtn.onclick = function () {reload(.001);};
    cancelBtn.style.margin = "5px";

    newDiv.appendChild(createBtn);
    newDiv.appendChild(cancelBtn);
    customsDiv.appendChild(newDiv);

    div.appendChild(customsDiv);
}

/**
 * Deletes one custom image. Any token on the map still using it falls back to that
 * character's standard picture ("<id>-").
 */
function handleDeleteCustom()
{
    deleteDoc(`customImages/${this.id}`);
    
    for(let tokens of Object.keys(wholeDb))
    {
        if(wholeDb[tokens]["name"] == this.id)
        {
            let access = wholeDb[tokens]["id"];
            let newToken = wholeDb[access];

            newToken.name = `${newToken.id}-`;
            setDoc(`currentMap/${access}`, newToken);
        }
    }   

    reload(.5);
}

/**
 * Uploads a new custom token picture: checks a file and nickname were given, cleans the
 * nickname, compresses the image to about 0.2 MB, uploads it to Storage, saves the
 * link under files/tokens/<nickname>-, makes it this player's token, and reloads.
 */
async function handleCreateCustom()
{
    let fileElement = document.getElementById("CustomFileInput");
    let nicknameInput = document.getElementById("Nickname").value;
    let dbPath;
    let storagePath;

    if (!fileElement.files || fileElement.files.length === 0) 
    {
        alert("Please select a file to upload first!");
        return;
    }

    if (!nicknameInput.trim()) 
    {
        alert("Please enter a nickname for this custom token!");
        return;
    }

    let nickname = clenseInput(nicknameInput);
    nickname = nickname + "-";
    dbPath = `files/tokens/${nickname}`;
    storagePath = `images/map/tokens/${nickname}`;

    // Setup Compression configuration boundaries
    const compressionOptions = 
    {
        maxSizeMB: 0.2,          
        maxWidthOrHeight: 1024,  
        useWebWorker: true
    };

    try 
    {
        const compressedFile = await imageCompression(fileElement.files[0], compressionOptions);
        
        // Match the token folder tree requirements
        const storageReference = sRef(storage, storagePath);

        console.log("Pushing compressed element to Cloud storage path: ", storagePath);
        const snapshot = await uploadBytes(storageReference, compressedFile);
        
        // Grab the static production link target
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update database maps pointing to our newly uploaded asset link
        setDoc(dbPath, downloadURL);
        setDoc(`playerChar/${player}/token/name`, nickname);
        
        alert("Custom Token Successfully Uploaded! Now reloading to be able to apply");
        reload(.5);

    } 
    
    catch (error) 
    {
        console.error("Custom token upload transaction process broken: ", error);
        alert("Upload failed. Check logs for detail.");
    }
}

/**
 * Adds a clickable ring picture for every border colour (except "invisible").
 */
function addBorders()
{
    div.appendChild(bord);

    for(let i = 0; i < borders.length; i++)
    {
        let color = borders[i][0];
        let border = document.createElement("img");
        border.src = borders[i][1];
        border.id = color;
        border.classList = "bord";
        border.onclick = handleChoose;
        div.appendChild(border);
    }
}

/**
 * Adds the Max Hp / Current Hp / Temp Hp / AC number boxes.
 */
function addHp()
{
    div.appendChild(hp);
    let names = ["Max Hp", "Current Hp", "Temp Hp", "AC"];
    let labels = [document.createElement("h6"), document.createElement("h6"), document.createElement("h6"), document.createElement("h6")];
    let numbers = [document.createElement("input"), document.createElement("input"), document.createElement("input"), document.createElement("input")];

    for(let i = 0; i < names.length; i++)
    {
        let seprateDiv = document.createElement("div");
        labels[i].innerHTML = names[i] + ':';
        labels[i].classList = "labelS";
        seprateDiv.appendChild(labels[i]);

        numbers[i].id = names[i];
        numbers[i].type = "number";
        numbers[i].min = "0";
        numbers[i].step = "1";
        numbers[i].style.width = "10%";
        numbers[i].classList = "numberInput";
        seprateDiv.appendChild(numbers[i])

        div.appendChild(seprateDiv);
    }
}

/**
 * A picture or border was clicked: un-highlight the others in the same group and
 * highlight this one ("selected").
 */
function handleChoose()
{
    let classL = this.classList.value;
    let elementsToClear;

    if(classL.includes("char")){elementsToClear = document.getElementsByClassName("char");}
    else if(classL.includes("bord")){elementsToClear = document.getElementsByClassName("bord");}

    for(let element of elementsToClear)
    {
        element.classList.remove("selected");;
    }

    this.classList.add("selected");
}

/**
 * Go!: needs one picture and one border selected. Saves the token, swaps the page for a
 * loading message, then goes to the dashboard after 2 seconds.
 */
function handleGoButton()
{
    let currentSelected = document.getElementsByClassName("selected");
    if(currentSelected.length == 2)
    {
        let curBorder = currentSelected[1].id;
        let curCharacter = currentSelected[0].id;
        createChar(curCharacter, curBorder);

        let loop = true;
        while(loop)
        {
            try 
            {
                if(div.children.length > 0)
                {
                    div.removeChild(div.children[1]);
                }

                else
                {
                    loop = false;
                    break;
                }
            } 
            
            catch (error) 
            {
                loop = false;
                break;
            }
        }

        let loading = document.createElement("h3");
        let loadingGif = document.createElement("img");
        loading.innerHTML = "Loading, Axol Map V1.11.5, Updating to Current Info..."; 
        loadingGif.src = "images/loadingGif.gif";
        loadingGif.style.minWidth = "10%";
        div.classList.add("center"); 
        div.appendChild(loading);
        div.appendChild(loadingGif);
        setInterval(() => {window.location.href= `index.html`;}, 2000);
    }
}

/**
 * Builds the token object and saves it to the map and to the player's character.
 * The map id is the picture name without its trailing "-". A new token starts at A1
 * with the name as its title; an existing token keeps its title, position and summon flag.
 */
function createChar(curCharacter, curBorder)
{
    let charName = curCharacter.slice(0, curCharacter.length - 1);
    if(curCharacter.includes("ustom")){charName = curCharacter.slice(7);}
    let char = {border : curBorder, currentHp : `${document.getElementById("Current Hp").value}`, maxHp : `${document.getElementById("Max Hp").value}`, tempHp : document.getElementById("Temp Hp").value, map : "", id : charName, name : curCharacter, title : " " + charName + ", ", xPos : "1", yPos : "A", isSummon : false, AC : document.getElementById("AC").value};

    
    if(oldToken != null || oldToken != undefined)
    {
        char["title"] = oldToken["title"];
        char["xPos"] = oldToken["xPos"];
        char["yPos"] = oldToken["yPos"];
        char["isSummon"] = oldToken["isSummon"];
    }

    setDoc(`currentMap/${charName}`, char);
    setDoc(`playerChar/${player}/token`, char);
    setDoc(`playerChar/${player}/charName`, char["id"]);
    setDoc(`playerChar/${player}/currentToken`, char["id"]);
}