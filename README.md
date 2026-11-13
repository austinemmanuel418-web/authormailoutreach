# Bulk Mailer

Sends one plain-text message to many people through your Gmail.

## Set up (Windows, VS Code)

1. Unzip this folder. In VS Code: File > Open Folder > pick `bulk-mailer`.
2. Open the terminal in VS Code (Ctrl + `) and run:
       npm install
3. Copy `.env.example` and name the copy `.env.local`. Fill in your 4 values.
4. Run:
       npm run dev
   Open http://localhost:3000

## Gmail App Password

1. Google Account > Security > turn on 2-Step Verification.
2. Open https://myaccount.google.com/apppasswords
3. Name it "Bulk Mailer", click Create, copy the 16 letters into GMAIL_APP_PASSWORD.

## Deploy on Vercel

1. `git init`, `git add .`, `git commit -m "Bulk mailer"`, push to a GitHub repo.
2. In Vercel: Add New > Project > import the repo.
3. Add GMAIL_USER, GMAIL_APP_PASSWORD, SENDER_NAME, APP_PASSWORD under Environment Variables.
4. Click Deploy.

.env.local is ignored by git (see .gitignore). Never commit it.
