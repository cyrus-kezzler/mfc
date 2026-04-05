'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PRICING_PRODUCTS,
  DEFAULT_CONFIG,
  PricingConfig,
  PricingProduct,
  calcWholesale,
  calcRetailerPrice,
  passesRetailerTest,
  calcMargin,
} from '@/lib/pricing-data'

// ─── Helpers ────────────────────────────────────────────────────────────────

const GBP = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n)

const STORAGE_CONFIG_KEY = 'mfc_pricing_config'
const STORAGE_COGS_KEY = 'mfc_pricing_cogs_overrides'
const STORAGE_RRP_KEY = 'mfc_pricing_rrp_overrides'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Overrides {
  [id: string]: { cogs?: number; rrp?: number }
}

interface PendingChange {
  id: string
  name: string
  size: string
  field: 'cogs' | 'rrp'
  oldValue: number
  newValue: number
}

// ─── Styles (inline, matches dashboard dark theme) ───────────────────────────

const S = {
  page: {
    background: '#0a0a0a',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
    color: '#fff',
    padding: '0 0 60px',
  } as React.CSSProperties,
  header: {
    borderBottom: '1px solid #222',
    padding: '24px 32px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.3px' },
  sub: { fontSize: 13, color: '#666', marginTop: 3 },
  badge: (ok: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    background: ok ? '#1e4d2b' : '#5c1a1a',
    color: ok ? '#4caf50' : '#ef5350',
  } as React.CSSProperties),
  section: {
    margin: '24px 32px 0',
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#555',
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    fontWeight: 600,
  },
  card: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '16px 20px',
  },
  assumptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  assumptionLabel: { fontSize: 12, color: '#888', minWidth: 120 },
  input: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 4,
    color: '#4FC3F7',
    fontSize: 13,
    fontWeight: 600,
    padding: '5px 10px',
    width: 80,
    textAlign: 'center' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  th: {
    padding: '8px 12px',
    background: '#C9A84C',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  thRight: {
    padding: '8px 12px',
    background: '#C9A84C',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: (even: boolean) => ({
    padding: '9px 12px',
    background: even ? '#111' : '#161616',
    borderBottom: '1px solid #1e1e1e',
    verticalAlign: 'middle' as const,
  }),
  tdRight: (even: boolean) => ({
    padding: '9px 12px',
    background: even ? '#111' : '#161616',
    borderBottom: '1px solid #1e1e1e',
    textAlign: 'right' as const,
    verticalAlign: 'middle' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  }),
  editInput: {
    background: '#1a1a1a',
    border: '1px solid #4FC3F7',
    borderRadius: 3,
    color: '#4FC3F7',
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 6px',
    width: 72,
    textAlign: 'right' as const,
  },
  passTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    background: '#1e4d2b',
    color: '#4caf50',
  },
  failTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    background: '#5c1a1a',
    color: '#ef5350',
  },
  btn: (variant: 'primary' | 'ghost' | 'danger') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: variant === 'ghost' ? '1px solid #333' : 'none',
    background: variant === 'primary' ? '#C9A84C' : variant === 'danger' ? '#5c1a1a' : '#1a1a1a',
    color: variant === 'primary' ? '#0a0a0a' : variant === 'danger' ? '#ef5350' : '#ccc',
    transition: 'opacity 0.15s',
  } as React.CSSProperties),
  modal: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24,
  },
  modalBox: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '28px 32px',
    maxWidth: 560,
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  },
}

// ─── Main component ────────────────────────────────────────────────────────

