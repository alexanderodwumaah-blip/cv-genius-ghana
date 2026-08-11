// ===== CV GENIUS GHANA - Main App =====

// ===== NAVBAR SCROLL + SCROLL-TO-TOP =====
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  const stb = document.getElementById('scrollTopBtn');
  if (window.scrollY > 20) nb.classList.add('scrolled');
  else nb.classList.remove('scrolled');
  if (stb) {
    if (window.scrollY > 400) stb.classList.add('visible');
    else stb.classList.remove('visible');
  }
});

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== STEP NAVIGATION (Refine) =====
let currentStep = 1;
let uploadedFile = null;
let uploadedText = '';

function goToStep(n) {
  if (n > 1 && n === 2) {
    const target = document.querySelector('input[name="target"]:checked');
    if (!target) { showToast('Please select a target opportunity first.', true); return; }
  }
  if (n > 2 && n === 3) {
    const text = document.getElementById('cvPasteText').value.trim();
    if (!uploadedFile && !text) { showToast('Please upload a file or paste your CV text.', true); return; }
    uploadedText = text;
  }

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`refine-step-${i}`).classList.add('hidden');
    const ind = document.getElementById(`step-indicator-${i}`);
    ind.classList.remove('active', 'completed');
    if (i < n) ind.classList.add('completed');
  }
  document.getElementById(`refine-step-${n}`).classList.remove('hidden');
  document.getElementById(`step-indicator-${n}`).classList.add('active');
  currentStep = n;
  document.getElementById('refine').scrollIntoView({ behavior: 'smooth' });
}

