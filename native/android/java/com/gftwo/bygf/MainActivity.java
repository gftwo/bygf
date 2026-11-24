package com.gftwo.bygf;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BygfNativePlugin.class);   // widget + sidik jari Brankas + pengaturan baterai
        super.onCreate(savedInstanceState);
    }
}
