/* KinDee admin dashboard. Standalone page (admin.html) — not linked from the
 * main app. Shows aggregate usage stats and, on request, a specific user's
 * log. Every data-returning call is a Postgres function that itself checks
 * the signed-in account against an admin allowlist (see
 * supabase/admin_schema.sql) — this script never sees a privileged key, so
 * there's nothing here an attacker could extract to bypass that check.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SUPABASE_ESM = "https://esm.sh/@supabase/supabase-js@2";
  let supabase = null;
  let session = null;

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  function show(id, on) {
    $(id).classList.toggle("hidden", !on);
  }

  function fmtQty(q) {
    return Number.isInteger(q) ? String(q) : String(Math.round(q * 10) / 10);
  }

  // ---------- bootstrap ----------
  function configPresent() {
    const c = window.KINDEE_CONFIG;
    return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON_KEY && !/YOUR-PROJECT|YOUR-ANON/.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY));
  }

  async function ensureClient() {
    if (supabase) return supabase;
    const mod = await import(/* @vite-ignore */ SUPABASE_ESM);
    supabase = mod.createClient(window.KINDEE_CONFIG.SUPABASE_URL, window.KINDEE_CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    supabase.auth.onAuthStateChange((_e, s) => {
      session = s;
      route();
    });
    const { data } = await supabase.auth.getSession();
    session = data.session;
    return supabase;
  }

  // ---------- routing between the 4 states ----------
  function setState(state) {
    show("admin-noconfig", state === "noconfig");
    show("admin-signin", state === "signin");
    show("admin-denied", state === "denied");
    show("admin-dashboard", state === "dashboard");
    show("admin-signout", state === "denied" || state === "dashboard");
  }

  async function route() {
    if (!configPresent()) {
      setState("noconfig");
      return;
    }
    try {
      await ensureClient();
    } catch {
      toast("Could not load Supabase — check your connection");
      setState("signin");
      return;
    }
    if (!session) {
      setState("signin");
      return;
    }
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || !isAdmin) {
      $("admin-denied-email").textContent = session.user.email || session.user.id;
      setState("denied");
      return;
    }
    setState("dashboard");
    loadDashboard();
  }

  // ---------- dashboard data ----------
  async function loadDashboard() {
    const [overview, activity, users] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_daily_activity", { days: 30 }),
      supabase.rpc("admin_user_list"),
    ]);

    if (overview.error || activity.error || users.error) {
      toast("Error loading dashboard: " + (overview.error || activity.error || users.error).message);
      return;
    }

    renderTiles(overview.data[0]);
    renderChart(activity.data);
    renderUserTable(users.data);
  }

  function renderTiles(o) {
    $("stat-signed-up").textContent = o.signed_up_users;
    $("stat-with-log").textContent = o.users_with_log;
    $("stat-active-today").textContent = o.active_today;
    $("stat-active-week").textContent = o.active_this_week;
  }

  function renderChart(rows) {
    const chart = $("activity-chart");
    chart.innerHTML = "";
    const max = Math.max(1, ...rows.map((r) => r.active_users));
    for (const r of rows) {
      const col = document.createElement("div");
      col.className = "stats-col";
      const wrap = document.createElement("div");
      wrap.className = "stats-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "stats-bar" + (r.active_users > 0 ? " hit" : "");
      bar.style.height = `${r.active_users > 0 ? Math.max(4, (r.active_users / max) * 100) : 0}%`;
      const d = new Date(r.log_date + "T00:00:00");
      bar.title = `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${r.active_users} active`;
      wrap.appendChild(bar);
      col.appendChild(wrap);
      chart.appendChild(col);
    }
  }

  function renderUserTable(rows) {
    const body = $("user-table-body");
    body.innerHTML = "";
    $("user-table-empty").classList.toggle("hidden", rows.length > 0);
    $("user-table").classList.toggle("hidden", rows.length === 0);

    for (const r of rows) {
      const tr = document.createElement("tr");
      const joined = r.joined_at ? new Date(r.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
      const lastActive = r.last_log_date
        ? new Date(r.last_log_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "never";
      tr.innerHTML = `
        <td>${escapeHtml(r.email || "—")}</td>
        <td>${joined}</td>
        <td>${r.days_logged}</td>
        <td>${r.total_entries}</td>
        <td>${lastActive}</td>
        <td></td>`;
      const btn = document.createElement("button");
      btn.className = "link-btn";
      btn.textContent = "View log";
      btn.disabled = r.days_logged === 0;
      btn.addEventListener("click", () => openDrilldown(r.user_id, r.email));
      tr.lastElementChild.appendChild(btn);
      body.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---------- drill-down ----------
  async function openDrilldown(userId, email) {
    $("drilldown-title").textContent = email || "User log";
    $("drilldown-body").innerHTML = "<p class=\"hint\">Loading…</p>";
    $("drilldown-overlay").classList.remove("hidden");

    const { data, error } = await supabase.rpc("admin_user_log", { target_user_id: userId });
    if (error) {
      $("drilldown-body").innerHTML = `<p class="hint">Error: ${escapeHtml(error.message)}</p>`;
      return;
    }
    renderDrilldown(data || {});
  }

  const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks & drinks" };

  function renderDrilldown(doc) {
    const body = $("drilldown-body");
    body.innerHTML = "";
    const log = doc.log || {};
    const dates = Object.keys(log).sort().reverse();

    if (doc.goal) {
      const goalLine = document.createElement("p");
      goalLine.className = "hint";
      goalLine.textContent = `Daily goal: ${doc.goal.toLocaleString()} kcal`;
      body.appendChild(goalLine);
    }

    if (!dates.length) {
      body.innerHTML += '<p class="hint">No meals logged yet.</p>';
      return;
    }

    for (const date of dates) {
      const day = log[date];
      const dayTotal = Object.values(day)
        .flat()
        .reduce((s, e) => s + e.kcal * e.qty, 0);

      const card = document.createElement("section");
      card.className = "card drilldown-day";
      const head = document.createElement("div");
      head.className = "meal-head";
      head.innerHTML = `<span class="meal-title">${new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
        <span class="meal-kcal">${Math.round(dayTotal).toLocaleString()} kcal</span>`;
      card.appendChild(head);

      for (const mealKey of ["breakfast", "lunch", "dinner", "snack"]) {
        const entries = day[mealKey] || [];
        if (!entries.length) continue;
        const mealBlock = document.createElement("div");
        mealBlock.className = "drilldown-meal";
        const label = document.createElement("div");
        label.className = "drilldown-meal-label";
        label.textContent = MEAL_LABELS[mealKey];
        mealBlock.appendChild(label);
        const list = document.createElement("ul");
        list.className = "meal-items";
        for (const e of entries) {
          const li = document.createElement("li");
          li.className = "meal-item";
          const qtyText = e.qty !== 1 ? ` × ${fmtQty(e.qty)}` : "";
          li.innerHTML = `
            <div class="meal-item-info">
              <div class="meal-item-name">${escapeHtml(e.thai ? `${e.name} · ${e.thai}` : e.name)}</div>
              <div class="meal-item-sub">${escapeHtml(e.serving || "")}${qtyText}</div>
            </div>
            <span class="meal-item-kcal">${Math.round(e.kcal * e.qty)}</span>`;
          list.appendChild(li);
        }
        mealBlock.appendChild(list);
        card.appendChild(mealBlock);
      }
      body.appendChild(card);
    }
  }

  // ---------- events ----------
  function wire() {
    $("admin-send-link").addEventListener("click", async () => {
      const email = $("admin-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        toast("Please enter a valid email");
        return;
      }
      try {
        await ensureClient();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: location.href.split("#")[0] },
        });
        $("admin-signin-status").textContent = error ? error.message : "Magic link sent — check your email";
      } catch {
        toast("Sign-in failed — check your connection");
      }
    });

    $("admin-signout").addEventListener("click", async () => {
      if (supabase) await supabase.auth.signOut();
      session = null;
      setState("signin");
    });

    $("drilldown-close").addEventListener("click", () => $("drilldown-overlay").classList.add("hidden"));
    $("drilldown-overlay").addEventListener("click", (e) => {
      if (e.target.id === "drilldown-overlay") $("drilldown-overlay").classList.add("hidden");
    });
  }

  wire();
  route();
})();
