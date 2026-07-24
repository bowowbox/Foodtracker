/* KinDee optional backend sync (Supabase).
 *
 * This is a classic script (no build step). It stays completely inert until the
 * user connects a Supabase project in the Account modal, so the app keeps working
 * fully offline for anyone who never signs in.
 *
 * Data model: one JSON document per user in a `user_data` table
 *   { user_id (uuid, pk), data jsonb, updated_at timestamptz }
 * The document holds the whole personal log so summaries stay client-side.
 * See supabase/schema.sql and SUPABASE_SETUP.md.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CFG_KEY = "kindee_supabase";       // { url, key }
  const META_KEY = "kindee_sync_meta";     // { updatedAt }
  const APP_KEYS = { goal: "kindee_goal", log: "kindee_log", custom: "kindee_custom_foods" };
  const SUPABASE_ESM = "https://esm.sh/@supabase/supabase-js@2";

  let supabase = null;   // client once configured
  let session = null;    // current auth session
  let pushTimer = null;

  // ---------- config ----------
  // Baked-in deployment config (config.js) takes priority so end users just
  // sign in; otherwise fall back to a per-user config saved in localStorage.
  function bakedConfig() {
    const c = window.KINDEE_CONFIG;
    if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return null;
    if (/YOUR-PROJECT|YOUR-ANON/.test(String(c.SUPABASE_URL) + String(c.SUPABASE_ANON_KEY))) return null;
    return { url: String(c.SUPABASE_URL).replace(/\/$/, ""), key: String(c.SUPABASE_ANON_KEY), baked: true };
  }
  function loadConfig() {
    const baked = bakedConfig();
    if (baked) return baked;
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }
  function clearConfig() {
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem(META_KEY);
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  // ---------- client bootstrap ----------
  async function ensureClient() {
    if (supabase) return supabase;
    const cfg = loadConfig();
    if (!cfg || !cfg.url || !cfg.key) return null;
    const mod = await import(/* @vite-ignore */ SUPABASE_ESM);
    supabase = mod.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    supabase.auth.onAuthStateChange((_event, s) => {
      session = s;
      refreshUI();
      if (s) onSignedIn();
    });
    const { data } = await supabase.auth.getSession();
    session = data.session;
    return supabase;
  }

  // ---------- sync ----------
  function localSnapshot() {
    const get = (k, fb) => {
      try {
        const raw = localStorage.getItem(k);
        return raw === null ? fb : JSON.parse(raw);
      } catch {
        return fb;
      }
    };
    return {
      goal: get(APP_KEYS.goal, 2000),
      log: get(APP_KEYS.log, {}),
      custom: get(APP_KEYS.custom, []),
    };
  }
  function localMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function setLocalMeta(updatedAt) {
    localStorage.setItem(META_KEY, JSON.stringify({ updatedAt }));
  }

  // Write remote document into localStorage and ask the app to re-render
  function applyRemote(data) {
    if (!data) return;
    if (data.goal != null) localStorage.setItem(APP_KEYS.goal, JSON.stringify(data.goal));
    if (data.log != null) localStorage.setItem(APP_KEYS.log, JSON.stringify(data.log));
    if (data.custom != null) localStorage.setItem(APP_KEYS.custom, JSON.stringify(data.custom));
    window.dispatchEvent(new CustomEvent("kindee:reload"));
  }

  async function pull() {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) {
      setStatus("Sync error: " + error.message);
      return null;
    }
    return data; // { data, updated_at } | null
  }

  async function push() {
    if (!supabase || !session) return;
    const snap = localSnapshot();
    const updatedAt = new Date().toISOString();
    const row = { user_id: session.user.id, data: { ...snap, updatedAt }, updated_at: updatedAt };
    const { error } = await supabase.from("user_data").upsert(row, { onConflict: "user_id" });
    if (error) {
      setStatus("Sync error: " + error.message);
      return;
    }
    setLocalMeta(updatedAt);
    setStatus("Last synced just now");
  }

  function schedulePush() {
    if (!supabase || !session) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1500);
  }

  // On sign-in: pull remote; if it's newer than what we last synced, apply it.
  // If there's no remote row yet, seed it from this device.
  async function onSignedIn() {
    setStatus("Syncing…");
    const remote = await pull();
    if (!remote) {
      await push(); // first device — upload local
    } else {
      const remoteAt = remote.data && remote.data.updatedAt;
      const localAt = localMeta().updatedAt;
      if (!localAt || (remoteAt && remoteAt > localAt)) {
        applyRemote(remote.data);
        setLocalMeta(remoteAt || remote.updated_at);
        setStatus("Synced from your account");
      } else {
        await push(); // local is newer — upload
      }
    }
    refreshUI();
  }

  // ---------- account UI ----------
  function show(id, on) {
    $(id).classList.toggle("hidden", !on);
  }
  function setStatus(msg) {
    const el = $("sb-status");
    if (el) el.textContent = msg || "";
  }
  function refreshUI() {
    const cfg = loadConfig();
    const baked = !!(cfg && cfg.baked);
    show("account-setup", !cfg); // never shown when keys are baked in
    show("account-signin", !!cfg && !session);
    show("account-signedin", !!cfg && !!session);
    if ($("sb-forget")) $("sb-forget").classList.toggle("hidden", baked);
    if (session && $("sb-who")) $("sb-who").textContent = session.user.email || session.user.id;
  }

  function openAccount() {
    refreshUI();
    $("account-overlay").classList.remove("hidden");
  }
  function closeAccount() {
    $("account-overlay").classList.add("hidden");
  }

  // ---------- wiring ----------
  function wire() {
    if ($("btn-account")) $("btn-account").addEventListener("click", openAccount);
    if ($("account-close")) $("account-close").addEventListener("click", closeAccount);
    $("account-overlay").addEventListener("click", (e) => {
      if (e.target.id === "account-overlay") closeAccount();
    });

    // State A — connect a project
    $("sb-save").addEventListener("click", async () => {
      const url = $("sb-url").value.trim().replace(/\/$/, "");
      const key = $("sb-key").value.trim();
      if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) {
        toast("Please enter a valid Supabase URL and anon key");
        return;
      }
      saveConfig({ url, key });
      supabase = null;
      try {
        await ensureClient();
        toast("Connected — now sign in");
      } catch (e) {
        toast("Could not load Supabase — check your connection");
      }
      refreshUI();
    });
    $("sb-forget").addEventListener("click", () => {
      clearConfig();
      supabase = null;
      session = null;
      refreshUI();
    });

    // State B — magic-link sign-in
    $("sb-signin").addEventListener("click", async () => {
      const email = $("sb-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        toast("Please enter a valid email");
        return;
      }
      try {
        const client = await ensureClient();
        if (!client) return;
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: location.href.split("#")[0] },
        });
        if (error) toast(error.message);
        else toast("Magic link sent — check your email");
      } catch {
        toast("Sign-in failed — check your connection");
      }
    });

    // State C — signed in
    $("sb-syncnow").addEventListener("click", async () => {
      setStatus("Syncing…");
      await push();
    });
    $("sb-signout").addEventListener("click", async () => {
      if (supabase) await supabase.auth.signOut();
      session = null;
      refreshUI();
    });

    // Any local change → schedule a push
    window.addEventListener("kindee:changed", schedulePush);
  }

  // ---------- init ----------
  function init() {
    wire();
    refreshUI();
    if (loadConfig()) {
      ensureClient()
        .then(() => {
          refreshUI();
          if (session) onSignedIn();
        })
        .catch(() => {
          /* offline or blocked — app still works locally */
        });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
