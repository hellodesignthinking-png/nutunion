import { transform } from "esbuild";

/**
 * Compile a single-file TSX source (defining `function ThreadComponent(...)`)
 * into a self-contained HTML page that:
 *   1. Loads React + ReactDOM UMD from a CDN
 *   2. Inlines the transpiled component
 *   3. Reads installation props from window.postMessage('thread-init')
 *   4. Mounts <ThreadComponent /> into #root
 *
 * Returned HTML is meant to be served from a sandboxed origin and embedded in
 * an `<iframe sandbox="allow-scripts">` (no allow-same-origin).
 *
 * FUTURE WORK — migrate to @vercel/sandbox:
 *   - Spin up a Firecracker microVM via Sandbox.create()
 *   - sandbox.writeFiles([{ path: "App.tsx", content: source }])
 *   - sandbox.runCommand({ cmd: "npm", args: ["run", "build"] })
 *   - return sandbox.domain instead of inlining
 *   - Adds true process-level isolation; the current iframe-only approach
 *     relies entirely on browser sandboxing.
 */

const REACT_VERSION = "18.3.1";

export async function compileTsxToHtml(
  source: string,
  opts: { installationId?: string; parentOrigin?: string } = {},
): Promise<string> {
  // esbuild transforms TSX -> JS; it does NOT run user code.
  const { code } = await transform(source, {
    loader: "tsx",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "es2020",
    format: "iife",
    globalName: "__ThreadModule",
  });

  // The transformed code defines a top-level `function ThreadComponent`.
  // Wrap in a small bootstrapper that exposes it as a window global.
  const bootstrap = `
(function(){
  ${code}
  // After IIFE eval, ThreadComponent should be in scope via hoisting in the
  // outer evaluator. To be safe, also evaluate via globalThis.
  try {
    if (typeof ThreadComponent === 'function') {
      window.ThreadComponent = ThreadComponent;
    }
  } catch (e) { /* ignore */ }
})();
`;

  // We need a different strategy — the IIFE wrapper means ThreadComponent isn't
  // visible to outer scope. Instead, run the transformed code directly at
  // global scope (it has no imports/exports), then ThreadComponent is hoisted.
  const globalEval = `
${code}
try { window.ThreadComponent = ThreadComponent; } catch (e) {}
`;

  const installationIdJson = JSON.stringify(opts.installationId || null);
  // Parent origin must be passed in by the route handler — when sandbox=allow-scripts (no
  // allow-same-origin) the iframe has an opaque origin and cannot reliably read window.parent's
  // origin itself, so we inject it server-side and use it as the postMessage target.
  const parentOriginJson = JSON.stringify(opts.parentOrigin || "");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Thread Preview</title>
<script src="https://unpkg.com/react@${REACT_VERSION}/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@${REACT_VERSION}/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  html,body,#root { margin:0; padding:0; min-height:100vh; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif; background:#fff; color:#0D0F14; }
  .err { padding:16px; border:3px solid #c00; background:#fee; font-family:monospace; white-space:pre-wrap; }
</style>
</head>
<body>
<div id="root"></div>
<script>
window.__INSTALLATION_ID__ = ${installationIdJson};
window.__INSTALLATION_PROPS__ = null;
window.__CURRENT_USER_ID__ = null;
window.__CAN_EDIT__ = false;
window.__PARENT_ORIGIN__ = ${parentOriginJson};

// Listen for parent postMessage to receive installation props
window.addEventListener('message', function(e) {
  // Only accept messages that came from our actual parent window. Without this, any iframe
  // sibling or popup can forge thread-init and inject impersonated currentUserId/canEdit.
  if (e.source !== window.parent) return;
  // Verify origin matches the server-injected expected parent. Empty string (preview/standalone)
  // means we couldn't determine the parent; in that mode only same-origin parents are allowed
  // anyway because the iframe is loaded from /api routes.
  if (window.__PARENT_ORIGIN__ && e.origin !== window.__PARENT_ORIGIN__) return;
  if (e.data && e.data.type === 'thread-init') {
    window.__INSTALLATION_PROPS__ = e.data.installation || null;
    window.__CURRENT_USER_ID__ = e.data.currentUserId || null;
    window.__CAN_EDIT__ = !!e.data.canEdit;
    mount();
  } else if (e.data && e.data.type === 'thread-resize-request') {
    notifyHeight();
  }
});

function postToParent(msg) {
  try {
    // If we have a known parent origin, target it explicitly so the message isn't delivered
    // to a different origin if the iframe ends up reparented.
    var target = window.__PARENT_ORIGIN__ || '*';
    window.parent.postMessage(msg, target);
  } catch (e) {}
}

function notifyHeight() {
  var h = document.documentElement.scrollHeight;
  postToParent({ type: 'thread-height', height: h });
}

function mount() {
  try {
    var root = ReactDOM.createRoot(document.getElementById('root'));
    var props = {
      installation: window.__INSTALLATION_PROPS__ || { id: null, target_type: 'preview', target_id: null, config: {} },
      currentUserId: window.__CURRENT_USER_ID__,
      canEdit: window.__CAN_EDIT__,
    };
    root.render(React.createElement(window.ThreadComponent, props));
    setTimeout(notifyHeight, 100);
    setTimeout(notifyHeight, 500);
  } catch (err) {
    var el = document.getElementById('root');
    el.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'err';
    d.textContent = 'Render error: ' + (err && err.stack ? err.stack : String(err));
    el.appendChild(d);
  }
}

window.addEventListener('error', function(ev) {
  var el = document.getElementById('root');
  if (el && !el.children.length) {
    var d = document.createElement('div');
    d.className = 'err';
    d.textContent = 'Script error: ' + ev.message;
    el.appendChild(d);
  }
});

// Notify parent we're ready to receive props
postToParent({ type: 'thread-ready' });

// Resize observer
var ro = new ResizeObserver(function(){ notifyHeight(); });
ro.observe(document.documentElement);
</script>
<script>
try {
${globalEval}
  // Mount immediately if no parent will post init (standalone preview)
  if (!window.__INSTALLATION_PROPS__) {
    setTimeout(function(){
      if (!window.__INSTALLATION_PROPS__) mount();
    }, 200);
  }
} catch (err) {
  var el = document.getElementById('root');
  var d = document.createElement('div');
  d.className = 'err';
  d.textContent = 'Compile/eval error: ' + (err && err.stack ? err.stack : String(err));
  el.appendChild(d);
}
</script>
</body>
</html>`;
}
