package com.gftwo.bygf;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Jembatan native BYgf:
 *  - setWidgetData: simpan ringkasan untuk widget homescreen lalu gambar ulang widget.
 *  - sidik jari Brankas: kunci utama dibungkus kunci AES-GCM di Android Keystore yang WAJIB sidik jari
 *    (kunci tidak bisa dipakai tanpa sidik jari, dan gugur bila sidik jari baru didaftarkan).
 *    Yang tersimpan hanya ciphertext + IV; kunci utama tidak pernah tersimpan polos.
 *  - openBatterySettings: halaman pengecualian hemat baterai (agar pengingat tidak dimatikan sistem).
 */
@CapacitorPlugin(name = "BygfNative")
public class BygfNativePlugin extends Plugin {
    private static final String ALIAS = "bygf_vault_bio_key";
    private static final String PREFS = "bygf_vault_bio";
    private static final String K_IV = "iv";
    private static final String K_CT = "ct";

    private SharedPreferences bioPrefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ---------------- widget ---------------- */
    @PluginMethod
    public void setWidgetData(PluginCall call) {
        BygfWidgets.save(getContext(), call.getString("json"));
        BygfWidgets.updateAll(getContext());
        call.resolve();
    }

    /* ---------------- baterai ---------------- */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("tidak bisa membuka pengaturan baterai");
        }
    }

    /* ---------------- sidik jari ---------------- */
    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        boolean ok = false;
        try {
            ok = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception ignored) {
            ok = false;
        }
        JSObject r = new JSObject();
        r.put("available", ok);
        call.resolve(r);
    }

    private SecretKey createKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= 24) b.setInvalidatedByBiometricEnrollment(true);
        kg.init(b.build());
        return kg.generateKey();
    }

    private SecretKey loadKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    private BiometricPrompt.PromptInfo promptInfo(String title) {
        return new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle("Gunakan sidik jari")
            .setNegativeButtonText("Pakai kunci utama")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build();
    }

    private void prompt(final PluginCall call, final Cipher cipher, String title, final boolean encrypt, final String secret, final byte[] oldCt) {
        final FragmentActivity activity = (FragmentActivity) getActivity();
        final Executor executor = ContextCompat.getMainExecutor(getContext());
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                BiometricPrompt bp = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        try {
                            Cipher c = result.getCryptoObject().getCipher();
                            JSObject r = new JSObject();
                            if (encrypt) {
                                byte[] ct = c.doFinal(secret.getBytes(StandardCharsets.UTF_8));
                                bioPrefs().edit()
                                    .putString(K_IV, Base64.encodeToString(c.getIV(), Base64.NO_WRAP))
                                    .putString(K_CT, Base64.encodeToString(ct, Base64.NO_WRAP))
                                    .apply();
                                r.put("ok", true);
                            } else {
                                byte[] pt = c.doFinal(oldCt);
                                r.put("secret", new String(pt, StandardCharsets.UTF_8));
                            }
                            call.resolve(r);
                        } catch (Exception e) {
                            call.reject("sidik jari gagal: " + e.getMessage());
                        }
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        call.reject("dibatalkan: " + errString);
                    }
                });
                bp.authenticate(promptInfo(title), new BiometricPrompt.CryptoObject(cipher));
            }
        });
    }

    @PluginMethod
    public void enableBiometric(PluginCall call) {
        String secret = call.getString("secret");
        if (secret == null || secret.length() == 0) { call.reject("kunci kosong"); return; }
        try {
            SecretKey key = createKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            prompt(call, cipher, "Aktifkan sidik jari Brankas", true, secret, null);
        } catch (Exception e) {
            call.reject("tidak bisa menyiapkan kunci: " + e.getMessage());
        }
    }

    @PluginMethod
    public void unlockBiometric(PluginCall call) {
        try {
            SharedPreferences p = bioPrefs();
            String iv = p.getString(K_IV, null), ct = p.getString(K_CT, null);
            if (iv == null || ct == null) { call.reject("belum diaktifkan"); return; }
            SecretKey key = loadKey();
            if (key == null) { clearBio(); call.reject("kunci tidak ada"); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            prompt(call, cipher, "Buka Brankas", false, null, Base64.decode(ct, Base64.NO_WRAP));
        } catch (KeyPermanentlyInvalidatedException e) {
            clearBio();   // sidik jari baru didaftarkan: pakai kunci utama lalu aktifkan lagi
            call.reject("kunci gugur karena sidik jari berubah");
        } catch (Exception e) {
            call.reject("tidak bisa membuka: " + e.getMessage());
        }
    }

    private void clearBio() {
        try {
            bioPrefs().edit().clear().apply();
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        } catch (Exception ignored) {
            // abaikan
        }
    }

    @PluginMethod
    public void disableBiometric(PluginCall call) {
        clearBio();
        call.resolve();
    }
}
