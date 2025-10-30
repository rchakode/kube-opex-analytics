#!/usr/bin/env node

/**
 * Screenshot capture script for Kube Opex Analytics marketing materials
 *
 * Requirements:
 *   npm install puppeteer
 *
 * Usage:
 *   node scripts/capture-screenshots.js <URL>
 *
 * Example:
 *   node scripts/capture-screenshots.js https://koa-kube-opex-analytics.apps.ocp-dev1.realopslabs.local/
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5483';
const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots', 'marketing');
const VIEWPORT = { width: 1920, height: 1080 };
const WAIT_FOR_CHARTS = 3000; // Wait 3s for charts to render

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureScreenshots() {
    console.log(`📸 Starting screenshot capture from: ${BASE_URL}`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);

        // Navigate to the application
        console.log('\n🌐 Loading application...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for initial charts to load
        await wait(WAIT_FOR_CHARTS);

        // 1. Full dashboard - Light theme (default view)
        console.log('📸 Capturing: 01-dashboard-light-theme.png');
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '01-dashboard-light-theme.png'),
            fullPage: true
        });

        // 1b. Dashboard with monthly usage enabled
        console.log('📸 Capturing: 01b-dashboard-monthly-usage-light.png');
        await page.select('#selected-cumulative-usage-type', 'monthly-usage');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '01b-dashboard-monthly-usage-light.png'),
            fullPage: true
        });

        // 1c. Dashboard with heatmap enabled
        console.log('📸 Capturing: 01c-dashboard-heatmap-light.png');
        await page.select('#js-node-usage-type', 'cpu-heatmap');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '01c-dashboard-heatmap-light.png'),
            fullPage: true
        });

        // 1d. Dashboard with tooltip on usage trends
        console.log('📸 Capturing: 01d-dashboard-usage-trends-tooltip-light.png');
        await page.select('#selected-cumulative-usage-type', 'daily-usage');
        await page.select('#js-node-usage-type', 'cpu-pods');
        await wait(WAIT_FOR_CHARTS);

        // Scroll to usage trends section
        await page.evaluate(() => {
            document.querySelector('.js-chart-trends-cpu-usage').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        await wait(1000);

        // Hover over a chart element to show tooltip
        const trendChart = await page.$('.js-chart-trends-cpu-usage svg');
        if (trendChart) {
            const box = await trendChart.boundingBox();
            if (box) {
                // Hover near the center-right of the chart to trigger tooltip
                await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
                await wait(800);
                await page.screenshot({
                    path: path.join(OUTPUT_DIR, '01d-dashboard-usage-trends-tooltip-light.png'),
                    fullPage: true
                });
            }
        }

        // Reset to default views
        await page.select('#selected-cumulative-usage-type', 'daily-usage');
        await page.select('#js-node-usage-type', 'cpu-pods');
        await wait(1000);

        // 2. Toggle to dark theme
        console.log('🌙 Switching to dark theme...');
        await page.click('#theme-toggle-btn');
        await wait(500); // Wait for transition

        console.log('📸 Capturing: 02-dashboard-dark-theme.png');
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '02-dashboard-dark-theme.png'),
            fullPage: true
        });

        // 2b. Dashboard with monthly usage - dark theme
        console.log('📸 Capturing: 02b-dashboard-monthly-usage-dark.png');
        await page.select('#selected-cumulative-usage-type', 'monthly-usage');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '02b-dashboard-monthly-usage-dark.png'),
            fullPage: true
        });

        // 2c. Dashboard with heatmap - dark theme
        console.log('📸 Capturing: 02c-dashboard-heatmap-dark.png');
        await page.select('#js-node-usage-type', 'memory-heatmap');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '02c-dashboard-heatmap-dark.png'),
            fullPage: true
        });

        // Reset to default views for dark theme
        await page.select('#selected-cumulative-usage-type', 'daily-usage');
        await page.select('#js-node-usage-type', 'cpu-pods');
        await wait(1000);

        // 3. Usage trends section (light theme)
        console.log('☀️ Switching back to light theme...');
        await page.click('#theme-toggle-btn');
        await wait(500);

        console.log('📸 Capturing: 03-usage-trends-charts.png');
        await page.evaluate(() => {
            document.querySelector('.js-chart-trends-cpu-rf').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await wait(1000);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '03-usage-trends-charts.png'),
            fullPage: false
        });

        // 4. Switch to Usage Efficiency view
        console.log('📸 Capturing: 04-usage-efficiency-view.png');
        await page.select('#selected-usage-trend-type', 'usage-efficiency');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '04-usage-efficiency-view.png'),
            fullPage: false
        });

        // Switch back to hourly usage
        await page.select('#selected-usage-trend-type', 'hourly-usage');
        await wait(1000);

        // 5. Daily usage accounting
        console.log('📸 Capturing: 05-daily-usage-accounting.png');
        await page.evaluate(() => {
            document.querySelector('.js-chart-daily-cpu-usage').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await wait(1000);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '05-daily-usage-accounting.png'),
            fullPage: false
        });

        // 6. Monthly usage accounting
        console.log('📸 Capturing: 06-monthly-usage-accounting.png');
        await page.select('#selected-cumulative-usage-type', 'monthly-usage');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '06-monthly-usage-accounting.png'),
            fullPage: false
        });

        // 7. Node CPU heatmap
        console.log('📸 Capturing: 07-node-cpu-heatmap.png');
        await page.evaluate(() => {
            document.querySelector('#js-nodes-load-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await wait(1000);
        await page.select('#js-node-usage-type', 'cpu-heatmap');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '07-node-cpu-heatmap.png'),
            fullPage: false
        });

        // 8. Node Memory heatmap
        console.log('📸 Capturing: 08-node-memory-heatmap.png');
        await page.select('#js-node-usage-type', 'memory-heatmap');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '08-node-memory-heatmap.png'),
            fullPage: false
        });

        // 9. Node CPU/Pods usage
        console.log('📸 Capturing: 09-node-cpu-pods-usage.png');
        await page.select('#js-node-usage-type', 'cpu-pods');
        await wait(WAIT_FOR_CHARTS);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '09-node-cpu-pods-usage.png'),
            fullPage: false
        });

        // 10. Heatmap with tooltip (simulate hover)
        console.log('📸 Capturing: 10-heatmap-tooltip-demo.png');
        await page.select('#js-node-usage-type', 'cpu-heatmap');
        await wait(WAIT_FOR_CHARTS);

        // Try to hover over a heatmap cell
        const heatmapRect = await page.$('.node-rect');
        if (heatmapRect) {
            await heatmapRect.hover();
            await wait(500);
            await page.screenshot({
                path: path.join(OUTPUT_DIR, '10-heatmap-tooltip-demo.png'),
                fullPage: false
            });
        }

        // 11. Dark theme with heatmap
        console.log('📸 Capturing: 11-heatmap-dark-theme.png');
        await page.click('#theme-toggle-btn');
        await wait(500);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '11-heatmap-dark-theme.png'),
            fullPage: false
        });

        // 12. Full page dark theme
        console.log('📸 Capturing: 12-full-dashboard-dark.png');
        await page.evaluate(() => window.scrollTo(0, 0));
        await wait(500);
        await page.screenshot({
            path: path.join(OUTPUT_DIR, '12-full-dashboard-dark.png'),
            fullPage: true
        });

        // 13. Node detail popup - light theme
        console.log('☀️ Switching back to light theme...');
        await page.click('#theme-toggle-btn');
        await wait(500);

        console.log('📸 Capturing: 13-node-detail-popup-light.png');
        await page.evaluate(() => {
            document.querySelector('#host-list-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await wait(1000);

        // Click on first node in the list
        const firstNodeLink = await page.$('#host-list-container a');
        if (firstNodeLink) {
            await firstNodeLink.click();
            await wait(1500); // Wait for popup to appear
            await page.screenshot({
                path: path.join(OUTPUT_DIR, '13-node-detail-popup-light.png'),
                fullPage: false
            });

            // Close popup
            const closeButton = await page.$('#popup-container .close');
            if (closeButton) {
                await closeButton.click();
                await wait(500);
            }
        }

        // 14. Node detail popup - dark theme
        console.log('🌙 Switching to dark theme for node popup...');
        await page.click('#theme-toggle-btn');
        await wait(500);

        console.log('📸 Capturing: 14-node-detail-popup-dark.png');
        const secondNodeLink = await page.$('#host-list-container a');
        if (secondNodeLink) {
            await secondNodeLink.click();
            await wait(1500);
            await page.screenshot({
                path: path.join(OUTPUT_DIR, '14-node-detail-popup-dark.png'),
                fullPage: false
            });
        }

        console.log('\n✅ Screenshot capture complete!');
        console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);
        console.log('\n📋 Captured files:');
        const files = fs.readdirSync(OUTPUT_DIR).sort();
        files.forEach(file => console.log(`   - ${file}`));

    } catch (error) {
        console.error('\n❌ Error capturing screenshots:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run the script
captureScreenshots()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Failed:', error.message);
        process.exit(1);
    });
