const snmp = require("net-snmp");
const impressoras = require("./impressoras.json");

const community = "public";

const OIDS_GERAIS = {
    modelo: "1.3.6.1.2.1.43.5.1.1.16.1",
    serial: "1.3.6.1.2.1.43.5.1.1.17.1",
    visor: "1.3.6.1.2.1.43.16.5.1.2.1.1"
};

const TABELA_SUPRIMENTOS = "1.3.6.1.2.1.43.11.1.1";
const TABELA_BANDEJAS = "1.3.6.1.2.1.43.8.2.1";

const COL_SUP = { classe: "4", tipo: "5", descricao: "6", max: "8", nivel: "9" };
const COL_BAND = { max: "9", nivel: "10", nome: "13", descricao: "18" };
const TABELA_STATUS_IMPRESSORA = "1.3.6.1.2.1.25.3.5.1";

const TIPOS_SUPRIMENTO = {
    3: "toner",
    21: "toner",
    4: "residuos"
};

function limparTexto(texto) {
    return texto.replaceAll("\u0000", "").replaceAll("\n", " ").trim();
}

function traduzirNivel(nivel, max) {
    if (nivel === null || max === null) {
        return { estado: "desconhecido", percentual: null };
    }
    if (nivel === -2) {
        return { estado: "desconhecido", percentual: null };
    } else if (nivel === -3) {
        return { estado: "ok", percentual: null };
    } else if (nivel === 0) {
        return { estado: "vazia", percentual: 0 };
    } else if (max <= 0) {
        return { estado: "desconhecido", percentual: null };
    } else {
        return { estado: "percentual", percentual: Math.round((nivel / max) * 100) };
    }
}

function calcularAlerta(classe, nivel) {
    if (classe === 4) {
        if (nivel.percentual !== null && nivel.percentual >= 90) return "quase-cheia";
        return null;
    }
    if (nivel.estado === "vazia") return "critico";
    if (nivel.percentual === null) return null;
    if (nivel.percentual <= 10) return "critico";
    if (nivel.percentual <= 25) return "baixo";
    return null;
}

function traduzirAvisos(valor) {
    if (!valor || !Buffer.isBuffer(valor) || valor.length === 0) return [];
    const avisos = [];
    const b0 = valor[0];
    if (b0 & 0x80) avisos.push("papel-baixo");
    if (b0 & 0x40) avisos.push("sem-papel");
    if (b0 & 0x20) avisos.push("toner-baixo");
    if (b0 & 0x10) avisos.push("sem-toner");
    if (b0 & 0x08) avisos.push("porta-aberta");
    if (b0 & 0x04) avisos.push("papel-atolado");
    if (b0 & 0x02) avisos.push("offline");
    if (b0 & 0x01) avisos.push("manutencao");
    if (valor.length > 1) {
        const b1 = valor[1];
        if (b1 & 0x20) avisos.push("suprimento-ausente");
        if (b1 & 0x04) avisos.push("bandeja-vazia");
    }
    return avisos;
}

function lerTexto(linha, coluna) {
    if (linha[coluna] === undefined) return null;
    return limparTexto(linha[coluna].toString());
}

function lerNumero(linha, coluna) {
    if (linha[coluna] === undefined) return null;
    const numero = Number(linha[coluna].toString());
    return Number.isNaN(numero) ? null : numero;
}

function snmpGet(session, oids) {
    return new Promise(function (resolve, reject) {
        session.get(oids, function (error, varbinds) {
            if (error) reject(error);
            else resolve(varbinds);
        });
    });
}

function snmpTabela(session, oidBase) {
    return new Promise(function (resolve, reject) {
        const linhas = {};
        session.subtree(oidBase, function (varbinds) {
            for (const vb of varbinds) {
                if (snmp.isVarbindError(vb)) continue;
                const resto = vb.oid.substring(oidBase.length + 1);
                const primeiroPonto = resto.indexOf(".");
                const coluna = resto.substring(0, primeiroPonto);
                const indice = resto.substring(primeiroPonto + 1);
                if (!linhas[indice]) linhas[indice] = {};
                linhas[indice][coluna] = vb.value;
            }
        }, function (error) {
            if (error) reject(error);
            else resolve(linhas);
        });
    });
}

async function coletar(impressora) {
    const session = snmp.createSession(impressora.ip, community, { version: snmp.Version2c });
    try {
        const varbinds = await snmpGet(session, Object.values(OIDS_GERAIS));
        const chaves = Object.keys(OIDS_GERAIS);
        const gerais = {};
        for (let i = 0; i < varbinds.length; i++) {
            if (snmp.isVarbindError(varbinds[i])) {
                gerais[chaves[i]] = null;
            } else {
                gerais[chaves[i]] = limparTexto(varbinds[i].value.toString());
            }
        }

        const tabelaSuprimentos = await snmpTabela(session, TABELA_SUPRIMENTOS);
        const tabelaBandejas = await snmpTabela(session, TABELA_BANDEJAS);
        const tabelaStatus = await snmpTabela(session, TABELA_STATUS_IMPRESSORA);
        const linhaStatus = Object.values(tabelaStatus)[0];
        const avisos = linhaStatus ? traduzirAvisos(linhaStatus["2"]) : [];

        const suprimentos = Object.values(tabelaSuprimentos).map(function (linha) {
            const classe = lerNumero(linha, COL_SUP.classe);
            const tipoCodigo = lerNumero(linha, COL_SUP.tipo);
            const nivel = traduzirNivel(lerNumero(linha, COL_SUP.nivel), lerNumero(linha, COL_SUP.max));
            return {
                descricao: lerTexto(linha, COL_SUP.descricao),
                tipo: TIPOS_SUPRIMENTO[tipoCodigo] || "outro",
                ...nivel,
                alerta: calcularAlerta(classe, nivel)
            };
        });

      
        for (const sup of suprimentos) {
            if (sup.tipo === "toner" && sup.alerta === null) {
                if (avisos.includes("sem-toner")) sup.alerta = "critico";
                else if (avisos.includes("toner-baixo")) sup.alerta = "baixo";
            }
        }

        const bandejas = Object.values(tabelaBandejas).map(function (linha) {
            const nivel = traduzirNivel(lerNumero(linha, COL_BAND.nivel), lerNumero(linha, COL_BAND.max));
            return {
                nome: lerTexto(linha, COL_BAND.nome) || lerTexto(linha, COL_BAND.descricao),
                ...nivel
            };
        });

        return {
            id: impressora.id,
            nome: impressora.nome,
            sala: impressora.sala,
            ip: impressora.ip,
            modelo: gerais.modelo,
            serial: gerais.serial,
            conectada: true,
            ultimaLeitura: new Date().toISOString(),
            suprimentos: suprimentos,
            bandejas: bandejas,
            avisos: avisos,
            mensagemVisor: gerais.visor
        };
    } catch (error) {
        console.error("[" + impressora.id + "] " + error.toString());
        return {
            id: impressora.id,
            nome: impressora.nome,
            sala: impressora.sala,
            ip: impressora.ip,
            conectada: false,
            ultimaLeitura: new Date().toISOString()
        };
    } finally {
        session.close();
    }
}

async function principal() {
    const resultados = await Promise.all(impressoras.map(coletar));
    console.log(JSON.stringify(resultados, null, 2));
}

principal();