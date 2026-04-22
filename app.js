// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://kprihawipljrltfzpfjd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwcmloYXdpcGxqcmx0ZnpwZmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzUyMzAsImV4cCI6MjA5MjM1MTIzMH0.fHbfVQOmIMOTbjBTG6iy2yrgmo-iZXEe-wNLlAlVtM4';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════
let currentSelectedPatientId = null;
let currentEditingPatientId  = null;
let currentUserRole          = null;

// ════════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }

// ════════════════════════════════════════════════════════════════
// SCREEN SWITCHERS
// ════════════════════════════════════════════════════════════════
function showLogin() {
    el('loginOverlay').style.display     = 'flex';
    el('dashboardSection').style.display = 'none';
    el('patientSection').style.display   = 'none';
    el('loginError').style.display       = 'none';
    el('loginError').textContent         = '';
}

function showDashboard() {
    el('loginOverlay').style.display     = 'none';
    el('dashboardSection').style.display = 'block';
    el('patientSection').style.display   = 'none';
}

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {

    showLogin();

    const { data: { session } } = await _supabase.auth.getSession();
    if (session) await checkUserRole(session.user.id);

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN'  && session) await checkUserRole(session.user.id);
        if (event === 'SIGNED_OUT')             showLogin();
    });

    // ── Static listeners ─────────────────────────────────────────
    el('loginBtn').addEventListener('click', handleLogin);
    el('loginPassword').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });
    el('logoutBtn').addEventListener('click', handleLogout);
    el('backBtn').addEventListener('click', backToDashboard);
    el('mainAddBtn').addEventListener('click', openAddPatientModal);
    el('searchInput').addEventListener('input', searchPatients);

    el('closeAddModal').addEventListener('click',
        () => toggleModal('addPatientModal', false));
    el('closeDetailsModal').addEventListener('click',
        () => toggleModal('patientDetailsModal', false));
    el('closeEditModal').addEventListener('click',
        () => toggleModal('editPatientModal', false));
    el('cancelEditBtn').addEventListener('click',
        () => toggleModal('editPatientModal', false));
    el('edit_deleteBtn').addEventListener('click', deletePatientFromEdit);
    el('noteSaveBtn').addEventListener('click', saveBulkNote);

    // ── Dashboard cards ──────────────────────────────────────────
    el('card-patient').addEventListener('click', () => switchPath('patient'));

    ['card-appointment','card-consultation','card-drugbook',
     'card-report','card-expenses','card-inventory','card-configuration']
        .forEach(id => {
            const card = el(id);
            if (card) card.addEventListener('click', () => {
                const name = id.replace('card-', '');
                alert(name.charAt(0).toUpperCase() +
                      name.slice(1) + ' module coming soon!');
            });
        });

    // ── Add Patient form ─────────────────────────────────────────
    el('patientForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const nextNo = await generatePatientNo();

        const payload = {
            patient_no:     nextNo,
            full_name:      el('fullName').value.trim(),
            chinese_name:   el('chineseName').value.trim()  || null,
            phone_number:   el('phone').value.trim()        || null,
            email:          el('email').value.trim()        || null,
            sex:            el('sex').value                 || null,
            dob:            el('dob').value                 || null,
            hkid:           el('hkid').value.trim()         || null,
            insurance_no:   el('insuranceNo').value.trim()  || null,
            occupation:     el('occupation').value.trim()   || null,
            address:        el('address').value.trim()      || null,
            medical_alerts: el('alerts').value.trim()       || null,
            remarks:        el('remarks').value.trim()      || null,
        };

        const { error } = await _supabase.from('patients').insert([payload]);
        if (error) return alert('Error saving patient: ' + error.message);

        toggleModal('addPatientModal', false);
        el('patientForm').reset();
        el('preview_patientNo').value = '';
        fetchPatients();
        alert(`✅ Patient "${payload.full_name}" registered!\nPatient No: ${nextNo}`);
    });

    // ── Edit Patient form ────────────────────────────────────────
    el('editPatientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingPatientId) return;

        const payload = {
            full_name:      el('edit_fullName').value.trim(),
            chinese_name:   el('edit_chineseName').value.trim()  || null,
            phone_number:   el('edit_phone').value.trim()        || null,
            email:          el('edit_email').value.trim()        || null,
            sex:            el('edit_sex').value                 || null,
            dob:            el('edit_dob').value                 || null,
            hkid:           el('edit_hkid').value.trim()         || null,
            insurance_no:   el('edit_insuranceNo').value.trim()  || null,
            occupation:     el('edit_occupation').value.trim()   || null,
            address:        el('edit_address').value.trim()      || null,
            medical_alerts: el('edit_alerts').value.trim()       || null,
            remarks:        el('edit_remarks').value.trim()      || null,
            // patient_no is NOT updated — it is permanent
        };

        const { error } = await _supabase
            .from('patients')
            .update(payload)
            .eq('id', currentEditingPatientId);

        if (error) return alert('Error updating patient: ' + error.message);

        toggleModal('editPatientModal', false);
        fetchPatients();
        alert(`✅ Patient "${payload.full_name}" updated!`);
    });

}); // end DOMContentLoaded

