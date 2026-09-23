import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { API_BASE_URL } from "./KavachApp";

// KAVACH Firebase Web Push Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC5P63wx77UpADqArWEELBZDa8DIy4iuxc",
  authDomain: "kavach-wildlife-alert.firebaseapp.com",
  projectId: "kavach-wildlife-alert",
  storageBucket: "kavach-wildlife-alert.firebasestorage.app",
  messagingSenderId: "342826294293",
  appId: "1:342826294293:web:1cba7f3dfede990492021c",
  measurementId: "G-LC5FN83JBJ"
};

// VAPID Public Key for Web Push Certificate
export const VAPID_KEY = "BCqNaemwZ7Jxl__LFtRc0DhVacQIWplDmn9X8etWHMUGRr6FNlV6o0cEiqZzpUCk_X4oMV4-O3IF1ZlXRNHpwL0";

// Initialize Firebase client app (Client-side ONLY, NO service-account secrets)
export const app = initializeApp(firebaseConfig);

let messagingInstance = null;

export async function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM] Firebase Messaging is not supported in this browser.");
      return null;
    }
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (err) {
    console.warn("[FCM] isSupported check failed:", err);
    return null;
  }
}

/**
 * Requests browser notification permission silently without triggering any sound.
 * Obtains the FCM registration token and registers it with the backend database.
 */
export async function requestFcmToken(deviceInfo = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { success: false, error: "Notifications not supported by this browser." };
  }

  try {
    // 1. Silent Permission Request (ZERO siren/audio trigger)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Notification permission state:", permission);
      return { success: false, permission, error: `Permission ${permission}` };
    }

    // 2. Register Service Worker
    let swReg = null;
    if ("serviceWorker" in navigator) {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }

    // 3. Obtain Firebase Messaging Instance
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { success: false, error: "FCM Messaging not supported in current environment." };
    }

    // 4. Generate FCM Device Token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) {
      return { success: false, error: "FCM returned empty token." };
    }

    console.log("[FCM] Token generated:", token);

    // Cache locally
    try {
      localStorage.setItem("kavach_fcm_token", token);
    } catch {}

    // 5. Register with backend database
    await sendTokenToBackend(token, deviceInfo);

    return { success: true, token, permission };
  } catch (err) {
    console.error("[FCM] Error acquiring FCM token:", err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends token securely to the KAVACH Python backend.
 */
export async function sendTokenToBackend(token, deviceInfo = {}) {
  try {
    const payload = {
      token: token.trim(),
      device_id: deviceInfo.deviceId || localStorage.getItem("kavach_device_id") || "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      device_name: deviceInfo.deviceName || localStorage.getItem("kavach_device_name") || "Field Monitor Phone",
      role: deviceInfo.role || "Field Monitor",
      platform: navigator.userAgentData?.platform || navigator.platform || "Web",
      user_agent: navigator.userAgent
    };

    const res = await fetch(`${API_BASE_URL}/api/fcm/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log("[FCM] Token registered with backend database for:", payload.device_name);
      return true;
    } else {
      console.warn("[FCM] Backend registration returned status:", res.status);
      return false;
    }
  } catch (err) {
    console.error("[FCM] Failed to transmit token to backend:", err);
    return false;
  }
}

/**
 * Subscribes to foreground push messages while page is open.
 */
export async function attachForegroundListener(callback) {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
      console.log("[FCM] Received foreground push payload:", payload);
      callback(payload);
    });
  } catch (e) {
    console.warn("[FCM] Unable to attach foreground listener:", e);
    return () => {};
  }
}
