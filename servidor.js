const express = require("express");
const path = require("path");
const { coletarTodas } = require("./coletor/coletor.js");
const { salvarColeta, historico, registrarTroca, listarEstoque, definirEstoque } = require("./banco/banco.js");

const app = express();
app.use(express.json());
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

app.post("/api/trocas", function (req, res) {
    const dados = req.body || {};
    if (!dados.impressora_id) {
        res.status(400).json({ erro: "impressora_id obrigatório" });
        return;
    }
    try {
        registrarTroca({
            impressora_id: dados.impressora_id,
            toner: dados.toner,
            data: dados.data,
        });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

app.get("/api/estoque", function (req, res) {
    res.json(listarEstoque());
});

app.post("/api/estoque", function (req, res) {
    const d = req.body || {};
    if (!d.modelo) {
        res.status(400).json({ erro: "modelo obrigatório" });
        return;
    }
    try {
        definirEstoque(d.modelo, d.quantidade, d.minimo);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

app.use(express.static(path.join(__dirname, "painel")));

app.listen(PORTA, function () {
    console.log("Painel rodando em http://localhost:" + PORTA);
    coletarEGravar().catch((e) => console.error(e.message));
    setInterval(function () {
        coletarEGravar().catch((e) => console.error(e.message));
    }, INTERVALO_MS);
});