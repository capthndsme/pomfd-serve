import env from "#start/env";
import fs from 'fs/promises'
import MainServerAxiosService from "./MainServerAxiosService.js";
class PingService {
  // Your code here

  #booted = false;
  readonly #storageDir = env.get("SERVER_DIR")

  boot() {
    if (this.#booted) return;
    this.#booted = true;
    console.log('PingService has been booted!');
    this.looper();
  }

  async looper() {
    // error first
    const stat = await fs.stat(this.#storageDir);
    if (!stat.isDirectory()) {
      throw new Error("Storage directory is not a directory!");
    }
    try {
      await this.healthChecks();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => this.looper(), 30000);
    }
  }
  async healthChecks() {

    const data = await MainServerAxiosService.get("/coordinator/v1/ping");
    if (data.status === 200) {
      console.log("Main server is up! We Reported Up!");
    } else {
      console.log("Main server is down. We are up or maybe disconnected from the internet?");
    }


  }
}

export default new PingService();