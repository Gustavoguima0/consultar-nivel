const express = require("express");
const path = require("path");
const { coletarTodas } = require("./coletor/coletor.js");

const app = express();
const PORTA = 3000;

let cache = null;
let cacheHora = 0;

app.get("/api/impressoras", async function (req, res) {
    const agora = Date.now();
    if (!cache || agora - cacheHora > 60000) {
        cache = await coletarTodas();
        cacheHora = agora;
    }
    res.json(cache);
});

app.use(express.static(path.join(__dirname, "painel")));

app.listen(PORTA, function () {
    console.log("Painel rodando em http://localhost:" + PORTA);
});