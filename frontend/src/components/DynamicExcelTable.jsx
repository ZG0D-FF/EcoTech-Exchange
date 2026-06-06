import React, { useState, useMemo } from 'react';
import { api } from '../utils/api';
import {
  Plus, Trash2, CalculatorIcon, Search, X, ChevronDown,
  SigmaIcon, TableProperties, Filter
} from 'lucide-react';

// ─── Inline style helpers ────────────────────────────────────────────────────
const glass = {
  background: 'rgba(10, 13, 26, 0.65)',
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
};

const selectBase = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f0f4ff',
  padding: '5px 10px',
  borderRadius: '6px',
  fontSize: '11px',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const chipBase = {
  background: 'rgba(0,210,150,0.08)',
  color: '#00d296',
  border: '1px solid rgba(0,210,150,0.2)',
  padding: '3px 10px 3px 8px',
  borderRadius: '99px',
  fontSize: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontWeight: '600',
};

const filterChipBase = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(99,102,241,0.08)',
  border: '1px solid rgba(99,102,241,0.2)',
  borderRadius: '6px',
  padding: '2px 8px',
  gap: '6px',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function DynamicExcelTable({ tableName, tableData, reloadData, EditableCell, sumColumns, isAdmin }) {
  const [activeFilters, setActiveFilters] = useState([]);
  const [activeSumCols, setActiveSumCols] = useState(sumColumns || []);
  const [selectedRows, setSelectedRows] = useState([]);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showTrash, setShowTrash] = useState(false);

  const columns = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    return Object.keys(tableData[0]).filter(col => col !== 'id' && col !== 'password_hash' && col !== 'is_deleted');
  }, [tableData]);

  const numericColumns = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    return columns.filter(col => tableData.some(row => !isNaN(parseFloat(row[col]))));
  }, [columns, tableData]);

  // Cascading filter logic (unchanged)
  const filteredData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    return tableData.filter(row => {
      const isDeleted = String(row.is_deleted) === '1' || String(row.is_deleted) === 'true' || row.is_deleted === true;
      if (isDeleted && !showTrash) return false;

      if (activeFilters.length === 0) return true;
      return activeFilters.every(f => {
        if (!f.value) return true;
        const cellValue = String(row[f.column] || '').toLowerCase();
        return cellValue.includes(f.value.toLowerCase());
      });
    });
  }, [tableData, activeFilters, showTrash]);

  if (!tableData || tableData.length === 0) {
    return (
      <div style={{ ...glass, padding: '24px', textAlign: 'center', color: '#8892b0', fontSize: '13px' }}>
        <TableProperties size={28} strokeWidth={1.5} style={{ margin: '0 auto 10px', opacity: 0.4, display: 'block' }} />
        No data available.{' '}
        <button
          onClick={async () => { await api.addDynamicRow(tableName); reloadData(); }}
          className="edit-btn"
          style={{ marginLeft: '6px' }}
        >
          <Plus size={11} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
          Add First Row
        </button>
      </div>
    );
  }

  const addRow = async () => { await api.addDynamicRow(tableName); reloadData(); };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this row forever?")) return;
    await api.deleteDynamicRow(tableName, id);
    reloadData();
  };

  const restoreRow = async (id) => {
    await api.restoreDynamicRow(tableName, id);
    reloadData();
  };

  const addColumn = async () => {
    const colName = prompt("Enter new column name (no spaces, e.g. 'notes'):");
    if (!colName) return;
    let pwd = null;
    if (!isAdmin) {
      pwd = prompt("SECURITY: You are not an admin. Enter your password to ADD a column to the database:");
      if (!pwd) return;
    }
    try {
      await api.addDynamicColumn(tableName, colName, pwd);
      reloadData();
    } catch(err) {
      alert("Action Rejected: " + (err.detail || err.message));
    }
  };

  const deleteColumn = async (colName) => {
    if (!window.confirm(`Delete entire column '${colName}' and all its data?`)) return;
    let pwd = null;
    if (!isAdmin) {
      pwd = prompt("SECURITY WARNING: Dropping a column deletes data for EVERYONE. Enter your password to proceed:");
      if (!pwd) return;
    }
    try {
      await api.deleteDynamicColumn(tableName, colName, pwd);
      reloadData();
    } catch(err) {
      alert("Action Rejected: " + (err.detail || err.message));
    }
  };

  return (
    <div style={{ ...glass, overflowX: 'auto' }}>
      {/* ── Toolbar ── */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {/* Action buttons */}
        <button onClick={addRow} className="edit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={11} strokeWidth={2} /> Insert Row
        </button>
        <button onClick={addColumn} className="edit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={11} strokeWidth={2} /> Insert Column
        </button>
        {isAdmin && (
          <button onClick={() => setShowTrash(!showTrash)} className="edit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: showTrash ? '#ff4444' : '#8892b0' }}>
            <Trash2 size={11} strokeWidth={2} /> {showTrash ? "Hide Trash" : "View Trash"}
          </button>
        )}

        {/* Sum column selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', paddingLeft: '10px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <SigmaIcon size={13} strokeWidth={1.5} style={{ color: '#00d296', flexShrink: 0 }} />
          <select
            onChange={(e) => {
              const c = e.target.value;
              if (c && !activeSumCols.includes(c)) setActiveSumCols([...activeSumCols, c]);
              e.target.value = "";
            }}
            style={selectBase}
          >
            <option value="">Add column to sum…</option>
            {columns.filter(c => !activeSumCols.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {activeSumCols.map(col => (
            <span key={col} style={chipBase}>
              <SigmaIcon size={10} strokeWidth={2} /> {col}
              <X
                size={11} strokeWidth={2.5}
                style={{ cursor: 'pointer', color: '#8892b0', marginLeft: '2px' }}
                onClick={() => setActiveSumCols(activeSumCols.filter(c => c !== col))}
              />
            </span>
          ))}
        </div>

        {/* Filter selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {activeFilters.map(f => (
            <div key={f.id} style={filterChipBase}>
              <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: '700' }}>{f.column}:</span>
              <input
                type="text"
                id={`filter-${f.id}`}
                name={`filter-${f.column}`}
                value={f.value}
                placeholder="Search…"
                onChange={e => setActiveFilters(activeFilters.map(af => af.id === f.id ? { ...af, value: e.target.value } : af))}
                style={{ background: 'transparent', border: 'none', color: '#f0f4ff', outline: 'none', width: '80px', fontSize: '11px' }}
              />
              <X
                size={12} strokeWidth={2.5}
                style={{ cursor: 'pointer', color: '#f85149' }}
                onClick={() => setActiveFilters(activeFilters.filter(af => af.id !== f.id))}
              />
            </div>
          ))}
          <Filter size={13} strokeWidth={1.5} style={{ color: '#8892b0', flexShrink: 0 }} />
          <select
            onChange={(e) => {
              const c = e.target.value;
              if (c) setActiveFilters([...activeFilters, { id: Date.now(), column: c, value: '' }]);
              e.target.value = "";
            }}
            style={selectBase}
          >
            <option value="">Add filter…</option>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
        <thead>
          <tr>
            {/* Checkbox header */}
            <th style={{ width: '32px', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <input
                type="checkbox"
                id="selectAllRows"
                name="selectAllRows"
                onChange={e => setSelectedRows(e.target.checked ? filteredData.map(r => r.id) : [])}
                checked={selectedRows.length === filteredData.length && filteredData.length > 0}
                style={{ cursor: 'pointer', accentColor: '#00d296' }}
                title="Select All Rows"
              />
            </th>
            {columns.map(col => (
              <th key={col} style={{
                textAlign: 'left', padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                color: '#4d5672', fontSize: '0.68rem', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {col}
                  <X
                    size={10} strokeWidth={2.5}
                    onClick={() => deleteColumn(col)}
                    style={{ cursor: 'pointer', color: 'rgba(248,81,73,0.5)', transition: 'color 0.15s' }}
                    title="Delete Column"
                    onMouseEnter={e => e.currentTarget.style.color = '#f85149'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,81,73,0.5)'}
                  />
                </span>
              </th>
            ))}
            <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#4d5672', fontSize: '0.68rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, i) => {
            const isSelected = selectedRows.includes(row.id);
            const isHovered = hoveredRow === (row.id || i);
            const isDeleted = String(row.is_deleted) === '1' || String(row.is_deleted) === 'true' || row.is_deleted === true;
            return (
              <tr
                key={row.id || i}
                onMouseEnter={() => setHoveredRow(row.id || i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: isSelected
                    ? 'rgba(0,210,150,0.06)'
                    : isHovered
                    ? 'rgba(255,255,255,0.025)'
                    : 'transparent',
                  transition: 'background 0.15s',
                  boxShadow: isHovered ? 'inset 0 0 0 1px rgba(0,210,150,0.05)' : 'none',
                  textDecoration: isDeleted ? 'line-through' : 'none',
                  color: isDeleted ? 'rgba(248,81,73,0.7)' : 'inherit',
                }}
              >
                {/* Row checkbox */}
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    id={`selectRow-${row.id || i}`}
                    name={`selectRow-${row.id || i}`}
                    checked={isSelected}
                    onChange={e => {
                      if (e.target.checked) setSelectedRows([...selectedRows, row.id]);
                      else setSelectedRows(selectedRows.filter(id => id !== row.id));
                    }}
                    style={{ cursor: 'pointer', accentColor: '#00d296' }}
                  />
                </td>
                {columns.map(col => (
                  <td key={col} style={{ padding: '8px 12px' }}>
                    <EditableCell table={tableName} row={row} id={row.id} column={col} value={row[col]} />
                  </td>
                ))}
                <td style={{ padding: '8px 12px' }}>
                  {isDeleted ? (
                    <button
                      onClick={() => restoreRow(row.id)}
                      className="edit-btn"
                      style={{
                        color: '#00d296',
                        borderColor: 'rgba(0,210,150,0.2)',
                        background: 'rgba(0,210,150,0.06)',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <Plus size={11} strokeWidth={1.75} /> Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="edit-btn"
                      style={{
                        color: '#f85149',
                        borderColor: 'rgba(248,81,73,0.2)',
                        background: 'rgba(248,81,73,0.06)',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <Trash2 size={11} strokeWidth={1.75} /> Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <td style={{ padding: '10px 12px' }}></td>
            {columns.map((col, idx) => {
              if (activeSumCols.includes(col)) {
                const rowsToSum = selectedRows.length > 0
                  ? filteredData.filter(r => selectedRows.includes(r.id))
                  : filteredData;
                const total = rowsToSum.reduce((acc, row) => {
                  const val = parseFloat(row[col]);
                  return acc + (isNaN(val) ? 0 : val);
                }, 0);
                return (
                  <td key={col} style={{ padding: '10px 12px', fontWeight: '700', color: '#00d296', fontFamily: 'var(--font-mono)', fontSize: '11px' }} title={selectedRows.length > 0 ? "Sum of Selected Rows" : "Sum of All Rows"}>
                    {total.toFixed(1).replace('.0', '')}
                  </td>
                );
              }
              if (idx === 0) return (
                <td key={col} style={{ padding: '10px 12px', fontWeight: '600', color: '#4d5672', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>
                  {selectedRows.length > 0 ? `SUM (${selectedRows.length})` : 'TOTALS'}
                </td>
              );
              return <td key={col} style={{ padding: '10px 12px' }}></td>;
            })}
            <td style={{ padding: '10px 12px' }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
