/**
 * validation.js — Nexova Solutions Application Form
 * Real-time + submit validation for multi-step form
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let currentStep = 1;
  const TOTAL_STEPS = 3;

  // ── Utility helpers ────────────────────────────────────────────────────────

  function currentLanguage() {
    if (typeof window.getAppLanguage === 'function') {
      return window.getAppLanguage();
    }
    return localStorage.getItem('language') === 'en' ? 'en' : 'es';
  }

  function byLanguage(spanishText, englishText) {
    return currentLanguage() === 'en' ? englishText : spanishText;
  }

  /**
   * Show an error message for a field
   * @param {HTMLElement} input
   * @param {string} errorId
   */
  function showError(input, errorId) {
    input.classList.add('error');
    input.classList.remove('success');
    input.setAttribute('aria-invalid', 'true');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.classList.add('visible');
  }

  /**
   * Clear error state from a field
   * @param {HTMLElement} input
   * @param {string} errorId
   */
  function clearError(input, errorId) {
    input.classList.remove('error');
    input.classList.add('success');
    input.setAttribute('aria-invalid', 'false');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.classList.remove('visible');
  }

  /**
   * Clear both error and success states (neutral)
   * @param {HTMLElement} input
   * @param {string} errorId
   */
  function clearState(input, errorId) {
    input.classList.remove('error', 'success');
    input.removeAttribute('aria-invalid');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.classList.remove('visible');
  }

  // ── Validators ─────────────────────────────────────────────────────────────

  const VALIDATORS = {
    /**
     * Required text field — at least 1 non-whitespace character
     */
    required(value) {
      return value.trim().length > 0;
    },

    /**
     * Email — RFC5322-ish pattern
     */
    email(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
    },

    /**
     * Phone — allows +, digits, spaces, dashes, parens, min 7 digits
     */
    phone(value) {
      const digits = value.replace(/\D/g, '');
      return /^[+\d\s\-().]{7,20}$/.test(value.trim()) && digits.length >= 7;
    },

    /**
     * Date — must be in the past and person at least 16 years old
     */
    birthDate(value) {
      if (!value) return false;
      const date = new Date(value);
      const now = new Date();
      if (isNaN(date.getTime()) || date >= now) return false;
      const age = (now - date) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 16;
    },

    /**
     * URL — optional but must be valid if provided
     */
    url(value) {
      if (!value.trim()) return true; // optional
      try {
        const url = new URL(value.trim());
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    },

    /**
     * LinkedIn URL — required and must match linkedin.com/in/
     */
    linkedin(value) {
      if (!value.trim()) return false;
      try {
        const url = new URL(value.trim());
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          url.hostname.includes('linkedin.com') &&
          url.pathname.startsWith('/in/')
        );
      } catch {
        return false;
      }
    },

    /**
     * Min-length text
     */
    minLength(value, min) {
      return value.trim().length >= min;
    },

    /**
     * At least one checkbox checked in a named group
     */
    checkboxGroup(name) {
      return document.querySelectorAll(`input[name="${name}"]:checked`).length > 0;
    },

    /**
     * Select — not empty
     */
    select(value) {
      return value !== '' && value !== null;
    },
  };

  // ── Field validation map ────────────────────────────────────────────────────
  /**
   * Returns true if valid, false if not
   * Also triggers showError / clearError side effects
   */
  function validateField(id, errorId, ruleFn) {
    const el = document.getElementById(id);
    if (!el) return true; // field not in DOM → skip
    const valid = ruleFn(el.value, el);
    if (valid) {
      clearError(el, errorId);
    } else {
      showError(el, errorId);
    }
    return valid;
  }

  // ── Step-level validators ──────────────────────────────────────────────────

  function validateStep1() {
    const results = [
      validateField('firstName', 'firstName-error', v => VALIDATORS.required(v)),
      validateField('lastName',  'lastName-error',  v => VALIDATORS.required(v)),
      validateField('email',     'email-error',     v => VALIDATORS.email(v)),
      validateField('phone',     'phone-error',     v => VALIDATORS.phone(v)),
      validateField('birthDate', 'birthDate-error', v => VALIDATORS.birthDate(v)),
      validateField('linkedin',  'linkedin-error',  v => VALIDATORS.linkedin(v)),
      validateField('portfolio', 'portfolio-error', v => VALIDATORS.url(v)),
    ];
    return results.every(Boolean);
  }

  function validateStep2() {
    const results = [
      validateField('companyChosen', 'companyChosen-error', v => VALIDATORS.required(v)),
      validateField('motivation',    'motivation-error',    v => VALIDATORS.minLength(v, 50)),
    ];

    // Checkbox group validation
    const deptValid = VALIDATORS.checkboxGroup('departments');
    const deptError = document.getElementById('departments-error');
    if (deptValid) {
      if (deptError) deptError.classList.remove('visible');
    } else {
      if (deptError) deptError.classList.add('visible');
    }
    results.push(deptValid);

    return results.every(Boolean);
  }

  function validateStep3() {
    const results = [
      validateField('automationChallenge', 'automationChallenge-error', v => VALIDATORS.minLength(v, 80)),
      validateField('agentDescription',    'agentDescription-error',    v => VALIDATORS.minLength(v, 60)),
      validateField('agentInputs',         'agentInputs-error',         v => VALIDATORS.minLength(v, 30)),
      validateField('agentOutputs',        'agentOutputs-error',        v => VALIDATORS.minLength(v, 30)),
      validateField('experienceLevel',     'experienceLevel-error',     v => VALIDATORS.select(v)),
    ];

    // Terms checkbox
    const terms = document.getElementById('acceptTerms');
    const termsError = document.getElementById('terms-error');
    const termsValid = terms && terms.checked;
    if (termsValid) {
      if (terms)      { terms.setAttribute('aria-invalid', 'false'); }
      if (termsError) termsError.classList.remove('visible');
    } else {
      if (terms)      { terms.setAttribute('aria-invalid', 'true'); }
      if (termsError) termsError.classList.add('visible');
    }
    results.push(termsValid);

    return results.every(Boolean);
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  function goToStep(step) {
    // Hide current panel
    const currentPanel = document.getElementById(`panel-${currentStep}`);
    if (currentPanel) currentPanel.classList.remove('active');

    // Show new panel
    const newPanel = document.getElementById(`panel-${step}`);
    if (newPanel) newPanel.classList.add('active');

    // Update step indicator
    updateStepIndicator(step);

    // Update aria progressbar
    const progressbar = document.getElementById('progressbar');
    if (progressbar) {
      progressbar.setAttribute('aria-valuenow', step);
    }

    currentStep = step;

    // Scroll to top of form
    const main = document.getElementById('main-content');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateStepIndicator(active) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const dot = document.getElementById(`dot-${i}`);
      if (!dot) continue;
      dot.classList.remove('done', 'active', 'pending');
      if (i < active) {
        dot.classList.add('done');
        dot.textContent = '✓';
      } else if (i === active) {
        dot.classList.add('active');
        dot.textContent = i;
      } else {
        dot.classList.add('pending');
        dot.textContent = i;
      }
    }
    // Update connector lines
    for (let i = 1; i < TOTAL_STEPS; i++) {
      const line = document.getElementById(`line-${i}`);
      if (!line) continue;
      if (i < active) {
        line.classList.add('done');
      } else {
        line.classList.remove('done');
      }
    }
  }

  // ── Real-time validation ───────────────────────────────────────────────────

  function enhanceDateInputs() {
    document.querySelectorAll('input[type="date"]').forEach((dateInput) => {
      const openPicker = () => {
        if (typeof dateInput.showPicker === 'function') {
          try {
            dateInput.showPicker();
          } catch {
            // Ignore browsers that restrict showPicker without explicit user gesture.
          }
        }
      };

      dateInput.addEventListener('click', openPicker);
      dateInput.addEventListener('focus', openPicker);
      dateInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      });
    });
  }

  function attachRealtime() {
    // Text/email/url/tel/select inputs → validate on blur and input
    const textFields = [
      { id: 'firstName',   err: 'firstName-error',   rule: v => VALIDATORS.required(v) },
      { id: 'lastName',    err: 'lastName-error',    rule: v => VALIDATORS.required(v) },
      { id: 'email',       err: 'email-error',       rule: v => VALIDATORS.email(v) },
      { id: 'phone',       err: 'phone-error',       rule: v => VALIDATORS.phone(v) },
      { id: 'birthDate',   err: 'birthDate-error',   rule: v => VALIDATORS.birthDate(v) },
      { id: 'linkedin',    err: 'linkedin-error',    rule: v => VALIDATORS.linkedin(v) },
      { id: 'portfolio',   err: 'portfolio-error',   rule: v => VALIDATORS.url(v) },
      { id: 'motivation',  err: 'motivation-error',  rule: v => VALIDATORS.minLength(v, 50) },
      { id: 'automationChallenge', err: 'automationChallenge-error', rule: v => VALIDATORS.minLength(v, 80) },
      { id: 'agentDescription',   err: 'agentDescription-error',    rule: v => VALIDATORS.minLength(v, 60) },
      { id: 'agentInputs',        err: 'agentInputs-error',         rule: v => VALIDATORS.minLength(v, 30) },
      { id: 'agentOutputs',       err: 'agentOutputs-error',        rule: v => VALIDATORS.minLength(v, 30) },
      { id: 'experienceLevel',    err: 'experienceLevel-error',     rule: v => VALIDATORS.select(v) },
    ];

    textFields.forEach(({ id, err, rule }) => {
      const el = document.getElementById(id);
      if (!el) return;

      // On blur: full validation
      el.addEventListener('blur', () => {
        if (el.value.trim() === '' && !el.required) {
          clearState(el, err);
          return;
        }
        validateField(id, err, rule);
      });

      // On input: clear error only once typing starts
      el.addEventListener('input', () => {
        if (el.classList.contains('error') && rule(el.value, el)) {
          clearError(el, err);
        }
      });
    });

    // Checkbox group — validate on any change
    document.querySelectorAll('input[name="departments"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const deptValid = VALIDATORS.checkboxGroup('departments');
        const deptError = document.getElementById('departments-error');
        if (deptValid && deptError) deptError.classList.remove('visible');
      });
    });

    // Terms checkbox
    const terms = document.getElementById('acceptTerms');
    if (terms) {
      terms.addEventListener('change', () => {
        const termsError = document.getElementById('terms-error');
        if (terms.checked && termsError) termsError.classList.remove('visible');
      });
    }
  }

  // ── Navigation buttons ─────────────────────────────────────────────────────

  function bindNavigation() {
    // Step 1 → 2
    const nextBtn1 = document.getElementById('nextBtn1');
    if (nextBtn1) {
      nextBtn1.addEventListener('click', () => {
        if (validateStep1()) goToStep(2);
        else focusFirstError('panel-1');
      });
    }

    // Step 2 → 1
    const prevBtn2 = document.getElementById('prevBtn2');
    if (prevBtn2) {
      prevBtn2.addEventListener('click', () => goToStep(1));
    }

    // Step 2 → 3
    const nextBtn2 = document.getElementById('nextBtn2');
    if (nextBtn2) {
      nextBtn2.addEventListener('click', () => {
        if (validateStep2()) goToStep(3);
        else focusFirstError('panel-2');
      });
    }

    // Step 3 → 2
    const prevBtn3 = document.getElementById('prevBtn3');
    if (prevBtn3) {
      prevBtn3.addEventListener('click', () => goToStep(2));
    }
  }

  // ── Focus first error in a panel ─────────────────────────────────────────

  function focusFirstError(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const firstError = panel.querySelector('.field-input.error');
    if (firstError) firstError.focus();
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  function bindSubmit() {
    const form = document.getElementById('applicationForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const valid = validateStep3();
      if (!valid) {
        focusFirstError('panel-3');
        return;
      }

      // Simulate async submit
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        const sendingText = byLanguage('Enviando...', 'Sending...');
        submitBtn.innerHTML = `
          <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>${sendingText}</span>
        `;
      }

      setTimeout(() => {
        showSuccess();
      }, 1200);
    });
  }

  // ── Show success ───────────────────────────────────────────────────────────

  function showSuccess() {
    const overlay = document.getElementById('successOverlay');
    if (overlay) {
      overlay.classList.add('visible');
      // Focus the overlay heading for accessibility
      const heading = document.getElementById('success-title');
      if (heading) heading.focus();
    }
  }

  // ── Clear form ─────────────────────────────────────────────────────────────

  function clearForm() {
    const form = document.getElementById('applicationForm');
    if (!form) return;

    // Reset all inputs, textareas, selects
    form.reset();

    // Remove all visual states from inputs
    form.querySelectorAll('.field-input').forEach(el => {
      el.classList.remove('error', 'success');
      el.removeAttribute('aria-invalid');
    });

    // Re-apply read-only value for company field
    const companyField = document.getElementById('companyChosen');
    if (companyField) companyField.value = 'Nexova Solutions';

    // Hide all error messages
    form.querySelectorAll('.error-msg').forEach(el => el.classList.remove('visible'));

    // Reset checkboxes visual (they reset via form.reset() but ensure aria)
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.removeAttribute('aria-invalid');
    });

    // Return to step 1
    goToStep(1);
  }

  function bindClearButtons() {
    ['clearBtn', 'clearBtn2', 'clearBtn3'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const clearMessage = byLanguage(
          '¿Estas seguro de que quieres limpiar todo el formulario? Se perderan todos los datos ingresados.',
          'Are you sure you want to clear the entire form? All entered data will be lost.'
        );
        if (confirm(clearMessage)) {
          clearForm();
        }
      });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    enhanceDateInputs();
    attachRealtime();
    bindNavigation();
    bindSubmit();
    bindClearButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();