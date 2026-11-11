package dev.jaopd.orcamento;

/** Endereços de produção que o casco conhece. */
final class Site {
    static final String HOST = "orcamento.jaopd.dev";
    static final String URL = "https://" + HOST;
    static final String API = "https://orcamento.api.jaopd.dev";
    /** Nome do cookie de sessão da API (orcamento-api, core/middleware/sessao.ts). */
    static final String COOKIE_SESSAO = "sessao";

    private Site() { }
}
