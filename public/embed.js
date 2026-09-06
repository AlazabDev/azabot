/*!
 * عزبوت — كود تضمين الشات بوت في أي موقع.
 * الاستخدام:
 *   <script src="https://azabot.lovable.app/embed.js" defer></script>
 * خيارات إضافية على وسم السكربت:
 *   data-position="right|left"   موضع الزر العائم (الافتراضي: right)
 *   data-z-index="999999"        ترتيب الطبقة
 */
(function () {
  if (window.__azabotEmbedLoaded) return;
  window.__azabotEmbedLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf("embed.js") !== -1) return all[i];
      }
      return null;
    })();

  var origin = script ? new URL(script.src, location.href).origin : location.origin;
  var position = (script && script.getAttribute("data-position")) || "right";
  var zIndex = (script && script.getAttribute("data-z-index")) || "2147483000";

  var CLOSED = { width: "132px", height: "150px" };
  var OPEN_DESKTOP = { width: "420px", height: "min(680px, 92vh)" };

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/embed";
  iframe.title = "عزبوت — المساعد الذكي";
  iframe.setAttribute("allow", "microphone; camera; clipboard-write; autoplay");
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.cssText = [
    "position:fixed",
    "bottom:0",
    position === "left" ? "left:0" : "right:0",
    "border:0",
    "background:transparent",
    "color-scheme:normal",
    "z-index:" + zIndex,
    "width:" + CLOSED.width,
    "height:" + CLOSED.height,
    "max-width:100vw",
    "transition:width .2s ease,height .2s ease",
  ].join(";");

  function isMobile() {
    return window.innerWidth < 520;
  }

  function apply(open) {
    if (!open) {
      iframe.style.width = CLOSED.width;
      iframe.style.height = CLOSED.height;
      return;
    }
    if (isMobile()) {
      iframe.style.width = "100vw";
      iframe.style.height = "100dvh";
    } else {
      iframe.style.width = OPEN_DESKTOP.width;
      iframe.style.height = OPEN_DESKTOP.height;
    }
  }

  var isOpen = false;
  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.source !== "azabot") return;
    if (data.type === "open") isOpen = true;
    else if (data.type === "close") isOpen = false;
    else if (data.type !== "ready") return;
    apply(isOpen);
  });

  window.addEventListener("resize", function () {
    apply(isOpen);
  });

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
