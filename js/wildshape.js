"use strict";

function init()
{
    let img = document.getElementById("stat");
    let url = window.location.href.split("?");
    url = url[1];

    img.src = `images/${url}.jpg`;
}

init();