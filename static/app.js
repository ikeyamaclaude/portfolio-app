(() => {
  "use strict";

  const STORAGE_KEY = "portfolio.brokers.v1";
  const FX_CACHE_KEY = "portfolio.fxRate.cache.v1";
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

  /** @type {{id:string,name:string,stocks:Array}[]} */
  let brokers = loadBrokers();
  let prices = {};
  let fxRate = Number(localStorage.getItem(FX_CACHE_KEY)) || null;

  const brokersEl = document.getElementById("brokers");
  const totalCostEl = document.getElementById("total-cost");
  const totalValueEl = document.getElementById("total-value");
  const totalPlEl = document.getElementById("total-pl");
  const totalPlRateEl = document.getElementById("total-pl-rate");
  const lastUpdatedEl = document.getElementById("last-updated");
  const fxRateDisplay = document.getElementById("fx-rate-display");
  const fxRateMeta = document.getElementById("fx-rate-meta");

  // ===== Storage =====
  function loadBrokers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (e) {
      console.error("loadBrokers failed", e);
      return [];
    }
  }

  function saveBrokers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brokers));
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ===== Formatting =====
  const yenFmt = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const numFmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

  function formatYen(n) {
    if (!isFinite(n)) return "—";
    return yenFmt.format(Math.round(n));
  }

  function formatPrice(n, market) {
    if (n == null || !isFinite(n)) return "—";
    if (market === "us") return "$" + numFmt.format(n);
    return "¥" + numFmt.format(n);
  }

  function plClass(n) {
    if (!isFinite(n) || n === 0) return "neutral";
    return n > 0 ? "profit" : "loss";
  }

  function signed(n) {
    if (!isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + formatYen(n);
  }

  function signedPct(n) {
    if (!isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  // ===== Calculation =====
  function priceKey(market, code) {
    return `${market}:${code.toUpperCase()}`;
  }

  function getCurrentPrice(stock) {
    const entry = prices[priceKey(stock.market, stock.code)];
    return entry ? entry.price : null;
  }

  function getPriceError(stock) {
    const entry = prices[priceKey(stock.market, stock.code)];
    return entry ? entry.error : null;
  }

  function calcStock(stock) {
    const price = getCurrentPrice(stock);
    const shares = Number(stock.shares) || 0;
    const cost = Number(stock.cost) || 0;
    const fx = stock.market === "us" ? fxRate : 1;
    const fxReady = stock.market !== "us" || (fxRate != null && fxRate > 0);
    const costJpy = fxReady ? cost * shares * fx : null;
    const valueJpy = fxReady && price != null ? price * shares * fx : null;
    const pl = costJpy != null && valueJpy != null ? valueJpy - costJpy : null;
    const plRate = pl != null && costJpy > 0 ? (pl / costJpy) * 100 : null;
    return { price, shares, cost, costJpy, valueJpy, pl, plRate };
  }

  function calcBroker(broker) {
    let costJpy = 0;
    let valueJpy = 0;
    let hasPrice = false;
    for (const s of broker.stocks) {
      const c = calcStock(s);
      if (c.costJpy != null) costJpy += c.costJpy;
      if (c.valueJpy != null) {
        valueJpy += c.valueJpy;
        hasPrice = true;
      }
    }
    const pl = hasPrice ? valueJpy - costJpy : null;
    const plRate = pl != null && costJpy > 0 ? (pl / costJpy) * 100 : null;
    return { costJpy, valueJpy: hasPrice ? valueJpy : null, pl, plRate };
  }

  // ===== Render =====
  function render() {
    brokersEl.innerHTML = "";

    if (brokers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "broker-card empty";
      empty.textContent = "「+ 証券会社を追加」から始めましょう。";
      brokersEl.appendChild(empty);
    }

    let totalCost = 0;
    let totalValue = 0;
    let anyPrice = false;

    for (const broker of brokers) {
      const card = renderBroker(broker);
      brokersEl.appendChild(card);

      const agg = calcBroker(broker);
      totalCost += agg.costJpy;
      if (agg.valueJpy != null) {
        totalValue += agg.valueJpy;
        anyPrice = true;
      }
    }

    totalCostEl.textContent = formatYen(totalCost);
    if (anyPrice) {
      totalValueEl.textContent = formatYen(totalValue);
      const pl = totalValue - totalCost;
      const plRate = totalCost > 0 ? (pl / totalCost) * 100 : 0;
      totalPlEl.textContent = signed(pl);
      totalPlEl.className = "value " + plClass(pl);
      totalPlRateEl.textContent = signedPct(plRate);
      totalPlRateEl.className = "value " + plClass(pl);
    } else {
      totalValueEl.textContent = "—";
      totalPlEl.textContent = "—";
      totalPlEl.className = "value neutral";
      totalPlRateEl.textContent = "—";
      totalPlRateEl.className = "value neutral";
    }
  }

  function renderBroker(broker) {
    const card = document.createElement("div");
    card.className = "broker-card";

    const agg = calcBroker(broker);

    const header = document.createElement("div");
    header.className = "broker-header";
    header.innerHTML = `
      <div class="broker-title">${escapeHtml(broker.name)}</div>
      <div class="broker-stats">
        <span>取得: <strong>${formatYen(agg.costJpy)}</strong></span>
        <span>評価額: <strong>${agg.valueJpy != null ? formatYen(agg.valueJpy) : "—"}</strong></span>
        <span class="${plClass(agg.pl)}">損益: <strong>${agg.pl != null ? signed(agg.pl) : "—"}</strong></span>
        <span class="${plClass(agg.pl)}">損益率: <strong>${agg.plRate != null ? signedPct(agg.plRate) : "—"}</strong></span>
      </div>
      <div class="broker-actions">
        <button class="btn btn-small" data-act="add-stock">+ 銘柄</button>
        <button class="btn btn-small" data-act="edit-broker">名称変更</button>
        <button class="btn btn-small btn-danger" data-act="delete-broker">削除</button>
      </div>
    `;
    card.appendChild(header);

    header.querySelector('[data-act="add-stock"]').addEventListener("click", () => openStockModal(broker.id, null));
    header.querySelector('[data-act="edit-broker"]').addEventListener("click", () => openBrokerModal(broker));
    header.querySelector('[data-act="delete-broker"]').addEventListener("click", () => deleteBroker(broker.id));

    if (broker.stocks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "銘柄がまだありません。「+ 銘柄」から追加してください。";
      card.appendChild(empty);
      return card;
    }

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>銘柄</th>
          <th>コード</th>
          <th>株数</th>
          <th>取得価格</th>
          <th>現在値</th>
          <th>取得金額</th>
          <th>評価額</th>
          <th>損益</th>
          <th>損益率</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    for (const stock of broker.stocks) {
      const c = calcStock(stock);
      const err = getPriceError(stock);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(stock.name)}</td>
        <td>
          <span class="tag ${stock.market === "us" ? "us" : ""}">${stock.market === "us" ? "米国" : "日本"}</span>
          ${escapeHtml(stock.code)}
          ${err ? `<div class="error-text">${escapeHtml(err)}</div>` : ""}
        </td>
        <td>${numFmt.format(c.shares)}</td>
        <td>${formatPrice(c.cost, stock.market)}</td>
        <td>${formatPrice(c.price, stock.market)}</td>
        <td>${c.costJpy != null ? formatYen(c.costJpy) : "—"}</td>
        <td>${c.valueJpy != null ? formatYen(c.valueJpy) : "—"}</td>
        <td class="${plClass(c.pl)}">${c.pl != null ? signed(c.pl) : "—"}</td>
        <td class="${plClass(c.pl)}">${c.plRate != null ? signedPct(c.plRate) : "—"}</td>
        <td>
          <button class="btn btn-small" data-act="edit-stock">編集</button>
          <button class="btn btn-small btn-danger" data-act="delete-stock">削除</button>
        </td>
      `;
      tr.querySelector('[data-act="edit-stock"]').addEventListener("click", () => openStockModal(broker.id, stock.id));
      tr.querySelector('[data-act="delete-stock"]').addEventListener("click", () => deleteStock(broker.id, stock.id));
      tbody.appendChild(tr);
    }

    card.appendChild(table);
    return card;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ===== Broker CRUD =====
  const brokerModal = document.getElementById("broker-modal");
  const brokerForm = document.getElementById("broker-form");
  const brokerModalTitle = document.getElementById("broker-modal-title");
  let editingBrokerId = null;

  function openBrokerModal(broker) {
    editingBrokerId = broker ? broker.id : null;
    brokerModalTitle.textContent = broker ? "証券会社を編集" : "証券会社を追加";
    brokerForm.name.value = broker ? broker.name : "";
    brokerModal.classList.remove("hidden");
    brokerForm.name.focus();
  }

  function closeBrokerModal() {
    brokerModal.classList.add("hidden");
    editingBrokerId = null;
  }

  brokerForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = brokerForm.name.value.trim();
    if (!name) return;
    if (editingBrokerId) {
      const b = brokers.find(b => b.id === editingBrokerId);
      if (b) b.name = name;
    } else {
      brokers.push({ id: uid(), name, stocks: [] });
    }
    saveBrokers();
    closeBrokerModal();
    render();
  });

  brokerModal.querySelector('[data-action="cancel"]').addEventListener("click", closeBrokerModal);

  function deleteBroker(id) {
    const b = brokers.find(b => b.id === id);
    if (!b) return;
    if (!confirm(`「${b.name}」とその銘柄をすべて削除しますか？`)) return;
    brokers = brokers.filter(b => b.id !== id);
    saveBrokers();
    render();
  }

  document.getElementById("add-broker-btn").addEventListener("click", () => openBrokerModal(null));

  // ===== Stock CRUD =====
  const stockModal = document.getElementById("stock-modal");
  const stockForm = document.getElementById("stock-form");
  const stockModalTitle = document.getElementById("stock-modal-title");
  let editingContext = { brokerId: null, stockId: null };

  function openStockModal(brokerId, stockId) {
    editingContext = { brokerId, stockId };
    const broker = brokers.find(b => b.id === brokerId);
    if (!broker) return;
    const stock = stockId ? broker.stocks.find(s => s.id === stockId) : null;
    stockModalTitle.textContent = stock ? "銘柄を編集" : `銘柄を追加 - ${broker.name}`;
    stockForm.market.value = stock ? stock.market : "jp";
    stockForm.code.value = stock ? stock.code : "";
    stockForm.name.value = stock ? stock.name : "";
    stockForm.cost.value = stock ? stock.cost : "";
    stockForm.shares.value = stock ? stock.shares : "";
    stockModal.classList.remove("hidden");
    stockForm.code.focus();
  }

  function closeStockModal() {
    stockModal.classList.add("hidden");
    editingContext = { brokerId: null, stockId: null };
  }

  stockForm.addEventListener("submit", e => {
    e.preventDefault();
    const { brokerId, stockId } = editingContext;
    const broker = brokers.find(b => b.id === brokerId);
    if (!broker) return;
    const data = {
      market: stockForm.market.value,
      code: stockForm.code.value.trim().toUpperCase(),
      name: stockForm.name.value.trim(),
      cost: Number(stockForm.cost.value),
      shares: Number(stockForm.shares.value),
    };
    if (!data.code || !data.name) return;
    if (stockId) {
      const s = broker.stocks.find(s => s.id === stockId);
      if (s) Object.assign(s, data);
    } else {
      broker.stocks.push({ id: uid(), ...data });
    }
    saveBrokers();
    closeStockModal();
    render();
    fetchPrices();
  });

  stockModal.querySelector('[data-action="cancel"]').addEventListener("click", closeStockModal);

  function deleteStock(brokerId, stockId) {
    const broker = brokers.find(b => b.id === brokerId);
    if (!broker) return;
    const stock = broker.stocks.find(s => s.id === stockId);
    if (!stock) return;
    if (!confirm(`「${stock.name}」を削除しますか？`)) return;
    broker.stocks = broker.stocks.filter(s => s.id !== stockId);
    saveBrokers();
    render();
  }

  // ===== FX display =====
  function updateFxDisplay(meta) {
    fxRateDisplay.textContent = fxRate != null && fxRate > 0 ? numFmt.format(fxRate) : "—";
    fxRateMeta.textContent = meta || "";
  }

  function applyFx(fx) {
    if (fx && fx.rate && fx.rate > 0) {
      fxRate = Number(fx.rate);
      localStorage.setItem(FX_CACHE_KEY, String(fxRate));
      updateFxDisplay();
    } else if (fx && fx.error) {
      updateFxDisplay("(取得失敗)");
    }
  }

  // ===== Price fetch =====
  async function fetchPrices() {
    const items = [];
    const seen = new Set();
    for (const b of brokers) {
      for (const s of b.stocks) {
        const k = priceKey(s.market, s.code);
        if (seen.has(k)) continue;
        seen.add(k);
        items.push({ code: s.code, market: s.market });
      }
    }

    lastUpdatedEl.textContent = "更新中...";
    try {
      let data;
      if (items.length === 0) {
        const res = await fetch("/api/fx");
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = { results: [], fx: await res.json() };
      } else {
        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = await res.json();
      }
      for (const r of data.results) {
        prices[priceKey(r.market, r.code)] = { price: r.price, error: r.error };
      }
      applyFx(data.fx);
      const now = new Date();
      lastUpdatedEl.textContent = "最終更新: " + now.toLocaleTimeString("ja-JP");
      render();
    } catch (e) {
      console.error(e);
      lastUpdatedEl.textContent = "更新エラー";
    }
  }

  document.getElementById("refresh-btn").addEventListener("click", fetchPrices);

  // ===== Export / Import =====
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ brokers }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById("import-file");
  document.getElementById("import-btn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.brokers)) throw new Error("不正なファイル形式");
      if (!confirm("現在のデータを上書きしてインポートしますか？")) return;
      brokers = data.brokers;
      saveBrokers();
      render();
      fetchPrices();
    } catch (e) {
      alert("インポートに失敗しました: " + e.message);
    } finally {
      importFile.value = "";
    }
  });

  // ===== Init =====
  updateFxDisplay();
  render();
  fetchPrices();
  setInterval(fetchPrices, REFRESH_INTERVAL_MS);
})();
