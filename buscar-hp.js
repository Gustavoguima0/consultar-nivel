function traduzirNivel(nivelTexto, maxTexto) {
    // OID não respondido pela impressora → não dá pra saber o nível
    if (nivelTexto === null || maxTexto === null) {
        return { estado: "desconhecido", percentual: null };
    }

    const nivel = Number(nivelTexto);
    const max = Number(maxTexto);

    if (Number.isNaN(nivel) || Number.isNaN(max)) {
        return { estado: "desconhecido", percentual: null };
    }

    if (nivel === -2) {
        return { estado: "desconhecido", percentual: null };
    } else if (nivel === -3) {
        return { estado: "ok", percentual: null };
    } else if (nivel === 0) {
        return { estado: "vazia", percentual: 0 };
    } else if (max <= 0) {
        // capacidade máxima desconhecida (-2) ou inválida → evita percentual negativo
        return { estado: "desconhecido", percentual: null };
    } else {
        return { estado: "percentual", percentual: Math.round((nivel / max) * 100) };
    }
}