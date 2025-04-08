const express = require('express');
const si = require('systeminformation');
const path = require('path');

const app = express();
const port = 5000;

let latestMetrics = {};

async function collectMetrics() {
    try {
        const results = await Promise.allSettled([
            si.currentLoad(),
            si.mem(),
            si.time(),
            si.osInfo(),
            si.battery(),
            si.graphics(),
            si.fsSize(),
            si.networkStats(),
            si.processes()
        ]);

        const [
            cpuLoadRes,
            memRes,
            timeRes,
            osInfoRes,
            batteryRes,
            graphicsRes,
            fsSizeRes,
            networkStatsRes,
            processesRes
        ] = results;

        const getResultValue = (res, defaultValue = null) => res.status === 'fulfilled' ? res.value : defaultValue;

        const cpuLoad = getResultValue(cpuLoadRes, { currentLoad: null });
        const mem = getResultValue(memRes, { total: 0, used: 0 });
        const time = getResultValue(timeRes, { uptime: 0 });
        const osInfo = getResultValue(osInfoRes, { platform: 'N/A', distro: 'N/A', release: 'N/A' });
        const battery = getResultValue(batteryRes, { hasBattery: false, percent: null, isCharging: null, timeRemaining: null, maxCapacity: null, designedCapacity: null });
        const graphics = getResultValue(graphicsRes, { controllers: [], displays: [] });
        const fsSize = getResultValue(fsSizeRes, []);
        const networkStats = getResultValue(networkStatsRes, []);
        const processes = getResultValue(processesRes, { list: [] });

        // --- Process Metrics ---

        // Battery Health
        let batteryHealth = null;
        if (battery.hasBattery && battery.maxCapacity > 0 && battery.designedCapacity > 0) {
            batteryHealth = ((battery.maxCapacity / battery.designedCapacity) * 100).toFixed(1);
        }

        // GPU Info (find first non-integrated GPU if possible, otherwise first)
        let gpuInfo = { load: null, temp: null, name: 'N/A' };
        if (graphics.controllers.length > 0) {
            const primaryGpu = graphics.controllers.find(gpu => !gpu.vendor.toLowerCase().includes('intel')) || graphics.controllers[0];
            gpuInfo = {
                load: primaryGpu.utilizationGpu !== undefined ? primaryGpu.utilizationGpu : null, // systeminformation v5 uses utilizationGpu
                temp: primaryGpu.temperatureGpu !== undefined ? primaryGpu.temperatureGpu : null,
                name: primaryGpu.model || 'N/A'
            };
        }

        // Disk Usage (find root or C: drive)
        let diskInfo = { usePercent: null, name: 'N/A' };
        const primaryDisk = fsSize.find(fs => fs.mount === '/' || fs.fs.startsWith('C:')) || fsSize[0];
        if (primaryDisk) {
            diskInfo = {
                usePercent: primaryDisk.use !== undefined ? primaryDisk.use.toFixed(1) : null,
                name: primaryDisk.fs || 'N/A'
            };
        }

        // Network Usage (find primary interface - heuristic)
        let networkInfo = { rxSec: null, txSec: null, iface: 'N/A' };
        const primaryIface = networkStats.find(net => net.operstate === 'up' && !net.internal) || networkStats[0];
        if (primaryIface) {
            networkInfo = {
                rxSec: primaryIface.rx_sec !== undefined ? (primaryIface.rx_sec / 1024).toFixed(1) : null, // KB/s
                txSec: primaryIface.tx_sec !== undefined ? (primaryIface.tx_sec / 1024).toFixed(1) : null, // KB/s
                iface: primaryIface.iface || 'N/A'
            };
        }

        // Top Processes (Top 5 by CPU)
        let topProcesses = [];
        if (processes.list.length > 0) {
            topProcesses = processes.list
                .sort((a, b) => b.pcpu - a.pcpu) // Sort by CPU usage descending
                .slice(0, 5) // Take top 5
                .map(p => ({
                    pid: p.pid,
                    name: p.name,
                    cpu: (typeof p.pcpu === 'number') ? p.pcpu.toFixed(1) : '0.0', // Check before calling toFixed
                    mem: (typeof p.pmem === 'number') ? p.pmem.toFixed(1) : '0.0'  // Check before calling toFixed
                }));
        }

        // --- Update latestMetrics ---
        latestMetrics = {
            cpuLoad: cpuLoad.currentLoad !== null ? cpuLoad.currentLoad.toFixed(1) : null,
            totalRamMB: (mem.total / (1024 * 1024)).toFixed(0),
            usedRamMB: (mem.used / (1024 * 1024)).toFixed(0),
            usedRamPercent: mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(1) : null,
            uptimeHours: (time.uptime / 3600).toFixed(1),
            osPlatform: osInfo.platform,
            osDistro: osInfo.distro,
            osRelease: osInfo.release,
            hasBattery: battery.hasBattery,
            batteryPercent: battery.percent,
            isCharging: battery.isCharging,
            timeRemaining: battery.timeRemaining,
            batteryHealth: batteryHealth,
            gpuLoad: gpuInfo.load,
            gpuTemp: gpuInfo.temp,
            gpuName: gpuInfo.name,
            diskUsePercent: diskInfo.usePercent,
            diskName: diskInfo.name,
            netRxSec: networkInfo.rxSec,
            netTxSec: networkInfo.txSec,
            netIface: networkInfo.iface,
            topProcesses: topProcesses
        };
        console.log('Metrics collected:', new Date().toISOString());

        // Log errors from settled promises
        results.forEach(res => {
            if (res.status === 'rejected') {
                console.error('Error collecting metric:', res.reason);
            }
        });

    } catch (e) {
        // Catch potential errors in Promise.allSettled itself or processing
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
