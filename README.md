# PDF Buddy - AI-Powered PDF Chat Assistant

## Tools and Automation Process Internship
@Unicode Technolab

---

## � Live Demo

**[🌐 https://pdfbuddyai.netlify.app](https://pdfbuddyai.netlify.app)** — Try it now!

---

## �👨‍🎓 Student Information
- **Name:** Patel Jainish M.
- **Enrollment No:** 240163116022
- **Semester:** 7th Sem
- **College:** Government Engineering College Modasa

---

## 📖 About This Repository

**PDF Buddy** is an AI-powered PDF chat assistant that allows users to upload PDF documents and ask questions about their content using natural language. The application leverages Google's Gemini AI models for both document embedding and intelligent question answering.

### 🎯 Project Overview

This project was developed as part of the **Tools and Automation Process Internship** at **Unicode Technolab**. It demonstrates modern web development practices with:

- **Frontend:** Astro framework with vanilla JavaScript components
- **Backend:** Astro API routes with Firebase Firestore
- **Auth:** Firebase Authentication (Google + email/password)
- **AI Integration:** Google Gemini API (Flash-Lite for chat, Embedding-001 for vectors)
- **PDF Processing:** pdf-parse for text extraction
- **Vector Search:** Cosine similarity for semantic document retrieval

### ✨ Key Features

1. **PDF Upload & Processing**
   - Drag-and-drop PDF upload (max 25MB)
   - Automatic text extraction and chunking
   - Document analysis (word count, readability, key terms)

2. **AI-Powered Chat**
   - Semantic search using Gemini embeddings
   - Context-aware answers with source citations
   - Fallback to keyword-based search if AI unavailable

3. **Modern UI/UX**
   - Animated robot mascot
   - Space-themed background
   - Real-time chat interface
   - Responsive design

4. **Data Persistence**
   - Firebase Firestore for documents, chunks, and chat history
   - Firebase Auth for user authentication

### 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Astro 7.x |
| Language | TypeScript |
| Database | Firebase Firestore |
| Auth | Firebase Auth |
| AI/ML | Google Gemini API |
| PDF Processing | pdf-parse |
| Styling | CSS with custom animations |
| Deployment | Netlify / Vercel |

### 📁 Project Structure

```
pdf-buddy/
├── public/                 # Static assets
├── src/
│   ├── components/         # Astro components (UI)
│   │   ├── BootScreen.astro
│   │   ├── ChatScreen.astro
│   │   ├── RobotMascot.astro
│   │   ├── SpaceBackground.astro
│   │   ├── TopBar.astro
│   │   └── UploadScreen.astro
│   ├── layouts/            # Page layouts
│   │   └── Layout.astro
│   ├── lib/                # Core logic
│   │   ├── analysis.ts     # Document analysis
│   │   ├── fallback.ts     # Keyword-based fallback search
│   │   ├── firebase-admin.ts  # Firebase Admin SDK (server)
│   │   ├── firebase.ts     # Firebase client config
│   │   ├── gemini.ts       # Gemini AI integration
│   │   └── pdf.ts          # PDF parsing & chunking
│   ├── middleware/         # Auth middleware
│   │   └── auth.ts
│   ├── pages/              # Pages & API routes
│   │   ├── index.astro     # Main page
│   │   ├── api/
│   │   │   ├── chat.ts     # Chat endpoint
│   │   │   ├── upload.ts   # PDF upload endpoint
│   │   │   └── auth/
│   │   │       ├── me.ts   # Current user endpoint
│   │   │       └── upgrade.ts  # Upgrade plan endpoint
│   │   └── scripts/        # Client-side JS modules
│   │       ├── account.ts
│   │       ├── auth.ts
│   │       ├── chat.ts
│   │       ├── chrome.ts
│   │       ├── history.ts
│   │       ├── main.ts
│   │       ├── robot.ts
│   │       └── upload.ts
│   └── styles/             # Global styles
│       └── global.css
├── .env                    # Environment variables (gitignored)
├── .env.example            # Environment template
├── .gitignore
├── AGENTS.md               # Agent instructions
├── CLAUDE.md               # Claude instructions
├── FIREBASE_SETUP.md       # Firebase setup guide
├── astro.config.mjs        # Astro configuration
├── netlify.toml            # Netlify deployment config
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

### 🚀 Getting Started

#### Prerequisites
- Node.js 22.12.0 or higher
- Google Gemini API key

#### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pdf-buddy

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start development server
npm run dev
```

#### Environment Variables

Create a `.env` file with:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run astro` | Run Astro CLI commands |

### 🌐 Deployment to Netlify

This project is configured for easy deployment to Netlify:

1. Push to GitHub/GitLab/Bitbucket
2. Import project in Netlify
3. Add `GEMINI_API_KEY` environment variable
4. Deploy!

The `netlify.toml` is configured with the Astro adapter for serverless deployment.

### 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload and process PDF |
| POST | `/api/chat` | Ask questions about uploaded PDF |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/upgrade` | Upgrade user plan |

### 🤖 AI Models Used

- **Chat Model:** `gemini-2.5-flash-lite` (Gemini 2.5 Flash-Lite)
- **Embedding Model:** `gemini-embedding-001`

Both models are accessed via the Google Generative Language API.

### 📝 License

This project is developed for educational purposes as part of the Tools and Automation Process Internship at Unicode Technolab.

---

**Developed with ❤️ by Patel Jainish M.**  
Government Engineering College Modasa | Semester 7 | 2024-2025