// ════════════════════════════════════════════════════════════════
// GUARD
// ════════════════════════════════════════════════════════════════
if (typeof supabase === 'undefined') {
    document.body.innerHTML =
        '<div style="padding:60px;text-align:center;font-family:sans-serif;">' +
        '<h2 style="color:#dc3545;">Cannot load Supabase library</h2>' +
        '<p>Check internet connection and refresh.</p>' +
        '<button onclick="location.reload()" ' +
        'style="padding:10px 24px;background:#0084ff;color:white;' +
        'border:none;border-radius:6px;cursor:pointer;font-size:15px;">' +
        'Refresh</button></div>';
    throw new Error('Supabase SDK missing');
}

// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
var SB = supabase.createClient(
    'https://kprihawipljrltfzpfjd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwcmloYXdpcGxqcmx0ZnpwZmpkIiwi' +
    'cm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzUyMzAsImV4cCI6MjA5MjM1MTIzMH0.' +
    'fHbfVQOmIMOTbjBTG6iy2yrgmo-iZXEe-wNLlAlVtM4'
);

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════
var currentRole    = null;
var currentName    = null;
var selPatientId   = null;   // patient details modal
var editPatientId  = null;   // edit patient modal
var calView        = 'weekly';
var calDate        = new Date();
var apptEditId     = null;
var psTimer        = null;

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function g(id)  { return document.getElementById(id); }
function pad(n) { return String(n).padStart(2,'0'); }

