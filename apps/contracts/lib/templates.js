/** Contract templates — placeholders use {{field_key}} */
const CONTRACT_TEMPLATES = [
  {
    id: "nda",
    title: "Non-Disclosure Agreement",
    category: "Confidentiality",
    defaultExpiryMonths: 24,
    fields: [
      { key: "effective_date", label: "Effective Date", type: "date", required: true },
      { key: "expiry_date", label: "Expiry Date", type: "date", required: true },
      { key: "party_a_name", label: "Disclosing Party (full legal name)", type: "text", required: true, party: "A" },
      { key: "party_a_address", label: "Disclosing Party address", type: "text", party: "A" },
      { key: "party_b_name", label: "Receiving Party (full legal name)", type: "text", required: true, party: "B" },
      { key: "party_b_address", label: "Receiving Party address", type: "text", party: "B" },
      { key: "purpose", label: "Purpose of disclosure", type: "textarea", required: true },
      { key: "governing_law", label: "Governing law (state/country)", type: "text", default: "the State of Israel" },
    ],
    clauses: [
      {
        n: "1",
        title: "DEFINITIONS",
        body: 'For purposes of this Non-Disclosure Agreement ("Agreement"), "Confidential Information" means all non-public information disclosed by {{party_a_name}} ("Disclosing Party") to {{party_b_name}} ("Receiving Party") relating to: {{purpose}}.',
      },
      {
        n: "2",
        title: "OBLIGATIONS",
        body: "The Receiving Party shall hold Confidential Information in strict confidence, use it solely for the stated purpose, and not disclose it to third parties without prior written consent of the Disclosing Party.",
      },
      {
        n: "3",
        title: "TERM",
        body: "This Agreement is effective as of {{effective_date}} and expires on {{expiry_date}}, unless terminated earlier in writing by either party.",
      },
      {
        n: "4",
        title: "GOVERNING LAW",
        body: "This Agreement shall be governed by the laws of {{governing_law}}.",
      },
    ],
    signatures: [
      { id: "party_a", label: "Disclosing Party", nameField: "party_a_name" },
      { id: "party_b", label: "Receiving Party", nameField: "party_b_name" },
    ],
  },
  {
    id: "service",
    title: "Service Agreement",
    category: "Commercial",
    defaultExpiryMonths: 12,
    fields: [
      { key: "effective_date", label: "Effective Date", type: "date", required: true },
      { key: "expiry_date", label: "Expiry Date", type: "date", required: true },
      { key: "provider_name", label: "Service Provider", type: "text", required: true, party: "A" },
      { key: "client_name", label: "Client", type: "text", required: true, party: "B" },
      { key: "service_description", label: "Description of services", type: "textarea", required: true },
      { key: "fee", label: "Fee / compensation", type: "text", required: true },
      { key: "payment_terms", label: "Payment terms", type: "text", default: "Net 30 days from invoice date" },
      { key: "governing_law", label: "Governing law", type: "text", default: "the State of Israel" },
    ],
    clauses: [
      {
        n: "1",
        title: "SERVICES",
        body: "{{provider_name}} agrees to perform the following services for {{client_name}}: {{service_description}}.",
      },
      {
        n: "2",
        title: "COMPENSATION",
        body: "In consideration for the Services, the Client shall pay {{fee}}, subject to {{payment_terms}}.",
      },
      {
        n: "3",
        title: "TERM",
        body: "This Agreement commences on {{effective_date}} and continues until {{expiry_date}} unless extended by written amendment signed by both parties.",
      },
      {
        n: "4",
        title: "GOVERNING LAW",
        body: "This Agreement is governed by the laws of {{governing_law}}.",
      },
    ],
    signatures: [
      { id: "provider", label: "Service Provider", nameField: "provider_name" },
      { id: "client", label: "Client", nameField: "client_name" },
    ],
  },
  {
    id: "rental",
    title: "Residential Lease Agreement",
    category: "Property",
    defaultExpiryMonths: 12,
    fields: [
      { key: "effective_date", label: "Lease start date", type: "date", required: true },
      { key: "expiry_date", label: "Lease end date", type: "date", required: true },
      { key: "landlord_name", label: "Landlord", type: "text", required: true, party: "A" },
      { key: "tenant_name", label: "Tenant", type: "text", required: true, party: "B" },
      { key: "property_address", label: "Property address", type: "text", required: true },
      { key: "monthly_rent", label: "Monthly rent", type: "text", required: true },
      { key: "security_deposit", label: "Security deposit", type: "text" },
      { key: "governing_law", label: "Governing law", type: "text", default: "the State of Israel" },
    ],
    clauses: [
      {
        n: "1",
        title: "PREMISES",
        body: '{{landlord_name}} ("Landlord") leases to {{tenant_name}} ("Tenant") the residential premises located at {{property_address}}.',
      },
      {
        n: "2",
        title: "RENT",
        body: "Tenant shall pay monthly rent of {{monthly_rent}}. Security deposit: {{security_deposit}}.",
      },
      {
        n: "3",
        title: "TERM",
        body: "The lease term begins {{effective_date}} and ends {{expiry_date}}.",
      },
      {
        n: "4",
        title: "GOVERNING LAW",
        body: "This Lease is governed by the laws of {{governing_law}}.",
      },
    ],
    signatures: [
      { id: "landlord", label: "Landlord", nameField: "landlord_name" },
      { id: "tenant", label: "Tenant", nameField: "tenant_name" },
    ],
  },
  {
    id: "employment",
    title: "Employment Agreement",
    category: "Employment",
    defaultExpiryMonths: 0,
    fields: [
      { key: "effective_date", label: "Start date", type: "date", required: true },
      { key: "expiry_date", label: "End date (if fixed-term)", type: "date" },
      { key: "employer_name", label: "Employer", type: "text", required: true, party: "A" },
      { key: "employee_name", label: "Employee", type: "text", required: true, party: "B" },
      { key: "job_title", label: "Job title", type: "text", required: true },
      { key: "salary", label: "Salary / compensation", type: "text", required: true },
      { key: "work_location", label: "Place of work", type: "text" },
      { key: "governing_law", label: "Governing law", type: "text", default: "the State of Israel" },
    ],
    clauses: [
      {
        n: "1",
        title: "EMPLOYMENT",
        body: "{{employer_name}} employs {{employee_name}} as {{job_title}}, commencing {{effective_date}}.",
      },
      {
        n: "2",
        title: "COMPENSATION",
        body: "Employee shall receive {{salary}} in accordance with applicable law and company policy.",
      },
      {
        n: "3",
        title: "PLACE OF WORK",
        body: "Primary place of work: {{work_location}}.",
      },
      {
        n: "4",
        title: "TERM",
        body: "Where a fixed term applies, employment continues until {{expiry_date}}. Otherwise, employment continues until terminated in accordance with applicable law.",
      },
      {
        n: "5",
        title: "GOVERNING LAW",
        body: "This Agreement is governed by the laws of {{governing_law}}.",
      },
    ],
    signatures: [
      { id: "employer", label: "Employer", nameField: "employer_name" },
      { id: "employee", label: "Employee", nameField: "employee_name" },
    ],
  },
  {
    id: "general_record",
    title: "General Record & Statement",
    category: "Documentation",
    documentKind: "record",
    defaultExpiryMonths: 0,
    fields: [
      { key: "effective_date", label: "Document date", type: "date", required: true },
      { key: "expiry_date", label: "Review / reminder date (optional)", type: "date" },
      { key: "event_date", label: "Date of event (if different)", type: "date" },
      { key: "location", label: "Location", type: "text" },
      { key: "subject", label: "Subject — what this record is about", type: "text", required: true },
      { key: "parties_involved", label: "People / parties involved", type: "textarea", rows: 3 },
      { key: "what_happened", label: "What actually happened", type: "textarea", required: true, rows: 10 },
      { key: "background", label: "Background & context", type: "textarea", rows: 6 },
      { key: "outcome", label: "Outcome, agreements, or follow-up", type: "textarea", rows: 5 },
      { key: "other_notes", label: "Other notes (anything else to document)", type: "textarea", rows: 5 },
      { key: "declarant_name", label: "Declarant — person making this statement", type: "text", required: true, party: "A" },
      { key: "witness_name", label: "Witness (optional)", type: "text", party: "B" },
      { key: "witness2_name", label: "Second witness (optional)", type: "text", party: "C" },
    ],
    clauses: [
      {
        n: "I",
        title: "PURPOSE",
        body: "This formal record documents the following matter: {{subject}}. Prepared on {{effective_date}}.",
      },
      {
        n: "II",
        title: "CIRCUMSTANCES",
        body: "Date of event: {{event_date}}. Location: {{location}}. Parties involved:\n\n{{parties_involved}}",
      },
      {
        n: "III",
        title: "STATEMENT OF FACTS — WHAT ACTUALLY HAPPENED",
        body: "{{what_happened}}",
        freeform: true,
      },
      {
        n: "IV",
        title: "BACKGROUND & CONTEXT",
        body: "{{background}}",
        freeform: true,
        optional: true,
      },
      {
        n: "V",
        title: "OUTCOME & FOLLOW-UP",
        body: "{{outcome}}",
        freeform: true,
        optional: true,
      },
      {
        n: "VI",
        title: "ADDITIONAL NOTES",
        body: "{{other_notes}}",
        freeform: true,
        optional: true,
      },
      {
        n: "VII",
        title: "DECLARATION",
        body: "The undersigned declare that the foregoing is a true and accurate record to the best of their knowledge, made without intent to mislead.",
      },
    ],
    signatures: [
      { id: "declarant", label: "Declarant", nameField: "declarant_name" },
      { id: "witness", label: "Witness", nameField: "witness_name", optional: true },
      { id: "witness2", label: "Second witness", nameField: "witness2_name", optional: true },
    ],
  },
  {
    id: "open_memo",
    title: "Open Memorandum",
    category: "Documentation",
    documentKind: "record",
    defaultExpiryMonths: 0,
    fields: [
      { key: "effective_date", label: "Document date", type: "date", required: true },
      { key: "expiry_date", label: "Review / reminder date (optional)", type: "date" },
      { key: "subject", label: "Title / subject line", type: "text", required: true },
      { key: "free_body", label: "Full text — write anything you need to document", type: "textarea", required: true, rows: 14 },
      { key: "signer_name", label: "Signer — full legal name", type: "text", required: true, party: "A" },
      { key: "witness_name", label: "Witness (optional)", type: "text", party: "B" },
    ],
    clauses: [
      {
        n: "",
        title: "MEMORANDUM",
        body: "{{free_body}}",
        freeform: true,
      },
    ],
    signatures: [
      { id: "signer", label: "Signer", nameField: "signer_name" },
      { id: "witness", label: "Witness", nameField: "witness_name", optional: true },
    ],
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONTRACT_TEMPLATES };
}

if (typeof window !== "undefined") {
  window.ContractTemplates = { CONTRACT_TEMPLATES };
}