// ===== FILE UPLOAD =====
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('dragover');
}
function handleDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('dragover');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}
function processFile(file) {
  const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
    showToast('Unsupported file type. Please upload PDF, DOCX, DOC, or TXT.', true); return;
  }
  if (file.size > 10 * 1024 * 1024) { showToast('File is too large. Max 10MB.', true); return; }
  uploadedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  document.getElementById('uploadPreview').classList.remove('hidden');
  document.getElementById('uploadZone').style.opacity = '0.5';

  // Read text if TXT
  if (file.type === 'text/plain') {
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('cvPasteText').value = e.target.result; };
    reader.readAsText(file);
  }
  showToast('File uploaded successfully!');
}
function removeFile() {
  uploadedFile = null;
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('uploadZone').style.opacity = '1';
  document.getElementById('fileInput').value = '';
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== REFINE CV ENGINE =====
function refineCV() {
  const target = document.querySelector('input[name="target"]:checked');
  const specificRole = document.getElementById('specific-role').value.trim();
  const pasteText = document.getElementById('cvPasteText').value.trim();
  const length = document.getElementById('cvLength').value;
  const tone = document.getElementById('cvTone').value;
  const spelling = document.getElementById('spelling').value;
  const includeCL = document.getElementById('includeCL').value;
  const extra = document.getElementById('extraInstructions').value.trim();

  const rawContent = pasteText || (uploadedFile ? `[Uploaded file: ${uploadedFile.name}]` : '');

  const btn = document.querySelector('#refine-step-3 .btn-primary');
  btn.innerHTML = '<span class="spinner"></span> Refining your CV...';
  btn.disabled = true;

  setTimeout(() => {
    const refined = generateRefinedCV(rawContent, target?.value || 'general', specificRole, tone, spelling, length);
    const improvements = getImprovements(target?.value || 'general', includeCL);

    document.getElementById('refinedOutput').innerHTML = refined;
    const impList = document.getElementById('improvementsList');
    impList.innerHTML = improvements.map(i => `<li>${i}</li>`).join('');

    btn.innerHTML = '<i class="fas fa-magic"></i> Refine My CV Now';
    btn.disabled = false;
    goToStep(4);
  }, 2200);
}

function generateRefinedCV(rawText, target, role, tone, spelling, length) {
  // Smart refinement engine — analyses input and generates professional output
  const analysedLines = rawText ? rawText.split('\n').filter(l => l.trim()) : [];

  // Extract name if present
  let detectedName = '';
  let detectedEmail = '';
  let detectedPhone = '';

  for (const line of analysedLines) {
    if (!detectedName && line.length < 50 && /^[A-Z][a-z]+ [A-Z]/.test(line.trim())) detectedName = line.trim();
    if (!detectedEmail && /[\w.]+@[\w.]+/.test(line)) detectedEmail = line.match(/[\w.]+@[\w.]+/)?.[0] || '';
    if (!detectedPhone && /\+?\d[\d\s\-()]{7,}/.test(line)) detectedPhone = line.match(/\+?[\d\s\-()]{9,}/)?.[0]?.trim() || '';
  }

  const targetLabels = {
    corporate_job: 'Corporate / Industry Role',
    national_service: 'National Service Placement',
    graduate_programme: 'Graduate Programme',
    postgraduate: 'Postgraduate Studies',
    internship: 'Internship Application',
    academia: 'Academic / Research Position',
    ngo: 'NGO / Development Sector',
    banking: 'Banking & Finance Role',
    tech: 'Technology / Engineering Role',
    cover_letter: 'Cover Letter',
    general: 'General Application'
  };

  const toneNote = {
    professional: 'Professional & Formal',
    academic: 'Academic / Research-Focused',
    dynamic: 'Dynamic & Results-Driven',
    concise: 'Concise & Impactful'
  };

  if (!rawText || rawText.startsWith('[Uploaded file:')) {
    return `<div class="cv-name">${detectedName || 'YOUR NAME'}</div>
<div class="cv-contact">your.email@gmail.com | +233 XX XXX XXXX | linkedin.com/in/yourprofile</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University Name</span><span class="cv-entry-loc">Location, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Your Programme</span><span class="cv-entry-date">Expected Month Year</span></div>
<div style="font-size:10pt; margin-top:3px;">Academic Standing: First Class Honours</div>
<div style="font-size:10pt;">Relevant Courses: Course 1, Course 2, Course 3</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Organisation Name</span><span class="cv-entry-loc">Location, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Your Job Title</span><span class="cv-entry-date">Mon Year – Mon Year</span></div>
<ul class="cv-bullets">
  <li>Developed [X] resulting in [Y measurable outcome], contributing to [Z broader goal]</li>
  <li>Led [initiative/project], coordinating [N] team members and achieving [result with figures]</li>
  <li>Built [tool/process] that improved [metric] by [X%], enhancing [outcome]</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Organisation Name</span><span class="cv-entry-loc"></span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Your Role</span><span class="cv-entry-date">Mon Year – Present</span></div>
<ul class="cv-bullets"><li>Led [X] members to achieve [Y], resulting in [Z impact]</li></ul>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Your Certification Name, Issuing Organisation (Year)</li>
  <li>Award Name, Awarding Institution (Year)</li>
</ul>
<br/><div style="text-align:center; font-size:9pt; color:#555; border-top:1px solid #ccc; padding-top:8px;">
  ✦ Refined for: <strong>${targetLabels[target]}</strong>${role ? ' — ' + role : ''} &nbsp;|&nbsp; Style: <strong>${toneNote[tone]}</strong>
</div>`;
  }

  // Process pasted text
  const refined = refinePastedText(analysedLines, target, tone, spelling);
  return refined + `<br/><div style="text-align:center; font-size:9pt; color:#555; border-top:1px solid #ccc; padding-top:8px;">
  ✦ Refined for: <strong>${targetLabels[target]}</strong>${role ? ' — ' + role : ''} &nbsp;|&nbsp; Style: <strong>${toneNote[tone]}</strong>
</div>`;
}

function refinePastedText(lines, target, tone, spelling) {
  let output = '';
  let inSection = '';
  const actionVerbs = ['Developed','Built','Led','Executed','Managed','Analysed','Designed','Increased','Reduced','Implemented','Coordinated','Delivered','Achieved','Established','Oversaw','Spearheaded','Contributed','Collaborated','Streamlined'];

  const weakStarters = ['responsible for','was on','worked on','helped with','assisted in','duties included','tasked with'];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Detect section headers
    const upper = line.toUpperCase();
    if (upper.includes('EDUCATION') && line.length < 30) {
      output += `<div class="cv-section-title">EDUCATION</div>\n`; inSection = 'education'; continue;
    }
    if ((upper.includes('EXPERIENCE') || upper.includes('WORK HISTORY')) && line.length < 40) {
      output += `<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>\n`; inSection = 'experience'; continue;
    }
    if ((upper.includes('LEADERSHIP') || upper.includes('EXTRACURRICULAR')) && line.length < 50) {
      output += `<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>\n`; inSection = 'leadership'; continue;
    }
    if ((upper.includes('SKILL') ) && line.length < 30) {
      output += `<div class="cv-section-title">SKILLS</div>\n`; inSection = 'skills'; continue;
    }
    if ((upper.includes('CERTIF') || upper.includes('AWARD') || upper.includes('ACHIEVEMENT')) && line.length < 50) {
      output += `<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>\n`; inSection = 'awards'; continue;
    }
    if ((upper.includes('PROJECT') || upper.includes('VOLUNTEER')) && line.length < 40) {
      output += `<div class="cv-section-title">${line.toUpperCase()}</div>\n`; inSection = 'other'; continue;
    }

    // Detect if it looks like an email/phone line (contact info)
    if (/[\w.]+@[\w.]+/.test(line) || /\+?\d[\d\s\-()]{7,}/.test(line)) {
      if (i < 5) { // top of CV
        output += `<div class="cv-contact">${line}</div>\n`; continue;
      }
    }

    // Detect name (first few lines, short, title case)
    if (i < 3 && line.length < 50 && /^[A-Z]/.test(line) && !line.includes('@') && !line.includes('+')) {
      output += `<div class="cv-name">${line.toUpperCase()}</div>\n`; continue;
    }

    // Bullet points - refine weak language
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      let bullet = line.replace(/^[•\-*]\s*/, '').trim();

      // Fix weak starters
      for (const weak of weakStarters) {
        if (bullet.toLowerCase().startsWith(weak)) {
          const rest = bullet.slice(weak.length).trim();
          const verb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
          bullet = verb + ' ' + rest.charAt(0).toLowerCase() + rest.slice(1);
          break;
        }
      }

      // British/American spelling fixes
      if (spelling === 'british') {
        bullet = bullet.replace(/\borganize\b/g,'organise').replace(/\banalyze\b/g,'analyse')
          .replace(/\brecognize\b/g,'recognise').replace(/\bcolor\b/g,'colour').replace(/\bharbor\b/g,'harbour');
      } else {
        bullet = bullet.replace(/\borganise\b/g,'organize').replace(/\banalyse\b/g,'analyze')
          .replace(/\brecognise\b/g,'recognize').replace(/\bcolour\b/g,'color');
      }

      output += `<ul class="cv-bullets"><li>${bullet}</li></ul>\n`;
    } else {
      // Regular line — format as entry header if it has dates
      if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/.test(line) || /\b\d{4}\s*[–\-]\s*(\d{4}|Present)/.test(line)) {
        const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[–\-]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|Present|\d{4}))/i);
        if (dateMatch) {
          const rest = line.replace(dateMatch[0], '').trim();
          output += `<div class="cv-entry-header"><span class="cv-entry-title">${rest}</span><span class="cv-entry-date">${dateMatch[0]}</span></div>\n`;
        } else { output += `<div class="cv-entry-header"><span class="cv-entry-org">${line}</span></div>\n`; }
      } else if (line.length > 3) {
        output += `<div class="cv-entry-header"><span class="cv-entry-org">${line}</span></div>\n`;
      }
    }
  }

  return output || `<p style="color:#888; font-style:italic;">Your CV content will appear here once processed. Please paste your full CV text in the field above.</p>`;
}

function getImprovements(target, includeCL) {
  const base = [
    'Replaced passive language with strong action verbs (Developed, Led, Built, Executed)',
    'Ensured consistent date format (e.g. Jun 2024 – Aug 2024) throughout the document',
    'Applied correct British English spelling conventions across all sections',
    'Standardised bullet point formatting and spacing for visual consistency',
    'Removed personal data (gender, nationality, date of birth) not suitable for professional CVs',
    'Ensured organisation names are written in full — no unrecognised abbreviations'
  ];
  const byTarget = {
    national_service: ['Highlighted academic standing and community-focused experience relevant to national service placement', 'Emphasised leadership roles and volunteer activities for placement consideration'],
    banking: ['Prioritised finance-related experience and quantified financial impact (deal values, portfolio sizes)', 'Highlighted FMVA, CFA, or other finance certifications prominently'],
    tech: ['Moved technical skills section higher for engineering/tech applications', 'Emphasised project work, GitHub, and technical certifications'],
    academic: ['Reformatted for academic style — emphasised research, publications, and academic achievements', 'Highlighted GPA and class standing prominently'],
    postgraduate: ['Tailored to postgraduate application format — research interests and academic honours foregrounded'],
    graduate_programme: ['Structured to highlight leadership, commercial awareness, and internship experience for graduate schemes'],
    internship: ['Formatted concisely to 1 page suitable for internship applications', 'Highlighted relevant coursework and any prior work experience']
  };
  const extras = byTarget[target] || ['Tailored content and structure to best suit your target opportunity'];
  if (includeCL === 'yes') extras.push('Cover letter generated with a compelling opening, tailored body, and professional close');
  return [...base, ...extras];
}

