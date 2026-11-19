/**
 * map.js — draws the battle map and turn order on the dashboard (index.html).
 *
 * The map is #gridMap: a big grid picture (#grid) with tokens laid over it as absolutely
 * positioned images. Every token on the map is stored at currentMap/<id> as
 *   { id, name (picture), border, xPos "1"-"26", yPos "A"-"Z", currentHp, maxHp, tempHp, AC, title, ... }
 * and drawn as three stacked pictures: the token, its border ring, and its HP bar.
 *
 * The token's "title" is its status line (e.g. " Ben, Large, Top,"). Keywords in it change
 * how it's drawn — see addCharacter():
 *   Large / Huge / Gargantuan   2×2 / 3×3 / 4×4 squares
 *   Top / Bottom                drawn above / below other tokens
 *   Rotate N / RotN             rotate N degrees, any angle (Rotate 45, Rot-30); a bare
 *                               number between commas (", 180,") still works too
 *   FlipX / FlipY               mirror left-right / top-bottom (as seen on the map)
 *   OpacNN                      see-through, e.g. Opac50
 *   Invisible                   only its owner sees it
 *   Hidden: Name                only that character (and the DM) can see it
 *   Dup X n / Dup Y n           repeat it n squares across/down (walls, rivers...)
 *   Dup XY n / Dup XY w x h     fill an n-by-n (or w-wide, h-tall) box with it (floors, pits...)
 *   Exp X n / Exp Y n           stretch it n squares across/down
 *
 * Data arrives from parent.js through the exported set* functions. Clicking tokens,
 * moving, HP and actions are handled by mapControler.js; this file mostly draws.
 * Spell "bubbles" (area-of-effect rings) grow every quarter-second and then disappear.
 *
 * Distance ruler: right-click a square, move the mouse (a line and running distance follow
 * it), right-click another square to finish. Everyone sees it, in the measuring player's
 * border colour, and it fades 5 seconds after the second click. Esc cancels. Stored at
 * rulers/<player>. Distance uses 5ft squares with diagonals alternating 5ft / 10ft.
 */


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

/**
 * parent.js calls this whenever the map data changes: redraw all tokens.
 */
export function setWholeDB(data)
{
    addTokens();
}

/**
 * parent.js calls this whenever the turn order changes: redraw the turn-order list.
 */
export function setWholeTO(data)
{
    removeTurnOrder(); 
    setTurnOrder();
}

/**
 * parent.js calls this when the DM's summons change: remember whether summons are on.
 */
export function setWholeSummons(data)
{
    isSummonOn = window.wholeSummons["isSummonOn"];
}

/**
 * parent.js calls this when anyone's distance ruler changes: redraw the rulers.
 */
export function setWholeRulers(data)
{
    window.wholeRulers = data ?? {};
    drawRulers();
}

/**
 * parent.js calls this when spell bubbles change: draw each one on the map.
 */
export function setWholeBubbles(data)
{
    for(let bubble of Object.keys(window.wholeBubbles))
    {
        addBubbles(window.wholeBubbles[bubble]);
    }
}

/**
 * Starts the bubble animation timer, hooks up the help button, and loads each tab's iframe
 * 9 seconds after the page opens (so the map loads first). Each iframe's page name is
 * stored as its first class (class="stats.html"). Right-click menus are blocked on them.
 */
function init()
{
    setInterval(timer, 250);

    document.getElementById("helpBtn").onclick = function(){handleViewTokens(this);}; //Opens the instructions overlay
    document.getElementById("hideCover").onclick = hideCover; 

    let iFrames = document.getElementsByTagName("iframe");
    
    for(let iFrame of iFrames)
    {
        iFrame.oncontextmenu = function(e) {e.preventDefault(); return false;}
        wait(9, function() {iFrame.src = iFrame.classList[0];});
    }
 
    wait(13, function(){hideSkill()});
}

/**
 * The Skill Tree tab has to be visible while it loads (its image map needs real sizes).
 * Once skillTree.js reports it has loaded, hide the tab again; otherwise check every 3s.
 */
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

