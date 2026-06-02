/**
 * Protein House — AI Stack Builder embed.
 *
 * Drop this into the Shopify theme to add the floating advisor to every page.
 * In Shopify admin: Online Store → Themes → Edit code → theme.liquid, add this
 * before </body> (replace HOST with your deployed advisor URL):
 *
 *   <script async src="https://YOUR-ADVISOR.vercel.app/embed.js"
 *           data-host="https://YOUR-ADVISOR.vercel.app"></script>
 *
 * It injects a launcher button + an iframe pointing at {host}/widget. The
 * "Add all to cart" button inside opens the real Shopify cart in a new tab.
 */
(function () {
  var script = document.currentScript;
  var HOST = (script && script.getAttribute("data-host")) || "";
  if (!HOST) {
    HOST = script ? script.src.replace(/\/embed\.js.*$/, "") : "";
  }

  if (document.getElementById("ph-advisor-launcher")) return; // guard against double-inject

  var open = false;

  // --- Launcher button ---
  var btn = document.createElement("button");
  btn.id = "ph-advisor-launcher";
  btn.setAttribute("aria-label", "Build my supplement stack");
  btn.innerHTML = "💪 Build my stack";
  btn.style.cssText = [
    "position:fixed", "bottom:16px", "right:16px", "z-index:2147483000",
    "background:#18181b", "color:#fff", "border:none", "cursor:pointer",
    "font:700 14px/1 system-ui,-apple-system,sans-serif", "padding:14px 20px",
    "border-radius:999px", "box-shadow:0 10px 30px rgba(0,0,0,.25)",
  ].join(";");

  // --- Iframe panel ---
  var frame = document.createElement("iframe");
  frame.id = "ph-advisor-frame";
  frame.title = "Protein House Stack Builder";
  frame.src = HOST + "/widget";
  frame.allow = "clipboard-write";
  frame.style.cssText = [
    "position:fixed", "bottom:84px", "right:16px", "z-index:2147483000",
    "width:460px", "max-width:calc(100vw - 32px)", "height:720px",
    "max-height:88vh", "border:none", "border-radius:24px",
    "box-shadow:0 20px 60px rgba(0,0,0,.3)", "display:none", "background:#fff",
  ].join(";");

  function render() {
    frame.style.display = open ? "block" : "none";
    btn.innerHTML = open ? "Close" : "💪 Build my stack";
  }
  btn.addEventListener("click", function () { open = !open; render(); });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
