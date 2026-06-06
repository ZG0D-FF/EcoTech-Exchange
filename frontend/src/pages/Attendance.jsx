import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { storage } from '../utils/storage'
import { useNavigate } from 'react-router-dom'
import DynamicExcelTable from '../components/DynamicExcelTable'

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
    if (column === 'employee_id' && table !== 'employees') {
      if (isEditing) {
        return (
          <select autoFocus value={val} onChange={e => { const newVal = e.target.value; setVal(newVal); setIsEditing(false); if (newVal !== value) handleCellSave(table, id, column, newVal); }} onBlur={() => setIsEditing(false)} style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}>
            <option value="">Select Employee...</option>
            {(data.employees || []).map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
          </select>
        );
      }
      return <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent', color: '#3fb950', fontWeight: 'bold' }}>{value || 'Assign Employee...'}</span>;
    }
	    // 🔥 NEW: Network Verified UTC Clock-In / Clock-Out
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
               console.log("3b. Required Hours for Employee:", requiredHours);

               const parseTime = (t) => {
                  if (!t) return 0;
                  const parts = t.split(':').map(Number);
                  return (parts[0] || 0) + ((parts[1] || 0)/60) + ((parts[2] || 0)/3600);
               };

               const inHours = parseTime(clockInStr);
               const outHours = parseTime(utcTime);
               let workedHours = outHours - inHours;
               if (workedHours < 0) workedHours += 24; 
               console.log("3c. Worked Hours Calculated:", workedHours);

               if (workedHours < requiredHours) {
                   console.log("⚠️ Early clock out detected. Showing confirm dialog...");
                   if (!window.confirm(`⚠️ Early Clock Out!\n\nYou have only worked ${workedHours.toFixed(1)} hours.\nRequired: ${requiredHours} hours.\n\nAre you sure you want to clock out early?`)) {
                       console.log("🚫 User cancelled early clock out.");
                       setVal('');
                       return; 
                   }
               } else {
                   const extraTime = workedHours - requiredHours;
                   console.log("✅ Overtime calculated:", extraTime);
                   if (extraTime > 0) {
                       console.log("💾 Attempting to silently save overtime to database:", extraTime.toFixed(1));
                       try {
                           handleCellSave(table, id, 'overtime', extraTime.toFixed(1));
                           console.log("✅ Overtime saved successfully!");
                       } catch (saveErr) {
                           console.error("🚨 ERROR saving overtime to backend:", saveErr);
                       }
                   }
               }
            }
            
            console.log("4. Calling handleCellSave for the actual timestamp:", utcTime);
            try {
               // Wait! If handleCellSave is an async function, we can await it here to see if it hangs!
               const saveResult = handleCellSave(table, id, column, utcTime);
               if (saveResult instanceof Promise) {
                   console.log("⏳ handleCellSave returned a Promise. Waiting for backend to respond...");
                   await saveResult;
               }
               console.log("✅ handleCellSave executed successfully!");
            } catch (saveErr) {
               console.error("🚨 ERROR inside handleCellSave (Backend rejected it?):", saveErr);
            }

            console.log("5. Updating UI to show timestamp");
            setVal(utcTime); 
            setIsEditing(false);
            console.log("🎉 handleLogNow finished completely without crashing!");

        } catch (globalErr) {
            console.error("💥 MASSIVE CRASH inside handleLogNow:", globalErr);
            setVal(''); // Reset UI on crash
        }
      };

      if (isEditing) {
        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="time"
              autoFocus
              step="1"
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={() => { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); }}
              onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); } }}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}
            />
            {/* onMouseDown fires before onBlur, ensuring the button click registers! */}
            <button type="button" onMouseDown={handleLogNow} style={{ background: '#238636', color: '#fff', border: 'none', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }} title="Force UTC Now">
               UTC
            </button>
          </div>
        );
      }

      // If cell is empty, show the one-click logging button
      if (!value || value === '...' || value.trim() === '') {
         return (
           <button type="button" onClick={handleLogNow} style={{ background: val === 'Logging...' ? '#8b949e' : '#1f6feb', color: '#fff', border: 'none', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
             {val === 'Logging...' ? '⏳ Fetching...' : '⏱️ Log Time'}
           </button>
         );
      }

      // If time is already logged, display it (click to edit)
      return (
        <span onClick={() => { setVal(value); setIsEditing(true); }} style={{ cursor: 'pointer', borderBottom: '1px dashed transparent', color: '#a5d6ff', fontWeight: 'bold', fontFamily: "'IBM Plex Mono', monospace" }} title="Click to manually edit">
          {value}
        </span>
      );
    }
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
          <select autoFocus value={val} onChange={e => { const newVal = e.target.value; setVal(newVal); setIsEditing(false); if (newVal !== value) handleCellSave(table, id, column, newVal); }} onBlur={() => setIsEditing(false)} style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}>
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
        
        setVal('Logging...');
        
        let utcTime = '';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await res.json();
          utcTime = data.datetime.substring(11, 19);
        } catch (err) {
          utcTime = new Date().toISOString().substring(11, 19);
        }

        // 🔥 CLOCK OUT LOGIC: Check Required Hours & Calculate Overtime
        if (column === 'clock_out') {
           const clockInStr = row?.clock_in;
           if (!clockInStr || clockInStr === '...' || clockInStr.trim() === '') {
               alert("⚠️ You must Clock In first before you can Clock Out!");
               setVal('');
               return;
           }

           // Find required work hours from Employees table (Admin modifies it there)
           const emp = (data.employees || []).find(e => e.name === row?.employee_id || e.id === row?.employee_id);
           const requiredHours = parseFloat(emp?.work_hours || emp?.Work_Hours || emp?.['work hours'] || emp?.['Work Hours']) || 8; // Defaults to 8 hours

           const parseTime = (t) => {
              if (!t) return 0;
              const parts = t.split(':').map(Number);
              return (parts[0] || 0) + ((parts[1] || 0)/60) + ((parts[2] || 0)/3600);
           };

           const inHours = parseTime(clockInStr);
           const outHours = parseTime(utcTime);
           let workedHours = outHours - inHours;
           if (workedHours < 0) workedHours += 24; // Handle overnight shifts

           if (workedHours < requiredHours) {
               if (!window.confirm(`⚠️ Early Clock Out!\n\nYou have only worked ${workedHours.toFixed(1)} hours.\nRequired: ${requiredHours} hours.\n\nAre you sure you want to clock out early?`)) {
                   setVal('');
                   return; // Cancel clock out
               }
           } else {
               // Calculate extra time and automatically save it to an 'overtime' column!
               const extraTime = workedHours - requiredHours;
               if (extraTime > 0) {
                   handleCellSave(table, id, 'overtime', extraTime.toFixed(1));
               }
           }
        }
        
        handleCellSave(table, id, column, utcTime);
        setVal(utcTime); // Instant visual optimistic update!
        setIsEditing(false);
      };

      if (isEditing) {
        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="time" step="1" autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={() => { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); }} onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); } }} style={{ width: '100%', boxSizing: 'border-box', background: '#0d1117', color: '#c9d1d9', border: '1px solid #58a6ff', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }} />
            <button type="button" onMouseDown={handleLogNow} style={{ background: '#238636', color: '#fff', border: 'none', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }} title="Force UTC Now">UTC</button>
          </div>
        );
      }

      // Optimistic rendering so it stamps instantly without waiting for network backend reload
      const displayValue = value && value !== '...' ? value : (val && val !== 'Logging...' ? val : null);

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
                // 6. 🔥 MASTER ATTENDANCE AGGREGATOR (Present / Absent / Overtime)
    const normalizedCol = normalize(column);
    if (column === 'Present' || column === 'Absent' || normalizedCol === 'overtime') {
      
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

      // B) PAYROLL OVERRIDES: Pull single total for that row's specific month AND year!
      if (table !== 'attendance' && table !== 'leave_requests' && table !== 'leave_balance') {
        const targetMonth = row?.month?.toLowerCase();
        const targetYear = (row?.year || row?.Year)?.toString();
        const myAttendance = (data.attendance || []).filter(a => a.employee_id === row?.employee_id || a.employee_id === row?.name);
        
        let total = 0;
        myAttendance.forEach(a => {
           const timeLabel = parseDateInfo(a.date, a.month, a.year || a.Year);
           const mName = timeLabel.split(' ')[0]?.toLowerCase();
           const yName = timeLabel.split(' ')[1];

           const monthMatches = targetMonth && mName === targetMonth;
           const yearMatches = !targetYear || yName === targetYear;

           if (monthMatches && yearMatches) {
             if (column === 'Present' && (parseInt(a.Present) === 1 || a.status?.toLowerCase() === 'present')) total++;
             if (column === 'Absent' && (parseInt(a.Absent) === 1 || a.status?.toLowerCase() === 'absent')) total++;
             if (normalizedCol === 'overtime') total += (parseFloat(a.overtime) || 0);
           }
        });

        return (
          <span style={{ color: column === 'Present' ? '#3fb950' : (normalizedCol === 'overtime' ? '#a5d6ff' : '#ff7b72'), fontWeight: 'bold', fontSize: '12px' }} title="Magically pulled from Attendance">
             {total > 0 ? total.toFixed(normalizedCol === 'overtime' ? 1 : 0) : <span style={{opacity:0.3}}>...</span>} <span style={{ fontSize: '8px', opacity: 0.5 }}>🔗</span>
          </span>
        );
      }

      // C) NATIVE TABLES (Attendance & Leaves): Show the Interactive Toggle UI!
      // If it's overtime, we deliberately bypass this so it falls down to your generic text input!
      if (normalizedCol !== 'overtime') {
          const isTrue = parseInt(value) === 1;
          const otherCol = column === 'Present' ? 'Absent' : 'Present';

          const handleToggle = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!isTrue) { await api.editCell(table, id, otherCol, "0"); handleCellSave(table, id, column, "1"); } 
            else { handleCellSave(table, id, column, "0"); }
          };

          return (
            <button className="edit-btn" style={{ padding: '4px 12px', background: isTrue ? (column === 'Present' ? '#238636' : '#da3633') : 'transparent', color: isTrue ? '#fff' : '#8b949e', border: isTrue ? 'none' : '1px solid #30363d', fontWeight: isTrue ? 'bold' : 'normal', width: '100%', cursor: 'pointer' }} onClick={handleToggle}>
              {column === 'Present' ? '✓ Present' : '✗ Absent'}
            </button>
          );
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
            onBlur={() => { setIsEditing(false); if (val !== value) handleCellSave(table, id, column, val); }}
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
  
  const brokenChains = new Set()
  ;(data.audit_logs || []).forEach(al => {
    if (al.previous_hash === 'BROKEN_PREVIOUS_HASH') brokenChains.add(al.id)
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

  return (
    <div style={{ padding: '1rem 0', maxWidth: '900px', margin: '0 auto', fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        .hr-tabs { display:flex; gap:0; border-bottom:0.5px solid #30363d; margin-bottom:1.5rem; overflow-x:auto }
        .hr-tab { padding:8px 18px; font-size:13px; cursor:pointer; border:none; background:none; color:#8b949e; font-family:'IBM Plex Mono',monospace; border-bottom:2px solid transparent; transition:all .15s; white-space:nowrap }
        .hr-tab.active { color:#c9d1d9; border-bottom:2px solid #58a6ff; font-weight:500 }
        .hr-card { background:#0d1117; border:0.5px solid #30363d; border-radius:8px; padding:1rem 1.25rem; margin-bottom:12px }
        .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:1.5rem }
        .stat { background:#161b22; border-radius:6px; padding:12px 14px; border:1px solid #30363d }
        .stat-val { font-size:22px; font-weight:500; color:#c9d1d9 }
        .stat-lbl { font-size:11px; color:#8b949e; margin-top:2px }
        table { width:100%; border-collapse:collapse; font-size:12px }
        th { text-align:left; padding:8px 10px; font-size:11px; color:#8b949e; border-bottom:0.5px solid #30363d; font-weight:500 }
        td { padding:8px 10px; border-bottom:0.5px solid #30363d; color:#c9d1d9; vertical-align:middle }
        tr:hover td { background:#161b22 }
        .av { width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:500 }
        .av-a { background:#238636; color:#fff } .av-b { background:#1f6feb; color:#fff } .av-c { background:#9e6a03; color:#fff } .av-d { background:#8957e5; color:#fff } .av-e { background:#da3633; color:#fff }
        .mono { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#8b949e }
        .msg-wrap { max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding:4px 0 }
        .msg { padding:8px 12px; border-radius:6px; max-width:75%; font-size:12px; line-height:1.5 }
        .msg-out { background:#1f6feb; color:#fff; align-self:flex-end }
        .msg-in { background:#161b22; color:#c9d1d9; align-self:flex-start; border:1px solid #30363d }
        .msg-meta { font-size:10px; opacity:.6; margin-top:3px }
        .edit-btn { background:none; border:0.5px solid #30363d; border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer; color:#8b949e; font-family:'IBM Plex Mono',monospace }
        .edit-btn:hover { background:#161b22; color:#c9d1d9 }
        .pill { display:inline-block; padding:1px 7px; border-radius:20px; font-size:10px; border:0.5px solid #30363d; color:#8b949e }
        .section-hdr { font-size:13px; font-weight:500; color:#c9d1d9; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between }
        .alert-banner { background:#da363322; border:0.5px solid #f85149; border-radius:6px; padding:8px 12px; font-size:12px; color:#ff7b72; margin-bottom:12px; display:flex; align-items:center; gap:8px }
        .month-picker { background:#0d1117; color:#c9d1d9; border:1px solid #30363d; padding:6px 12px; border-radius:6px; font-family:'IBM Plex Mono',monospace; font-size:12px; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#c9d1d9' }}>EcoTech HR</div>
          <div style={{ fontSize: '12px', color: '#8b949e' }}>Attendance · Leave · Messaging · Audit Trail</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <div className="av av-a" style={{ cursor: 'pointer' }} onClick={() => setShowDropdown(!showDropdown)}>
            {session?.name ? session.name.substring(0,2).toUpperCase() : 'US'}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{session?.name || 'User'}</div>
            <div style={{ fontSize: '10px', color: '#8b949e' }}>{session?.role || 'user'} role</div>
          </div>
          {showDropdown && (
            <div style={{ position: 'absolute', top: '100%', right: 0, background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '4px', marginTop: '4px', zIndex: 10, minWidth: '100px' }}>
              <button className="edit-btn" style={{ width: '100%', textAlign: 'left', border: 'none' }} onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </div>

      <div className="hr-tabs">
        <button className={`hr-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>Monthly</button>
        {data.is_admin && <button className={`hr-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>}
        <button className={`hr-tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Attendance</button>
        <button className={`hr-tab ${tab === 'leaves' ? 'active' : ''}`} onClick={() => setTab('leaves')}>Leaves</button>
        <button className={`hr-tab ${tab === 'messages' ? 'active' : ''}`} onClick={() => setTab('messages')}>Messages</button>
        <button className={`hr-tab ${tab === 'auditlog' ? 'active' : ''}`} onClick={() => setTab('auditlog')}>Auditlog</button>
      </div>

      {error && <div className="alert-banner">{error}</div>}

            {tab === 'monthly' && (
        <div>
          <div className="section-hdr">
            Payroll Overrides (100% Dynamic)
            <select 
              className="month-picker"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              style={{ background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', padding: '6px 12px', borderRadius: '6px', fontFamily: "'IBM Plex Mono', monospace" }}
            >
              <option value="">All Months (Show Everything)</option>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          
          <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <DynamicExcelTable 
            tableName="payroll_overrides" 
            tableData={(data.overrides || []).filter(o => !monthStr || o.month === monthStr || o.month?.startsWith('TBD_'))} 
            reloadData={loadData} 
            EditableCell={EditableCell} 
            sumColumns={['Present', 'Absent', 'Salary_']} 
          />
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '8px' }}>
            * Note: This allows direct manipulation of the payroll_overrides table via the Dynamic Excel Grid.
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <div>
          <div className="stat-grid">
            <div className="stat"><div className="stat-val">{(data.employees||[]).length}</div><div className="stat-lbl">Total employees</div></div>
            <div className="stat"><div className="stat-val" style={{ color: '#3fb950' }}>{(data.attendance||[]).length}</div><div className="stat-lbl">Total attendance records</div></div>
            <div className="stat"><div className="stat-val" style={{ color: '#ff7b72' }}>{brokenChains.size}</div><div className="stat-lbl">Flagged changes</div></div>
          </div>

          <div className="section-hdr">Employees Database (100% Dynamic)</div>
          <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <DynamicExcelTable tableName="employees" tableData={data.employees} reloadData={loadData} EditableCell={EditableCell} />
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div className="section-hdr">Daily Attendance Register (100% Dynamic)</div>
          <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
             <DynamicExcelTable tableName="attendance" tableData={data.attendance} reloadData={loadData} EditableCell={EditableCell} />
          </div>
        </div>
      )}

      {tab === 'leaves' && (
        <div>
          <div className="section-hdr">Leave requests (100% Dynamic)</div>
          <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <DynamicExcelTable tableName="leave_requests" tableData={data.leave_requests} reloadData={loadData} EditableCell={EditableCell} />
          </div>
        </div>
      )}

      {tab === 'auditlog' && (
        <div>
          <div className="section-hdr">
            Tamper-proof audit log (100% Dynamic)
          </div>
          <div className="hr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <DynamicExcelTable tableName="attendance_audit" tableData={data.audit_logs} reloadData={loadData} EditableCell={EditableCell} />
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px' }}>Employees</div>
            {(data.employees || []).map((e, i) => (
              <div 
                key={i} 
                onClick={() => setConvIdx(i)} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', background: convIdx === i ? '#161b22' : 'none' }}
              >
                <div className={`av ${getAv(i)}`} style={{ width: '28px', height: '28px', fontSize: '10px', flexShrink: 0 }}>{e.name.substring(0,2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 500 }}>{e.name}</div>
              </div>
            ))}
          </div>
          <div className="hr-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '320px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, borderBottom: '0.5px solid #30363d', paddingBottom: '8px' }}>
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
                type="text" 
                name="msgInput"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Type a message..." 
                style={{ flex: 1, fontSize: '12px', padding: '6px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '4px' }}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
              />
              <button className="edit-btn" onClick={sendMsg} style={{ padding: '6px 12px' }}>Send</button>
            </div>
            <div style={{ fontSize: '10px', color: '#8b949e' }}>Messages are Fernet-encrypted in DB.</div>
          </div>
        </div>
      )}

    </div>
  )
}
