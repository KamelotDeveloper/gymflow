import { Copy } from 'lucide-react'

type Props = {
  cbu?: string
  alias?: string
  titular?: string
  cuit?: string
  banco?: string
}

/** Small helper: label + value with copy-to-clipboard button */
function DetailRow({ label, value }: { label: string; value?: string }) {
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-900 dark:text-white font-mono">
          {value ?? <span className="text-gray-400">—</span>}
        </span>
        {value && (
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Copiar"
          >
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function BankTransferDetails({ cbu, alias, titular, cuit, banco }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
      <DetailRow label="CBU" value={cbu} />
      <DetailRow label="Alias" value={alias} />
      <DetailRow label="Titular" value={titular} />
      <DetailRow label="CUIT" value={cuit} />
      <DetailRow label="Banco" value={banco} />
    </div>
  )
}
