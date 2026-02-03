package com.carcare.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.content.Intent;
import android.Manifest;
import android.content.pm.PackageManager;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView mWebView;
    private static final String API_URL = "https://saas-carcare-production.up.railway.app"; // URL de producción

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mWebView = new WebView(this);
        setContentView(mWebView);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);

        webSettings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // Pedir permisos de ubicación si no los tiene
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 1);
        }

        mWebView.addJavascriptInterface(new WebAppInterface(this), "AndroidTracker");
        mWebView.setWebViewClient(new WebViewClient());

        // Apuntar al nuevo panel de conductor
        mWebView.loadUrl("http://10.0.2.2:3000/conductor"); 
    }

    public class WebAppInterface {
        Activity mContext;

        WebAppInterface(Activity c) {
            mContext = c;
        }

        @JavascriptInterface
        public void startTracking(String rutaId) {
            Intent intent = new Intent(mContext, TrackingService.class);
            intent.putExtra("rutaId", rutaId);
            intent.putExtra("apiUrl", API_URL);
            mContext.startForegroundService(intent);
            mContext.runOnUiThread(() -> Toast.makeText(mContext, "Iniciando GPS Nativo...", Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void stopTracking() {
            Intent intent = new Intent(mContext, TrackingService.class);
            mContext.stopService(intent);
            mContext.runOnUiThread(() -> Toast.makeText(mContext, "GPS Nativo Detenido", Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
