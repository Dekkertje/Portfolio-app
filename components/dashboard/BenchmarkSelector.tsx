import { BenchmarkType, getBenchmarkName } from "@/lib/utils"

type BenchmarkSelectorProps = {
  selectedBenchmark: BenchmarkType
  onBenchmarkChange: (benchmark: BenchmarkType) => void
}

const BENCHMARKS: BenchmarkType[] = ['sp500', 'nasdaq100', 'aex', 'msci_world']

export function BenchmarkSelector({ selectedBenchmark, onBenchmarkChange }: BenchmarkSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-[#1a2744] p-1">
      {BENCHMARKS.map((benchmark) => (
        <button
          key={benchmark}
          onClick={() => onBenchmarkChange(benchmark)}
          className={`
            rounded-md px-3 py-1.5 text-xs font-medium transition-all
            ${selectedBenchmark === benchmark
              ? 'bg-white dark:bg-[#1a2744] text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }
          `}
        >
          {getBenchmarkName(benchmark)}
        </button>
      ))}
    </div>
  )
}
