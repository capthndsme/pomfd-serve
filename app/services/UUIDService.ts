class UUIDEncoder {
  private readonly BASE36_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

  /**
   * Encodes a 128-bit UUID into a shorter, URL-safe base-36 string.
   * @param uuid The standard UUID string (e.g., '550e8400-e29b-41d4-a716-446655440000').
   * @returns A compressed base-36 string representation of the UUID.
   */
  public encode(uuid: string): string {
    // 1. Create a BigInt from the 32-character hex value of the UUID.
    const bigIntValue = BigInt('0x' + uuid.replace(/-/g, ''));

    // 2. Convert the BigInt to a base-36 string. This is the encoded result.
    return bigIntValue.toString(36);
  }

  /**
   * Decodes a base-36 string back into its original UUID format.
   * @param encodedUuid The base-36 encoded string.
   * @returns The original, standard-formatted UUID string.
   */
  public decode(encodedUuid: string): string {
    // 1. Convert the base-36 string back to a BigInt.
    // JavaScript's BigInt does not have a built-in parser for arbitrary bases,
    // so we perform the conversion manually.
    let bigIntValue = 0n;
    const base = 36n;
    for (const char of encodedUuid.toLowerCase()) {
      const digit = BigInt(this.BASE36_ALPHABET.indexOf(char));
      if (digit === -1n) {
        throw new Error(`Invalid character in base-36 string: ${char}`);
      }
      bigIntValue = bigIntValue * base + digit;
    }

    // 2. Convert the BigInt to its hexadecimal representation.
    const hex = bigIntValue.toString(16);

    // 3. Pad the hex string with leading '0's to ensure it represents the full 128 bits (32 hex characters).
    const paddedHex = hex.padStart(32, '0');

    // 4. Re-insert the hyphens at the standard UUID positions.
    return [
      paddedHex.substring(0, 8),
      paddedHex.substring(8, 12),
      paddedHex.substring(12, 16),
      paddedHex.substring(16, 20),
      paddedHex.substring(20),
    ].join('-');
  }
}

export default new UUIDEncoder();