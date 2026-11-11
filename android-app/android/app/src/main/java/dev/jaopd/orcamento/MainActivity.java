package dev.jaopd.orcamento;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebBackForwardList;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import java.util.Collections;

/**
 * Casco fino: abre o site ao vivo (orcamento.jaopd.dev) no WebView. Deploy do front aparece no
 * app sem build novo; build novo só quando muda o nativo. Login, sessão e offline são do site
 * (cookie da API + service worker). O nativo cuida de: trava por digital, registro do FCM,
 * barras do sistema e botão voltar.
 */
public class MainActivity extends BridgeActivity {

    private static final long INTERVALO_FCM_MS = 20_000;

    private Trava trava;
    private final Handler relogio = new Handler(Looper.getMainLooper());
    private final Runnable cicloFcm = new Runnable() {
        @Override
        public void run() {
            if (!trava.travado()) Avisos.sincronizar(MainActivity.this);
            relogio.postDelayed(this, INTERVALO_FCM_MS);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavegacaoPlugin.class); // antes do super.onCreate, que monta a bridge
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();

        // A API (orcamento.api.jaopd.dev) é de outra origem; o cookie de sessão precisa ser aceito.
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        silenciarEventosNoSite(webView);
        aplicarMargensDasBarras();
        voltarPeloHistorico();
        Avisos.criarCanal(this);

        trava = new Trava(this, this::aoLiberar);
        trava.aoCriar();

        if (savedInstanceState == null) webView.loadUrl(Site.URL + "/" + consultaDoAviso(getIntent()));
    }

    /** Toque num aviso de meta com o app já aberto: o site troca para Metas sem recarregar. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String ledgerId = intent.getStringExtra("ledgerId");
        String mes = intent.getStringExtra("mes");
        if (!valido(ledgerId, mes)) return;
        WebView webView = getBridge().getWebView();
        String url = webView.getUrl();
        if (url != null && url.startsWith(Site.URL)) {
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orcamento:abrir',{detail:{ledgerId:'"
                + ledgerId + "',mes:'" + mes + "',tela:'" + tela(intent) + "'}}))", null);
        } else {
            webView.loadUrl(Site.URL + "/" + consultaDoAviso(intent));
        }
    }

    /** `?orcamento=<id>&mes=AAAA-MM` quando a activity foi aberta por um aviso (lido em src/lib/destino.ts). */
    private static String consultaDoAviso(Intent intent) {
        String ledgerId = intent.getStringExtra("ledgerId");
        String mes = intent.getStringExtra("mes");
        if (!valido(ledgerId, mes)) return "";
        return "?orcamento=" + Uri.encode(ledgerId) + "&mes=" + Uri.encode(mes) + "&tela=" + tela(intent);
    }

    /** Só dois valores possíveis: o que vier diferente de "inicio" vira "metas". */
    private static String tela(Intent intent) {
        return "inicio".equals(intent.getStringExtra("tela")) ? "inicio" : "metas";
    }

    /** Os valores entram em JS e em URL: só UUID e AAAA-MM passam. */
    private static boolean valido(String ledgerId, String mes) {
        return ledgerId != null && mes != null
            && ledgerId.matches("[0-9a-fA-F-]{36}") && mes.matches("\\d{4}-\\d{2}");
    }

    @Override
    public void onStart() {
        super.onStart();
        trava.aoIniciar();
    }

    @Override
    public void onResume() {
        super.onResume();
        relogio.removeCallbacks(cicloFcm);
        relogio.post(cicloFcm);
    }

    @Override
    public void onPause() {
        relogio.removeCallbacks(cicloFcm);
        super.onPause();
    }

    @Override
    public void onStop() {
        trava.aoParar();
        super.onStop();
    }

    private void aoLiberar() {
        pedirPermissaoDeNotificacao();
        Avisos.sincronizar(this);
    }

    private void pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
    }

    /**
     * O Capacitor avisa pausa/retomada rodando `window.Capacitor.triggerEvent(...)` na página
     * aberta. O site não tem a ponte, e isso vira erro no console a cada troca de app; um objeto
     * mínimo absorve a chamada.
     */
    private void silenciarEventosNoSite(WebView webView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        WebViewCompat.addDocumentStartJavaScript(webView,
            "if(!window.Capacitor){Object.defineProperty(window,'Capacitor',{value:{" +
            "triggerEvent:function(){},isNativePlatform:function(){return false;}}});}",
            Collections.singleton(Site.URL));
    }

    /**
     * Voltar percorre o histórico do WebView, como no navegador. A primeira entrada é a página
     * local de entrada do Capacitor; chegando nela, o app fecha em vez de mostrar a tela vazia.
     */
    private void voltarPeloHistorico() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                WebBackForwardList hist = webView.copyBackForwardList();
                int i = hist.getCurrentIndex();
                boolean anteriorEhDoSite = i > 0 && hist.getItemAtIndex(i - 1).getUrl().startsWith(Site.URL);
                if (anteriorEhDoSite) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    /**
     * Com targetSdk 35+ o Android força edge-to-edge; o site não reserva a área das barras, então
     * as margens vão no container do WebView. O teclado não entra no padding (o WebView trata).
     */
    private void aplicarMargensDasBarras() {
        View container = (View) getBridge().getWebView().getParent();
        container.setBackgroundColor(ContextCompat.getColor(this, R.color.fundo));
        WindowCompat.getInsetsController(getWindow(), container).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), container).setAppearanceLightNavigationBars(false);
        int barrasECorte = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(container, (v, insets) -> {
            Insets barras = insets.getInsets(barrasECorte);
            v.setPadding(barras.left, barras.top, barras.right, barras.bottom);
            return new WindowInsetsCompat.Builder(insets).setInsets(barrasECorte, Insets.NONE).build();
        });
        ViewCompat.requestApplyInsets(container);
    }
}
