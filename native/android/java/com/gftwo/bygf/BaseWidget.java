package com.gftwo.bygf;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Dasar semua widget BYgf: ambil data, isi tampilan, ketuk = buka tab terkait di aplikasi. */
public abstract class BaseWidget extends AppWidgetProvider {
    protected static final int[] LINES = {R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5};

    protected abstract int layoutId();
    /** Tujuan saat widget diketuk: tugas | kuliah | saldo | lemari | catatan */
    protected abstract String route();
    protected abstract void bind(Context c, RemoteViews rv, JSONObject data, boolean hasData);

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews rv = new RemoteViews(c.getPackageName(), layoutId());
            JSONObject data = BygfWidgets.load(c);
            boolean has = data != null && !data.optBoolean("none", false);
            try {
                bind(c, rv, data, has);
            } catch (Exception e) {
                rv.setTextViewText(R.id.w_l1, "Buka BYgf untuk memperbarui");
            }
            rv.setOnClickPendingIntent(R.id.w_root, openApp(c, route()));
            mgr.updateAppWidget(id, rv);
        }
    }

    protected static PendingIntent openApp(Context c, String route) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("bygf://" + route));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, route.hashCode(), i, flags());
    }

    protected static int flags() {
        return Build.VERSION.SDK_INT >= 23
            ? (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    /** Isi baris 1..5; sisanya disembunyikan. */
    protected static void setLines(RemoteViews rv, java.util.List<String> lines) {
        for (int k = 0; k < LINES.length; k++) {
            if (k < lines.size()) {
                rv.setViewVisibility(LINES[k], View.VISIBLE);
                rv.setTextViewText(LINES[k], lines.get(k));
            } else {
                rv.setViewVisibility(LINES[k], View.GONE);
            }
        }
    }

    protected static String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    protected static String dayIso(int offset) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, offset);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
    }

    protected static void needData(RemoteViews rv, boolean none) {
        rv.setTextViewText(R.id.w_count, "");
        java.util.List<String> l = new java.util.ArrayList<>();
        l.add(none ? "Masuk ke akunmu di aplikasi BYgf." : "Buka BYgf sekali supaya widget terisi.");
        setLines(rv, l);
    }
}
