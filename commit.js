const fs = require('fs');
const { execSync } = require('child_process');

const pushConfig = [
  "dist",
  "src",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "README.md",
  "rollup.config.mjs",
  "tsconfig.json"
];

try {
    console.log("Cleaning git index...");
    execSync('git rm -r --cached .', { stdio: 'ignore' });

    pushConfig.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                execSync(`git add "${file}"`);
                console.log(`✅ Added: ${file}`);
            } catch (e) {
                console.log(`❌ Failed to add: ${file}`);
            }
        }
    });
    try {
        execSync('git commit -m "Clean push: rebuild repository structure"');
    } catch (e) {
        console.log("ℹ️ No changes to commit.");
    }
    console.log("Pushing to origin main...");
    execSync('git push origin main --force');
    console.log("🚀 Successfully synchronized with remote!");

} catch (error) {
    console.error("🚨 Critical Error during push:", error.message);
}