// Click-and-drag to scroll the map: remember where the drag started...
const startDragging = (e) => 
{
    if(e.button !== 0){return;} //Only the left button pans (right-click is the ruler)
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

// ...and scroll by however far the mouse has moved since.
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

/**
 * Draws one spell bubble (a ring image) at its saved position and size.
 * A bubble of "hold" is a placeholder that keeps bubbles/ from being empty.
 */
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

/**
 * Redraws the whole map. Removes every old token (keeps #grid and anything marked
 * "update"), sets the map picture, then draws every token.
 * If the logged-in player's own token isn't on the map yet, it's added (near the map's
 * spawn point, with a random 0–2 square offset) along with any of their summons, then
 * the page reloads to show it.
 */
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

/**
 * Adds one row to the turn-order list: position number, "| Name", and a small icon
 * that appears when that character has a spell/ability running (click it for details).
 * The character whose turn it is gets highlighted.
 */
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

/**
 * Empties the turn-order list.
 */
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

/**
 * Rebuilds the turn order in position order (1, 2, 3...), shows the turn counter, and
 * checks everyone's running spells/abilities: ones ending within 2 turns get the
 * "expiring" icon, and ones that have reached their end turn are removed.
 */
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

/**
 * Clicked the running-ability icon in the turn order: swaps the list for that character's
 * active spells/abilities and how many turns each has left, with a Back link.
 */
function handleTurnTimer()
{
    let div = document.getElementById("turnOrder");
    let person = this.id.slice(0, this.id.indexOf("-"));
    let skills = window.wholeTO["Var"][person];
    let back = document.createElement("a");
    let title = document.createElement("h5");
    let list = document.createElement("ul");

    title.innerHTML = toTitleCase(person);
    title.classList = "center text-brass";

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
            bullet.classList= "text-brass";
            bullet.innerHTML = `${skill} | ${skills[skill]["expires"] - window.wholeTO["Var"]["currentTurn"]} turns left active.`;
            list.appendChild(bullet);
        }
    }

    div.appendChild(back);
    div.appendChild(title);
    div.appendChild(list);
}

/**
 * Draws one token (picture + border ring + HP bar) at its grid square, applying any status
 * keywords in its title (see the top of this file). Also, if this is the token the player
 * is controlling, fills in the HP boxes and status line under the map.
 * Non-73px pictures (custom uploads) are cropped to a circle and centred in the ring.
 */
