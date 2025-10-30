# Screenshot Automation for Marketing

This directory contains scripts to automatically capture screenshots of Kube Opex Analytics for marketing materials and documentation.

## Prerequisites

- Node.js 14+ installed
- Running instance of Kube Opex Analytics

## Installation

```bash
cd marketing
npm install
```

## Usage

### Basic Usage (Local Instance)

```bash
node capture-screenshots.js
```

This will capture screenshots from `http://localhost:5483` by default.

### Custom URL

```bash
node capture-screenshots.js https://koa-kube-opex-analytics.apps.ocp-dev1.realopslabs.local/
```

### Using npm script

```bash
npm run capture -- https://your-koa-instance.com/
```

## What Gets Captured

The script automatically captures **19 high-quality screenshots** (1920x1080):

### Full Dashboard Views (7 screenshots)
Comprehensive dashboard captures showcasing different configurations and themes:

1. **01-dashboard-light-theme.png** - Full dashboard in light mode (default view)
2. **01b-dashboard-monthly-usage-light.png** - Dashboard with monthly usage charts enabled (light)
3. **01c-dashboard-heatmap-light.png** - Dashboard with CPU heatmap visualization enabled (light)
4. **01d-dashboard-usage-trends-tooltip-light.png** - Dashboard with interactive tooltip on usage trends
5. **02-dashboard-dark-theme.png** - Full dashboard in dark mode (default view)
6. **02b-dashboard-monthly-usage-dark.png** - Dashboard with monthly usage charts enabled (dark)
7. **02c-dashboard-heatmap-dark.png** - Dashboard with memory heatmap visualization enabled (dark)

### Chart Section Details (4 screenshots)
Close-up views of specific chart sections:

8. **03-usage-trends-charts.png** - Hourly usage trends section closeup
9. **04-usage-efficiency-view.png** - Usage/Request efficiency comparison view
10. **05-daily-usage-accounting.png** - Daily resource accounting charts
11. **06-monthly-usage-accounting.png** - Monthly resource accounting charts

### Node Visualizations (5 screenshots)
Node resource utilization and heatmap views:

12. **07-node-cpu-heatmap.png** - CPU heatmap visualization closeup
13. **08-node-memory-heatmap.png** - Memory heatmap visualization closeup
14. **09-node-cpu-pods-usage.png** - Node CPU and Pods usage detailed view
15. **10-heatmap-tooltip-demo.png** - Heatmap with interactive tooltip demonstration
16. **11-heatmap-dark-theme.png** - Heatmap visualization in dark mode

### Interactive Elements (3 screenshots)
Modal windows and interactive features:

17. **12-full-dashboard-dark.png** - Complete full-page dashboard in dark mode
18. **13-node-detail-popup-light.png** - Node detail popup/modal in light theme
19. **14-node-detail-popup-dark.png** - Node detail popup/modal in dark theme

## Output

Screenshots are saved to: `screenshots/marketing/`

Resolution: 1920x1080 (Full HD)

## Configuration

Edit `capture-screenshots.js` to customize:

- `VIEWPORT` - Screenshot resolution (default: 1920x1080)
- `WAIT_FOR_CHARTS` - Chart rendering delay (default: 3000ms)
- `OUTPUT_DIR` - Output directory for screenshots

## Troubleshooting

### Certificate Errors (HTTPS)

The script automatically ignores certificate errors with `--ignore-certificate-errors`. This is useful for self-signed certificates in dev/test environments.

### Authentication Required

If your instance requires authentication, you'll need to modify the script to handle login. Add after the `page.goto()` call:

```javascript
// Example: Basic auth
await page.authenticate({
    username: 'your-username',
    password: 'your-password'
});

// Or handle login form
await page.type('#username', 'your-username');
await page.type('#password', 'your-password');
await page.click('#login-button');
await page.waitForNavigation();
```

### Charts Not Loading

Increase `WAIT_FOR_CHARTS` timeout if charts take longer to render:

```javascript
const WAIT_FOR_CHARTS = 5000; // 5 seconds
```

### Headless Mode Issues

To debug issues, run in headed mode by changing:

```javascript
const browser = await puppeteer.launch({
    headless: false, // See the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
});
```

## Creating Marketing Videos

After capturing screenshots, you can:

1. **Use video editing software**:
   - Import screenshots into Adobe Premiere, Final Cut Pro, or DaVinci Resolve
   - Add transitions, text overlays, and narration

2. **Create animated GIFs**:
   ```bash
   # Using ImageMagick
   convert -delay 200 -loop 0 screenshots/marketing/*.png output.gif
   ```

3. **Build slideshows**:
   ```bash
   # Using ffmpeg
   ffmpeg -framerate 1/3 -pattern_type glob -i 'screenshots/marketing/*.png' \
          -c:v libx264 -pix_fmt yuv420p output.mp4
   ```

## License

Same as parent project (Apache 2.0)
