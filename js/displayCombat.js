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