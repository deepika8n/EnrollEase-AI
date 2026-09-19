import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/pages/LoginPageSimple.jsx", import.meta.url), "utf8");
const effectBody = source.split("  useEffect(() => {")[1].split("\n  }, [")[0];

test("fresh login waits for restoration, clears once silently, and consumes the flag before sign-in", async () => {
  let completeLogout;
  const logoutPromise = new Promise((resolve) => { completeLogout = resolve; });
  const calls = [];
  const context = vm.createContext({
    currentUser: null,
    loading: true,
    forceFreshLogin: true,
    skipAutoRedirectRef: { current: false },
    freshSessionCleanupRef: { current: null },
    setClearingFreshSession() {},
    logout(options) { calls.push(options.silent); return logoutPromise; },
    setSearchParams(update, options) {
      assert.equal(options.replace, true);
      assert.equal(update(new URLSearchParams("fresh=1&next=dashboard")).toString(), "next=dashboard");
      context.forceFreshLogin = false;
    },
    setError(message) { assert.fail(message); },
    URLSearchParams,
  });
  const effect = vm.runInContext(`() => { ${effectBody}\n }`, context);
  effect();
  assert.equal(calls.length, 0);
  context.loading = false;
  context.currentUser = { id: "previous-session" };
  const cleanup = effect();
  cleanup();
  effect();
  assert.deepEqual(calls, [true]);
  context.currentUser = null;
  effect();
  completeLogout();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(context.forceFreshLogin, false);
  context.currentUser = { id: "new-session" };
  effect();
  assert.deepEqual(calls, [true]);
});