function addCharacter(character, update)
{
    let char = [document.createElement("img"), document.createElement("img"), document.createElement("img")];
    let tokenImg = character["name"];
    //Always place the token at its saved square. (This used to happen only when it had a status,
    //so a token whose status was emptied was drawn at 1A and every move started from 1A.)
    let x = map.pos[map.xPos.indexOf(character["xPos"])] ?? map.pos[0];
    let y = map.pos[map.yPos.indexOf(character["yPos"])] ?? map.pos[0];
    if(character["title"] == undefined){character["title"] = " ";}

    char[0].classList = `tokens ${character["id"]} char`;

    let image = tokenImg;
    let img = new Image();
    // Test-load the picture so a missing one can fall back to the "unknown" token.
    if(!image.includes("custom-")){img.src = window.imgs["tokens"][image];}
    else{img.src = window.wholeCustom[image]["src"];} 
    img.onerror = () => {char[0].src = `images/unknown-.png`;};
    
    char[0].src = window.imgs["tokens"][tokenImg];
    char[0].id = character["id"];
    char[0].style.maxHeight = "100%";
    char[0].style.maxWidth = "100%";
    

    char[0].onload = function() 
    {
        if (this.naturalWidth !== 73 || this.naturalHeight !== 73) 
        {
            this.classList.add("customImg");
            
            // Force non-standard uploads to scale down safely to the grid cell bounds
            this.style.setProperty("borderRadius", "50%");
            this.style.setProperty("objectFit", "cover");
        }
    };
    
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
                    image.style.zIndex = 1000;
                }

                else
                {
                    image.style.zIndex = `${parseInt(image.style.zIndex) + 550}`;
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

        let transform = getTokenTransform(title); //Rotate / FlipX / FlipY

        if(transform != "")
        {
            for(let image of char)
            {
                image.style.transform = transform;
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

        if(title.includes("Invisible"))
        {
            if(window.wholeChar[window.player]["token"]["id"] != character["id"])
            {
                for(let image of char)
                {
                    image.src = window.imgs["tokens"]["invisible-"];
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
                    image.src = window.imgs["tokens"]["invisible-"];
                }
            }
        }

        if(/Dup\s*XY/i.test(title)) //Any case: the status box title-cases words, so "dup xy3" arrives as "Dup Xy3"
        {
            dupBox(char, character, title);
        }

        if(/Dup\s*X(?!\s*Y)/i.test(title)) //"Dup XY" is the box above, not a line
        {
            dup("x", char, character, [x, y], title);
        }

        if(/Dup\s*Y/i.test(title))
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

    //Dup copies go in after the real token, so the token's own pictures are found first
    for(let copy of pendingDupCopies){div.appendChild(copy);}
    pendingDupCopies = [];

    if(char[0].classList.contains("customImg")) //Center
    {
        let offset = (parseFloat(char[1].offsetWidth) / 2) - (parseFloat(char[0].offsetWidth) / 2);
        char[0].style.top = `${parseFloat(char[0].style.top.replace("px", "")) + offset}px`;
        char[0].style.left = `${parseFloat(char[0].style.left.replace("px", "")) + offset}px`;
    }
}

/**
 * Reads the number after "Exp X" / "Exp Y" in a title (1 or 2 digits; 12 if there is
 * no number) and stretches the token that many squares.
 */
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

/**
 * Sets the width (x) or height (y) of all of a token's pictures to `num` squares.
 */
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

/**
 * Reads the rotation and flips from a token's status line and returns the CSS transform
 * ("" if none). Rotation, any angle, in degrees:
 *   "Rotate 45", "Rotate45", "Rot 12.5", "Rot-30"   (Rotate/Rot, any capitalisation)
 *   a bare number between commas, e.g. " 180, Bottom,"   (older tokens use this)
 * Flips: "FlipX" / "Flip X" mirrors left-right, "FlipY" / "Flip Y" mirrors top-bottom.
 * Flips are applied after the rotation, so they always mirror along the map's own axes.
 * Numbers inside other keywords (Opac90, Dup X18, T11) are never read as a rotation.
 */
function getTokenTransform(title)
{
    let degrees = null;
    let named = title.match(/\brot(?:ate)?\s*(-?\d+(?:\.\d+)?)/i);

    if(named)
    {
        degrees = parseFloat(named[1]);
    }

    else
    {
        for(let part of title.split(","))
        {
            let bare = part.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:deg|°)?$/i);
            if(bare){degrees = parseFloat(bare[1]); break;}
        }
    }

    let flips = "";
    if(/\bflip\s*x/i.test(title)){flips += "scaleX(-1) ";}
    if(/\bflip\s*y/i.test(title)){flips += "scaleY(-1) ";}

    let rotate = (degrees != null && degrees % 360 != 0) ? `rotate(${degrees}deg)` : "";
    return `${flips}${rotate}`.trim();
}

/**
 * Reads the number after "Dup X" / "Dup Y" (12 if there is no number) and draws that many
 * copies of the token in a line to the right / downward, keeping its rotation and flips.
 */
function dup(xOrY, char, character, locations, title) 
{
    let rotate = getTokenTransform(title); //Copies get the same rotation and flips
    let found = xOrY == "x" ? title.match(/Dup\s*X(?!\s*Y)\s*(\d+)?/i) : title.match(/Dup\s*Y\s*(\d+)?/i);
    let num = (found && found[1]) ? parseInt(found[1]) : 12;

    let baseIndex;
    let posArray;
    if(xOrY == "x")
    {
        posArray = map.xPos;
        baseIndex = posArray.indexOf(character["xPos"]);
    } 
    
    else 
    {
        posArray = map.yPos;
        baseIndex = posArray.indexOf(character["yPos"]);
    }

    if (baseIndex === -1) return;

    // Loop to spawn duplicates extending outward from the base token position
    for(let i = 1; i <= num; i++) {
        // Adjust the offset step to correct the rightward bias
        let currentOffset = (baseIndex - 1) + i;
        //i = 1 is the token's own square: the real token is already there, and a copy on
        //top of it would catch clicks meant for the token
        if (currentOffset != baseIndex && currentOffset >= 0 && currentOffset < posArray.length) {
            setupDup(char, character, xOrY, locations, rotate, currentOffset);
        }
    }
}

