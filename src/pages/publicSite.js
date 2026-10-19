const CONTACT = 'amithsulakhe123@gmail.com';
const UPDATED = '19 October 2026';
const APP_URL = 'https://linkdein-automation-frontend.vercel.app';

function layout({ title, heading, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1c2430; background: #f4f6f8; line-height: 1.6; }
    a { color: #0a66c2; }
    header, footer { background: #fff; border-bottom: 1px solid #e4e8ee; }
    footer { border-bottom: 0; border-top: 1px solid #e4e8ee; }
    .bar, main, footer .bar { max-width: 760px; margin: 0 auto; padding: 16px 20px; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { font-weight: 700; color: #1c2430; text-decoration: none; }
    nav { display: flex; gap: 16px; font-size: 14px; }
    main { background: #fff; margin-top: 24px; margin-bottom: 24px; border: 1px solid #e4e8ee; border-radius: 12px; padding: 28px 24px 36px; }
    h1 { font-size: 32px; line-height: 1.2; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 28px 0 8px; }
    p, li { font-size: 15px; }
    .muted { color: #5c6775; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    .btn { display: inline-block; background: #0a66c2; color: #fff; text-decoration: none; border-radius: 999px; padding: 10px 16px; font-weight: 600; }
    .btn.secondary { background: #fff; color: #0a66c2; border: 1px solid #0a66c2; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <a class="brand" href="/">LinkedIn AI Agent</a>
      <nav>
        <a href="/">Home</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </div>
  </header>
  <main>
    <h1>${heading}</h1>
    ${body}
  </main>
  <footer>
    <div class="bar">
      <span class="muted">LinkedIn AI Agent</span>
      <nav>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="mailto:${CONTACT}">${CONTACT}</a>
      </nav>
    </div>
  </footer>
</body>
</html>`;
}

export function sendHome(_req, res) {
  res.type('html').send(
    layout({
      title: 'LinkedIn AI Agent',
      heading: 'LinkedIn AI Agent',
      body: `
        <p class="muted">Draft LinkedIn posts with AI, then publish only after you approve them.</p>
        <p>LinkedIn AI Agent is an independent content studio. You connect your own LinkedIn account and, if you want email approvals, your own Gmail account. The app drafts posts from your instructions and the documents you upload. Nothing is published to LinkedIn until you approve it.</p>
        <h2>What you can do</h2>
        <ul>
          <li>Write and schedule LinkedIn posts, with optional images.</li>
          <li>Let the app draft posts on a schedule you choose.</li>
          <li>Approve or reject a draft from the app or from an email sent through your Gmail account.</li>
          <li>Ask a chatbot questions about documents you upload.</li>
        </ul>
        <h2>Google account access</h2>
        <p>If you connect Gmail, the app asks for permission to see your Google account email address and to send email as you. It uses that only to send approval requests and publish notifications you turned on. It does not read your inbox. Details are in the <a href="/privacy">Privacy Policy</a>.</p>
        <div class="actions">
          <a class="btn" href="${APP_URL}/login">Open the app</a>
          <a class="btn secondary" href="/privacy">Privacy Policy</a>
          <a class="btn secondary" href="/terms">Terms of Service</a>
        </div>
      `,
    })
  );
}

export function sendPrivacy(_req, res) {
  res.type('html').send(
    layout({
      title: 'Privacy Policy · LinkedIn AI Agent',
      heading: 'Privacy Policy',
      body: `
        <p class="muted">Last updated ${UPDATED}</p>
        <p>This policy explains how LinkedIn AI Agent ("the app") handles information when you use the service at <a href="${APP_URL}">${APP_URL}</a>. The app is not affiliated with LinkedIn or Google. Questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
        <h2>Information you give us</h2>
        <ul>
          <li>Account details: display name, email address, and a password stored as a hash.</li>
          <li>Content you create: post text, images, schedule, approval decisions, and chatbot messages.</li>
          <li>Documents you upload for the knowledge base, and text extracted from those documents so the app can draft posts and answer questions.</li>
          <li>Settings, including notification preferences and the times you want drafts created.</li>
        </ul>
        <h2>Google user data</h2>
        <p>Connecting Gmail is optional. If you connect it, the app requests these permissions:</p>
        <ul>
          <li><strong>Send email</strong> (<code>https://www.googleapis.com/auth/gmail.send</code>). Used only to send messages you asked the app to send, such as a draft-approval email and a notice after a post is published. The app does not read, search, delete, or change mail in your mailbox.</li>
          <li><strong>Email address and OpenID</strong> (<code>userinfo.email</code> and <code>openid</code>). Used to identify which Google account you connected and to show that address in Settings.</li>
        </ul>
        <p>The app stores the Google access token and refresh token in encrypted form, together with the connected email address, granted permissions, and token expiry. It uses those tokens only to send the emails described above.</p>
        <p>LinkedIn AI Agent's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        <p>Google user data is not sold. It is not used for advertising, credit, or lending decisions. It is not used to train general-purpose AI models. It is not sent to OpenAI or other AI providers. People do not read your Google data unless you ask for support about a specific problem, or we must do so to secure the service, comply with law, or investigate abuse.</p>
        <h2>LinkedIn data</h2>
        <p>If you connect LinkedIn, the app stores an encrypted access token and the account identifier LinkedIn provides. It uses that connection to publish a post only after you approve it, and to read analytics for posts the app published.</p>
        <h2>How other information is used</h2>
        <ul>
          <li>To run your account, show your posts, and send the notifications you enabled.</li>
          <li>To draft post text and answer chatbot questions. The text of your posts and uploaded documents may be sent to OpenAI for that purpose. Google user data is not included in those requests.</li>
          <li>To keep the service reliable and to investigate misuse.</li>
        </ul>
        <h2>Sharing</h2>
        <p>We share information with service providers only as needed to run the app: hosting, the database, email delivery through the Gmail API, LinkedIn when you approve a post, and OpenAI for drafting and chat. We do not sell personal information. We may disclose information if the law requires it.</p>
        <h2>Retention and deletion</h2>
        <p>Account data and content stay until you delete them or delete the account. In Settings, "Start fresh" deletes posts, approvals, analytics, documents, chat history, and scheduled jobs, and removes stored LinkedIn and Gmail tokens. You can also revoke the app's Google access at any time from <a href="https://myaccount.google.com/permissions">your Google Account permissions</a>. Revoking access stops the app from sending further email.</p>
        <h2>Security</h2>
        <p>Passwords are hashed. OAuth tokens are encrypted before they are stored. No method of storage or transmission is perfectly secure.</p>
        <h2>Contact</h2>
        <p>Email <a href="mailto:${CONTACT}">${CONTACT}</a> to ask about this policy or to request deletion of your account data.</p>
      `,
    })
  );
}

export function sendTerms(_req, res) {
  res.type('html').send(
    layout({
      title: 'Terms of Service · LinkedIn AI Agent',
      heading: 'Terms of Service',
      body: `
        <p class="muted">Last updated ${UPDATED}</p>
        <p>These terms cover your use of LinkedIn AI Agent. By creating an account or connecting LinkedIn or Gmail, you agree to them. The app is an independent service and is not affiliated with LinkedIn or Google.</p>
        <h2>The service</h2>
        <p>The app helps you draft, review, approve, and publish content to LinkedIn, and can email you about those drafts through Gmail if you connect it. Features can change. The service is provided as available, and a draft or scheduled post can fail if LinkedIn, Gmail, or the network is unavailable.</p>
        <h2>Your account</h2>
        <p>You must provide a working email address and keep your password private. You are responsible for activity under your account. You must own or have permission to use the LinkedIn and Google accounts you connect.</p>
        <h2>Approval and publishing</h2>
        <p>The app does not publish a post to LinkedIn until you approve it in the app or through the approval link sent to you. You are responsible for reviewing drafts before you approve them, including text produced by AI. You must follow LinkedIn's terms and professional community policies.</p>
        <h2>Acceptable use</h2>
        <p>Do not use the app to break the law, send spam, impersonate someone else, upload files you do not have the right to use, or attempt to access another person's account or the service's systems without permission.</p>
        <h2>Google and LinkedIn</h2>
        <p>Connecting Gmail lets the app send email as you for approval and notification messages you enabled. You can revoke that access from your Google Account. Connecting LinkedIn lets the app publish approved posts and read analytics for those posts. Your use of those services is also covered by their own terms. See the <a href="/privacy">Privacy Policy</a> for how that data is handled.</p>
        <h2>Your content</h2>
        <p>You keep your rights to the posts and documents you submit. You give the app permission to host, process, and, after you approve, publish that content so the service can operate. AI output can be inaccurate. Check it before you publish.</p>
        <h2>Ending use</h2>
        <p>You may stop using the app at any time and may ask us to delete your account data at <a href="mailto:${CONTACT}">${CONTACT}</a>. We may suspend access if these terms are broken or if continued access would put the service or other people at risk.</p>
        <h2>Liability</h2>
        <p>The service is provided "as is." To the extent the law allows, we are not liable for lost posts, lost profits, or indirect damages arising from your use of the app.</p>
        <h2>Contact</h2>
        <p>Email <a href="mailto:${CONTACT}">${CONTACT}</a> about these terms.</p>
      `,
    })
  );
}
