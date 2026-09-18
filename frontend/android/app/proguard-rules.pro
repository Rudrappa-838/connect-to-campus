# Add project specific ProGuard rules here.
# Capacitor & WebView Rules

# Keep Capacitor Bridge
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }

# Keep WebView JavaScript Interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# Keep Capacitor Plugins
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.rudrappa.connect2campus.** { *; }
-keepclassmembers class com.rudrappa.connect2campus.** { *; }

# Keep Android Support Libraries
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# Remove logging in production
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Optimize
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Keep source file and line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