/**
 * "Dup XY n" fills an n-by-n box, "Dup XY w x h" (e.g. Dup XY4x3) a box w squares wide and
 * h tall, starting at the token's square and going right and down. No number means 12.
 * Like Dup X / Dup Y the count includes the token's own square, so Dup XY3 covers 3x3.
 */
function dupBox(char, character, title)
{
    let rotate = getTokenTransform(title);
    let found = title.match(/Dup\s*XY\s*(\d+)?(?:\s*[x*]\s*(\d+))?/i);
    let width = (found && found[1]) ? parseInt(found[1]) : 12;
    let height = (found && found[2]) ? parseInt(found[2]) : width;

    let startX = map.xPos.indexOf(character["xPos"]);
    let startY = map.yPos.indexOf(character["yPos"]);
    if(startX === -1 || startY === -1) return;

    for(let row = 0; row < height; row++)
    {
        for(let col = 0; col < width; col++)
        {
            if(row == 0 && col == 0){continue;} //The token itself is already there

            let xIndex = startX + col;
            let yIndex = startY + row;

            //Stop at the map's edge
            if(xIndex < map.pos.length && yIndex < map.pos.length && xIndex < map.xPos.length && yIndex < map.yPos.length)
            {
                drawDupCopy(char, character, rotate, map.pos[xIndex], map.pos[yIndex]);
            }
        }
    }
}

/**
 * Draws one copy (picture, ring and HP bar) of a duplicated token at grid offset `offSet`.
 */
function setupDup(char, character, xOrY, locations, rotate, offSet) 
{
    if(xOrY == "x"){drawDupCopy(char, character, rotate, map.pos[offSet], locations[1]);}
    else{drawDupCopy(char, character, rotate, locations[0], map.pos[offSet]);}
}

/**
 * Draws one copy (picture, ring and HP bar) of a duplicated token at map position (x, y).
 */
function drawDupCopy(char, character, rotate, x, y)
{
    let stuffs = [document.createElement("img"), document.createElement("img"), document.createElement("img")];
    
    for(let d = 0; d < 3; d++) 
    {
        stuffs[d].classList.add("tokens");
        stuffs[d].src = char[d].src;
        stuffs[d].style.zIndex = char[d].style.zIndex;
        stuffs[d].style.transform = rotate;
        stuffs[d].classList.add(character["id"]);
        placeTokens(x, y, stuffs[d]);
        
        switch(d) 
        {
            case 0: 
                stuffs[d].classList.add("char");
                break;

            case 1:
                stuffs[d].classList.add("border_");
                break;

            case 2:
                stuffs[d].classList.add("hp");
                break;
        }

        stuffs[d].classList.add("dupCopy");
        stuffs[d].onclick = clickMapUnderCopy; //Acts like clicking the map there: drops a bubble
        pendingDupCopies.push(stuffs[d]); //Added to the map after the real token (see addCharacter)
    }
}

/**
 * Copies made by Dup X / Dup Y / Dup XY wait here until addCharacter has added the real
 * token. The copies share the token's class, and Change Token, moving etc. use the first
 * pictures with that class, so the real token's pictures must come first on the page.
 */
let pendingDupCopies = [];

/**
 * Clicking a Dup copy: pass the click on to the map picture at the same screen point, so it
 * drops a bubble exactly like clicking empty map there (the browser works out the spot,
 * zoom included). Copies aren't tokens of their own, so they don't select anything.
 */
