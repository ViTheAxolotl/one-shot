/**
 * loginSite.js — the login form on loginPage.html.
 *
 * Players don't have real email accounts: their Firebase account is
 * "<Username>@ForgottenRealms.com", and the password is title-cased and padded
 * with dots to Firebase's 6-character minimum. After logging in they are sent
 * back to the site's home page.
 */

"use strict";
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database } from '../js/viMethods.js';

let url = window.location.href.split("/");
let player;
let username, password, backBtn, loginBtn;

/**
 * Hooks up the Enter and Back buttons on the login form.
 */
function init()
{
    username = document.getElementById("username");
    password = document.getElementById("password");
    
    backBtn = document.getElementById("back");
    backBtn.onclick = handleBackBtn;
    loginBtn = document.getElementById("submit");
    loginBtn.onclick = handleLoginBtn;
}

/**
 * Turns what the player typed into the hidden email/password format
 * (see the top of this file) and tries to log in.
 */
function handleLoginBtn()
{
    let user = username.value;
    let pass = password.value;

    // Firebase needs at least 6 characters, so short passwords are padded with ".".
    if(pass.length < 6)
    {
        for(let i = pass.length; i < 6; i++)
        {
            pass = pass + ".";
        }
    }

    login(`${toTitleCase(user)}@ForgottenRealms.com`, toTitleCase(pass));
}

/**
 * Signs in with Firebase. On success goes back to the site; on failure shows Firebase's error code.
 */
function login(email, password)
{
    signInWithEmailAndPassword(auth, email, password).then((userCredential) => 
    {
        // Signed in 
        let user = userCredential.user;
        user = user.email.split("@");
        player = toTitleCase(user[0]);
        handleBackBtn();

    }).catch((error) => 
    {
        const errorCode = error.code;
        const errorMessage = error.message;
        alert(`Error! ${errorCode}: ${errorMessage}`);
    });
}

/**
 * Leaves the login page and returns to the site's home page.
 */
function handleBackBtn()
{
    window.location.href= "https://drunk.axol-apps.com/";
}

init();