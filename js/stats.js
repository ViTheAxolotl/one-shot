"use strict";
import { toTitleCase, setDoc, statFormat, skillDecrypt, reload, deleteDoc, sendDiscordMessage } from './viMethods.js';

let stats;
let firstRun = true;
let parent = window.top.parent;

init();

function init()
{
    let display = document.getElementById("story");
    let stats = document.getElementsByClassName("stat");
    let viewButtons = document.getElementsByClassName("viewSpell");
    let exitBtn = document.getElementById("exitIframe");
    exitBtn.onclick = handleExit;

    for(let stat of stats)
    {
        if(parent.wholeChar[parent.player] == undefined)
        {
            location.reload();
        }

        else if(parent.wholeChar[parent.player]["stats"][stat.id] || parent.wholeChar[parent.player]["stats"][stat.id] == "")
        {
            if(!parent.wholeChar[parent.player]["stats"][stat.id]){setDoc(`playerChar/${parent.player}/stats/${stat.id}`, "");}
            if(typeof parent.wholeChar[parent.player]["stats"][stat.id] == "string")
            {
                if(stat.id == "spellBonus"){let bonus = statFormat(parseInt(parent.wholeChar[parent.player]["stats"][parent.wholeChar[parent.player]["stats"]["spellAbility"]]) + parseInt(parent.wholeChar[parent.player]["stats"]["proficiency"])); stat.innerHTML = bonus; setDoc(`playerChar/${parent.player}/stats/spellBonus`, bonus);}
                else if(stat.id == "spellDC"){let dc = statFormat(parseInt(parent.wholeChar[parent.player]["stats"][parent.wholeChar[parent.player]["stats"]["spellAbility"]]) + parseInt(parent.wholeChar[parent.player]["stats"]["proficiency"]) + 8); stat.innerHTML = dc; setDoc(`playerChar/${parent.player}/stats/spellDC`, dc);}
                else if(stat.id == "proficiency"){let prof = statFormat(Math.ceil(parseInt(parent.wholeChar[parent.player]["stats"]["lv"])/4)+1); setDoc(`playerChar/${parent.player}/stats/proficiency`, prof); stat.innerHTML = prof;}
                else if(stat.id == "name"){stat.innerHTML = parent.player;}
                else if(stat.id == "totalHitDice"){for(let i = 0; i < stat.length; i++){stat[i].innerHTML = `${parent.wholeChar[parent.player]["stats"]["lv"]}${stat[i].value}`; stat.value = parent.wholeChar[parent.player]["stats"][stat.id];}}
                else if(stat.id == "currentHitDice"){let max = parent.wholeChar[parent.player]["stats"]["totalHitDice"]; stat.innerHTML = ""; for(let i = parseInt(parent.wholeChar[parent.player]["stats"]["lv"]); i >= 0; i--){let option = document.createElement("option"); option.innerHTML = `${i}${max}`; option.value = `${i}`; stat.appendChild(option);} stat.value = parent.wholeChar[parent.player]["stats"][stat.id];}
                else if(stat.id.includes("-btn") && !stat.id.includes("lvl")){stat.checked = false; setStats(stat);} //Stats not clicked
                else if(stat.id.includes("Save")){stat.checked = false; setStats(stat);} //Stats not clicked
                else if(["spellAbility", "lv"].includes(stat.id)){stat.value = parent.wholeChar[parent.player]["stats"][stat.id];}
                else if(stat.value == ""){stat.value = parent.wholeChar[parent.player]["stats"][stat.id]; if(!["profAndLang", "infusion", "feats", "equipment", "apperance", "characterBackstory", "ally1", "ally2", "additionalFeat&Traits", "treasure"].includes(stat.id)){stat.style.minWidth = stat.value.length + 2 + "ch";}}
                else{stat.innerHTML = parent.wholeChar[parent.player]["stats"][stat.id];}
            }

            else //stats clicked since in booleen
            {
                stat.checked = parent.wholeChar[parent.player]["stats"][stat.id];
                setStats(stat);
            }
        }

        else
        {
            if(stat.id.includes("-btn") && !stat.id.includes("lvl")){setDoc(`playerChar/${parent.player}/stats/${stat.id}`, false); }
            else{setDoc(`playerChar/${parent.player}/stats/${stat.id}`, "");}
            setStats(stat);
        }

        if(stat.id.includes("slot")){updateCheckboxes(stat.id.split("level")[1].charAt(0));}

        stat.onchange = updateStat;
    }

    for(let viewButton of viewButtons)
    {
        viewButton.onclick = showSpell;
        if(document.getElementById(viewButton.id.slice(0, viewButton.id.length - 4)).value == "")
        {
            viewButton.classList.add("invisible");
        }
    }

    for(let stat of document.getElementsByClassName("expertise")){stat.onclick = handleExpertise; stat.oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "stat");};}
    
    document.getElementById("Initiative").oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "init");};
    document.getElementById("initLabel").oncontextmenu = function(e) {e.preventDefault(); handleRightClickRoll(e, "init");};

    document.getElementById('add-hd').onclick = addNewHD;
    document.getElementById('remove-hd').onclick = removeRecentHD;
    loadMulticlassHitDice();
}

