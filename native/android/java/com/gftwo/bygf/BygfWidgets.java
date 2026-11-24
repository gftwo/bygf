package com.gftwo.bygf;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Penyimpanan data widget (dikirim dari aplikasi web) + pembaruan semua widget. */
public final class BygfWidgets {
    private static final String PREFS = "bygf_widget";
    private static final String KEY_JSON = "json";
    private static final String KEY_HIDE = "hide_balance";

    private BygfWidgets() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void save(Context c, String json) {
        prefs(c).edit().putString(KEY_JSON, json == null ? "" : json).apply();
    }

    /** Data terakhir dari aplikasi, atau null bila belum ada / rusak. */
    public static JSONObject load(Context c) {
        try {
            String s = prefs(c).getString(KEY_JSON, "");
            return (s == null || s.length() == 0) ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean isBalanceHidden(Context c) {
        return prefs(c).getBoolean(KEY_HIDE, false);
    }

    public static void toggleBalanceHidden(Context c) {
        prefs(c).edit().putBoolean(KEY_HIDE, !isBalanceHidden(c)).apply();
    }

    private static final Class<?>[] PROVIDERS = {
        TasksWidget.class, BalanceWidget.class, ClassWidget.class, WearWidget.class, NoteWidget.class
    };

    /** Gambar ulang semua widget yang terpasang di homescreen. */
    public static void updateAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (Class<?> cls : PROVIDERS) {
            try {
                int[] ids = mgr.getAppWidgetIds(new ComponentName(c, cls));
                if (ids != null && ids.length > 0) {
                    ((AppWidgetProvider) cls.getDeclaredConstructor().newInstance()).onUpdate(c, mgr, ids);
                }
            } catch (Exception ignored) {
                // satu widget gagal tidak boleh menghentikan yang lain
            }
        }
    }
}
