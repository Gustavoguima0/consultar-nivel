const snmp = require("net-snmp");

const ip = process.argv[2];
const community = process.argv[3] || "public";

if (!ip) {
    console.error("Uso: node ferramentas/diagnostico.js <ip> [community]");
    process.exit(1);
}

const session = snmp.createSession(ip, community, { version: snmp.Version2c });

function listar(titulo, oidBase, aoTerminar) {
    console.log("\n=== " + titulo + " (" + oidBase + ") ===");
    session.subtree(oidBase, function (varbinds) {
        for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) {
                console.log(vb.oid + " = " + vb.value.toString());
            }
        }
    }, function (error) {
        if (error) {
            console.error("Erro:", error.toString());
        }
        aoTerminar();
    });
}

listar("SUPRIMENTOS", "1.3.6.1.2.1.43.11.1.1", function () {
    listar("BANDEJAS", "1.3.6.1.2.1.43.8.2.1", function () {
        session.close();
    });
});