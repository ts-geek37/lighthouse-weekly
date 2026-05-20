const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function run() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  const result = await lighthouse('https://example.com', {
    port: chrome.port,
    output: ['json', 'html'],
    onlyCategories: ['performance'],
  });
  console.log("report type:", typeof result.report);
  console.log("report isArray:", Array.isArray(result.report));
  if (Array.isArray(result.report)) {
    console.log("report length:", result.report.length);
    console.log("report[0] type:", typeof result.report[0], "length:", result.report[0].length);
    console.log("report[1] type:", typeof result.report[1], "length:", result.report[1].length);
  }
  await chrome.kill();
}
run().catch(console.error);