function clickMapUnderCopy(e)
{
    let grid = document.getElementById("grid");
    if(!grid){return;}

    e.stopPropagation();
    grid.dispatchEvent(new MouseEvent("click", {clientX : e.clientX, clientY : e.clientY, screenX : e.screenX, screenY : e.screenY, bubbles : true, cancelable : true, view : window}));
}


/**
 * Picks the HP-bar picture for a token from its current / max / temp HP.
 */
function getHpImg(character)
{
    let maxHp = character["maxHp"];
    let currentHp = character["currentHp"];
    let tempHp = character["tempHp"];

    return returnHpImage(maxHp, tempHp, currentHp);
}

/**
 * A token was clicked. What happens depends on the player's mode:
 *   waiting: the DM (unless holding Ctrl), or a player clicking a token whose name is in
 *            their own status line (their summons), takes control of that token.
 *            Anyone else's token opens the enlarged token view.
 *   using:   they're picking targets for a spell/ability: toggle this token as a target
 *            and tick/untick its checkbox in the target list.
 */
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

/**
 * Opens the enlarged token view (#cover) for the clicked token, copying its picture,
 * ring and HP bar into it with its name/title. The help button reuses the same overlay
 * and adds Instructions tabs (Map / Stats / Actions / Favorites), opening on Map.
 */
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

        // The tabs go inside the overlay's first box, above the instruction text
        viewDiv.children[0].insertBefore(holdingDiv, document.getElementById("showInstructions"));
        holdingDiv.querySelector("button").click(); //Start on the Map instructions
    }
}

/**
 * Help overlay: shows the instructions for the tab that was clicked. The Stats tab
 * also lists the status keywords (Large, Huge, Top, Invisible...).
 */
function changeInstructions()
{
    let labels = ["Map", "Stats", "Actions", "Favorites"];
    let fill = ["The map will change once a character moves, if you click on a character you can see it enlarged. If you click on one of your own summons you will become it. Click an empty spot to drop a bubble everyone can see.<br><br><b>Measuring distance:</b> right-click a square, move the mouse, then right-click another square. Everyone sees the line and distance in your token's border colour for 5 seconds. Each square is 5ft; diagonals alternate 5ft and 10ft. Press Esc to cancel.", "The stats section contains controls to change the maps status. To move your token you can use the D-Pad or hold Ctrl and the arrow key. You can also change your token through keywords in the status:", "Here is all the spells and abilities for your characters. You can search or scroll to find the spell/ability you wish to use. Once you find it click on it, from here you can use the ability or add it to your favorites. Abilities that have a {@ will preform actions on cast. Then it will display the results on the display section on the webpage.", "In this section it will show your spells and actions you have favorited, this can be used to organize your abilities. If you click on one of the abilities it will let you edit them. You can also create custom abilites and spells from here. If you wish to create a button to better organise your abilites, all you need to do is select edit on the ability and change the Tag into what you want."];
    let keyWords = {"Large" : "This will make your token a large creature taking up a 2 x 2 square.", "Huge" : "This will make your token a huge creature taking up a 3 x 3 square.", "Gargantuan" : "This will make your token an Gargantuan creature taking up a 4 x 4 square.", "Top" : "This will make your token on top of other tokens.", "Bottom" : "This will make your token underneath others.", "Invisible" : "This will make only you be able to see your token.",
        "Rotate" : "Rotates your token by any number of degrees, e.g. <b>Rotate 45</b> or <b>Rotate -30</b> (Rot 45 works too). Positive turns clockwise.",
        "FlipX / FlipY" : "Mirrors your token left-to-right (<b>FlipX</b>) or top-to-bottom (<b>FlipY</b>). You can use both, and combine them with Rotate.",
        "OpacNN" : "Makes your token see-through, e.g. <b>Opac50</b> for half visible.",
        "Dup X n / Dup Y n" : "Repeats your token n squares to the right / down, e.g. <b>Dup X4</b>. Handy for walls and rivers.",
        "Dup XY n" : "Fills a box with your token, starting at its square and going right and down: <b>Dup XY3</b> covers 3x3, <b>Dup XY4x2</b> covers 4 wide by 2 tall. Handy for floors and pits.",
        "Exp X n / Exp Y n" : "Stretches your token across n squares to the right / down, e.g. <b>Exp X2</b>."};
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
            //Build the whole list first: adding "<ul>" to innerHTML on its own closes it straight away
            display.innerHTML = fill[labels.indexOf(this.name)] + "<ul style='text-align:left'>" +
                Object.keys(keyWords).map(key => `<li><b>${key}</b>: ${keyWords[key]}</li>`).join("") +
                "</ul>Separate keywords with commas, e.g. <b>Large, Rotate 45, FlipX</b>";
            break;

        case "Map":
        case "Actions":
        case "Favorites":
            display.innerHTML = fill[labels.indexOf(this.name)];
            break;
    }
}

