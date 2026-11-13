/**
 * itemDisplay.js — the Item Lookup tab (itemIndex.html, shown in an iframe).
 *
 * Looks up an item by its exact name in the shared images data (files/items in Firebase,
 * loaded by parent.js as window.imgs) and shows its description and picture.
 */

"use strict";
import { reload } from '../js/viMethods.js';

/**
 * Hooks up the Search and Reset buttons.
 */
function init()
{ 
    document.getElementById("searchItem").onclick = handleSearch;
    document.getElementById("resetItem").onclick = handleReset;
}

/**
 * Finds the typed item name in window.top.parent.imgs.items, shows its description
 * and image, and scrolls down to them.
 */
function handleSearch()
{
    let txtBox = document.getElementById("searchTxt");
    let display = document.getElementById("description");
    let image = document.getElementById("itemImg");

    display.innerHTML = window.top.parent.imgs["items"][txtBox.value]["desc"]; //Changes display to show the item's descriptions
    image.classList = ""; //Makes the image visible
    image.src = window.top.parent.imgs["items"][txtBox.value]["img"]; //Adds the image of the item
    document.getElementById("display").scrollIntoView({behavior: 'smooth'}); //Moves the view to the item's description
}

/**
 * Clears the lookup by reloading the page.
 */
function handleReset()
{
    reload(.1)
}

init();