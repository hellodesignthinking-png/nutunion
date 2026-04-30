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
  opts: { installationId?: string } = {},
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

// Listen for parent postMessage to receive installation props
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'thread-init') {
    window.__INSTALLATION_PROPS__ = e.data.installation || null;
    window.__CURRENT_USER_ID__ = e.data.currentUserId || null;
    window.__CAN_EDIT__ = !!e.data.canEdit;
    mount();
  } else if (e.data && e.data.type === 'thread-resize-request') {
    notifyHeight();
  }
});

function notifyHeight() {
  try {
    var h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'thread-height', height: h }, '*');
  } catch (e) {}
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
try { window.parent.postMessage({ type: 'thread-ready' }, '*'); } catch (e) {}

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
