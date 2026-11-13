// Requires a running WBS preview and an isolated Chromium instance with remote debugging.
// This test uses only demo state; it does not authenticate or mutate a live backend.
import fs from "node:fs";
const browserUrl = process.env.WBS_BROWSER_URL || "http://localhost:9222";
const appUrl = process.env.WBS_TEST_URL || "http://localhost:3000";
const downloadDir = `/tmp/wbs-downloads-${process.pid}`;
await fs.promises.mkdir(downloadDir, { recursive: true });
const target = await (
  await fetch(browserUrl + "/json/new?about:blank", { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const p = pending.get(message.id);
    if (p) {
      pending.delete(message.id);
      if (message.error) p.reject(message.error);
      else p.resolve(message.result);
    }
  } else if (message.method === "Runtime.exceptionThrown") {
    errors.push(
      message.params.exceptionDetails.exception?.description ||
        message.params.exceptionDetails.text,
    );
  } else if (
    message.method === "Log.entryAdded" &&
    message.params.entry.level === "error"
  ) {
    errors.push(message.params.entry.text);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result.value;
};
const wait = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(predicate)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Timed out: " + predicate);
};
const nav = async (path) => {
  await send("Page.navigate", { url: appUrl + path });
  await wait(
    'document.readyState === "complete" && !!document.querySelector("#root")?.textContent.trim()',
  );
  await new Promise((r) => setTimeout(r, 600));
};
const click = async (text) =>
  evaluate(
    `(()=>{const e=[...(document.querySelector('[role=dialog]') || document).querySelectorAll('button,a')].find(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('.tab-count,.nav-count,.planned-badge').forEach(n=>n.remove());return copy.textContent.trim()===${JSON.stringify(text)} || [...e.children].some(c=>c.tagName==='SPAN' && c.textContent.trim()===${JSON.stringify(text)});});if(!e)throw new Error('Missing control: '+${JSON.stringify(text)}); e.click(); return true})()`,
  );
const clickLabel = async (label) =>
  evaluate(
    `(()=>{const e=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');if(!e)throw new Error('Missing aria control '+${JSON.stringify(label)});e.click()})()`,
  );
const setField = async (selector, value) =>
  evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field '+${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
const screenshot = async (name) => {
  const r = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync("/tmp/" + name + ".png", Buffer.from(r.data, "base64"));
};
const assert = async (label, expression) => {
  try {
    await wait(expression);
  } catch {
    throw new Error("FAILED " + label);
  }
  console.log("PASS", label);
};
const downloaded = async (extension) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const file = (await fs.promises.readdir(downloadDir)).find((name) =>
      name.endsWith(extension),
    );
    if (file && (await fs.promises.stat(`${downloadDir}/${file}`)).size > 100)
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No completed ${extension} download.`);
};
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: downloadDir,
});
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await nav("/");
await wait('!!document.querySelector(".overview-page")');
await evaluate("document.fonts.ready.then(()=>true)");
await screenshot("wbs-overview");
console.log(
  "OVERVIEW",
  await evaluate('document.querySelector("main").innerText.slice(0,300)'),
);
await assert(
  "overview renders sample workspace",
  'document.querySelectorAll(".room-card").length === 3',
);
await evaluate(
  `document.querySelector(".room-card").dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,clientX:350,clientY:350}))`,
);
await assert(
  "room context menu opens",
  'document.querySelectorAll("[role=menu] button").length===7',
);
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Escape",
  code: "Escape",
});
await assert(
  "context menu dismisses with Escape",
  '!document.querySelector("[role=menu]")',
);
await click("New project");
await wait('!!document.querySelector("[role=dialog]")');
await setField("[role=dialog] input", "QA project");
await setField("[role=dialog] textarea", "Created by browser test");
await click("Create project");
await wait('!document.querySelector("[role=dialog]")');
await assert(
  "project creation updates overview",
  'document.querySelector("main").innerText.includes("QA project")',
);
await click("Projects");
await wait('!!document.querySelector(".project-collection")');
await setField('input[aria-label="Search projects"]', "QA project");
await assert(
  "project search filters locally",
  'document.querySelectorAll(".project-card").length===1',
);
await click("Open project");
await wait('!!document.querySelector(".project-detail-meta")');
await click("Create room");
await wait('!!document.querySelector("[role=dialog]")');
await setField("[role=dialog] input", "QA room");
await click("Create room");
await wait('!document.querySelector("[role=dialog]")');
await assert(
  "room creation updates project",
  'document.querySelector("main").innerText.includes("QA room")',
);
await evaluate('document.querySelector(".global-search").click()');
await wait('!!document.querySelector(".command-search")');
await setField(".command-search input", "Brand direction");
await assert(
  "global search categorizes results",
  'document.querySelectorAll(".search-results button").length===1 && document.querySelector(".search-results").innerText.includes("Room")',
);
await evaluate('document.querySelector(".search-results button").click()');
await wait('!!document.querySelector("canvas")');
await screenshot("wbs-canvas");
await assert(
  "Konva stage rendered",
  'document.querySelector("canvas").width>0',
);
if (!(await evaluate('!!document.querySelector(".canvas-layers")')))
  await clickLabel("Toggle layers");
await clickLabel("Rectangle (R)");
const stage = await evaluate(
  '(()=>{const r=document.querySelector(".canvas-stage-container").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}})()',
);
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: stage.x + 120,
  y: stage.y + 100,
  button: "left",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseMoved",
  x: stage.x + 250,
  y: stage.y + 190,
  button: "left",
  buttons: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: stage.x + 250,
  y: stage.y + 190,
  button: "left",
  clickCount: 1,
});
await assert(
  "pointer drawing creates a Konva object",
  'document.querySelectorAll(".canvas-layer-row").length===10',
);
await clickLabel("Select (V)");
await evaluate('document.querySelector(".canvas-layer-row button").click()');
await wait('!!document.querySelector(".inspector-two-col")');
await click("Duplicate");
await assert(
  "canvas duplicate adds actual object",
  'document.querySelectorAll(".canvas-layer-row").length===11',
);
await clickLabel("Undo (Ctrl/⌘ Z)");
await assert(
  "canvas undo restores objects",
  'document.querySelectorAll(".canvas-layer-row").length===10',
);
await clickLabel("Redo (Ctrl/⌘ Shift Z)");
await assert(
  "canvas redo restores duplicate",
  'document.querySelectorAll(".canvas-layer-row").length===11',
);
await evaluate(
  `document.querySelectorAll(".canvas-layer-row button[aria-pressed]")[0].click()`,
);
await wait(
  'document.querySelectorAll(".canvas-layer-row button[aria-pressed]")[0].getAttribute("aria-pressed")==="true"',
);
await evaluate(
  `document.querySelectorAll(".canvas-layer-row button[aria-pressed]")[1].dispatchEvent(new MouseEvent("click",{bubbles:true,shiftKey:true}))`,
);
await assert(
  "layers shift-click multi-selects",
  'document.querySelector(".canvas-inspector").innerText.includes("2 objects selected")',
);
await clickLabel("Align left");
await assert(
  "alignment keeps object count",
  'document.querySelectorAll(".canvas-layer-row").length===11',
);
await send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: stage.x + stage.width - 40,
  y: stage.y + stage.height - 40,
  button: "right",
  clickCount: 1,
});
await send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: stage.x + stage.width - 40,
  y: stage.y + stage.height - 40,
  button: "right",
  clickCount: 1,
});
await assert(
  "canvas context menu opens",
  '!!document.querySelector(".canvas-context-menu") && document.querySelector(".canvas-context-menu").innerText.includes("Fit to screen")',
);
await click("Fit to screen");
await assert(
  "fit to screen applies and closes menu",
  '!document.querySelector(".canvas-context-menu") && /^\\d+%$/.test(document.querySelector(".zoom-menu").innerText.trim())',
);
await click("PNG");
await downloaded(".png");
await click("PDF");
await downloaded(".pdf");
console.log("PASS preserved PNG and PDF exports produce actual downloads");
await click("Chat");
await wait('!!document.querySelector(".chat-workspace")');
await setField(
  'textarea[aria-label="Message"]',
  "Browser-tested local message",
);
await click("Send");
await assert(
  "chat send produces local message",
  'document.querySelector(".chat-timeline").innerText.includes("Browser-tested local message")',
);
await screenshot("wbs-chat");
await assert(
  "chat fits desktop viewport",
  "document.documentElement.scrollWidth <= innerWidth",
);
await evaluate(
  `Array.from(document.querySelectorAll('[aria-label="Edit message (demo only)"]')).at(-1).click()`,
);
await setField('textarea[aria-label="Message"]', "Edited local message");
await click("Save edit");
await assert(
  "demo message editing works",
  'document.querySelector(".chat-timeline").innerText.includes("Edited local message")',
);
await clickLabel("Pin message (demo only)");
await click("Pinned messages");
await assert(
  "pin filter works",
  'document.querySelectorAll(".chat-message").length===1',
);
await click("Team conversation");
await click("Canvas");
await wait(
  '!!document.querySelector(".canvas-editor .canvas-stage-container")',
);
await assert(
  "canvas retained across room tools",
  'document.querySelectorAll(".canvas-layer-row").length===11',
);
await click("Shared documents");
await wait('!!document.querySelector(".document-list")');
await evaluate('document.querySelector(".document-list-link").click()');
await wait('!!document.querySelector(".document-paper")');
await setField('input[aria-label="Document title"]', "Browser-tested document");
await click("Add a block");
await assert(
  "document block added",
  'document.querySelectorAll(".document-block").length===12',
);
await click("Insert block");
await wait('!!document.querySelector(".block-menu")');
await evaluate(
  `[...document.querySelectorAll(".block-menu button")].find(b=>b.innerText.includes("Checklist")).click()`,
);
await assert(
  "block menu inserts typed block",
  'document.querySelectorAll(".document-block").length===13 && document.querySelectorAll(".block-checklist").length===4',
);
await screenshot("wbs-document");
await click("Export");
await downloaded(".md");
console.log("PASS document Markdown export produces an actual download");
await click("Media library");
await wait('!!document.querySelector(".media-gallery")');
await assert(
  "media sample assets scoped to workspace",
  'document.querySelectorAll(".asset-card").length===3',
);
await clickLabel("Preview Architectural reference.jpg");
await wait('!!document.querySelector("[role=dialog]")');
await clickLabel("Close dialog");
await evaluate(
  `(()=>{const files=new DataTransfer();files.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="gray"/></svg>'],'QA upload.svg',{type:'image/svg+xml'}));const input=document.querySelector('input[type=file]');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
);
await assert(
  "demo upload adds local asset",
  'document.querySelectorAll(".asset-card").length===4',
);
await clickLabel("Rename QA upload.svg");
await setField("[role=dialog] input", "QA renamed.svg");
await click("Save label");
await assert(
  "file label renames locally",
  'document.querySelector(".media-gallery").innerText.includes("QA renamed.svg")',
);
await clickLabel("Remove QA renamed.svg");
await click("Remove from library");
await assert(
  "file removal confirmation works",
  'document.querySelectorAll(".asset-card").length===3',
);
await click("Members");
await wait('!!document.querySelector(".members-table")');
await click("Invite member");
await setField("[role=dialog] input", "qa@example.test");
await click("Add member");
await wait('!document.querySelector("[role=dialog]")');
await assert(
  "member added in demo state",
  'document.querySelectorAll(".members-table-row").length===6',
);
await evaluate(
  'document.querySelector(".workspace-switcher .dropdown-trigger").click()',
);
await evaluate(
  `Array.from(document.querySelectorAll(".workspace-switcher .dropdown-menu button")).find(b=>b.textContent.includes("Personal space")).click()`,
);
await assert(
  "workspace switching isolates projects",
  'document.querySelectorAll(".project-table-row").length===0',
);
await click("Members");
await assert(
  "workspace switching isolates membership",
  'document.querySelectorAll(".members-table-row").length===1',
);
await evaluate(
  'document.querySelector(".workspace-switcher .dropdown-trigger").click()',
);
await evaluate(
  `Array.from(document.querySelectorAll(".workspace-switcher .dropdown-menu button")).find(b=>b.textContent.includes("Studio North")).click()`,
);
await click("Members");
await assert(
  "demo membership survives workspace switching",
  'document.querySelectorAll(".members-table-row").length===6',
);
await click("My tasks");
await wait('!!document.querySelector(".task-list")');
await evaluate('document.querySelector(".task-row input").click()');
await assert(
  "task completion changes state",
  'document.querySelectorAll(".task-row.done").length===2',
);
await evaluate('document.querySelector(".notification-button").click()');
await wait('!!document.querySelector(".notification-menu")');
await click("View all notifications");
await wait('!!document.querySelector(".notification-list")');
await click("Mark all as read");
await assert(
  "notification read state updates",
  'document.querySelectorAll(".notification-row.unread").length===0',
);
await evaluate(
  'document.querySelector(".demo-role-switch .dropdown-trigger").click()',
);
await evaluate(
  `[...document.querySelectorAll(".demo-role-switch [role=menuitem]")].find(b=>b.innerText.includes("Viewer")).click()`,
);
await click("Members");
await wait('!!document.querySelector(".members-table")');
await assert(
  "viewer cannot see member management",
  '!document.querySelector(".page-heading .btn-primary") && !!document.querySelector(".permission-note") && !document.querySelector(".members-table-row .select")',
);
await nav("/demo/room/brand-direction");
await wait('!!document.querySelector("canvas")');
await assert(
  "canvas stays editable after reload as owner",
  '!document.querySelector(".canvas-banner.readonly")',
);
await evaluate(
  'document.querySelector(".demo-role-switch .dropdown-trigger").click()',
);
await evaluate(
  `[...document.querySelectorAll(".demo-role-switch [role=menuitem]")].find(b=>b.innerText.includes("Viewer")).click()`,
);
await assert(
  "viewer canvas is read-only",
  '!!document.querySelector(".canvas-banner.readonly") && !document.querySelector("[aria-label=\'Pen (P)\']")',
);
await evaluate(
  'document.querySelector(".demo-role-switch .dropdown-trigger").click()',
);
await evaluate(
  `[...document.querySelectorAll(".demo-role-switch [role=menuitem]")].find(b=>b.innerText.includes("Owner")).click()`,
);
await click("Settings");
await wait('!!document.querySelector(".settings-layout")');
await click("Preferences");
await wait(
  `[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Dark")`,
);
await click("Dark");
await assert(
  "theme setting affects root",
  'document.documentElement.dataset.theme==="dark"',
);
await screenshot("wbs-dark");
await click("Light");
await nav("/login");
await assert(
  "login preserved",
  '!!document.querySelector("input[autocomplete=username]")',
);
await setField("input[autocomplete=username]", "qa");
await setField("input[autocomplete=current-password]", "example");
await clickLabel("Show password");
await assert(
  "password visibility works",
  'document.querySelector("input[autocomplete=current-password]").type==="text"',
);
await screenshot("wbs-login");
await nav("/workspace");
await assert("live workspace is protected", 'location.pathname==="/login"');
await nav("/forgot-password");
await setField("input[type=email]", "qa@example.test");
await click("Check recovery options");
await assert(
  "recovery never fakes email delivery",
  'document.querySelector("form").innerText.includes("No recovery email was sent")',
);
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await nav("/demo/workspace");
await screenshot("wbs-mobile");
await assert(
  "mobile overview fits viewport",
  "document.documentElement.scrollWidth<=390",
);
await clickLabel("Open navigation");
await assert(
  "mobile navigation opens",
  'document.querySelector(".app-shell").classList.contains("mobile-nav-open")',
);
await click("Recent rooms");
await wait('document.querySelectorAll(".room-card").length===6');
await assert(
  "mobile nav closes after navigation",
  '!document.querySelector(".app-shell").classList.contains("mobile-nav-open")',
);
await nav("/demo/room/brand-direction");
await wait('!!document.querySelector("canvas")');
await assert(
  "mobile canvas fits viewport",
  "document.documentElement.scrollWidth <= 390",
);
await clickLabel("Toggle layers");
await assert(
  "mobile layers can open",
  'getComputedStyle(document.querySelector(".canvas-layers")).display !== "none"',
);
await clickLabel("Toggle layers");
await clickLabel("Toggle properties panel");
await assert(
  "mobile inspector can open",
  '!!document.querySelector(".canvas-inspector")',
);
await clickLabel("Toggle properties panel");
await click("Chat");
await assert(
  "mobile chat fits viewport",
  "document.documentElement.scrollWidth <= 390",
);
await screenshot("wbs-mobile-chat");
await nav("/register");
await assert(
  "registration fields and terms present",
  '!!document.querySelector("input[autocomplete=name]") && document.querySelectorAll("input[type=password]").length===2 && !!document.querySelector("input[type=checkbox]")',
);
await setField("input[autocomplete=name]", "Test Account");
await setField("input[autocomplete=username]", "testaccount");
await setField("input[autocomplete=email]", "qa@example.test");
await setField("input[autocomplete=new-password]", "password123");
await setField("input[placeholder='One more time']", "different123");
await evaluate('document.querySelector("input[type=checkbox]").click()');
await click("Create your account");
await assert(
  "registration validates password confirmation before API",
  'document.querySelector("form").innerText.includes("Passwords do not match")',
);
await nav("/verify-email");
await setField("input[type=email]", "qa@example.test");
await click("Check verification status");
await assert(
  "email verification does not fake confirmation",
  'document.querySelector("form").innerText.includes("no email has been sent")',
);
// Exercise the real service functions under a test-only axios adapter. This
// checks request contracts without contacting or claiming a working backend.
// Resolve Vite's exact HMR module URL so the adapter patches the same client.
const serviceSource = await (
  await fetch(appUrl + "/src/services/workspace.ts")
).text();
const apiModuleUrl = serviceSource.match(
  /import api from ["']([^"']+)["']/,
)?.[1];
if (!apiModuleUrl)
  throw new Error("API contract checks require the Vite development preview.");
const requests = await evaluate(`(async()=>{
  const {default:api}=await import(${JSON.stringify(apiModuleUrl)});
  const {workspaceService:service}=await import('/src/services/workspace.ts');
  const requests=[], previous=api.defaults.adapter;
  api.defaults.adapter=async config=>{
    requests.push({url:config.url,method:config.method,data:typeof config.data==='string'?JSON.parse(config.data):config.data instanceof FormData?Array.from(config.data.keys()):config.data});
    return {data:{url:'/test-upload.svg'},status:200,statusText:'OK',headers:{},config};
  };
  try {
    await service.createWorkspace('Contract check','A test workspace');
    await service.createWorkspace('A'.repeat(100),'Long-name contract check');
    await service.createProject('test-workspace','Test project','Description');
    await service.createRoom('test-project','Test room','Description');
    await service.addMember('test-workspace','sample@example.test');
    await service.update('workspace','test-workspace','Updated name','Description');
    await service.remove('room','test-room');
    await service.upload(new File(['sample'],'test.txt',{type:'text/plain'}));
    return requests;
  } finally { api.defaults.adapter=previous; }
})()`);
if (!requests.find((r) => r.url === "/workspaces")?.data.slug)
  throw new Error("Workspace creation must include a slug.");
if (requests.some((r) => r.url === "/workspaces" && r.data.slug.length > 100))
  throw new Error("Workspace slug exceeds the backend's 100-character limit.");
for (const url of [
  "/workspaces/test-workspace/projects",
  "/projects/test-project/rooms",
  "/workspaces/test-workspace/members",
  "/workspaces/test-workspace",
  "/rooms/test-room",
  "/upload",
]) {
  if (!requests.some((r) => r.url === url))
    throw new Error("Missing API contract: " + url);
}
console.log(
  "PASS API request contracts under test-only axios adapter (no backend contacted)",
);
console.log("BROWSER_ERRORS", JSON.stringify(errors));
if (errors.length)
  throw new Error("Browser reported " + errors.length + " errors.");
await fs.promises.writeFile(
  "/tmp/wbs-browser-results.json",
  JSON.stringify({ errors }, null, 2),
);
await send("Page.navigate", { url: appUrl + "/demo/workspace" });
ws.close();
