# TonerWatch — Monitor de Impressoras

Sistema para monitorar o nível de toner e os alertas das impressoras do
hospital via **SNMP**, com painel web, histórico, controle de estoque e
registro de trocas.

Feito para rodar **localmente** na própria máquina da TI: a máquina liga, o
sistema sobe sozinho e é acessado pelo navegador em `http://localhost:3000`.

---

## O que ele faz

- 🖨️ Consulta as impressoras da rede via SNMP e mostra tudo num painel web.
- 🎚️ **Nível de toner** com barra e porcentagem (impressoras que reportam, como as Kyocera).
- ❓ **"Sem leitura"** para as impressoras que não informam o nível (as HP), com alerta vindo do próprio aviso da impressora.
- 🚨 **Alertas em 3 níveis:** Baixo (≤25%), Atenção (≤10%) e Crítico (≤5%), além de *offline*.
- 🔔 **Aviso na tela** (som + notificação) quando um toner fica baixo.
- 📈 **Gráfico de queda** do toner ao longo do tempo, com tooltip interativo (passe o mouse e veja o nível e o dia).
- 📜 **Histórico** de eventos por impressora (mudanças de status e trocas).
- 🔄 **Registro de troca** de toner — manual e automático (detecta quando o nível pula de baixo para cheio).
- ⏱️ **Duração média** e **previsão** de troca de cada toner.
- 📦 **Controle de estoque** dos toners, com **baixa automática** a cada troca e aviso quando o estoque zera.

Hoje o sistema monitora **12 impressoras** (10 Kyocera + 2 HP), configuradas
em `config/impressoras.json`.

---

## Como rodar

1. Instalar as dependências (só na primeira vez):

   ```
   npm install
   ```

2. Ligar o sistema:

   ```
   npm start
   ```

   (ou dar 2 cliques em `iniciar.bat`, que reinicia sozinho se cair)

3. Abrir no navegador: **http://localhost:3000**

A cada **10 minutos** o sistema consulta todas as impressoras e atualiza o
painel automaticamente. A tela do navegador também se atualiza sozinha.

---

## Rodar sozinho (iniciar com o Windows)

Há dois arquivos prontos na raiz:

- `iniciar.bat` — liga o servidor numa janela e reinicia sozinho se cair.
- `iniciar-oculto.vbs` — liga o servidor de forma invisível (sem janela).

Para iniciar junto com o Windows: aperte `Windows + R`, digite
`shell:startup`, e coloque nessa pasta um **atalho** para um desses dois
arquivos (o `.vbs` se não quiser janela; o `.bat` se quiser ver rodando).

Para desligar o `.vbs`: Gerenciador de Tarefas → `node.exe` → Finalizar tarefa.

> A máquina precisa ficar ligada (sem hibernar) para coletar de 10 em 10 minutos.

---

## Como adicionar uma impressora

Editar `config/impressoras.json` e adicionar um bloco:

```json
{
  "id": "kyocera-exemplo",
  "nome": "Kyocera - Exemplo",
  "sala": "Setor - Descrição",
  "ip": "192.168.0.100"
}
```

- O `id` precisa ser **único, em minúsculas e sem espaços/acentos** (ele é a chave do histórico no banco de dados).
- Depois de editar o JSON, **reinicie o sistema** para ele carregar a nova impressora.

---

## Estrutura do projeto

```
consultar-nivel/
├── servidor.js              # Servidor web (Express) + agendador da coleta
├── coletor/
│   └── coletor.js           # Coleta via SNMP (nível, avisos, status)
├── banco/
│   └── banco.js             # Banco de dados (SQLite): coletas, eventos, trocas, estoque
├── painel/
│   ├── index.html           # Painel web (TonerWatch)
│   ├── printer-data.js      # Adapta os dados para a tela (alertas, rótulos)
│   ├── support.js           # Motor de template do painel
│   ├── vendor/              # React (local, para funcionar offline)
│   └── _ds/                 # Design system (tema Nocturne)
├── config/
│   └── impressoras.json     # Lista de impressoras (id, nome, sala, ip)
├── ferramentas/
│   ├── diagnosticos.js      # Lê todos os OIDs de um IP (depuração)
│   └── buscar-hp.js         # Ajuda a descobrir os OIDs das HP
├── iniciar.bat              # Liga o sistema (com auto-restart)
├── iniciar-oculto.vbs       # Liga o sistema sem janela
└── package.json
```

O banco de dados fica em `banco/dados.db` (criado automaticamente na
primeira execução; **não** vai para o Git).

---

## Ferramentas de diagnóstico

Para investigar uma impressora que não está lendo direito:

```
node ferramentas/diagnosticos.js 192.168.0.100
```

Lista os OIDs de SNMP daquela impressora, útil para descobrir onde ela
reporta o nível de toner.

---

## Ajustes rápidos

- **Intervalo de coleta:** em `servidor.js`, a constante `INTERVALO_MS`
  (hoje `10 * 60 * 1000`, ou seja, 10 minutos). É a mesma que controla de
  quanto em quanto tempo a barra/porcentagem atualiza.
- **Limites dos alertas:** em `coletor/coletor.js`, na função
  `calcularAlerta` (Crítico ≤5%, Atenção ≤10%, Baixo ≤25%).
- **Porta do painel:** em `servidor.js`, a constante `PORTA` (padrão `3000`).

---

## Tecnologias

- **Node.js** + **Express** — servidor web
- **net-snmp** — comunicação SNMP com as impressoras
- **better-sqlite3** — banco de dados local (histórico, trocas, estoque)
- **React 18** (carregado localmente, funciona offline) — painel

---

## Reiniciar o banco de dados (zerar histórico)

Se precisar recomeçar o histórico do zero:

1. Feche o sistema (Gerenciador de Tarefas → finalizar `node.exe`).
2. Apague os arquivos do banco na pasta `banco/`:

   ```
   del banco\dados.db*
   ```

3. Ligue o sistema de novo — ele recria o banco vazio.
