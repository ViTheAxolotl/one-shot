/**
 * displayCombat.js — the "Display" feed under the dashboard (displayCombat.html, shown in an iframe).
 *
 * Every roll, spell and action is written to Firebase by sendDiscordMessage() in viMethods.js.
 * display/ keeps the last 10 messages in slots "0"-"9", like a circular buffer, and
 * display/current is the slot that was written most recently. This page listens to
 * display/ and lists the 10 messages newest-first.
 */

"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, deleteDoc, returnHpImage } from '../js/viMethods.js';

let display = document.getElementById("siteList");
let wholeDisplay = {};

const displayRef = ref(database, 'display/');
onValue(displayRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeDisplay = data;
    showDisplay();
});

/**
 * Redraws the feed: starts at the newest slot and walks backwards through all 10,
 * wrapping from 0 to 9. Turns Discord-style **bold** and *italic* into HTML.
 */
function showDisplay()
{
    display.innerHTML = ""
    let current = wholeDisplay["current"];

    for(let i = 0; i < 10; i++)
    {
        let desc = wholeDisplay[current];
        desc = desc.replaceAll(" **", " <b>");
        desc = desc.replaceAll("** ", "</b> ");
        desc = desc.replaceAll("* ", "</i> ");
        desc = desc.replaceAll(" *", " <i>");
        desc = desc.replaceAll("\n", "<br>");

        display.innerHTML += `<p>${desc}</p><hr>`;

        if(current == "0"){current = "9";}
        else{current = `${parseInt(current) - 1}`;}
    }
}