function createHD(hdStateArray)
{
    let totalBox = document.getElementById("hd-div");
    let currentBox = document.getElementById("hd-current");

    currentBox.innerHTML = "";
    totalBox.innerHTML = "";

    let maxGlobalLevel = parent.wholeChar[parent.player]["stats"]["lv"];
    let standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

    if(!hdStateArray || hdStateArray.length === 0) //If no multiclass
    {
        hdStateArray = [{ totalCount: maxGlobalLevel, dieSize: 'd8', currentCount: maxGlobalLevel }];
    }

    let allocatedLevels = 0;
    hdStateArray.forEach((group) => 
    {
        allocatedLevels += parseInt(group.totalCount) || 0;
    });

    if (allocatedLevels > maxGlobalLevel) 
    {
        let pool = maxGlobalLevel;
        hdStateArray.forEach((group) => 
        {
            group.totalCount = Math.min(group.totalCount, pool);
            pool -= group.totalCount;
            if (group.totalCount < 1 && pool === 0) group.totalCount = 0; // handle trailing entries safely
            group.currentCount = Math.min(group.currentCount, group.totalCount);
        });
    }

    // Pass 2: Draw components onto the page matching layout rules
    let cumulativeUsed = 0;
    hdStateArray.forEach((classGroup, index) => {
        // Skip drawing rendering elements for fully dead tracking slots
        if (index > 0 && classGroup.totalCount === 0 && hdStateArray.length > 1) return;

        // Calculate maximum allowable selection for this row item without breaking overall character max limit
        const otherRowsAllocated = hdStateArray.reduce((acc, g, i) => acc + (i !== index ? g.totalCount : 0), 0);
        const maxRowAllocation = Math.max(1, maxGlobalLevel - otherRowsAllocated);

        // --- Render Total Configurations Column Section ---
        const totalRow = document.createElement('div');
        totalRow.className = 'hd-total-row-item';
        totalRow.style.margin = '4px 0';
        totalRow.dataset.index = index;

        let totalOptions = '';
        for (let i = 1; i <= maxRowAllocation; i++) {
            totalOptions += `<option value="${i}" ${classGroup.totalCount == i ? 'selected' : ''}>${i}</option>`;
        }

        let dieOptions = '';
        standardDice.forEach(die => {
            dieOptions += `<option value="${die}" ${classGroup.dieSize === die ? 'selected' : ''}>${die}</option>`;
        });

        totalRow.innerHTML = `
            <select class="hd-total-select" style="width: 45px; text-align: center;">${totalOptions}</select>
            <select class="hd-die-select" style="width: 55px; margin-left: 2px;">${dieOptions}</select>
        `;
        totalBox.appendChild(totalRow);

        // --- Render Current Remaining Selector Column Section ---
        const currentRow = document.createElement('div');
        currentRow.className = 'hd-current-row-item';
        currentRow.style.margin = '4px 0';
        currentRow.style.display = "inline";
        currentRow.dataset.index = index;

        let currentOptions = '';
        for (let i = classGroup.totalCount; i >= 0; i--) {
            // Displays with custom dynamic text formatting (e.g., "6d8", "0d6") matching your setup design
            currentOptions += `<option value="${i}" ${classGroup.currentCount == i ? 'selected' : ''}>${i}${classGroup.dieSize}</option>`;
        }

        currentRow.innerHTML = `
            <select class="hd-current-select" style="width: 70px; text-align: center;">${currentOptions}</select>
        `;
        currentBox.appendChild(currentRow);

        // --- Bind Listener Logic Rules ---
        const totalSelect = totalRow.querySelector('.hd-total-select');
        const dieSelect = totalRow.querySelector('.hd-die-select');
        const currentSelect = currentRow.querySelector('.hd-current-select');

        // Handle cascading structural changes across rows when levels are modified
        totalSelect.onchange = function() {
            classGroup.totalCount = parseInt(this.value);
            classGroup.currentCount = Math.min(classGroup.currentCount, classGroup.totalCount);
            // Re-evaluate entire stack array to apply updated calculations to neighboring elements
            createHD(serializeHDInterface());
            commitHDStateToDatabase();
        };

        // Re-draw dropdown labels immediately when the selected die format changes
        dieSelect.onchange = function() {
            classGroup.dieSize = this.value;
            createHD(serializeHDInterface());
            commitHDStateToDatabase();
        };

        currentSelect.onchange = function() {
            commitHDStateToDatabase();
        };
    });
}