function todayISO() {
    var d = new Date();
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function d2iso(d) {
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function fmt12(t) {
    if (!t) return '—';
    var p = String(t).split(':');
    var h = parseInt(p[0],10), m = parseInt(p[1]||'0',10);
    return (h%12||12)+':'+pad(m)+' '+(h>=12?'PM':'AM');
}
function addMins(t, mins) {
    var p = String(t).split(':');
    var total = parseInt(p[0],10)*60+parseInt(p[1],10)+parseInt(mins,10);
    return pad(Math.floor(total/60)%24)+':'+pad(total%60);
}
function fmtDateLong(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));
    return d.toLocaleDateString('en-HK',{
        weekday:'short',day:'numeric',month:'short',
        year:'numeric',timeZone:'UTC'
    });
}
function esc(s) {
    return String(s||'')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sv(id, val) {
    var e = g(id);
    if (e) e.value = (val === null || val === undefined) ? '' : String(val);
}

// ════════════════════════════════════════════════════════════════
// SCREEN MANAGEMENT
// ════════════════════════════════════════════════════════════════
var SCREENS = ['loginOverlay','dashboardSection',
               'patientSection','appointmentSection'];

function showOnly(id) {
    SCREENS.forEach(function(s) {
        var el = g(s);
        if (el) el.style.display = 'none';
    });
    var target = g(id);
    if (target) {
        target.style.display =
            id === 'loginOverlay' ? 'flex' : 'block';
    }
}

function showLogin() { showOnly('loginOverlay'); }

function showDashboard() {
    showOnly('dashboardSection');
    var bn = g('badgeName'), br = g('badgeRole');
    if (bn) bn.textContent = currentName || '—';
    if (br) br.textContent = currentRole || '—';
}

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {

    showLogin();

    // ── Appointment form setup ────────────────────────────────
    buildTimeSelect('fStart', '09:00');
    sv('fDate', todayISO());
    g('fStart').addEventListener('change', calcEnd);
    g('fDur').addEventListener('change',   calcEnd);
    calcEnd();

    // ── Session check ─────────────────────────────────────────
    SB.auth.getSession().then(function(res) {
        if (res.data && res.data.session) {
            loadProfile(res.data.session.user.id);
        }
    }).catch(function(e) { console.warn('Session:', e); });

    SB.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_IN'  && session) loadProfile(session.user.id);
        if (event === 'SIGNED_OUT')             showLogin();
    });

    // ── Auth ──────────────────────────────────────────────────
    g('loginBtn').addEventListener('click', doLogin);
    g('loginPassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doLogin();
    });
    g('logoutBtn').addEventListener('click', function() {
        SB.auth.signOut().then(function() {
            currentRole = currentName = null;
            showLogin();
        });
    });

    // ── Dashboard cards ───────────────────────────────────────
    g('card-patient').addEventListener('click', function() {
        showOnly('patientSection');
        fetchPatients();
    });
    g('card-appointment').addEventListener('click', function() {
        showOnly('appointmentSection');
        initAppt();
    });
    ['card-consultation','card-drugbook','card-report',
     'card-expenses','card-inventory','card-configuration']
    .forEach(function(id) {
        var c = g(id);
        if (c) c.addEventListener('click', function() {
            alert(id.replace('card-','').charAt(0).toUpperCase()+
                  id.replace('card-','').slice(1)+' — coming soon!');
        });
    });

    // ── Patient section ───────────────────────────────────────
    g('patientBack').addEventListener('click', showDashboard);
    g('mainAddBtn').addEventListener('click',  openAddPatient);
    g('searchInput').addEventListener('input', filterTable);

    g('closeAddPatient').addEventListener('click',
        function(){ closeModal('addPatientModal'); });
    g('closePatientDetails').addEventListener('click',
        function(){ closeModal('patientDetailsModal'); });
    g('closeEditPatient').addEventListener('click',
        function(){ closeModal('editPatientModal'); });
    g('cancelEditBtn').addEventListener('click',
        function(){ closeModal('editPatientModal'); });
    g('edit_deleteBtn').addEventListener('click', deletePatient);
    g('noteSaveBtn').addEventListener('click', saveNote);

    g('patientForm').addEventListener('submit', submitAddPatient);
    g('editPatientForm').addEventListener('submit', submitEditPatient);

    // ── Appointment section ───────────────────────────────────
    g('apptBack').addEventListener('click', showDashboard);
    g('addApptBtn').addEventListener('click', function(){ openApptModal(); });
    g('calAddBtn').addEventListener('click',  function(){ openApptModal(); });
    g('closeApptModal').addEventListener('click',
        function(){ closeModal('apptModal'); });
    g('btnSaveAppt').addEventListener('click', saveAppt);
    g('apptPopupClose').addEventListener('click', function(){
        g('apptPopup').style.display='none';
    });

    document.querySelectorAll('.appt-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchApptTab(btn.dataset.tab);
        });
    });

    g('btnWeek').addEventListener('click', function() {
        calView='weekly';
        g('btnWeek').classList.add('active');
        g('btnMonth').classList.remove('active');
        renderCal();
    });
    g('btnMonth').addEventListener('click', function() {
        calView='monthly';
        g('btnMonth').classList.add('active');
        g('btnWeek').classList.remove('active');
        renderCal();
    });
    g('calPrev').addEventListener('click', function() {
        if (calView==='weekly') calDate.setDate(calDate.getDate()-7);
        else calDate.setMonth(calDate.getMonth()-1);
        renderCal();
    });
    g('calNext').addEventListener('click', function() {
        if (calView==='weekly') calDate.setDate(calDate.getDate()+7);
        else calDate.setMonth(calDate.getMonth()+1);
        renderCal();
    });

    g('psInput').addEventListener('input', function() {
        clearTimeout(psTimer);
        psTimer = setTimeout(doPatientSearch, 280);
    });

    // Close dropdown/popup on outside click
    document.addEventListener('click', function(e) {
        var wrap = document.querySelector('.ps-wrap');
        if (wrap && !wrap.contains(e.target))
            g('psDrop').style.display='none';
        var pop = g('apptPopup');
        if (pop && pop.style.display==='block' &&
            !pop.contains(e.target) &&
            !e.target.classList.contains('appt-pill') &&
            !e.target.classList.contains('chip'))
            pop.style.display='none';
    });

    // Close any modal on backdrop click
    document.querySelectorAll('.modal').forEach(function(m) {
        m.addEventListener('click', function(e) {
            if (e.target === m) m.style.display='none';
        });
    });

}); // end DOMContentLoaded

