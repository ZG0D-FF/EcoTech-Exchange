import React, { useState } from 'react';
import { api } from '../utils/api';

export default function DynamicExcelTable({ tableName, tableData, reloadData, EditableCell, sumColumns }) {
  const [search, setSearch] = useState('');

  if (!tableData || tableData.length === 0) {
    return (
      <div>
        No data. <button onClick={async () => { await api.addDynamicRow(tableName); reloadData(); }} className="edit-btn">+ Add First Row</button>
      </div>
    );
  }

  // Dynamically map all columns straight from the database
  const columns = Object.keys(tableData[0]).filter(col => col !== 'id' && col !== 'password_hash');

  // Filter the data based on the search box (e.g. filtering by employee_id)
  const filteredData = tableData.filter(row => 
    Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  const addRow = async () => {
    await api.addDynamicRow(tableName);
    reloadData();
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this row forever?")) return;
    await api.deleteDynamicRow(tableName, id);
    reloadData();
  };

  const addColumn = async () => {
    const colName = prompt("Enter new column name (no spaces, e.g. 'notes'):");
    if (!colName) return;
    await api.addDynamicColumn(tableName, colName);
    reloadData();
  };

  const deleteColumn = async (colName) => {
    if (!window.confirm(`Delete entire column '${colName}' and all its data?`)) return;
    await api.deleteDynamicColumn(tableName, colName);
    reloadData();
  };

  return (
    <div style={{ overflowX: 'auto', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #30363d', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={addRow} className="edit-btn" style={{ marginRight: '8px' }}>+ Insert Row</button>
        <button onClick={addColumn} className="edit-btn">+ Insert Column</button>
        <input 
          type="text" 
          placeholder="🔍 Filter Employee ID to calculate exact sum..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: '250px', background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }}
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                {col} 
                <span onClick={() => deleteColumn(col)} style={{ cursor: 'pointer', color: '#ff7b72', marginLeft: '6px' }} title="Delete Column">x</span>
              </th>
            ))}
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #30363d', color: '#8b949e' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, i) => (
            <tr key={row.id || i} style={{ borderBottom: '1px solid #30363d' }}>
              {columns.map(col => (
                <td key={col} style={{ padding: '8px' }}>
                  <EditableCell table={tableName} row={row} id={row.id} column={col} value={row[col]} />
                </td>
              ))}
              <td style={{ padding: '8px' }}>
                <button onClick={() => deleteRow(row.id)} className="edit-btn" style={{ color: '#ff7b72', border: 'none' }}>Delete Row</button>
              </td>
            </tr>
          ))}
          
          {/* 🔥 ONLY show Totals if sumColumns were passed in! */}
          {sumColumns && sumColumns.length > 0 && (
            <tr style={{ background: '#161b22', borderTop: '2px solid #30363d' }}>
              {columns.map((col, idx) => {
                if (sumColumns.includes(col)) {
                  // Calculates sum dynamically based on the filtered rows!
                  const total = filteredData.reduce((acc, row) => acc + (parseFloat(row[col]) || 0), 0);
                  return <td key={col} style={{ padding: '8px', fontWeight: 'bold', color: '#58a6ff' }}>{total}</td>;
                }
                if (idx === 0) return <td key={col} style={{ padding: '8px', fontWeight: 'bold', color: '#8b949e', textAlign: 'right' }}>TOTALS:</td>;
                
                return <td key={col} style={{ padding: '8px' }}></td>;
              })}
              <td style={{ padding: '8px' }}></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}