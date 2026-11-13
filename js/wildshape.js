/**
 * wildshape.js — wildshape.html shows one creature's stat-block image.
 *
 * The creature comes from the page address: wildshape.html?wolf shows images/wolf.jpg.
 */

"use strict";

/**
 * Reads the creature name after "?" in the address and shows images/<name>.jpg.
 */
function init()
{
    let img = document.getElementById("stat");
    let url = window.location.href.split("?");
    url = url[1];

    img.src = `images/${url}.jpg`;
}

init();