/**
 * Closes the token view / help overlay, un-highlights any targeted tokens, turns quick-action
 * mode off and empties the quick-action spell lists.
 */
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

/**
 * Moves one picture to pixel position (x, y) on the map.
 */
/* ------------------------------------------------------------------------------------ *
 *  Distance ruler                                                                      *
 * ------------------------------------------------------------------------------------ */

const SVG_NS = "http://www.w3.org/2000/svg";
const TOKEN_HALF = 36.5;      //Tokens are 73px pictures, so a square's centre is pos + 36.5
const RULER_SHOW_MS = 5000;   //How long a finished ruler stays before fading
const RULER_FADE_MS = 1000;   //Length of the fade itself
//The ring colour of each border picture (images in files/borders)
const RULER_COLOURS = {"blue" : "#181368", "golden" : "#a28d05", "green" : "#007119", "grey" : "#5e5e5e",
                       "orange" : "#b97500", "pink" : "#b514ad", "purple" : "#4f0071", "red" : "#bf0000"};

let myRuler = null;       //{start: {c, r}, end: {c, r}, at} while this player is measuring
let rulerTimers = {};     //player -> {at, fade, remove} timers for finished rulers
let fadedRulers = {};     //player -> the "at" of the ruler this screen has already faded out

/**
 * Feet between two squares: 5ft per square, diagonals alternate 5ft / 10ft
 * (the first diagonal is 5, the second 10, the third 5...).
 */
export function rulerFeet(a, b)
{
    let dx = Math.abs(a.c - b.c);
    let dy = Math.abs(a.r - b.r);
    let diagonals = Math.min(dx, dy);
    let straight = Math.max(dx, dy) - diagonals;
    return 5 * straight + 5 * diagonals + 5 * Math.floor(diagonals / 2);
}

/**
 * The map square under the mouse for a map event, as {c, r} (0-25), or null if the mouse
 * isn't over the map picture or a token. On a token (or Dup copy) it's that token's square.
 */
function squareFromEvent(e)
{
    let x, y;
    let target = e.target;

    if(target && target.id == "grid")
    {
        let zoom = window.wholeChar?.[window.player]?.["zoomLevel"] || 100; //Same conversion as the click bubbles
        x = e.offsetX * (100 / zoom);
        y = e.offsetY * (100 / zoom);
    }

    else if(target && target.classList && target.classList.contains("tokens") && target.style.left != "")
    {
        x = parseFloat(target.style.left) + TOKEN_HALF;
        y = parseFloat(target.style.top) + TOKEN_HALF;
    }

    else
    {
        return null;
    }

    let toIndex = (v) => Math.max(0, Math.min(25, Math.floor((v - map.pos[0]) / map.movement)));
    return {c : toIndex(x), r : toIndex(y)};
}

/**
 * The CSS colour for this player's ruler: their token's border colour, like the click
 * bubbles (blue if the border is invisible or unknown).
 */
function myRulerColour()
{
    let tokenId = window.wholeChar?.[window.player]?.["currentToken"];
    let border = window.wholeDB?.[tokenId]?.["border"];
    return RULER_COLOURS[border] ?? RULER_COLOURS["blue"];
}

/**
 * Saves this player's ruler so everyone's map draws it. done = second click made.
 */
