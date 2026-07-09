"use strict";
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database } from '../js/viMethods.js';

let url = window.location.href.split("/");
let player;
let username, password, backBtn, loginBtn;

function init()
{
    username = document.getElementById("username");
    password = document.getElementById("password");
    
    backBtn = document.getElementById("back");
    backBtn.onclick = handleBackBtn;
    loginBtn = document.getElementById("submit");
    loginBtn.onclick = handleLoginBtn;
}

function handleLoginBtn()
{
    let user = username.value;
    let pass = password.value;

    if(pass.length < 6)
    {
        for(let i = pass.length; i < 6; i++)
        {
            pass = pass + ".";
        }
    }

    login(`${toTitleCase(user)}@ForgottenRealms.com`, toTitleCase(pass));
}

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

function handleBackBtn()
{
    window.location.href= "https://infused.axol-apps.com/";
}

init();