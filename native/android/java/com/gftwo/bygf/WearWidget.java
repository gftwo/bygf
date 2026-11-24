package com.gftwo.bygf;

import android.content.Context;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class WearWidget extends BaseWidget {
    @Override protected int layoutId() { return R.layout.widget_list; }
    @Override protected String route() { return "lemari"; }

    private static String join(JSONArray a) {
        StringBuilder sb = new StringBuilder();
        if (a != null) for (int i = 0; i < a.length(); i++) { if (i > 0) sb.append(", "); sb.append(a.optString(i, "")); }
        return sb.toString();
    }

    @Override
    protected void bind(Context c, RemoteViews rv, JSONObject d, boolean has) {
        rv.setTextViewText(R.id.w_title, "👕 Pakaian");
        if (!has) { needData(rv, d != null); return; }
        JSONObject w = d.optJSONObject("wear");
        List<String> lines = new ArrayList<>();
        boolean fresh = todayIso().equals(d.optString("today", ""));   // catatan hari ini hanya berlaku di hari yang sama
        JSONArray today = (w != null && fresh) ? w.optJSONArray("today") : null;
        lines.add(today != null && today.length() > 0 ? "Hari ini: " + join(today) : "Belum dicatat hari ini");
        int n = w == null ? 0 : w.optInt("dirtyN", 0);
        if (n > 0) {
            rv.setTextViewText(R.id.w_count, "🧺 " + n);
            lines.add("Waktunya dicuci: " + join(w.optJSONArray("dirty")) + (n > 6 ? " …" : ""));
        } else {
            rv.setTextViewText(R.id.w_count, "");
            lines.add("Belum ada yang perlu dicuci");
        }
        setLines(rv, lines);
    }
}
