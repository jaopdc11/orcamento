package dev.jaopd.orcamento;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import android.webkit.CookieManager;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Registro do token FCM na API (`POST /push/fcm`), feito pelo nativo: o site não sabe que está
 * num app e não tem acesso à ponte. A chamada leva o cookie de sessão que o WebView guardou e o
 * `Origin` do site (exigido pela checagem de CSRF da API). Sem sessão (antes do login) não há o
 * que registrar; o casco tenta de novo periodicamente enquanto está aberto.
 *
 * A API prende o token à sessão: no logout ele some lá. Aqui guarda-se só o hash do par
 * (token, sessão) já enviado, para não repetir a chamada; sessão ou token novos reenviam.
 */
final class Avisos {

    static final String CANAL = "avisos";
    private static final String PREFS = "avisos";
    private static final String CHAVE_ENVIADO = "enviado";
    private static final ExecutorService rede = Executors.newSingleThreadExecutor();

    private Avisos() { }

    static void criarCanal(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Avisos de meta", NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("Avisos quando uma categoria atinge 80% ou estoura a meta do mês.");
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    /** Token renovado pelo Firebase: o próximo {@link #sincronizar} reenvia. */
    static void esquecerEnvio(Context ctx) {
        prefs(ctx).edit().remove(CHAVE_ENVIADO).apply();
    }

    /** Chamar na thread principal (CookieManager). */
    static void sincronizar(Context ctx) {
        if (FirebaseApp.getApps(ctx).isEmpty()) return; // build sem google-services.json
        String sessao = sessaoAtual();
        if (sessao == null) return;
        Context app = ctx.getApplicationContext();
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token ->
            rede.execute(() -> enviar(app, token, sessao)));
    }

    private static String sessaoAtual() {
        String cookies = CookieManager.getInstance().getCookie(Site.API);
        if (cookies == null) return null;
        for (String parte : cookies.split(";")) {
            String c = parte.trim();
            if (c.startsWith(Site.COOKIE_SESSAO + "=")) {
                String valor = c.substring(Site.COOKIE_SESSAO.length() + 1);
                return valor.isEmpty() ? null : valor;
            }
        }
        return null;
    }

    private static void enviar(Context ctx, String token, String sessao) {
        String chave = sha256(token + "|" + sessao);
        if (chave.equals(prefs(ctx).getString(CHAVE_ENVIADO, null))) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(Site.API + "/push/fcm").openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(10_000);
            con.setReadTimeout(10_000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("Origin", Site.URL);
            con.setRequestProperty("Cookie", Site.COOKIE_SESSAO + "=" + sessao);
            byte[] corpo = ("{\"token\":\"" + token + "\"}").getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = con.getOutputStream()) {
                out.write(corpo);
            }
            int status = con.getResponseCode();
            if (status == 200) prefs(ctx).edit().putString(CHAVE_ENVIADO, chave).apply();
            else Log.w("Avisos", "registro FCM recusado: " + status);
        } catch (Exception e) {
            Log.w("Avisos", "registro FCM falhou", e); // sem rede: tenta no próximo ciclo
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String sha256(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
