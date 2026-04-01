export function LoadingSpinner({ message = "Laden..." }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
        <p className="mt-4 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  )
}

