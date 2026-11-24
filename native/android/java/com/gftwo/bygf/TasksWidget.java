package com.gftwo.bygf;

import android.content.Context;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class TasksWidget extends BaseWidget {
    @Override protected int layoutId() { return R.layout.widget_list; }
    @Override protected String route() { return "tugas"; }

    @Override
    protected void bind(Context c, RemoteViews rv, JSONObject d, boolean has) {
        rv.setTextViewText(R.id.w_title, "📝 Tugas");
        if (!has) { needData(rv, d != null); return; }
        JSONArray arr = d.optJSONArray("tasks");
        String today = todayIso();
        List<String> lines = new ArrayList<>();
        int due = 0;
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.optJSONObject(i);
                if (t == null) continue;
                String dd = t.optString("d", "");
                if (dd.length() > 0 && dd.compareTo(today) <= 0) due++;
                if (lines.size() >= 5) continue;
                String tag = "";
                if (dd.length() > 0) {
                    if (dd.compareTo(today) < 0) tag = "  · terlambat";
                    else if (dd.equals(today)) tag = t.optString("h", "").length() > 0 ? "  · " + t.optString("h") : "  · hari ini";
                    else tag = "  · " + dd.substring(8, 10) + "/" + dd.substring(5, 7);
                }
                lines.add("• " + t.optString("t", "") + tag);
            }
        }
        // jumlah tugas jatuh tempo dihitung dari 8 tugas teratas; angka lengkap dikirim aplikasi
        int total = d.optInt("tasksDue", due);
        rv.setTextViewText(R.id.w_count, total > 0 ? total + " jatuh tempo" : "");
        if (lines.isEmpty()) lines.add("Tidak ada tugas 🎉");
        setLines(rv, lines);
    }
}
