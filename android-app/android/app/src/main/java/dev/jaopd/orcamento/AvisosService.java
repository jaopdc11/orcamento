package dev.jaopd.orcamento;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Com o app em segundo plano, o próprio sistema mostra a notificação do FCM. Com o app aberto,
 * ela chega aqui e é exibida do mesmo jeito; o toque abre (ou traz para frente) o app.
 */
public class AvisosService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        Avisos.esquecerEnvio(this);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        RemoteMessage.Notification n = msg.getNotification();
        if (n == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        // Mesmos extras que o sistema põe ao tocar na notificação com o app em segundo plano.
        Intent abrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (java.util.Map.Entry<String, String> e : msg.getData().entrySet()) abrir.putExtra(e.getKey(), e.getValue());
        int id = (int) System.currentTimeMillis();
        PendingIntent toque = PendingIntent.getActivity(this, id, abrir,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationManagerCompat.from(this).notify(id,
            new NotificationCompat.Builder(this, Avisos.CANAL)
                .setSmallIcon(R.drawable.ic_notificacao)
                .setColor(ContextCompat.getColor(this, R.color.notificacao))
                .setContentTitle(n.getTitle())
                .setContentText(n.getBody())
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(toque)
                .build());
    }
}
