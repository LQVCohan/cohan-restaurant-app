import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const backendDir = path.dirname(scriptsDir);

const seedEnv = {
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
};

function runScript(scriptName, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, scriptName), ...args],
    {
      cwd: backendDir,
      env: seedEnv,
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}

runScript("seedDefenseDemo.js", process.argv.slice(2));
// Replace the four-item smoke menu with the full operating catalog. This step
// resolves the current primary restaurant dynamically, seeds portion/by-weight
// variants and refreshes ingredient purchase costs and stock values.
runScript("seedDefenseMenuCatalog.js");
// userType is the Mongoose discriminator key. Raw repair is required because
// findOneAndUpdate strips discriminator-key changes by default, which can leave
// manager/staff accounts stored as CUSTOMER after an upsert.
runScript("repairDefenseAccountDiscriminators.js");
// Resolve staff IDs by email after the account repair, then create a complete,
// idempotent roster for the previous and current Vietnam calendar weeks.
runScript("seedScheduleCurrentAndPreviousWeek.js");
runScript("finalizeDefenseDemoDataset.js");