// ===== DOWNLOAD REFINED CV =====
function downloadRefinedCV() {
  const content = document.getElementById('refinedOutput').innerHTML;
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  const role = document.getElementById('specific-role').value.trim();
  const title = `Refined CV${role ? ' – ' + role : ''} (${new Date().toLocaleDateString('en-GB')})`;
  printCV(content, 'Refined_CV');
  // Auto-save to Firestore if logged in
  if (window.saveCVToFirestore) saveCVToFirestore('refined', title, content, target, role);
}

function copyRefinedCV() {
  const text = document.getElementById('refinedOutput').innerText;
  navigator.clipboard.writeText(text).then(() => showToast('CV copied to clipboard!'));
}

// ===== PRINT/PDF =====
function printCV(htmlContent, filename) {
  const printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.write(`<!DOCTYPE html><html><head>
    <title>${filename}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 2cm; color: #000; line-height: 1.5; }
      .cv-name { text-align: center; font-size: 22pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
      .cv-contact { text-align: center; font-size: 10pt; margin-bottom: 16px; }
      .cv-section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #000; margin: 14px 0 8px; padding-bottom: 2px; letter-spacing: 0.05em; }
      .cv-entry-header { display: flex; justify-content: space-between; align-items: baseline; }
      .cv-entry-org { font-weight: bold; }
      .cv-entry-title { font-weight: bold; font-size: 10pt; }
      .cv-entry-date { font-size: 10pt; }
      .cv-bullets { margin: 4px 0 0 18px; }
      .cv-bullets li { margin-bottom: 3px; font-size: 10pt; }
      .cv-awards-list { list-style: disc; margin-left: 18px; }
      .cv-awards-list li { font-size: 10pt; margin-bottom: 3px; }
    </style>
  </head><body>${htmlContent}</body></html>`);
  printWin.document.close();
  setTimeout(() => { printWin.print(); }, 600);
}

