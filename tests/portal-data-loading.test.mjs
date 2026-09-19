import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
const refreshSource = source.slice(source.indexOf("  const refreshState = async"), source.indexOf("\n  useEffect(() => {", source.indexOf("  const refreshState = async")));
const empty = { authUser: null, currentUser: null, students: [], enrollments: [], notifications: [], loading: true, dataError: null };
const user = { id: "account-a", email: "a@example.test" };
const remote = (account = user, students = [{ id: "real-student" }]) => ({ authUser: account, currentUser: { user_id: account.id }, students, enrollments: [] });

function harness(load, initial = empty, timeoutMs = 1000) {
  let state = structuredClone(initial);
  const context = vm.createContext({
    hasSupabaseEnv: true, supabase: {}, defaultState: empty,
    refreshTracker: { current: { key: null, promise: null } },
    sessionGeneration: { current: 0 },
    setState(update) { state = update(state); },
    loadVerifiedRemoteState: load,
    loadOptionalRemoteState: async () => ({ optionalDataReady: true }),
    SUPABASE_BOOT_TIMEOUT_MS: timeoutMs,
    setTimeout, clearTimeout, console,
    readRemoteStateCache() { assert.fail("Live login must not read cached samples"); },
    buildSamplePortalState() { assert.fail("Live login must never generate samples"); },
  });
  const timeoutSource = source.slice(source.indexOf("function withTimeout("), source.indexOf("function isTimeoutError("));
  const refresh = vm.runInContext(`${timeoutSource}\n${refreshSource}\nrefreshState;`, context);
  return { refresh, state: () => state };
}

test("login waits for live records and coalesces overlapping loads", async () => {
  let finish;
  let calls = 0;
  const h = harness(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = h.refresh(user);
  const second = h.refresh(user);
  assert.equal(h.state().loading, true);
  assert.equal(h.state().currentUser, null);
  assert.equal(calls, 1);
  finish(remote());
  await Promise.all([first, second]);
  assert.equal(h.state().students[0].id, "real-student");
  assert.equal(h.state().loading, false);
});

test("a successful empty database stays empty and removes deleted records", async () => {
  const h = harness(async () => remote(user, []), { ...empty, ...remote(), loading: false });
  await h.refresh(user);
  assert.equal(h.state().students.length, 0);
  assert.equal(h.state().dataError, null);
});

test("same-account background refresh keeps the welcome/dashboard mounted", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }), { ...empty, ...remote(), loading: false });
  const pending = h.refresh(user);
  assert.equal(h.state().loading, false);
  assert.equal(h.state().refreshing, true);
  assert.equal(h.state().students[0].id, "real-student");
  finish(remote());
  await pending;
  assert.equal(h.state().refreshing, false);
});

test("a hung load exits the loading screen and exposes retry", async () => {
  const h = harness(() => new Promise(() => {}), empty, 15);
  await assert.rejects(h.refresh(user), /timed out/);
  assert.equal(h.state().loading, false);
  assert.equal(h.state().refreshing, false);
  assert.ok(h.state().dataError);
});

test("core table groups start together and do not wait for optional history", async () => {
  const start = source.indexOf("async function loadFullRemoteState(");
  const end = source.indexOf("async function loadVerifiedRemoteState", start);
  let finishCritical;
  let finishDeferred;
  const load = vm.runInNewContext(`${source.slice(start, end)}\nloadFullRemoteState;`, {
    loadCriticalRemoteState: () => new Promise(resolve => { finishCritical = resolve; }),
    loadDeferredRemoteState: () => new Promise(resolve => { finishDeferred = resolve; }),
  });
  const pending = load(user);
  assert.equal(typeof finishCritical, "function");
  assert.equal(typeof finishDeferred, "function");
  finishCritical({ currentUser: user });
  finishDeferred({ students: [{ id: "current" }] });
  const state = await pending;
  assert.equal(state.students[0].id, "current");
});

test("failed refresh reports an error without replacing records with zeros; retry recovers", async () => {
  let fail = true;
  const h = harness(async () => { if (fail) throw new Error("network unavailable"); return remote(); }, { ...empty, ...remote(), loading: false });
  await assert.rejects(h.refresh(user), /network unavailable/);
  assert.ok(h.state().dataError);
  assert.equal(h.state().students.length, 1);
  fail = false;
  await h.refresh(user);
  assert.equal(h.state().dataError, null);
});

test("a late response cannot restore data after sign-out", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.refresh(user);
  await h.refresh(null);
  finish(remote());
  await pending;
  assert.equal(h.state().authUser, null);
  assert.equal(h.state().students.length, 0);
});

test("switching accounts clears old records and ignores the old account response", async () => {
  const finishes = {};
  const h = harness(account => new Promise(resolve => { finishes[account.id] = resolve; }), { ...empty, ...remote(), loading: false });
  const a = h.refresh(user);
  const other = { id: "account-b" };
  const b = h.refresh(other);
  assert.equal(h.state().students.length, 0);
  finishes[other.id](remote(other, [{ id: "b-student" }]));
  await b;
  finishes[user.id](remote());
  await a;
  assert.equal(h.state().authUser.id, other.id);
  assert.equal(h.state().students[0].id, "b-student");
});

test("required table failures reject the load instead of fabricating empty arrays", async () => {
  const start = source.indexOf("async function loadDeferredRemoteState()");
  const end = source.indexOf("async function loadFullRemoteState", start);
  for (const table of ["students", "enrollments", "documents"]) {
    const load = vm.runInNewContext(`${source.slice(start, end)}\nloadDeferredRemoteState;`, {
      deferredPortalTables: [{ key: table, table }], DEFERRED_REMOTE_TIMEOUT_MS: 10,
      fetchTableWithSchemaFallback: async () => { throw new Error("offline"); },
    });
    await assert.rejects(load(), new RegExp(`Could not load ${table}`));
  }
});
