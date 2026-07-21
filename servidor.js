const express = require("express");
const path = require("path");
const { coletarTodas } = require("./coletor/coletor.js");
const { salvarColeta, historico } = require("./banco/banco.js");

const app = express();
const PORTA = 3000;
const INTERVALO_MS = 60 * 60 * 1000;
let cache = null;
let cacheHora = 0;

async function coletarEGravar() {
    const resultados = await coletarTodas();
    cache = resultados;
    cacheHora = Date.now();
    try {
        salvarColeta(resultados);
    } catch (e) {
        console.error("Erro ao gravar no banco:", e.message);
    }
    return resultados;
}

app.get("/api/impressoras", async function (req, res) {
    if (!cache || Date.now() - cacheHora > INTERVALO_MS) {
        await coletarEGravar();
    }
    res.json(cache);
});

app.get("/api/historico", function (req, res) {
    res.json(historico(200));
});

app.use(express.static(path.join(__dirname, "painel")));

app.listen(PORTA, function () {
    console.log("Painel rodando em http://localhost:" + PORTA);
    coletarEGravar().catch((e) => console.error(e.message));
    setInterval(function () {
        coletarEGravar().catch((e) => console.error(e.message));
    }, INTERVALO_MS);
});