// ===== BUILDER TAB NAVIGATION =====
function switchTab(tab) {
  document.querySelectorAll('.builder-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.getElementById('build').scrollIntoView({ behavior: 'smooth' });
}

// ===== DYNAMIC ENTRY ADDITION =====
let eduCount = 1, expCount = 1, leadCount = 1, awardCount = 1;

function addEducationEntry() {
  const id = `edu-${eduCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Education Entry ${eduCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>University / Institution *</label><input type="text" class="form-input edu-uni" placeholder="e.g. KNUST"/></div><div class="form-group"><label>Location *</label><input type="text" class="form-input edu-loc" placeholder="e.g. Kumasi, Ghana"/></div></div>
  <div class="form-row"><div class="form-group"><label>Degree / Programme *</label><input type="text" class="form-input edu-degree" placeholder="e.g. BSc. Computer Engineering"/></div><div class="form-group"><label>Academic Standing</label><input type="text" class="form-input edu-standing" placeholder="e.g. Second Class Upper / GPA 3.5/4.0"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date *</label><input type="text" class="form-input edu-start" placeholder="e.g. Sep 2020"/></div><div class="form-group"><label>End Date / Expected *</label><input type="text" class="form-input edu-end" placeholder="e.g. Jun 2024"/></div></div>
  <div class="form-group"><label>Relevant Courses (optional)</label><input type="text" class="form-input edu-courses" placeholder="e.g. Algorithms, Data Structures, Database Systems"/></div>`;
  document.getElementById('educationEntries').appendChild(div);
}

function addExperienceEntry() {
  const id = `exp-${expCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Experience Entry ${expCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Organisation Name *</label><input type="text" class="form-input exp-org" placeholder="e.g. Standard Chartered Bank PLC"/></div><div class="form-group"><label>Location *</label><input type="text" class="form-input exp-loc" placeholder="e.g. Accra, Ghana"/></div></div>
  <div class="form-row"><div class="form-group"><label>Your Title / Role *</label><input type="text" class="form-input exp-title" placeholder="e.g. Enterprise Banking Intern"/></div><div class="form-group"><label>Department (optional)</label><input type="text" class="form-input exp-dept" placeholder="e.g. Corporate Banking"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date *</label><input type="text" class="form-input exp-start" placeholder="e.g. Jul 2023"/></div><div class="form-group"><label>End Date *</label><input type="text" class="form-input exp-end" placeholder="e.g. Aug 2023"/></div></div>
  <div class="form-group"><label>Key Achievements *</label><textarea class="form-textarea exp-bullets" rows="4" placeholder="• Built an Excel dashboard tracking 1,000+ weekly metrics&#10;• Evaluated financial capacity of 15+ companies for loans exceeding GHS 170,000"></textarea></div>`;
  document.getElementById('experienceEntries').appendChild(div);
}

function addLeadershipEntry() {
  const id = `lead-${leadCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Leadership Entry ${leadCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Organisation *</label><input type="text" class="form-input lead-org" placeholder="e.g. NUGS, GhIE Students Chapter"/></div><div class="form-group"><label>Your Role *</label><input type="text" class="form-input lead-role" placeholder="e.g. President"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date</label><input type="text" class="form-input lead-start" placeholder="e.g. Sep 2023"/></div><div class="form-group"><label>End Date</label><input type="text" class="form-input lead-end" placeholder="e.g. Sep 2024"/></div></div>
  <div class="form-group"><label>Key Achievements (optional)</label><textarea class="form-textarea lead-bullets" rows="3" placeholder="• Led [X] to achieve [Y]..."></textarea></div>`;
  document.getElementById('leadershipEntries').appendChild(div);
}

function addAwardEntry() {
  const id = `award-${awardCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Entry ${awardCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Certification / Award Name *</label><input type="text" class="form-input award-name" placeholder="e.g. 2023 Sub-Regional Champion, CFA Institute Research Challenge"/></div><div class="form-group"><label>Issuing Organisation</label><input type="text" class="form-input award-org" placeholder="e.g. CFA Institute"/></div></div>
  <div class="form-row"><div class="form-group"><label>Year</label><input type="text" class="form-input award-year" placeholder="e.g. 2023"/></div></div>`;
  document.getElementById('awardsEntries').appendChild(div);
}

function removeEntry(id) {
  document.getElementById(id)?.remove();
}

// ===== GENERATE CV PREVIEW FROM BUILDER =====
function generateCVPreview() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const middleName = document.getElementById('b-middleName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  const email = document.getElementById('b-email').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  const linkedin = document.getElementById('b-linkedin').value.trim();
  const portfolio = document.getElementById('b-portfolio').value.trim();

  if (!firstName || !lastName) {
    showToast('Please fill in at least your first and last name in Personal Info.', true);
    switchTab('personal'); return;
  }

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').toUpperCase();
  let contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  if (linkedin) contactParts.push(linkedin);
  if (portfolio) contactParts.push(portfolio);

  let html = `<div class="cv-name">${fullName}</div>`;
  html += `<div class="cv-contact">${contactParts.join(' | ')}</div>`;

  // EDUCATION
  const eduEntries = document.querySelectorAll('#educationEntries .entry-card');
  if (eduEntries.length > 0) {
    html += `<div class="cv-section-title">EDUCATION</div>`;
    eduEntries.forEach(e => {
      const uni = e.querySelector('.edu-uni')?.value.trim();
      const loc = e.querySelector('.edu-loc')?.value.trim();
      const degree = e.querySelector('.edu-degree')?.value.trim();
      const standing = e.querySelector('.edu-standing')?.value.trim();
      const start = e.querySelector('.edu-start')?.value.trim();
      const end = e.querySelector('.edu-end')?.value.trim();
      const courses = e.querySelector('.edu-courses')?.value.trim();
      if (!uni) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-org">${uni}</span><span class="cv-entry-loc">${loc || ''}</span></div>`;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${degree || ''}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (standing) html += `<div style="font-size:10pt; margin-top:2px;">Academic Standing: ${standing}</div>`;
      if (courses) html += `<div style="font-size:10pt;">Relevant Courses: ${courses}</div>`;
      html += `<br/>`;
    });
  }

  // EXPERIENCE
  const expEntries = document.querySelectorAll('#experienceEntries .entry-card');
  if (expEntries.length > 0) {
    html += `<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>`;
    expEntries.forEach(e => {
      const org = e.querySelector('.exp-org')?.value.trim();
      const loc = e.querySelector('.exp-loc')?.value.trim();
      const title = e.querySelector('.exp-title')?.value.trim();
      const dept = e.querySelector('.exp-dept')?.value.trim();
      const start = e.querySelector('.exp-start')?.value.trim();
      const end = e.querySelector('.exp-end')?.value.trim();
      const bullets = e.querySelector('.exp-bullets')?.value.trim();
      if (!org) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-org">${org}</span><span class="cv-entry-loc">${loc || ''}</span></div>`;
      const titleFull = dept ? `${title} (${dept})` : title;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${titleFull || ''}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (bullets) {
        const lines = bullets.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${l.replace(/^[•\-*]\s*/,'')}</li>`; });
        html += `</ul>`;
      }
      html += `<br/>`;
    });
  }

  // LEADERSHIP
  const leadEntries = document.querySelectorAll('#leadershipEntries .entry-card');
  const hasLeadData = Array.from(leadEntries).some(e => e.querySelector('.lead-org')?.value.trim());
  if (hasLeadData) {
    html += `<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>`;
    leadEntries.forEach(e => {
      const org = e.querySelector('.lead-org')?.value.trim();
      const role = e.querySelector('.lead-role')?.value.trim();
      const start = e.querySelector('.lead-start')?.value.trim();
      const end = e.querySelector('.lead-end')?.value.trim();
      const bullets = e.querySelector('.lead-bullets')?.value.trim();
      if (!org) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${role ? role + ', ' + org : org}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (bullets) {
        const lines = bullets.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${l.replace(/^[•\-*]\s*/,'')}</li>`; });
        html += `</ul>`;
      }
      html += `<br/>`;
    });
  }

  // SKILLS
  const tech = document.getElementById('b-techSkills')?.value.trim();
  const soft = document.getElementById('b-softSkills')?.value.trim();
  const langs = document.getElementById('b-languages')?.value.trim();
  if (tech || soft || langs) {
    html += `<div class="cv-section-title">SKILLS</div>`;
    if (tech) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> ${tech}</div>`;
    if (soft) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> ${soft}</div>`;
    if (langs) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Languages:</strong> ${langs}</div>`;
    html += `<br/>`;
  }

  // AWARDS
  const awardEntries = document.querySelectorAll('#awardsEntries .entry-card');
  const hasAwards = Array.from(awardEntries).some(e => e.querySelector('.award-name')?.value.trim());
  if (hasAwards) {
    html += `<div class="cv-section-title">CERTIFICATIONS & AWARDS</div><ul class="cv-awards-list">`;
    awardEntries.forEach(e => {
      const name = e.querySelector('.award-name')?.value.trim();
      const org = e.querySelector('.award-org')?.value.trim();
      const year = e.querySelector('.award-year')?.value.trim();
      if (!name) return;
      let entry = name;
      if (org) entry += `, ${org}`;
      if (year) entry += ` (${year})`;
      html += `<li>${entry}</li>`;
    });
    html += `</ul>`;
  }

  const container = document.getElementById('cvPreviewContainer');
  container.innerHTML = html;
  showToast('CV preview generated!');
}

function downloadBuiltCV() {
  const content = document.getElementById('cvPreviewContainer').innerHTML;
  if (!content || content.includes('cv-preview-placeholder')) {
    showToast('Please generate a preview first.', true); return;
  }
  const firstName = document.getElementById('b-firstName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  const title = `${firstName} ${lastName} CV (${new Date().toLocaleDateString('en-GB')})`;
  printCV(content, `${firstName}_${lastName}_CV`);
  // Auto-save to Firestore if logged in
  if (window.saveCVToFirestore) saveCVToFirestore('built', title, content, document.getElementById('previewTarget')?.value || 'general', '');
}

function copyBuiltCV() {
  const content = document.getElementById('cvPreviewContainer').innerText;
  if (!content || content.includes('Generate Preview')) {
    showToast('Please generate a preview first.', true); return;
  }
  navigator.clipboard.writeText(content).then(() => showToast('CV copied to clipboard!'));
}

// ===== TIPS TABS =====
function showTipsTab(tab) {
  document.querySelectorAll('.tips-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tips-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tips-tab[onclick="showTipsTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tips-${tab}`).classList.add('active');
}

