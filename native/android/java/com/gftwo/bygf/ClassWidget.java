package com.gftwo.bygf;

import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Jadwal kuliah: hanya yang belum selesai; bila hari ini sudah selesai, lanjut ke jadwal hari berikutnya. */
public class ClassWidget extends BaseWidget {
    @Override protected int layoutId() { return R.layout.widget_list; }
    @Override protected String route() { return "kuliah"; }

    private static long parse(String date, String time) {
        try {
            String t = (time == null || time.length() < 4) ? "23:59" : time;
            Date x = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).parse(date + " " + t);
            return x == null ? 0 : x.getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    protected void bind(Context c, RemoteViews rv, JSONObject d, boolean has) {
        rv.setTextViewText(R.id.w_title, "🎓 Kuliah");
        if (!has) { needData(rv, d != null); return; }
        JSONArray arr = d.optJSONArray("classes");
        final List<JSONObject> rest = new ArrayList<>();
        long now = System.currentTimeMillis();
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                JSONObject k = arr.optJSONObject(i);
                if (k == null) continue;
                String end = k.optString("e", "");
                if (end.length() == 0) end = k.optString("s", "");
                if (parse(k.optString("d", ""), end) > now) rest.add(k);   // belum selesai
            }
        }
        Collections.sort(rest, new Comparator<JSONObject>() {
            @Override public int compare(JSONObject a, JSONObject b) {
                int x = a.optString("d", "").compareTo(b.optString("d", ""));
                return x != 0 ? x : a.optString("s", "").compareTo(b.optString("s", ""));
            }
        });
        List<String> lines = new ArrayList<>();
        if (rest.isEmpty()) {
            rv.setTextViewText(R.id.w_count, "");
            lines.add("Tidak ada jadwal kuliah dalam beberapa hari ke depan");
            setLines(rv, lines);
            return;
        }
        String day = rest.get(0).optString("d", "");
        String label = day.equals(todayIso()) ? "hari ini" : day.equals(dayIso(1)) ? "besok" : day.substring(8, 10) + "/" + day.substring(5, 7);
        rv.setTextViewText(R.id.w_count, label);
        for (JSONObject k : rest) {
            if (!k.optString("d", "").equals(day) || lines.size() >= 5) continue;
            String e = k.optString("e", "");
            String room = k.optString("r", "");
            lines.add(k.optString("s", "") + (e.length() > 0 ? "–" + e : "") + "  " + k.optString("n", "") + (room.length() > 0 ? " · " + room : ""));
        }
        setLines(rv, lines);
    }
}
