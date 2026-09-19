import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
const refreshSource = source.slice(source.indexOf("  const refreshState = async"), source.indexOf("\n  useEffect(() => {", source.indexOf("  const refreshState = async")));
const empty = { authUser: null, currentUser: null, students: [], enrollments: [], notifications: [], loading: true, dataError: null };
const user = { id: "account-a", email: "a@example.test" };
const remote = (account = user, students = [{ id: "real-student" }]) => ({ authUser: account, currentUser: { user_id: account.id }, students, enrollments: [] });

function harness(load, initial = empty) {
  let state = structuredClone(initial);
  const context = vm.createContext({
    hasSupabaseEnv: true, supabase: {}, defaultState: empty,
    refreshTracker: { current: { key: null, promise: null } },
    sessionGeneration: { current: 0 },
    setState(update) { state = update(state); },
    loadVerifiedRemoteState: load,
    readRemoteStateCache() { assert.fail("Live login must not read cached samples"); },
    buildSamplePortalState() { assert.fail("Live login must never generate samples"); },
  });
  const refresh = vm.runInContext(`${refreshSource}\nrefreshState;`, context);
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