// ════════════════════════════════════════════════════════════════
// PATIENT NUMBER — AUTO-GENERATE
// ════════════════════════════════════════════════════════════════
async function generatePatientNo() {
    const START = 1000; // first number = 001000

    const { data, error } = await _supabase
        .from('patients')
        .select('patient_no');

    if (error || !data || !data.length) {
        return String(START).padStart(6, '0');
    }

    // Parse all patient numbers to integers, find the maximum
    const nums = data
        .map(p => parseInt(p.patient_no, 10))
        .filter(n => !isNaN(n));

    if (!nums.length) return String(START).padStart(6, '0');

    const maxNum = Math.max(...nums);
    const nextNum = maxNum + 1;
    return String(nextNum).padStart(6, '0');
}

// Preview next patient number when the Add modal opens
async function previewNextPatientNo() {
    const next = await generatePatientNo();
    el('preview_patientNo').value = next;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
async function handleLogin() {
    const email    = el('loginEmail').value.trim();
    const password = el('loginPassword').value;
    const errEl    = el('loginError');

    if (!email || !password) {
        errEl.textContent   = '⚠️ Please enter your email and password.';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';

    const { data, error } = await _supabase.auth.signInWithPassword({
        email, password
    });

    if (error) {
        errEl.textContent   = '❌ ' + error.message;
        errEl.style.display = 'block';
        return;
    }

    await checkUserRole(data.user.id);
}

async function handleLogout() {
    await _supabase.auth.signOut();
    currentUserRole          = null;
    currentSelectedPatientId = null;
    currentEditingPatientId  = null;
    showLogin();
}

async function checkUserRole(userId) {
    const { data: profile, error } = await _supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        console.error('Profile load failed:', error);
        showLogin();
        return;
    }

    currentUserRole = profile.role;
    applyPermissions(currentUserRole);
    showDashboard();
}

// ════════════════════════════════════════════════════════════════
// PERMISSIONS
// ════════════════════════════════════════════════════════════════
function applyPermissions(role) {
    const addBtn = el('mainAddBtn');
    if (addBtn) {
        addBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }

    document.querySelectorAll('.btn-edit-patient').forEach(btn => {
        btn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    });

    const delBtn = el('edit_deleteBtn');
    if (delBtn) {
        delBtn.style.display = role === 'nurse' ? 'none' : 'inline-block';
    }

    const section = el('bulkEntrySection');
    if (section && role === 'nurse') {
        section.innerHTML =
            '<p style="color:#888; font-style:italic; margin:0;">' +
            '🔒 Viewing Mode — nurses cannot add or edit records.</p>';
    }
}

// ════════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════════
function switchPath(module) {
    el('dashboardSection').style.display = 'none';
    if (module === 'patient') {
        el('patientSection').style.display = 'block';
        fetchPatients();
    }
}

function backToDashboard() {
    el('patientSection').style.display   = 'none';
    el('dashboardSection').style.display = 'block';
}

// ════════════════════════════════════════════════════════════════
// MODAL HELPER
// ════════════════════════════════════════════════════════════════
function toggleModal(id, show) {
    const modal = el(id);
    if (!modal) return;
    modal.style.display = show ? 'block' : 'none';

    if (!show && id === 'patientDetailsModal') currentSelectedPatientId = null;
    if (!show && id === 'editPatientModal')    currentEditingPatientId  = null;

    if (show && currentUserRole) applyPermissions(currentUserRole);
}

async function openAddPatientModal() {
    el('patientForm').reset();
    await previewNextPatientNo();   // ← show the number that will be assigned
    toggleModal('addPatientModal', true);
}

// ════════════════════════════════════════════════════════════════
// PATIENT — FETCH & RENDER
// ════════════════════════════════════════════════════════════════
async function fetchPatients() {
    const { data, error } = await _supabase
        .from('patients')
        .select('*')
        .order('patient_no', { ascending: true });

    if (error) return console.error('fetchPatients error:', error);
    renderTable(data);
}

function renderTable(patients) {
    const tbody = el('patientTableBody');

    if (!patients || patients.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;' +
            ' padding:30px; color:#999;">No patients found.</td></tr>';
        return;
    }

    tbody.innerHTML = patients.map(p => {

        // Format DOB YYYY-MM-DD → DD/MM/YYYY
        let dob = '--';
        if (p.dob) {
            const [y, m, d] = p.dob.split('-');
            dob = `${d}/${m}/${y}`;
        }

        return `
        <tr>
            <td>
                ${p.patient_no
                    ? `<span class="patient-no-badge"># ${p.patient_no}</span><br>`
                    : ''}
                <strong>${p.full_name}</strong>
                ${p.chinese_name
                    ? `<br><small style="color:#999;">${p.chinese_name}</small>`
                    : ''}
            </td>
            <td>${p.phone_number || '--'}</td>
            <td style="white-space:nowrap;">${dob}</td>
            <td>${p.hkid || '--'}</td>
            <td>
                <small style="color:${p.medical_alerts
                    ? 'var(--danger)' : '#bbb'};">
                    ${p.medical_alerts || 'None'}
                </small>
            </td>
            <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-view btn-notes" data-id="${p.id}">
                        📋 Notes
                    </button>
                    <button class="btn-edit-patient" data-id="${p.id}"
                            style="background:var(--primary); color:white;
                                   border:none; padding:6px 12px;
                                   border-radius:4px; cursor:pointer;
                                   font-size:13px;
                                   display:${currentUserRole === 'nurse'
                                       ? 'none' : 'inline-block'};">
                        ✏️ Edit
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Attach listeners after render
    tbody.querySelectorAll('.btn-notes').forEach(btn => {
        btn.addEventListener('click', () => viewHistory(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-edit-patient').forEach(btn => {
        btn.addEventListener('click', () => openEditPatient(btn.dataset.id));
    });
}

function searchPatients() {
    const q = el('searchInput').value.toLowerCase();
    document.querySelectorAll('#patientTableBody tr').forEach(row => {
        row.style.display =
            row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ════════════════════════════════════════════════════════════════
// PATIENT — EDIT MODAL
// ════════════════════════════════════════════════════════════════
async function openEditPatient(patientId) {
    if (!patientId) return;
    currentEditingPatientId = patientId;

    const { data: p, error } = await _supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (error || !p) return alert('Could not load patient data.');

    // Patient number shown read-only
    el('edit_patientNo').value   = p.patient_no     || '—';

    el('edit_fullName').value    = p.full_name       || '';
    el('edit_chineseName').value = p.chinese_name    || '';
    el('edit_phone').value       = p.phone_number    || '';
    el('edit_email').value       = p.email           || '';
    el('edit_sex').value         = p.sex             || '';
    el('edit_dob').value         = p.dob             || '';
    el('edit_hkid').value        = p.hkid            || '';
    el('edit_insuranceNo').value = p.insurance_no    || '';
    el('edit_occupation').value  = p.occupation      || '';
    el('edit_address').value     = p.address         || '';
    el('edit_alerts').value      = p.medical_alerts  || '';
    el('edit_remarks').value     = p.remarks         || '';

    toggleModal('editPatientModal', true);
}

// ════════════════════════════════════════════════════════════════
// PATIENT — DELETE
// ════════════════════════════════════════════════════════════════
async function deletePatientFromEdit() {
    if (currentUserRole === 'nurse') return alert('Permission denied.');
    if (!currentEditingPatientId)   return;

    const name = el('edit_fullName').value || 'this patient';
    const no   = el('edit_patientNo').value;

    if (!confirm(
        `⚠️ Permanently delete Patient #${no} "${name}" ` +
        `and ALL their treatment records?\n\nThis cannot be undone.`
    )) return;

    await _supabase
        .from('treatments')
        .delete()
        .eq('patient_id', currentEditingPatientId);

    const { error } = await _supabase
        .from('patients')
        .delete()
        .eq('id', currentEditingPatientId);

    if (error) return alert('Error deleting patient: ' + error.message);

    toggleModal('editPatientModal', false);
    fetchPatients();
    alert(`🗑️ Patient #${no} "${name}" has been deleted.`);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — VIEW HISTORY
// ════════════════════════════════════════════════════════════════
async function viewHistory(patientId) {
    if (!patientId) return;
    currentSelectedPatientId = patientId;

    const { data: patient, error } = await _supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (error || !patient) return alert('Could not load patient.');

    // Patient number badge
    el('det_patientNo').textContent =
        patient.patient_no ? `# ${patient.patient_no}` : '';

    el('det_patientName').textContent =
        patient.full_name +
        (patient.chinese_name ? `  ${patient.chinese_name}` : '');

    el('det_alerts').textContent =
        patient.medical_alerts ? '⚠️  ' + patient.medical_alerts : '';

    // Rebuild note entry area for non-nurses
    if (currentUserRole !== 'nurse') {
        el('bulkEntrySection').innerHTML = `
            <h3 style="margin-top:0; font-size:16px;">Add Clinical Note</h3>
            <textarea id="bulkNoteInput" rows="3"
                      placeholder="Enter treatment details…"
                      style="width:100%; padding:10px; border:1px solid #ddd;
                             border-radius:6px; font-size:14px;
                             box-sizing:border-box; resize:vertical;">
            </textarea>
            <button class="btn-add" id="noteSaveBtn"
                    style="margin-top:10px;">
                Add to History
            </button>`;
        el('noteSaveBtn').addEventListener('click', saveBulkNote);
    }

    await fetchTreatments(patientId);
    toggleModal('patientDetailsModal', true);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — FETCH & RENDER TIMELINE
// ════════════════════════════════════════════════════════════════
async function fetchTreatments(patientId) {
    const timeline = el('treatmentTimeline');
    timeline.innerHTML = '<p style="color:#999;">Loading…</p>';

    const { data, error } = await _supabase
        .from('treatments')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

    if (error || !data || !data.length) {
        timeline.innerHTML =
            '<p style="color:#999; margin:0;">No treatment history yet.</p>';
        return;
    }

    const todayStr = new Date().toDateString();

    timeline.innerHTML = data.map(t => {
        const isToday = new Date(t.created_at).toDateString() === todayStr;
        const canEdit = isToday && currentUserRole !== 'nurse';

        return `
        <div class="note-card">
            ${canEdit
                ? `<button class="btn-edit-note" data-note="${t.id}"
                           style="position:absolute; right:12px; top:12px;
                                  background:var(--primary); color:white;
                                  border:none; padding:4px 10px;
                                  border-radius:4px; cursor:pointer;
                                  font-size:12px;">✏️ Edit</button>`
                : ''}
            <small style="color:#aaa;">
                ${new Date(t.created_at).toLocaleString()}
            </small>
            <div id="note-text-${t.id}"
                 style="white-space:pre-wrap; margin-top:6px; font-size:14px;">
                ${t.notes}
            </div>
        </div>`;
    }).join('');

    timeline.querySelectorAll('.btn-edit-note').forEach(btn => {
        btn.addEventListener('click', () => prepareEdit(btn.dataset.note));
    });
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — ADD NOTE
// ════════════════════════════════════════════════════════════════
async function saveBulkNote() {
    const noteInput = el('bulkNoteInput');
    if (!noteInput) return;

    const note = noteInput.value.trim();
    if (!note) return alert('Please enter a note before saving.');

    const { error } = await _supabase
        .from('treatments')
        .insert([{ patient_id: currentSelectedPatientId, notes: note }]);

    if (error) return alert('Error saving note: ' + error.message);

    noteInput.value = '';
    fetchTreatments(currentSelectedPatientId);
}

// ════════════════════════════════════════════════════════════════
// TREATMENT — INLINE EDIT
// ════════════════════════════════════════════════════════════════
function prepareEdit(noteId) {
    const noteDiv = el(`note-text-${noteId}`);
    if (!noteDiv) return;

    const original = noteDiv.innerText.trim();

    noteDiv.innerHTML = `
        <textarea id="edit-input-${noteId}"
                  style="width:100%; height:80px; padding:8px;
                         border:1px solid #ddd; border-radius:6px;
                         font-size:14px; box-sizing:border-box;
                         margin-top:8px; resize:vertical;"
        >${original}</textarea>
        <div style="display:flex; justify-content:space-between;
                    margin-top:10px;">
            <button class="btn-del-note"
                    style="background:var(--danger); color:white; border:none;
                           padding:6px 14px; border-radius:4px; cursor:pointer;">
                🗑 Delete
            </button>
            <div style="display:flex; gap:8px;">
                <button class="btn-cancel-edit"
                        style="background:var(--gray); color:white; border:none;
                               padding:6px 14px; border-radius:4px; cursor:pointer;">
                    Cancel
                </button>
                <button class="btn-save-edit"
                        style="background:var(--success); color:white; border:none;
                               padding:6px 14px; border-radius:4px; cursor:pointer;">
                    💾 Save
                </button>
            </div>
        </div>`;

    noteDiv.querySelector('.btn-del-note')
           .addEventListener('click', () => deleteNote(noteId));
    noteDiv.querySelector('.btn-cancel-edit')
           .addEventListener('click',
               () => fetchTreatments(currentSelectedPatientId));
    noteDiv.querySelector('.btn-save-edit')
           .addEventListener('click', () => updateNote(noteId));
}

async function updateNote(noteId) {
    const input = el(`edit-input-${noteId}`);
    if (!input) return;

    const { error } = await _supabase
        .from('treatments')
        .update({ notes: input.value.trim() })
        .eq('id', noteId);

    if (error) return alert('Error updating note: ' + error.message);
    fetchTreatments(currentSelectedPatientId);
}

async function deleteNote(noteId) {
    if (!confirm('Permanently delete this note?')) return;

    const { error } = await _supabase
        .from('treatments')
        .delete()
        .eq('id', noteId);

    if (error) return alert('Error deleting note: ' + error.message);
    fetchTreatments(currentSelectedPatientId);
}
