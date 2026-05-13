import os
import time
from flask import Flask, render_template, request, jsonify
import yfinance as yf

app = Flask(__name__)

_price_cache = {}
CACHE_TTL = 60


def _normalize_symbol(code: str, market: str) -> str:
    code = (code or "").strip().upper()
    if not code:
        return ""
    if market == "jp" and not code.endswith(".T"):
        return f"{code}.T"
    return code


def _fetch_price(symbol: str):
    now = time.time()
    cached = _price_cache.get(symbol)
    if cached and now - cached["ts"] < CACHE_TTL:
        return cached["price"], cached["currency"]

    ticker = yf.Ticker(symbol)
    price = None
    currency = None

    try:
        fast = ticker.fast_info
        price = fast.get("last_price") if hasattr(fast, "get") else getattr(fast, "last_price", None)
        currency = fast.get("currency") if hasattr(fast, "get") else getattr(fast, "currency", None)
    except Exception:
        price = None

    if price is None:
        try:
            hist = ticker.history(period="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
        except Exception:
            price = None

    if price is not None:
        price = float(price)
        _price_cache[symbol] = {"price": price, "currency": currency, "ts": now}

    return price, currency


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prices", methods=["POST"])
def get_prices():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items", [])

    results = []
    for item in items:
        code = item.get("code", "")
        market = item.get("market", "jp")
        symbol = _normalize_symbol(code, market)
        price = None
        currency = None
        error = None

        if not symbol:
            error = "コードが空です"
        else:
            try:
                price, currency = _fetch_price(symbol)
                if price is None:
                    error = "価格を取得できませんでした"
            except Exception as exc:
                error = str(exc)

        results.append({
            "code": code,
            "market": market,
            "symbol": symbol,
            "price": price,
            "currency": currency,
            "error": error,
        })

    fx_price, _ = _fetch_price("JPY=X")
    fx = {"symbol": "JPY=X", "rate": fx_price, "error": None if fx_price else "為替レートを取得できませんでした"}

    return jsonify({"results": results, "fx": fx})


@app.route("/api/fx", methods=["GET"])
def get_fx():
    fx_price, _ = _fetch_price("JPY=X")
    return jsonify({
        "symbol": "JPY=X",
        "rate": fx_price,
        "error": None if fx_price else "為替レートを取得できませんでした",
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
