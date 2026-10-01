package com.billcraft.pro;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);

        // Also register direct JavaScript Interface window.AndroidPrint.print() for webview
        try {
            WebView webView = getBridge().getWebView();
            webView.post(() -> {
                try {
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
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }
}
