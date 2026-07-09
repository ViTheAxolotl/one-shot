"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database } from './viMethods.js';

let log;
let isLoggedIn = false;
let nav = document.getElementsByTagName("nav");
let url = window.location.href.split("/");
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

onAuthStateChanged(auth, (user) => {
    if (user) 
    {
        name = auth.currentUser.email.split("@");
        name = toTitleCase(name[0]);

        log = `</ul>
            </div>
            <a class="nav-link" href="#" id="navbarScrollingDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="float: right; min-width: 6%;">
                <button class="link-primary bg-UP-grey" style = "min-width: 70px;">${name}</button
            </a>
            <ul class="dropdown-menu bg-dark" style="right: 0; left: auto;" aria-labelledby="navbarScrollingDropdown">
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="${mainLocation}stats.html">Stats</a></li>
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
            <a class="navbar-brand" style="float = right" href="${mainLocation}loginPage.html?${url.slice(-1)}"><button class="link-primary bg-UP-grey">Login</button></a>);`;
    }

    navBarSetup();
});

function init()
{
    copyrightSetup();
}

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
                <li class="nav-item"><a class="nav-link active" aria-current="page" href="https://sheets.axol-apps.com/index.html">Standalone Character Sheets</a></li>);    
                ${log}
    </div>`;

    if(isLoggedIn){document.getElementById("logoutButton").onclick = logout;}
}

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

function discordSetup()
{
    /*let scripts = document.createElement("script");
    scripts.src = "https://cdn.jsdelivr.net/npm/@widgetbot/crate@3";
    scripts.innerText = "new Crate({server: '1042157480463040613', channel: '1042157480463040616'});";
    body[0].appendChild(scripts);*/
}

function copyrightSetup()
{
    footer.innerHTML += `<h6>Copyright &copy; Vi Snyder ${new Date().getFullYear()}</h6>`;
}

init();