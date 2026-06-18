/**
 * Recursively converts Prisma Decimal objects to plain JS numbers so that
 * NextResponse.json() sends numeric values instead of strings.
 *
 * Safe to call on any object — plain numbers pass through unchanged.
 */
export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      // Prisma Decimal instances are identified by their constructor name.
      // They have a toString() that returns the exact decimal string.
      if (value !== null && typeof value === "object" &&
          value.constructor?.name === "Decimal") {
        return Number(value.toString())
      }
      return value
    })
  )
}