function saveMyRuler(done)
{
    if(!myRuler){return;}
    let ruler = {"player" : window.player, "start" : myRuler.start, "end" : myRuler.end,
        "colour" : myRulerColour(), "done" : done, "at" : myRuler.at};
    if(done){ruler["doneAt"] = Date.now();}
    setDoc(`rulers/${window.player}`, ruler);
}

/**
 * Right-click on the map: the first one starts a ruler at that square, the second one
 * finishes it there. The browser menu is blocked on the map.
 */
function handleRulerClick(e)
{
    e.preventDefault();
    let square = squareFromEvent(e);
    if(!square){return;}

    if(!myRuler)
    {
        myRuler = {"start" : square, "end" : square, "at" : Date.now()};
        saveMyRuler(false);
    }

    else
    {
        myRuler.end = square;
        saveMyRuler(true);

        //Tidy up the database once it has faded (unless a new ruler has replaced it)
        let at = myRuler.at;
        let player = window.player;
        setTimeout(() =>
        {
            if(window.wholeRulers?.[player]?.["at"] == at){deleteDoc(`rulers/${player}`);}
        }, RULER_SHOW_MS + RULER_FADE_MS + 500);

        myRuler = null;
    }
}

/**
 * While measuring, the end of the line follows the mouse square by square (it's only
 * saved when the square changes, not on every mouse movement).
 */
function handleRulerMove(e)
{
    if(!myRuler){return;}
    let square = squareFromEvent(e);
    if(!square || (square.c == myRuler.end.c && square.r == myRuler.end.r)){return;}

    myRuler.end = square;
    saveMyRuler(false);
}

/**
 * Esc cancels a ruler that's still being measured.
 */
function handleRulerKey(e)
{
    if(e.key == "Escape" && myRuler)
    {
        myRuler = null;
        deleteDoc(`rulers/${window.player}`);
    }
}

/**
 * The SVG layer the rulers are drawn on. It sits right after the map picture and is marked
 * "update", so addTokens() keeps it when it redraws the tokens.
 */
function getRulerLayer()
{
    let layer = document.getElementById("rulerLayer");

    if(!layer)
    {
        layer = document.createElementNS(SVG_NS, "svg");
        layer.id = "rulerLayer";
        layer.classList.add("update");
        let size = map.trueMapSize;
        layer.setAttribute("width", size);
        layer.setAttribute("height", size);
        layer.setAttribute("viewBox", `0 0 ${size} ${size}`);
        document.getElementById("grid").after(layer);
    }

    return layer;
}

/**
 * Draws every player's ruler from window.wholeRulers: a line between the two square
 * centres, a dot at each end and the distance in feet. Finished rulers fade out after
 * 5 seconds on every screen.
 */
