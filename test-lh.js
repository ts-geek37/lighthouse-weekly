const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const reportGenerator = require('lighthouse/report/generator/report-generator.js');

console.log("reportGenerator type:", typeof reportGenerator);
console.log("reportGenerator keys:", Object.keys(reportGenerator));
if (reportGenerator.ReportGenerator) {
    console.log("Has ReportGenerator property");
} else if (reportGenerator.generateReportHtml) {
    console.log("Has generateReportHtml directly");
}
