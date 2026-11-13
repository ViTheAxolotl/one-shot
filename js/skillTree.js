/**
 * skillTree.js — the Skill Tree tab (skillTree.html, shown in an iframe).
 *
 * The tree is one big picture with an HTML <map>: every circle on it is an <area>
 * whose title is the skill's id (e.g. "Strength1", "all2", "start1", or a special
 * infusion like "ferret3"). On load, every circle gets a dark "hide.png" cover.
 * Unlocked skills (saved at playerChar/<Player>/skillTree/<id> = "active") have their
 * cover made see-through.
 *
 * Below the tree it totals the bonuses: +1 to an ability score per ability circle
 * ("all" gives +1 to all six), plus the special infusions, whose names, descriptions
 * and infusion % come from src/skillTree.json. The total infusion % is saved to
 * the character's stats as InfusedRate.
 */

"use strict";
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js';
import { toTitleCase, auth, database, setDoc, deleteDoc, reload } from '../js/viMethods.js';

let player;
let wholeSkills;
let skills;
let skillDesc;
let infused = {};
let infusedRate = 0;

/**
 * A circle's id is the skill name plus a one-digit number ("Strength1"); this drops the number.
 */
function getSkillName(skill)
{
    return skill.slice(0, skill.length - 1);
}

// HTML image-map coordinates are fixed pixels for the original 1920px-wide picture.
// This keeps the clickable circles lined up when the picture is shown at another size,
// by rescaling every <area>'s coords whenever the window resizes.
class ResponsiveImageMap {
    constructor(map, img, width) {
        this.img = img;
        this.originalWidth = width;
        this.areas = [];

        for (const area of map.getElementsByTagName('area')) {
            this.areas.push({
                element: area,
                originalCoords: area.coords.split(',')
            });
        }

        window.addEventListener('resize', e => this.resize(e));
        this.resize();
        summonDarkness(map, img)
    }

    resize() 
    {
        const ratio = this.img.offsetWidth / this.originalWidth;

        for (const area of this.areas) 
        {
            const newCoords = [];

            for (const originalCoord of area.originalCoords) 
            {
                newCoords.push(Math.round(originalCoord * ratio));
            }

            area.element.coords = newCoords.join(',');
        }

        return true;
    };
}



// Once logged in, listen to this player's unlocked skills and recalculate every bonus
// from scratch each time they change. A brand-new player starts with "start1" unlocked.
onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        alert("You need to login before using this resource. Click Ok and be redirected");
        window.location.href = "loginPage.html?skillTree.html"; 
    } 

    else
    {
        player = auth.currentUser.email.split("@");
        player = toTitleCase(player[0]);
        
        let skillRef = ref(database, `playerChar/${player}/skillTree`);
        onValue(skillRef, (snapshot) => 
        {
            const data = snapshot.val();
            wholeSkills = data;
            skills = {"Strength" : 0, "Dexterity" : 0, "Constitution" : 0, "Intelligence" : 0, "Wisdom" : 0, "Charisma" : 0};

            if(data == null)
            {
                setDoc(`playerChar/${player}/skillTree/start1`, "active");
            }

            else
            {
                for(let key of Object.keys(wholeSkills))
                {
                    let skill = getSkillName(key);
                    document.getElementById(key).style.opacity = "0";
                    
                    if(Object.keys(skills).includes(`${skill}`))
                    {
                        changeSkill(1, skill);
                    }

                    else
                    {
                        switch(skill)
                        {
                            case "all":
                                for(let skill of Object.keys(skills))
                                {
                                    changeSkill(1, skill);
                                }
                                break;

                            case "start":
                                break;

                            case "empty":
                                infused[skill] = "This needs unlocked before you can progress further.";
                                break;

                            default:
                                infused[skillDesc[player][key]["name"]] = skillDesc[player][key]["desc"];
                                infusedRate += skillDesc[player][key]["infusionRate"];
                                if(skillDesc[player][key]["name"] == "Longer Ferret Mode"){changeSkill(1, "Dexterity");}
                                break;
                        }
                    }
                }
                setDoc(`playerChar/${player}/stats/InfusedRate`, `${infusedRate}`);
            }

            updateDisplay();
        });
    }
});

/**
 * Sets up the clickable image map, the popup's Cancel/Unlock buttons, and loads the
 * special-skill descriptions from skillTree.json. parent.skillsLoaded tells the dashboard
 * this tab finished loading so it can hide the tab again.
 */
function init()
{
    let map = document.getElementById('tree');
    let image = document.getElementById('skillImg');
    new ResponsiveImageMap(map, image, 1920);
    document.getElementById("hideCovers").onclick = function(){handleButtonClick(this);};
    document.getElementById("unlock").onclick = function(){handleButtonClick(this);};
    fetch('https://infused.axol-apps.com/src/skillTree.json').then(res => res.json()).then((json) => skillDesc = json);
    parent.skillsLoaded = true;
}

