
"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, deleteDoc, returnHpImage, setMapValue, placeBefore, quickAction, setQuickAction, wait, getRandomItem } from '../js/viMethods.js';

let map = setMapValue();
let div = document.getElementById("gridMap");
let html = {};
const gridMap = document.querySelector("#gridMap"); //gridMap
const rect = gridMap.getBoundingClientRect();
let tokens = [];
let currentHp = document.getElementById("current");
let maxHp = document.getElementById("max");
let tempHp = document.getElementById("temp");
let AC = document.getElementById("AC");
let titleTxt = document.getElementById("title");
let offSet;
let divTO = document.getElementById("turnOrder");
let isSummonOn;
let firstRun = true;
let currentTurn;
let mode = "";
let modeRef;
let mouseDown = false;
let startX, scrollLeft;
let startY, scrollUp;
let slider = gridMap;

export function setWholeDB(data)
{
    addTokens();
}

export function setWholeTO(data)
{
    removeTurnOrder(); 
    setTurnOrder();
}

export function setWholeSummons(data)
{
    isSummonOn = window.wholeSummons["isSummonOn"];
}

export function setWholeBubbles(data)
{
    for(let bubble of Object.keys(window.wholeBubbles))
    {
        addBubbles(window.wholeBubbles[bubble]);
    }
}

function init()
{
    setInterval(timer, 250);

    document.getElementById("helpBtn").onclick = handleCharClick;
    document.getElementById("hideCover").onclick = hideCover; 

    let iFrames = document.getElementsByTagName("iframe");
    
    for(let iFrame of iFrames)
    {
        iFrame.oncontextmenu = function(e) {e.preventDefault(); return false;}
        wait(9, function() {iFrame.src = iFrame.classList[0];});
    }
 
    wait(13, function(){hideSkill()});
}

function hideSkill()
{
    let skillDiv = document.getElementById("skills");

    if(parent.skillsLoaded == true)
    {
        skillDiv.style.opacity = "1";
        skillDiv.style.display = "none";
    } 

    else
    {
        wait(3, function(){hideSkill();});
    }
}

const startDragging = (e) => 
{
    mouseDown = true;
    startX = e.pageX - slider.offsetLeft;
    startY = e.pageY - slider.offsetTop;
    scrollLeft = slider.scrollLeft;
    scrollUp = slider.scrollTop;
}

const stopDragging = (e) => 
{
    mouseDown = false;
}

const move = (e) => 
{
    e.preventDefault();
    if(!mouseDown) { return; }
    const x = e.pageX - slider.offsetLeft;
    const scrollX = x - startX;
    slider.scrollLeft = scrollLeft - scrollX;
    const y = e.pageY - slider.offsetTop;
    const scrollY = y - startY;
    slider.scrollTop = scrollUp - scrollY;
}

// Add the event listeners
slider.addEventListener('mousemove', move, false);
slider.addEventListener('mousedown', startDragging, false);
slider.addEventListener('mouseup', stopDragging, false);
slider.addEventListener('mouseleave', stopDragging, false);

function addBubbles(bubbleDB)
{
    if(bubbleDB != "hold")
    {
        if(document.getElementById(bubbleDB.id)){document.getElementById(bubbleDB.id).remove();}

        let bubble = document.createElement("img");
        bubble.style.position = "absolute";
        bubble.style.left = `${bubbleDB.x}px`;
        bubble.style.top = `${bubbleDB.y}px`;
        bubble.style.transform = `scale(${bubbleDB.size})`;
        bubble.classList.add("bubbles");
 
        bubble.id = bubbleDB.id;
        bubble.src = bubbleDB.src;
        placeBefore(bubble, document.getElementById("grid"));
    }
}

