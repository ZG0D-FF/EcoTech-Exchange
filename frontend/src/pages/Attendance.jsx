import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../utils/api'
import { storage } from '../utils/storage'
import { useNavigate } from 'react-router-dom'
import DynamicExcelTable from '../components/DynamicExcelTable'
import {
  LogIn, LogOut, ArrowLeft, Shield, CalendarDays, Users,
  ClipboardList, MessageCircle, ScrollText, BarChart3,
  AlertCircle, Send, Lock
} from 'lucide-react'

export default function Attendance() {
  const navigate = useNavigate()
  const session = storage.get('session')
  const [showDropdown, setShowDropdown] = useState(false)

  const [tab, setTab] = useState('monthly')
  const [data, setData] = useState({ employees: [], attendance: [], audit_logs: [], messages: [], leave_requests: [], leave_balance: [], overrides: [] })
  const [error, setError] = useState(null)
  const [convIdx, setConvIdx] = useState(0)
  const [msgInput, setMsgInput] = useState("")
    // Extracts the full name of the current month (e.g. "June")
  const [monthStr, setMonthStr] = useState(new Date().toLocaleString('en-US', { month: 'long' }));

  useEffect(() => {
    if (session?.role === 'user') {
      navigate('/')
      return
    }
    loadData()
  }, [])

  const handleLogout = () => {
    storage.clear()
    navigate('/auth')
  }

  const handleClearCache = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/admin/cache/clear`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session?.token
        }
      });
      const resData = await res.json();
      alert(resData.message || resData.detail);
    } catch (e) {
      alert("Failed to clear cache.");
    }
  }

  const loadData = async () => {
    try {
      setError(null)
      const res = await api.getHRDashboard()
      if (res.detail) {
        setError(res.detail)
        return
      }
      setData(res)
    } catch (e) {
      console.error(e)
      setError("Failed to load HR Dashboard. Are you sure you are an Admin?")
    }
  }

  const handleCellSave = async (table, id, column, value) => {
    try {
      await api.editCell(table, id, column, value);
      loadData();
    } catch (e) {
      alert("Failed to update cell");
    }
  }

    const EditableCell = ({ value, table, row, id, column, type = "text" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(value || "");

    if (!data.is_admin) return <span>{value}</span>;

    // 1. 🔥 Employee Dropdown (Changes those random TBD_ IDs into Real Names!)
	
	
	// 🔥 NEW: Native Date Picker
    if (column === 'date') {
      let inputVal = val;
      // Instantly convert any DD-MM-YYYY text into YYYY-MM-DD for the native calendar picker
      if (inputVal && inputVal.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const p = inputVal.split('-');
        inputVal = `${p[2]}-${p[1]}-${p[0]}`;
      }
      
      if (isEditing) {
        return (
          <input
            id={column}
            name={column}
            type="date"
            autoFocus
            value={inputVal}
            onChange={e => setVal(e.target.value)}
            onBlur={() => { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); }}
            onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); } }}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}
          />
        );
      }
      return (
        <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }} title="Click to pick a date">
          {value || <span style={{opacity: 0.3}}>...</span>}
        </span>
      );
    }

    // 2. 🔥 CUSTOM FEATURE: Month Jan-Dec Native Dropdown
    if (column === 'month') {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      if (isEditing) {
        return (
          <select
            id={column}
            name={column}
            autoFocus
            value={val}
            onChange={e => { 
              const newVal = e.target.value;
              setVal(newVal); 
              setIsEditing(false); 
              if (newVal !== value) handleCellSave(table, id, column, newVal); 
            }}
            onBlur={() => setIsEditing(false)}
            style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}
          >
            <option value="">Select Month...</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        );
      }
      return <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }}>{value || '...'}</span>;
    }
	
	// 3. 🔥 NEW: Year Dropdown (e.g., if you add a column named 'year')
    if (column === 'year' || column === 'Year') {
      const years = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];
      if (isEditing) {
        return (
          <select id={column} name={column} autoFocus value={val} onChange={e => { const newVal = e.target.value; setVal(newVal); setIsEditing(false); if (newVal !== value) handleCellSave(table, id, column, newVal); }} onBlur={() => setIsEditing(false)} style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}>
            <option value="">Select Year...</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        );
      }
      return <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent' }}>{value || '...'}</span>;
    }
    const normalize = (str) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); 
	
	// 3.8. 🔥 CUSTOM FEATURE: Smart Clock-In / Clock-Out (Network UTC + Overtime)
    if (column === 'clock_in' || column === 'clock_out') {
      
           const handleLogNow = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("👉 BUTTON CLICKED! Starting handleLogNow for column:", column);
        
        try {
            setVal('Logging...');
            console.log("1. Visual state set to 'Logging...'");
            
            const utcTime = new Date().toLocaleTimeString('en-GB');
            console.log("2. Generated Local Timestamp:", utcTime);

            // CLOCK OUT LOGIC
            if (column === 'clock_out') {
               console.log("3a. Running Clock Out checks...");
               const clockInStr = row?.clock_in;
               
               if (!clockInStr || clockInStr === '...' || clockInStr.trim() === '') {
                   console.warn("❌ ERROR: Clock in is empty!");
                   alert("⚠️ You must Clock In first before you can Clock Out!");
                   setVal('');
                   return;
               }

               const emp = (data.employees || []).find(e => e.name === row?.employee_id || e.id === row?.employee_id);
               const requiredHours = parseFloat(emp?.work_hours || emp?.Work_Hours || emp?.['work hours'] || emp?.['Work Hours']) || 8;

               const parseTime24 = (t) => {
                  if (!t) return 0;
                  const parts = String(t).split(':').map(Number);
                  return (parts[0] || 0) + ((parts[1] || 0)/60) + ((parts[2] || 0)/3600);
               };

               let inHours = parseTime24(clockInStr);
               let outHours = parseTime24(utcTime); 
               
               let workedHours = outHours - inHours;
               if (workedHours < 0) workedHours += 24; 
               
               if (workedHours > 12 && inHours < 12) {
                   workedHours -= 12;
               }

               console.log("3c. Smart Worked Hours Calculated:", workedHours);

               if (workedHours < requiredHours) {
                   if (!window.confirm(`⚠️ Early Clock Out!\n\nYou have only worked ${workedHours.toFixed(1)} hours.\nRequired: ${requiredHours} hours.\n\nAre you sure you want to clock out early?`)) {
                       setVal('');
                       return; 
                   }
               }
               // 🔥 OVERTIME SAVING IS NOW NATIVELY HANDLED BY THE PYTHON BACKEND ON CLOCK-OUT
            }
            
            console.log("4. Calling handleCellSave for the actual timestamp:", utcTime);
            try {
               const saveResult = handleCellSave(table, id, column, utcTime);
               if (saveResult instanceof Promise) {
                   console.log("⏳ handleCellSave returned a Promise. Waiting for backend...");
                   await saveResult;
               }
               console.log("✅ handleCellSave executed successfully!");
            } catch (saveErr) {
               console.error("🚨 ERROR inside handleCellSave (Backend rejected it?):", saveErr);
            }

            console.log("5. Updating UI to show timestamp");
            setVal(utcTime); 
            setIsEditing(false);
            
            // 🔥 INSTANT SUCCESS MESSAGE FOR EMPLOYEES!
            alert(`✅ Action Successful!\nTime logged: ${utcTime}`);
            
            console.log("🎉 handleLogNow finished completely without crashing!");

        } catch (globalErr) {
            console.error("💥 MASSIVE CRASH inside handleLogNow:", globalErr);
            setVal(''); // Reset UI on crash
        }
      };

      if (isEditing) {
        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="time" id={column} name={column} step="1" autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={() => { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); }} onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); } }} style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }} />
            <button type="button" onMouseDown={handleLogNow} style={{ background: '#238636', color: '#fff', border: 'none', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }} title="Force UTC Now">UTC</button>
          </div>
        );
      }

      // Optimistic rendering so it stamps instantly without waiting for network backend reload
      let displayValue = value && value !== '...' ? value : (val && val !== 'Logging...' ? val : null);

      // 🕒 SMART UTC-TO-LOCAL FORMATTER: If the backend gives us an ugly ISO string, make it beautiful!
      if (displayValue && String(displayValue).includes('T')) {
          try {
              // Ensure JavaScript knows it's pure UTC by appending Z if missing
              const safeIso = String(displayValue).endsWith('Z') ? displayValue : displayValue + 'Z';
              const d = new Date(safeIso);
              if (!isNaN(d.getTime())) {
                  displayValue = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              }
          } catch(e) {}
      }

      if (!displayValue) {
         return (
           <button type="button" onClick={handleLogNow} style={{ background: val === 'Logging...' ? '#8b949e' : '#1f6feb', color: '#fff', border: 'none', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
             {val === 'Logging...' ? '⏳ Fetching...' : (column === 'clock_out' ? '🏃 Clock Out' : '⏱️ Clock In')}
           </button>
         );
      }

      return (
        <span onClick={() => { setVal(displayValue); setIsEditing(true); }} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent', color: '#a5d6ff', fontWeight: 'bold', fontFamily: "'IBM Plex Mono', monospace" }} title="Click to manually edit">
          {displayValue}
        </span>
      );
    }

        // 📅 NATIVE DATE PICKER (Universal Brain for ANY Date Format)
      if (column === 'from_date' || column === 'to_date' || column === 'date') {
        
        // 🧠 UNIVERSAL DATE BRAIN: Converts literally anything to YYYY-MM-DD
        const parseDateSmart = (raw) => {
            if (!raw || raw.startsWith('TBD_') || raw === '...') return '';
            
            // Clean the string (replace any slashes with dashes)
            let clean = String(raw).replace(/\//g, '-').trim();
            
            // Format 1: DD-MM-YYYY (e.g. 05-12-2026)
            if (clean.match(/^\d{2}-\d{2}-\d{4}$/)) {
                const parts = clean.split('-');
                return `${parts[2]}-${parts[1]}-${parts[0]}`; // Flip to YYYY-MM-DD
            }
            // Format 2: YYYY-MM-DD (Already perfect)
            if (clean.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return clean;
            }
            // Format 3: D-M-YYYY (e.g. 5-1-2026) -> Pad with zeros
            if (clean.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
                const parts = clean.split('-');
                const d = parts[0].padStart(2, '0');
                const m = parts[1].padStart(2, '0');
                return `${parts[2]}-${m}-${d}`;
            }
            
            // Fallback: Let JavaScript try to magically guess weird text like "May 5, 2026"
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                    return d.toISOString().split('T')[0];
                }
            } catch (e) {}
            
            return ''; // Fail-safe fallback so the UI never crashes
        };

        const safeDateForPicker = parseDateSmart(val);

        if (isEditing) {
          return (
            <input 
              id={column}
              name={column}
              type="date"
              value={safeDateForPicker} 
              autoFocus
              // We save whatever the native picker spits out (which is guaranteed flawless YYYY-MM-DD)
              onChange={e => setVal(e.target.value)}
              onBlur={() => { 
                setIsEditing(false); 
                if (val !== value && val !== '') handleCellSave(table, id, column, val); 
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                   setIsEditing(false); 
                   if (val !== value && val !== '') handleCellSave(table, id, column, val); 
                }
              }}
              style={{ 
                background: 'transparent', color: '#fff', border: '1px solid #30363d', 
                borderRadius: '4px', padding: '2px 6px', fontSize: '11px', outline: 'none',
                colorScheme: 'dark' // Forces the calendar popup to be dark mode!
              }}
            />
          );
        }
        
        return (
          <span 
            onClick={() => setIsEditing(true)}
            style={{ 
              cursor: 'pointer', 
              color: val && !val.startsWith('TBD_') && val !== '...' ? '#7ee787' : '#8b949e', 
              fontWeight: 'bold', borderBottom: '1px dashed #30363d'
            }}
            title="Click to pick a date"
          >
            {val && !val.startsWith('TBD_') && val !== '...' 
              ? val 
              : "📅 Set Date"}
          </span>
        );
      }
	
	// 🏖️ PRE-MADE LEAVE TYPES DROPDOWN
      if (column === 'leave_type') {
        const leaveTypes = ["Casual Leave", "Sick Leave", "Annual Leave", "Unpaid Leave", "Maternity / Paternity"];
        
        if (isEditing) {
          return (
            <select
              value={val && !val.startsWith('TBD_') ? val : ''}
              autoFocus
              onChange={e => {
                setVal(e.target.value);
                setIsEditing(false);
                handleCellSave(table, id, column, e.target.value);
              }}
              onBlur={() => setIsEditing(false)}
              style={{ background: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 4px', fontSize: '11px', outline: 'none' }}
            >
              <option value="" disabled>Select Type...</option>
              {leaveTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          );
        }
        
        return (
          <span 
            onClick={() => setIsEditing(true)}
            style={{ cursor: 'pointer', color: val && !val.startsWith('TBD_') ? '#a5d6ff' : '#8b949e', borderBottom: '1px dashed #a5d6ff' }}
          >
            {val && !val.startsWith('TBD_') ? val : "🏖️ Select Type"}
          </span>
        );
      }
	
	// ⚠️ DYNAMIC 2-WEEK NOTICE PERIOD CHECKER
      if (column === 'notice_check') {
         if (!row || !row.from_date || row.from_date.startsWith('TBD_')) {
             return <span style={{ color: '#8b949e', fontSize: '11px' }}>Waiting for date...</span>;
         }
         
         const today = new Date();
         today.setHours(0, 0, 0, 0); 
         const leaveDate = new Date(row.from_date);
         leaveDate.setHours(0, 0, 0, 0);
         
         const diffTime = leaveDate - today;
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         
         if (diffDays < 14) {
             return (
                 <span style={{ color: '#f85149', fontWeight: 'bold', fontSize: '11px' }} title="Leaves require at least 14 days notice">
                     ❌ Warning: Only {diffDays} days notice (14 required)
                 </span>
             );
         } else {
             return (
                 <span style={{ color: '#3fb950', fontWeight: 'bold', fontSize: '11px' }}>
                     ✅ Good: {diffDays} days notice
                 </span>
             );
         }
      }
	
	// 🔒 BEAUTIFY BLOCKCHAIN HASHES
      if (column === 'previous_hash' || column === 'current_hash') {
         if (!value || value === '...' || value === 'None') return <span style={{ color: '#8b949e' }}>None</span>;
         if (typeof value === 'string' && value.startsWith('GENESIS')) return <span style={{ color: '#3fb950', fontWeight: 'bold' }}>🌱 GENESIS BLOCK</span>;
         
         const hashStr = String(value);
         const displayHash = hashStr.length > 8 ? hashStr.substring(0, 8) + '...' : hashStr;
         return (
             <span title={`Full Hash: ${hashStr}`} style={{ background: '#161b22', color: '#8b949e', padding: '2px 6px', borderRadius: '4px', border: '1px solid #30363d', fontFamily: 'monospace', fontSize: '10px' }}>
                🔒 {displayHash}
             </span>
         );
      }

    // 🕵️ TRANSLATE CHANGED_BY ULID INTO EMPLOYEE NAME
      if (column === 'changed_by') {
         if (!value || (typeof value === 'string' && value.startsWith('TBD_'))) return <span>{value}</span>;
         
         const auditChangedByEmp = (data.employees || []).find(e => e.id === value || e.name === value);
         return (
             <span style={{ color: '#c9d1d9', fontWeight: 'bold' }}>
                {auditChangedByEmp ? `👤 ${auditChangedByEmp.name}` : value}
             </span>
         );
      }

    // 📅 TRANSLATE ATTENDANCE_ID ULID INTO TARGET CONTEXT
      if (column === 'attendance_id') {
         if (!value || (typeof value === 'string' && value.startsWith('TBD_'))) return <span>{value}</span>;
         
         const auditTargetRecord = (data.attendance || []).find(a => a.id === value);
         if (auditTargetRecord) {
             const auditTargetEmp = (data.employees || []).find(e => e.id === auditTargetRecord.employee_id || e.name === auditTargetRecord.employee_id);
             return (
                 <span style={{ color: '#a5d6ff', borderBottom: '1px dotted #a5d6ff' }} title={`Record ID: ${value}`}>
                    🎯 {auditTargetEmp ? auditTargetEmp.name : 'Unknown'} ({auditTargetRecord.date})
                 </span>
             );
         }
         return <span>{value}</span>;
      }
	
	      // 🧑‍💼 RENDER EMPLOYEE ID AS A REAL NAME
      if (column === 'employee_id') {
        // Look up the name matching the ID
        const matchingEmp = (data.employees || []).find(e => e.id === value || e.name === value);
        const displayName = matchingEmp ? matchingEmp.name : value;
        
        if (isEditing) {
          return (
            <select
              value={val && !val.startsWith('TBD_') ? val : ''}
              autoFocus
              onChange={e => {
                setVal(e.target.value);
                setIsEditing(false);
                if (e.target.value !== value) handleCellSave(table, id, column, e.target.value);
              }}
              onBlur={() => setIsEditing(false)}
              style={{ background: '#0d1117', color: '#fff', border: '1px solid #30363d', borderRadius: '4px', padding: '2px 4px', fontSize: '11px', outline: 'none' }}
            >
              <option value="" disabled>Select Employee...</option>
              {(data.employees || []).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          );
        }
        
        return (
          <span 
             onClick={() => setIsEditing(true)} 
             style={{ cursor: 'pointer', color: '#a5d6ff', fontWeight: 'bold', borderBottom: '1px dashed #30363d' }}
          >
             {displayName || "..."}
          </span>
        );
      }
	  
	// 4. 🔥 NEW: Aggregated Monthly Salaries in Dashboard
    // If we are looking at the Employees table, show a sub-row breakdown of all their months!
    if (table === 'employees' && normalize(column) === 'salary') {
      const employeeOverrides = (data.overrides || []).filter(o => o.employee_id === row?.name || o.employee_id === row?.id);
      
      if (employeeOverrides.length > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
            {employeeOverrides.map((o, idx) => {
              // Checks for both lowercase and uppercase year column names
              const rowYear = o.year || o.Year || ''; 
              
              return (
                <div key={idx} style={{ fontSize: '10px', color: '#a5d6ff', background: '#161b22', padding: '3px 6px', borderRadius: '4px', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8b949e' }}>
                    {o.month || '?'}{rowYear ? ` ${rowYear}` : ''}
                  </span> 
                  <span style={{ fontWeight: 'bold' }}>
                    {o.Salary_ || o.salary || o.Salary || '0'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }
      return <span style={{ opacity: 0.5, fontSize: '11px' }}>No data in Payroll tab</span>;
    }
    
	// 5. MAGIC RELATIONAL LINKAGE CHECKER
    const empTableCols = data.employees && data.employees.length > 0 ? Object.keys(data.employees[0]) : [];
    // 🔥 We explicitly EXCLUDE "salary", "present", and "absent" from being hijacked globally!
    const matchedEmpCol = empTableCols.find(c => 
      normalize(c) === normalize(column) && 
      normalize(c) !== 'salary' && 
      normalize(c) !== 'present' && 
      normalize(c) !== 'absent' &&
      normalize(c) !== 'overtime'
    );

    if (table !== 'employees' && matchedEmpCol && (row?.employee_id || row?.name)) {
      const emp = data.employees.find(e => e.name === row.employee_id || e.id === row.employee_id || e.name === row.name);
      
      if (emp) {
        const linkedValue = emp[matchedEmpCol];
        if (isEditing) {
           // Gather all previously used values for this specific column!
           const listId = `datalist-linked-${column}`;
           const uniqueVals = Array.from(new Set((data.employees || []).map(r => r[matchedEmpCol]).filter(v => v && typeof v === 'string' && v.trim() !== '')));
           
           return (
             <>
               <input 
                 id={column}
                 name={column}
                 list={uniqueVals.length > 0 ? listId : undefined}
                 autoComplete="off"
                 autoFocus value={val} onChange={e => setVal(e.target.value)}
                 onBlur={() => { setIsEditing(false); if (val !== linkedValue) handleCellSave('employees', emp.id, matchedEmpCol, val); }}
                 onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== linkedValue) handleCellSave('employees', emp.id, matchedEmpCol, val); } }}
                 style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: 'none', borderBottom: '1px solid #58a6ff', outline: 'none', padding: '2px 0', fontSize: '11px', fontFamily: 'inherit' }}
               />
               {/* This injects the invisible native dropdown below your cursor! */}
               {uniqueVals.length > 0 && <datalist id={listId}>{uniqueVals.map(uv => <option key={uv} value={uv} />)}</datalist>}
             </>
           );
        }
        return (
          <span onClick={() => { setVal(linkedValue || ''); setIsEditing(true); }} style={{ cursor: 'pointer', color: '#a5d6ff', display: 'inline-block', width: '100%', minHeight: '18px', borderBottom: '1px dashed transparent' }} title={`Linked to Employees Database (${matchedEmpCol})`}>
            {linkedValue || <span style={{opacity: 0.3}}>...</span>}
            <span style={{ fontSize: '8px', marginLeft: '6px', opacity: 0.6 }}>🔗</span>
          </span>
        );
      }
    }
                 // 6. 🔥 MASTER ATTENDANCE AGGREGATOR (Sync-Brain & Dual-Brain)
    const normalizedCol = normalize(column);
    const isPresentCol = column === 'Present' || column === 'present_override';
    const isAbsentCol = column === 'Absent' || column === 'absent_override';
    
    if (isPresentCol || isAbsentCol || normalizedCol === 'overtime') {
      
      const parseDateInfo = (dateStr, existingMonth, existingYear) => {
        let m = existingMonth || ''; let y = existingYear || '';
        if (dateStr && !dateStr.startsWith('TBD')) {
           let safeDateStr = dateStr;
           if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) safeDateStr = `${dateStr.split('-')[2]}-${dateStr.split('-')[1]}-${dateStr.split('-')[0]}`;
           try {
             const d = new Date(safeDateStr);
             if (!isNaN(d.getTime())) {
               if (!m) m = d.toLocaleString('en-US', { month: 'long' });
               if (!y) y = d.getFullYear().toString();
             }
           } catch(e) {}
        }
        return `${m} ${y}`.trim() || 'Unknown Month';
      };
      // 🧠 Helper to cleanly deduce Presence/Absence for math (Respects manual overrides over OCR status)
      const checkStatus = (rowObj, type) => {
         const val = type === 'P' ? rowObj.Present : rowObj.Absent;
         if (val !== undefined && val !== null && val !== '...' && val !== '') {
             return parseInt(val) === 1; // Trust the manual override!
         }
         const rawStatus = rowObj.status?.toLowerCase();
         return type === 'P' ? rawStatus === 'present' : rawStatus === 'absent'; // Fallback to OCR data
      };

      // A) EMPLOYEES DASHBOARD: Show Sub-Row Monthly Totals
      if (table === 'employees') {
        const myAttendance = (data.attendance || []).filter(a => a.employee_id === row?.name || a.employee_id === row?.id);
        const monthlyTotals = {};
        
        myAttendance.forEach(a => {
           const timeLabel = parseDateInfo(a.date, a.month, a.year || a.Year);
           if (!monthlyTotals[timeLabel]) monthlyTotals[timeLabel] = 0;
           
           if (column === 'Present' && (parseInt(a.Present) === 1 || a.status?.toLowerCase() === 'present')) monthlyTotals[timeLabel]++;
           if (column === 'Absent' && (parseInt(a.Absent) === 1 || a.status?.toLowerCase() === 'absent')) monthlyTotals[timeLabel]++;
           if (normalizedCol === 'overtime') monthlyTotals[timeLabel] += (parseFloat(a.overtime) || 0);
        });

        const timeLabels = Object.keys(monthlyTotals);
        if (timeLabels.length > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
              {timeLabels.map((lbl, idx) => (
                <div key={idx} style={{ fontSize: '10px', color: column === 'Present' ? '#3fb950' : (normalizedCol === 'overtime' ? '#a5d6ff' : '#ff7b72'), background: '#161b22', padding: '3px 6px', borderRadius: '4px', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8b949e' }}>{lbl}</span> 
                  <span style={{ fontWeight: 'bold' }}>{monthlyTotals[lbl].toFixed(normalizedCol === 'overtime' ? 1 : 0)} {normalizedCol === 'overtime' ? 'Hrs' : 'Days'}</span>
                </div>
              ))}
            </div>
          );
        }
        return <span style={{ opacity: 0.5, fontSize: '11px' }}>0 {normalizedCol === 'overtime' ? 'Hrs' : 'Days'}</span>;
      }

            // B) MONTHLY / PAYROLL TABLES: Single total pill for that row's specific month
      if (table !== 'attendance' && table !== 'leave_requests' && table !== 'leave_balance') {
        const targetMonth = row?.month?.toLowerCase();
        const targetYear = (row?.year || row?.Year)?.toString();
        const myAttendance = (data.attendance || []).filter(a => a.employee_id === row?.employee_id || a.employee_id === row?.name);
        
        let total = 0;
        myAttendance.forEach(a => {
           const timeLabel = parseDateInfo(a.date, a.month, a.year || a.Year);
           const mName = timeLabel.split(' ')[0]?.toLowerCase();
           const yName = timeLabel.split(' ')[1];

           // Match the row's specific month and year
           if ((!targetMonth || mName === targetMonth) && (!targetYear || yName === targetYear)) {
             if (column === 'Present' && (parseInt(a.Present) === 1 || a.status?.toLowerCase() === 'present')) total++;
             if (column === 'Absent' && (parseInt(a.Absent) === 1 || a.status?.toLowerCase() === 'absent')) total++;
             if (normalizedCol === 'overtime') total += (parseFloat(a.overtime) || 0);
           }
        });

        // Fallback to manual override if typed, otherwise show calculated sum
        const displayValue = (value !== undefined && value !== null && value !== '...' && value !== '') ? parseFloat(value) : total;
        const displayLabel = `${row?.month || 'Month'} ${row?.year || row?.Year || ''}`.trim();

        // 🔥 UI FIX: Render exactly like the dark pill box in the Dashboard!
        return (
          <div style={{ minWidth: '120px', fontSize: '10px', color: column === 'Present' ? '#3fb950' : (normalizedCol === 'overtime' ? '#a5d6ff' : '#ff7b72'), background: '#161b22', padding: '3px 6px', borderRadius: '4px', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8b949e' }}>{displayLabel}</span> 
            <span style={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setIsEditing(true)} title="Click to manually override">
              {displayValue > 0 ? displayValue.toFixed(normalizedCol === 'overtime' ? 1 : 0) : '0'} {normalizedCol === 'overtime' ? 'Hrs' : 'Days'}
            </span>
          </div>
        );
      }

            // C) NATIVE TABLES (Attendance & Leaves): Show the Interactive Toggle UI!
      if (normalizedCol !== 'overtime') {
          // 🔥 SMART SYNC: Check OCR status if manual override is blank
          let isTrue = false;
          if (value !== undefined && value !== null && value !== '' && value !== '...') {
              isTrue = parseInt(value) === 1;
          } else {
              const rawStatus = row?.status?.toLowerCase();
              if (column === 'Present' && rawStatus === 'present') isTrue = true;
              if (column === 'Absent' && rawStatus === 'absent') isTrue = true;
          }

          const otherCol = column === 'Present' ? 'Absent' : 'Present';

          const handleToggle = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!isTrue) { 
                await api.editCell(table, id, otherCol, "0"); 
                handleCellSave(table, id, column, "1"); 
                // 🔥 DUAL LINK: Toggling button updates the Status text
                handleCellSave(table, id, 'status', column === 'Present' ? 'Present' : 'Absent');
            } 
            else { 
                handleCellSave(table, id, column, "0"); 
            }
          };

          return (
            <button className="edit-btn" style={{ padding: '4px 12px', background: isTrue ? (column === 'Present' ? '#238636' : '#da3633') : 'transparent', color: isTrue ? '#fff' : '#8b949e', border: isTrue ? 'none' : '1px solid #30363d', fontWeight: isTrue ? 'bold' : 'normal', width: '100%', cursor: 'pointer' }} onClick={handleToggle}>
              {column === 'Present' ? '✓ Present' : '✗ Absent'}
            </button>
          );
      } 
      
      // 🔥 FIX: IF IT IS OVERTIME, DYNAMICALLY CALCULATE IT FOR ALL ROWS (Even past OCR data!)
      if (table === 'attendance' && normalizedCol === 'overtime') {
          // 1. If it was already saved manually in the database, just show it!
          if (value && value !== '...' && parseFloat(value) > 0) {
              return <span style={{ color: '#a5d6ff', fontWeight: 'bold' }}>{value}</span>;
          }
          
                    // 2. If it is empty, magically calculate it on the fly from the raw clock times!
          const inStr = row?.clock_in;
          const outStr = row?.clock_out;
          
          if (inStr && outStr && inStr !== '...' && outStr !== '...') {
             const emp = (data.employees || []).find(e => e.name === row?.employee_id || e.id === row?.employee_id);
             const requiredHours = parseFloat(emp?.work_hours || emp?.Work_Hours || emp?.['work hours'] || emp?.['Work Hours']) || 8;
             
             // 🧠 SMART AM/PM OCR HEURISTIC 
             const parseTimeSmart = (t) => {
                const parts = String(t).split(':').map(Number);
                return (parts[0] || 0) + ((parts[1] || 0)/60);
             };
             
             let inHours = parseTimeSmart(inStr);
             let outHours = parseTimeSmart(outStr);
             
             // Rule A: If you clock in between 1:00 and 5:59, it's definitely PM
             if (inHours >= 1 && inHours < 6) inHours += 12;
             
             // Rule B: If clock-out is a smaller number than clock-in, it's definitely PM
             if (outHours < inHours && outHours + 12 > inHours) outHours += 12;
             
             // Rule C: If the shift looks ridiculously short (< 4 hours), they probably clocked out in the PM
             if (outHours - inHours > 0 && outHours - inHours < 4) outHours += 12;

             let workedHours = outHours - inHours;
             if (workedHours < 0) workedHours += 24; // Handle actual overnight shifts
             
             const extraTime = workedHours - requiredHours;
             
             if (extraTime > 0) {
                 return (
                     <span style={{ color: '#a5d6ff', fontWeight: 'bold', borderBottom: '1px dotted #a5d6ff' }} title={`Auto-Calculated! Worked ${workedHours.toFixed(1)}h (Required: ${requiredHours}h)`}>
                         {extraTime.toFixed(1)}
                     </span>
                 );
             }
          }
          // If no clock out time exists, or no overtime worked, show the default empty state
          return <span style={{ opacity: 0.3 }}>...</span>;
      }
    }
        // 7. Default Generic Text Input
    if (isEditing) {
      // Find all unique past inputs for this column across ALL databases to power the autocomplete memory bank!
      const listId = `datalist-${table}-${column}`;
      const allRows = [ ...(data.employees || []), ...(data.overrides || []), ...(data.attendance || []), ...(data.leave_requests || []), ...(data.leave_balance || []) ];
      const uniqueVals = Array.from(new Set(allRows.map(r => r[column]).filter(v => v && typeof v === 'string' && v.trim() !== '' && !v.startsWith('TBD'))));
      return (
        <>
          <input
            id={`edit-${table}-${id}-${column}`}
            name={`edit-${table}-${column}`}
            list={uniqueVals.length > 0 ? listId : undefined}
            autoFocus
            autoComplete="off"
            type={type}
            value={val}
            onChange={e => setVal(e.target.value)}
                        onBlur={() => { 
              setIsEditing(false); 
              if (val !== value) { 
                handleCellSave(table, id, column, val);
                // 🔥 DUAL LINK: Typing Status updates the buttons
                if (column === 'status') {
                  const s = val.toLowerCase();
                  if (s === 'present') { handleCellSave(table, id, 'Present', '1'); handleCellSave(table, id, 'Absent', '0'); }
                  else if (s === 'absent') { handleCellSave(table, id, 'Present', '0'); handleCellSave(table, id, 'Absent', '1'); }
                }
              } 
            }}
            onKeyDown={e => { 
              if (e.key === 'Enter') { 
                setIsEditing(false); 
                if (val !== value) { 
                  handleCellSave(table, id, column, val);
                  // 🔥 DUAL LINK: Typing Status updates the buttons
                  if (column === 'status') {
                    const s = val.toLowerCase();
                    if (s === 'present') { handleCellSave(table, id, 'Present', '1'); handleCellSave(table, id, 'Absent', '0'); }
                    else if (s === 'absent') { handleCellSave(table, id, 'Present', '0'); handleCellSave(table, id, 'Absent', '1'); }
                  }
                } 
              } 
            }}
            onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); } }}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}
          />
          {uniqueVals.length > 0 && <datalist id={listId}>{uniqueVals.map(uv => <option key={uv} value={uv} />)}</datalist>}
        </>
      );
    }
    
    return (
      <span onClick={() => setIsEditing(true)} style={{ cursor: 'text', display: 'inline-block', width: '100%', minHeight: '18px', borderBottom: '1px dashed transparent' }} title="Click to edit" onMouseEnter={e => e.target.style.borderBottom = '1px dashed #30363d'} onMouseLeave={e => e.target.style.borderBottom = '1px dashed transparent'}>
        {value || <span style={{opacity: 0.3}}>...</span>}
      </span>
    );
  };

  const getAv = (i) => ['av-a','av-b','av-c','av-d','av-e'][i % 5]
  
  // 🔥 Identify exactly WHO triggered the tampering alerts!
  const brokenChains = new Set()
  const culprits = new Set()
  
  ;(data.audit_logs || []).forEach(al => {
    if (al.previous_hash === 'BROKEN_PREVIOUS_HASH') {
      brokenChains.add(al.id);
      
      // Look up the employee's name using their ID
      const emp = (data.employees || []).find(e => e.id === al.changed_by);
      if (emp) {
         culprits.add(emp.name.split(' ')[0]); // Grab just their first name to keep the UI clean
      } else {
         culprits.add(al.changed_by.substring(0, 5)); // Fallback to ID if name is missing
      }
    }
  })

  const sendMsg = async () => {
    if (!msgInput.trim()) return
    try {
      const receiver = data.employees[convIdx]?.id
      if(!receiver) return
      await api.sendHRMessage({ receiver_id: receiver, body: msgInput })
      setMsgInput('')
      loadData()
    } catch (e) {
      alert("Failed to send")
    }
  }


  // ─── Animation Variants ──────────────────────────────────────────────────
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 18 }
    }
  };

  const tabContentVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
    exit:   { opacity: 0, y: -8, transition: { duration: 0.15 } }
  };

  // ─── Shared input/label style (used in leave form) ───────────────────────
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    color: '#f0f4ff',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '7px 10px',
    fontFamily: 'inherit',
    fontSize: '12px',
    outline: 'none',
    colorScheme: 'dark',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };
  const labelStyle = { fontSize: '10px', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: '600', marginBottom: '4px', display: 'block' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ padding: '1.25rem 0', maxWidth: '960px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      {/* ── Injected CSS Overrides ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap');
        .hr-tabs { display:flex; gap:0; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:1.75rem; overflow-x:auto; }
        .hr-tab { padding:9px 20px; font-size:0.8rem; cursor:pointer; border:none; background:none; color:#4d5672; font-family:'Inter',sans-serif; font-weight:500; border-bottom:2px solid transparent; transition:all 0.2s; white-space:nowrap; letter-spacing:0.01em; }
        .hr-tab:hover { color:#8892b0; }
        .hr-tab.active { color:#f0f4ff; border-bottom:2px solid #00d296; }
        .hr-card { background:rgba(10,13,26,0.65); backdrop-filter:blur(16px) saturate(180%); -webkit-backdrop-filter:blur(16px) saturate(180%); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1rem 1.25rem; margin-bottom:12px; box-shadow:0 4px 24px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.04); transition:border-color 0.2s; }
        .hr-card:hover { border-color:rgba(255,255,255,0.09); }
        .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:1.75rem; }
        .stat { background:rgba(10,13,26,0.65); backdrop-filter:blur(16px); border-radius:10px; padding:14px 16px; border:1px solid rgba(255,255,255,0.06); box-shadow:0 4px 24px rgba(0,0,0,0.4); transition:all 0.25s; }
        .stat:hover { border-color:rgba(0,210,150,0.15); box-shadow:0 4px 24px rgba(0,0,0,0.4),0 0 24px rgba(0,210,150,0.05); }
        .stat-val { font-size:1.5rem; font-weight:700; color:#f0f4ff; letter-spacing:-0.03em; }
        .stat-lbl { font-size:0.68rem; color:#4d5672; margin-top:3px; text-transform:uppercase; letter-spacing:0.07em; }
        table { width:100%; border-collapse:collapse; font-size:0.78rem; }
        th { text-align:left; padding:10px 12px; font-size:0.68rem; color:#4d5672; border-bottom:1px solid rgba(255,255,255,0.06); font-weight:600; text-transform:uppercase; letter-spacing:0.07em; }
        td { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.03); color:#f0f4ff; vertical-align:middle; }
        tr:hover td { background:rgba(255,255,255,0.02); }
        .av { width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:700; }
        .av-a { background:linear-gradient(135deg,#00d296,#00aaff); color:#050810; }
        .av-b { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
        .av-c { background:linear-gradient(135deg,#f0a500,#f59e0b); color:#050810; }
        .av-d { background:linear-gradient(135deg,#8b5cf6,#ec4899); color:#fff; }
        .av-e { background:linear-gradient(135deg,#f85149,#ef4444); color:#fff; }
        .mono { font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:#8892b0; }
        .msg-wrap { max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding:4px 0; }
        .msg { padding:8px 12px; border-radius:8px; max-width:75%; font-size:0.8rem; line-height:1.5; }
        .msg-out { background:linear-gradient(135deg,#6366f1,#7c3aed); color:#fff; align-self:flex-end; }
        .msg-in  { background:rgba(255,255,255,0.04); color:#f0f4ff; align-self:flex-start; border:1px solid rgba(255,255,255,0.07); }
        .msg-meta { font-size:0.62rem; opacity:0.55; margin-top:3px; font-family:'JetBrains Mono',monospace; }
        .edit-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:5px; padding:4px 10px; font-size:0.72rem; cursor:pointer; color:#8892b0; font-family:'Inter',sans-serif; font-weight:500; transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .edit-btn:hover { background:rgba(255,255,255,0.09); color:#f0f4ff; border-color:rgba(255,255,255,0.14); transform:scale(1.02); box-shadow:0 4px 12px rgba(0,0,0,0.3); }
        .edit-btn:active { transform:scale(0.98); }
        .pill { display:inline-block; padding:2px 8px; border-radius:99px; font-size:0.68rem; border:1px solid rgba(255,255,255,0.08); color:#8892b0; }
        .section-hdr { font-size:0.8125rem; font-weight:600; color:#f0f4ff; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; letter-spacing:-0.01em; }
        .alert-banner { background:rgba(248,81,73,0.08); border:1px solid rgba(248,81,73,0.2); border-radius:8px; padding:10px 14px; font-size:0.8rem; color:#f85149; margin-bottom:14px; display:flex; align-items:center; gap:8px; backdrop-filter:blur(8px); }
        .month-picker { background:rgba(255,255,255,0.04); color:#f0f4ff; border:1px solid rgba(255,255,255,0.08); padding:5px 10px; border-radius:5px; font-family:'JetBrains Mono',monospace; font-size:0.72rem; outline:none; cursor:pointer; transition:all 0.2s; }
        .month-picker:focus { border-color:#00d296; box-shadow:0 0 0 3px rgba(0,210,150,0.1); }
        .month-picker option { background:#0a0d1a; }
      `}</style>

      {/* ── Header ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}
      >
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d296, #00aaff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0,210,150,0.3)',
            }}>
              <BarChart3 size={18} strokeWidth={2} color="#050810" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.02em' }}>EcoTech HR</div>
              <div style={{ fontSize: '0.7rem', color: '#4d5672', display: 'flex', gap: '8px', marginTop: '1px' }}>
                {[['attendance', 'Attendance'], ['leaves', 'Leaves'], ['messages', 'Messages'], ['auditlog', 'Auditlog']].map(([t, label]) => (
                  <span key={t} onClick={() => setTab(t)} style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.target.style.color = '#00d296'} onMouseLeave={e => e.target.style.color = '#4d5672'}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="edit-btn" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ArrowLeft size={12} strokeWidth={2} /> Return
          </button>
          {data.is_admin && (
            <button className="edit-btn" onClick={handleClearCache} style={{ color: '#00d296', borderColor: 'rgba(0,210,150,0.25)', background: 'rgba(0,210,150,0.07)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <AlertCircle size={12} strokeWidth={1.75} /> Clear Cache
            </button>
          )}
          <button className="edit-btn" onClick={handleLogout} style={{ color: '#f85149', borderColor: 'rgba(248,81,73,0.25)', background: 'rgba(248,81,73,0.07)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Shield size={12} strokeWidth={1.75} /> Sign Out
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginLeft: '6px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '14px' }}>
            <div className="av av-a">
              {session?.name ? session.name.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f0f4ff', letterSpacing: '-0.01em' }}>{session?.name || 'User'}</div>
              <div style={{ fontSize: '0.65rem', color: '#4d5672', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{session?.role || 'user'}</div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Tab Navigation ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 100 }}
        className="hr-tabs"
      >
        {[
          { key: 'monthly',    label: 'Monthly',    icon: CalendarDays },
          ...(data.is_admin ? [{ key: 'dashboard', label: 'Dashboard', icon: BarChart3 }] : []),
          { key: 'attendance', label: 'Attendance', icon: ClipboardList },
          { key: 'leaves',     label: 'Leaves',     icon: CalendarDays },
          { key: 'messages',   label: 'Messages',   icon: MessageCircle },
          { key: 'auditlog',   label: 'Auditlog',   icon: ScrollText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`hr-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon size={13} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="alert-banner"
        >
          <AlertCircle size={14} strokeWidth={2} /> {error}
        </motion.div>
      )}

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {tab === 'monthly' && (
          <motion.div key="monthly" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <div className="section-hdr">
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CalendarDays size={14} strokeWidth={1.75} style={{ color: '#00d296' }} />
                Payroll Overrides
                <span style={{ fontSize: '0.68rem', color: '#4d5672', fontWeight: 500 }}>100% Dynamic</span>
              </span>
              <select
                className="month-picker"
                value={monthStr}
                onChange={(e) => setMonthStr(e.target.value)}
              >
                <option value="">All Months</option>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
              <DynamicExcelTable
                tableName="payroll_overrides"
                tableData={(data.overrides || []).filter(o => !monthStr || o.month === monthStr || o.month?.startsWith('TBD_')).map(row => {
                  const targetMonth = row?.month?.toLowerCase();
                  const targetYear = (row?.year || row?.Year)?.toString();
                  const myAtt = (data.attendance || []).filter(a => a.employee_id === row?.employee_id || a.employee_id === row?.name);
                  let pTotal = 0; let aTotal = 0;
                  myAtt.forEach(a => {
                    const d = new Date(a.date || new Date());
                    const mName = a.month ? a.month.toLowerCase() : d.toLocaleString('default', { month: 'long' }).toLowerCase();
                    const yName = (a.year || a.Year || d.getFullYear()).toString();
                    if ((!targetMonth || mName === targetMonth) && (!targetYear || yName === targetYear)) {
                      if (parseInt(a.Present) === 1 || a.status?.toLowerCase() === 'present') pTotal++;
                      if (parseInt(a.Absent) === 1 || a.status?.toLowerCase() === 'absent') aTotal++;
                    }
                  });
                  return {
                    ...row,
                    Present: (row.Present !== undefined && row.Present !== null && row.Present !== '') ? row.Present : pTotal,
                    Absent:  (row.Absent  !== undefined && row.Absent  !== null && row.Absent  !== '') ? row.Absent  : aTotal,
                  };
                })}
                reloadData={loadData}
                EditableCell={EditableCell}
                isAdmin={data.is_admin}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: '#4d5672', marginTop: '8px' }}>
              * Direct manipulation of payroll_overrides via Dynamic Excel Grid.
            </div>
          </motion.div>
        )}

        {tab === 'dashboard' && (
          <motion.div key="dashboard" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="stat-grid">
              {[
                { val: (data.employees||[]).length, lbl: 'Total Employees', color: '#f0f4ff', icon: Users },
                { val: (data.attendance||[]).length, lbl: 'Attendance Records', color: '#00d296', icon: ClipboardList },
                {
                  val: brokenChains.size,
                  lbl: 'Flagged Tampering',
                  color: '#f85149',
                  icon: Shield,
                  sub: culprits.size > 0 ? `By: ${Array.from(culprits).join(', ')}` : null
                },
              ].map(({ val, lbl, color, icon: Icon, sub }, i) => (
                <motion.div key={i} variants={itemVariants} className="stat">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div className="stat-val" style={{ color }}>{val}{sub && <span style={{ fontSize: '11px', marginLeft: '6px', color: '#4d5672', fontWeight: 500 }}>{sub}</span>}</div>
                      <div className="stat-lbl">{lbl}</div>
                    </div>
                    <Icon size={18} strokeWidth={1.5} style={{ color, opacity: 0.5 }} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
            <div className="section-hdr">
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Users size={14} strokeWidth={1.75} style={{ color: '#00d296' }} />
                Employees Database
                <span style={{ fontSize: '0.68rem', color: '#4d5672', fontWeight: 500 }}>100% Dynamic</span>
              </span>
            </div>
            <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
              <DynamicExcelTable tableName="employees" tableData={data.employees} reloadData={loadData} EditableCell={EditableCell} isAdmin={data.is_admin} />
            </div>
          </motion.div>
        )}

        {tab === 'attendance' && (
          <motion.div key="attendance" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <div className="section-hdr">
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <ClipboardList size={14} strokeWidth={1.75} style={{ color: '#00d296' }} />
                Daily Attendance Register
                <span style={{ fontSize: '0.68rem', color: '#4d5672', fontWeight: 500 }}>100% Dynamic</span>
              </span>
              {!data.is_admin && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="clock-in-btn"
                    onClick={async () => {
                      try {
                        await api.clockIn('Present');
                        alert('✅ Shift Started! Your row was securely generated.');
                        loadData();
                      } catch(err) {
                        alert('Action Rejected: ' + (err.detail || err.message || 'You may have already clocked in today.'));
                      }
                    }}
                  >
                    <LogIn size={14} strokeWidth={2} />
                    Clock In Now
                  </button>
                  <button
                    className="clock-out-btn"
                    onClick={async () => {
                      const todayStr = new Date().toLocaleDateString('en-CA');
                      const activeRow = (data.attendance || []).find(r => r.date === todayStr || (r.date && r.date.startsWith(todayStr)));
                      if (!activeRow) { alert('⚠️ You must Clock In first before you can Clock Out!'); return; }
                      if (activeRow.clock_out && activeRow.clock_out !== '...' && activeRow.clock_out.trim() !== '') {
                        alert('✅ You have already clocked out today!'); return;
                      }
                      try {
                        await api.clockOut(activeRow.id);
                        alert('✅ Shift Ended! Clock-out time securely logged.');
                        loadData();
                      } catch(err) {
                        alert('Action Rejected: ' + (err.detail || err.message));
                      }
                    }}
                  >
                    <LogOut size={14} strokeWidth={2} />
                    Clock Out Now
                  </button>
                </div>
              )}
            </div>
            <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
              <DynamicExcelTable tableName="attendance" tableData={data.attendance} reloadData={loadData} EditableCell={EditableCell} isAdmin={data.is_admin} />
            </div>
          </motion.div>
        )}

        {tab === 'leaves' && (
          <motion.div key="leaves" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <div className="section-hdr">
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CalendarDays size={14} strokeWidth={1.75} style={{ color: '#00d296' }} />
                Leave Requests
                <span style={{ fontSize: '0.68rem', color: '#4d5672', fontWeight: 500 }}>100% Dynamic</span>
              </span>
            </div>
            {!data.is_admin && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="hr-card"
                style={{ marginBottom: '14px' }}
              >
                <h4 style={{ margin: '0 0 14px 0', color: '#38bdf8', fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <CalendarDays size={15} strokeWidth={1.75} /> Request Time Off
                </h4>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    try {
                      await api.requestLeave({
                        from_date:  fd.get('from_date'),
                        to_date:    fd.get('to_date'),
                        leave_type: fd.get('leave_type'),
                        reason:     fd.get('reason')
                      });
                      alert('✅ Leave request submitted securely!');
                      e.target.reset();
                      loadData();
                    } catch(err) {
                      alert('Action Rejected: ' + (err.detail || err.message));
                    }
                  }}
                  style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>From Date</label>
                    <input id="from_date" name="from_date" type="date" required style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>To Date</label>
                    <input id="to_date" name="to_date" type="date" required style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={labelStyle}>Type</label>
                    <select name="leave_type" required style={inputStyle}>
                      <option value="casual">Casual Leave</option>
                      <option value="sick">Sick Leave</option>
                      <option value="unpaid">Unpaid Leave</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                    <label style={labelStyle}>Reason</label>
                    <input id="reason" name="reason" type="text" placeholder="Brief reason..." required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                      color: '#fff', border: 'none', padding: '8px 18px',
                      borderRadius: '7px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '0.8rem', letterSpacing: '0.01em',
                      boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
                      transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.3)'; }}
                  >
                    <Send size={13} strokeWidth={2} /> Submit Request
                  </button>
                </form>
              </motion.div>
            )}
            <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
              <DynamicExcelTable tableName="leave_requests" tableData={data.leave_requests} reloadData={loadData} EditableCell={EditableCell} isAdmin={data.is_admin} />
            </div>
          </motion.div>
        )}

        {tab === 'auditlog' && (
          <motion.div key="auditlog" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <div className="section-hdr">
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Lock size={14} strokeWidth={1.75} style={{ color: '#00d296' }} />
                Tamper-proof Audit Log
                <span style={{ fontSize: '0.68rem', color: '#4d5672', fontWeight: 500 }}>100% Dynamic</span>
              </span>
            </div>
            <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
              <DynamicExcelTable tableName="attendance_audit" tableData={data.audit_logs} reloadData={loadData} EditableCell={EditableCell} isAdmin={data.is_admin} />
            </div>
          </motion.div>
        )}

        {tab === 'messages' && (
          <motion.div key="messages" variants={tabContentVariants} initial="hidden" animate="visible" exit="exit">
            <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: '12px' }}>
              {/* Employee list */}
              <div style={{ background: 'rgba(10,13,26,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontSize: '0.68rem', color: '#4d5672', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users size={11} strokeWidth={2} /> Employees
                </div>
                {(data.employees || []).map((e, i) => (
                  <div
                    key={i}
                    onClick={() => setConvIdx(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: convIdx === i ? 'rgba(0,210,150,0.08)' : 'transparent',
                      border: convIdx === i ? '1px solid rgba(0,210,150,0.15)' : '1px solid transparent',
                      transition: 'all 0.2s', marginBottom: '2px',
                    }}
                    onMouseEnter={e => { if (convIdx !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (convIdx !== i) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className={`av ${getAv(i)}`} style={{ flexShrink: 0 }}>{e.name.substring(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', fontWeight: 500, color: convIdx === i ? '#f0f4ff' : '#8892b0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                  </div>
                ))}
              </div>

              {/* Chat panel */}
              <div className="hr-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '340px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className={`av ${getAv(convIdx)}`} style={{ width: '24px', height: '24px', fontSize: '0.6rem' }}>
                    {data.employees[convIdx]?.name?.substring(0, 2).toUpperCase()}
                  </div>
                  {data.employees[convIdx]?.name}
                </div>
                <div className="msg-wrap">
                  {(data.messages || []).filter(m => m.sender_id === data.employees[convIdx]?.id || m.receiver_id === data.employees[convIdx]?.id).map((m, i) => (
                    <div key={i} className={`msg ${m.sender_id === data.employees[convIdx]?.id ? 'msg-in' : 'msg-out'}`}>
                      {m.body}
                      <div className="msg-meta">{new Date(m.sent_at).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <input
                    id="msgInput"
                    type="text"
                    name="msgInput"
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    placeholder="Type a message…"
                    style={{
                      flex: 1, fontSize: '0.8rem', padding: '8px 12px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#f0f4ff', borderRadius: '7px', outline: 'none', fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#00d296'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                    onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  />
                  <button
                    className="edit-btn"
                    onClick={sendMsg}
                    style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Send size={12} strokeWidth={2} /> Send
                  </button>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#3d4463', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={10} strokeWidth={2} /> Messages are Fernet-encrypted in DB.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
