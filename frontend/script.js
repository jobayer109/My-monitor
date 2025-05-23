document.addEventListener('DOMContentLoaded', () => {
    const cpuLoadEl = document.getElementById('cpu-load');
    const usedRamEl = document.getElementById('used-ram');
    const totalRamEl = document.getElementById('total-ram');
    const usedRamPercentEl = document.getElementById('used-ram-percent');
    const uptimeEl = document.getElementById('uptime');
    const osInfoEl = document.getElementById('os-info');
    const collectNowBtn = document.getElementById('collect-now-btn');
    const statusMessageEl = document.getElementById('status-message');

    const batteryCardEl = document.getElementById('battery-card');
    const batteryPercentEl = document.getElementById('battery-percent');
    const batteryStatusEl = document.getElementById('battery-status');
    const batteryTimeEl = document.getElementById('battery-time');
    const batteryHealthEl = document.getElementById('battery-health');

    // Removed GPU elements

    const diskCardEl = document.getElementById('disk-card');
    const diskNameEl = document.getElementById('disk-name');
    const diskUsePercentEl = document.getElementById('disk-use-percent');

    const networkCardEl = document.getElementById('network-card');
    const netIfaceEl = document.getElementById('net-iface');
    const netRxSecEl = document.getElementById('net-rx-sec');
    const netTxSecEl = document.getElementById('net-tx-sec');

    // Removed Process elements

    const defaultVal = '--';

    function updateMetricsDisplay(metrics) {
        cpuLoadEl.textContent = `${metrics.cpuLoad ?? defaultVal} %`;
        usedRamEl.textContent = metrics.usedRamMB ?? defaultVal;
        totalRamEl.textContent = metrics.totalRamMB ?? defaultVal;
        usedRamPercentEl.textContent = metrics.usedRamPercent ?? defaultVal;
        uptimeEl.textContent = `${metrics.uptimeHours ?? defaultVal} hours`;
        osInfoEl.textContent = `${metrics.osPlatform || ''} ${metrics.osDistro || ''} ${metrics.osRelease || ''}`.trim() || defaultVal;

        if (metrics.hasBattery) {
            batteryCardEl.style.display = 'flex';
            batteryPercentEl.textContent = `${metrics.batteryPercent ?? defaultVal} %`;
            batteryStatusEl.textContent = metrics.isCharging ? 'Charging' : 'Discharging';
            if (metrics.timeRemaining !== null && metrics.timeRemaining > 0) {
                 const hours = Math.floor(metrics.timeRemaining / 60);
                 const minutes = metrics.timeRemaining % 60;
                 batteryTimeEl.textContent = `Time remaining: ${hours}h ${minutes}m`;
            } else if (metrics.isCharging) {
                 batteryTimeEl.textContent = 'Calculating time...';
            } else {
                 batteryTimeEl.textContent = 'Time remaining: --';
            }
            batteryHealthEl.textContent = `Health: ${metrics.batteryHealth ?? defaultVal} %`;
        } else {
            batteryCardEl.style.display = 'none';
        }

        // Removed GPU update logic

        if (metrics.diskName && metrics.diskName !== 'N/A') {
            diskCardEl.style.display = 'flex';
            diskNameEl.textContent = metrics.diskName;
            diskUsePercentEl.textContent = metrics.diskUsePercent ?? defaultVal;
        } else {
            diskCardEl.style.display = 'none';
        }

         if (metrics.netIface && metrics.netIface !== 'N/A') {
            networkCardEl.style.display = 'flex';
            netIfaceEl.textContent = metrics.netIface;
            netRxSecEl.textContent = metrics.netRxSec ?? defaultVal;
            netTxSecEl.textContent = metrics.netTxSec ?? defaultVal;
        } else {
            networkCardEl.style.display = 'none';
        }

        // Removed Top Processes update logic
    }

    async function fetchMetrics(endpoint = '/metrics') {
        try {
            collectNowBtn.disabled = true;
            statusMessageEl.textContent = endpoint === '/collect' ? 'Collecting fresh metrics...' : 'Fetching latest metrics...';

            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const metricsData = endpoint === '/collect' ? data.metrics : data;

            if (Object.keys(metricsData).length === 0) {
                 statusMessageEl.textContent = 'No metrics data received yet. Click "Collect Now".';
            } else {
                updateMetricsDisplay(metricsData);
                statusMessageEl.textContent = `Metrics updated: ${new Date().toLocaleTimeString()}`;
            }

        } catch (error) {
            console.error('Error fetching metrics:', error);
            statusMessageEl.textContent = `Error fetching metrics: ${error.message}`;
        } finally {
            collectNowBtn.disabled = false;
        }
    }

    collectNowBtn.addEventListener('click', () => {
        fetchMetrics('/collect');
    });

    fetchMetrics('/metrics');
});