function addTokens()
{
    if(div.children.length > 1)
    {
        let loop = true;
        while(loop)
        {
            try 
            {
                if(div.children.length > 1)
                {
                    if(!(div.children[0].classList.contains("update")) && div.children[0].id != "grid")
                    {
                        div.removeChild(div.children[0]);
                    } 

                    else
                    {
                        if(!(div.lastChild.classList.contains("update")))
                        {
                            div.removeChild(div.lastChild);
                        }

                        else
                        {
                            loop = false;
                            break;
                        }
                    }
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
    }

    for(let key of Object.keys(window.wholeDB))
    {
        if(key == "map") {document.getElementById("grid").src = imgs["mapName"][window.wholeDB[key]];}
        else{addCharacter(window.wholeDB[key], false);}     
    }

    if(window.player == "Vi")
    {
        if(isSummonOn && !(Object.keys(window.wholeDB).includes("sky")) && window.wholeSummons["sky"] != undefined)
        {
            setDoc("currentMap/sky", window.wholeSummons["sky"]);
        }
    }

    if(!(Object.keys(window.wholeDB).includes(window.wholeChar[window.player]["token"]["id"])))
    {
        if(window.wholeDB["spawnPoint"])
        {
            let negOrPos = [-1, 1];
            let differential = [0, 1, 2];
            let diffrenceX;
            let diffrenceY;

            diffrenceX = getRandomItem(negOrPos) * getRandomItem(differential);
            diffrenceY = getRandomItem(negOrPos) * getRandomItem(differential);

            window.wholeChar[window.player]["token"]["xPos"] = `${parseInt(window.wholeDB["spawnPoint"]["xPos"]) + diffrenceX}`;
            window.wholeChar[window.player]["token"]["yPos"] = `${parseInt(window.wholeDB["spawnPoint"]["yPos"]) + diffrenceY}`;
        }

        setDoc(`currentMap/${window.wholeChar[window.player]["token"]["id"]}`, window.wholeChar[window.player]["token"]);

        if(isSummonOn)
        {
            for(let key of Object.keys(window.wholeSummons))
            {
                if(key != "isSummonOn" && key != "summonPreset")
                {
                    let user = window.wholeSummons[key]["title"].replaceAll(" ", "").slice(window.wholeSummons[key]["title"].indexOf(":") + 1).split(",");
                    user = toTitleCase(user[0]);

                    if(window.wholeChar[window.player]["charName"] == user)
                    {
                        if(window.wholeDB["spawnPoint"])
                        {
                            window.wholeSummons[key]["xPos"] = window.wholeDB["spawnPoint"]["xPos"];
                            window.wholeSummons[key]["yPos"] = window.wholeDB["spawnPoint"]["yPos"];
                        }

                        setDoc(`currentMap/${window.wholeSummons[key]["id"]}`, window.wholeSummons[key]);
                    }
                }
            }
        }

        setDoc(`playerChar/${window.player}/currentToken`, window.wholeChar[window.player]["token"]["id"]);
        location.reload();
    }
}

function makeToken(key, turn, charPos)
{
    let row = [document.createElement("div"), document.createElement("h6"), document.createElement("h6"), document.createElement("img")];
    let names = ["div", "Position", "Name", "timer"];

    for(let i = 0; i < 4; i++)
    {
        row[i].id = `${key}-${names[i]}`;
        row[i].style.margin = "5px";

        if(i != 0)
        {
            row[0].appendChild(row[i]); 
            row[i].style.display = "inline";

            if(i == 3)
            {
                if(Object.keys(window.wholeTO["Var"][key]).length == 1){row[i].classList.add("invisible");}
                row[i].src = "images/upcomingAction.png";
                row[i].style.width = "25px";
                row[i].style.height = "25px";
                row[i].title = "Has Active Spell/Ability. Click To Find Out What."
                row[i].onclick = handleTurnTimer;
            }
        }
    }

    if(turn == "true"){row[0].classList.add("selected"); currentTurn = charPos;}

    row[1].innerHTML = `${charPos}`;
    row[2].innerHTML = `| ${key}`;
    divTO.appendChild(row[0]);
}

function removeTurnOrder()
{
    let loop = true;
    
    while(loop)
    {
        if(divTO.children.length > 0)
        {
            divTO.removeChild(divTO.children[0]);
        }
        
        else
        {
            loop = false;
        }
    }
}

function setTurnOrder()
{
    for(let i = 1; i <= Object.keys(window.wholeTO).length; i++)
    {
        for(let key of Object.keys(window.wholeTO))
        {
            if(key == "Var")
            {
                let turn = document.getElementById("currentTurn");
                turn.innerHTML = `Turn: ${window.wholeTO[key]["currentTurn"]}`;
                continue;
            }
                
            else if(i == window.wholeTO[key].position)
            {
                makeToken(window.wholeTO[key].charName, window.wholeTO[key].selected, window.wholeTO[key].position);
                break;
            }
        }
    }

    for(let person of Object.keys(window.wholeTO["Var"]))
    {
        if(person == "currentTurn")
        {
            continue;
        }

        else
        {
            if(Object.keys(window.wholeTO["Var"][person]).length > 1)
            {
                for(let ability of Object.keys(window.wholeTO["Var"][person]))
                {
                    if(ability == "temp")
                    {
                        continue;
                    }

                    else
                    {
                        let used = window.wholeTO["Var"][person][ability];
                        
                        if(used["expires"] - 2 <= window.wholeTO["Var"]["currentTurn"])
                        {
                            let timer = document.getElementById(`${person}-timer`);
                            timer.src = "images/expiringAction.png";
                            timer.title = "Has a Spell/Ability that ends soon. Click To Find Out What.";
                            timer.onclick = handleTurnTimer;
                        }

                        if(used["expires"] == window.wholeTO["Var"]["currentTurn"])
                        {
                            deleteDoc(`currentTO/Var/${person}/${ability}`);
                        }
                    }
                }
            }
        }
    }
}

function handleTurnTimer()
{
    let div = document.getElementById("turnOrder");
    let person = this.id.slice(0, this.id.indexOf("-"));
    let skills = window.wholeTO["Var"][person];
    let back = document.createElement("a");
    let title = document.createElement("h5");
    let list = document.createElement("ul");

    title.innerHTML = toTitleCase(person);
    title.classList = "center color-UP-yellow";

    back.innerHTML = "<- Back";
    back.onclick = function(){removeTurnOrder(); setTurnOrder();};
    back.style.color = "#20b2aa";

    while(div.children.length > 0)
    {
        div.firstChild.remove();
    }

    for(let skill of Object.keys(skills))
    {
        if(skill != "temp")
        {
            let bullet = document.createElement("li");
            bullet.classList= "color-UP-yellow";
            bullet.innerHTML = `${skill} | ${skills[skill]["expires"] - window.wholeTO["Var"]["currentTurn"]} turns left active.`;
            list.appendChild(bullet);
        }
    }

    div.appendChild(back);
    div.appendChild(title);
    div.appendChild(list);
}

function addCharacter(character, update)
{
    let char = [document.createElement("img"), document.createElement("img"), document.createElement("img")];
    let tokenImg = character["name"];
    let x = map.pos[0];
    let y = map.pos[0];

    char[0].classList = `tokens ${character["id"]} char`;

    let image = tokenImg;
    let img = new Image();
    if(!image.includes("custom-")){img.src = window.imgs["tokens"][image];}
    else{img.src = window.wholeCustom[image]["src"];} 
    img.onerror = () => {char[0].src = `images/unknown-.png`;};
    
    if(!tokenImg.includes("custom-")){char[0].src = window.imgs["tokens"][tokenImg];} else{char[0].src = window.wholeCustom[tokenImg]["src"]; char[0].classList.add("customImg");}
    char[0].id = character["id"];
    
    char[1].src = window.imgs["borders"][character["border"]];
    char[1].id = character["border"];
    char[1].classList = `tokens ${character["id"]} border_`;
    char[2].src = getHpImg(character);
    char[2].id = "hp";
    char[2].classList = `tokens ${character["id"]} hp`;
    
    if(!character["title"].includes("Hidden"))
    {
        char[1].title = `${character["id"]}:${character["title"]}`;
    }

    if(window.wholeChar[window.player]["currentToken"] == character["id"])
    {
        if(currentHp.value == "" && title.innerHTML == "Status: ")
        {
            document.getElementById("title").innerHTML += character["title"];
        }

        currentHp.value = character["currentHp"];
        maxHp.innerHTML = "/ " + character["maxHp"];
        tempHp.value = character["tempHp"];
    }

    if(character.title != "")
    {
        let title = character.title;
        x = map.pos[map.xPos.indexOf(character["xPos"])];
        y = map.pos[map.yPos.indexOf(character["yPos"])];

        if(title.includes("Large"))
        {
            setupExp(2, char, "x");
            setupExp(2, char, "y");
        }

        else if(title.includes("Huge"))
        {
            setupExp(3, char, "x");
            setupExp(3, char, "y");
        }

        else if(title.includes("Gargantuan"))
        {
            setupExp(4, char, "x");
            setupExp(4, char, "y");
        }

        if(title.includes("Top"))
        {
            for(let image of char)
            {
                if(image.style.zIndex == "")
                {
                    image.style.zIndex = 400;
                }

                else
                {
                    image.style.zIndex = `${parseInt(image.style.zIndex) + 300}`;
                }
            }
        }

        else if(title.includes("Bottom"))
        {
            for(let image of char)
            {
                if(image.style.zIndex == "")
                {
                    image.style.zIndex = 20;
                }

                else
                {
                    image.style.zIndex = `${parseInt(image.style.zIndex) - 50}`;
                }
            }
        }

        if(title.includes("90"))
        {
            for(let image of char)
            {
                image.style.transform = 'rotate(90deg)';
            }
        }

        else if(title.includes("180"))
        {
            for(let image of char) 
            {
                image.style.transform = 'rotate(180deg)';
            }
        }

        else if(title.includes("270"))
        {
            for(let image of char)
            {
                image.style.transform = 'rotate(270deg)';
            }
        }

        if(title.includes("Opac"))
        {
            let opacityStart = title.indexOf("Opac") + 4;
            let opac = title.slice(opacityStart, opacityStart + 2);

            for(let image of char)
            {
                image.style.opacity = `.${opac}`;
            } 
        }

        if(title.includes("FlipX"))
        {
            for(let image of char)
            {
                image.style.transform += 'scaleX(-1)';
            } 
        }

        if(title.includes("FlipY"))
        {
            for(let image of char)
            {
                image.style.transform += 'scaleY(-1)';
            } 
        }

        if(title.includes("Invisible"))
        {
            if(window.wholeChar[window.player]["token"]["id"] != character["id"])
            {
                for(let image of char)
                {
                    image.src = "images/map/tokens/invisible-.png";
                }
            }

            else
            {
                char.push(document.createElement("img"));
                char[3].src = `images/map/tokens/pInvisable.png`;
                char[3].id = "tempInvis";
                char[3].classList = `tokens ${character["id"]} tempInvis`;
                char[3].onclick = handleCharClick;
            }
        }

        if(title.includes("Hidden"))
        {
            let name = titleTxt.innerHTML.replaceAll(" ", "").slice(titleTxt.innerHTML.indexOf(":") + 1).split(",");
            let compName = title.replaceAll(" ", "").slice(title.indexOf(":") + 1).split(",");

            if(!(name.includes(compName[0]) && compName[0] != "" || window.player == "Vi"))
            {
                for(let image of char)
                {
                    image.src = "images/map/tokens/invisible-.png";
                }
            }
        }

        if(title.includes("Dup X"))
        {
            dup("x", char, character, [x, y], title);
        }

        if(title.includes("Dup Y"))
        {
            dup("y", char, character, [x, y], title);
        }

        if(title.includes("Exp X")) 
        {   
            exp("x", title, char);             
        }

        if(title.includes("Exp Y")) 
        {
            exp("y", title, char);
        }

        char[0].title = `${character["title"]}`;
    }

    for(let i = 0; i < char.length; i++)
    {
        char[i].onclick = handleCharClick;
        placeTokens(x, y, char[i]);
        div.appendChild(char[i]);
    }

    if(char[0].classList.contains("customImg")) //Center
    {
        let offset = (parseFloat(char[1].offsetWidth) / 2) - (parseFloat(char[0].offsetWidth) / 2);
        char[0].style.top = `${parseFloat(char[0].style.top.replace("px", "")) + offset}px`;
        char[0].style.left = `${parseFloat(char[0].style.left.replace("px", "")) + offset}px`;
    }
}

function exp(xOrY, title, char)
{
    let expNum;

    if(xOrY == "x"){expNum = title.slice(title.indexOf("Exp X"));}
    else{expNum = title.slice(title.indexOf("Exp Y"));}

    if(expNum[5] != ",")
    {
        if(expNum[6] != ",")
        {
            setupExp(expNum[5] + expNum[6], char, xOrY);
        }

        else
        {
            setupExp(expNum[5], char, xOrY);
        }
    }

    else
    {
        setupExp(12, char, xOrY);
    }
}

function setupExp(num, char, xOrY)
{
    let size = (map.pos[num] - map.pos[0]) + "px";

    if(xOrY == "x")
    {
        for(let image of char)
        {
            image.style.width = size;
        }
    }
    
    else
    {
        for(let image of char)
        {
            image.style.height = size;
        }
    }
}

function dup(xOrY, char, character, locations, title)
{
    let num;
    let dupNum;
    let rotate = "0";

    if(xOrY == "x"){dupNum = title.slice(title.indexOf("Dup X"));}
    else{dupNum = title.slice(title.indexOf("Dup Y"));}
    if(title.includes("90")){rotate = "90";}
    else if(title.includes("180")){rotate = "180";}
    else if(title.includes("270")){rotate = "270";}

    if(dupNum[5] != ",")
    {
        if(dupNum[6] != ",")
        {
            num = parseInt(dupNum[5] + dupNum[6]);
        }

        else
        {
            num = parseInt(dupNum[5]);
        }
    }

    else
    {
        num = 12
    }

    if(xOrY == "x"){offSet = map.xPos.indexOf(character["xPos"]);}
    else{offSet = map.yPos.indexOf(character["yPos"]);}

    for(let i = 0; i < num; i++){setupDup(char, character, xOrY, locations, rotate)}
}

function setupDup(char, character, xOrY, locations, rotate)
{
    let stuffs = [document.createElement("img"), document.createElement("img"), document.createElement("img")];
    offSet++;

    for(let d = 0; d < 3; d++)
    {
        stuffs[d].classList.add("tokens");
        stuffs[d].src = char[d].src;
        stuffs[d].style.zIndex = char[d].style.zIndex;
        stuffs[d].style.transform = `rotate(${rotate}deg)`;
        stuffs[d].classList.add(character["id"]);
        
        if(xOrY == "x"){placeTokens(map.pos[offSet], locations[1], stuffs[d]);}
        else{placeTokens(locations[0], map.pos[offSet], stuffs[d]);}
        
        switch(d)
        {
            case 0:
            {
                stuffs[d].classList.add("char");
                break;
            }

            case 1:
                stuffs[d].classList.add("border_");
                break;

            case 2:
                stuffs[d].classList.add("hp");
                break;
        }

        div.appendChild(stuffs[d]);
    }
}


function getHpImg(character)
{
    let maxHp = character["maxHp"];
    let currentHp = character["currentHp"];
    let tempHp = character["tempHp"];

    return returnHpImage(maxHp, tempHp, currentHp);
}

function handleCharClick()
{
    let name = titleTxt.innerHTML.replaceAll(" ", "").slice(titleTxt.innerHTML.indexOf(":") + 1).split(",");
    let compName = this.title.replaceAll(" ", "").slice(this.title.indexOf(":") + 1).split(",");

    switch(mode)
    {
        case "waiting":
            if(window.player == "Vi" && !event.ctrlKey)
            {
                setDoc(`playerChar/${window.player}/currentToken`, this.classList[1]);
                location.reload();
            }
        
            else if(name.includes(compName[0]) && compName[0] != "")
            {
                setDoc(`playerChar/${window.player}/currentToken`, this.classList[1]);
                location.reload();
            }
        
            else
            {
                this.classList.add("selected-temp");

                handleViewTokens(this);
            }

            break;
        
        case "using":
            if(this.title.includes(":"))
            {
                if(this.classList.contains("selected-temp"))
                    {
                        this.classList.remove("selected-temp");

                        if(document.getElementsByName(this.classList[1]))
                        {
                            document.getElementsByName(this.classList[1])[0].checked = false;
                        }
                    }
        
                    else
                    {
                        this.classList.add("selected-temp");

                        if(document.getElementsByName(this.classList[1]))
                        {
                            document.getElementsByName(this.classList[1])[0].checked = true;
                        }
                    }
            }
            break;
    }
}

function handleViewTokens(t)
{
    let currentToken = document.getElementsByClassName(t.classList[1]);
    let viewDiv = document.getElementById("cover");
    let i = 0;
    let y = 2;
    let title;

    viewDiv.classList = "";
    viewDiv.style.zIndex = "1011";
    for(let elm of viewDiv.children[0].children)
    {
        if(t.id != "helpBtn" || elm.id == "hideCover" || elm.id == "showInstructions")
        {
            elm.classList = elm.classList[1];
            elm.style.zIndex = `101${y}`;
            y++;

            if(elm.src != undefined)
            {
                elm.src = currentToken[i].src;
                elm.title = currentToken[i].title;
                elm.classList.add(currentToken[i].classList[currentToken[i].classList.length - 1]);
                if(elm.title.includes(":"))
                {
                    title = elm.title;
                }
                
                i++;
            }

            else if(elm.id == "viewTitle")
            {
                elm.innerHTML = title;
            }
        }
    }

    viewDiv.children[0].classList = "";
    viewDiv.children[1].classList = "";

    if(t.id == "helpBtn")
    {
        let instructions = document.createElement("h3");
        let labels = ["Map", "Stats", "Actions", "Favorites"];
        let holdingDiv = document.createElement("div");
        holdingDiv.id = "holdingDiv";
        holdingDiv.classList.add("center");

        instructions.innerHTML = "Instructions";
        instructions.style.marginTop = "5%";
        instructions.style.color = "black";
        holdingDiv.appendChild(instructions);

        for(let i = 0; i < labels.length; i++)
        {
            let label = document.createElement("button");
            label.innerHTML = labels[i];
            label.classList.add("gridButton");
            label.style.margin = "3px";
            label.name = labels[i];
            label.onclick = changeInstructions;
            holdingDiv.appendChild(label);
        }

        viewDiv.insertBefore(holdingDiv, document.getElementById("viewToken"));
    }
}

function changeInstructions()
{
    let labels = ["Map", "Stats", "Actions", "Favorites"];
    let fill = ["The map will change once a character moves, if you click on a character you can see it enlarged. If you click on one of your own summons you will become it.", "The stats section contains controls to change the maps status. To move your token you can use the D-Pad or hold Ctrl and the arrow key. You can also change your token through keywords in the status:", "Here is all the spells and abilities for your characters. You can search or scroll to find the spell/ability you wish to use. Once you find it click on it, from here you can use the ability or add it to your favorites. Abilities that have a {@ will preform actions on cast. Then it will display the results on the display section on the webpage.", "In this section it will show your spells and actions you have favorited, this can be used to organize your abilities. If you click on one of the abilities it will let you edit them. You can also create custom abilites and spells from here. If you wish to create a button to better organise your abilites, all you need to do is select edit on the ability and change the Tag into what you want."];
    let keyWords = {"Large" : "This will make your token a large creature taking up a 2 x 2 square.", "Huge" : "This will make your token a huge creature taking up a 3 x 3 square.", "Gargantuan" : "This will make your token an Gargantuan creature taking up a 4 x 4 square.", "Top" : "This will make your token on top of other tokens.", "Bottom" : "This will make your token underneath others.", "Invisible" : "This will make only you be able to see your token."};
    let display = document.getElementById("showInstructions");

    for(let label of labels)
    {
        let button = document.getElementsByName(label);
        
        if(this.name == button[0].name)
        {
            this.classList.add("selected");
        }

        else
        {
            button[0].classList = "gridButton";
        }
    }

    switch(this.name)
    {
        case "Stats":
            display.innerHTML = fill[labels.indexOf(this.name)];
            display.innerHTML += "<ul>";
            for(let key of Object.keys(keyWords)){display.innerHTML += `<li>${key}: ${keyWords[key]}</li>`}
            display.innerHTML += "</ul>";
            break;

        case "Map":
        case "Actions":
        case "Favorites":
            display.innerHTML = fill[labels.indexOf(this.name)];
            break;
    }
}

function hideCover()
{
    let viewDiv = document.getElementById("cover");
    let selected = document.getElementsByClassName("selected-temp");

    for(let elm of viewDiv.children[0].children)
    {
        elm.classList = `invisible ${elm.classList[0]}`;
        elm.style.zIndex = "0";
    }

    for(let elm of viewDiv.children)
    {
        elm.classList = `invisible ${elm.classList[0]}`;
        elm.style.zIndex = "0";
    }
    
    let holdingDiv = document.getElementById("holdingDiv");
    if(holdingDiv != null){holdingDiv.remove();}

    viewDiv.children[1].children[0].classList.add("invisible");
    viewDiv.children[1].children[1].style.display = "none";
    viewDiv.children[1].children[2].style.display = "none";

    viewDiv.classList = `invisible`;
    viewDiv.style.zIndex = "0";

    if(selected.length > 0)
    {
        for(let select of selected)
        {
            select.classList.remove("selected-temp");
        }

        setQuickAction(false);
        let spellDiv = document.getElementById("spellsFQ");
        let actionDiv = document.getElementById("abilityFQ");

        while(spellDiv.children.length > 0) //Until the div is empty
        {
            spellDiv.removeChild(spellDiv.lastChild); 
        }


        while(actionDiv.children.length > 0) //Until the div is empty
        {
            actionDiv.removeChild(actionDiv.lastChild);
        }
    }
}

function placeTokens(x, y, prop)
{
    prop.style.left = x + "px";
    prop.style.top = y + "px";
}

function timer()
{
    if(window.wholeBubbles)
    {
        if(Object.keys(window.wholeBubbles).length > 1)
        {
            for(let bubble of Object.keys(window.wholeBubbles))
            {
                editBubble(window.wholeBubbles[bubble]);
            }
        }
    
        else
        {
            if(document.getElementsByClassName("bubbles").length > 0)
            {
                removeNullBubbles();
            }
        }
    }
}

function removeNullBubbles()
{
    let nullBubbles = document.getElementsByClassName("bubbles");

    for(let nullBubble of nullBubbles)
    {
        nullBubble.remove();
    }
}

function editBubble(bubbleDB)
{
    if(bubbleDB != "hold")
    {
        if(bubbleDB.size < 3.5)
        {
            bubbleDB.size += 0.5;
            setDoc(`bubbles/${bubbleDB.id}`, bubbleDB);
        }
        
        else
        {
            document.getElementById(bubbleDB.id).remove();
            deleteDoc(`bubbles/${bubbleDB.id}`, bubbleDB);
        } 
    }
}

init();

let startX2;
let startY2;
let startScrollLeft;
let startScrollTop;
let drag = false;

const iframe = document.getElementById("statSheet");
iframe.contentWindow.addEventListener("mousedown", (e) =>
{
    startX2 = e.clientX;
    startY2 = e.clientY;
    startScrollLeft = iframe.contentWindow.scrollX;
    startScrollTop = iframe.contentWindow.scrollY;
    drag = true;
});

iframe.contentWindow.addEventListener("mousemove", (moveEvent) =>
{
    moveEvent.preventDefault();
    const dx = moveEvent.clientX - startX2;
    const dy = moveEvent.clientY - startY2;

    if(drag){iframe.contentWindow.scrollTo(startScrollLeft - dx, startScrollTop - dy);}
});

iframe.contentWindow.addEventListener("mouseup", () =>
{
    drag = false;
});

export function setMode(auth)
{
    setDoc(`playerChar/${window.player}/mode`, "waiting");
    
    modeRef = ref(database, `playerChar/${window.player}/mode`);
    onValue(modeRef, (snapshot) => 
    {
        const data = snapshot.val();
        mode = data;
    });
}