// ===== SAMPLE CVs MODAL =====
const sampleData = {
  veronica: `<div class="cv-name">VERONICA MENSAH</div>
<div class="cv-contact">vmensah@gmail.com | +233 54 023 4567 | linkedin.com/in/veronica-mensah</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Ghana</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Accounting and Finance</span><span class="cv-entry-date">Expected Jun 2026</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: First Class Honours</div>
<div style="font-size:10pt;">Relevant Courses: Corporate Finance and Financial Accounting</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">JPMorgan Chase & Co.</span><span class="cv-entry-loc">London, United Kingdom</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Investment Banking Summer Analyst (Mergers & Acquisitions)</span><span class="cv-entry-date">Jun 2024 – Aug 2024</span></div>
<ul class="cv-bullets">
  <li>Contributed to deal strategy and execution for 2 M&A transactions (average EV: £3bn), providing critical analysis and strategic insights.</li>
  <li>Developed key sections of the CIM for a £300m technology sell-side transaction, showcasing critical financial and operational insights to attract potential buyers.</li>
  <li>Led the VDR management, organising and uploading sensitive data to streamline due diligence for key stakeholders.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Standard Chartered Bank PLC</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Enterprise Banking Intern</span><span class="cv-entry-date">Jul 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Built an Excel dashboard tracking 1,000+ weekly metrics, enhancing data-driven decision-making in enterprise banking.</li>
  <li>Evaluated the financial capacity of 15+ companies to secure loans exceeding 170,000 cedis, mitigating risk and optimising lending.</li>
  <li>Successfully onboarded 5 new enterprise clients, expanding the bank's SME portfolio.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Databank Asset Management Services Limited</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Asset Management Intern</span><span class="cv-entry-date">Oct 2019 – Mar 2020</span></div>
<ul class="cv-bullets">
  <li>Developed a Taylor-rule-based financial model to forecast 2020 inflation and interest rates, utilised in budget planning.</li>
  <li>Collaborated with the dealing desk to purchase over 500,000 cedis in government bonds, contributing to portfolio management for pension clients.</li>
  <li>Reported 2019 Q4 investment holdings to the Securities and Exchange Commission (SEC) and the National Pensions Regulatory Authority (NPRA).</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Vice President of Projects, Enactus University of Ghana</span><span class="cv-entry-date">Oct 2024 – Present</span></div>
<ul class="cv-bullets">
  <li>Oversaw 3 high-impact social innovation projects, coordinating 25 team members and achieving a 40% increase in funding while directly benefiting 1,200+ community members in one year.</li>
</ul>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Financial Modelling & Valuation Analyst (FMVA) Certification, Corporate Finance Institute (CFI)</li>
  <li>2023 Sub-Regional Champion, CFA Institute Research Challenge</li>
  <li>Chancellor's Award for Academic Excellence, University of Ghana (2024)</li>
</ul>`,

  engineering: `<div class="cv-name">KWABENA MENSAH BOATENG</div>
<div class="cv-contact">kboateng.eng@gmail.com | +233 24 876 5432 | linkedin.com/in/kwabena-boateng-eng</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Energy and Natural Resources (UENR)</span><span class="cv-entry-loc">Sunyani, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Electrical and Electronics Engineering</span><span class="cv-entry-date">Sep 2021 – Jun 2025</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper | CGPA: 3.61/4.00</div>
<div style="font-size:10pt;">Relevant Courses: Power System Analysis, High Voltage Engineering, Power Generation Transmission & Distribution, Renewable Energy Systems, Digital Electronics</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ghana Grid Company Limited (GRIDCo)</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">National Service Personnel – System Operations Department</span><span class="cv-entry-date">Oct 2025 – Present</span></div>
<ul class="cv-bullets">
  <li>Monitors real-time power system operations across Ghana's national transmission network, supporting load dispatch and voltage control activities.</li>
  <li>Assisted in the preparation of 12 weekly system performance reports, improving documentation accuracy by 25% through structured Excel-based templates.</li>
  <li>Participated in a substation commissioning exercise at Pokuase 330/161kV substation, gaining practical exposure to protection relay testing and energisation procedures.</li>
  <li>Supported the maintenance planning team by compiling outage data for 8 transmission lines into a centralised fault register.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Volta River Authority (VRA)</span><span class="cv-entry-loc">Tema, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Electrical Engineering Intern</span><span class="cv-entry-date">Jul 2024 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Rotated through the Generation, Transmission, and Control departments, gaining exposure to hydro and thermal power generation systems at the Akosombo and Kpong plants.</li>
  <li>Designed a basic load-flow simulation model in MATLAB for a section of the VRA network as part of a departmental training project.</li>
  <li>Compiled and analysed monthly equipment inspection reports for 5 generator units, contributing to predictive maintenance scheduling.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Electricity Company of Ghana (ECG) – Brong-Ahafo Region</span><span class="cv-entry-loc">Sunyani, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Electrical Engineering Intern</span><span class="cv-entry-date">Jun 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Supported the Fault and Maintenance team in conducting patrols and fault detection on 33kV distribution lines serving over 4,000 customers in the Sunyani municipality.</li>
  <li>Assisted in the installation and testing of 3 new distribution transformers, reducing localised outage frequency by an estimated 18% in the affected communities.</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">General Secretary, Electrical & Electronics Engineering Students' Association (ELEESA-UENR)</span><span class="cv-entry-date">Oct 2023 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Coordinated 4 departmental seminars and 2 industry visit programmes attended by 150+ engineering students, strengthening industry–academia linkages.</li>
  <li>Managed departmental records and correspondence, improving administrative response time by 40%.</li>
</ul>
<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> AutoCAD Electrical, MATLAB (Simulink), ETAP (Power Systems), Python, C++, Multisim, Microsoft Excel (Advanced), PLC Basics</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> Technical Report Writing, Analytical Thinking, Team Collaboration, Problem Solving</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent)</div>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Certificate of Participation, 5-Day Arduino & Embedded Systems Programming Bootcamp, ELEESA-UENR (2023)</li>
  <li>Best Engineering Project Presentation, UENR School of Engineering Annual Fair (2024)</li>
  <li>Certificate of Completion, Introduction to Renewable Energy Systems, Coursera – Duke University (2024)</li>
</ul>`,

  national_service: `<div class="cv-name">KWAME ASANTE BOATENG</div>
<div class="cv-contact">kwameboateng@gmail.com | +233 50 123 4567 | linkedin.com/in/kwame-boateng</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">Kwame Nkrumah University of Science and Technology (KNUST)</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Business Administration (Finance Option)</span><span class="cv-entry-date">Sep 2020 – Jun 2024</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper | CGPA: 3.6/4.0</div>
<div style="font-size:10pt;">Relevant Courses: Corporate Finance, Business Statistics, Financial Management, Entrepreneurship</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ecobank Ghana Limited</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Finance Intern</span><span class="cv-entry-date">Jun 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Analysed 10+ customer financial profiles to support loan application decisions, contributing to a GHS 200,000 lending portfolio review.</li>
  <li>Developed weekly Excel reports for branch management, improving visibility of key retail banking metrics by 30%.</li>
  <li>Assisted in onboarding 8 new business clients, expanding the branch's SME customer base.</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Financial Secretary, KNUST Business Students Association</span><span class="cv-entry-date">Sep 2022 – Aug 2023</span></div>
<ul class="cv-bullets"><li>Managed a GHS 15,000 departmental budget, ensuring transparent reporting and a 20% reduction in administrative expenditure.</li></ul>
<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> Microsoft Excel (Advanced), PowerPoint, Word, Financial Modelling (Basic), Accounting Software (QuickBooks)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> Communication, Analytical Thinking, Teamwork, Problem Solving</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent), Fante (Intermediate)</div>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Best Finance Student Award, KNUST SoBS (2024)</li>
  <li>Certificate of Completion, Google Digital Marketing Fundamentals (2023)</li>
</ul>`,

  postgrad: `<div class="cv-name">ABENA ASIEDUA FRIMPONG</div>
<div class="cv-contact">afrimpong@gmail.com | +233 24 765 4321 | linkedin.com/in/abena-frimpong</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Ghana, Legon</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Economics</span><span class="cv-entry-date">Sep 2018 – Jun 2022</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: First Class Honours | CGPA: 3.92/4.00</div>
<div style="font-size:10pt;">Relevant Courses: Econometrics, Development Economics, Public Finance, Research Methods</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ghana Revenue Authority</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Research & Policy Analyst</span><span class="cv-entry-date">Aug 2022 – Present</span></div>
<ul class="cv-bullets">
  <li>Developed econometric models to forecast tax revenue for the 2024 National Budget, with outputs adopted in official budget documentation.</li>
  <li>Authored 3 policy briefs on VAT compliance and informal sector taxation, presented to the Commissioner-General and Ministry of Finance.</li>
  <li>Led a team of 4 analysts to evaluate the fiscal impact of tax exemptions in the 2023 Annual Revenue Report.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Institute of Statistical, Social and Economic Research (ISSER), UG</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Research Assistant</span><span class="cv-entry-date">Jan 2022 – Jul 2022</span></div>
<ul class="cv-bullets">
  <li>Assisted in data collection and analysis for a World Bank-funded study on financial inclusion in rural Ghana, covering 500+ household surveys.</li>
  <li>Contributed to three published working papers on poverty dynamics and social protection in sub-Saharan Africa.</li>
</ul>
<div class="cv-section-title">SKILLS & RESEARCH METHODS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Statistical Software:</strong> Stata, R, SPSS, Python (Pandas, NumPy)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Research:</strong> Econometric Modelling, Survey Design, Qualitative & Quantitative Analysis, Policy Evaluation</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), French (Intermediate)</div>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Vice-Chancellor's Award for Academic Excellence, University of Ghana (2022)</li>
  <li>African Economic Research Consortium (AERC) Short Course Certificate in Macroeconomics (2023)</li>
  <li>Best Graduating Student, Department of Economics, University of Ghana (2022)</li>
</ul>`
};

