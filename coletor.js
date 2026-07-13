const snmp = require("net-snmp");
const impressoras = require("./impressoras.json");

const community = "public";

const OIDS = {
    modelo: "1.3.6.1.2.1.43.5.1.1.16.1",
    serial: "1.3.6.1.2.1.43.5.1.1.17.1",
    tonerDescricao: "1.3.6.1.2.1.43.11.1.1.6.1.1",
    tonerMax: "1.3.6.1.2.1.43.11.1.1.8.1.1",
    tonerNivel: "1.3.6.1.2.1.43.11.1.1.9.1.1",
    bandeja2Nome: "1.3.6.1.2.1.43.8.2.1.13.1.2",
    bandeja2Max: "1.3.6.1.2.1.43.8.2.1.9.1.2",
    bandeja2Nivel: "1.3.6.1.2.1.43.8.2.1.10.1.2",
    visor: "1.3.6.1.2.1.43.16.5.1.2.1.1"
};

function traduzirNivel(nivel, max) {
    if (nivel === -2) {
        return { estado: "desconhecido", percentual: null };
    } else if (nivel === -3) {
        return { estado: "ok", percentual: null };
    } else if (nivel === 0) {
        return { estado: "vazia", percentual: 0 };
    } else {
        return { estado: "percentual", percentual: Math.round((nivel / max) * 100) };
    }
}

function limparTexto(texto) {
    return texto.replaceAll("\u0000", "").replaceAll("\n", " ");
}

function coletar(impressora) {
    const session = snmp.createSession(impressora.ip, community, { version: snmp.Version2c });
    const listaOids = Object.values(OIDS);

    session.get(listaOids, function (error, varbinds) {
        if (error) {
            console.error("[" + impressora.id + "] " + error.toString());
            console.log(JSON.stringify({
                id: impressora.id,
                sala: impressora.sala,
                conectada: false,
                ultimaLeitura: new Date().toISOString()
            }, null, 2));
        } else {
            const chaves = Object.keys(OIDS);
            const dados = {};
            for (let i = 0; i < varbinds.length; i++) {
                if (snmp.isVarbindError(varbinds[i])) {
                    dados[chaves[i]] = null;  
                } else {
                    dados[chaves[i]] = limparTexto(varbinds[i].value.toString());
                }
            }
            const toner = traduzirNivel(Number(dados.tonerNivel), Number(dados.tonerMax));
            const bandeja = traduzirNivel(Number(dados.bandeja2Nivel), Number(dados.bandeja2Max));

            console.log(JSON.stringify({
                id: impressora.id,
                nome: impressora.nome,
                sala: impressora.sala,
                ip: impressora.ip,
                modelo: dados.modelo,
                serial: dados.serial,
                conectada: true,
                ultimaLeitura: new Date().toISOString(),
                suprimentos: [
                    { descricao: dados.tonerDescricao, tipo: "toner", ...toner, alerta: null }
                ],
                bandejas: [
                    { nome: dados.bandeja2Nome, ...bandeja }
                ],
                mensagemVisor: dados.visor
            }, null, 2));
        }
        session.close();
    });
}

for (const imp of impressoras) {
    coletar(imp);
}