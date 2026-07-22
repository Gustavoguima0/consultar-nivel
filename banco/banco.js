const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "dados.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS coletas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  impressora_id TEXT NOT NULL,
  nome TEXT,
  sala TEXT,
  ip TEXT,
  conectada INTEGER,
  severidade TEXT,
  momento TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS toners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coleta_id INTEGER NOT NULL,
  descricao TEXT,
  percentual INTEGER,
  sem_leitura INTEGER,
  alerta TEXT
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  impressora_id TEXT NOT NULL,
  nome TEXT,
  sala TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT,
  momento TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trocas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  impressora_id TEXT NOT NULL,
  toner TEXT,
  data TEXT NOT NULL,
  momento TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coletas_imp ON coletas (impressora_id, momento);
CREATE INDEX IF NOT EXISTS idx_eventos_mom ON eventos (momento);
CREATE INDEX IF NOT EXISTS idx_trocas_imp ON trocas (impressora_id, data);
`);

function severidadeDe(imp) {
    if (!imp.conectada) return "offline";
    const sup = imp.suprimentos || [];
    if (sup.some((s) => s.alerta === "critico" || s.alerta === "quase-cheia")) return "critical";
    if (sup.some((s) => s.alerta === "atencao" || s.alerta === "baixo")) return "warning";
    if (sup.some((s) => s.tipo === "toner" && s.percentual === null)) return "unknown";
    return "ok";
}

function motivoDe(imp, severidade) {
    if (severidade === "offline") return "Ficou offline — sem resposta de rede";
    const sup = imp.suprimentos || [];
    const toner = sup.find((s) => s.tipo === "toner");
    const cx = sup.find((s) => s.tipo === "residuos");
    if (cx && cx.alerta === "quase-cheia") return "Caixa de resíduo quase cheia";
    if (toner) {
        if (toner.alerta === "critico") return "Toner crítico — trocar";
        if (toner.alerta === "atencao") return "Toner em atenção";
        if (toner.alerta === "baixo") return "Toner baixo";
        if (severidade === "unknown") return "Toner sem leitura de nível";
        if (toner.percentual !== null) return "Toner em " + toner.percentual + "%";
    }
    return "Operando normalmente";
}

const TIPO_POR_SEVERIDADE = {
    offline: "offline",
    critical: "critico",
    warning: "atencao",
    unknown: "sem-leitura",
    ok: "normalizou",
};

const inserirColeta = db.prepare(
    `INSERT INTO coletas (impressora_id, nome, sala, ip, conectada, severidade, momento)
     VALUES (@impressora_id, @nome, @sala, @ip, @conectada, @severidade, @momento)`
);
const inserirToner = db.prepare(
    `INSERT INTO toners (coleta_id, descricao, percentual, sem_leitura, alerta)
     VALUES (@coleta_id, @descricao, @percentual, @sem_leitura, @alerta)`
);
const inserirEvento = db.prepare(
    `INSERT INTO eventos (impressora_id, nome, sala, tipo, descricao, severidade, momento)
     VALUES (@impressora_id, @nome, @sala, @tipo, @descricao, @severidade, @momento)`
);
const ultimaSeveridade = db.prepare(
    `SELECT severidade FROM coletas WHERE impressora_id = ? ORDER BY id DESC LIMIT 1`
);

const salvarColeta = db.transaction(function (resultados) {
    const momento = new Date().toISOString();
    for (const imp of resultados) {
        const sev = severidadeDe(imp);
        const anterior = ultimaSeveridade.get(imp.id);

        const info = inserirColeta.run({
            impressora_id: imp.id,
            nome: imp.nome || null,
            sala: imp.sala || null,
            ip: imp.ip || null,
            conectada: imp.conectada ? 1 : 0,
            severidade: sev,
            momento: momento,
        });

        const suprimentos = imp.suprimentos || [];
        for (const s of suprimentos) {
            if (s.tipo !== "toner") continue;
            inserirToner.run({
                coleta_id: info.lastInsertRowid,
                descricao: s.descricao || null,
                percentual: s.percentual,
                sem_leitura: s.percentual === null ? 1 : 0,
                alerta: s.alerta || null,
            });
        }

        if (anterior && anterior.severidade !== sev) {
            inserirEvento.run({
                impressora_id: imp.id,
                nome: imp.nome || null,
                sala: imp.sala || null,
                tipo: TIPO_POR_SEVERIDADE[sev] || "mudanca",
                descricao: motivoDe(imp, sev),
                severidade: sev === "offline" ? "critical" : sev,
                momento: momento,
            });
        }
    }
});

const lerEventos = db.prepare(
    `SELECT impressora_id, nome, sala, tipo, descricao, severidade, momento
     FROM eventos ORDER BY id DESC LIMIT ?`
);
function historico(limite) {
    const linhas = lerEventos.all(limite || 200);
    return linhas.map(function (e) {
        return {
            printerId: e.impressora_id,
            printerName: e.nome,
            sector: e.sala,
            when: e.momento,
            type: e.tipo,
            desc: e.descricao,
            severity: e.severidade,
        };
    });
}

const inserirTroca = db.prepare(
    `INSERT INTO trocas (impressora_id, toner, data, momento)
     VALUES (@impressora_id, @toner, @data, @momento)`
);
const dadosImpressora = db.prepare(
    `SELECT nome, sala FROM coletas WHERE impressora_id = ? ORDER BY id DESC LIMIT 1`
);
const lerTrocas = db.prepare(
    `SELECT impressora_id, toner, data, momento FROM trocas
     WHERE impressora_id = ? ORDER BY data DESC, id DESC`
);

// registra uma troca de toner: grava na tabela "trocas" e cria um evento
// no historico. a data (yyyy-mm-dd) e escolhida pelo usuario.
const registrarTroca = db.transaction(function (dados) {
    const momento = new Date().toISOString();
    const data = dados.data || momento.slice(0, 10);
    const info = dadosImpressora.get(dados.impressora_id) || {};

    inserirTroca.run({
        impressora_id: dados.impressora_id,
        toner: dados.toner || null,
        data: data,
        momento: momento,
    });

    inserirEvento.run({
        impressora_id: dados.impressora_id,
        nome: info.nome || null,
        sala: info.sala || null,
        tipo: "troca",
        descricao: "Troca de toner" + (dados.toner ? " (" + dados.toner + ")" : ""),
        severidade: "ok",
        momento: data + "T12:00:00.000Z",
    });
    return { ok: true };
});

function trocasDe(impressoraId) {
    return lerTrocas.all(impressoraId);
}

module.exports = { salvarColeta, historico, severidadeDe, registrarTroca, trocasDe };