<div align="center">

# ✍️ SignEase

### Collect legally minded e-signatures from anyone, anywhere, in minutes.

Upload a document, place signature fields, share a secure link, and get it back signed.
No printing, no scanning, no account needed for the signer.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![PRs](https://img.shields.io/badge/PRs-welcome-ff69b4)
![Made with](https://img.shields.io/badge/made%20with-TypeScript-3178c6)

[Features](#-features) · [How it works](#-how-it-works) · [Getting started](#-getting-started) · [API](#-api-overview) · [Security](#-security) · [Roadmap](#-roadmap) · [Contributing](#-contributing)

<br />

<!-- Replace with your own screenshot or demo GIF -->
<img src="docs/screenshots/hero.png" alt="SignEase preview" width="800" />

</div>

---

## ✨ Features

- 📄 **Upload any PDF** and place signature, date, initials, and text fields where you need them.
- 🔗 **Remote signing by link.** Send a unique, secure link by email. The signer does not need to install anything or create an account.
- 🖊️ **Three ways to sign.** Draw with a mouse or finger, type a name in a signature style, or upload an image.
- 📱 **Works on every device.** The signing page is fully responsive, so phones and tablets are first class.
- 🔔 **Live status tracking.** See whether a document is pending, viewed, or signed.
- 🧾 **Audit trail.** Every action is logged with a timestamp and IP address.
- ⏳ **Link expiry.** Signing links expire after a period you control and can be revoked at any time.
- ⬇️ **Signed copy download.** Both parties can download the final signed PDF.

> Edit this list so it matches exactly what your app does today.

---

## 🔄 How it works

```mermaid
sequenceDiagram
    participant S as Sender
    participant A as SignEase
    participant R as Remote signer

    S->>A: Upload document and place signature fields
    A->>R: Send secure signing link by email
    R->>A: Open link, review, and sign
    A->>A: Embed signature, hash document, write audit log
    A->>S: Notify that the document is signed
    S->>A: Download signed PDF and audit trail
```

---

## 🧰 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| PDF handling | pdf-lib, PDF.js |
| Email | SMTP (Nodemailer) |
| Deployment | Docker, Docker Compose |

> Adjust this table to your real stack.

---

## 🚀 Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 15 or newer
- npm or pnpm
- Docker (optional, for the one command setup)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/signease.git
cd signease
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Copy the example file and fill in your values.

```bash
cp .env.example .env
```

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/signease` |
| `APP_URL` | Public URL used in signing links | `http://localhost:5173` |
| `JWT_SECRET` | Long random string for signing tokens | `change-me` |
| `LINK_EXPIRY_HOURS` | How long a signing link stays valid | `72` |
| `SMTP_HOST` | Mail server host | `smtp.example.com` |
| `SMTP_PORT` | Mail server port | `587` |
| `SMTP_USER` | Mail server user | `no-reply@example.com` |
| `SMTP_PASS` | Mail server password | `********` |

### 4. Run the database migrations

```bash
npm run db:migrate
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 🐳 Run with Docker

```bash
docker compose up --build
```

---

## 🖱️ Usage

1. **Create a request.** Upload a PDF and add the fields that need to be completed.
2. **Add the signer.** Enter the name and email address of the person who must sign.
3. **Send.** The signer receives an email with a secure link.
4. **Sign.** The signer opens the link, reviews the document, and signs.
5. **Done.** You are notified, and the signed PDF and audit trail are ready to download.

---

## 🔌 API overview

These endpoints are examples. Replace them with your real routes.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/documents` | Upload a document |
| `POST` | `/api/documents/:id/requests` | Create a signing request for a signer |
| `GET` | `/api/documents/:id` | Get document status |
| `GET` | `/api/sign/:token` | Load the document for the signer |
| `POST` | `/api/sign/:token` | Submit the signature |
| `GET` | `/api/documents/:id/download` | Download the signed PDF |

Example request:

```bash
curl -X POST http://localhost:3000/api/documents/42/requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Jane Doe", "email": "jane@example.com" }'
```

---

## 🗂️ Project structure

```text
signease/
├── client/            # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
├── server/            # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── db/
├── docs/              # Screenshots and extra documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔒 Security

- Signing links use long, random, single purpose tokens that expire.
- Documents are hashed before and after signing so changes can be detected.
- All traffic should run over HTTPS in production.
- Signer actions are written to an audit log with timestamp and IP address.
- Secrets live in environment variables and are never committed.

To report a vulnerability, please email **security@your-domain.com** instead of opening a public issue.

### ⚖️ Legal note

Electronic signature rules differ by country and by use case. In the EU, the eIDAS regulation recognizes several signature levels, and some documents require a qualified electronic signature. This software records signatures and an audit trail, but it does not by itself guarantee legal validity for every situation. Check the rules that apply to your documents, and get legal advice when it matters.

---

## 🗺️ Roadmap

- [x] Remote signing by secure link
- [x] Draw, type, and upload signatures
- [x] Audit trail
- [ ] Multiple signers with signing order
- [ ] Reminders for pending signatures
- [ ] Reusable templates
- [ ] Webhooks
- [ ] Two factor identity check for signers
- [ ] Multi language interface

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a pull request that explains what changed and why.

Please run the tests and linter before you open a pull request.

```bash
npm run lint
npm test
```

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

Built by **Your Name** · [GitHub](https://github.com/your-username) · [LinkedIn](https://linkedin.com/in/your-profile)

If this project helps you, consider giving it a ⭐

</div>
