package com.billcraft.pro;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);

        // Hardware accelerated WebView setup with zero-flash white background
        try {
            WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(android.graphics.Color.WHITE);
            webView.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        } catch (Exception ignored) {}

        // Register direct JavaScript Interfaces for WebView
        try {
            WebView webView = getBridge().getWebView();
            webView.post(() -> {
                try {
                    // AndroidPrint interface for instant native A4 printing
                    webView.addJavascriptInterface(new Object() {
                        @JavascriptInterface
                        public void print() {
                            runOnUiThread(() -> {
                                try {
                                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                    if (printManager != null) {
                                        String jobName = "BillCraft_Invoice_" + System.currentTimeMillis();
                                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                                        PrintAttributes attributes = new PrintAttributes.Builder()
                                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                            .build();
                                        printManager.print(jobName, printAdapter, attributes);
                                    }
                                } catch (Exception ignored) {}
                            });
                        }
                    }, "AndroidPrint");

                    // AndroidApp interface for clean hardware Back button app minimization / exit
                    webView.addJavascriptInterface(new Object() {
                        @JavascriptInterface
                        public void exitApp() {
                            runOnUiThread(() -> {
                                try {
                                    moveTaskToBack(true);
                                } catch (Exception ignored) {}
                            });
                        }
                    }, "AndroidApp");
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}

        // Intercept Android hardware Back button / gesture navigation
        // If the user is on login.html or has reached the root screen, minimize/close the app cleanly
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    WebView webView = getBridge().getWebView();
                    String url = webView != null ? webView.getUrl() : "";
                    if (url != null && (url.contains("login.html") || !webView.canGoBack())) {
                        moveTaskToBack(true);
                        return;
                    }
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }
                } catch (Exception ignored) {}
                moveTaskToBack(true);
            }
        });
    }

    @Override
    public void onBackPressed() {
        try {
            WebView webView = getBridge().getWebView();
            String url = webView != null ? webView.getUrl() : "";
            if (url != null && (url.contains("login.html") || !webView.canGoBack())) {
                moveTaskToBack(true);
                return;
            }
        } catch (Exception ignored) {}
        super.onBackPressed();
    }
}
