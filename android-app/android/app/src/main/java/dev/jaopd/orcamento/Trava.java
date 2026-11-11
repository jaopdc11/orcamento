package dev.jaopd.orcamento;

import android.graphics.Typeface;
import android.os.Build;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

/**
 * Trava local para abrir o app: uma tela nativa cobre o WebView até a digital (ou o PIN/padrão
 * do aparelho, para não ficar trancado fora se o leitor falhar) ser confirmada. Pede na abertura
 * fria e ao voltar do segundo plano depois de {@link #TEMPO_FORA_MS}. Não substitui o login por
 * código do site e não fala com o backend.
 *
 * Aparelho sem nenhuma tela de bloqueio configurada não tem como autenticar: o app abre direto.
 */
final class Trava {

    static final long TEMPO_FORA_MS = 5 * 60 * 1000;

    private final AppCompatActivity activity;
    private final Runnable aoLiberar;
    private View cobertura;
    private boolean travado;
    private boolean autenticando;
    private long saiuEm = -1;

    Trava(AppCompatActivity activity, Runnable aoLiberar) {
        this.activity = activity;
        this.aoLiberar = aoLiberar;
    }

    private static int autenticadores() {
        // STRONG | DEVICE_CREDENTIAL só é aceito a partir do Android 11.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            : BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    private boolean podeAutenticar() {
        return BiometricManager.from(activity).canAuthenticate(autenticadores()) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** Abertura fria. */
    void aoCriar() {
        travado = podeAutenticar();
        if (travado) mostrarCobertura();
    }

    void aoParar() {
        if (!activity.isChangingConfigurations()) saiuEm = SystemClock.elapsedRealtime();
    }

    void aoIniciar() {
        if (!travado && saiuEm >= 0 && SystemClock.elapsedRealtime() - saiuEm > TEMPO_FORA_MS && podeAutenticar()) {
            travado = true;
        }
        if (travado) {
            mostrarCobertura();
            if (!autenticando) pedir();
        }
    }

    boolean travado() {
        return travado;
    }

    private void pedir() {
        if (!podeAutenticar()) { // tela de bloqueio removida enquanto o app estava fora
            liberar();
            return;
        }
        autenticando = true;
        BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) {
                    autenticando = false;
                    liberar();
                }

                @Override
                public void onAuthenticationError(int codigo, @NonNull CharSequence texto) {
                    // Cancelado ou bloqueado por tentativas: a cobertura fica, com o botão para tentar de novo.
                    autenticando = false;
                }
            });
        prompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Desbloquear o Orçamento")
            .setSubtitle("Confirme sua identidade para continuar")
            .setAllowedAuthenticators(autenticadores())
            .build());
    }

    private void liberar() {
        travado = false;
        if (cobertura != null) cobertura.setVisibility(View.GONE);
        aoLiberar.run();
    }

    private void mostrarCobertura() {
        if (cobertura == null) cobertura = criarCobertura();
        cobertura.setVisibility(View.VISIBLE);
        cobertura.bringToFront();
    }

    private View criarCobertura() {
        FrameLayout raiz = new FrameLayout(activity);
        raiz.setBackgroundColor(ContextCompat.getColor(activity, R.color.fundo));
        raiz.setClickable(true); // nenhum toque atravessa para o WebView
        raiz.setFocusable(true);

        LinearLayout coluna = new LinearLayout(activity);
        coluna.setOrientation(LinearLayout.VERTICAL);
        coluna.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView titulo = new TextView(activity);
        titulo.setText("Orçamento bloqueado");
        titulo.setTextColor(ContextCompat.getColor(activity, R.color.texto));
        titulo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        titulo.setTypeface(Typeface.DEFAULT_BOLD);
        titulo.setGravity(Gravity.CENTER);

        TextView detalhe = new TextView(activity);
        detalhe.setText("Use a digital ou o bloqueio de tela do aparelho para continuar.");
        detalhe.setTextColor(ContextCompat.getColor(activity, R.color.texto));
        detalhe.setAlpha(0.7f);
        detalhe.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        detalhe.setGravity(Gravity.CENTER);
        int dp = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, activity.getResources().getDisplayMetrics());
        detalhe.setPadding(32 * dp, 8 * dp, 32 * dp, 24 * dp);

        Button desbloquear = new Button(activity);
        desbloquear.setText("Desbloquear");
        desbloquear.setOnClickListener(v -> { if (!autenticando) pedir(); });

        coluna.addView(titulo);
        coluna.addView(detalhe);
        coluna.addView(desbloquear, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        raiz.addView(coluna, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        activity.addContentView(raiz, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return raiz;
    }
}
