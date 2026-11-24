package com.gftwo.bygf;

import android.content.Context;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** Catatan cepat: ketuk untuk langsung membuka tab Catatan. Tidak butuh data dari aplikasi. */
public class NoteWidget extends BaseWidget {
    @Override protected int layoutId() { return R.layout.widget_list; }
    @Override protected String route() { return "catatan"; }

    @Override
    protected void bind(Context c, RemoteViews rv, JSONObject d, boolean has) {
        rv.setTextViewText(R.id.w_title, "✏️ Catatan cepat");
        rv.setTextViewText(R.id.w_count, "");
        List<String> lines = new ArrayList<>();
        lines.add("Ketuk untuk menulis catatan baru");
        setLines(rv, lines);
    }
}