function addNewHD() 
{
    const dynamicStack = serializeHDInterface();
    const maxAllowedLevel = parent.wholeChar[parent.player]["stats"]["lv"];
    
    let currentAllocatedSum = 0;
    dynamicStack.forEach(g => currentAllocatedSum += g.totalCount);

    // Stop adding rows if the level budget is already fully spent
    if (currentAllocatedSum >= maxAllowedLevel) {
        alert("Cannot add multiclass hit dice: Total combined levels already equal your character level.");
        return;
    }

    dynamicStack.push({ totalCount: 1, dieSize: 'd6', currentCount: 1 });
    createHD(dynamicStack);
    commitHDStateToDatabase();
}

/**
 * Triggers on Minus input click: Drops all modular blocks and fixes primary row back to player's level capacity
 */
function removeRecentHD() 
{
    const baseCap = parent.wholeChar[parent.player]["stats"]["lv"];
    const baselineCollection = [{ totalCount: baseCap, dieSize: 'd6', currentCount: baseCap }];
    createHD(baselineCollection);
    commitHDStateToDatabase();
}

/**
 * Traverses selector rows to serialize current option metrics out of the DOM elements
 */
function serializeHDInterface() 
{
    const totalRowElements = document.querySelectorAll('.hd-total-row-item');
    const currentRowElements = document.querySelectorAll('.hd-current-row-item');
    const stateOutputArray = [];
    
    totalRowElements.forEach((totalRow, idx) => {
        const correspondingCurrentRow = currentRowElements[idx];
        if (correspondingCurrentRow) {
            stateOutputArray.push({
                totalCount: parseInt(totalRow.querySelector('.hd-total-select').value) || 1,
                dieSize: totalRow.querySelector('.hd-die-select').value || 'd8',
                currentCount: parseInt(correspondingCurrentRow.querySelector('.hd-current-select').value) || 0
            });
        }
    });
    
    return stateOutputArray;
}

/**
 * Encapsulates data array back into your Firebase storage schema via setDoc
 */
function commitHDStateToDatabase() 
{
    const valuesPayload = serializeHDInterface();
    // Formulates character reference node paths mirroring your standard setDoc setup
    setDoc(`playerChar/${parent.player}/stats/multiclassHitDice`, valuesPayload);
}

function loadMulticlassHitDice() 
{
    if (parent.wholeChar[parent.player] && parent.wholeChar[parent.player]["stats"]) 
    {
        const cloudRecord = parent.wholeChar[parent.player]["stats"]["multiclassHitDice"];
        createHD(cloudRecord);
    } 
    
    else 
    {
        createHD(null);
    }
}

