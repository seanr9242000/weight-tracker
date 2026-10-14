/* Tiny assertion helper shared by the *.test.html pages. Each page
   collects results with eq()/near(), then calls report(), which writes
   "N/M passed" plus any failures into <pre id="out"> for run.py. */

const results = [];

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

function near(name, actual, expected, tolerance) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${actual}, want ${expected} ± ${tolerance}`}`);
}

function run(tests) {
  try {
    tests();
  } catch (e) {
    results.push("ERROR " + e.stack);
  }
  const fails = results.filter((r) => !r.startsWith("PASS"));
  document.getElementById("out").textContent =
    `${results.length - fails.length}/${results.length} passed\n` + fails.join("\n");
}
