(function (root) {
  const STYLES = [
    {
      id: "academic",
      name: "Academic",
      icon: "📑",
      description: "Essays and research papers — serif, clear hierarchy",
    },
    {
      id: "business",
      name: "Business",
      icon: "💼",
      description: "Memos and reports — clean sans-serif",
    },
    {
      id: "proposal",
      name: "Proposal",
      icon: "📋",
      description: "Structured proposals with numbered sections",
    },
    {
      id: "letter",
      name: "Letter",
      icon: "✉️",
      description: "Formal correspondence",
    },
  ];

  const STARTERS = {
    academic: `<h1>Title</h1>
<p><em>Author · Institution · Date</em></p>
<h2>Abstract</h2>
<p>Summarize the question, method, and main finding in a few sentences.</p>
<h2>1. Introduction</h2>
<p>State the topic, why it matters, and what this paper argues.</p>
<h2>2. Discussion</h2>
<p>Develop your argument with evidence and analysis.</p>
<h2>3. Conclusion</h2>
<p>Restate the claim and note implications or further questions.</p>
<p><br></p>`,
    business: `<h1>Report title</h1>
<p><strong>To:</strong> &nbsp;&nbsp;&nbsp;&nbsp; <strong>From:</strong> &nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong></p>
<h2>Executive summary</h2>
<p>One short paragraph with the recommendation and key numbers.</p>
<h2>Background</h2>
<p>Context the reader needs before the details.</p>
<h2>Findings</h2>
<ul><li>Finding one</li><li>Finding two</li><li>Finding three</li></ul>
<h2>Recommendations</h2>
<ol><li>Next step</li><li>Owner and timeline</li></ol>
<p><br></p>`,
    proposal: `<h1>Proposal title</h1>
<p><em>Prepared for · Prepared by · Date</em></p>
<h2>1. Opportunity</h2>
<p>What problem or goal this proposal addresses.</p>
<h2>2. Approach</h2>
<p>How you will deliver the outcome.</p>
<h2>3. Scope</h2>
<ul><li>In scope</li><li>Out of scope</li></ul>
<h2>4. Timeline &amp; investment</h2>
<p>Phases, milestones, and rough cost.</p>
<h2>5. Next steps</h2>
<p>What you need from the reader to proceed.</p>
<p><br></p>`,
    letter: `<p>Your name<br>Address line<br>City, Country</p>
<p>Date</p>
<p>Recipient name<br>Organization<br>Address</p>
<p>Dear Recipient,</p>
<p>Opening paragraph — purpose of the letter.</p>
<p>Body paragraph — details, request, or information.</p>
<p>Closing paragraph — thanks and call to action.</p>
<p>Sincerely,</p>
<p><br></p>
<p>Your name<br>Title</p>`,
  };

  function getStyle(id) {
    return STYLES.find((s) => s.id === id) || STYLES[0];
  }

  function starterHtml(styleId) {
    const id = getStyle(styleId).id;
    return STARTERS[id] || STARTERS.academic;
  }

  function isFormalEnabled() {
    if (!window.AppSettingsRuntime?.isReady?.()) return true;
    return window.AppSettingsRuntime.isOn("formalStudio");
  }

  root.StudiesFormal = {
    STYLES,
    getStyle,
    starterHtml,
    isFormalEnabled,
  };
})(window);