function drawRulers()
{
    let rulers = window.wholeRulers ?? {};
    let layer = getRulerLayer();

    //Remove rulers that are gone, or that have been replaced by a new measurement
    for(let group of Array.from(layer.children))
    {
        let player = group.dataset.player;
        if(!rulers[player] || String(rulers[player].at) != group.dataset.at){group.remove();}
    }

    for(let player of Object.keys(rulers))
    {
        let ruler = rulers[player];
        if(!ruler || !ruler.start || !ruler.end){continue;}
        if(fadedRulers[player] == ruler.at){continue;} //Already shown and faded on this screen

        //A finished ruler left behind (e.g. its player reloaded before it was cleared)
        if(ruler.done && Math.abs(Date.now() - (ruler.doneAt ?? ruler.at)) > 60 * 1000)
        {
            if(player == window.player){deleteDoc(`rulers/${player}`);}
            continue;
        }

        let group = Array.from(layer.children).find((g) => g.dataset.player == player);

        if(!group)
        {
            group = document.createElementNS(SVG_NS, "g");
            group.dataset.player = player;
            group.dataset.at = String(ruler.at);
            group.classList.add("ruler");
            layer.appendChild(group);
        }

        let colour = ruler.colour ?? RULER_COLOURS["blue"];
        let x1 = map.pos[ruler.start.c] + TOKEN_HALF, y1 = map.pos[ruler.start.r] + TOKEN_HALF;
        let x2 = map.pos[ruler.end.c] + TOKEN_HALF, y2 = map.pos[ruler.end.r] + TOKEN_HALF;
        let feet = rulerFeet(ruler.start, ruler.end);

        //Distance tag just past the end of the line (clear of the token there), kept on the map
        let text = `${feet} ft`;
        let tagW = 22 * text.length + 26, tagH = 46;
        let angle = (x1 == x2 && y1 == y2) ? -Math.PI / 4 : Math.atan2(y2 - y1, x2 - x1);
        let reach = 44 + Math.abs(Math.cos(angle)) * tagW / 2 + Math.abs(Math.sin(angle)) * tagH / 2;
        let size = map.trueMapSize;
        let labelX = Math.max(tagW / 2, Math.min(size - tagW / 2, x2 + Math.cos(angle) * reach));
        let labelY = Math.max(tagH / 2, Math.min(size - tagH / 2, y2 + Math.sin(angle) * reach));

        group.innerHTML =
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"/>` +
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="6" stroke-linecap="round"/>` +
            `<circle cx="${x1}" cy="${y1}" r="9" fill="${colour}" stroke="#000" stroke-width="2"/>` +
            `<circle cx="${x2}" cy="${y2}" r="9" fill="${colour}" stroke="#000" stroke-width="2"/>` +
            `<rect x="${labelX - tagW / 2}" y="${labelY - tagH / 2}" width="${tagW}" height="${tagH}" rx="12" fill="#1b1512" fill-opacity=".88" stroke="${colour}" stroke-width="4"/>` +
            `<text x="${labelX}" y="${labelY + 2}" text-anchor="middle" dominant-baseline="middle" class="rulerLabel" fill="#fff">${text}</text>`;

        //Finished: fade out 5 seconds after this screen first saw it finished
        let timers = rulerTimers[player];
        if(timers && timers.at != ruler.at){clearTimeout(timers.fade); clearTimeout(timers.remove); delete rulerTimers[player];}

        if(ruler.done && !rulerTimers[player])
        {
            rulerTimers[player] = {"at" : ruler.at,
                "fade" : setTimeout(() => group.classList.add("rulerFading"), RULER_SHOW_MS),
                "remove" : setTimeout(() => {group.remove(); delete rulerTimers[player]; fadedRulers[player] = ruler.at;}, RULER_SHOW_MS + RULER_FADE_MS)};
        }
    }
}

div.addEventListener("contextmenu", handleRulerClick);
div.addEventListener("mousemove", handleRulerMove);
document.addEventListener("keydown", handleRulerKey);

function placeTokens(x, y, prop)
{
    prop.style.left = x + "px";
    prop.style.top = y + "px";
}

/**
 * Runs every 250ms: grows each spell bubble one step, or clears leftover bubble pictures
 * when there are none left in the database.
 */
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

/**
 * Removes every bubble picture from the map.
 */
function removeNullBubbles()
{
    let nullBubbles = document.getElementsByClassName("bubbles");

    for(let nullBubble of nullBubbles)
    {
        nullBubble.remove();
    }
}

/**
 * Grows a bubble by 0.5 until it reaches 3.5× size, then deletes it from the page and the database.
 */
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

// Same click-and-drag scrolling for the character sheet in the Sheet tab.
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

/**
 * Called by parent.js after login. Sets this player's mode to "waiting" (not picking
 * targets) and keeps `mode` in sync with the database from then on.
 */
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

// Opening index.html#sheet (the "Character Sheet" link in the name dropdown)
// jumps straight to the Sheet tab. The tab's click handler is attached by
// another script, so wait for it before clicking (falls back after 5s).
function openTabFromHash()
{
    if(location.hash != "#sheet"){return;}

    let sheetBtn = document.querySelector('.firstMenu[name="sheet"]');
    if(!sheetBtn){return;}

    let tries = 0;
    let timer = setInterval(() =>
    {
        tries++;
        if(sheetBtn.onclick || tries >= 20)
        {
            clearInterval(timer);
            sheetBtn.click();
        }
    }, 250);
}

openTabFromHash();
window.addEventListener("hashchange", openTabFromHash);
