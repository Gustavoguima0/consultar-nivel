const snmp = require("net-snmp");

const ip = process.argv[2];
const community = process.argv[3] || "public";

if (!ip) {
    console.error("Uso: node ferramentas/buscar-hp.js <ip> [community]");
    process.exit(1);
}

const session = snmp.createSession(ip, community, { version: snmp.Version2c });

const base = "1.3.6.1.4.1.11";
let total = 0;

function pareceInteressante(vb) {
    const valor = vb.value;
    if (typeof valor === "number") {
        return valor >= 2 && valor <= 100;
    }
    if (Buffer.isBuffer(valor)) {
        const texto = valor.toString().toLowerCase();
        return texto.includes("toner") || texto.includes("cf289")
            || texto.includes("cartucho") || texto.includes("cartridge");
    }
    return false;
}

session.subtree(base, 30, function (varbinds) {
    for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        total++;
        if (pareceInteressante(vb)) {
            console.log(vb.oid + " = " + vb.value.toString());
        }
    }
}, function (error) {
    if (error) {
        console.error("Erro:", error.toString());
    }
    console.log("\n(" + total + " OIDs percorridos no total)");
    session.close();
});