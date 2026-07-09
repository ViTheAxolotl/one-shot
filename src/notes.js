"use strict"
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, deleteDoc, reload, placeBefore } from '../js/viMethods.js';

let wholeNotes = {};
let player;
let notesRef;
let currentTitle;
let currentText;
let isFirstRead = true;
let display = document.getElementById("notesDisplay");
let deleteProtection = true;

onAuthStateChanged(auth, (user) => 
{
    user = auth.currentUser.email.split("@");
    player = toTitleCase(user[0]);
    
    notesRef = ref(database, `playerChar/${player}/notes`);
    onValue(notesRef, (snapshot) => 
    {
        const data = snapshot.val();
        wholeNotes = data;
        
        if(isFirstRead)
        {
            readNotes(player);
            createAddButton();
            isFirstRead = false;
        }
    });
});

function init()
{
    let button = document.getElementById("enter");
}

function handleAddButton()
{
    let notes = document.getElementsByClassName("notes");
    let addButton = document.getElementById("AddButton");

    /**addButton.parentNode.removeChild(addButton);
    while(notes.length > 0)
    {
        notes[0].parentNode.removeChild(notes[0]);
    }**/

    setAddScreen();
}

function handleDeleteButton()
{
    if(deleteProtection){alert("Are you sure you want to delete this note? Click trash again to confirm."); deleteProtection = false;}
    
    else
    {
        this.parentNode.parentNode.remove();
        
        for(let note of Object.keys(wholeNotes))
        {
            document.getElementById(`${note}-pos`).lastChild.remove();
        }
    }
}

function setAddScreen()
{
    for(let child of display.children)
    {
        if(child.tagName != 'DIV'){continue;}

        let title = child.id.slice(0, child.id.indexOf("-"));
        let text = wholeNotes[title]["desc"];
        let pos = wholeNotes[title]["pos"];
        let display = child.children[0];

        while(display.children.length > 0)
        {
            display.children[0].remove();
        }

        display.classList = "card-body center";
        createEditableNote(title, text, pos, display);   
        display.appendChild(createDeleteButton());
    }

    let upload = document.getElementById("AddButton");
    upload.innerHTML = "Upload Notes";
    upload.onclick = addNote;

    let createNew = document.createElement("button");
    createNew.innerHTML = "Create Note";
    createNew.onclick = handleCreate;
    placeBefore(createNew, upload);

    let cancel = document.createElement("button");
    cancel.innerHTML = "Cancel";
    cancel.onclick = function(){reload(1);};
    placeBefore(cancel, upload);
}

function createEditableNote(title, text, pos, display)
{
    let cardTitle = document.createElement("input");
    cardTitle.setAttribute("class", "card-title");
    cardTitle.value = title;
    cardTitle.style.width = "50vw";
    cardTitle.style.display = "block";
    display.appendChild(cardTitle);

    let cardText = document.createElement("textarea");
    cardText.setAttribute("class", "card-text");
    cardText.style.margin = "3px";
    cardText.value = text;
    cardText.style.display = "block";
    cardText.style.width = "50vw";
    cardText.style.height = "20vh";
    display.appendChild(cardText);

    let cardPos = document.createElement("select");
    cardPos.style.width = "5vw";
    cardPos.classList.add("center");
    cardPos.id = `${title}-pos`;
    let desc = document.createElement("option");
    desc.value = "";
    desc.innerHTML = "--Select the order you want the note in--";
    cardPos.appendChild(desc);

    for(let i = 1; i < Object.keys(wholeNotes).length + 1; i++)
    {
        let option = document.createElement("option");
        option.value = `${i}`;
        option.innerHTML = `${i}`;
        cardPos.appendChild(option);
    }

    cardPos.value = `${pos}`;
    cardPos.style.display = "block";
    display.appendChild(cardPos);
}