export default function PricingClient() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'cogs' | 'rrp' } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showShopifyPanel, setShowShopifyPanel] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [filterFails, setFilterFails] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_CONFIG_KEY)
      if (savedConfig) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) })
      const savedOverrides = localStorage.getItem(STORAGE_COGS_KEY)
      if (savedOverrides) setOverrides(JSON.parse(savedOverrides))
      const savedAt = localStorage.getItem('mfc_pricing_saved_at')
      if (savedAt) setSavedAt(savedAt)
    } catch {}
    setHydrated(true)
  }, [])

  // Merge overrides into products
  const products: PricingProduct[] = PRICING_PRODUCTS.map(p => ({
    ...p,
    cogs: overrides[p.id]?.cogs ?? p.cogs,
    rrp: overrides[p.id]?.rrp ?? p.rrp,
  }))

  const allPass = products.every(p => passesRetailerTest(p, config))
  const failCount = products.filter(p => !passesRetailerTest(p, config)).length
  const displayed = filterFails ? products.filter(p => !passesRetailerTest(p, config)) : products

  // Start editing a cell
  const startEdit = (id: string, field: 'cogs' | 'rrp', currentVal: number) => {
    setEditingCell({ id, field })
    setEditValue(currentVal.toFixed(2))
  }

  // Commit an edit
  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const val = parseFloat(editValue)
    if (isNaN(val) || val <= 0) { setEditingCell(null); return }

    const product = PRICING_PRODUCTS.find(p => p.id === editingCell.id)!
    const currentVal = (overrides[editingCell.id]?.[editingCell.field]) ?? product[editingCell.field]

    if (val !== currentVal) {
      const change: PendingChange = {
        id: editingCell.id,
        name: product.name,
        size: product.size,
        field: editingCell.field,
        oldValue: currentVal,
        newValue: val,
      }
      setPendingChanges(prev => {
        const filtered = prev.filter(c => !(c.id === editingCell.id && c.field === editingCell.field))
        return [...filtered, change]
      })
      setOverrides(prev => ({
        ...prev,
        [editingCell.id]: { ...prev[editingCell.id], [editingCell.field]: val },
      }))
    }
    setEditingCell(null)
  }, [editingCell, editValue, overrides])

  // Save confirmed prices to localStorage
  const handleUpdate = () => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config))
      localStorage.setItem(STORAGE_COGS_KEY, JSON.stringify(overrides))
      const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      localStorage.setItem('mfc_pricing_saved_at', now)
      setSavedAt(now)
      setPendingChanges([])
      setShowUpdateModal(false)
    } catch {}
  }

  // Reset overrides
  const handleReset = () => {
    localStorage.removeItem(STORAGE_CONFIG_KEY)
    localStorage.removeItem(STORAGE_COGS_KEY)
    localStorage.removeItem('mfc_pricing_saved_at')
    setConfig(DEFAULT_CONFIG)
    setOverrides({})
    setPendingChanges([])
    setSavedAt(null)
  }

  // Products whose RRP has been overridden (Shopify needs updating)
  const shopifyChanges = products
    .filter(p => (overrides[p.id]?.rrp ?? null) !== null && overrides[p.id]?.rrp !== PRICING_PRODUCTS.find(x => x.id === p.id)?.rrp)
    .map(p => ({
      product: p,
      originalRrp: PRICING_PRODUCTS.find(x => x.id === p.id)!.rrp,
      newRrp: p.rrp,
    }))

  if (!hydrated) return <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#555' }}>Loading…</div></div>

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Wholesale Pricing</div>
          <div style={S.sub}>
            Single source of truth · {products.length} SKUs ·{' '}
            {savedAt ? `Last saved ${savedAt}` : 'Unsaved — click Update Prices to confirm'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={S.badge(allPass)}>
            {allPass ? `✓ ALL ${products.length} PASS` : `✗ ${failCount} FAIL`}
          </span>
          {pendingChanges.length > 0 && (
            <span style={{ fontSize: 11, color: '#FFC107', letterSpacing: 0.5 }}>
              {pendingChanges.length} unsaved change{pendingChanges.length !== 1 ? 's' : ''}
            </span>
          )}
          <button style={S.btn('ghost')} onClick={() => setShowShopifyPanel(s => !s)}>
            🛒 Shopify Changes
          </button>
          <button
            style={S.btn('primary')}
            onClick={() => pendingChanges.length > 0 ? setShowUpdateModal(true) : handleUpdate()}
          >
            ↑ Update Prices
          </button>
        </div>
      </div>

      {/* ── Assumptions ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Pricing Assumptions</div>
        <div style={S.card}>
          <div style={S.assumptionRow}>
            {[
              { label: 'Markup on COGS', key: 'markup' as const, suffix: '%', scale: 100 },
              { label: 'Retailer Margin', key: 'retailerMargin' as const, suffix: '%', scale: 100 },
              { label: 'VAT Rate', key: 'vat' as const, suffix: '%', scale: 100 },
            ].map(({ label, key, suffix, scale }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={S.assumptionLabel}>{label}</span>
                <input
                  style={S.input}
                  value={((config[key] - 1) * scale).toFixed(0) + suffix}
                  onChange={e => {
                    const raw = parseFloat(e.target.value.replace('%', ''))
                    if (!isNaN(raw) && raw > 0 && raw < 200) {
                      setConfig(c => ({ ...c, [key]: 1 + raw / scale }))
                    }
                  }}
                />
              </div>
            ))}
            <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>
              Formula: Wholesale = COGS × (1 + markup) + Shipping
            </span>
            {pendingChanges.length === 0 && (
              <button style={{ ...S.btn('ghost'), marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }} onClick={handleReset}>
                Reset to defaults
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Shopify panel ── */}
      {showShopifyPanel && (
        <div style={{ ...S.section }}>
          <div style={S.sectionTitle}>Shopify RRP Updates Required</div>
          <div style={S.card}>
            {shopifyChanges.length === 0 ? (
              <div style={{ color: '#555', fontSize: 13 }}>No RRP changes pending — Shopify is in sync.</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Product', 'Size', 'Current RRP', 'New RRP', 'Change'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shopifyChanges.map(({ product, originalRrp, newRrp }, i) => (
                    <tr key={product.id}>
                      <td style={S.td(i % 2 === 0)}>{product.name}</td>
                      <td style={S.td(i % 2 === 0)}>{product.size}</td>
                      <td style={S.tdRight(i % 2 === 0)}>{GBP(originalRrp)}</td>
                      <td style={{ ...S.tdRight(i % 2 === 0), color: '#C9A84C', fontWeight: 700 }}>{GBP(newRrp)}</td>
                      <td style={{ ...S.tdRight(i % 2 === 0), color: newRrp > originalRrp ? '#4caf50' : '#ef5350' }}>
                        {newRrp > originalRrp ? '+' : ''}{GBP(newRrp - originalRrp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14, fontSize: 11, color: '#555' }}>
              Update these prices in Shopify Admin → Products, then mark as done.
            </div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ ...S.section, display: 'flex', alignItems: 'center', gap: 12, marginBottom: -4 }}>
        <div style={S.sectionTitle}>All Products</div>
        <button
          style={{ ...S.btn(filterFails ? 'danger' : 'ghost'), fontSize: 11, padding: '3px 10px', marginTop: -2 }}
          onClick={() => setFilterFails(f => !f)}
        >
          {filterFails ? 'Show all' : `Show fails only`}
        </button>
        <span style={{ fontSize: 11, color: '#555', marginTop: -2 }}>
          Click any COGS or RRP cell to edit · changes are highlighted until you click Update Prices
        </span>
      </div>

      {/* ── Pricing table ── */}
      <div style={{ ...S.section, overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Cocktail</th>
              <th style={S.th}>Size</th>
              <th style={S.thRight}>RRP (inc VAT)</th>
              <th style={S.thRight}>COGS</th>
              <th style={S.thRight}>Shipping</th>
              <th style={S.thRight}>Wholesale</th>
              <th style={S.thRight}>Retailer +30%</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Test</th>
              <th style={S.thRight}>Headroom</th>
              <th style={S.thRight}>Markup %</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p, i) => {
              const ws = calcWholesale(p, config)
              const rp = calcRetailerPrice(ws, config)
              const passes = rp <= p.rrp
              const headroom = Math.round((p.rrp - rp) * 100) / 100
              const margin = calcMargin(p, config)
              const cogsEditing = editingCell?.id === p.id && editingCell?.field === 'cogs'
              const rrpEditing = editingCell?.id === p.id && editingCell?.field === 'rrp'
              const cogsChanged = overrides[p.id]?.cogs !== undefined
              const rrpChanged = overrides[p.id]?.rrp !== undefined
              const even = i % 2 === 0

              return (
                <tr key={p.id}>
                  <td style={{ ...S.td(even), fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...S.td(even), color: '#888' }}>{p.size}</td>

                  {/* RRP — editable */}
                  <td
                    style={{
                      ...S.tdRight(even),
                      cursor: 'pointer',
                      color: rrpChanged ? '#FFC107' : '#4FC3F7',
                      fontWeight: rrpChanged ? 700 : 400,
                    }}
                    title="Click to edit RRP"
                    onClick={() => !rrpEditing && startEdit(p.id, 'rrp', p.rrp)}
                  >
                    {rrpEditing ? (
                      <input
                        autoFocus
                        style={S.editInput}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span>{GBP(p.rrp)}</span>
                    )}
                  </td>

                  {/* COGS — editable */}
                  <td
                    style={{
                      ...S.tdRight(even),
                      cursor: 'pointer',
                      color: cogsChanged ? '#FFC107' : '#4FC3F7',
                      fontWeight: cogsChanged ? 700 : 400,
                    }}
                    title="Click to update COGS"
                    onClick={() => !cogsEditing && startEdit(p.id, 'cogs', p.cogs)}
                  >
                    {cogsEditing ? (
                      <input
                        autoFocus
                        style={S.editInput}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    ) : (
                      <span>{GBP(p.cogs)}</span>
                    )}
                  </td>

                  <td style={{ ...S.tdRight(even), color: '#666' }}>{GBP(p.shipping)}</td>
                  <td style={{ ...S.tdRight(even), fontWeight: 700, color: '#fff' }}>{GBP(ws)}</td>
                  <td style={{ ...S.tdRight(even), color: '#aaa' }}>{GBP(rp)}</td>

                  <td style={{ ...S.td(even), textAlign: 'center' }}>
                    <span style={passes ? S.passTag : S.failTag}>
                      {passes ? 'PASS' : 'FAIL'}
                    </span>
                  </td>

                  <td style={{
                    ...S.tdRight(even),
                    color: headroom < 0.30 ? '#FFC107' : headroom < 0 ? '#ef5350' : '#4caf50',
                    fontWeight: headroom < 0.50 ? 700 : 400,
                  }}>
                    {headroom >= 0 ? '+' : ''}{GBP(headroom)}
                  </td>

                  <td style={{ ...S.tdRight(even), color: '#888' }}>
                    {margin.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Summary bar ── */}
      <div style={{ margin: '20px 32px 0', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'SKUs', value: products.length.toString() },
          { label: 'All pass', value: allPass ? 'Yes ✓' : `${failCount} fail` },
          {
            label: 'Avg wholesale',
            value: GBP(products.reduce((s, p) => s + calcWholesale(p, config), 0) / products.length),
          },
          {
            label: 'Avg margin',
            value: (products.reduce((s, p) => s + calcMargin(p, config), 0) / products.length).toFixed(1) + '%',
          },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C', marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Update confirmation modal ── */}
      {showUpdateModal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowUpdateModal(false)}>
          <div style={S.modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', marginBottom: 4 }}>Confirm Price Update</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              The following changes will be saved as your confirmed prices.
            </div>
            <table style={{ ...S.table, marginBottom: 20 }}>
              <thead>
                <tr>
                  {['Product', 'Size', 'Field', 'From', 'To'].map(h => (
                    <th key={h} style={{ ...S.th, background: '#1a1a1a', color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingChanges.map((c, i) => (
                  <tr key={`${c.id}-${c.field}`}>
                    <td style={S.td(i % 2 === 0)}>{c.name}</td>
                    <td style={S.td(i % 2 === 0)}>{c.size}</td>
                    <td style={{ ...S.td(i % 2 === 0), color: '#888', textTransform: 'uppercase', fontSize: 10 }}>{c.field}</td>
                    <td style={{ ...S.tdRight(i % 2 === 0), color: '#666' }}>{GBP(c.oldValue)}</td>
                    <td style={{ ...S.tdRight(i % 2 === 0), color: '#C9A84C', fontWeight: 700 }}>{GBP(c.newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!allPass && (
              <div style={{ background: '#5c1a1a', border: '1px solid #8b2020', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#ef5350' }}>
                ⚠ {failCount} product{failCount !== 1 ? 's' : ''} currently fail{failCount === 1 ? 's' : ''} the retailer test. Review before saving.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btn('ghost')} onClick={() => setShowUpdateModal(false)}>Cancel</button>
              <button style={S.btn('primary')} onClick={handleUpdate}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