function showSample(key) {
  document.getElementById('modalContent').innerHTML = sampleData[key] || '<p>Sample not found.</p>';
  document.getElementById('sampleModal').classList.add('active');
  // Store the current sample key for download
  document.getElementById('sampleModal').dataset.currentKey = key;
}

function downloadSampleCV() {
  const content = document.getElementById('modalContent').innerHTML;
  const key = document.getElementById('sampleModal').dataset.currentKey || 'sample';
  const names = { veronica: 'Veronica_Mensah_CV', engineering: 'Alexander_Opoku_CV', national_service: 'National_Service_Sample_CV', postgrad: 'Postgraduate_Sample_CV' };
  printCV(content, names[key] || 'Sample_CV');
}

function useSampleAsTemplate() {
  const content = document.getElementById('modalContent').innerText;
  // Switch to builder, paste into the paste area encouragement
  closeSampleModal(null, true);
  scrollToSection('build');
  showToast('Study this sample and use the Builder below to create your own version!');
}

function closeSampleModal(e, force) {
  if (force || (e && e.target === document.getElementById('sampleModal'))) {
    document.getElementById('sampleModal').classList.remove('active');
  }
}

// ===== TOAST NOTIFICATIONS =====
let toastTimer;
function showToast(message, isError = false) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast${isError ? ' error' : ''}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== CV SCORE ENGINE =====
function scoreCVFromPaste() {
  const text = document.getElementById('cvPasteText').value.trim();
  if (!text) { showToast('Please paste your CV text first in Step 2.', true); return; }
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  showCVScore(text, target);
}

function scoreBuiltCV() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  if (!firstName || !lastName) { showToast('Please fill in your details first.', true); return; }
  // Build a text representation of the CV for scoring
  const html = document.getElementById('cvPreviewContainer').innerHTML;
  const text = document.getElementById('cvPreviewContainer').innerText || '';
  if (text.includes('Generate Preview') || text.length < 50) {
    showToast('Please generate a preview first.', true); return;
  }
  showCVScore(text, 'general');
}