// ════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════════════════════════
function openModal(id) {
    var m = g(id);
    if (m) m.style.display='block';
}
function closeModal(id) {
    var m = g(id);
    if (m) m.style.display='none';
    if (id==='patientDetailsModal') selPatientId  = null;
    if (id==='editPatientModal')    editPatientId  = null;
    if (id==='apptModal')           apptEditId     = null;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
function doLogin() {
    var email = (g('loginEmail').value||'').trim();
    var pw    = g('loginPassword').value||'';
    var err   = g('loginError');
    if (!email||!pw) {
        err.textContent='⚠️ Enter email and password.';
        err.style.display='block'; return;
    }
    err.style.display='none';
    var btn = g('loginBtn');
    btn.disabled=true; btn.textContent='Logging in…';
    SB.auth.signInWithPassword({email:email,password:pw})
    .then(function(r) {
        btn.disabled=false; btn.textContent='Log In';
        if (r.error) {
            err.textContent='❌ '+r.error.message;
            err.style.display='block'; return;
        }
        loadProfile(r.data.user.id);
    })
    .catch(function(e) {
        btn.disabled=false; btn.textContent='Log In';
        err.textContent='❌ '+e.message;
        err.style.display='block';
    });
}

function loadProfile(uid) {
    SB.from('profiles').select('role,full_name')
        .eq('id',uid).single()
    .then(function(r) {
        if (r.error||!r.data) {
            currentRole='admin'; currentName='User';
        } else {
            currentRole = r.data.role      || 'admin';
            currentName = r.data.full_name || 'User';
        }
        showDashboard();
    })
    .catch(function() {
        currentRole='admin'; currentName='User';
        showDashboard();
    });
}

// ════════════════════════════════════════════════════════════════
// PATIENT NUMBER
// ════════════════════════════════════════════════════════════════
function genPatientNo(cb) {
    SB.from('patients').select('patient_no').then(function(r) {
        var data = r.data||[];
        if (!data.length) { cb('001000'); return; }
        var nums = data.map(function(p){
            return parseInt(p.patient_no,10);
        }).filter(function(n){ return !isNaN(n); });
        cb(nums.length
            ? String(Math.max.apply(null,nums)+1).padStart(6,'0')
            : '001000');
    });
}

function openAddPatient() {
    g('patientForm').reset();
    sv('preview_patientNo','…');
    openModal('addPatientModal');
    genPatientNo(function(no){ sv('preview_patientNo',no); });
}

// ════════════════════════════════════════════════════════════════
// PATIENT — ADD
// ════════════════════════════════════════════════════════════════
function submitAddPatient(e) {
    e.preventDefault();
    genPatientNo(function(no) {
        var payload = {
            patient_no:     no,
            full_name:      (g('fullName').value||'').trim(),
            chinese_name:   (g('chineseName').value||'').trim()||null,
            phone_number:   (g('phone').value||'').trim()||null,
            email:          (g('email').value||'').trim()||null,
            sex:             g('sex').value||null,
            dob:             g('dob').value||null,
            hkid:           (g('hkid').value||'').trim()||null,
            insurance_no:   (g('insuranceNo').value||'').trim()||null,
            occupation:     (g('occupation').value||'').trim()||null,
            address:        (g('address').value||'').trim()||null,
            medical_alerts: (g('alerts').value||'').trim()||null,
            remarks:        (g('remarks').value||'').trim()||null,
        };
        SB.from('patients').insert([payload]).then(function(r) {
            if (r.error) { alert('Error: '+r.error.message); return; }
            closeModal('addPatientModal');
            g('patientForm').reset();
            fetchPatients();
            alert('✅ Patient "'+payload.full_name+'" registered! No: '+no);
        });
    });
}

// ════════════════════════════════════════════════════════════════
// PATIENT — FETCH & RENDER
// ════════════════════════════════════════════════════════════════
function fetchPatients() {
    SB.from('patients').select('*')
        .order('patient_no',{ascending:true})
    .then(function(r) {
        if (r.error) { console.error(r.error); return; }
        renderPatients(r.data||[]);
    });
}

function renderPatients(list) {
    var tb = g('patientTableBody');
    if (!list.length) {
        tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">No patients found.</td></tr>';
        return;
    }
    tb.innerHTML='';
    list.forEach(function(p) {
        var dob='--';
        if (p.dob) {
            var pts=p.dob.split('-');
            dob=pts[2]+'/'+pts[1]+'/'+pts[0];
        }
        var tr=document.createElement('tr');
        tr.innerHTML=
            '<td>'+
                (p.patient_no
                    ? '<span class="pno-badge">#\u00a0'+esc(p.patient_no)+'</span><br>'
                    : '')+
                '<strong>'+esc(p.full_name)+'</strong>'+
                (p.chinese_name
                    ? '<br><small style="color:#999;">'+esc(p.chinese_name)+'</small>'
                    : '')+
            '</td>'+
            '<td>'+esc(p.phone_number||'--')+'</td>'+
            '<td style="white-space:nowrap;">'+dob+'</td>'+
            '<td>'+esc(p.hkid||'--')+'</td>'+
            '<td><small style="color:'+(p.medical_alerts?'var(--danger)':'#bbb')+';">'+
                esc(p.medical_alerts||'None')+'</small></td>'+
            '<td>'+
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
                    '<button class="btn-notes" style="background:#f0f0f0;border:1px solid #ccc;'+
                    'padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;" '+
                    'data-id="'+p.id+'">📋 Notes</button>'+
                    (currentRole!=='nurse'
                        ? '<button class="btn-editp" style="background:var(--primary);color:white;'+
                          'border:none;padding:6px 12px;border-radius:4px;cursor:pointer;'+
                          'font-size:13px;" data-id="'+p.id+'">✏️ Edit</button>'
                        : '')+
                '</div>'+
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('.btn-notes').forEach(function(b){
        b.addEventListener('click',function(){ viewHistory(b.dataset.id); });
    });
    tb.querySelectorAll('.btn-editp').forEach(function(b){
        b.addEventListener('click',function(){ openEditPatient(b.dataset.id); });
    });
}

function filterTable() {
    var q=(g('searchInput').value||'').toLowerCase();
    document.querySelectorAll('#patientTableBody tr').forEach(function(r){
        r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';
    });
}

// ════════════════════════════════════════════════════════════════
// PATIENT — EDIT
// ════════════════════════════════════════════════════════════════
function openEditPatient(id) {
    editPatientId=id;
    SB.from('patients').select('*').eq('id',id).single()
    .then(function(r) {
        if (r.error||!r.data){alert('Could not load patient.');return;}
        var p=r.data;
        sv('edit_patientNo',   p.patient_no||'—');
        sv('edit_fullName',    p.full_name||'');
        sv('edit_chineseName', p.chinese_name||'');
        sv('edit_phone',       p.phone_number||'');
        sv('edit_email',       p.email||'');
        sv('edit_sex',         p.sex||'');
        sv('edit_dob',         p.dob||'');
        sv('edit_hkid',        p.hkid||'');
        sv('edit_insuranceNo', p.insurance_no||'');
        sv('edit_occupation',  p.occupation||'');
        sv('edit_address',     p.address||'');
        sv('edit_alerts',      p.medical_alerts||'');
        sv('edit_remarks',     p.remarks||'');
        openModal('editPatientModal');
    });
}

function submitEditPatient(e) {
    e.preventDefault();
    if (!editPatientId) return;
    var payload={
        full_name:      (g('edit_fullName').value||'').trim(),
        chinese_name:   (g('edit_chineseName').value||'').trim()||null,
        phone_number:   (g('edit_phone').value||'').trim()||null,
        email:          (g('edit_email').value||'').trim()||null,
        sex:             g('edit_sex').value||null,
        dob:             g('edit_dob').value||null,
        hkid:           (g('edit_hkid').value||'').trim()||null,
        insurance_no:   (g('edit_insuranceNo').value||'').trim()||null,
        occupation:     (g('edit_occupation').value||'').trim()||null,
        address:        (g('edit_address').value||'').trim()||null,
        medical_alerts: (g('edit_alerts').value||'').trim()||null,
        remarks:        (g('edit_remarks').value||'').trim()||null,
    };
    SB.from('patients').update(payload).eq('id',editPatientId)
    .then(function(r){
        if (r.error){alert('Error: '+r.error.message);return;}
        closeModal('editPatientModal');
        fetchPatients();
        alert('✅ Patient updated!');
    });
}

function deletePatient() {
    if (currentRole==='nurse'){alert('Permission denied.');return;}
    if (!editPatientId) return;
    var name=g('edit_fullName').value||'this patient';
    var no=g('edit_patientNo').value||'';
    if (!confirm('⚠️ Delete Patient #'+no+' "'+name+'"?\nCannot be undone.')) return;
    SB.from('treatments').delete().eq('patient_id',editPatientId)
    .then(function(){
        return SB.from('patients').delete().eq('id',editPatientId);
    })
    .then(function(r){
        if (r.error){alert('Error: '+r.error.message);return;}
        closeModal('editPatientModal');
        fetchPatients();
        alert('🗑️ Patient deleted.');
    });
}

// ════════════════════════════════════════════════════════════════
// TREATMENT HISTORY
// ════════════════════════════════════════════════════════════════
function viewHistory(pid) {
    selPatientId=pid;
    SB.from('patients').select('*').eq('id',pid).single()
    .then(function(r){
        if (r.error||!r.data){alert('Could not load patient.');return;}
        var p=r.data;
        g('det_patientNo').textContent  = p.patient_no?'# '+p.patient_no:'';
        g('det_patientName').textContent= p.full_name+(p.chinese_name?'  '+p.chinese_name:'');
        g('det_alerts').textContent     = p.medical_alerts?'⚠️  '+p.medical_alerts:'';
        var bs=g('bulkSec');
        if (currentRole!=='nurse') {
            bs.innerHTML=
                '<h3 style="margin-top:0;font-size:16px;">Add Clinical Note</h3>'+
                '<textarea id="bulkNoteInput" rows="3" placeholder="Enter treatment details…"'+
                ' style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;'+
                'font-size:14px;box-sizing:border-box;resize:vertical;"></textarea>'+
                '<button class="btn-add" id="noteSaveBtn" style="margin-top:10px;">Add to History</button>';
            g('noteSaveBtn').addEventListener('click',saveNote);
        } else {
            bs.innerHTML='<p style="color:#888;font-style:italic;margin:0;">🔒 Viewing Mode</p>';
        }
        loadTreatments(pid);
        openModal('patientDetailsModal');
    });
}

function loadTreatments(pid) {
    var tl=g('treatmentTimeline');
    tl.innerHTML='<p style="color:#999;">Loading…</p>';
    SB.from('treatments').select('*').eq('patient_id',pid)
        .order('created_at',{ascending:false})
    .then(function(r){
        if (r.error||!r.data||!r.data.length){
            tl.innerHTML='<p style="color:#999;margin:0;">No treatment history yet.</p>';
            return;
        }
        var todayStr=new Date().toDateString();
        tl.innerHTML='';
        r.data.forEach(function(t){
            var isToday=new Date(t.created_at).toDateString()===todayStr;
            var canEdit=isToday&&currentRole!=='nurse';
            var div=document.createElement('div');
            div.className='note-card';
            div.innerHTML=
                (canEdit
                    ? '<button data-note="'+t.id+'" style="position:absolute;right:12px;top:12px;'+
                      'background:var(--primary);color:white;border:none;padding:4px 10px;'+
                      'border-radius:4px;cursor:pointer;font-size:12px;">✏️ Edit</button>'
                    : '')+
                '<small style="color:#aaa;">'+new Date(t.created_at).toLocaleString()+'</small>'+
                '<div id="nt-'+t.id+'" style="white-space:pre-wrap;margin-top:6px;font-size:14px;">'+
                    esc(t.notes)+'</div>';
            tl.appendChild(div);
            if (canEdit) {
                div.querySelector('button').addEventListener('click',function(){
                    editNote(t.id);
                });
            }
        });
    });
}

function saveNote() {
    var inp=g('bulkNoteInput');
    if (!inp) return;
    var note=inp.value.trim();
    if (!note){alert('Please enter a note.');return;}
    SB.from('treatments').insert([{patient_id:selPatientId,notes:note}])
    .then(function(r){
        if (r.error){alert('Error: '+r.error.message);return;}
        inp.value='';
        loadTreatments(selPatientId);
    });
}

function editNote(nid) {
    var div=g('nt-'+nid);
    if (!div) return;
    var orig=div.innerText.trim();
    div.innerHTML=
        '<textarea id="ei-'+nid+'" style="width:100%;height:80px;padding:8px;border:1px solid #ddd;'+
        'border-radius:6px;font-size:14px;box-sizing:border-box;margin-top:8px;resize:vertical;">'+
        esc(orig)+'</textarea>'+
        '<div style="display:flex;justify-content:space-between;margin-top:8px;">'+
            '<button id="del-'+nid+'" style="background:var(--danger);color:white;border:none;'+
            'padding:6px 14px;border-radius:4px;cursor:pointer;">🗑 Delete</button>'+
            '<div style="display:flex;gap:8px;">'+
                '<button id="can-'+nid+'" style="background:var(--gray);color:white;border:none;'+
                'padding:6px 14px;border-radius:4px;cursor:pointer;">Cancel</button>'+
                '<button id="sav-'+nid+'" style="background:var(--success);color:white;border:none;'+
                'padding:6px 14px;border-radius:4px;cursor:pointer;">💾 Save</button>'+
            '</div>'+
        '</div>';
    g('del-'+nid).addEventListener('click',function(){
        if (!confirm('Delete this note?')) return;
        SB.from('treatments').delete().eq('id',nid).then(function(r){
            if (r.error){alert('Error: '+r.error.message);return;}
            loadTreatments(selPatientId);
        });
    });
    g('can-'+nid).addEventListener('click',function(){ loadTreatments(selPatientId); });
    g('sav-'+nid).addEventListener('click',function(){
        var v=g('ei-'+nid).value.trim();
        SB.from('treatments').update({notes:v}).eq('id',nid).then(function(r){
            if (r.error){alert('Error: '+r.error.message);return;}
            loadTreatments(selPatientId);
        });
    });
}

// ════════════════════════════════════════════════════════════════
// APPOINTMENT MODULE
// ════════════════════════════════════════════════════════════════
function initAppt() {
    var labels={admin:'🛡️ Admin',dentist:'🦷 Dentist',nurse:'🩺 Nurse'};
    g('apptUserName').textContent = currentName||'—';
    g('apptUserRole').textContent = labels[currentRole]||('👤 '+(currentRole||'User'));
    g('apptTodayDate').textContent= new Date().toLocaleDateString('en-HK',{
        weekday:'long',year:'numeric',month:'long',day:'numeric'
    });
    g('todayLabel').textContent = fmtDateLong(todayISO());
    var canAdd = currentRole!=='nurse';
    g('addApptBtn').style.display = canAdd?'inline-block':'none';
    g('calAddBtn').style.display  = canAdd?'inline-block':'none';
    switchApptTab('today');
}

// ── Tabs ──────────────────────────────────────────────────────
function switchApptTab(tab) {
    document.querySelectorAll('.appt-tab').forEach(function(b){
        b.classList.toggle('active', b.dataset.tab===tab);
    });
    document.querySelectorAll('.tab-pane').forEach(function(p){
        p.classList.toggle('active', p.id==='tab-'+tab);
    });
    if (tab==='today')    loadToday();
    if (tab==='queue')    loadQueue();
    if (tab==='calendar') renderCal();
}

// ── Time select ───────────────────────────────────────────────
function buildTimeSelect(selId, def) {
    var sel=g(selId); if (!sel) return;
    sel.innerHTML='';
    for (var h=8;h<=21;h++) {
        for (var m=0;m<60;m+=15) {
            var v=pad(h)+':'+pad(m);
            var o=document.createElement('option');
            o.value=v; o.textContent=fmt12(v);
            if (def&&v===def) o.selected=true;
            sel.appendChild(o);
        }
    }
}
function calcEnd() {
    var s=g('fStart'), d=g('fDur'), e=g('fEnd');
    if (!s||!d||!e) return;
    e.value = fmt12(addMins(s.value, parseInt(d.value,10)));
}

// ── Today ─────────────────────────────────────────────────────
function loadToday() {
    var tb=g('todayBody');
    tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:#aaa;">Loading…</td></tr>';
    SB.from('appointments').select('*')
        .eq('date',todayISO())
        .order('start_time',{ascending:true})
    .then(function(r){
        var data=r.data||[];
        g('todayCount').textContent=data.length+' appt'+(data.length!==1?'s':'');
        if (!data.length) {
            tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:36px;color:#bbb;">No appointments today.</td></tr>';
            return;
        }
        var canEdit=currentRole!=='nurse';
        tb.innerHTML='';
        data.forEach(function(a){
            var tr=document.createElement('tr');
            if (a.arrived) tr.classList.add('arrived');
            tr.innerHTML=
                '<td style="font-weight:600;white-space:nowrap;">'+
                    fmt12(a.start_time)+' – '+fmt12(a.end_time)+
                '</td>'+
                '<td><span class="pno-badge">'+esc(a.patient_no||'—')+'</span></td>'+
                '<td><strong>'+esc(a.patient_name||'—')+'</strong></td>'+
                '<td>'+esc(a.treatment_items||'—')+'</td>'+
                '<td style="color:#777;font-size:13px;">'+esc(a.remarks||'—')+'</td>'+
                '<td>'+(a.duration?a.duration+' min':'—')+'</td>'+
                '<td>'+(a.arrived
                    ? '<span class="badge b-arrived">✅ Arrived</span>'
                    : '<span class="badge b-waiting">Waiting</span>')+
                '</td>'+
                '<td>'+
                    '<div style="display:flex;gap:5px;flex-wrap:wrap;">'+
                        (!a.arrived
                            ? '<button class="btn-sm btn-ci" style="background:#28a745;">✅ Check In</button>'
                            : '<button class="btn-sm" disabled style="background:#ccc;color:#666;cursor:not-allowed;">In Queue</button>')+
                        (canEdit
                            ? '<button class="btn-sm btn-ed" style="background:var(--primary);">✏️</button>'+
                              '<button class="btn-sm btn-dl" style="background:var(--danger);">🗑</button>'
                            : '')+
                    '</div>'+
                '</td>';
            tr.addEventListener('dblclick',function(){ doCheckin(a.id); });
            var ci=tr.querySelector('.btn-ci');
            if (ci) ci.addEventListener('click',function(e){
                e.stopPropagation(); doCheckin(a.id);
            });
            var ed=tr.querySelector('.btn-ed');
            if (ed) ed.addEventListener('click',function(e){
                e.stopPropagation(); openEditAppt(a);
            });
            var dl=tr.querySelector('.btn-dl');
            if (dl) dl.addEventListener('click',function(e){
                e.stopPropagation(); deleteAppt(a.id);
            });
            tb.appendChild(tr);
        });
    });
}

// ── Check In ─────────────────────────────────────────────────
function doCheckin(id) {
    SB.from('appointments').select('*').eq('id',id).single()
    .then(function(r){
        if (r.error||!r.data){alert('Could not load.');return;}
        var a=r.data;
        if (a.arrived&&a.in_queue){
            alert((a.patient_name||'Patient')+' is already in the queue.');return;
        }
        return SB.from('appointments').update({
            arrived:true,
            arrival_time:new Date().toISOString(),
            in_queue:true,
            bill_status:a.bill_status||'Pending'
        }).eq('id',id);
    })
    .then(function(r){
        if (!r||r.error) return;
        loadToday(); loadQueue();
        switchApptTab('queue');
    });
}

// ── Queue ─────────────────────────────────────────────────────
function loadQueue() {
    var tb=g('queueBody');
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:#aaa;">Loading…</td></tr>';
    SB.from('appointments').select('*')
        .eq('date',todayISO()).eq('in_queue',true)
        .order('arrival_time',{ascending:true})
    .then(function(r){
        var data=r.data||[];
        g('queueCount').textContent=data.length?data.length+' in queue':'Empty';
        if (!data.length){
            tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:36px;color:#bbb;">Queue is empty.</td></tr>';
            return;
        }
        tb.innerHTML='';
        data.forEach(function(a){
            var st=a.bill_status||'Pending';
            var rc=st==='Paid'?'q-paid':st==='Waived'?'q-waived':'';
            var arr=a.arrival_time
                ? new Date(a.arrival_time).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})
                : '—';
            var tr=document.createElement('tr');
            if (rc) tr.className=rc;
            tr.innerHTML=
                '<td><span class="pno-badge">'+esc(a.patient_no||'—')+'</span></td>'+
                '<td><strong>'+esc(a.patient_name||'—')+'</strong></td>'+
                '<td>'+esc(a.treatment_items||'—')+'</td>'+
                '<td style="font-size:13px;color:#777;">'+esc(a.remarks||'—')+'</td>'+
                '<td style="font-weight:600;color:var(--primary);">'+fmt12(a.start_time)+'</td>'+
                '<td style="color:#28a745;font-weight:600;">'+arr+'</td>'+
                '<td><input type="text" class="qv" value="'+esc(a.voucher_no||'')+'"'+
                    ' placeholder="Voucher" style="width:100px;padding:4px 7px;'+
                    'border:1px solid #ddd;border-radius:4px;font-size:13px;"></td>'+
                '<td>'+
                    '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
                        '<select class="qb" style="padding:4px 7px;border:1px solid #ddd;'+
                        'border-radius:4px;font-size:13px;cursor:pointer;">'+
                            '<option value="Pending"'+(st==='Pending'?' selected':'')+'>Pending</option>'+
                            '<option value="Paid"'+(st==='Paid'?' selected':'')+'>Paid</option>'+
                            '<option value="Waived"'+(st==='Waived'?' selected':'')+'>Waived</option>'+
                        '</select>'+
                        '<span class="badge '+(st==='Paid'?'b-paid':st==='Waived'?'b-waived':'b-pending')+'">'+st+'</span>'+
                    '</div>'+
                '</td>'+
                '<td><button class="btn-sm qrm" style="background:var(--danger);">✖ Remove</button></td>';
            tb.appendChild(tr);
            tr.querySelector('.qv').addEventListener('blur',function(){
                SB.from('appointments').update({voucher_no:this.value.trim()||null})
                    .eq('id',a.id).then(function(){});
            });
            tr.querySelector('.qb').addEventListener('change',function(){
                SB.from('appointments').update({bill_status:this.value})
                    .eq('id',a.id).then(function(){ loadQueue(); });
            });
            tr.querySelector('.qrm').addEventListener('click',function(){
                if (!confirm('Remove from queue?')) return;
                SB.from('appointments').update({in_queue:false})
                    .eq('id',a.id).then(function(){ loadQueue(); loadToday(); });
            });
        });
    });
}

// ── Open/Edit appointment modal ───────────────────────────────
function openApptModal(date, time) {
    apptEditId=null;
    g('apptModalTitle').textContent='📅 New Appointment';
    g('psInput').value='';
    g('hPid').value=g('hPno').value=g('hPname').value='';
    g('psSelected').style.display='none';
    g('psDrop').style.display='none';
    sv('fDate', date||todayISO());
    buildTimeSelect('fStart', time||'09:00');
    g('fDur').value='30';
    sv('fTreatment',''); sv('fRemarks','');
    calcEnd();
    openModal('apptModal');
}

function openEditAppt(a) {
    apptEditId=a.id;
    g('apptModalTitle').textContent='✏️ Edit Appointment';
    g('psInput').value=(a.patient_name||'')+(a.patient_no?' ('+a.patient_no+')':'');
    g('hPid').value   = a.patient_id  ||'';
    g('hPno').value   = a.patient_no  ||'';
    g('hPname').value = a.patient_name||'';
    g('psSelName').textContent = a.patient_name||'';
    g('psSelNo').textContent   = a.patient_no||'';
    g('psSelected').style.display='block';
    sv('fDate', a.date||todayISO());
    buildTimeSelect('fStart', a.start_time?a.start_time.substring(0,5):'09:00');
    g('fDur').value=String(a.duration||30);
    sv('fTreatment', a.treatment_items||'');
    sv('fRemarks',   a.remarks||'');
    calcEnd();
    openModal('apptModal');
}

function saveAppt() {
    var pNo   = g('hPno').value;
    var pName = g('hPname').value;
    var date  = g('fDate').value;
    var start = g('fStart').value;
    if (!date)        { alert('Select a date.');    return; }
    if (!start)       { alert('Select start time.');return; }
    if (!pNo&&!pName) { alert('Select a patient.'); return; }
    var dur=parseInt(g('fDur').value,10);
    var end=addMins(start,dur);
    var payload={
        patient_id:      g('hPid').value||null,
        patient_no:      pNo||null,
        patient_name:    pName||null,
        date:            date,
        start_time:      start,
        duration:        dur,
        end_time:        end,
        treatment_items: (g('fTreatment').value||'').trim()||null,
        remarks:         (g('fRemarks').value||'').trim()||null,
    };
    var promise = apptEditId
        ? SB.from('appointments').update(payload).eq('id',apptEditId)
        : SB.from('appointments').insert([payload]);
    promise.then(function(r){
        if (r.error){alert('Error: '+r.error.message);return;}
        closeModal('apptModal');
        alert('✅ Appointment '+(apptEditId?'updated':'saved')+' for '+pName+'!');
        loadToday(); renderCal();
    });
}

function deleteAppt(id) {
    if (!confirm('Delete this appointment?')) return;
    SB.from('appointments').delete().eq('id',id).then(function(r){
        if (r.error){alert('Error: '+r.error.message);return;}
        loadToday(); renderCal();
    });
}

// ── Patient search (inside appointment modal) ─────────────────
function doPatientSearch() {
    var q=(g('psInput').value||'').trim();
    var dd=g('psDrop');
    if (!q){dd.style.display='none';return;}
    SB.from('patients')
        .select('id,patient_no,full_name,phone_number')
        .or('full_name.ilike.%'+q+'%,patient_no.ilike.%'+q+'%,phone_number.ilike.%'+q+'%')
        .limit(8)
    .then(function(r){
        dd.innerHTML='';
        if (r.error||!r.data||!r.data.length){
            dd.innerHTML='<div class="ps-item" style="color:#aaa;">No patients found</div>';
            dd.style.display='block'; return;
        }
        r.data.forEach(function(p){
            var item=document.createElement('div');
            item.className='ps-item';
            item.innerHTML=
                '<strong>'+esc(p.full_name)+'</strong>'+
                '<br><small style="color:#aaa;">#'+esc(p.patient_no||'—')+
                ' · '+esc(p.phone_number||'No phone')+'</small>';
            item.addEventListener('click',function(){
                g('hPid').value    = p.id;
                g('hPno').value    = p.patient_no||'';
                g('hPname').value  = p.full_name;
                g('psInput').value = p.full_name+' ('+(p.patient_no||'')+')';
                g('psSelName').textContent = p.full_name;
                g('psSelNo').textContent   = p.patient_no||'';
                g('psSelected').style.display='block';
                dd.style.display='none';
            });
            dd.appendChild(item);
        });
        dd.style.display='block';
    });
}

// ════════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════════
function renderCal() {
    calView==='weekly' ? renderWeekly() : renderMonthly();
}

function fetchRange(s,e,cb) {
    SB.from('appointments').select('*')
        .gte('date',s).lte('date',e)
        .order('start_time',{ascending:true})
    .then(function(r){ cb(r.error?[]:(r.data||[])); });
}

// ── Weekly ────────────────────────────────────────────────────
function renderWeekly() {
    var cb=g('calBody'), tstr=d2iso(new Date());
    cb.innerHTML='<p style="color:#aaa;padding:16px;">Loading…</p>';
    var ref=new Date(calDate), dow=ref.getDay();
    var mon=new Date(ref);
    mon.setDate(ref.getDate()-(dow===0?6:dow-1));
    var days=[];
    for (var i=0;i<7;i++){
        var dd=new Date(mon); dd.setDate(mon.getDate()+i); days.push(dd);
    }
    g('calTitle').textContent=
        days[0].toLocaleDateString('en-HK',{day:'numeric',month:'short'})+' – '+
        days[6].toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'});
    fetchRange(d2iso(days[0]),d2iso(days[6]),function(appts){
        var slots=[];
        for (var h=8;h<=20;h++)
            for (var m=0;m<60;m+=30)
                slots.push(pad(h)+':'+pad(m));
        var dn=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        var html='<div class="week-wrap">
