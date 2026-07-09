"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, clenseInput, deleteDoc, reload, placeBefore } from './viMethods.js';

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

onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        alert("You need to login before using this resource. Click Ok and be redirected");
        window.location.href = "loginPage.html?selection.html"; 
    } 
});

function userLoggedIn()
{
    player = auth.currentUser.email;
    player = player.split("@");
    player = toTitleCase(player[0]);
    oldToken = wholeChars[player]["token"];
    init();
    charName.value = wholeChars[player]["charName"];
    setUpCharacters();
}

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

    enter.onclick = setUpCharacters;
    go.onclick = handleGoButton;
    
    let temp = imgs["borders"];
    for(let border of Object.keys(temp)){if(border != "invisible"){borders.push(border);}} //Populates the borders with each border
}

function setUpCharacters()
{
    for(let elem of div.children)
    {
        elem.classList = "hide";
    }

    people.push(player+"-");
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

function openWindow()
{    
    setInterval(() => {window.open(this.id, '_blank'); location.reload();}, 2000);   
}

function addCharacters()
{
    for(let char of people)
    {
        let person = document.createElement("img");
        person.id = char;
        person.src = imgs["tokens"][char];
        person.classList = "char";
        person.onclick = handleChoose;
        div.appendChild(person);
    }
}

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
    customsBtn.innerHTML = "Manage Imgs";
    customsBtn.style.width = "100%";
    customsBtn.onclick = handleCustomImg;
    placeBefore(customsBtn, bord);

    
    if(oldToken != null || oldToken != undefined)
    {
        document.getElementById(`${oldToken["name"]}`).onclick();
    }
}

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

    for(let i = 0; i < names.length; i++)
    {
        let span = document.createElement("span");
        span.style.display = "block";

        let label = document.createElement("h6");
        label.innerHTML = `${names[i]}:`;
        label.style.display = "inline";
        label.style.margin = "5px";

        objects[i].id = names[i];
        objects[i].style.margin = "5px";
        objects[i].style.width = "40%";
        
        newDiv.appendChild(label);
        newDiv.appendChild(objects[i]);
        newDiv.appendChild(span);
    }

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

function handleCreateCustom()
{
    let url = document.getElementById("Url").value;
    let nickname = document.getElementById("Nickname").value;
    
    url = clenseInput(url);
    nickname = clenseInput(nickname);
    nickname = "custom-" + nickname;

    setDoc(`customImages/${nickname}`, {"name" : nickname, "player" : player, "src" : url});
    reload(.5);
}

function addBorders()
{
    for(let i = 0; i < borders.length; i++)
    {
        let color = borders[i];
        borders[i] = document.createElement("img");
        borders[i].src = `images/map/tokens/${color}Border.png`;
        borders[i].id = color;
        borders[i].classList = "bord";
        borders[i].onclick = handleChoose;
    }

    div.appendChild(bord);
    for(let border of borders)
    {
        div.appendChild(border);
    }
}

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
        loading.innerHTML = "Loading, Axol Map V1.11 Bug Fixes, Adding new Modifiers to Attacks, Updating to Current Info...";
        loadingGif.src = "images/loadingGif.gif";
        loadingGif.style.minWidth = "10%";
        div.classList.add("center"); 
        div.appendChild(loading);
        div.appendChild(loadingGif);
        setInterval(() => {window.location.href= `map.html`;}, 2000);
    }
}

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

fetch('https://vitheaxolotl.github.io/Infused/src/files.json').then(res => res.json()).then((json) => imgs = json);