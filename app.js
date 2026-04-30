// Shared keys
const STORAGE_KEY = 'complaints_data';

// Load complaints from localStorage
function getComplaints() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Save complaint
function saveComplaint(complaint) {
  const complaints = getComplaints();
  complaints.unshift({
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    ...complaint
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
}

// Initialize Home Page
function initHome() {
  const complaintsList = document.getElementById('complaintsList');
  if (!complaintsList) return;

  const complaints = getComplaints();

  if (complaints.length === 0) {
    complaintsList.innerHTML = '<div class="empty-state">No complaints registered yet.</div>';
    return;
  }

  complaintsList.innerHTML = complaints.map(c => `
    <div class="complaint-card">
      <h3>${c.name}</h3>
      <div class="complaint-meta">📍 ${c.city} • 📱 ${c.mobile} • 🗓️ ${c.date}</div>
      <p>${c.complaint}</p>
      ${c.aiQuestion ? `
        <div style="margin-top: 1rem; padding: 1rem; background-color: rgba(59, 130, 246, 0.05); border-radius: 6px; border-left: 3px solid var(--primary);">
          <strong>AI Question:</strong> <span style="color: var(--text-secondary);">${c.aiQuestion}</span>
          <br><br>
          <strong>User Answer:</strong> <span style="color: var(--text-secondary);">${c.aiAnswer}</span>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Initialize Add Page
function initAdd() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  let step = 1;
  let currentAiQuestion = '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (step === 1) {
      // Step 1: Generate AI Question
      let apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        apiKey = prompt('Please enter your Gemini API Key to enable AI features:');
        if (!apiKey) {
          alert('API Key is required to proceed.');
          return;
        }
        localStorage.setItem('gemini_api_key', apiKey);
      }

      const complaintText = document.getElementById('complaint').value;
      const city = document.getElementById('city').value;
      const submitBtn = document.getElementById('submitBtn');
      
      submitBtn.textContent = 'Generating AI Question...';
      submitBtn.disabled = true;

      try {
        const promptText = `Based on the following complaint from a user in ${city}, ask ONE specific and clarifying question to get more helpful details from the user. Only return the question itself. Complaint: "${complaintText}"`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message);
        }

        currentAiQuestion = data.candidates[0].content.parts[0].text.trim();
        
        // Show Step 2
        document.getElementById('aiQuestionText').textContent = currentAiQuestion;
        document.getElementById('aiSection').style.display = 'block';
        
        // Make original fields readonly
        document.getElementById('name').readOnly = true;
        document.getElementById('city').readOnly = true;
        document.getElementById('mobile').readOnly = true;
        document.getElementById('complaint').readOnly = true;
        
        // Make AI Answer required
        document.getElementById('aiAnswer').required = true;

        submitBtn.textContent = 'Submit Final Complaint';
        submitBtn.disabled = false;
        step = 2;

      } catch (error) {
        alert('Error generating question: ' + error.message);
        submitBtn.textContent = 'Generate AI Question';
        submitBtn.disabled = false;
        if (error.message.includes('API key')) {
          localStorage.removeItem('gemini_api_key');
        }
      }

    } else {
      // Step 2: Save Complaint
      const newComplaint = {
        name: document.getElementById('name').value,
        city: document.getElementById('city').value,
        mobile: document.getElementById('mobile').value,
        complaint: document.getElementById('complaint').value,
        aiQuestion: currentAiQuestion,
        aiAnswer: document.getElementById('aiAnswer').value,
      };

      saveComplaint(newComplaint);
      window.location.href = 'index.html';
    }
  });
}

// Run appropriate init based on current page
document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initAdd();
});
