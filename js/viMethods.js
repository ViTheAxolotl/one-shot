/**
 * viMethods.js — the shared toolbox. Almost every other script imports from here.
 *
 *   • Connects to Firebase (database, login, file storage) and exports `auth`,
 *     `database` and `storage` for everyone else.
 *   • setDoc / deleteDoc: the one way the site writes to the database.
 *   • sendDiscordMessage: posts a roll or action to the Discord channel AND to the
 *     dashboard's Display feed.
 *   • Small helpers: toTitleCase, statFormat (+3 / -1), wait, reload, createCard, etc.
 *   • setMapValue: the pixel maths for placing tokens on the 26×26 battle-map grid.
 *
 * Note: the Firebase config below is meant to be public (all web apps ship it);
 * what protects the data is the database's security rules, not this key.
 */


"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { getStorage, uploadBytes, getDownloadURL, ref as sRef } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Firebase project settings. Every page that imports this file shares this one connection.
const firebaseApp = initializeApp
({
    apiKey: "AIzaSyDvuBp4EboXMRbkdp6_YBGn7tq08jAYmvA",
    authDomain: "one-shot-14fa0.firebaseapp.com",
    projectId: "one-shot-14fa0",
    storageBucket: "one-shot-14fa0.firebasestorage.app",
    messagingSenderId: "222065387269",
    appId: "1:222065387269:web:f2d0d3d6b2120a279bf96c",
    measurementId: "G-T98814SJ58",
    storageBucket: "gs://one-shot-14fa0.firebasestorage.app"
}); //Connects to database

export let auth = getAuth(); //Logs into accounts
export let database = getDatabase(); //Sets up connection
export let storage = getStorage(firebaseApp);
export let quickAction = false;
// Which ability score each skill uses (e.g. stealth -> Dexterity). Used when working out skill bonuses.
export let skillDecrypt = {"athletics" : "Strength", "acrobatics" : "Dexterity", "slightOfHand" : "Dexterity", "stealth" : "Dexterity", "arcana" : "Intelligence", "history" : "Intelligence", "investigation" : "Intelligence", "nature" : "Intelligence", "religion" : "Intelligence", "animalHandling" : "Wisdom", "insight" : "Wisdom", "medicine" : "Wisdom", "perception" : "Wisdom", "survival" : "Wisdom",  "deception" : "Charisma",  "intimidation" : "Charisma",  "performance" : "Charisma",  "persuasion" : "Charisma"};

/**
 * Uploads an image the player picked: compresses it (max ~0.4 MB, 1024px) in the browser,
 * stores it in Firebase Storage at `structure`, then saves the public download link
 * in the database. `type` says what the image is for (currently only "portrait").
 */
export async function handleImageUpload(event, structure, type)
{
    if(event.target.files)
    {
        let imageFile = event.target.files[0];
        
        const options = {
            maxSizeMB: 0.4,          // Max size 200KB (Perfect for tokens/sheets)
            maxWidthOrHeight: 1024, // Keeps it crisp but not massive
            useWebWorker: true
        };

        try {
            console.log("Compressing...");
            const compressedFile = await imageCompression(imageFile, options);
            
            // --- STEP 2: UPLOAD TO STORAGE ---
            // Saving it as the player's name ensures they only ever have ONE file (saves space)
            const storageRef = sRef(storage, structure);
            
            const snapshot = await uploadBytes(storageRef, compressedFile);
            
            // --- STEP 3: GET THE PERMANENT URL ---
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            // --- STEP 4: UPDATE FIREBASE REALTIME DB ---
            // This ensures the "Source of Truth" is updated for everyone
            switch(type)
            {
                case "portrait":
                    setDoc(`playerChar/image`, downloadURL);
                    document.getElementById("portrait").src = downloadURL;
                    document.getElementById("portrait").style.display = "block";
                    break;
            }
        } 
        
        catch (error) 
        {
            alert("Upload failed:", error);
        }
    }
}

/**
 * Turns "quick action" mode on or off. In that mode createCard() makes compact buttons
 * instead of full parchment cards (used by the Quick Action overlay).
 */
export function setQuickAction(bool)
{
    quickAction = bool;
}

/**
 * Works out where each grid square is, in pixels, on the battle map.
 * The map image is 26×26 squares (A–Z down, 1–26 across). `pos[i]` is the pixel offset
 * of column/row i. The "bumper" and "movement" numbers were tuned by hand for each
 * Bootstrap screen-size breakpoint so tokens land exactly on the squares.
 * Returns everything in one object, used by map.js and mapControler.js.
 */
