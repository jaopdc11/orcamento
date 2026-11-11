package dev.jaopd.orcamento;

import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mantém o site dentro do WebView sem colocá-lo em `server.allowNavigation`.
 *
 * O Capacitor libera a ponte nativa para toda origem do `allowNavigation`; fora dele, a ponte só
 * aceita a página local do app. Assim o site navega no WebView, mas nenhum script dele alcança os
 * plugins. Outros domínios seguem a decisão padrão do Capacitor (abrir no navegador do sistema).
 * Ref.: developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges
 */
@CapacitorPlugin(name = "Navegacao")
public class NavegacaoPlugin extends Plugin {

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if ("https".equals(url.getScheme()) && Site.HOST.equals(url.getHost())) return false;
        return null;
    }
}
