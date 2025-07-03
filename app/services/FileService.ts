import env from "#start/env";

class FileService {
  readonly #key = env.get("COORDINATOR_API_KEY")
  /** presigned url verify by this node's api key. */
  async verifyPresignedUrl() {
    console.log(this.#key)
    // SOON!
  }
}

export default new FileService();