export function setMapValue()
{
    const body = document.querySelector("body"); //gridMap
    const rect = body.getBoundingClientRect();
    let trueMapSize = 2030;
    let mapSize = (trueMapSize * (8 / 10));
    let bumper = Math.round(trueMapSize / 26) * 0.011;
    let distance = Math.round(mapSize / 26);
    let movement = distance * 1.18999999999999999;
    let bubble = 35;

    if(screen.width < 576)
    {
        bumper = Math.round(trueMapSize / 26) * 0.149;
        movement = distance * 1.290059;
    }

    else if(screen.width < 768)
    {
        bumper = Math.round(trueMapSize / 26) * 0.139999;
        movement = distance * 1.290319999;
    }
 
    else if(screen.width < 992)
    {
        bumper = Math.round(trueMapSize / 26) * 0.1299999;
        movement = distance * 1.2899999;
    }

    else if(screen.width < 1200)
    {
        bumper = Math.round(trueMapSize / 26) * 0.04244;
        movement = distance * 1.1799;
    }

    else if(screen.width < 1400)
    {
        bumper = Math.round(trueMapSize / 26) * 0.04235;
        movement = distance * 1.1933183;
    }

    let disAndBum = distance + bumper;
    disAndBum = parseInt(disAndBum);
    movement = parseInt(movement);
    let pos = [disAndBum, disAndBum + movement, disAndBum + (movement * 2), disAndBum + (movement * 3), disAndBum + (movement * 4), disAndBum + (movement * 5), disAndBum + (movement * 6), disAndBum + (movement * 7), disAndBum + (movement * 8), disAndBum + (movement * 9), disAndBum + (movement * 10), disAndBum + (movement * 11), disAndBum + (movement * 12), disAndBum + (movement * 13), disAndBum + (movement * 14), disAndBum + (movement * 15), disAndBum + (movement * 16), disAndBum + (movement * 17), disAndBum + (movement * 18), disAndBum + (movement * 19), disAndBum + (movement * 20), disAndBum + (movement * 21), disAndBum + (movement * 22), disAndBum + (movement * 23), disAndBum + (movement * 24), disAndBum + (movement * 25)];
    let yPos = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let xPos = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26"];
    
    let map = {"trueMapSize" : trueMapSize, "mapSize" : mapSize, "bumper" : bumper, "distance" : distance, "movement" : movement, "disAndBum" : disAndBum, "pos" : pos, "xPos" : xPos, "yPos" : yPos, "bubble" : bubble};
    return map;
}

/**
 * Capitalises the first letter of every word: "help me" -> "Help Me".
 * Used wherever names are shown, since many are typed or stored in lower case.
 */
export function toTitleCase(word)
{
    let finalWord = "";
    if(word.includes(" ")) //More than one word
    {
        word = word.split(" "); 
        for(let singleWord of word)
        {
            if(singleWord != ""){finalWord += `${singleWord[0].toUpperCase() + singleWord.slice(1)} `;} //Capitilize each word in the varible
        }
        finalWord = finalWord.slice(0, finalWord.length - 1);
    }

    else //If only one word given
    {
        if(word[0])
        {
            finalWord = word[0].toUpperCase() + word.slice(1); //Caps the one word
        }
    }

    return finalWord;
}

/**
 * Builds a card and adds it to the element with id `location`.
 *   title: card heading
 *   text:  array of lines; each becomes its own paragraph
 * Normally a parchment card ("card notes"); in quick-action mode a small button instead.
 */
export function createCard(title, text, location)
{
    if(!quickAction)
    {   
        let cardDiv = document.createElement("div");
        cardDiv.setAttribute("class", "card notes");
        let cardBody = document.createElement("div");
        cardBody.setAttribute("class", "card-body notes");
        let cardTitle = document.createElement("h5");
        cardTitle.setAttribute("class", "card-title");
        cardTitle.innerHTML = title;
        cardBody.appendChild(cardTitle);

        for(let i = 0; i < text.length; i++) //For each sentence in the card
        {
            let cardText = document.createElement("p");
            cardText.setAttribute("class", "card-text");
            cardText.style.margin = "3px";
            cardText.innerHTML = text[i];
            cardBody.appendChild(cardText);
        }
        
        let noteDisplay = document.getElementById(location);
        noteDisplay.appendChild(cardDiv);
        cardDiv.appendChild(cardBody);
    }
    
    else
    {
        let card = document.createElement("button");
        card.classList = "center gridButton card-body text-brass bg-oak";
        card.innerHTML = title;

        let noteDisplay = document.getElementById(location);
        noteDisplay.appendChild(card); 
    }
}

/**
 * Writes `toChange` to the database at `path`, replacing whatever was there.
 * Every save on the site goes through here (e.g. setDoc("currentMap/Ben/currentHp", "12")).
 */
export function setDoc(path, toChange)
{
    set(ref(database, path), toChange); 
}

/**
 * Deletes whatever is stored at `path` in the database (by setting it to null).
 */
export function deleteDoc(path)
{
    set(ref(database, path), null);
}

