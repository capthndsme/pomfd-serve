import { lookup } from 'mime-types'
 class MimeService {
  #cache: Map<string, string> = new Map()
  #corrections = new Map([
    ['application/mp4', 'video/mp4'],
    ['application/ogg', 'video/ogg'],
  ])
  #hits: number = 0
  #misses: number = 0
  public get(filePath: string): string {
    if (this.#cache.has(filePath)) {
      this.#hits++
      // every 10th hit, print stats
      if (this.#hits % 50 === 0) {
        this.stat()
      }
      
      return this.#cache.get(filePath)!
    }

    const initialMime = lookup(filePath) || 'application/octet-stream'
    const finalMime = this.#corrections.get(initialMime) || initialMime

    this.#cache.set(filePath, finalMime)
    this.#misses++
    return finalMime
  }

  stat() {
    console.log(`Hits: ${this.#hits}, Misses: ${this.#misses}`)
  }
}

 
export default new MimeService()
