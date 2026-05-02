/*!
 * AzaBot ConvAI Embed v1.0
 * Usage:
 *   <azabot-convai agent-id="azabot_default"></azabot-convai>
 *   <script src="https://YOUR_DOMAIN/embed/azabot-convai.js" async></script>
 *
 * Optional attributes:
 *   data-position="left|right"   (default: right)
 *   data-color="#FFB800"         (overrides bot primary color)
 *   data-api="https://..."       (override Supabase functions origin)
 *   data-key="ANON_KEY"          (override anon key)
 */
(function () {
  "use strict";
  if (window.__AZABOT_CONVAI__) return;
  window.__AZABOT_CONVAI__ = true;

  // ── Resolve API origin & key from script tag or defaults ───
  var thisScript = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  var DEFAULT_API = "https://daraqtdmiwdszczwticd.supabase.co";
  var DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcmFxdGRtaXdkc3pjend0aWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjkxMDQsImV4cCI6MjA5MjIwNTEwNH0.4RR-lXA2LO9LQTiCHi5fwAKuKhzjhiLDnOUqp2xrUxs";

  var API_ORIGIN = (thisScript && thisScript.getAttribute("data-api")) || DEFAULT_API;
  var API_KEY = (thisScript && thisScript.getAttribute("data-key")) || DEFAULT_KEY;

  // ── Web Component ─────────────────────────────────────────
  class AzabotConvai extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._open = false;
      this._busy = false;
      this._history = [];
      this._sessionId = this._getSession();
      this._settings = {
        bot_name: "AzaBot",
        primary_color: this.getAttribute("data-color") || "#FFB800",
        welcome_message: "مرحباً! كيف يمكنني مساعدتك؟",
        quick_replies: [],
        header_subtitle: "متصل الآن",
        position: this.getAttribute("data-position") || "right",
      };
    }

    static get observedAttributes() { return ["agent-id", "data-position", "data-color"]; }

    connectedCallback() {
      this._render();
      this._loadSettings();
    }

    _getSession() {
      var k = "azabot_convai_sid";
      var s = localStorage.getItem(k);
      if (!s) { s = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, s); }
      return s;
    }

    async _loadSettings() {
      try {
        var r = await fetch(API_ORIGIN + "/functions/v1/bot-public-settings", {
          headers: { "apikey": API_KEY, "Authorization": "Bearer " + API_KEY },
        });
        if (r.ok) {
          var data = await r.json();
          Object.assign(this._settings, data || {});
          if (this.getAttribute("data-color")) this._settings.primary_color = this.getAttribute("data-color");
          if (this.getAttribute("data-position")) this._settings.position = this.getAttribute("data-position");
          this._render();
        }
      } catch (e) { console.warn("[AzaBot] settings load failed", e); }
    }

    _render() {
      var s = this._settings;
      var isLeft = s.position === "left";
      var color = s.primary_color || "#FFB800";
      this.shadowRoot.innerHTML = `
        <style>
          :host { all: initial; font-family: "Tajawal","Segoe UI",system-ui,sans-serif; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .fab {
            position: fixed; ${isLeft ? "left" : "right"}: 20px; bottom: 20px;
            width: 60px; height: 60px; border-radius: 50%;
            background: ${color}; color: #1a1a1a; border: none; cursor: pointer;
            box-shadow: 0 10px 30px -8px ${color}aa, 0 4px 12px rgba(0,0,0,.15);
            display: flex; align-items: center; justify-content: center;
            transition: transform .2s, box-shadow .2s; z-index: 2147483646;
          }
          .fab:hover { transform: scale(1.08); }
          .fab.hidden { display: none; }
          .badge { position: absolute; top: -4px; ${isLeft ? "right" : "left"}: -4px;
            background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px; border-radius: 9px; padding: 0 5px;
            display: ${this._unread ? "flex" : "none"}; align-items: center; justify-content: center; }
          .win {
            position: fixed; ${isLeft ? "left" : "right"}: 20px; bottom: 20px;
            width: 380px; max-width: calc(100vw - 24px);
            height: 600px; max-height: calc(100svh - 32px);
            background: #fff; border-radius: 20px; overflow: hidden;
            box-shadow: 0 24px 60px -12px rgba(0,0,0,.25);
            display: none; flex-direction: column; z-index: 2147483647;
            animation: slide .25s cubic-bezier(.4,0,.2,1) both;
            direction: rtl;
          }
          .win.open { display: flex; }
          @keyframes slide { from { opacity:0; transform:translateY(16px) scale(.96); } to { opacity:1; transform:none; } }
          .hdr { padding: 14px 16px; background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: #1a1a1a;
            display: flex; align-items: center; gap: 10px; }
          .hdr-info { flex: 1; min-width: 0; }
          .hdr-name { font-weight: 700; font-size: 15px; }
          .hdr-sub { font-size: 11px; opacity: .75; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
          .dot { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 0 #16a34a55; animation: pulse 2s infinite; }
          @keyframes pulse { 0%{box-shadow:0 0 0 0 #16a34a55} 70%{box-shadow:0 0 0 8px transparent} 100%{box-shadow:0 0 0 0 transparent} }
          .x { background: rgba(0,0,0,.1); border: none; cursor: pointer; width: 30px; height: 30px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center; color: inherit; }
          .x:hover { background: rgba(0,0,0,.18); }
          .body { flex: 1; overflow-y: auto; padding: 16px; background: #f9fafb;
            display: flex; flex-direction: column; gap: 10px; }
          .body::-webkit-scrollbar { width: 6px; }
          .body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
          .welcome { text-align: center; padding: 20px 0; }
          .welcome-icon { width: 56px; height: 56px; border-radius: 16px; background: ${color}22;
            display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 10px; }
          .welcome h4 { font-size: 16px; color: #111827; margin-bottom: 4px; }
          .welcome p { font-size: 13px; color: #6b7280; }
          .qr { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; justify-content: center; }
          .qr button { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 99px; padding: 7px 12px;
            font-size: 12px; cursor: pointer; color: #374151; font-family: inherit; transition: all .15s; }
          .qr button:hover { border-color: ${color}; color: ${color}; background: ${color}0d; }
          .msg { max-width: 82%; padding: 10px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.6;
            word-break: break-word; animation: in .2s ease both; }
          @keyframes in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
          .msg.user { align-self: flex-start; background: #1f2937; color: #fff; border-radius: 16px 16px 16px 4px; }
          .msg.bot { align-self: flex-end; background: #fff; color: #111827; border: 1px solid #e5e7eb;
            border-radius: 16px 16px 4px 16px; }
          .typing { display: inline-flex; gap: 4px; padding: 12px 14px; background: #fff; border: 1px solid #e5e7eb;
            border-radius: 16px 16px 4px 16px; align-self: flex-end; }
          .typing span { width: 6px; height: 6px; border-radius: 50%; background: ${color};
            animation: bounce 1.2s infinite; }
          .typing span:nth-child(2){animation-delay:.15s} .typing span:nth-child(3){animation-delay:.3s}
          @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
          .ftr { padding: 10px 12px; background: #fff; border-top: 1px solid #f0f0f0; }
          .input-row { display: flex; gap: 8px; align-items: flex-end; }
          textarea { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 10px 12px;
            font-size: 13.5px; background: #f9fafb; resize: none; min-height: 40px; max-height: 100px;
            outline: none; font-family: inherit; color: #111827; direction: rtl; transition: border-color .15s; }
          textarea:focus { border-color: ${color}; background: #fff; }
          .send { width: 40px; height: 40px; border-radius: 12px; border: none; background: ${color}; color: #1a1a1a;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .1s; }
          .send:hover:not(:disabled) { transform: scale(1.06); }
          .send:disabled { opacity: .4; cursor: default; }
          .brand { text-align: center; font-size: 10.5px; color: #9ca3af; margin-top: 6px; }
          .brand a { color: ${color}; text-decoration: none; font-weight: 600; }
        </style>

        <button class="fab ${this._open ? "hidden" : ""}" part="fab" aria-label="فتح الدردشة">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.74.5 3.37 1.36 4.74L2 22l5.26-1.36C8.63 21.5 10.26 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 13H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V9h10v2z"/>
          </svg>
          <span class="badge">${this._unread || ""}</span>
        </button>

        <div class="win ${this._open ? "open" : ""}" role="dialog" aria-label="نافذة دردشة">
          <div class="hdr">
            <div class="hdr-info">
              <div class="hdr-name">${escape(s.bot_name)}</div>
              <div class="hdr-sub"><span class="dot"></span>${escape(s.header_subtitle || "متصل الآن")}</div>
            </div>
            <button class="x" id="close" aria-label="إغلاق">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="body" id="body">${this._renderMessages()}</div>
          <div class="ftr">
            <div class="input-row">
              <textarea id="input" placeholder="اكتب رسالتك…" rows="1"></textarea>
              <button class="send" id="send" aria-label="إرسال">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
            <div class="brand">مدعوم بـ <a href="https://alazab.com" target="_blank" rel="noopener">AzaBot</a></div>
          </div>
        </div>
      `;
      this._wire();
    }

    _renderMessages() {
      var s = this._settings;
      if (this._history.length === 0) {
        var qr = (s.quick_replies || []).slice(0, 4).map(function (q) {
          return '<button data-q="' + escape(q) + '">' + escape(q) + "</button>";
        }).join("");
        return `
          <div class="welcome">
            <div class="welcome-icon">💬</div>
            <h4>${escape(s.welcome_message || "مرحباً!")}</h4>
            <p>${escape(s.header_subtitle || "")}</p>
            <div class="qr">${qr}</div>
          </div>`;
      }
      return this._history.map(function (m) {
        return '<div class="msg ' + (m.role === "user" ? "user" : "bot") + '">' + escape(m.content) + "</div>";
      }).join("");
    }

    _wire() {
      var sr = this.shadowRoot;
      var self = this;
      var fab = sr.querySelector(".fab");
      var closeBtn = sr.getElementById("close");
      var sendBtn = sr.getElementById("send");
      var input = sr.getElementById("input");

      fab.addEventListener("click", function () { self._toggle(true); });
      closeBtn.addEventListener("click", function () { self._toggle(false); });
      sendBtn.addEventListener("click", function () { self._send(input.value); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); self._send(input.value); }
      });
      input.addEventListener("input", function () {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 100) + "px";
      });
      sr.querySelectorAll(".qr button").forEach(function (b) {
        b.addEventListener("click", function () { self._send(b.getAttribute("data-q")); });
      });
    }

    _toggle(open) {
      this._open = open;
      if (open) this._unread = 0;
      this._render();
      if (open) {
        var inp = this.shadowRoot.getElementById("input");
        if (inp) setTimeout(function () { inp.focus(); }, 100);
      }
    }

    async _send(text) {
      text = (text || "").trim();
      if (!text || this._busy) return;
      this._history.push({ role: "user", content: text });
      this._busy = true;
      this._appendAndScroll();
      this._showTyping();
      try {
        var resp = await fetch(API_ORIGIN + "/functions/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": API_KEY,
            "Authorization": "Bearer " + API_KEY,
          },
          body: JSON.stringify({
            messages: this._history.slice(-20),
            session_id: this._sessionId,
          }),
        });
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        var reader = resp.body.getReader();
        var dec = new TextDecoder();
        var buf = "", acc = "";
        this._history.push({ role: "assistant", content: "" });
        this._removeTyping();
        while (true) {
          var r = await reader.read();
          if (r.done) break;
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop() || "";
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith("data:")) continue;
            var data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              var j = JSON.parse(data);
              var delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (delta) {
                acc += delta;
                this._history[this._history.length - 1].content = acc;
                this._updateLastBot(acc);
              }
            } catch (_) { /* ignore */ }
          }
        }
        if (!acc) {
          this._history[this._history.length - 1].content = "…";
          this._updateLastBot("…");
        }
        if (!this._open) { this._unread = (this._unread || 0) + 1; this._render(); }
      } catch (e) {
        this._removeTyping();
        this._history.push({ role: "assistant", content: "⚠️ تعذر الاتصال بالخادم" });
        this._appendAndScroll();
      } finally {
        this._busy = false;
        var inp = this.shadowRoot.getElementById("input");
        if (inp) { inp.value = ""; inp.style.height = "auto"; }
      }
    }

    _appendAndScroll() {
      var body = this.shadowRoot.getElementById("body");
      if (!body) return;
      body.innerHTML = this._renderMessages();
      body.scrollTop = body.scrollHeight;
      var sr = this.shadowRoot;
      var self = this;
      sr.querySelectorAll(".qr button").forEach(function (b) {
        b.addEventListener("click", function () { self._send(b.getAttribute("data-q")); });
      });
    }

    _updateLastBot(text) {
      var body = this.shadowRoot.getElementById("body");
      if (!body) return;
      var msgs = body.querySelectorAll(".msg.bot");
      var last = msgs[msgs.length - 1];
      if (last) { last.textContent = text; }
      else { this._appendAndScroll(); }
      body.scrollTop = body.scrollHeight;
    }

    _showTyping() {
      var body = this.shadowRoot.getElementById("body");
      if (!body) return;
      // remove welcome on first message
      var w = body.querySelector(".welcome");
      if (w) w.remove();
      // append user message
      var um = document.createElement("div");
      um.className = "msg user";
      um.textContent = this._history[this._history.length - 1].content;
      body.appendChild(um);
      var t = document.createElement("div");
      t.className = "typing"; t.id = "typing";
      t.innerHTML = "<span></span><span></span><span></span>";
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
    }

    _removeTyping() {
      var t = this.shadowRoot.getElementById("typing");
      if (t) t.remove();
    }
  }

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  if (!customElements.get("azabot-convai")) {
    customElements.define("azabot-convai", AzabotConvai);
  }

  // Auto-inject if no custom element on page (fallback for plain script include)
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.querySelector("azabot-convai")) {
      var el = document.createElement("azabot-convai");
      document.body.appendChild(el);
    }
  });
})();