function updateCheckboxes(level)
{
    let input = document.getElementById(`level${level}-slot`);
    let display = document.getElementById(`level${level}-slot-display`);

    if(!input || !display){return;}

    let count = parseInt(input.value) || 0;
    display.innerHTML = "";

    for(let i = 0; i < count; i++)
    {
        let id = `level${level}-cb-${i}`;
        
        let box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.style.display = "none";
        box.className = "spell-check-hidden";

        if(parent.wholeChar[parent.player]["stats"][id] == true || parent.wholeChar[parent.player]["stats"][id] == false)
        {
            box.checked = parent.wholeChar[parent.player]["stats"][id];
        }

        else
        {
            setDoc(`playerChar/${parent.player}/stats/${id}`, false);
        }

        box.onchange = function(){setDoc(`playerChar/${parent.player}/stats/${id}`, box.checked);};

        let label = document.createElement('label');
        label.setAttribute("for", id);
        label.className = 'spell-slot-label';
        
        display.appendChild(box);
        display.appendChild(label);
    }
}

function setStats(stat)
{
    if(stat.id.includes("-btn") && !stat.id.includes("lvl"))
    {
        let display;
        let skill;
        let modifier;
        let exper;

        if(stat.id.includes("Save-btn"))
        {
            skill = stat.id.slice(0, stat.id.length-8);
            modifier = parent.wholeChar[parent.player]["stats"][skill];
            display = document.getElementById(skill + "Save");
            exper = skill + "Save";
        }

        else
        {
            skill = stat.id.slice(0, stat.id.length-4);
            let base6 = skillDecrypt[skill];
            modifier = parent.wholeChar[parent.player]["stats"][base6];
            display = document.getElementById(skill);
            exper = skill;
        }

        if(stat.checked)
        {
            modifier = parseInt(modifier) + parseInt(parent.wholeChar[parent.player]["stats"]["proficiency"]);

            if(parent.wholeChar[parent.player]["stats"][`${exper}-expertise`]){modifier += parseInt(parent.wholeChar[parent.player]["stats"]["proficiency"]);}
        }
        
        else if(!stat.checked && parent.wholeChar[parent.player]["stats"]["class"].toLowerCase().includes("Bard"))
        {
            modifier = parseInt(modifier) + Math.floor(parseInt(parent.wholeChar[parent.player]["stats"]["proficiency"]) / 2);
        }

        modifier = statFormat(modifier);
        setDoc(`playerChar/${parent.player}/stats/${stat.id.slice(0, stat.id.length-4)}`, modifier);
        display.innerHTML = toTitleCase(skill + ": " + modifier);
        if(parent.wholeChar[parent.player]["stats"][`${exper}-expertise`]){display.innerHTML += " <strong>(Expertise)</strong>"}
    }
}

function handleExpertise()
{
    let stat = this.id;
    let button = document.getElementById(stat + "-btn");

    if(button.checked)
    {
        if(parent.wholeChar[parent.player]["stats"][`${stat}-expertise`])
        {
            deleteDoc(`playerChar/${parent.player}/stats/${stat}-expertise`);
        }

        else
        {
            setDoc(`playerChar/${parent.player}/stats/${stat}-expertise`, true);
        }

        setTimeout(init, 1000);
    }
}

