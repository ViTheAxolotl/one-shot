/**
 * pageSetup.js — builds the navbar and footer on every full page.
 *
 * Each page includes it inside its <nav> with a class saying where the page sits:
 *   <script src="js/pageSetup.js" class="noParent">   page is in the site root
 *   class="downOne"                                   page is one folder down (links need ../)
 * That first class is read below to build correct links and image paths.
 *
 * When Firebase reports the login state, the right-hand side of the navbar becomes
 * either the player's name (with a dropdown: Character Sheet, Logout) or a Login button.
 * The footer gets the copyright line.
 */

"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database } from './viMethods.js';

let log;
let isLoggedIn = false;
let nav = document.getElementsByTagName("nav");
let url = window.location.href.split("/");
// The first <script> in <body> is this one; its first class tells us where the page lives.
let params = document.body.getElementsByTagName('script');
let query = params[0].classList;
let parentFolder = query[0];
let wholeChars = {};
let name;
let footer = document.getElementById("footer");
let body = document.getElementsByTagName("body");
let imageLocation;
let jsaLocation;
let mainLocation;

// Redraw the navbar whenever character data changes.
const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeChars = data;
    navBarSetup();
});

if(parentFolder == "noParent")
{
    mainLocation = "";
    imageLocation = "images/";
}

if(parentFolder == "downOne")
{
    mainLocation = "../";
    imageLocation = "../images/";
}

// Firebase calls this on load and on every login/logout. The account name is the part
// of the email before "@" (accounts are <Name>@ForgottenRealms.com).
onAuthStateChanged(auth, (user) => {
    if (user) 
    {
        name = auth.currentUser.email.split("@");
        name = toTitleCase(name[0]);

        log = `</ul>
            </div>
            <a class="nav-link" href="#" id="navbarScrollingDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="min-width: 6%;">
                <button class="link-primary bg-stone" style = "min-width: 70px;">${name}</button>
            </a>
            <ul class="dropdown-menu bg-dark" style="right: 0; left: auto;" aria-labelledby="navbarScrollingDropdown">
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="${mainLocation}index.html#sheet">Character Sheet</a></li>
                <li class="nav-item"><a class="nav-link active" aria-current="page" id = "logoutButton">Logout</a></li>
            </ul>`;
        
        isLoggedIn = true;
        discordSetup();
    } 
    
    else 
    {
        // User is signed out
        log = `</ul>
            </div>
            <a class="navbar-brand ms-lg-auto" href="${mainLocation}loginPage.html?${url.slice(-1)}"><button class="link-primary bg-stone">Login</button></a>`;
    }

    navBarSetup();
});

/**
 * Runs once when the script loads: fills in the footer.
 */
function init()
{
    copyrightSetup();
}

/**
 * Writes the whole navbar into <nav>. `log` holds the right-hand part (name dropdown
 * or Login button) and is set in onAuthStateChanged above, so this runs again once
 * the login state is known.
 */
function navBarSetup()
{
    nav[0].innerHTML = `<div class="container-fluid">
        <a class="navbar-brand" href="${mainLocation}oldIndex.html"><img src = "${imageLocation}UP.png" title = "Infused" alt = "Infused" width = "70" height = "70"/></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent"> 
            <ul class="navbar-nav me-auto my-2 my-lg-0 " style="--bs-scroll-height: 100px;"> 
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="${mainLocation}index.html">Dashboard</a></li>
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="${mainLocation}selection.html">Change Token</a></li>
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="https://sheets.axol-apps.com/index.html">Standalone Character Sheets</a></li>    
                ${log}
    </div>`;

    if(isLoggedIn){document.getElementById("logoutButton").onclick = logout;}
}

/**
 * Signs the player out of Firebase and reloads the page (which then shows Login).
 */
function logout()
{
    signOut(auth).then(() => 
    {
        // Sign-out successful.
        location.reload();
    }).catch((error) => {
        alert(error);
    });
}

/**
 * Placeholder for an embedded Discord chat widget. Currently switched off (body commented out).
 */
function discordSetup()
{
    /*let scripts = document.createElement("script");
    scripts.src = "https://cdn.jsdelivr.net/npm/@widgetbot/crate@3";
    scripts.innerText = "new Crate({server: '1042157480463040613', channel: '1042157480463040616'});";
    body[0].appendChild(scripts);*/
}

/**
 * Adds "Copyright © Vi Snyder <current year>" to the footer.
 */
function copyrightSetup()
{
    footer.innerHTML += `<h6>Copyright &copy; Vi Snyder ${new Date().getFullYear()}</h6>`;
}

init();