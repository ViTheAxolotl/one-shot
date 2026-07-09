import { ref, onValue } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js'; 
import { auth, database, toTitleCase, setDoc } from './js/viMethods.js';
import { setMode, setWholeDB, setWholeTO, setWholeSummons, setWholeBubbles } from './src/map.js';
import { setWholeInteractive, setWholeCharCont, setWholeQuests } from './js/mapControler.js';

window.wholeCustom = {};
window.wholeBubbles = {};
window.wholeChar = {};
window.wholeDB = {};
window.wholeDisplay = {}; 
window.wholeInteractive = {};
window.wholePre = {};
window.wholeQuests = {};
window.wholeSummons = {};
window.wholeTO = {};
window.imgs = {};
window.wholeActions = {};
window.wholeSpells = {};
window.wholeRolls = {};

onAuthStateChanged(auth, (user) => 
{
    if (!user) 
    {
        alert("You need to login before using this resource. Click Ok and be redirected, -map.html");
        window.location.href = "loginPage.html?map.html"; 
    } 

    else
    {
        window.player = auth.currentUser.email.split("@");
        window.player = toTitleCase(window.player[0]);
        setMode(auth);
    }
});

fetch('https://infused.axol-apps.com/src/actions.json').then(res => res.json()).then((json) => wholeActions = json);
fetch('https://infused.axol-apps.com/src/spells.json').then(res => res.json()).then((json) => wholeSpells = json);
fetch('https://infused.axol-apps.com/src/rolls.json').then(res => res.json()).then((json) => wholeRolls = json);

const filesRef = ref(database, 'files/');
onValue(filesRef, (snapshot) => 
{
    const data = snapshot.val();
    imgs = data;
});

const customsRef = ref(database, 'customImages/');
onValue(customsRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeCustom = data;
});

const currentMapRef = ref(database, 'currentMap/');
onValue(currentMapRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeDB = data;
    setWholeDB(data);
});

const charRef = ref(database, 'playerChar/');
onValue(charRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeChar = data;
    window.wholeRespone = data["Vi"]["responses"];
    window.saveOrCheck = window.wholeRespone["ability"];
    setWholeCharCont(data);
});

const currentTORef = ref(database, 'currentTO/');
onValue(currentTORef, (snapshot) => 
{
    const data = snapshot.val();
    wholeTO = data;
    setWholeTO(data);
});

const summonsRef = ref(database, 'playerChar/Vi/summons');
onValue(summonsRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeSummons = data;
    setWholeSummons(data);
});

const bubbleRef = ref(database, 'bubbles');
onValue(bubbleRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeBubbles = data;
    setWholeBubbles(data);
});

const interactiveRef = ref(database, 'playerChar/Vi/interactive');
onValue(interactiveRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeInteractive = data;
    setWholeInteractive(data);
});

const displayRef = ref(database, 'display/');
onValue(displayRef, (snapshot) => 
{
    const data = snapshot.val();
    wholeDisplay = data;
});

const questRef = ref(database, `playerChar/Vi/quests/`);
onValue(questRef, (snapshot) =>
{
    const data = snapshot.val();
    wholeQuests = data;
    setWholeQuests(data);
});

const presetRef = ref(database, 'preset/');
onValue(presetRef, (snapshot) => 
{
    const data = snapshot.val();
    wholePre = data;
});

const refreshRef = ref(database, `playerChar/Vi/playerRefresh`);
onValue(refreshRef, (snapshot) =>
{
    const data = snapshot.val();
    
    if(window.player == data)
    {
        setDoc(`playerChar/Vi/playerRefresh`, null);
        location.reload(true); 
    }
});