// Layout-only audit against an isolated Chromium CDP instance and a running preview.
import fs from "node:fs";
const browserUrl = process.env.WBS_BROWSER_URL || "http://localhost:9222";
const appUrl = process.env.WBS_TEST_URL || "http://localhost:3000";
const target = await (
  await fetch(browserUrl + "/json/new?about:blank", { method: "PUT" })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map(),
  errors = [];
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    pending.get(m.id)?.(m.result);
    pending.delete(m.id);
  } else if (m.method === "Runtime.exceptionThrown")
    errors.push(m.params.exceptionDetails.text);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const ev = async (expression) =>
  (
    await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
  ).result.value;
await send("Runtime.enable");
await send("Page.enable");
const failures = [];
for (const width of [1920, 1024, 768, 390]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 760,
  });
  for (const path of [
    "/demo/workspace",
    "/demo/projects",
    "/demo/projects/brand",
    "/demo/room/brand-direction",
    "/demo/room/brand-direction/chat",
    "/demo/documents/brief",
    "/demo/media",
    "/demo/members",
    "/demo/tasks",
    "/demo/notifications",
    "/demo/settings",
  ]) {
    await send("Page.navigate", { url: appUrl + path });
    for (let n = 0; n < 60; n++) {
      if (
        await ev(
          'document.readyState==="complete"&&!!document.querySelector("main")?.textContent',
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 120));
    const layout = await ev(
      'JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("main *")].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2&&r.width>1}).slice(0,8).map(e=>e.className)})',
    );
    const data = JSON.parse(layout);
    if (data.scroll > width) {
      failures.push({ width, path, ...data });
      console.log("OVERFLOW", width, path, layout);
    } else console.log("PASS", width, path);
    if (path === "/demo/workspace") {
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      fs.writeFileSync(
        "/tmp/wbs-layout-" + width + ".png",
        Buffer.from(shot.data, "base64"),
      );
    }
  }
}
console.log("RESULT", JSON.stringify({ failures, errors }));
ws.close();
if (failures.length || errors.length) process.exitCode = 1;
