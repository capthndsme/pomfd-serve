import env from '#start/env'
import fs from 'fs/promises'
import disk from 'diskusage'
import MainServerAxiosService from './MainServerAxiosService.js'
import { PingWithInfo } from '../../shared/types/request/PingWithInfo.js'
import { cpus, freemem, networkInterfaces, totalmem } from 'os'
type NetSpeed = {
  rxBps: number // bits per second received
  txBps: number // bits per second sent
  rxMbps: number
  txMbps: number
}

class PingService {
  // Your code here

  #booted = false
  readonly #storageDir = env.get('SERVER_DIR')
  #interface: string | null = null

  boot() {
    if (this.#booted) return
    this.#booted = true
    console.log('PingService has been booted!')
    this.looper()
  }

  async looper() {
    // error first
    const stat = await fs.stat(this.#storageDir)
    // switch iface
    if (!this.#interface) {
      this.#interface = await this.candidateInterface()
    }
 
    
    if (!stat.isDirectory()) {
      throw new Error('Storage directory is not a directory!')
    }
    try {
      await this.healthChecks()
    } catch (e) {
      console.error(e)
    } finally {
      setTimeout(() => this.looper(), 30000)
    }
  }
  async getStorage() {
    const { free, total } = await disk.check(this.#storageDir)
    return {
      free,
      total,
    }
  }
  async getNetworkBytes(iface: string): Promise<{ rx: number; tx: number }> {
    const content = await fs.readFile('/proc/net/dev', 'utf8')
    const line = content.split('\n').find((l) => l.trim().startsWith(iface + ':'))

    if (!line) throw new Error(`Interface ${iface} not found`)

    const [, data] = line.split(':')
    const fields = data.trim().split(/\s+/)
    const rxBytes = parseInt(fields[0])
    const txBytes = parseInt(fields[8])

    return { rx: rxBytes, tx: txBytes }
  }

  async getActualNetworkSpeed(iface = 'eth0', intervalMs = 1000): Promise<NetSpeed> {
    const start = await this.getNetworkBytes(iface)
    await new Promise((res) => setTimeout(res, intervalMs))
    const end = await this.getNetworkBytes(iface)

    const rxDelta = end.rx - start.rx
    const txDelta = end.tx - start.tx

    const rxBps = (rxDelta * 8 * 1000) / intervalMs
    const txBps = (txDelta * 8 * 1000) / intervalMs

    return {
      rxBps,
      txBps,
      rxMbps: rxBps / 1e6,
      txMbps: txBps / 1e6,
    }
  }

  async candidateInterface() {
    const interfaces = networkInterfaces()
    const loadedEnv = env.get('MONITOR_INTERFACE')

    // 1. check for existence
    if (loadedEnv) {
      if (interfaces[loadedEnv]) {
        return loadedEnv
      } else {
        console.warn(
          `Configured MONITOR_INTERFACE "${loadedEnv}" not found. Attempting auto-detection.`
        )
      }
    }

    // 2. Find the first non-internal, non-loopback interface with an IPv4 address
    for (const name in interfaces) {
      const iface = interfaces[name]
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            // Exclude common virtual/loopback interfaces that might have IPv4
            if (name !== 'lo' && !name.startsWith('docker') && !name.startsWith('veth')) {
              console.log(`Auto-detected network interface: ${name}`)
              return name
            }
          }
        }
      }
    }

    // 3. Fallback if no suitable interface is found
    console.warn('No suitable network interface found for monitoring. Defaulting to "eth0".')
    return 'eth0' // Default to eth0 if no better candidate is found
  }

  getCPUMetrics() {
    const cpuList = cpus()
    let idle = 0,
      total = 0

    for (const cpu of cpuList) {
      for (const type in cpu.times) {
        const t = cpu.times[type as keyof typeof cpu.times]
        total += t
      }
      idle += cpu.times.idle
    }

    return { idle, total }
  }

  // find most candidate iface

  async getSystemLoadToPercent(): Promise<number> {
    const start = this.getCPUMetrics()
    await new Promise((resolve) => setTimeout(resolve, 100)) // Wait 100ms
    const end = this.getCPUMetrics()

    const idleDelta = end.idle - start.idle
    const totalDelta = end.total - start.total

    const usage = 100 - (100 * idleDelta) / totalDelta
    return usage // now a percentage from 0 to 100
  }

  async healthChecks() {
    // get the free storage and total
    const { free, total } = await this.getStorage()

    // prepare for reporting
    // this reduces integer size.
    const storageSizeKIB = total / 1024
    const storageFreeKIB = free / 1024

    const ramFreeBytes = freemem()
    const ramTotalBytes = totalmem()

    const cpuUse = await this.getSystemLoadToPercent()

    const networkPerf = await this.getActualNetworkSpeed(this.#interface ?? 'eth0')

    const payload: PingWithInfo = {
      freeKIB: storageFreeKIB,
      totalKiB: storageSizeKIB,
      ramFreeBytes,
      ramTotalBytes,
      cpuUse: cpuUse * 100,
      bwIn: networkPerf.rxBps,
      bwOut: networkPerf.txBps,
    }
    console.log(
      `NodeStats: Storage ${(free / 1e9).toFixed(2)}GB free of ${(total / 1e9).toFixed(2)}GB`
    )
    console.log(`CPU use: ${cpuUse.toFixed(2)}%`)
    console.log(
      `RAM use: ${(ramFreeBytes / 1e9).toFixed(2)}GB of ${(ramTotalBytes / 1e9).toFixed(2)}GB`
    )
    console.log(
      `Network: In ${networkPerf.rxMbps.toFixed(2)} Mbps, Out ${networkPerf.txMbps.toFixed(
        2
      )} Mbps`
    )
    
    const data = await MainServerAxiosService.post('/coordinator/v1/ping-info', payload)
    if (data.status === 200) {
      console.log('Main server is up! We Reported Up!')
    } else {
      console.log('Main server is down. We are up or maybe disconnected from the internet?')
    }
  }
}

export default new PingService()
