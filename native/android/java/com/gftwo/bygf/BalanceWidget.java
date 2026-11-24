package com.gftwo.bygf;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.Locale;
import org.json.JSONObject;

/** Saldo dengan tombol sembunyikan (disimpan di perangkat, tidak lewat aplikasi). */
public class BalanceWidget extends BaseWidget {
    static final String ACTION_TOGGLE = "com.gftwo.bygf.TOGGLE_BALANCE";

    @Override protected int layoutId() { return R.layout.widget_balance; }
    @Override protected String route() { return "saldo"; }

    private static String rp(long v) {
        return "Rp " + NumberFormat.getInstance(new Locale("id", "ID")).format(v);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent != null && ACTION_TOGGLE.equals(intent.getAction())) {
            BygfWidgets.toggleBalanceHidden(c);
            AppWidgetManager mgr = AppWidgetManager.getInstance(c);
            int[] ids = mgr.getAppWidgetIds(new android.content.ComponentName(c, BalanceWidget.class));
            onUpdate(c, mgr, ids);
            return;
        }
        super.onReceive(c, intent);
    }

    @Override
    protected void bind(Context c, RemoteViews rv, JSONObject d, boolean has) {
        boolean hide = BygfWidgets.isBalanceHidden(c);
        Intent t = new Intent(c, BalanceWidget.class);
        t.setAction(ACTION_TOGGLE);
        rv.setOnClickPendingIntent(R.id.w_eye, PendingIntent.getBroadcast(c, 7, t, flags()));
        rv.setTextViewText(R.id.w_eye, hide ? "🙈" : "👁");
        if (!has) {
            rv.setTextViewText(R.id.w_amount, "—");
            rv.setTextViewText(R.id.w_sub, d != null ? "Masuk ke akunmu di aplikasi BYgf." : "Buka BYgf sekali supaya widget terisi.");
            return;
        }
        JSONObject b = d.optJSONObject("balance");
        long total = b == null ? 0 : b.optLong("total", 0), cash = b == null ? 0 : b.optLong("cash", 0), saldo = b == null ? 0 : b.optLong("saldo", 0);
        rv.setTextViewText(R.id.w_amount, hide ? "Rp ••••••" : rp(total));
        rv.setTextViewText(R.id.w_sub, hide ? "Ketuk 🙈 untuk menampilkan" : "Cash " + rp(cash) + "  ·  Saldo " + rp(saldo));
    }
}
