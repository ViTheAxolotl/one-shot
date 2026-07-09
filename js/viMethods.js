
"use strict";
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { getStorage, uploadBytes, getDownloadURL, ref as sRef } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

const firebaseApp = initializeApp
({
    apiKey: "AIzaSyArcsmJkXSeuIHMysYtIzRdjIDlKNQA25Y",
    authDomain: "forgottenrealmsmap.firebaseapp.com",
    projectId: "forgottenrealmsmap",
    storageBucket: "forgottenrealmsmap.appspot.com",
    messagingSenderId: "697902154695",
    appId: "1:697902154695:web:ffa5c47817f3097c89cfe2",
    measurementId: "G-Q2W494NRDT",
    storageBucket: "gs://forgottenrealmsmap.firebasestorage.app"
}); //Connects to database

export let auth = getAuth(); //Logs into accounts
export let database = getDatabase(); //Sets up connection
export let storage = getStorage(firebaseApp);
export let quickAction = false;
export let skillDecrypt = {"athletics" : "Strength", "acrobatics" : "Dexterity", "slightOfHand" : "Dexterity", "stealth" : "Dexterity", "arcana" : "Intelligence", "history" : "Intelligence", "investigation" : "Intelligence", "nature" : "Intelligence", "religion" : "Intelligence", "animalHandling" : "Wisdom", "insight" : "Wisdom", "medicine" : "Wisdom", "perception" : "Wisdom", "survival" : "Wisdom",  "deception" : "Charisma",  "intimidation" : "Charisma",  "performance" : "Charisma",  "persuasion" : "Charisma"};

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

export function setQuickAction(bool)
{
    quickAction = bool;
}

/**
 * Sets Map Values
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
 * 
 * @param {*} word 
 * @returns 
 * Changes each word into titlecase of word given. (Ex. help me -> Help Me)
 */
export function toTitleCase(word)
{
    let finalWord = "";
    if(word.includes(" ")) //More than one word
    {
        word = word.split(" "); 
        for(let singleWord of word)
        {
            finalWord += `${singleWord[0].toUpperCase() + singleWord.slice(1)} `; //Capitilize each word in the varible
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
 * 
 * @param {*} title 
 * @param {*} text 
 * @param {*} location 
 * Creates cards base on their title and text, it places these cards at location given.
 */
export function createCard(title, text, location)
{
    if(!quickAction)
    {   
        let cardDiv = document.createElement("div");
        cardDiv.setAttribute("class", "card .bg-UP-blue notes");
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
        card.classList = "center gridButton card-body color-UP-yellow bg-UP-white";
        card.innerHTML = title;

        let noteDisplay = document.getElementById(location);
        noteDisplay.appendChild(card); 
    }
}

/**
 * 
 * @param {*} path 
 * @param {*} toChange 
 * Sets the doc at path to the new value toChange
 */
export function setDoc(path, toChange)
{
    set(ref(database, path), toChange); 
}

/**
 * 
 * @param {*} path 
 * Deletes (Sets to null) the doc at path
 */
export function deleteDoc(path)
{
    set(ref(database, path), null);
}

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
 * Clenses input to stop hackers from gaining control
 * @param {*} toClense 
 * @returns 
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

export function wait(seconds, fun)
{
    setTimeout(fun, seconds * 1000);
}

export function reload(seconds)
{
    wait(seconds, function(){location.reload();})
}

/**
 * Places the new element elemToPlace before the referenceElement
 * @param {*} elemToPlace 
 * @param {*} referenceElement 
 */
export function placeBefore(elemToPlace, referenceElement)
{ 
    referenceElement.parentElement.insertBefore(elemToPlace, referenceElement);
}

/**
 * Creates the basic label and returns it
 * @param {*} name 
 * @returns 
 */
export function createLabel(name)
{
    let label = document.createElement("h6");
    label.innerHTML = `${name}:`;
    label.style.display = "inline";
    label.style.margin = "5px";
    return label;
}

export function getRandomItem(list)
{
    let randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

 /**
  * Sends message into the discord using a webhook
  * @param {*} message 
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
