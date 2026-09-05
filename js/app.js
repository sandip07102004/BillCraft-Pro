/**
 * BillCraft Pro — Dynamic Invoice & Billing Application
 * Handles reactive state, calculations, logo uploads, localStorage persistence,
 * PDF export, print handling, and history drawer.
 */

(() => {
  'use strict';

  // ==========================================================================
  // CURRENCY SYMBOLS & FORMATTERS
  // ==========================================================================
  const CURRENCY_MAP = {
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    INR: { symbol: '₹', locale: 'en-IN' },
    CAD: { symbol: 'CA$', locale: 'en-CA' },
    AUD: { symbol: 'AU$', locale: 'en-AU' },
    JPY: { symbol: '¥', locale: 'ja-JP' },
    SGD: { symbol: 'SG$', locale: 'en-SG' },
    AED: { symbol: 'AED ', locale: 'en-AE' }
  };

  // Official Logo designed via Stitch (Precision Caliper + Invoice Mark in Royal Blue)
  const DEMO_LOGO_SVG = 'assets/billcraft-logo.png';

  // Helper date formatters
  const formatDateForInput = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-');
      if (!y || !m || !d) return dateStr;
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // ==========================================================================
  // INITIAL STATE MODEL
  // ==========================================================================
  const createDefaultInvoice = (user = null) => {
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + 15);

    const randomId = Math.floor(1000 + Math.random() * 9000);

    const senderName = user ? (user.businessName || user.name) : 'Acme Studio Technologies Pvt. Ltd.';
    const senderEmail = user ? user.email : 'billing@acmestudio.in';

    return {
      id: 'inv_' + Date.now(),
      sender: {
        name: senderName,
        taxId: 'GSTIN: 29AABCA1234F1Z5',
        email: senderEmail,
        phone: '+91 98765 43210',
        address: 'Tower B, 4th Floor, Embassy TechVillage\nOuter Ring Road, Bengaluru, Karnataka 560103',
        logo: null
      },
      client: {
        name: 'Apex Global Enterprises',
        email: 'accounts@apexglobal.in',
        phone: '+91 91234 56789',
        address: 'One BKC, 9th Floor, G Block, Bandra Kurla Complex\nMumbai, Maharashtra 400051'
      },
      metadata: {
        number: `INV-2026-${randomId}`,
        date: formatDateForInput(today),
        dueDate: formatDateForInput(dueDate),
        poNumber: 'PO-88412',
        currency: 'INR',
        status: 'paid' // draft, pending, paid
      },
      items: [
        {
          id: 1,
          description: 'Custom Web Application Architecture & Design System',
          quantity: 1,
          unitPrice: 85000.00
        },
        {
          id: 2,
          description: 'Full-Stack Web Development & API Integration',
          quantity: 40,
          unitPrice: 2500.00
        },
        {
          id: 3,
          description: 'Responsive UI Polish, Performance & Security Audit',
          quantity: 15,
          unitPrice: 3000.00
        },
        {
          id: 4,
          description: 'Cloud Server Deployment, SSL & CI/CD Pipeline',
          quantity: 1,
          unitPrice: 22000.00
        }
      ],
      calculations: {
        discountType: 'percentage', // percentage or fixed
        discountValue: 5,
        taxRate: 18,
        shipping: 0
      },
      notes: {
        paymentTerms: 'Bank: HDFC Bank Ltd.\nAccount: 5020-0091-2384-11\nIFSC Code: HDFC0000123\nBranch: Koramangala, Bengaluru\nUPI ID: acmestudio@okhdfcbank',
        clientNotes: 'Payment is requested within 15 days from invoice issuance. Please reference the invoice number in your NEFT/RTGS/IMPS/UPI remarks. Thank you for your business!'
      }
    };
  };

  // Active state
  let currentInvoice = null;
  let currentUser = null;

  // ==========================================================================
  // DOM ELEMENT REFERENCES
  // ==========================================================================
  const el = {
    // Header actions
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnNewInvoice: document.getElementById('btn-new-invoice'),
    btnOpenHistory: document.getElementById('btn-open-history'),
    btnSaveInvoice: document.getElementById('btn-save-invoice'),
    btnPrintInvoice: document.getElementById('btn-print-invoice'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    btnQuickDownload: document.getElementById('btn-quick-download'),
    historyCountBadge: document.getElementById('history-count-badge'),
    globalStatusPill: document.getElementById('global-status-pill'),
    globalStatusText: document.getElementById('global-status-text'),

    // User & Authentication Elements
    userMenu: document.getElementById('user-menu'),
    userAvatar: document.getElementById('user-avatar'),
    userDropdownMenu: document.getElementById('user-dropdown-menu'),
    dropdownAvatarCircle: document.getElementById('dropdown-avatar-circle'),
    dropdownName: document.getElementById('dropdown-name'),
    dropdownEmail: document.getElementById('dropdown-email'),
    dropdownBusiness: document.getElementById('dropdown-business'),
    dropdownInvoicesCount: document.getElementById('dropdown-invoices-count'),
    dropdownUserStatus: document.getElementById('dropdown-user-status'),
    dropdownStatusDot: document.getElementById('dropdown-status-dot'),
    dropdownStatusText: document.getElementById('dropdown-status-text'),
    dropdownBtnSignout: document.getElementById('dropdown-btn-signout'),
    dropdownBtnDelete: document.getElementById('dropdown-btn-delete'),
    btnSignOut: document.getElementById('btn-sign-out'),

    // Delete Account Modal
    modalDeleteAccount: document.getElementById('modal-delete-account'),
    btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),
    btnCancelDeleteAccount: document.getElementById('btn-cancel-delete-account'),
    btnConfirmDeleteAccount: document.getElementById('btn-confirm-delete-account'),
    btnConfirmDeleteText: document.getElementById('btn-confirm-delete-text'),

    // Delete Invoice Modal
    modalDeleteInvoice: document.getElementById('modal-delete-invoice'),
    deleteInvoiceNumberLabel: document.getElementById('delete-invoice-number-label'),
    btnCloseDeleteInvoiceModal: document.getElementById('btn-close-delete-invoice-modal'),
    btnCancelDeleteInvoice: document.getElementById('btn-cancel-delete-invoice'),
    btnConfirmDeleteInvoice: document.getElementById('btn-confirm-delete-invoice'),


    // Sender Inputs
    senderName: document.getElementById('sender-name'),
    senderTaxId: document.getElementById('sender-tax-id'),
    senderEmail: document.getElementById('sender-email'),
    senderPhone: document.getElementById('sender-phone'),
    senderAddress: document.getElementById('sender-address'),
    logoFileInput: document.getElementById('logo-file-input'),
    logoDropzone: document.getElementById('logo-dropzone'),
    logoPreviewContainer: document.getElementById('logo-preview-container'),
    logoPreviewImg: document.getElementById('logo-preview-img'),
    logoPlaceholderText: document.getElementById('logo-placeholder-text'),
    btnRemoveLogo: document.getElementById('btn-remove-logo'),

    // Client Inputs
    clientName: document.getElementById('client-name'),
    clientEmail: document.getElementById('client-email'),
    clientPhone: document.getElementById('client-phone'),
    clientAddress: document.getElementById('client-address'),

    // Metadata Inputs
    invoiceNumber: document.getElementById('invoice-number'),
    btnRefreshInvNum: document.getElementById('btn-refresh-inv-num'),
    invoiceDate: document.getElementById('invoice-date'),
    invoiceDueDate: document.getElementById('invoice-due-date'),
    currencySelect: document.getElementById('currency-select'),
    invoiceStatus: document.getElementById('invoice-status'),
    poNumber: document.getElementById('po-number'),

    // Items Inputs & Table
    lineItemsTbody: document.getElementById('line-items-tbody'),
    btnAddItem: document.getElementById('btn-add-item'),
    btnAddItemTop: document.getElementById('btn-add-item-top'),
    itemCountLabel: document.getElementById('item-count-label'),

    // Calculation Controls
    btnDiscountPercent: document.getElementById('btn-discount-percent'),
    btnDiscountFixed: document.getElementById('btn-discount-fixed'),
    discountInput: document.getElementById('discount-input'),
    discountSymbolPrefix: document.getElementById('discount-symbol-prefix'),
    taxRateInput: document.getElementById('tax-rate-input'),
    shippingInput: document.getElementById('shipping-input'),
    shippingCurrencyPrefix: document.getElementById('shipping-currency-prefix'),

    // Notes
    paymentTerms: document.getElementById('payment-terms'),
    invoiceNotes: document.getElementById('invoice-notes'),

    // Preview Targets
    previewCard: document.getElementById('invoice-preview-card'),
    previewPaperWrapper: document.getElementById('invoice-paper-wrapper'),
    previewLogo: document.getElementById('inv-preview-logo'),
    previewSenderName: document.getElementById('preview-sender-name'),
    previewSenderDetails: document.getElementById('preview-sender-details'),
    previewInvNumber: document.getElementById('preview-inv-number'),
    previewStatusBadge: document.getElementById('preview-status-badge'),
    previewClientName: document.getElementById('preview-client-name'),
    previewClientDetails: document.getElementById('preview-client-details'),
    previewDate: document.getElementById('preview-date'),
    previewDueDate: document.getElementById('preview-due-date'),
    previewPo: document.getElementById('preview-po'),
    previewCurrencyTag: document.getElementById('preview-currency-tag'),
    previewItemsTbody: document.getElementById('preview-items-tbody'),
    previewPaymentTerms: document.getElementById('preview-payment-terms'),
    previewNotes: document.getElementById('preview-notes'),
    previewSubtotal: document.getElementById('preview-subtotal'),
    previewDiscountRow: document.getElementById('preview-discount-row'),
    previewDiscountLabel: document.getElementById('preview-discount-label'),
    previewDiscountAmount: document.getElementById('preview-discount-amount'),
    previewTaxLabel: document.getElementById('preview-tax-label'),
    previewTaxAmount: document.getElementById('preview-tax-amount'),
    previewShippingRow: document.getElementById('preview-shipping-row'),
    previewShippingAmount: document.getElementById('preview-shipping-amount'),
    previewGrandTotal: document.getElementById('preview-grand-total'),
    previewFooterEmail: document.getElementById('preview-footer-email'),

    // Zoom controls
    btnZoom100: document.getElementById('btn-zoom-100'),

    // Mobile tabs
    tabEditorBtn: document.getElementById('tab-editor-btn'),
    tabPreviewBtn: document.getElementById('tab-preview-btn'),
    editorPanel: document.getElementById('editor-panel'),
    previewPanel: document.getElementById('preview-panel'),

    // History Drawer
    historyDrawer: document.getElementById('history-drawer'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    historyListContainer: document.getElementById('history-list-container'),
    historySearchInput: document.getElementById('history-search-input'),

    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message')
  };

  // ==========================================================================
  // FORMATTING HELPERS
  // ==========================================================================
  const formatMoney = (amount, currencyCode) => {
    const cur = CURRENCY_MAP[currencyCode] || CURRENCY_MAP.INR;
    const num = Number(amount) || 0;
    return `${cur.symbol}${num.toLocaleString(cur.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const showToast = (msg, type = 'success') => {
    if (!el.toast) return;
    el.toastMessage.textContent = msg;
    el.toast.className = `toast-notification show ${type}`;
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, 3200);
  };

  // Helper for smooth page transitions between invoice workspace and login
  const smoothNavigate = (url, replace = false) => {
    document.body.classList.add('page-exit');
    setTimeout(() => {
      if (replace) {
        window.location.replace(url);
      } else {
        window.location.href = url;
      }
    }, 130);
  };

  // Helper to restart CSS animation cleanly without forced layout reflows
  const triggerPanelAnimation = (element) => {
    if (!element) return;
    element.style.animation = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.style.animation = '';
      });
    });
  };

  // Helper to smoothly animate the invoice preview with GPU hardware acceleration
  const triggerInvoicePreviewRefresh = () => {
    const previewCard = document.getElementById('invoice-preview-card');
    if (previewCard) {
      previewCard.classList.remove('invoice-updating');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          previewCard.classList.add('invoice-updating');
          setTimeout(() => previewCard.classList.remove('invoice-updating'), 360);
        });
      });
    }
  };

  // ==========================================================================
  // SYNC FROM DATA MODEL TO FORM INPUTS
  // ==========================================================================
  const populateFormFromState = () => {
    if (!currentInvoice) return;

    // Sender
    el.senderName.value = currentInvoice.sender.name || '';
    el.senderTaxId.value = currentInvoice.sender.taxId || '';
    el.senderEmail.value = currentInvoice.sender.email || '';
    el.senderPhone.value = currentInvoice.sender.phone || '';
    el.senderAddress.value = currentInvoice.sender.address || '';
    updateLogoDisplay(currentInvoice.sender.logo);

    // Client
    el.clientName.value = currentInvoice.client.name || '';
    el.clientEmail.value = currentInvoice.client.email || '';
    el.clientPhone.value = currentInvoice.client.phone || '';
    el.clientAddress.value = currentInvoice.client.address || '';

    // Metadata
    el.invoiceNumber.value = currentInvoice.metadata.number || '';
    el.invoiceDate.value = currentInvoice.metadata.date || '';
    if (el.invoiceDueDate) el.invoiceDueDate.value = currentInvoice.metadata.dueDate || '';
    if (el.currencySelect) el.currencySelect.value = currentInvoice.metadata.currency || 'INR';
    el.invoiceStatus.value = currentInvoice.metadata.status || 'paid';
    if (el.poNumber) el.poNumber.value = currentInvoice.metadata.poNumber || '';

    // Calculations
    el.taxRateInput.value = currentInvoice.calculations.taxRate;
    el.discountInput.value = currentInvoice.calculations.discountValue;
    el.shippingInput.value = currentInvoice.calculations.shipping;
    setDiscountTypeUI(currentInvoice.calculations.discountType);

    // Notes
    el.paymentTerms.value = currentInvoice.notes.paymentTerms || '';
    el.invoiceNotes.value = currentInvoice.notes.clientNotes || '';

    // Line items table
    renderFormLineItems();

    // Trigger full calculation & preview update
    updateFinancialsAndPreview();
  };

  // ==========================================================================
  // SYNC FORM INPUTS INTO DATA MODEL
  // ==========================================================================
  const readFormToState = () => {
    if (!currentInvoice) return;

    currentInvoice.sender.name = el.senderName.value;
    currentInvoice.sender.taxId = el.senderTaxId.value;
    currentInvoice.sender.email = el.senderEmail.value;
    currentInvoice.sender.phone = el.senderPhone.value;
    currentInvoice.sender.address = el.senderAddress.value;

    currentInvoice.client.name = el.clientName.value;
    currentInvoice.client.email = el.clientEmail.value;
    currentInvoice.client.phone = el.clientPhone.value;
    currentInvoice.client.address = el.clientAddress.value;

    currentInvoice.metadata.number = el.invoiceNumber.value;
    currentInvoice.metadata.date = el.invoiceDate.value;
    if (el.invoiceDueDate) currentInvoice.metadata.dueDate = el.invoiceDueDate.value;
    currentInvoice.metadata.currency = el.currencySelect ? el.currencySelect.value : (currentInvoice.metadata.currency || 'INR');
    currentInvoice.metadata.status = el.invoiceStatus.value;
    if (el.poNumber) currentInvoice.metadata.poNumber = el.poNumber.value;

    currentInvoice.calculations.taxRate = parseFloat(el.taxRateInput.value) || 0;
    currentInvoice.calculations.discountValue = parseFloat(el.discountInput.value) || 0;
    currentInvoice.calculations.shipping = parseFloat(el.shippingInput.value) || 0;

    currentInvoice.notes.paymentTerms = el.paymentTerms.value;
    currentInvoice.notes.clientNotes = el.invoiceNotes.value;

    // Persist auto-draft to localStorage
    saveCurrentDraftDebounced();
  };

  // ==========================================================================
  // LINE ITEMS LOGIC
  // ==========================================================================
  const renderFormLineItems = () => {
    el.lineItemsTbody.innerHTML = '';
    const currency = currentInvoice.metadata.currency;

    currentInvoice.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.className = 'item-row';
      tr.dataset.id = item.id;

      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

      tr.innerHTML = `
        <td class="item-desc-cell">
          <input type="text" class="form-input item-desc-input" placeholder="Item description / service" value="${escapeHtml(item.description)}">
        </td>
        <td class="item-qty-cell">
          <input type="number" class="form-input item-qty-input" min="0" step="any" value="${item.quantity}">
        </td>
        <td class="item-rate-cell">
          <input type="number" class="form-input item-rate-input" min="0" step="any" value="${item.unitPrice}">
        </td>
        <td class="item-total-cell">
          ${formatMoney(lineTotal, currency)}
        </td>
        <td style="text-align: center;">
          <button class="btn btn-danger-ghost btn-sm btn-icon btn-remove-row" title="Delete item" ${currentInvoice.items.length <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </td>
      `;

      // Input listeners for this row
      const descInput = tr.querySelector('.item-desc-input');
      const qtyInput = tr.querySelector('.item-qty-input');
      const rateInput = tr.querySelector('.item-rate-input');
      const removeBtn = tr.querySelector('.btn-remove-row');

      descInput.addEventListener('input', (e) => {
        item.description = e.target.value;
        updateFinancialsAndPreview();
        saveCurrentDraftDebounced();
      });

      qtyInput.addEventListener('input', (e) => {
        item.quantity = parseFloat(e.target.value) || 0;
        const total = item.quantity * (Number(item.unitPrice) || 0);
        tr.querySelector('.item-total-cell').textContent = formatMoney(total, currentInvoice.metadata.currency);
        updateFinancialsAndPreview();
        saveCurrentDraftDebounced();
      });

      rateInput.addEventListener('input', (e) => {
        item.unitPrice = parseFloat(e.target.value) || 0;
        const total = (Number(item.quantity) || 0) * item.unitPrice;
        tr.querySelector('.item-total-cell').textContent = formatMoney(total, currentInvoice.metadata.currency);
        updateFinancialsAndPreview();
        saveCurrentDraftDebounced();
      });

      removeBtn.addEventListener('click', () => {
        if (currentInvoice.items.length > 1) {
          currentInvoice.items.splice(index, 1);
          renderFormLineItems();
          updateFinancialsAndPreview();
          saveCurrentDraftDebounced();
        }
      });

      el.lineItemsTbody.appendChild(tr);
    });

    el.itemCountLabel.textContent = currentInvoice.items.length;
  };

  const addNewItem = () => {
    const newId = Date.now() + Math.floor(Math.random() * 100);
    currentInvoice.items.push({
      id: newId,
      description: '',
      quantity: 1,
      unitPrice: 0.00
    });
    renderFormLineItems();
    updateFinancialsAndPreview();
    saveCurrentDraftDebounced();

    // Focus on new row description
    const lastRow = el.lineItemsTbody.lastElementChild;
    if (lastRow) {
      const input = lastRow.querySelector('.item-desc-input');
      if (input) input.focus();
    }
  };

  // ==========================================================================
  // LOGO UPLOAD & DRAG/DROP
  // ==========================================================================
  const updateLogoDisplay = (dataUrl) => {
    currentInvoice.sender.logo = dataUrl || null;
    if (dataUrl) {
      el.logoPreviewImg.src = dataUrl;
      el.logoPreviewImg.style.display = 'block';
      el.logoPlaceholderText.style.display = 'none';
      el.btnRemoveLogo.style.display = 'inline-block';

      // Preview sheet
      el.previewLogo.src = dataUrl;
      el.previewLogo.style.display = 'block';
    } else {
      el.logoPreviewImg.src = '';
      el.logoPreviewImg.style.display = 'none';
      el.logoPlaceholderText.style.display = 'block';
      el.btnRemoveLogo.style.display = 'none';

      // Preview sheet
      el.previewLogo.src = '';
      el.previewLogo.style.display = 'none';
    }
  };

  const handleLogoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'info');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Image size exceeds 3MB', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      updateLogoDisplay(e.target.result);
      saveCurrentDraftDebounced();
      showToast('Business logo updated');
    };
    reader.readAsDataURL(file);
  };

  // ==========================================================================
  // FINANCIAL CALCULATIONS & LIVE PREVIEW RENDERING
  // ==========================================================================
  const updateFinancialsAndPreview = () => {
    if (!currentInvoice) return;

    const currency = currentInvoice.metadata.currency || 'INR';
    const curConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.INR;

    // Update prefix tags
    el.shippingCurrencyPrefix.textContent = curConfig.symbol;
    if (currentInvoice.calculations.discountType === 'fixed') {
      el.discountSymbolPrefix.textContent = curConfig.symbol;
    } else {
      el.discountSymbolPrefix.textContent = '%';
    }

    // 1. Calculate Line Totals & Subtotal
    let subtotal = 0;
    currentInvoice.items.forEach(item => {
      const q = Number(item.quantity) || 0;
      const r = Number(item.unitPrice) || 0;
      subtotal += (q * r);
    });

    // 2. Calculate Discount
    let discountAmount = 0;
    const discountVal = Number(currentInvoice.calculations.discountValue) || 0;
    if (currentInvoice.calculations.discountType === 'percentage') {
      discountAmount = subtotal * (Math.min(100, Math.max(0, discountVal)) / 100);
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, discountVal));
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);

    // 3. Calculate Tax
    const taxRate = Math.max(0, Number(currentInvoice.calculations.taxRate) || 0);
    const taxAmount = taxableAmount * (taxRate / 100);

    // 4. Shipping
    const shippingAmount = Math.max(0, Number(currentInvoice.calculations.shipping) || 0);

    // 5. Grand Total
    const grandTotal = taxableAmount + taxAmount + shippingAmount;

    // Store calculated numbers in invoice state
    currentInvoice.summary = {
      subtotal,
      discountAmount,
      taxAmount,
      shippingAmount,
      grandTotal
    };

    // ========================================================================
    // UPDATE LIVE PREVIEW DOCUMENT
    // ========================================================================

    // Sender details
    el.previewSenderName.textContent = currentInvoice.sender.name || 'Your Business Name';
    const senderParts = [];
    if (currentInvoice.sender.address) senderParts.push(currentInvoice.sender.address);
    const contactLine = [currentInvoice.sender.email, currentInvoice.sender.phone].filter(Boolean).join(' | ');
    if (contactLine) senderParts.push(contactLine);
    if (currentInvoice.sender.taxId) senderParts.push(`Tax ID: ${currentInvoice.sender.taxId}`);
    el.previewSenderDetails.textContent = senderParts.join('\n') || 'Business details will appear here';
    el.previewFooterEmail.textContent = currentInvoice.sender.email || 'billing@example.com';

    // Client details
    el.previewClientName.textContent = currentInvoice.client.name || 'Client Name / Company';
    const clientParts = [];
    if (currentInvoice.client.contact) clientParts.push(`Attn: ${currentInvoice.client.contact}`);
    if (currentInvoice.client.address) clientParts.push(currentInvoice.client.address);
    const clientContactLine = [currentInvoice.client.email, currentInvoice.client.phone].filter(Boolean).join(' | ');
    if (clientContactLine) clientParts.push(clientContactLine);
    el.previewClientDetails.textContent = clientParts.join('\n') || 'Client address & contact info';

    // Metadata
    el.previewInvNumber.textContent = currentInvoice.metadata.number || 'INV-0000';
    el.previewDate.textContent = formatDateDisplay(currentInvoice.metadata.date);
    if (el.previewDueDate) el.previewDueDate.textContent = formatDateDisplay(currentInvoice.metadata.dueDate);
    if (el.previewPo) el.previewPo.textContent = currentInvoice.metadata.poNumber || '—';
    if (el.previewCurrencyTag) el.previewCurrencyTag.textContent = `${currency} (${curConfig.symbol})`;

    // Status Badges (Header pill & Document badge)
    const status = currentInvoice.metadata.status || 'draft';
    updateStatusBadges(status);

    // Render Preview Line Items
    el.previewItemsTbody.innerHTML = '';
    currentInvoice.items.forEach(item => {
      const row = document.createElement('tr');
      const itemTot = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      row.innerHTML = `
        <td>
          <div class="inv-item-desc">${escapeHtml(item.description) || '<em>Item without description</em>'}</div>
        </td>
        <td style="text-align: right;">${item.quantity}</td>
        <td style="text-align: right;">${formatMoney(item.unitPrice, currency)}</td>
        <td style="text-align: right; font-weight: 600;">${formatMoney(itemTot, currency)}</td>
      `;
      el.previewItemsTbody.appendChild(row);
    });

    // Notes & Payment instructions
    el.previewPaymentTerms.textContent = currentInvoice.notes.paymentTerms || 'Bank transfer details or payment link will appear here.';
    el.previewNotes.textContent = currentInvoice.notes.clientNotes || 'Thank you for your business!';

    // Calculations breakdown on preview
    el.previewSubtotal.textContent = formatMoney(subtotal, currency);

    if (discountAmount > 0) {
      el.previewDiscountRow.style.display = 'flex';
      const label = currentInvoice.calculations.discountType === 'percentage'
        ? `Discount (${currentInvoice.calculations.discountValue}%)`
        : 'Discount (Fixed)';
      el.previewDiscountLabel.textContent = label;
      el.previewDiscountAmount.textContent = `-${formatMoney(discountAmount, currency)}`;
    } else {
      el.previewDiscountRow.style.display = 'none';
    }

    el.previewTaxLabel.textContent = `Tax (${currentInvoice.calculations.taxRate}%)`;
    el.previewTaxAmount.textContent = formatMoney(taxAmount, currency);

    if (shippingAmount > 0) {
      el.previewShippingRow.style.display = 'flex';
      el.previewShippingAmount.textContent = formatMoney(shippingAmount, currency);
    } else {
      el.previewShippingRow.style.display = 'none';
    }

    el.previewGrandTotal.textContent = formatMoney(grandTotal, currency);
  };

  const updateStatusBadges = (status) => {
    // Header status pill (if present)
    if (el.globalStatusPill) el.globalStatusPill.className = `status-pill ${status}`;
    if (el.globalStatusText) el.globalStatusText.textContent = status.toUpperCase();

    // Document status badge
    el.previewStatusBadge.className = 'inv-meta-badge';
    if (status === 'paid') {
      el.previewStatusBadge.textContent = 'PAID IN FULL';
      el.previewStatusBadge.style.backgroundColor = '#ECFDF5';
      el.previewStatusBadge.style.color = '#047857';
      el.previewStatusBadge.style.border = '1px solid #A7F3D0';
    } else if (status === 'pending') {
      el.previewStatusBadge.textContent = 'PENDING PAYMENT';
      el.previewStatusBadge.style.backgroundColor = '#FFFBEB';
      el.previewStatusBadge.style.color = '#B45309';
      el.previewStatusBadge.style.border = '1px solid #FDE68A';
    } else {
      el.previewStatusBadge.textContent = 'DRAFT INVOICE';
      el.previewStatusBadge.style.backgroundColor = '#F1F5F9';
      el.previewStatusBadge.style.color = '#64748B';
      el.previewStatusBadge.style.border = '1px solid #E2E8F0';
    }
  };

  const setDiscountTypeUI = (type) => {
    currentInvoice.calculations.discountType = type;
    if (type === 'percentage') {
      el.btnDiscountPercent.classList.add('active');
      el.btnDiscountFixed.classList.remove('active');
      el.discountSymbolPrefix.textContent = '%';
    } else {
      el.btnDiscountFixed.classList.add('active');
      el.btnDiscountPercent.classList.remove('active');
      const cur = CURRENCY_MAP[currentInvoice.metadata.currency] || CURRENCY_MAP.INR;
      el.discountSymbolPrefix.textContent = cur.symbol;
    }
  };

  // Helper XSS prevention
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // ==========================================================================
  // LOCAL STORAGE & USER-SCOPED HISTORY MANAGEMENT
  // ==========================================================================
  const getDraftStorageKey = () => {
    return currentUser ? `billcraft_draft_${currentUser.id}` : 'billcraft_guest_draft';
  };

  const getInvoicesStorageKey = () => {
    return currentUser ? `billcraft_invoices_${currentUser.id}` : 'billcraft_guest_invoices';
  };

  let draftTimeout = null;
  const saveCurrentDraftDebounced = () => {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
      try {
        localStorage.setItem(getDraftStorageKey(), JSON.stringify(currentInvoice));
      } catch (e) {
        console.warn('Draft auto-save error:', e);
      }
    }, 300);
  };

  const getSavedInvoices = () => {
    try {
      const key = getInvoicesStorageKey();
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const updateHistoryBadge = () => {
    const list = getSavedInvoices();
    if (el.historyCountBadge) el.historyCountBadge.textContent = list.length;
    if (el.dropdownInvoicesCount) el.dropdownInvoicesCount.textContent = list.length;
  };

  /**
   * Generate high-quality PDF Blob using html2pdf
   */
  const generatePDFBlob = async () => {
    if (typeof html2pdf === 'undefined') return null;
    const invoiceElement = el.previewCard;
    if (!invoiceElement) return null;

    readFormToState();
    updateFinancialsAndPreview();

    const isMobileHidden = el.previewPanel && el.previewPanel.classList.contains('mobile-hidden');
    let prevStyle = {};
    if (isMobileHidden) {
      prevStyle = {
        position: el.previewPanel.style.position,
        left: el.previewPanel.style.left,
        visibility: el.previewPanel.style.visibility,
        display: el.previewPanel.style.display
      };
      el.previewPanel.classList.remove('mobile-hidden');
      el.previewPanel.style.position = 'fixed';
      el.previewPanel.style.left = '-9999px';
      el.previewPanel.style.display = 'flex';
      el.previewPanel.style.visibility = 'visible';
    }

    invoiceElement.classList.add('pdf-export-single-page');
    try {
      await new Promise(r => setTimeout(r, 50));
      const opt = {
        margin: [8, 8, 8, 8],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'css' }
      };
      const blob = await html2pdf().set(opt).from(invoiceElement).outputPdf('blob');
      return blob;
    } catch (err) {
      console.warn('[BillCraft] generatePDFBlob error:', err);
      return null;
    } finally {
      invoiceElement.classList.remove('pdf-export-single-page');
      if (isMobileHidden) {
        el.previewPanel.style.position = prevStyle.position;
        el.previewPanel.style.left = prevStyle.left;
        el.previewPanel.style.visibility = prevStyle.visibility;
        el.previewPanel.style.display = prevStyle.display;
        el.previewPanel.classList.add('mobile-hidden');
      }
    }
  };

  const saveInvoiceToHistory = () => {
    readFormToState();
    updateFinancialsAndPreview();

    let invNum = (currentInvoice.metadata?.number || '').trim();
    if (!invNum) {
      invNum = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      currentInvoice.metadata.number = invNum;
      if (el.invoiceNumber) el.invoiceNumber.value = invNum;
      if (el.previewInvNumber) el.previewInvNumber.textContent = invNum;
    }

    const list = getSavedInvoices();

    // Match strictly by normalized invoice number (prevents duplicate invoice numbers in history)
    const existingIndex = list.findIndex(item => {
      const itemNum = (item.metadata?.number || '').trim().toLowerCase();
      return itemNum.length > 0 && itemNum === invNum.toLowerCase();
    });

    const invoiceToSave = JSON.parse(JSON.stringify(currentInvoice));
    invoiceToSave.metadata.number = invNum;
    invoiceToSave.savedAt = new Date().toISOString();
    if (currentUser) {
      invoiceToSave.userId = currentUser.id;
    }

    if (existingIndex >= 0) {
      // Existing invoice number: update in-place without creating a duplicate
      invoiceToSave.id = list[existingIndex].id || invoiceToSave.id || ('inv_' + Date.now());
      currentInvoice.id = invoiceToSave.id;
      list[existingIndex] = invoiceToSave;
      showToast(`Updated invoice ${invNum} in history`);
    } else {
      // Different/new invoice number: save as a distinct entry with unique ID
      invoiceToSave.id = 'inv_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      currentInvoice.id = invoiceToSave.id;
      list.unshift(invoiceToSave);
      showToast(`Saved invoice ${invNum} to history`);
    }

    try {
      localStorage.setItem(getInvoicesStorageKey(), JSON.stringify(list));
      updateHistoryBadge();
      renderHistoryList();
    } catch (e) {
      showToast('Could not save to localStorage (storage full?)', 'info');
    }

    // Generate PDF & Sync to Supabase cloud (Storage bucket + Database table)
    if (window.BillCraftDB) {
      const activeUserId = currentUser ? currentUser.id : 'demo_user';
      const clientNameSafe = (invoiceToSave.client?.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${invNum}_${clientNameSafe}.pdf`;

      (async () => {
        try {
          // 1. Sync sender business profile form data to Supabase profiles table
          if (invoiceToSave.sender && window.BillCraftDB.updateProfile) {
            window.BillCraftDB.updateProfile(activeUserId, {
              name: invoiceToSave.sender.name || (currentUser?.name || ''),
              businessName: invoiceToSave.sender.businessName || (currentUser?.businessName || ''),
              email: invoiceToSave.sender.email || (currentUser?.email || ''),
              phone: invoiceToSave.sender.phone || '',
              address: invoiceToSave.sender.address || '',
              cityStateZip: invoiceToSave.sender.cityStateZip || '',
              country: invoiceToSave.sender.country || '',
              taxId: invoiceToSave.sender.taxId || ''
            });
          }

          // 2. Generate PDF blob and upload to Supabase Storage 'invoice-pdfs'
          let pdfUrl = invoiceToSave.pdfUrl || null;
          if (typeof html2pdf !== 'undefined' && window.BillCraftDB.uploadInvoicePdf) {
            const pdfBlob = await generatePDFBlob();
            if (pdfBlob) {
              const uploadedUrl = await window.BillCraftDB.uploadInvoicePdf(pdfBlob, fileName, activeUserId);
              if (uploadedUrl) {
                pdfUrl = uploadedUrl;
                invoiceToSave.pdfUrl = pdfUrl;
                currentInvoice.pdfUrl = pdfUrl;
                console.info('[BillCraft] Invoice PDF uploaded to Supabase Storage:', pdfUrl);

                // Update local storage entry with pdfUrl
                const currentList = getSavedInvoices();
                const idx = currentList.findIndex(i => i.id === invoiceToSave.id);
                if (idx >= 0) {
                  currentList[idx].pdfUrl = pdfUrl;
                  localStorage.setItem(getInvoicesStorageKey(), JSON.stringify(currentList));
                  renderHistoryList();
                }
              }
            }
          }

          // 3. Save all invoice form data and PDF URL to Supabase invoices table
          if (window.BillCraftDB.saveInvoice) {
            const saved = await window.BillCraftDB.saveInvoice(invoiceToSave, activeUserId, pdfUrl);
            if (saved) {
              console.info('[BillCraft] Full invoice form data & PDF URL synced to Supabase database.');
            }
          }
        } catch (syncErr) {
          console.warn('[BillCraft] Supabase background sync notice:', syncErr);
        }
      })();
    }
  };

  const loadInvoiceFromHistory = (invoiceId) => {
    const list = getSavedInvoices();
    const target = list.find(item => item.id === invoiceId || (item.metadata && item.metadata.number === invoiceId));
    if (!target) return;

    currentInvoice = JSON.parse(JSON.stringify(target));
    populateFormFromState();
    closeDrawer();
    triggerInvoicePreviewRefresh();
    showToast(`Loaded invoice ${currentInvoice.metadata.number}`);
  };

  let pendingDeleteInvoiceId = null;
  let pendingDeleteInvoiceNum = '';

  const openDeleteInvoiceModal = (invoiceId, e) => {
    if (e) e.stopPropagation();
    const list = getSavedInvoices();
    const target = list.find(item => item.id === invoiceId || (item.metadata && item.metadata.number === invoiceId));
    const invNum = target && target.metadata ? target.metadata.number : 'Invoice';

    pendingDeleteInvoiceId = invoiceId;
    pendingDeleteInvoiceNum = invNum;

    if (el.deleteInvoiceNumberLabel) {
      el.deleteInvoiceNumberLabel.textContent = invNum;
    }

    if (el.modalDeleteInvoice) {
      el.modalDeleteInvoice.style.display = 'flex';
      if (el.btnCancelDeleteInvoice) {
        el.btnCancelDeleteInvoice.focus();
      }
    }
  };

  const closeDeleteInvoiceModal = () => {
    if (el.modalDeleteInvoice) {
      el.modalDeleteInvoice.style.display = 'none';
    }
    pendingDeleteInvoiceId = null;
    pendingDeleteInvoiceNum = '';
  };

  const executeDeleteInvoice = () => {
    if (!pendingDeleteInvoiceId) {
      closeDeleteInvoiceModal();
      return;
    }

    const invoiceId = pendingDeleteInvoiceId;
    const invNum = pendingDeleteInvoiceNum || 'Invoice';

    let list = getSavedInvoices();
    list = list.filter(item => item.id !== invoiceId && (!item.metadata || item.metadata.number !== invoiceId));
    localStorage.setItem(getInvoicesStorageKey(), JSON.stringify(list));
    updateHistoryBadge();
    renderHistoryList();
    showToast(`Deleted ${invNum}`);

    // Delete from Supabase cloud database
    if (window.BillCraftDB && window.BillCraftDB.deleteInvoice && currentUser) {
      window.BillCraftDB.deleteInvoice(invoiceId, currentUser.id).then(deleted => {
        if (deleted) console.info('[BillCraft] Invoice deleted from Supabase.');
      });
    }

    closeDeleteInvoiceModal();
  };

  const deleteInvoiceFromHistory = (invoiceId, e) => {
    openDeleteInvoiceModal(invoiceId, e);
  };

  const syncInvoicesFromSupabase = async (userId) => {
    if (!window.BillCraftDB || !window.BillCraftDB.fetchInvoices || !userId) return;
    try {
      const cloudInvoices = await window.BillCraftDB.fetchInvoices(userId);
      if (cloudInvoices && cloudInvoices.length > 0) {
        const localList = getSavedInvoices();
        const map = new Map();
        // Add cloud invoices first, keyed by normalized invoice number
        cloudInvoices.forEach(inv => {
          const key = (inv.metadata?.number || inv.id || '').trim().toLowerCase();
          if (key) map.set(key, inv);
        });
        // Merge local invoices if not already present
        localList.forEach(inv => {
          const key = (inv.metadata?.number || inv.id || '').trim().toLowerCase();
          if (key && !map.has(key)) {
            map.set(key, inv);
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => {
          return new Date(b.savedAt || b.metadata?.date || 0) - new Date(a.savedAt || a.metadata?.date || 0);
        });
        localStorage.setItem(getInvoicesStorageKey(), JSON.stringify(merged));
        updateHistoryBadge();
        renderHistoryList();
        console.info(`[BillCraft] Synced ${cloudInvoices.length} invoices from Supabase.`);
      }
    } catch (e) {
      console.warn('[BillCraft] Cloud sync error:', e);
    }
  };

  const renderHistoryList = (query = '') => {
    if (!el.historyListContainer) return;
    const list = getSavedInvoices();
    el.historyListContainer.innerHTML = '';

    const filter = query.trim().toLowerCase();
    const filtered = list.filter(item => {
      if (!filter) return true;
      const num = (item.metadata?.number || '').toLowerCase();
      const client = (item.client?.name || '').toLowerCase();
      return num.includes(filter) || client.includes(filter);
    });

    if (filtered.length === 0) {
      el.historyListContainer.innerHTML = `
        <div class="empty-history-state">
          <svg class="empty-history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <div style="font-weight: 600; margin-bottom: 4px;">No saved invoices found</div>
          <div style="font-size: 0.8125rem;">Click "Save" on any invoice to preserve it here.</div>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const cur = item.metadata?.currency || 'INR';
      const total = item.summary?.grandTotal || 0;
      const dateStr = formatDateDisplay(item.metadata?.date);
      const status = item.metadata?.status || 'draft';

      card.innerHTML = `
        <div class="history-card-header">
          <span class="history-inv-number">${escapeHtml(item.metadata?.number || 'Unnamed')}</span>
          <span class="status-pill ${status}" style="font-size:0.65rem; padding: 2px 6px;">
            ${status.toUpperCase()}
          </span>
        </div>
        <div class="history-client">${escapeHtml(item.client?.name || 'Untitled Client')}</div>
        <div class="history-footer">
          <span class="history-date">${dateStr}</span>
          <span class="history-total">${formatMoney(total, cur)}</span>
        </div>
        <div class="history-actions">
          <button class="btn btn-outline btn-sm btn-load" style="flex:1;">Load</button>
          ${item.pdfUrl ? `<a href="${item.pdfUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" title="View PDF stored in Supabase" style="display:inline-flex; align-items:center; gap:3px; text-decoration:none; padding: 4px 8px; font-size: 0.75rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>PDF</a>` : ''}
          <button class="btn btn-ghost btn-sm btn-danger-ghost btn-delete" title="Delete record">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-load').addEventListener('click', () => loadInvoiceFromHistory(item.id));
      card.querySelector('.btn-delete').addEventListener('click', (e) => deleteInvoiceFromHistory(item.id, e));

      // Clicking card loads invoice
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          loadInvoiceFromHistory(item.id);
        }
      });

      el.historyListContainer.appendChild(card);
    });
  };

  const openDrawer = () => {
    if (el.historySearchInput && el.historyListContainer) {
      renderHistoryList(el.historySearchInput.value);
    }
    if (el.drawerBackdrop) el.drawerBackdrop.classList.add('active');
    if (el.historyDrawer) el.historyDrawer.classList.add('open');
  };

  const closeDrawer = () => {
    if (el.drawerBackdrop) el.drawerBackdrop.classList.remove('active');
    if (el.historyDrawer) el.historyDrawer.classList.remove('open');
  };

  // ==========================================================================
  // PDF EXPORT & PRINT HANDLING
  // ==========================================================================
  const downloadPDF = async () => {
    if (typeof html2pdf === 'undefined') {
      showToast('PDF generator library not loaded', 'info');
      return;
    }

    const btn = el.btnDownloadPdf;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Exporting...`;
    btn.disabled = true;

    // Ensure state and preview are fully updated
    readFormToState();
    updateFinancialsAndPreview();

    // If on mobile and preview panel is hidden, temporarily position off-screen so canvas can render
    const isMobileHidden = el.previewPanel && el.previewPanel.classList.contains('mobile-hidden');
    let prevStyle = {};
    if (isMobileHidden) {
      prevStyle = {
        position: el.previewPanel.style.position,
        left: el.previewPanel.style.left,
        visibility: el.previewPanel.style.visibility,
        display: el.previewPanel.style.display
      };
      el.previewPanel.classList.remove('mobile-hidden');
      el.previewPanel.style.position = 'fixed';
      el.previewPanel.style.left = '-9999px';
      el.previewPanel.style.display = 'flex';
      el.previewPanel.style.visibility = 'visible';
    }

    try {
      // Brief tick for DOM geometry settlement
      await new Promise(r => setTimeout(r, 60));

      const invoiceElement = el.previewCard;
      const clientNameSafe = (currentInvoice.client?.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${currentInvoice.metadata.number || 'Invoice'}_${clientNameSafe}.pdf`;

      // Apply single-page optimization profile during PDF canvas snapshot
      invoiceElement.classList.add('pdf-export-single-page');

      const opt = {
        margin: [8, 8, 8, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: { mode: 'css' }
      };

      const pdfWorker = html2pdf().set(opt).from(invoiceElement);
      const pdfBlob = await pdfWorker.outputPdf('blob');
      await pdfWorker.save();
      showToast(`PDF exported: ${fileName}`);

      // Automatically backup the generated PDF to Supabase Storage 'invoice-pdfs'
      if (window.BillCraftDB && window.BillCraftDB.uploadInvoicePdf) {
        const activeUserId = currentUser ? currentUser.id : 'demo_user';
        window.BillCraftDB.uploadInvoicePdf(pdfBlob, fileName, activeUserId).then(cloudUrl => {
          if (cloudUrl) {
            currentInvoice.pdfUrl = cloudUrl;
            if (window.BillCraftDB.saveInvoice) {
              window.BillCraftDB.saveInvoice(currentInvoice, activeUserId, cloudUrl);
            }
            console.info('[BillCraft] Downloaded PDF uploaded to Supabase Storage:', cloudUrl);
            const currentList = getSavedInvoices();
            const idx = currentList.findIndex(i => i.id === currentInvoice.id || (i.metadata && i.metadata.number === currentInvoice.metadata?.number));
            if (idx >= 0) {
              currentList[idx].pdfUrl = cloudUrl;
              localStorage.setItem(getInvoicesStorageKey(), JSON.stringify(currentList));
              renderHistoryList();
            }
          }
        }).catch(err => console.warn('[BillCraft] PDF storage backup notice:', err));
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      showToast('Failed to export PDF', 'info');
    } finally {
      if (el.previewCard) {
        el.previewCard.classList.remove('pdf-export-single-page');
      }
      if (isMobileHidden) {
        el.previewPanel.style.position = prevStyle.position;
        el.previewPanel.style.left = prevStyle.left;
        el.previewPanel.style.visibility = prevStyle.visibility;
        el.previewPanel.style.display = prevStyle.display;
        el.previewPanel.classList.add('mobile-hidden');
      }
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  const printInvoice = () => {
    readFormToState();
    updateFinancialsAndPreview();
    window.print();
  };

  // ==========================================================================
  // USER DETAILS POPUP CONTROLS
  // ==========================================================================
  const updateUserDetailsPopup = () => {
    if (!currentUser) return;
    const initial = currentUser.initials || (currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U');
    if (el.dropdownAvatarCircle) {
      el.dropdownAvatarCircle.textContent = initial;
    }
    if (el.dropdownName) {
      el.dropdownName.textContent = currentUser.name || 'Valued Member';
    }
    if (el.dropdownEmail) {
      el.dropdownEmail.textContent = currentUser.email || '';
    }
    if (el.dropdownBusiness) {
      if (currentUser.businessName) {
        el.dropdownBusiness.textContent = currentUser.businessName;
        el.dropdownBusiness.style.display = 'inline-block';
      } else {
        el.dropdownBusiness.style.display = 'none';
      }
    }
    if (el.dropdownInvoicesCount) {
      const invoices = getSavedInvoices();
      el.dropdownInvoicesCount.textContent = invoices.length;
    }
    updateSupabaseAccountStatus();
  };

  const setSupabaseStatusUI = (isActive) => {
    if (!el.dropdownStatusText || !el.dropdownStatusDot || !el.dropdownUserStatus) return;
    if (isActive) {
      el.dropdownUserStatus.style.color = 'var(--success, #10B981)';
      el.dropdownStatusDot.style.background = 'var(--success, #10B981)';
      el.dropdownStatusText.textContent = 'Active';
      el.dropdownUserStatus.setAttribute('title', 'Supabase connection: Active');
    } else {
      el.dropdownUserStatus.style.color = 'var(--danger, #EF4444)';
      el.dropdownStatusDot.style.background = 'var(--danger, #EF4444)';
      el.dropdownStatusText.textContent = 'Inactive';
      el.dropdownUserStatus.setAttribute('title', 'Supabase connection: Inactive');
    }
  };

  let isSupabaseActive = true;
  let lastSupabaseCheckTime = 0;

  const updateSupabaseAccountStatus = async (force = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      isSupabaseActive = false;
      setSupabaseStatusUI(false);
      return false;
    }

    const now = Date.now();
    if (!force && (now - lastSupabaseCheckTime < 20000)) {
      setSupabaseStatusUI(isSupabaseActive);
      return isSupabaseActive;
    }

    try {
      if (window.BillCraftDB && typeof window.BillCraftDB.testConnection === 'function') {
        const res = await window.BillCraftDB.testConnection();
        isSupabaseActive = Boolean(res && res.connected);
      } else if (window.supabase || window.BillCraftDB?.getClient()) {
        isSupabaseActive = true;
      } else {
        isSupabaseActive = false;
      }
    } catch {
      isSupabaseActive = false;
    }

    lastSupabaseCheckTime = Date.now();
    setSupabaseStatusUI(isSupabaseActive);
    return isSupabaseActive;
  };

  const toggleUserDetailsPopup = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!el.userDropdownMenu) return;
    const isOpen = el.userDropdownMenu.classList.contains('show');
    if (isOpen) {
      closeUserDetailsPopup();
    } else {
      updateUserDetailsPopup();
      el.userDropdownMenu.classList.add('show');
      if (el.userAvatar) el.userAvatar.setAttribute('aria-expanded', 'true');
    }
  };

  const closeUserDetailsPopup = () => {
    if (el.userDropdownMenu) {
      el.userDropdownMenu.classList.remove('show');
    }
    if (el.userAvatar) {
      el.userAvatar.setAttribute('aria-expanded', 'false');
    }
  };

  // ==========================================================================
  // EVENT LISTENERS BINDING
  // ==========================================================================
  const attachEventListeners = () => {
    if (el.btnLoadSample) {
      el.btnLoadSample.addEventListener('click', () => {
        currentInvoice = createDefaultInvoice();
        populateFormFromState();
        showToast('Loaded sample studio invoice');
      });
    }

    el.btnNewInvoice.addEventListener('click', () => {
      if (confirm('Create a new blank invoice? Your current draft will be reset.')) {
        const today = new Date();
        const due = new Date();
        due.setDate(today.getDate() + 15);
        const randomId = Math.floor(1000 + Math.random() * 9000);

        currentInvoice = {
          id: 'inv_' + Date.now(),
          sender: {
            name: '',
            taxId: '',
            email: '',
            phone: '',
            address: '',
            logo: null
          },
          client: {
            name: '',
            email: '',
            phone: '',
            address: ''
          },
          metadata: {
            number: `INV-2026-${randomId}`,
            date: formatDateForInput(today),
            dueDate: formatDateForInput(due),
            poNumber: '',
            currency: 'INR',
            status: 'paid'
          },
          items: [
            {
              id: 1,
              description: '',
              quantity: 1,
              unitPrice: 0.00
            }
          ],
          calculations: {
            discountType: 'percentage',
            discountValue: 0,
            taxRate: 0,
            shipping: 0
          },
          notes: {
            paymentTerms: '',
            clientNotes: ''
          }
        };

        populateFormFromState();
        triggerInvoicePreviewRefresh();
        showToast('Created fresh invoice draft');
      }
    });

    el.btnSaveInvoice.addEventListener('click', saveInvoiceToHistory);
    el.btnPrintInvoice.addEventListener('click', printInvoice);
    el.btnDownloadPdf.addEventListener('click', downloadPDF);
    if (el.btnQuickDownload) el.btnQuickDownload.addEventListener('click', downloadPDF);

    // Refresh invoice number
    el.btnRefreshInvNum.addEventListener('click', () => {
      const svg = el.btnRefreshInvNum.querySelector('svg');
      if (svg) {
        svg.classList.remove('btn-spin-once');
        void svg.offsetWidth;
        svg.classList.add('btn-spin-once');
      }
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newNum = `INV-2026-${randomNum}`;
      el.invoiceNumber.value = newNum;
      currentInvoice.metadata.number = newNum;
      updateFinancialsAndPreview();
      saveCurrentDraftDebounced();
      showToast(`Generated #${newNum}`);
    });

    // History Drawer (if present in DOM)
    if (el.btnOpenHistory) el.btnOpenHistory.addEventListener('click', openDrawer);
    if (el.btnCloseDrawer) el.btnCloseDrawer.addEventListener('click', closeDrawer);
    if (el.drawerBackdrop) el.drawerBackdrop.addEventListener('click', closeDrawer);
    if (el.historySearchInput) {
      el.historySearchInput.addEventListener('input', (e) => {
        renderHistoryList(e.target.value);
      });
    }

    // Line items Add
    if (el.btnAddItem) el.btnAddItem.addEventListener('click', addNewItem);
    if (el.btnAddItemTop) el.btnAddItemTop.addEventListener('click', addNewItem);

    // Form Field Real-time Listeners
    const monitoredInputs = [
      el.senderName, el.senderTaxId, el.senderEmail, el.senderPhone, el.senderAddress,
      el.clientName, el.clientEmail, el.clientPhone, el.clientAddress,
      el.invoiceNumber, el.invoiceDate, el.invoiceDueDate, el.poNumber,
      el.paymentTerms, el.invoiceNotes, el.taxRateInput, el.discountInput, el.shippingInput
    ];

    monitoredInputs.filter(Boolean).forEach(input => {
      input.addEventListener('input', () => {
        readFormToState();
        updateFinancialsAndPreview();
      });
    });

    if (el.currencySelect) {
      el.currencySelect.addEventListener('change', () => {
        readFormToState();
        renderFormLineItems(); // re-render table with proper currency format
        updateFinancialsAndPreview();
      });
    }

    el.invoiceStatus.addEventListener('change', () => {
      readFormToState();
      updateFinancialsAndPreview();
    });

    // Discount Type toggle
    el.btnDiscountPercent.addEventListener('click', () => {
      setDiscountTypeUI('percentage');
      readFormToState();
      updateFinancialsAndPreview();
    });

    el.btnDiscountFixed.addEventListener('click', () => {
      setDiscountTypeUI('fixed');
      readFormToState();
      updateFinancialsAndPreview();
    });

    // Logo Upload Listeners
    el.logoDropzone.addEventListener('click', () => {
      el.logoFileInput.click();
    });

    el.logoFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleLogoFile(file);
    });

    el.btnRemoveLogo.addEventListener('click', (e) => {
      e.stopPropagation();
      updateLogoDisplay(null);
      saveCurrentDraftDebounced();
      showToast('Logo removed');
    });

    // Drag and Drop Logo
    el.logoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.logoDropzone.classList.add('dragover');
    });
    el.logoDropzone.addEventListener('dragleave', () => {
      el.logoDropzone.classList.remove('dragover');
    });
    el.logoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.logoDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleLogoFile(e.dataTransfer.files[0]);
      }
    });

    // Zoom Controls
    if (el.btnZoom100) {
      el.btnZoom100.addEventListener('click', () => {
        el.previewPaperWrapper.style.transform = 'scale(1)';
      });
    }

    // Mobile View Tabs Toggle
    if (el.tabEditorBtn && el.tabPreviewBtn) {
      el.tabEditorBtn.addEventListener('click', () => {
        el.tabEditorBtn.classList.add('active');
        el.tabPreviewBtn.classList.remove('active');
        el.editorPanel.classList.remove('mobile-hidden');
        el.previewPanel.classList.add('mobile-hidden');
        triggerPanelAnimation(el.editorPanel);
      });

      el.tabPreviewBtn.addEventListener('click', () => {
        el.tabPreviewBtn.classList.add('active');
        el.tabEditorBtn.classList.remove('active');
        el.previewPanel.classList.remove('mobile-hidden');
        el.editorPanel.classList.add('mobile-hidden');
        readFormToState();
        updateFinancialsAndPreview();
        triggerInvoicePreviewRefresh();
        triggerPanelAnimation(el.previewPanel);
      });
    }

    // Window Resize Handler for multi-device adaptiveness
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        // On desktop, both panels are visible
        el.editorPanel.classList.remove('mobile-hidden');
        el.previewPanel.classList.remove('mobile-hidden');
      } else {
        // On tablet/mobile, ensure the active tab reflects panel visibility
        if (el.tabPreviewBtn && el.tabPreviewBtn.classList.contains('active')) {
          el.editorPanel.classList.add('mobile-hidden');
          el.previewPanel.classList.remove('mobile-hidden');
        } else {
          el.editorPanel.classList.remove('mobile-hidden');
          el.previewPanel.classList.add('mobile-hidden');
        }
      }
    });

    // ========================================================================
    // AUTHENTICATION LISTENERS & USER POPUP
    // ========================================================================
    if (el.userAvatar) {
      el.userAvatar.addEventListener('click', toggleUserDetailsPopup);
      el.userAvatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleUserDetailsPopup(e);
        }
      });
    }

    if (el.userDropdownMenu) {
      el.userDropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const performSignOut = async (triggerBtn) => {
      try {
        if (triggerBtn) {
          triggerBtn.disabled = true;
          triggerBtn.style.opacity = '0.7';
          triggerBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            <span>Signing Out...</span>
          `;
        }
      } catch {}

      if (window.BillCraftAuth) {
        try {
          await window.BillCraftAuth.signOut();
        } catch (err) {
          console.warn('Sign out error:', err);
        }
      }
      smoothNavigate('login.html?logout=true', true);
    };

    // ========================================================================
    // DELETE ACCOUNT MODAL CONTROLS
    // ========================================================================
    const openDeleteAccountModal = () => {
      closeUserDetailsPopup();
      if (el.modalDeleteAccount) {
        el.modalDeleteAccount.style.display = 'flex';
        if (el.btnCancelDeleteAccount) {
          el.btnCancelDeleteAccount.focus();
        }
      }
    };

    const closeDeleteAccountModal = () => {
      if (el.modalDeleteAccount) {
        el.modalDeleteAccount.style.display = 'none';
      }
      if (el.btnConfirmDeleteAccount) {
        el.btnConfirmDeleteAccount.disabled = false;
        el.btnConfirmDeleteAccount.style.opacity = '1';
        el.btnConfirmDeleteAccount.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span id="btn-confirm-delete-text">Delete Account</span>
        `;
      }
      if (el.btnCancelDeleteAccount) {
        el.btnCancelDeleteAccount.disabled = false;
      }
    };

    const executeDeleteAccount = async () => {
      const user = currentUser;
      if (!user) {
        closeDeleteAccountModal();
        return;
      }

      if (el.btnConfirmDeleteAccount) {
        el.btnConfirmDeleteAccount.disabled = true;
        el.btnConfirmDeleteAccount.style.opacity = '0.7';
        el.btnConfirmDeleteAccount.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
          <span>Deleting...</span>
        `;
      }
      if (el.btnCancelDeleteAccount) {
        el.btnCancelDeleteAccount.disabled = true;
      }

      showToast('Deleting account and all invoices from Supabase...', 'info');

      try {
        if (window.BillCraftAuth && typeof window.BillCraftAuth.deleteAccount === 'function') {
          await window.BillCraftAuth.deleteAccount(user);
        } else if (window.BillCraftDB && typeof window.BillCraftDB.deleteUserData === 'function') {
          await window.BillCraftDB.deleteUserData(user.id, user.email);
          if (window.BillCraftAuth) await window.BillCraftAuth.signOut();
        }

        // Clean user's invoices & draft keys in localStorage
        try {
          if (user.id) {
            localStorage.removeItem(`billcraft_invoices_${user.id}`);
            localStorage.removeItem(`billcraft_draft_${user.id}`);
          }
          if (user.email) {
            localStorage.removeItem(`billcraft_invoices_${user.email}`);
            localStorage.removeItem(`billcraft_draft_${user.email}`);
          }
        } catch {}

        closeDeleteAccountModal();
        showToast('Account and all data successfully deleted.');
      } catch (err) {
        console.warn('Account deletion exception:', err);
        closeDeleteAccountModal();
      }

      setTimeout(() => {
        smoothNavigate('login.html?deleted=true', true);
      }, 700);
    };

    if (el.dropdownBtnSignout) {
      el.dropdownBtnSignout.addEventListener('click', (e) => {
        e.preventDefault();
        closeUserDetailsPopup();
        performSignOut(el.dropdownBtnSignout);
      });
    }

    if (el.dropdownBtnDelete) {
      el.dropdownBtnDelete.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDeleteAccountModal();
      });
    }

    if (el.btnCancelDeleteAccount) {
      el.btnCancelDeleteAccount.addEventListener('click', (e) => {
        e.preventDefault();
        closeDeleteAccountModal();
      });
    }

    if (el.btnCloseDeleteModal) {
      el.btnCloseDeleteModal.addEventListener('click', (e) => {
        e.preventDefault();
        closeDeleteAccountModal();
      });
    }

    if (el.btnConfirmDeleteAccount) {
      el.btnConfirmDeleteAccount.addEventListener('click', (e) => {
        e.preventDefault();
        executeDeleteAccount();
      });
    }

    if (el.modalDeleteAccount) {
      el.modalDeleteAccount.addEventListener('click', (e) => {
        if (e.target === el.modalDeleteAccount) {
          closeDeleteAccountModal();
        }
      });
    }

    // Delete Invoice Modal Listeners
    if (el.btnCloseDeleteInvoiceModal) {
      el.btnCloseDeleteInvoiceModal.addEventListener('click', (e) => {
        e.preventDefault();
        closeDeleteInvoiceModal();
      });
    }

    if (el.btnCancelDeleteInvoice) {
      el.btnCancelDeleteInvoice.addEventListener('click', (e) => {
        e.preventDefault();
        closeDeleteInvoiceModal();
      });
    }

    if (el.btnConfirmDeleteInvoice) {
      el.btnConfirmDeleteInvoice.addEventListener('click', (e) => {
        e.preventDefault();
        executeDeleteInvoice();
      });
    }

    if (el.modalDeleteInvoice) {
      el.modalDeleteInvoice.addEventListener('click', (e) => {
        if (e.target === el.modalDeleteInvoice) {
          closeDeleteInvoiceModal();
        }
      });
    }

    if (el.btnSignOut) {
      el.btnSignOut.addEventListener('click', (e) => {
        e.preventDefault();
        closeUserDetailsPopup();
        performSignOut(el.btnSignOut);
      });
    }

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (el.userDropdownMenu && el.userDropdownMenu.classList.contains('show')) {
        if (!el.userAvatar.contains(e.target) && !el.userDropdownMenu.contains(e.target)) {
          closeUserDetailsPopup();
        }
      }
    });

    // Close popups, modals, and drawers on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.modalDeleteInvoice && el.modalDeleteInvoice.style.display === 'flex') {
          closeDeleteInvoiceModal();
        }
        if (el.modalDeleteAccount && el.modalDeleteAccount.style.display === 'flex') {
          closeDeleteAccountModal();
        }
        if (el.userDropdownMenu && el.userDropdownMenu.classList.contains('show')) {
          closeUserDetailsPopup();
        }
        if (el.historyDrawer && el.historyDrawer.classList.contains('open')) {
          closeDrawer();
        }
      }
    });

    // Supabase connectivity tracking for user status indicator
    window.addEventListener('online', () => updateSupabaseAccountStatus(true));
    window.addEventListener('offline', () => updateSupabaseAccountStatus(true));
  };

  const handleAuthChange = (user) => {
    currentUser = user;

    if (user) {
      // User is signed in — show user menu
      if (el.userMenu) el.userMenu.style.display = 'flex';
      if (el.userAvatar) {
        el.userAvatar.textContent = user.initials || user.name.slice(0, 2).toUpperCase();
        el.userAvatar.title = `${user.name} (Click to view account details)`;
      }
      updateUserDetailsPopup();

      // Load this user's current draft from localStorage or create user default
      let userDraft = null;
      try {
        const raw = localStorage.getItem(getDraftStorageKey());
        if (raw) userDraft = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse user draft:', e);
      }

      if (userDraft && userDraft.sender && userDraft.items) {
        if (userDraft.sender.logo === DEMO_LOGO_SVG) {
          userDraft.sender.logo = null;
        }
        currentInvoice = userDraft;
      } else {
        currentInvoice = createDefaultInvoice(user);
      }

      populateFormFromState();
      updateHistoryBadge();
      renderHistoryList();

      // Trigger cloud sync to pull user's cloud invoices from Supabase
      syncInvoicesFromSupabase(user.id);

      showToast(`Welcome, ${user.name}!`);
    } else {
      // User is signed out — hide user menu and reset avatar
      closeUserDetailsPopup();
      if (el.userMenu) el.userMenu.style.display = 'none';
      if (el.userAvatar) el.userAvatar.textContent = '';

      // Check if URL has incoming tokens from Supabase email confirmation
      const hasAuthParams = (window.location.hash || '').includes('access_token') ||
                            (window.location.hash || '').includes('type=signup') ||
                            (window.location.search || '').includes('code=') ||
                            (window.location.search || '').includes('token_hash=');

      const checkAndRedirect = () => {
        if (window.BillCraftAuth && typeof window.BillCraftAuth.whenReady === 'function') {
          window.BillCraftAuth.whenReady().then(() => {
            if (!window.BillCraftAuth.isSignedIn()) {
              smoothNavigate('login.html', true);
            }
          });
        } else {
          smoothNavigate('login.html', true);
        }
      };

      if (hasAuthParams) {
        // Allow Supabase SDK a brief moment to process the incoming confirmation code/token
        setTimeout(checkAndRedirect, 1500);
      } else {
        checkAndRedirect();
      }
    }
  };

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  const initApp = () => {
    // 1. Attach DOM listeners
    attachEventListeners();

    // 2. Ensure history drawer is closed by default
    closeDrawer();
    window.closeInvoiceHistory = closeDrawer;

    // 3. Subscribe to auth state changes
    if (window.BillCraftAuth) {
      window.BillCraftAuth.onAuthStateChanged(handleAuthChange);
    } else {
      currentInvoice = createDefaultInvoice(null);
      populateFormFromState();
      updateHistoryBadge();
    }

    // 4. Initial check of Supabase connection status
    updateSupabaseAccountStatus();

    console.log('BillCraft Studio initialized successfully.');
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
