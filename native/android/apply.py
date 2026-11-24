#!/usr/bin/env python3
"""Pasang fitur native BYgf ke proyek Android hasil `npx cap add android` (dijalankan di CI, aman diulang):
widget homescreen (5), plugin BygfNative (sidik jari Brankas, data widget, pengaturan baterai),
tautan bygf://, dan dependensi androidx.biometric."""
import pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent
app = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'android/app')
main = app / 'src/main'
manifest, gradle = main / 'AndroidManifest.xml', app / 'build.gradle'
for p in (manifest, gradle):
    if not p.exists():
        sys.exit(f'tidak ditemukan: {p}')

# 1) salin berkas Java + resource
shutil.copytree(root / 'java', main / 'java', dirs_exist_ok=True)
shutil.copytree(root / 'res', main / 'res', dirs_exist_ok=True)

# 2) AndroidManifest: izin, tautan bygf://, 5 widget
s = manifest.read_text(encoding='utf-8')
if 'android.permission.USE_BIOMETRIC' not in s:
    s = s.replace('<application', '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n    <application', 1)
if 'android:scheme="bygf"' not in s:
    filt = ('        <intent-filter>\n            <action android:name="android.intent.action.VIEW" />\n'
            '            <category android:name="android.intent.category.DEFAULT" />\n'
            '            <category android:name="android.intent.category.BROWSABLE" />\n'
            '            <data android:scheme="bygf" />\n        </intent-filter>\n')
    if '</activity>' not in s:
        sys.exit('manifest tidak punya </activity>')
    s = s.replace('</activity>', filt + '        </activity>', 1)
if 'com.gftwo.bygf.TasksWidget' not in s and '.TasksWidget' not in s:
    recv = ''
    for cls, info in (('TasksWidget', 'tasks'), ('BalanceWidget', 'balance'), ('ClassWidget', 'class'), ('WearWidget', 'wear'), ('NoteWidget', 'note')):
        recv += (f'        <receiver android:name=".{cls}" android:exported="false">\n'
                 '            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>\n'
                 f'            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_{info}_info" />\n'
                 '        </receiver>\n')
    s = s.replace('</application>', recv + '    </application>', 1)
manifest.write_text(s, encoding='utf-8')

# 3) dependensi androidx.biometric
g = gradle.read_text(encoding='utf-8')
if 'androidx.biometric:biometric' not in g:
    g, n = re.subn(r'(\ndependencies\s*\{)', r'\1\n    implementation "androidx.biometric:biometric:1.1.0"', g, count=1)
    if not n:
        sys.exit('build.gradle tidak punya blok dependencies')
    gradle.write_text(g, encoding='utf-8')
print('native BYgf terpasang')