function handleCreate()
{
    let cardDiv = document.createElement("div");
    cardDiv.setAttribute("class", "card .bg-UP-blue notes");
    cardDiv.id = `new-div`;
    let cardBody = document.createElement("div");
    cardBody.setAttribute("class", "card-body center");
    createEditableNote("Title", "Text", "", cardBody);
    cardDiv.appendChild(cardBody);
    cardBody.appendChild(createDeleteButton());
    placeBefore(cardDiv, this);
    
    let i = display.children.length - 3;
    let option = document.createElement("option");
    option.value = `${i}`;
    option.innerHTML = `${i}`;
    document.getElementById("Title-pos").appendChild(option);
    document.getElementById("Title-pos").value = `${i}`;

    for(let note of Object.keys(wholeNotes))
    {
        let option = document.createElement("option");
        option.value = `${i}`;
        option.innerHTML = `${i}`;
        document.getElementById(`${note}-pos`).appendChild(option);
    }
}

function setCardScreen(enter, title, pos, text)
{
    let deleteButton = document.getElementById("deleteButton");
    deleteButton.parentNode.removeChild(deleteButton);
    text.parentNode.removeChild(text);
    pos.parentNode.removeChild(pos);
    enter.innerHTML = "Enter";
    title.placeholder = "";
    title.value = "";
}

function createNoteCard(title, text)
{
    let cardDiv = document.createElement("div");
    cardDiv.setAttribute("class", "card .bg-UP-blue notes");
    cardDiv.id = `${title}-div`;
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
    
    cardDiv.appendChild(cardBody);
    return cardDiv;
}

function createAddButton()
{
    let addButton = document.createElement("button");
    addButton.setAttribute("id", "AddButton");
    addButton.innerHTML = "Edit/Add Notes";
    addButton.style.height = "75px";
    addButton.onclick = handleAddButton;

    let noteDisplay = document.getElementById("notesDisplay");
    noteDisplay.appendChild(addButton);
}

function createDeleteButton()
{
    let deleteButton = document.createElement("img");
    deleteButton.setAttribute("src", "images/trashIcon.png");
    deleteButton.setAttribute("id", "deleteButton");
    deleteButton.onclick = handleDeleteButton;
    return deleteButton;
}

async function addNote()
{
    let poses = [];
    let notes = {};
    let upload = true;

    try 
    {
        for(let child of display.children)
        {
            if(child.tagName != 'DIV'){continue;}
            
            let title = child.children[0].children[0].value;
            let text = child.children[0].children[1].value;
            let pos = parseInt(child.children[0].children[2].value);

            if(!poses.includes(pos)){poses.push(pos);}
            else{alert("Can't have repeating order positions."); upload = false;}

            notes[title] = {"desc" : text, "pos" : pos};
        }

        for(let i = 1; i < Object.keys(notes).length + 1; i++)
        {
            if(!poses.includes(i))
            {
                alert(`Missing note in the ${i} position of order`);
                upload = false;
            }
        }

        if(upload)
        {
            setDoc(`playerChar/${player}/notes`, null);
            setDoc(`playerChar/${player}/notes`, notes);
            reload(1);
        }
    } 
    
    catch (e) 
    {
        console.error("Error adding document: ", e);
    }
}

async function readNotes() //Need to do manual
{
    display = document.getElementById("notesDisplay");
    display.innerHTML = "";
    let orderedNotes = {};

    for(let key of Object.keys(wholeNotes))
    {
        let text = [];
        let pos;
        text.push(wholeNotes[key]["desc"]);
        pos = wholeNotes[key]["pos"];
        
        orderedNotes[pos] = createNoteCard(key, text);
    }

    for(let noteNumber = 1; noteNumber < Object.keys(orderedNotes).length + 1; noteNumber++)
    {display.appendChild(orderedNotes[noteNumber]);}

    //for(let key of document.getElementsByClassName("card-body")){key.onclick = handleCardClick;}
}

window.onload = init;