function updateStat()
{
    let setTo = this.value;

    if(setTo == "on")
    {
        setTo = this.checked;
        setStats(this);
    }

    else if(setTo.includes("\n"))
    {
        setTo = setTo.split("\n");

        for(let i = 0; i < setTo.length; i++)
        {
            if(setTo[i][0] != "•" && setTo[0] != " " && setTo[i][0] != " "){setTo[i] = "•   " + setTo[i];} 
            if(setTo[i] == "•   "){setTo[i] = "";}
        }

        setTo = setTo.join("\n");

        this.value = setTo;
    }

    else if(this.classList.contains("base6"))
    {
        let full = this.value;
        let smaller;
        let ref = document.getElementById(this.id.slice(0, this.id.length-4));

        full = parseInt(full);
        smaller = (full - 10) / 2;
        smaller = statFormat(Math.floor(smaller));
        ref.innerHTML = smaller;
        setDoc(`playerChar/${parent.player}/stats/${this.id.slice(0, this.id.length-4)}`, smaller);
        setTimeout(init, 1000);
    }

    else if(["lv", "spellAbility", "totalHitDice"].includes(this.id)){setTimeout(init, 1000);}

    else if(["AC", "currentHp", "maxHp", "tempHp"].includes(this.id))
    {
        setDoc(`playerChar/${parent.player}/token/${this.id}`, setTo);
        setDoc(`currentMap/${parent.player}/${this.id}`, setTo);
        this.style.minWidth = this.value.length + 2 + "ch";
    }

    else
    {
        if(!["profAndLang", "infusion", "feats", "equipment", "apperance", "characterBackstory", "ally1", "ally2", "additionalFeat&Traits", "treasure"].includes(this.id)){this.style.minWidth = this.value.length + 2 + "ch";}
    }

    setDoc(`playerChar/${parent.player}/stats/${this.id}`, setTo);

    if(this.id.includes("lvl") || this.id.includes("can"))
    {
        if(setTo != "")
        {
            document.getElementById(this.id + "-See").classList.remove("invisible");
        }

        else
        {
            document.getElementById(this.id + "-See").classList.add("invisible");
        }
    }

    if(this.id.includes("slot"))
    {
        updateCheckboxes(this.id.split("level")[1].charAt(0));
    }
}

function showSpell()
{
    let spellName = toTitleCase(document.getElementById(this.id.slice(0, this.id.length - 4)).value);
    let link;
    let spellLevel = this.id;

    if(spellLevel.includes("can")){spellLevel = "0";}
    else{spellLevel = spellLevel.slice(3, 4);}

    if(spellName != "")
    {
        if(parent.wholeSpells[spellLevel][spellName])
        {
            let spell = parent.wholeSpells[spellLevel][spellName];
            document.getElementById("spellTitle").innerHTML = spell["name"];
            document.getElementById("CT").innerHTML = `Cast Time: ${spell["castTime"]}`;
            document.getElementById("R").innerHTML = `Range: ${spell["range"]}`;
            document.getElementById("C").innerHTML = `Components: ${spell["components"]}`;
            document.getElementById("D").innerHTML = `Duration: ${spell["duration"]}`;
            if(spell["concentration"] == "true"){document.getElementById("concentration").style.display = "block";}
            else{document.getElementById("concentration").style.display = "none";}
            document.getElementById("spellText").innerHTML = spell["description"];

            document.getElementById("frame").style.display = "none";
            document.getElementById("spellCard").style.display = "flex";
        }

        else
        {
            spellName.replaceAll(" ", "%20");
            link = `https://roll20.net/compendium/dnd5e/${spellName}`;
            document.getElementById("spellLookup").src = link;

            document.getElementById("spellCard").style.display = "none";
            document.getElementById("frame").style.display = "block";
        }
        
        document.getElementById("spellFrame").classList.remove("invisible");
    }
}

function handleExit()
{
    document.getElementById("spellFrame").classList.add("invisible");
}

function handleRightClickRoll(e, type)
{
    let clicked = e.currentTarget.id
    let modifier;
    let mod;

    switch(type)
    {
        case "stat": 
            if(e.currentTarget.innerHTML.includes("+"))
            {
                modifier = e.currentTarget.innerHTML.slice(e.currentTarget.innerHTML.indexOf("+"));
            }
            
            else
            {
                modifier = e.currentTarget.innerHTML.slice(e.currentTarget.innerHTML.indexOf("-"));
            }
            break;

        case "init":
            modifier = document.getElementById("Initiative").value;
            clicked = "Initiative";
            break;
    }

    mod = parseInt(modifier);

    if(clicked == parent.saveOrCheck)
    {
        let token = parent.wholeDB[parent.player];
        parent.handleUseAction([token], "{@respond}");
        return false;
    }

    let random = Math.random();
    let roll = Math.floor(random * (20)) + mod + 1; //Gives random roll
    let message = `${parent.player} had rolled (${roll-mod})${modifier} = **${roll}** for ${toTitleCase(clicked)}.`;

    sendDiscordMessage(message);
    alert(`Rolled (${roll-mod})${modifier} = **${roll}** for ${toTitleCase(clicked)}.`);

    return false;
}