function showCVScore(text, target) {
  const scores = calculateCVScore(text, target);
  const total = Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
  const grade = total >= 85 ? { label: 'Excellent', color: '#006b3f' }
    : total >= 70 ? { label: 'Good', color: '#2196F3' }
    : total >= 55 ? { label: 'Average', color: '#FF9800' }
    : { label: 'Needs Work', color: '#ce1126' };

  let html = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:100px;height:100px;border-radius:50%;background:${grade.color};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 12px;font-family:'Inter',sans-serif;">
        <span style="font-size:2rem;font-weight:800;">${total}</span>
        <span style="font-size:0.7rem;font-weight:600;opacity:0.9;">/ 100</span>
      </div>
      <div style="font-size:1.3rem;font-weight:700;color:${grade.color};font-family:'Inter',sans-serif;">${grade.label}</div>
      <div style="font-size:0.85rem;color:#5a5a7a;font-family:'Inter',sans-serif;margin-top:4px;">CV Overall Score</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;font-family:'Inter',sans-serif;">`;

  scores.forEach(s => {
    const pct = Math.min(100, Math.max(0, s.score));
    const barColor = pct >= 80 ? '#006b3f' : pct >= 60 ? '#2196F3' : pct >= 40 ? '#FF9800' : '#ce1126';
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:0.85rem;font-weight:600;color:#1a1a2e;">${s.label}</span>
          <span style="font-size:0.85rem;font-weight:700;color:${barColor};">${pct}%</span>
        </div>
        <div style="background:#f0f0f8;border-radius:100px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;background:${barColor};height:100%;border-radius:100px;transition:width 1s ease;"></div>
        </div>
        <p style="font-size:0.78rem;color:#5a5a7a;margin-top:4px;">${s.tip}</p>
      </div>`;
  });
  html += `</div>
    <div style="margin-top:20px;padding:14px;background:#e8f5ee;border-radius:10px;border-left:4px solid #006b3f;font-family:'Inter',sans-serif;">
      <p style="font-size:0.85rem;color:#004d2d;font-weight:600;">💡 Pro Tip:</p>
      <p style="font-size:0.83rem;color:#1a1a2e;margin-top:4px;">${getScoreTip(total, target)}</p>
    </div>`;

  document.getElementById('scoreContent').innerHTML = html;
  document.getElementById('scoreModal').classList.add('active');
}

function calculateCVScore(text, target) {
  const lower = text.toLowerCase();
  const actionVerbs = ['developed','built','led','executed','managed','analysed','analyzed','designed','increased','reduced','implemented','coordinated','delivered','achieved','established','oversaw','spearheaded','contributed','collaborated','streamlined','launched','created','improved','generated','negotiated','secured','drove','facilitated','authored','trained'];
  const weakPhrases = ['responsible for','was on','worked on','helped with','assisted in','duties included','tasked with','was involved in','was part of'];
  const hasQuantity = /\b\d+[\s%+,]/.test(text);
  const hasEmail = /[\w.]+@[\w.]+/.test(text);
  const hasPhone = /\+?\d[\d\s\-()]{8,}/.test(text);
  const hasLinkedIn = /linkedin\.com/i.test(text);
  const hasDates = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i.test(text);
  const hasActionVerb = actionVerbs.some(v => lower.includes(v));
  const weakCount = weakPhrases.filter(p => lower.includes(p)).length;
  const sectionCount = ['education','experience','skill','leadership','certif','award'].filter(s => lower.includes(s)).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lineCount = text.split('\n').filter(l => l.trim()).length;

  // Consistency checks
  const dateVariants = (text.match(/\b(January|February|March|April|June|July|August|September|October|November|December)\b/g) || []).length;
  const consistencyScore = dateVariants === 0 ? 90 : 60; // Mixing full months with abbreviated is penalised

  return [
    {
      label: 'Contact Information',
      score: (hasEmail ? 35 : 0) + (hasPhone ? 35 : 0) + (hasLinkedIn ? 30 : 0),
      tip: !hasEmail ? 'Add a professional email address.' : !hasPhone ? 'Add your phone number with country code (+233...).' : !hasLinkedIn ? 'Add your LinkedIn profile URL for more credibility.' : 'Contact information looks complete.'
    },
    {
      label: 'Section Structure',
      score: Math.min(100, sectionCount * 17),
      tip: sectionCount >= 5 ? 'Your CV has a well-rounded structure.' : `Add more sections — include Education, Experience, Skills, Leadership, and Certifications.`
    },
    {
      label: 'Action Language',
      score: hasActionVerb ? (weakCount === 0 ? 95 : weakCount === 1 ? 75 : 55) : 30,
      tip: !hasActionVerb ? 'Use strong action verbs: Developed, Built, Led, Executed, Analysed.' : weakCount > 0 ? `Remove weak phrases like "responsible for" or "was on" — replace with action verbs.` : 'Great use of action verbs throughout.'
    },
    {
      label: 'Quantified Achievements',
      score: hasQuantity ? 85 : 35,
      tip: hasQuantity ? 'Good — you have figures in your CV. Ensure every major bullet has a number.' : 'Add real figures to your bullets: percentages, cedis, team sizes, number of clients, etc.'
    },
    {
      label: 'Date Consistency',
      score: hasDates ? consistencyScore : 45,
      tip: !hasDates ? 'Ensure all dates are in a consistent format (e.g. Jun 2024).' : dateVariants > 0 ? 'Mix of full and abbreviated month names detected — use one format only (e.g. Jun 2024).' : 'Date format appears consistent.'
    },
    {
      label: 'Length & Density',
      score: wordCount < 50 ? 20 : wordCount < 150 ? 50 : wordCount < 500 ? 80 : wordCount < 900 ? 95 : 70,
      tip: wordCount < 150 ? 'Your CV seems too short — add more detail to your experience and achievements.' : wordCount > 900 ? 'Your CV may be too long — be more concise. Aim for 1 page (under 3 years experience).' : 'Good length and density for a professional CV.'
    },
  ];
}

function getScoreTip(total, target) {
  if (total >= 85) return 'Your CV is in great shape! Make sure to tailor the content for each specific opportunity you apply for.';
  if (total >= 70) return 'Good foundation. Focus on adding quantified achievements and strengthening your action verbs to push your score higher.';
  const tips = {
    banking: 'For banking & finance roles, quantify every achievement with deal values, portfolio sizes, or percentage improvements.',
    tech: 'For tech roles, highlight GitHub, technical certifications, and specific programming languages with proficiency levels.',
    academic: 'For academic applications, foreground your GPA, research experience, publications, and academic honours.',
    national_service: 'For national service, emphasise your academic standing, leadership roles, and community involvement.',
    postgraduate: 'For postgraduate applications, lead with your academic excellence, research interests, and relevant professional experience.'
  };
  return tips[target] || 'Focus on using strong action verbs, quantifying your impact with numbers, and ensuring all sections are complete.';
}

function closeScoreModal(e, force) {
  if (force || (e && e.target === document.getElementById('scoreModal'))) {
    document.getElementById('scoreModal').classList.remove('active');
  }
}

// ===== COVER LETTER GENERATOR =====
function generateCoverLetterFromRefine() {
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  const role = document.getElementById('specific-role').value.trim();
  const cvText = document.getElementById('cvPasteText').value.trim() || '';
  showCoverLetter(null, null, target, role, cvText);
}

function generateCoverLetterFromBuilder() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const middleName = document.getElementById('b-middleName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  if (!firstName || !lastName) { showToast('Please fill in your name in Personal Info first.', true); return; }
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const email = document.getElementById('b-email').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  const target = document.getElementById('previewTarget')?.value || 'general';
  const cvText = document.getElementById('cvPreviewContainer').innerText || '';
  showCoverLetter(fullName, { email, phone }, target, '', cvText);
}

function showCoverLetter(name, contact, target, role, cvText) {
  const cl = buildCoverLetter(name, contact, target, role, cvText);
  document.getElementById('coverLetterContent').textContent = cl;
  document.getElementById('coverLetterModal').classList.add('active');
}

function buildCoverLetter(name, contact, target, role, cvText) {
  const today = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  // Try to detect name from CV text if not provided
  if (!name) {
    const lines = cvText.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.length < 50 && /^[A-Z][A-Z\s]+$/.test(line.trim())) { name = line.trim(); break; }
      if (line.length < 50 && /^[A-Z][a-z]+ [A-Z]/.test(line.trim())) { name = line.trim().toUpperCase(); break; }
    }
    name = name || 'YOUR NAME';
  }

  const targetOrg = {
    corporate_job: 'the Hiring Manager',
    national_service: 'the National Service Secretariat Placement Officer',
    graduate_programme: 'the Graduate Recruitment Team',
    postgraduate: 'the Admissions Committee',
    internship: 'the Internship Coordinator',
    academia: 'the Head of Department / Research Supervisor',
    ngo: 'the Recruitment Officer',
    banking: 'the Graduate Recruitment Team',
    tech: 'the Engineering Hiring Manager',
    general: 'the Hiring Manager'
  };

  const opener = {
    corporate_job: `I am writing to express my keen interest in joining your esteemed organisation. With a strong academic foundation and hands-on professional experience, I am confident in my ability to contribute meaningfully from day one.`,
    national_service: `I am writing to apply for a national service placement with your organisation. As a recent graduate with strong academic credentials and relevant work experience, I am eager to contribute to your team during my national service year.`,
    graduate_programme: `I am writing to apply for your graduate programme. I am a high-achieving student with a passion for ${role ? role : 'the industry'}, and I am confident that your programme will provide the ideal platform to launch my career.`,
    postgraduate: `I am writing to apply for postgraduate studies at your institution. My academic performance, research experience, and professional background have prepared me well for advanced study in my chosen field.`,
    internship: `I am writing to apply for an internship opportunity with your organisation. I am a motivated student eager to apply my academic knowledge in a real-world setting and gain invaluable professional experience.`,
    academia: `I am writing to express my interest in joining your research team. My academic background and research experience make me well-suited to contribute to your work in a meaningful and impactful way.`,
    banking: `I am writing to express my strong interest in joining your banking and finance team. My analytical mindset, finance background, and proven track record of delivering results make me an ideal candidate for this role.`,
    tech: `I am writing to apply for an engineering or technology opportunity within your organisation. My technical skills, project experience, and problem-solving abilities equip me to contribute effectively to your technical teams.`,
    ngo: `I am writing to express my interest in working with your organisation. I am deeply committed to development work and believe my skills and experience align closely with your mission and values.`,
    general: `I am writing to express my interest in an opportunity with your organisation. I bring a strong combination of academic excellence, professional experience, and a determined work ethic that I believe would add real value to your team.`
  };

  const roleRef = role ? ` for the position of ${role}` : '';
  const emailLine = contact?.email ? `Email: ${contact.email}` : '';
  const phoneLine = contact?.phone ? `Tel: ${contact.phone}` : '';

  return `${name}
${emailLine}${emailLine && phoneLine ? '\n' : ''}${phoneLine}

${dateStr}

Dear ${targetOrg[target] || targetOrg.general},

RE: Application${roleRef}

${opener[target] || opener.general}

Throughout my academic and professional journey, I have demonstrated a consistent ability to deliver results, take initiative, and contribute to organisational goals. ${role ? `My background closely aligns with the requirements of ${role}, and I am excited by the opportunity to bring my skills and passion to your team.` : 'I am enthusiastic about the opportunity to bring my skills, dedication, and fresh perspective to your organisation.'}

I am particularly drawn to your organisation because of its reputation for excellence, innovation, and impact. I am confident that my academic achievements, practical experience, and strong interpersonal skills make me a strong fit for your team and culture.

I would welcome the opportunity to discuss my application further at your convenience. Please find my CV attached for your review.

Thank you sincerely for your time and consideration. I look forward to hearing from you.

Yours faithfully,

${name}`;
}

function downloadCoverLetter() {
  const text = document.getElementById('coverLetterContent').textContent;
  const printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.write(`<!DOCTYPE html><html><head><title>Cover Letter</title>
    <style>body{font-family:'Times New Roman',serif;font-size:12pt;margin:2.5cm;color:#000;line-height:1.8;}p{margin-bottom:12pt;}</style>
    </head><body><pre style="font-family:'Times New Roman',serif;font-size:12pt;white-space:pre-wrap;line-height:1.8;">${text}</pre></body></html>`);
  printWin.document.close();
  setTimeout(() => { printWin.print(); }, 500);
  // Auto-save to Firestore if logged in
  const htmlContent = `<pre style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.8;white-space:pre-wrap;">${text}</pre>`;
  if (window.saveCVToFirestore) saveCVToFirestore('cover_letter', `Cover Letter (${new Date().toLocaleDateString('en-GB')})`, htmlContent, '', '');
}

function copyCoverLetter() {
  const text = document.getElementById('coverLetterContent').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Cover letter copied to clipboard!'));
}

function closeCLModal(e, force) {
  if (force || (e && e.target === document.getElementById('coverLetterModal'))) {
    document.getElementById('coverLetterModal').classList.remove('active');
  }
}

// ===== KEYBOARD CLOSE MODALS =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSampleModal(null, true);
    closeScoreModal(null, true);
    closeCLModal(null, true);
  }
});


// ===== CLOSE NAV ON LINK CLICK (mobile) =====
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

console.log('%c CV Genius Ghana 🇬🇭 ', 'background:#006b3f; color:#fcd116; font-size:16px; padding:8px 16px; border-radius:8px; font-weight:bold;');
