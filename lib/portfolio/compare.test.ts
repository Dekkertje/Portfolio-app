import { describe, expect, it } from "vitest"
import { compareWithBenchmark } from "./compare"

describe("compareWithBenchmark", () => {
  it("zet tijdgewogen rendement naast het indexrendement, beide vanaf 0", () => {
    const points = [
      { d: "2026-01-02", v: 1000, f: 1000 }, // nulpunt: geldstroom telt niet
      { d: "2026-01-05", v: 1100, f: 0 },
      { d: "2026-01-06", v: 2200, f: 1100 }, // storting telt niet als rendement
    ]
    const closes: [string, number][] = [
      ["2026-01-01", 50],
      ["2026-01-02", 100],
      ["2026-01-05", 105],
      // 6 januari ontbreekt (feestdag): laatst bekende slot telt
    ]
    const r = compareWithBenchmark(points, closes)
    expect(r.map((p) => p.d)).toEqual(["2026-01-02", "2026-01-05", "2026-01-06"])
    expect(r[0]).toEqual({ d: "2026-01-02", mine: 0, bench: 0 })
    expect(r[1].mine).toBeCloseTo(0.1, 10)
    expect(r[1].bench).toBeCloseTo(0.05, 10)
    expect(r[2].mine).toBeCloseTo(0.1, 10)
    expect(r[2].bench).toBeCloseTo(0.05, 10)
  })

  it("geen indexkoers vóór de start: bench is null", () => {
    const r = compareWithBenchmark([{ d: "2026-01-02", v: 1, f: 1 }], [["2026-02-01", 10]])
    expect(r[0].bench).toBeNull()
  })
})