/**
 * Picks the little health-bar picture shown under a token.
 * Temp HP shows its own bar; otherwise the bar steps down at 100%, 80%, 60%, 40%, above 0 and 0.
 * Max and current both "0" means "don't show a bar" (used for objects).
 */
export function returnHpImage(maxHp, tempHp, currentHp)
{
    let fraction = parseInt(currentHp) / parseInt(maxHp);

    if(tempHp != null)
    {
        if(tempHp != "0")
        {
            return window.top.parent.imgs["hpBar"]["tempHp"];
        }
    }

    if(maxHp == "0" && currentHp == "0")
    {
        return window.top.parent.imgs["hpBar"]["invisible"];
    }

    else if(fraction == 1)
    {
        return window.top.parent.imgs["hpBar"]["hpBar1"];
    }

    else if(fraction >= .8)
    {
        return window.top.parent.imgs["hpBar"]["hpBar2"];
    }

    else if(fraction >= .6)
    {
        return window.top.parent.imgs["hpBar"]["hpBar3"];
    }

    else if(fraction >= .4)
    {
        return window.top.parent.imgs["hpBar"]["hpBar4"];
    }

    else if(fraction > 0)
    {
        return window.top.parent.imgs["hpBar"]["hpBar5"];
    }

    else if(fraction == 0)
    {
        return window.top.parent.imgs["hpBar"]["hpBar6"];
    }  
}

/**
 * Basic safety check on text typed by players before it's used to build page content.
 * Removes spaces, swaps double quotes/backticks for single quotes, and rejects (returns null,
 * with an alert) anything containing < > ; @ ( ).
 */
export function clenseInput(toClense)
{
    let badChars = ["<", ">", ";", "@", "(", ")"];
    let isOk = true;

    toClense = toClense.replaceAll(" ", "");
    toClense = toClense.replaceAll("\"", "\'");
    toClense = toClense.replaceAll("\`", "\'");

    for(let bad of badChars)
    {
        if(toClense.includes(bad)) //If the input contains a bad char
        {
            alert(`Bad char detected: ${bad}. Please remove the char and try again.`);
            isOk = false;
        }
    }

    if(isOk)
    {
        return toClense;
    }

    else
    {
        return null;
    }
}

/**
 * Shows a modifier the D&D way: 3 -> "+3", 0 -> "+0", -1 -> "-1".
 */
export function statFormat(stat)
{
    stat = parseInt(stat);

    if(stat >= 0)
    {
        return "+" + stat;
    }

    else
    {
        return `${stat}`;
    }
}

/**
 * Runs `fun` after `seconds` seconds.
 */
export function wait(seconds, fun)
{
    setTimeout(fun, seconds * 1000);
}

/**
 * Reloads the page after `seconds` seconds (lets a database write finish first).
 */
export function reload(seconds)
{
    wait(seconds, function(){location.reload();})
}

/**
 * Inserts `elemToPlace` into the page directly before `referenceElement`.
 */
export function placeBefore(elemToPlace, referenceElement)
{ 
    referenceElement.parentElement.insertBefore(elemToPlace, referenceElement);
}

/**
 * Makes a small inline "Name:" label (an <h6>) for building forms in code.
 */
export function createLabel(name)
{
    let label = document.createElement("h6");
    label.innerHTML = `${name}:`;
    label.style.display = "inline";
    label.style.margin = "5px";
    return label;
}

/**
 * Returns a random entry from `list`.
 */
export function getRandomItem(list)
{
    let randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

/**
 * Announces something to the table: posts `message` to the Discord channel through
 * the webhook saved in the database (playerChar/Vi/testingWebhook) and also adds it to
 * the dashboard's Display feed. The ||   || line is a Discord spoiler bar used as a divider.
 */
export function sendDiscordMessage(message)
{
    sendMessageToDisplay(message);
    message = message + "\n\n ||                ||"; //Makes message seperating bars
    const contents = `${message}`;
    const request = new XMLHttpRequest();
    request.open("POST", window.top.parent.wholeChar["Vi"]["testingWebhook"]); //Opens the webhook
    request.setRequestHeader("Content-type", "application/json"); //Gives json header
    const prams = 
    {
        content: contents
    } 
    request.send(JSON.stringify(prams)); //Sends message
}

/**
 * Adds a message to the Display feed's 10-slot circular buffer (display/0–9):
 * moves display/current forward one slot (9 wraps back to 0) and writes the message there.
 */
function sendMessageToDisplay(message)
{
    let current = parseInt(window.top.parent.wholeDisplay["current"]);

    if(current + 1 > 9)
    {
        setDoc("display/current", "0");
        current = 0;
    }

    else
    {
        setDoc("display/current", `${current + 1}`);
        current++;
    }

    setDoc(`display/${current}`, message);
}