/**
 * Puts a dark round cover (images/hide.png) over every circle on the tree, positioned
 * from each <area>'s x,y,radius. The covers are what the player actually clicks.
 */
function summonDarkness(map, image)
{
    let tokens = map.children;
    let x;
    let y;
    let radius;
    let offSet = 0;

    for(let token of tokens)
    {
        let cords = token.coords.split(",");
        for(let i = 0; i < 3; i++){cords[i] = parseInt(cords[i]);}
        x = cords[0] + image.offsetLeft; y = cords[1] + image.offsetTop; radius = cords[2];

        var newImage = document.createElement("img");
        newImage.src = 'images/hide.png';
        newImage.style.width = (radius*2) + "px";
        newImage.style.height = (radius*2) + "px";
        newImage.style.left = (x - radius) + "px";
        newImage.style.top = (y - radius) + "px";
        newImage.style.border = "none";
        newImage.style.margin = "0px";
        newImage.style.position = "absolute";
        newImage.id = token.title;
        document.getElementById("map").appendChild(newImage);
        newImage.onclick = handleClick;
        offSet += .55;
    }
}

/**
 * A cover was clicked. If that skill is already unlocked (cover see-through), clicking
 * it un-learns the skill. Otherwise it opens the popup describing the skill.
 */
function handleClick()
{
    if(this.style.opacity == "0")
    {
        deleteDoc(`playerChar/${player}/skillTree/${this.id}`, "active");
        reload(1);
    }

    else
    {
        handleButtonClick(this.id);
    }
}

/**
 * Adds `modifier` to the running bonus total for one ability score.
 */
function changeSkill(modifier, skill)
{
    skills[skill] = skills[skill] + modifier;
}

/**
 * Writes the summary under the tree: the ability-score bonuses, then any special
 * infusion abilities with the total infusion %.
 */
function updateDisplay()
{
    let skillDisplay = document.getElementById("skillDisplay");
    let abilityDisplay = document.getElementById("beast");
    let stat = "";
    let abilities = "";

    for(let key of Object.keys(skills))
    {
        stat += `<li>${key}: +${skills[key]}</li>`;
    }

    skillDisplay.innerHTML = `<p>Plus to Stats:</p> <p><ul>${stat}</ul></p>`;   

    if(Object.keys(infused).length > 0)
    {
        for(let key of Object.keys(infused))
        {
            abilities += `<li>${key}: ${infused[key]}</li>`;
        }
    
        abilityDisplay.innerHTML = `<p>Abilities<ul>${abilities}</ul></p><h3>${abilityDisplay.title} ${infusedRate}%</h3>`;
    }
}

/**
 * Runs the popup (#cover). Depending on what was clicked:
 *   helpBtn    -> explains how the tree works
 *   hideCovers -> Cancel: closes the popup
 *   unlock     -> saves the skill as "active" and reloads
 *   a circle   -> shows that skill's name and what it gives, ready to Unlock
 */
function handleButtonClick(elm)
{
    let viewDiv = document.getElementById("cover");
    viewDiv.classList = "";
    viewDiv.style.zIndex = "1011";
    let viewTitle = document.getElementById("viewTitles");
    let showInstructions = document.getElementById("showInstruction");

    switch(elm.id)
    {
        case "helpBtn":
            viewTitle.innerHTML = "Tech Tree";
            showInstructions.innerHTML = "This is your tech tree, each level up after level one gives you one point to spend on the tree. Once unlocked it can't be undone in game, by clicking on one of the circles it will tell you what it unlocks. If you change your mind about unlocking it, click cancel. If you want to unlock it, click unlock. All your current changes will display underneath the chart.";
            break;
        
        case "hideCovers":
            viewDiv.classList = "invisible";
            break;
        
        case "unlock":
            setDoc(`playerChar/${player}/skillTree/${elm.title}`, "active");
            viewDiv.classList = "invisible";
            reload(1);
            break;
        
        default:
            document.getElementById("unlock").title = elm;
            document.getElementById("unlock").classList.remove("invisible");
            let skill = getSkillName(toTitleCase(elm));
            
            if(Object.keys(skills).includes(`${skill}`))
            {
                viewTitle.innerHTML = skill;
                showInstructions.innerHTML = `+1 to ${skill} ability score.`;
            }

            else
            {
                switch(skill)
                {
                    case "All":
                        viewTitle.innerHTML = skill;
                        showInstructions.innerHTML = `+1 to all 6 ability scores.`;
                        break;

                    case "Start":
                        viewTitle.innerHTML = "Starting";
                        showInstructions.innerHTML = `This is unlocked for Level 1.`;
                        break;

                    case "Empty":
                        viewTitle.innerHTML = "Empty";
                        showInstructions.innerHTML = `This needs unlocked before you can progress further.`;
                        break;

                    default:
                        viewTitle.innerHTML = skillDesc[player][elm]["name"];
                        showInstructions.innerHTML = skillDesc[player][elm]["desc"];
                        break;
                }
            }
            break;
    }
}

init();