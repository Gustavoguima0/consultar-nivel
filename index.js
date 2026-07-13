const snmp = require("net-snmp");

const ip = "192.168.0.9";
const community = "public";

const oidBase = "1.3.6.1.2.1.43";

const session = snmp.createSession(ip, community);  

function aoReceberDados(varbinds) {
  for (const vb of varbinds) {
    console.log(vb.oid + " = " + vb.value.toString());
  }
}

function aoFinalizar(error) {
  if (error) {
    console.error("Erro no walk:", error.toString());
  } else {
    console.log("Walk concluído.");
  }
  session.close();
}

session.subtree(oidBase, aoReceberDados, aoFinalizar);
