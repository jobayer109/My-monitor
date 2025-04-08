const express = require('express');
const si = require('systeminformation');
const path = require('path');

const app = express();
const port = 5000;

let latestMetrics = {};

async function collectMetrics() {
    try {
        const results = await Promise.allSettled([
            si.currentLoad(), si.mem(), si.time(), si.osInfo(), si.battery(),
            si.fsSize(), si.networkStats() // Removed graphics and processes
        ]);

        const [
            cpuLoadRes, memRes, timeRes, osInfoRes, batteryRes,
            fsSizeRes, networkStatsRes // Removed graphicsRes and processesRes
        ] = results;

        const getResultValue = (res, defaultValue = null) => res.status === 'fulfilled' ? res.value : defaultValue;

        const cpuLoad = getResultValue(cpuLoadRes, { currentLoad: null });
        const mem = getResultValue(memRes, { total: 0, used: 0 });
        const time = getResultValue(timeRes, { uptime: 0 });
        const osInfo = getResultValue(osInfoRes, { platform: 'N/A', distro: 'N/A', release: 'N/A' });
        const battery = getResultValue(batteryRes, { hasBattery: false, percent: null, isCharging: null, timeRemaining: null, maxCapacity: null, designedCapacity: null });
        // Removed graphics
        const fsSize = getResultValue(fsSizeRes, []);
        const networkStats = getResultValue(networkStatsRes, []);
        // Removed processes

        let batteryHealth = null;
        if (battery.hasBattery && battery.maxCapacity > 0 && battery.designedCapacity > 0) {
            batteryHealth = ((battery.maxCapacity / battery.designedCapacity) * 100).toFixed(1);
        }

        // Removed GPU Info processing

        let diskInfo = { usePercent: null, name: 'N/A' };
        const primaryDisk = fsSize.find(fs => fs.mount === '/' || fs.fs.startsWith('C:')) || fsSize[0];
        if (primaryDisk) {
            diskInfo = {
                usePercent: primaryDisk.use !== undefined ? primaryDisk.use.toFixed(1) : null,
                name: primaryDisk.fs || 'N/A'
            };
        }

        let networkInfo = { rxSec: null, txSec: null, iface: 'N/A' };
        const primaryIface = networkStats.find(net => net.operstate === 'up' && !net.internal) || networkStats[0];
        if (primaryIface) {
            networkInfo = {
                rxSec: primaryIface.rx_sec !== undefined ? (primaryIface.rx_sec / 1024).toFixed(1) : null,
                txSec: primaryIface.tx_sec !== undefined ? (primaryIface.tx_sec / 1024).toFixed(1) : null,
                iface: primaryIface.iface || 'N/A'
            };
        }

        // Removed Top Processes processing

        latestMetrics = {
            cpuLoad: cpuLoad.currentLoad !== null ? cpuLoad.currentLoad.toFixed(1) : null,
            totalRamMB: (mem.total / (1024 * 1024)).toFixed(0),
            usedRamMB: (mem.used / (1024 * 1024)).toFixed(0),
            usedRamPercent: mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(1) : null,
            uptimeHours: (time.uptime / 3600).toFixed(1),
            osPlatform: osInfo.platform, osDistro: osInfo.distro, osRelease: osInfo.release,
            hasBattery: battery.hasBattery, batteryPercent: battery.percent, isCharging: battery.isCharging,
            timeRemaining: battery.timeRemaining, batteryHealth: batteryHealth,
            // Removed GPU fields
            diskUsePercent: diskInfo.usePercent, diskName: diskInfo.name,
            netRxSec: networkInfo.rxSec, netTxSec: networkInfo.txSec, netIface: networkInfo.iface
            // Removed topProcesses field
        };
        console.log('Metrics collected:', new Date().toISOString());

        results.forEach(res => {
            if (res.status === 'rejected') {
                console.error('Error collecting metric:', res.reason);
            }
        });

    } catch (e) {
        console.error('Critical error during metrics collection:', e);
    }
}

app.get('/metrics', (req, res) => {
    res.json(latestMetrics);
});

app.get('/collect', async (req, res) => {
    console.log('Manual collection triggered...');
    await collectMetrics();
    res.json({ status: 'collected', metrics: latestMetrics });
});

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

collectMetrics().then(() => {
    app.listen(port, () => {
        console.log(`My Monitor server listening at http://localhost:${port}`);
        console.log(`Serving frontend from: ${frontendPath}`);
    });
});
