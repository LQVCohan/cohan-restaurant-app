import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const backendDir = path.dirname(scriptsDir);
const defenseScript = path.join(scriptsDir, "seedDefenseDemo.js");

const result = spawnSync(
  process.execPath,
  [defenseScript, ...process.argv.slice(2)],
  {
    cwd: backendDir,
    env: {
      ...process.env,
      // The legacy scheduling seed still builds in-memory actors with
      // restaurantForStaff/refRestaurants. Keep this compatibility strictly
      // inside the short-lived seed subprocess; the running backend never
      // receives these flags.
      DEMO_SEED_ALLOW_LEGACY_SCOPE: "true",
      // The historical scheduling fixture demonstrates incident apply/appeal
      // using an attendance event. Allow that fixture only while rebuilding
      // the graduation-defense dataset.
      DEMO_SEED_ALLOW_ATTENDANCE_SCORING: "true",
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`seedDefenseDemo.js failed with exit code ${result.status}`);
}
