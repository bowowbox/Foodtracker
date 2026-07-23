/* KinDee — Thai nutrition tracker. All data is stored in localStorage. */
(function () {
  "use strict";

  // ---------- Storage ----------
  const LS = {
    goal: "kindee_goal",
    log: "kindee_log",
    custom: "kindee_custom_foods",
  };

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  let goal = load(LS.goal, 2000);
  let log = load(LS.log, {}); // { "YYYY-MM-DD": { breakfast: [entry], ... } }
  let customFoods = load(LS.custom, []);

  // ---------- State ----------
  const MEALS = [
    { key: "breakfast", label: "Breakfast", emoji: "🌅" },
    { key: "lunch", label: "Lunch", emoji: "🍛" },
    { key: "dinner", label: "Dinner", emoji: "🌙" },
    { key: "snack", label: "Snacks & drinks", emoji: "🍡" },
  ];

  let currentDate = todayKey();
  let activeMeal = null; // meal key the add-modal is targeting
  let activeCategory = "All";
  let pendingFood = null; // food selected in search, awaiting quantity
  let pendingQty = 1;

  function todayKey() {
    const d = new Date();
    return dateKey(d);
  }
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // ---------- Foods ----------
  function allFoods() {
    return [...customFoods, ...FOOD_DB];
  }
  function categories() {
    const cats = [];
    for (const f of allFoods()) if (!cats.includes(f.cat)) cats.push(f.cat);
    return cats;
  }

  // ---------- Day helpers ----------
  function dayLog(key) {
    return log[key] || {};
  }
  function dayEntries(key) {
    const day = dayLog(key);
    return MEALS.flatMap((m) => day[m.key] || []);
  }
  function dayTotals(key) {
    return dayEntries(key).reduce(
      (t, e) => ({
        kcal: t.kcal + e.kcal * e.qty,
        p: t.p + e.p * e.qty,
        c: t.c + e.c * e.qty,
        f: t.f + e.f * e.qty,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
  }

  // ---------- Encouragement ----------
  const CHEER = {
    empty: [
      ["🌤", "A fresh day, a fresh plate. You've got this!"],
      ["🍚", "Log your first meal — small steps add up to big change."],
      ["💛", "Every healthy choice counts. Start whenever you're ready."],
      ["🌱", "Progress, not perfection. Let's make today a good one."],
    ],
    low: [
      ["👏", "Nice start! Keep listening to your body."],
      ["🥢", "Off to a good beginning — plenty of room for a great lunch."],
      ["✨", "One meal logged is one honest step. Keep going!"],
      ["🐘", "Sabai sabai — steady and relaxed wins the day."],
    ],
    mid: [
      ["💪", "Halfway there and doing great. Su su! (สู้ๆ)"],
      ["🎯", "You're pacing yourself beautifully today."],
      ["🌟", "Consistency beats intensity — and you're being consistent."],
      ["🧡", "Great balance so far. Your future self says thank you."],
    ],
    near: [
      ["🔥", "So close to your goal — finish the day strong!"],
      ["🍊", "Almost there! A light choice now keeps you right on track."],
      ["👍", "You've managed today like a pro. Nearly at your goal."],
    ],
    hit: [
      ["🎉", "Goal reached — well done! Geng mak! (เก่งมาก)"],
      ["🏆", "You hit your target today. That's real self-care."],
      ["💚", "Right on goal. Rest well — tomorrow builds on today."],
    ],
    over: [
      ["🤗", "A little over — that's okay. One day never defines you."],
      ["🌈", "Be kind to yourself. Tomorrow is a brand-new plate."],
      ["🚶", "Over goal today? A nice evening walk always helps. Mai pen rai!"],
      ["💛", "Food is also joy. Note it, learn from it, move on."],
    ],
  };

  function cheerBucket(totalKcal) {
    if (totalKcal === 0) return "empty";
    const ratio = totalKcal / goal;
    if (ratio < 0.35) return "low";
    if (ratio < 0.75) return "mid";
    if (ratio < 1.0) return "near";
    if (ratio <= 1.08) return "hit";
    return "over";
  }

  let cheerIndex = Math.floor(Math.random() * 100);
  function renderCheer(totalKcal) {
    const list = CHEER[cheerBucket(totalKcal)];
    const [emoji, text] = list[cheerIndex % list.length];
    document.getElementById("cheer-emoji").textContent = emoji;
    document.getElementById("cheer-text").textContent = text;
  }

  // ---------- Rendering ----------
  const $ = (id) => document.getElementById(id);

  function render() {
    renderDate();
    renderSummary();
    renderWeek();
    renderMeals();
    $("db-count").textContent = allFoods().length;
  }

  function renderDate() {
    const today = todayKey();
    const d = parseKey(currentDate);
    let label;
    if (currentDate === today) {
      label = "Today";
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      label =
        currentDate === dateKey(yesterday)
          ? "Yesterday"
          : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    }
    $("date-label").textContent = label;
    // Don't allow navigating into the future
    $("date-next").style.visibility = currentDate === today ? "hidden" : "visible";
  }

  function renderSummary() {
    const t = dayTotals(currentDate);
    const remaining = Math.round(goal - t.kcal);

    $("eaten-kcal").textContent = Math.round(t.kcal).toLocaleString();
    $("goal-kcal").textContent = goal.toLocaleString();

    if (remaining >= 0) {
      $("remaining-kcal").textContent = remaining.toLocaleString();
      $("remaining-caption").textContent = "kcal left";
    } else {
      $("remaining-kcal").textContent = Math.abs(remaining).toLocaleString();
      $("remaining-caption").textContent = "kcal over";
    }

    // Ring
    const circumference = 2 * Math.PI * 52;
    const ratio = Math.min(t.kcal / goal, 1);
    const ring = $("ring-fill");
    ring.style.strokeDashoffset = circumference * (1 - ratio);
    ring.classList.toggle("over", t.kcal > goal * 1.08);
    ring.classList.toggle("done", t.kcal >= goal * 0.92 && t.kcal <= goal * 1.08);

    // Macros — reference targets derived from the calorie goal (30/45/25 split)
    const pTarget = (goal * 0.3) / 4;
    const cTarget = (goal * 0.45) / 4;
    const fTarget = (goal * 0.25) / 9;
    $("macro-p").textContent = `${Math.round(t.p)} g`;
    $("macro-c").textContent = `${Math.round(t.c)} g`;
    $("macro-f").textContent = `${Math.round(t.f)} g`;
    $("bar-p").style.width = `${Math.min((t.p / pTarget) * 100, 100)}%`;
    $("bar-c").style.width = `${Math.min((t.c / cTarget) * 100, 100)}%`;
    $("bar-f").style.width = `${Math.min((t.f / fTarget) * 100, 100)}%`;

    renderCheer(t.kcal);
  }

  function renderWeek() {
    const strip = $("week-strip");
    strip.innerHTML = "";
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dateKey(d);
      const kcal = dayTotals(key).kcal;

      const btn = document.createElement("button");
      btn.className = "week-day" + (key === currentDate ? " active" : "");
      btn.addEventListener("click", () => {
        currentDate = key;
        render();
      });

      const name = document.createElement("span");
      name.className = "week-day-name";
      name.textContent = i === 0 ? "Now" : d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);

      const dot = document.createElement("span");
      dot.className = "week-dot";
      if (kcal > 0) {
        const ratio = kcal / goal;
        dot.classList.add(ratio > 1.08 ? "over" : ratio >= 0.92 ? "hit" : "some");
        dot.textContent = kcal >= 1000 ? `${(kcal / 1000).toFixed(1)}k` : Math.round(kcal);
      } else {
        dot.textContent = "·";
      }

      btn.append(name, dot);
      strip.appendChild(btn);
    }
  }

  function renderMeals() {
    const container = $("meals");
    container.innerHTML = "";
    const day = dayLog(currentDate);

    for (const meal of MEALS) {
      const entries = day[meal.key] || [];
      const mealKcal = entries.reduce((s, e) => s + e.kcal * e.qty, 0);

      const card = document.createElement("section");
      card.className = "card meal-card";

      const head = document.createElement("div");
      head.className = "meal-head";
      head.innerHTML = `
        <span class="meal-title"><span class="meal-emoji">${meal.emoji}</span>${meal.label}</span>
        <span class="meal-kcal">${entries.length ? Math.round(mealKcal).toLocaleString() + " kcal" : ""}</span>`;
      card.appendChild(head);

      if (entries.length) {
        const list = document.createElement("ul");
        list.className = "meal-items";
        entries.forEach((e, idx) => {
          const li = document.createElement("li");
          li.className = "meal-item";

          const info = document.createElement("div");
          info.className = "meal-item-info";
          const qtyText = e.qty !== 1 ? ` × ${fmtQty(e.qty)}` : "";
          info.innerHTML = `
            <div class="meal-item-name"></div>
            <div class="meal-item-sub"></div>`;
          info.querySelector(".meal-item-name").textContent = e.thai ? `${e.name} · ${e.thai}` : e.name;
          info.querySelector(".meal-item-sub").textContent = `${e.serving}${qtyText}`;

          const right = document.createElement("div");
          right.className = "meal-item-right";
          const kcal = document.createElement("span");
          kcal.className = "meal-item-kcal";
          kcal.textContent = Math.round(e.kcal * e.qty).toLocaleString();
          const del = document.createElement("button");
          del.className = "del-btn";
          del.setAttribute("aria-label", `Remove ${e.name}`);
          del.textContent = "✕";
          del.addEventListener("click", () => removeEntry(meal.key, idx));
          right.append(kcal, del);

          li.append(info, right);
          list.appendChild(li);
        });
        card.appendChild(list);
      } else {
        const empty = document.createElement("p");
        empty.className = "meal-empty";
        empty.textContent = "Nothing logged yet";
        card.appendChild(empty);
      }

      const addBtn = document.createElement("button");
      addBtn.className = "add-food-btn";
      addBtn.textContent = "+ Add food";
      addBtn.addEventListener("click", () => openFoodModal(meal));
      card.appendChild(addBtn);

      container.appendChild(card);
    }
  }

  // ---------- Log mutations ----------
  function addEntry(mealKey, food, qty) {
    if (!log[currentDate]) log[currentDate] = {};
    if (!log[currentDate][mealKey]) log[currentDate][mealKey] = [];
    // Snapshot the food so later edits/deletions of the database don't alter history
    log[currentDate][mealKey].push({
      name: food.name,
      thai: food.thai || "",
      serving: food.serving,
      kcal: food.kcal,
      p: food.p || 0,
      c: food.c || 0,
      f: food.f || 0,
      qty,
    });
    save(LS.log, log);
    render();
    toast(`Added ${food.name} — ${Math.round(food.kcal * qty)} kcal`);
  }

  function removeEntry(mealKey, index) {
    const entries = log[currentDate] && log[currentDate][mealKey];
    if (!entries) return;
    entries.splice(index, 1);
    if (!entries.length) delete log[currentDate][mealKey];
    if (!Object.keys(log[currentDate]).length) delete log[currentDate];
    save(LS.log, log);
    render();
  }

  // ---------- Food modal ----------
  function openFoodModal(meal) {
    activeMeal = meal.key;
    $("modal-meal-name").textContent = meal.label;
    $("food-search").value = "";
    activeCategory = "All";
    switchTab("search");
    resetNewFood();
    renderChips();
    renderFoodList();
    $("modal-overlay").classList.remove("hidden");
    if (window.matchMedia("(min-width: 520px)").matches) $("food-search").focus();
  }
  function closeFoodModal() {
    $("modal-overlay").classList.add("hidden");
  }

  function switchTab(tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("panel-search").classList.toggle("hidden", tab !== "search");
    $("panel-new").classList.toggle("hidden", tab !== "new");
  }

  function renderChips() {
    const wrap = $("category-chips");
    wrap.innerHTML = "";
    for (const cat of ["All", ...categories()]) {
      const chip = document.createElement("button");
      chip.className = "chip" + (cat === activeCategory ? " active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => {
        activeCategory = cat;
        renderChips();
        renderFoodList();
      });
      wrap.appendChild(chip);
    }
  }

  function renderFoodList() {
    const q = $("food-search").value.trim().toLowerCase();
    const list = $("food-list");
    list.innerHTML = "";

    let foods = allFoods();
    if (activeCategory !== "All") foods = foods.filter((f) => f.cat === activeCategory);
    if (q) {
      foods = foods.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.thai && f.thai.includes(q)) ||
          f.cat.toLowerCase().includes(q)
      );
    }

    if (!foods.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "No match — try the “New food” tab to add it yourself.";
      list.appendChild(li);
      return;
    }

    for (const food of foods.slice(0, 60)) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "food-row";

      const info = document.createElement("div");
      info.className = "food-row-info";
      const nameEl = document.createElement("div");
      nameEl.className = "food-row-name";
      nameEl.textContent = food.name;
      if (food.thai) {
        const thai = document.createElement("span");
        thai.className = "thai";
        thai.textContent = ` · ${food.thai}`;
        nameEl.appendChild(thai);
      }
      if (food.custom) {
        const badge = document.createElement("span");
        badge.className = "custom-badge";
        badge.textContent = "yours";
        nameEl.appendChild(badge);
      }
      const sub = document.createElement("div");
      sub.className = "food-row-sub";
      sub.textContent = food.serving;
      info.append(nameEl, sub);

      const kcal = document.createElement("span");
      kcal.className = "food-row-kcal";
      kcal.innerHTML = `${food.kcal} <small>kcal</small>`;

      btn.append(info, kcal);
      btn.addEventListener("click", () => openQtyModal(food));
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  // ---------- New-food suggestions ----------
  function searchFoods(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return allFoods().filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.thai && f.thai.includes(q)) ||
        f.cat.toLowerCase().includes(q)
    );
  }

  function applyPrefill(source) {
    if (source.serving) $("nf-serving").value = source.serving;
    $("nf-kcal").value = source.kcal;
    $("nf-p").value = source.p != null ? source.p : "";
    $("nf-c").value = source.c != null ? source.c : "";
    $("nf-f").value = source.f != null ? source.f : "";
    toast(source.name ? `Filled from ${source.name} — edit as needed` : "Values filled — edit as needed");
  }

  function renderNfSuggestions() {
    const q = ($("nf-name").value || $("nf-thai").value || "").trim();
    const box = $("nf-suggestions");
    if (q.length < 2) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    const matches = searchFoods(q).slice(0, 4);
    if (!matches.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = "";
    const label = document.createElement("div");
    label.className = "nf-suggest-label";
    label.textContent = "Tap a similar food to fill in its nutrition:";
    box.appendChild(label);
    for (const food of matches) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nf-suggest-row";
      const info = document.createElement("div");
      info.className = "nf-suggest-info";
      const name = document.createElement("div");
      name.className = "nf-suggest-name";
      name.textContent = food.thai ? `${food.name} · ${food.thai}` : food.name;
      const sub = document.createElement("div");
      sub.className = "nf-suggest-sub";
      sub.textContent = `${food.serving} · ${Math.round(food.p)} g protein`;
      info.append(name, sub);
      const kcal = document.createElement("span");
      kcal.className = "nf-suggest-kcal";
      kcal.innerHTML = `${food.kcal} <small>kcal</small>`;
      btn.append(info, kcal);
      btn.addEventListener("click", () => applyPrefill(food));
      box.appendChild(btn);
    }
    box.classList.remove("hidden");
  }

  // Curated "dish type" starting points for foods with no close match
  const NF_TEMPLATES = [
    { label: "Rice dish", serving: "1 plate", kcal: 550, p: 20, c: 70, f: 20 },
    { label: "Noodle soup", serving: "1 bowl", kcal: 400, p: 18, c: 50, f: 12 },
    { label: "Stir-fry", serving: "1 serving", kcal: 350, p: 20, c: 12, f: 24 },
    { label: "Curry", serving: "1 bowl", kcal: 300, p: 18, c: 12, f: 20 },
    { label: "Salad (yum)", serving: "1 plate", kcal: 200, p: 14, c: 14, f: 9 },
    { label: "Grilled meat", serving: "1 serving", kcal: 250, p: 25, c: 3, f: 16 },
    { label: "Soup", serving: "1 bowl", kcal: 150, p: 12, c: 9, f: 7 },
    { label: "Dessert", serving: "1 serving", kcal: 280, p: 4, c: 45, f: 10 },
    { label: "Drink", serving: "1 cup", kcal: 180, p: 3, c: 32, f: 5 },
    { label: "Snack", serving: "1 pack", kcal: 150, p: 3, c: 18, f: 8 },
    { label: "Fruit", serving: "1 serving", kcal: 70, p: 1, c: 17, f: 0.3 },
  ];

  function renderNfTemplates() {
    const wrap = $("nf-template-chips");
    wrap.innerHTML = "";
    for (const t of NF_TEMPLATES) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = t.label;
      chip.addEventListener("click", () => applyPrefill(t));
      wrap.appendChild(chip);
    }
  }

  function resetNewFood() {
    $("new-food-form").reset();
    $("nf-suggestions").classList.add("hidden");
    $("nf-suggestions").innerHTML = "";
  }

  // ---------- Quantity modal ----------
  function openQtyModal(food) {
    pendingFood = food;
    $("qty-food-name").textContent = food.thai ? `${food.name} · ${food.thai}` : food.name;
    $("qty-serving-label").textContent = `Serving: ${food.serving}`;
    setQty(1);
    $("qty-overlay").classList.remove("hidden");
  }
  // Format a quantity without trailing zeros: 1 -> "1", 0.2 -> "0.2", 1.5 -> "1.5"
  function fmtQty(q) {
    return Number.isInteger(q) ? String(q) : String(Math.round(q * 10) / 10);
  }
  function qtyKcalReadout() {
    $("qty-kcal").textContent = Math.round(pendingFood.kcal * pendingQty).toLocaleString();
  }
  // Set the portion, clamp to [0.1, 20], round to 1 decimal, sync the input + kcal
  function setQty(q) {
    q = Math.min(20, Math.max(0.1, Math.round(q * 10) / 10));
    pendingQty = q;
    $("qty-input").value = fmtQty(q);
    qtyKcalReadout();
  }
  function closeQtyModal() {
    $("qty-overlay").classList.add("hidden");
    pendingFood = null;
  }

  // ---------- New food ----------
  function handleNewFood(event) {
    event.preventDefault();
    const num = (id) => {
      const v = parseFloat($(id).value);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    };
    const food = {
      id: `custom-${Date.now()}`,
      name: $("nf-name").value.trim(),
      thai: $("nf-thai").value.trim(),
      cat: "My foods",
      serving: $("nf-serving").value.trim(),
      kcal: num("nf-kcal"),
      p: num("nf-p"),
      c: num("nf-c"),
      f: num("nf-f"),
      custom: true,
    };
    if (!food.name || !food.serving) return;

    customFoods.unshift(food);
    save(LS.custom, customFoods);
    event.target.reset();
    $("nf-suggestions").classList.add("hidden");
    closeFoodModal();
    addEntry(activeMeal, food, 1);
  }

  // ---------- Goal modal ----------
  function openGoalModal() {
    $("goal-input").value = goal;
    $("goal-overlay").classList.remove("hidden");
    $("goal-input").focus();
  }
  function closeGoalModal() {
    $("goal-overlay").classList.add("hidden");
  }
  function saveGoal() {
    const v = parseInt($("goal-input").value, 10);
    if (Number.isFinite(v) && v >= 800 && v <= 6000) {
      goal = v;
      save(LS.goal, goal);
      closeGoalModal();
      render();
      toast(`Daily goal set to ${goal.toLocaleString()} kcal`);
    } else {
      toast("Please enter a goal between 800 and 6,000 kcal");
    }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // ---------- Events ----------
  $("date-prev").addEventListener("click", () => {
    const d = parseKey(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = dateKey(d);
    render();
  });
  $("date-next").addEventListener("click", () => {
    const d = parseKey(currentDate);
    d.setDate(d.getDate() + 1);
    const next = dateKey(d);
    if (next <= todayKey()) {
      currentDate = next;
      render();
    }
  });
  $("date-label").addEventListener("click", () => {
    currentDate = todayKey();
    render();
  });

  $("btn-goal").addEventListener("click", openGoalModal);
  $("btn-goal-inline").addEventListener("click", openGoalModal);
  $("goal-close").addEventListener("click", closeGoalModal);
  $("goal-save").addEventListener("click", saveGoal);
  $("goal-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveGoal();
  });
  document.querySelectorAll(".goal-presets .chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      $("goal-input").value = chip.dataset.goal;
    })
  );

  $("modal-close").addEventListener("click", closeFoodModal);
  $("food-search").addEventListener("input", renderFoodList);
  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab))
  );
  $("new-food-form").addEventListener("submit", handleNewFood);
  $("nf-name").addEventListener("input", renderNfSuggestions);
  $("nf-thai").addEventListener("input", renderNfSuggestions);

  $("qty-close").addEventListener("click", closeQtyModal);
  $("qty-minus").addEventListener("click", () => setQty(pendingQty - 0.1));
  $("qty-plus").addEventListener("click", () => setQty(pendingQty + 0.1));
  $("qty-input").addEventListener("input", () => {
    // Update the live kcal while typing without fighting the caret; normalize on blur
    const v = parseFloat($("qty-input").value);
    if (Number.isFinite(v) && v > 0) {
      pendingQty = Math.min(20, v);
      qtyKcalReadout();
    }
  });
  $("qty-input").addEventListener("blur", () => setQty(pendingQty));
  $("qty-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("qty-add").click();
    }
  });
  $("qty-add").addEventListener("click", () => {
    if (!pendingFood) return;
    const food = pendingFood;
    const qty = Math.min(20, Math.max(0.1, Math.round(pendingQty * 10) / 10));
    closeQtyModal();
    closeFoodModal();
    addEntry(activeMeal, food, qty);
  });

  // Close modals when clicking the dimmed backdrop
  for (const id of ["modal-overlay", "qty-overlay", "goal-overlay"]) {
    $(id).addEventListener("click", (e) => {
      if (e.target.id === id) $(id).classList.add("hidden");
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeQtyModal();
      closeFoodModal();
      closeGoalModal();
    }
  });

  // Rotate the encouragement on tap
  $("cheer-card").addEventListener("click", () => {
    cheerIndex++;
    renderSummary();
  });

  // If the app is left open past midnight, follow the new day
  setInterval(() => {
    const now = todayKey();
    if (currentDate !== now && $("date-label").textContent === "Today") {
      currentDate = now;
      render();
    }
  }, 60 * 1000);

  renderNfTemplates();
  render();
})();
