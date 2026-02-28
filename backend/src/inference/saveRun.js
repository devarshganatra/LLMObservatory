import fs from "fs";
import path from "path";

export function saveRun(runData) {
  const runsDir = path.join(process.cwd(), "../data/runs");

  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  const filePath = path.join(
    runsDir,
    `${runData.run_id}.json`
  );

  fs.writeFileSync(filePath, JSON.stringify(runData, null, 2));

  console.log(`Run saved: ${filePath}`);
}